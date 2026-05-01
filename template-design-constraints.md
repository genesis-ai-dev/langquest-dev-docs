# Template Design — Constraints

Canonical list of constraints guiding the **template-only, fork-based** template system design.

---

## Architecture

| # | Constraint | Notes |
|---|-----------|-------|
| C1 | **Offline-first row-level sync** | PowerSync + SQLite. A single JSONB template row (20-100KB) re-syncing on infrequent edits is acceptable. The app is read-only on templates. |
| C2 | **Template-only (no template_node table)** | Template structure stored as JSONB in `template.structure`. Quests and assets reference `template_node_id` (opaque nanoid) and `template_link_id` (UUID FK to `project_template_link`). No materialized template_node records. |
| C3 | **Fork-based publishing** | Each publish creates a new immutable `template` row. No concurrent editing conflicts. No pessimistic locks. All editing happens locally in browser IndexedDB; the server only stores published snapshots. |
| C4 | **No CRDT or lock dependency** | Immutable published rows eliminate the need for both CRDTs and pessimistic locking. Editing is website-only, single-writer per browser. |

## Template Structure

| # | Constraint | Notes |
|---|-----------|-------|
| C5 | **Arbitrary hierarchical structure** | Users define their own template trees — Bible, FIA, dictionary, video timestamps, poetry, stories, etc. Not hard-coded in app logic. |
| C6 | **Multiple templates per project** | A single project can host several independent template trees. Each is a separate `project_template_link` row linking to a `template`. |
| C7 | **Mid-project modification** | Template structure can be added to, removed from, reordered, or renamed after work has begun. In update mode (re-pointing existing projects), removed nodes are soft-deleted (`deleted: true`) to preserve linked contributions. In starting-point mode (fresh copy), removed nodes are hard-deleted from the JSONB. |
| C8 | **Template sharing via templates** | Templates are shared as `template` rows. Projects reference templates via `project_template_link`. Forking = duplicating one row. |
| C9 | **Max depth = 5** | Template hierarchy limited to 5 levels deep (root + 4 levels). Validated by RPCs on publish. |
| C10 | **Opaque node IDs** | Node IDs are `nanoid(10)`, opaque and immutable once created. No `external_id` field. Backfill and cron jobs use tree-walking and `metadata` for semantic matching. |

## Ownership & Scope

| # | Constraint | Notes |
|---|-----------|-------|
| C11 | **Selective modification scope** | An editor can only apply template changes to projects *they own*, regardless of template ownership. Implemented via RPCs that fork a template and re-point `project_template_link` records. |
| C12 | **No record accumulation** | Avoid O(projects x template_size) row counts. Template structure is shared JSONB, not per-project materialized rows. |
| C13 | **Ownership-gated control** | Template modification permissions derive from project ownership (dynamic, can be granted/revoked). Not baked into the template. |
| C14 | **Frozen project links** | Pre-migration Bible/FIA project links have `frozen = true` on `project_template_link`, preventing re-pointing. The templates themselves remain forkable. |

## Versioning & Contributions

| # | Constraint | Notes |
|---|-----------|-------|
| C15 | **Quest versioning** | Multiple quests pointing to the same `template_node_id` = versions of that structural unit. |
| C16 | **No verse splitting** | Users cannot split a verse into sub-parts (e.g. 1:1a, 1:1b). |
| C17 | **Verse spanning** | A single asset can cover a contiguous range of template nodes via `template_node_id` (start) + `span_end_template_node_id` (end). |
| C18 | **No rollback** | Reverting to a previous template version is not supported (would orphan linked contributions). `template_revision` provides audit history only. |

## Drafts & Publishing

| # | Constraint | Notes |
|---|-----------|-------|
| C19 | **Browser-side drafts** | Editor drafts and undo/redo history stored in browser IndexedDB. Drafts include editing mode (`starting_point` \| `update`), metadata, and target project link selection. No server-side draft state. |
| C20 | **Immutable published rows** | Published `template` rows are never modified structurally. The fork model (each publish = new row) replaces `structure_version` concurrency control. |
| C21 | **Publish = insert a new immutable row** | Publishing always creates a new `template` row. In update mode, selected `project_template_link` rows are re-pointed to the new row. Provenance tracked via `copied_from_template_id`. |

## Labeling & Navigation

| # | Constraint | Notes |
|---|-----------|-------|
| C22 | **Generalized labeling** | `short_label` and `label_template` fields on `TemplateNode` drive all UI labels. No hardcoded Bible/FIA labeling logic. |
| C23 | **Offline browsing from JSONB** | Users browse full template structure offline by reading `template.structure` directly. No server call required for navigation. |
| C24 | **No special app logic for Bible/FIA** | All UI driven generically by template structure fields (`node_type`, `linkable_type`, `is_download_unit`, `is_version_anchor`, `allows_spanning`). |

## Per-Language & Automation

| # | Constraint | Notes |
|---|-----------|-------|
| C25 | **Per-languoid templates** | Templates have a `source_languoid_id`. Standard templates (Bible, FIA) exist as separate templates for each languoid. |
| C26 | **auto_sync flag** | Controls global vs. on-demand synchronization. Dev-only, not user-editable. `auto_sync = true` templates appear in global sync bucket. |
| C27 | **FIA cron refresh** | `pg_cron` + Supabase Edge Function refreshes FIA pericopes daily, applying additive changes to source templates. |

## Migration & Compatibility

| # | Constraint | Notes |
|---|-----------|-------|
| C28 | **Minimal migration** | All new columns are nullable. Existing tables reused. Legacy fields (`quest.metadata`, `project.template` enum) remain until full migration. |
| C29 | **Backward compatibility** | Unstructured projects keep working via `quest.parent_id` hierarchy. Template-aware code checks `template_node_id` first, falls back to legacy fields. |
| C30 | **No unstructured projects** | All new projects must pick a template. Legacy unstructured projects are grandfathered but not creatable going forward. |
