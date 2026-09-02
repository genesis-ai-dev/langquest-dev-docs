# Plan: Replace the PowerSync attachment queue with domain-driven audio sync

Status: awaiting approval
Repo: `langquest`
Depends on: migration `20260822120000_add_audio_uploaded_at_to_acl.sql` (shipped — dual
triggers stamp `asset_content_link.audio_uploaded_at` server-side regardless of
file/record arrival order, plus backfill)

## Why

The current system (`AbstractSharedAttachmentQueue` + `PermAttachmentQueue` + the
PowerSync `attachments` table) maintains a client-side mirror of sync state because it
has no server confirmation of uploads. That single root cause produces all of its known
defects:

- **`QUEUED_SYNC` race** — direction (upload vs download) must be inferred; since
  `local_uri` is always set, inference degenerates to stat-ing files at work time, and
  the concurrent download loop can mark a never-uploaded file `SYNCED`, stranding it.
- **Permanent-loss chain** — `onUploadError` → `ARCHIVED` → `expireCache` deletes the
  only copy of a local file on non-retryable errors (including RLS rejections triggered
  by the RLS-blind `.list()` pre-check in `SupabaseStorageAdapter`).
- **Scale pain** — every watcher firing re-collects every referenced filename (tens of
  thousands) to reconcile the mirror table; uploads are strictly serial.

`audio_uploaded_at` (file confirmed) and `uploaded_at` (record confirmed) are stamped
server-side and sync down through PowerSync. That makes the mirror table unnecessary:
every audio file's state is fully determined by three facts we already have —
*is it referenced*, *is `audio_uploaded_at` set*, *is the file on disk*.

| `audio_uploaded_at` | local file | meaning |
|---|---|---|
| null | yes | needs upload |
| null | no | pre-publish (`local/` prefix) — or a visible anomaly |
| set | no | needs download (rows are already scoped by `download_profiles`) |
| set | yes | done; deletable *if* a release mechanism ever exists |

## Design

Five pieces, one job each. **No persisted queue state anywhere** — both work lists are
derived on demand, so there is nothing to corrupt, migrate, or race against.

| Module | Responsibility | State owned |
|---|---|---|
| `utils/attachmentPaths.ts` | filename → local URI, deterministic, no DB | none |
| `services/attachments/LocalFileIndex.ts` | what audio files exist on disk | in-memory `Set<filename>` + change event |
| `services/attachments/AudioUploader.ts` | upload referenced-but-unconfirmed files | in-memory backoff map |
| `services/attachments/AudioDownloader.ts` | download confirmed-but-missing files | in-memory in-flight set |
| `SupabaseStorageAdapter` (kept, trimmed) | raw storage I/O | none |

All new queries are written in **Drizzle** (the `db.watch(drizzleQuery, { onResult })`
pattern already used in `PermAttachmentQueue.ts:145`).

### attachmentPaths.ts

```ts
resolveAudioUri(audioValue: string): string
// 'local/{uuid}.m4a' → getLocalUri('shared_attachments/local/{uuid}.m4a')
// '{uuid}.m4a'       → getLocalUri('shared_attachments/{uuid}.m4a')
// 'file://…'         → as-is
```

Behavior-identical to today's attachments-table lookup because `local_uri` was always
the deterministic `shared_attachments/{filename}` — the table never added information.
Web keeps its OPFS variant via the existing `fileUtils.ts` / `fileUtils.web.ts` split.

### LocalFileIndex

One directory listing of `shared_attachments/` + `shared_attachments/local/` at startup
builds a `Set<filename>`. `saveAudioLocally`, `promoteLocalAudio`, and the downloader
update it on every write. Exposes `has()`, `add()`, `list()`, and a change event for
hooks. This is what keeps work-list derivation from stat-ing tens of thousands of files.

### AudioUploader

Work list (the entire queue — Drizzle over both tables, because the translation-modal
path references a publishable filename before its row syncs; the dual server triggers
make upload/record ordering irrelevant):

```sql
SELECT audio FROM asset_content_link_synced WHERE audio IS NOT NULL AND audio_uploaded_at IS NULL
UNION ALL
SELECT audio FROM asset_content_link        WHERE audio IS NOT NULL AND audio_uploaded_at IS NULL
```

flattened to filenames, minus `local/`-prefixed values (pre-publish stays local by
design), intersected with `LocalFileIndex`.

- Drizzle watch on that query, ~2 s debounce, drained by a **4-way concurrency pool**
  (vs strictly serial today).
- Upload via `SupabaseStorageAdapter` with `upsert: true`; the RLS-blind `.list()`
  pre-check is deleted (upsert makes it pointless; it fed the old deletion chain).
- Errors: per-file exponential backoff (30 s → 1 m → 5 m → 30 m cap), memory-only,
  reset on restart/connectivity regain. **No error is ever terminal** and no error
  path touches a file. Stuck files surface as a count in the drawer.
- Completion is never declared by the client: the storage trigger stamps
  `audio_uploaded_at`, PowerSync syncs it down, the row falls out of the watch.
  Uploader, progress drawer, and server cannot disagree.
- Safety net: re-derive on app foreground + connectivity regain + a light 60 s tick
  (re-runs the same cheap query; no reconcile scan exists to be expensive).

### AudioDownloader

Work list: filenames in `asset_content_link_synced` where `audio IS NOT NULL AND
audio_uploaded_at IS NOT NULL`, minus `LocalFileIndex`. Scope needs no new code —
`download_profiles` already gates which rows PowerSync syncs (identical to the old
queue's effective scope). 25-way concurrency as today. Side benefit: the
`audio_uploaded_at IS NOT NULL` filter stops the endless 404 retries against
historically-lost files (backfill only stamped objects that exist). Images are dropped
entirely — nothing populates `asset.images`.

### File deletion: forbidden

There is no release mechanism yet, so **no code path may delete an audio file**. The
queue's `expireCache`/`ARCHIVED` machinery disappears with the queue; three more
existing deletion paths are neutralized in the same release:

1. `utils/questOffloadUtils.ts` — offload keeps whatever row behavior it needs, but the
   file-deletion portion is disabled with a `TODO(release-mechanism)`.
2. `services/corruptedAttachmentsService.ts` + `views/CorruptedAttachmentsView.tsx` —
   retired; the blob-URL corruption it repairs is an artifact of the old queue's records.
3. `views/ProfileView.tsx` dev wipe (tautological WHERE) — deleted.

Future contract, implemented later as exactly one function all cleanup must call: a file
may be deleted only when its synced row has `audio_uploaded_at IS NOT NULL`.

## Write-protection for uploaded_at / audio_uploaded_at

Three layers; the server layer is the real guarantee:

1. **ESLint** — `no-restricted-syntax` selector rejecting `uploaded_at` /
   `audio_uploaded_at` keys inside `.values({…})` / `.set({…})` call arguments,
   with a pointer message. Dev-time guidance only.
2. **Client choke point** — `SupabaseConnector.uploadData` strips both columns from
   outgoing CRUD ops for all four spline tables. This matters today: a PowerSync `PUT`
   replays every column of the local row, so a client can currently echo stale
   synced-down `uploaded_at` values back to the server.
3. **Server migration** (new, e.g. `..._protect_upload_confirmation_columns.sql`) —
   `BEFORE INSERT OR UPDATE` guard triggers on `quest`, `quest_asset_link`, `asset`,
   `asset_content_link` that revert client-supplied values (`NEW.col := OLD.col` on
   update / `NEW.col := NULL` on insert) when the effective role is
   `authenticated`/`anon`. The existing stamping functions are `SECURITY DEFINER`
   (owner `postgres`), so their writes pass the guard. Verify interaction with the
   existing `uploaded_at` BEFORE INSERT stamping triggers during implementation.

## Touch-point migration map

| Today | Becomes |
|---|---|
| `saveAudio` (`publishQuest.ts:590`, `NextGenNewTranslationModal.tsx:483`, `restoreUtils.ts:314`) | `promoteLocalAudio(filename)`: file move `local/{name}` → `{name}` only (matches the existing `REPLACE(audio,'local/','')` rewrite); no record creation |
| `saveAudioLocally` | unchanged + `LocalFileIndex.add` |
| Playback lookups querying `attachments` (`NextGenAssetsView`, `RecordingView`, `BibleAssetsView`, `NextGenAssetDetailView`, `localAudioConcat`, `VerseSegmentModal`, `importWizard`, translation views) | `resolveAudioUri` + `LocalFileIndex.has` |
| `useAttachmentStates`, `useAttachmentProgress`, `useSyncState`, `AppHeader` badge | new `useAudioSyncStatus` (uploader/downloader status + domain counts) |
| `useAssetDownloadStatus`, `useQuestOffloadVerification` attachments portions | `LocalFileIndex` + domain queries |
| `onUploadError` / `onDownloadError` in `system.ts` | gone; backoff lives in workers |
| Queue init / `ensureAttachmentQueuesReady` | `system.audioSync.start()` after PowerSync connects |
| `AttachmentTable` in the PowerSync schema | **removed this release** (see below) |
| `useQuestUploadProgress` raw `COUNTS_SQL` | rewritten in Drizzle (`sql`-fragment aggregates only, e.g. `count(*) filter (where uploaded_at is not null)`); behavior unchanged |
| `QuestUploadDetailsDrawer`, `QuestSyncedBadge` | unchanged (already domain-driven) |
| `FiaAttachmentQueue` | untouched (independent system) |

## Dropping the attachments table this release

Decision: remove `AttachmentTable` from the PowerSync schema now, not in N+1.

- Rescue of historically stranded files is automatic: any on-disk file whose row still
  has `audio_uploaded_at IS NULL` lands in the uploader work list. No table needed.
- Device-local forensics can't be harvested remotely anyway; loss quantification is
  done server-side against `storage.objects` (queries already written).
- Rollback-safe: the old queue rebuilds its table from a domain-table reconcile scan on
  first run, so re-shipping the old code recreates state.
- Dropping the schema entry makes PowerSync drop `ps_data__attachments`; files on disk
  are untouched. Every reader of the table is migrated in this same release (see map).
- `utils/dbUtils.ts:147` (`DROP TABLE IF EXISTS ps_data__attachments`) stays as
  harmless cleanup for upgraded devices.

## Old clients / rollout

Server side is client-agnostic: triggers stamp confirmations no matter which client
version uploads, and uploads are idempotent (`upsert`), so old-queue and new clients
coexist. The unfixable risk on old clients is their local deletion chain, so:

1. This release: `APP_SCHEMA_VERSION` → `2.6` (`db/constants.ts`).
2. Follow-up migration after adoption: `get_schema_info()` raises
   `min_required_schema_version` → `2.6`, blocking stragglers via the existing
   `checkAppUpgradeNeeded` → `AppUpgradeScreen` path.

On-device upgrade requires no data migration: disk layout and filename conventions
(`local/{uuid}.{ext}` pre-publish, `{uuid}.{ext}` published) are unchanged.

## Implementation order (each step compiles and ships)

1. **Foundations** — `attachmentPaths.ts`; `LocalFileIndex` (native + OPFS web); trim
   `SupabaseStorageAdapter` (drop `.list()` pre-check).
2. **Workers** — `AudioUploader`, `AudioDownloader` (Drizzle queries), wired in
   `system.ts`; old queue init removed in the same commit (never both running).
3. **Call sites** — `promoteLocalAudio` swaps; playback resolution swaps; status hooks
   (`useAudioSyncStatus`) replace attachments-based hooks; drop `AttachmentTable` from
   schema; delete queue classes + `@powersync/attachments` dependency +
   `ATTACHMENT_QUEUE_LIMITS`.
4. **Deletion-path neutralization** — offload, corrupted-attachments retirement, dev
   wipe removal.
5. **Write protection** — ESLint rule; `uploadData` strip; server guard-trigger
   migration.
6. **Drizzle cleanup** — rewrite `useQuestUploadProgress` counts in Drizzle.
7. **Version gates** — `APP_SCHEMA_VERSION = 2.6`; separate follow-up migration for
   `min_required_schema_version` after adoption.

## Size estimate

~3,100 first-party lines removed (queue classes 1,153; corrupted service + view 722;
attachments hooks 386; `attachmentUtils` 158; partial trims ~750) plus the deprecated
`@powersync/attachments` dependency, replaced by ~640 new lines.

## Visible behavior changes

- Uploads run 4-wide → materially faster publishes.
- Historically-lost files (referenced, `audio_uploaded_at` null, nowhere on disk or in
  storage) stop retrying and show as anomalies instead of spinning forever.
- No file is ever deleted locally, including by quest offload, until a release
  mechanism gated on `audio_uploaded_at` exists.
