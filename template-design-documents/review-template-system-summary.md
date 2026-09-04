# Review (Process) Template System — Condensed Summary

Compact reference for the review/workflow system. Companion to the full [review-template-system.md](./review-template-system.md). Nothing omitted, just compressed.

---

## What it is

- A **workflow template** = one JSONB blob defining the **ordered review phases** a finished quest version passes through before approval (e.g. ETEN: Team → Community → Church → Blessing Board). Generic/configurable per partner.
- It governs **only** review — not preparation work. Three separate templates are in play:


| Template                                            | Declares           | Nodes referenced by                                        |
| --------------------------------------------------- | ------------------ | ---------------------------------------------------------- |
| Content/project template                            | passage structure  | translation assets (`asset.template_node_id`), assignments |
| Study material template (future `library_template`) | FIA prep steps 1–6 | contribution/prep assets (`asset_link`), assignments       |
| Process/workflow template (this doc)                | review phases      | `review_decision`, `project_phase_group` (by opaque id)    |


- The three are tied together only at the **work/assignment layer**, never by direct reference.
- **App** does the work (record, mark done, submit, review, flag). **Website** configures (build templates, map groups, assign, audit).
- Content template ships **first** (process references its nodes heavily).

---

## Core constraints & decisions (C1–C14)


| #   | Constraint                                                                                                                    |
| --- | ----------------------------------------------------------------------------------------------------------------------------- |
| C1  | Shared JSONB single-row, fork-always architecture (same as content templates)                                                 |
| C2  | Fork-always, immutable published templates; `copied_from_template_id` tracks lineage (no locks/conflicts)                     |
| C3  | Website-only editing (IndexedDB drafts); app is read-only on templates                                                        |
| C4  | String refs into JSONB, not FKs (`phase_id`/`group_slot_id`); validated in app; removed items keep `deleted:true` tombstones  |
| C5  | Groups are first-class (`project_group`, separate from `profile_project_link`); unit of assignment & review                   |
| C6  | One `assignment` mechanism drives every stage (translation/rework/review/approve)                                             |
| C7  | Objective passage progress inferred from individual assignment progress                                                       |
| C8  | All language contributions are assets (`journal`/`journal_entry`/`comment`); no dedicated content tables                      |
| C9  | Contributions cross-version (bind to study-material step + project, not a quest version)                                      |
| C10 | `review_event` is the source of truth (event sourcing); append-only, server-only, never synced; state columns are projections |
| C11 | Additive, opt-in rollout (only `quest.submission_state` + new `asset.content_type` values; no workflow = vote-based approval) |
| C12 | Depends on quest remixing (partial-work / partial-rework)                                                                     |
| C13 | One polymorphic `asset_link` table (target_type, target_id, link_role) with denormalized `project_id`                         |
| C14 | Review state reduced server-side by a DB trigger; clients only write rows (synced offline-first via `ps_crud`); template-driven reducer recomputes projections in one txn; no client transition RPC |


---

## Five layers + schema

`pk` = primary key, `FK` = foreign key. **String refs** point into JSONB, validated server-side not by DB constraints. **Enum columns** reference these named types (single source of truth):

```typescript
type SubmissionState   = 'draft' | 'submitted' | 'in_review' | 'rework' | 'withdrawn' | 'approved_final';  // quest.submission_state
type SubmissionStatus  = 'pending' | 'in_review' | 'rework' | 'completed' | 'withdrawn';                    // review_submission.status
type Decision          = 'approved' | 'rejected' | 'withdrawn';                                             // review_decision.decision
type SignoffRule       = 'any_one' | 'unanimous' | 'quorum';                                                // phases[].signoff_rule (across groups) & group_slots[].signoff_rule (within a group, over members)
type AssignmentType    = 'translation' | 'rework' | 'review' | 'approve';                                   // assignment.assignment_type
type AssignmentStatus  = 'pending' | 'in_progress' | 'completed' | 'cancelled';                             // assignment.status
type CompletionRule    = 'any' | 'all';                                                                     // assignment.completion_rule
type AssigneeType      = 'profile' | 'group';                                                               // assignment.assignee_type (also reused in ReviewEventPayload)
type AssignmentTarget  = 'quest' | 'asset' | 'template_node';                                               // assignment.target_type
type LinkRole          = 'anchor' | 'comment_on' | 'reply_to' | 'revision_of' | 'flag' | 'references' | 'applies_to' | 'member_of';  // asset_link.link_role
type LinkTarget        = 'quest' | 'asset' | 'template_node' | 'study_material_node' | 'review_decision' | 'review_submission';       // asset_link.target_type
type GroupRoleType     = 'translator' | 'reviewer' | 'coordinator';                                         // project_group.role_type
type ContentType       = 'source' | 'translation' | 'transcription' | 'journal' | 'journal_entry' | 'comment';  // asset.content_type
type ReviewEventType   = ReviewEventPayload['event_type'];  // review_event.event_type (13 events; derived from the payload union, Layer 5)
```

### Layer 1 — Workflow template (website-configured)

`**workflow_template**`

- `id` (pk)
- `name`, `description`, `slug`
- `structure` (JSONB — phases + group slots)
- `creator_id` (FK → profile; null = system)
- `copied_from_template_id` (FK → self; provenance)
- `shared`, `active`
- `created_at`, `last_updated`
- *No `project_count`* — popularity = query over `project` grouped by `workflow_template_id` (a stored counter would churn the synced row).

`**workflow_template_revision**` (audit only, not synced)

- `id` (pk)
- `workflow_template_id` (FK)
- `actions` (JSONB diff)
- `saved_by` (FK → profile), `saved_at`
- *No `structure` snapshot* — the immutable published `workflow_template` row already holds it; only the diff + authorship are unique here.

**RPCs:** `publish_workflow_template`, `fork_workflow_template`, `save_workflow_template_metadata`.

`**structure` JSONB:**

```typescript
type WorkflowStructure = {
  format_version: number;
  phases: WorkflowPhase[];        // ordered review stages — the ONLY thing a process template defines
};
type WorkflowPhase = {
  id: string;                     // nanoid(10), stable, immutable
  name: string;
  description?: string;
  // no order_index — array position in `phases` is the order (JSONB preserves it)
  signoff_rule: 'any_one' | 'unanimous' | 'quorum';  // across this phase's groups
  quorum_threshold?: number;      // fraction of mapped groups, auto-adjusting denominator (e.g. 0.66)
  group_slots: WorkflowGroupSlot[];
  deleted?: boolean;
};
type WorkflowGroupSlot = {
  id: string;                     // nanoid(10), stable, immutable
  name: string;
  description?: string;
  signoff_rule: 'any_one' | 'unanimous' | 'quorum';  // how this one group reaches its verdict (over members)
  quorum_threshold?: number;      // fraction of the group's members
  deleted?: boolean;
};
```

Each `id` is opaque; `project_phase_group` maps it to real groups; decisions reference it — never branched on by name. Prep steps and passage structure are NOT here.

`**actions` (revision diff) JSONB** — `workflow_template_revision.actions` stores a `TemplateDiff`, computed at publish by walking old/new `structure` by stable node id. Shared shape across all three template systems:

```typescript
type DiffEntryBase = { nodeId: string; nodeName: string };
type DiffEntry =
  | (DiffEntryBase & { type: 'add';             details: { parentId: string | null; index: number; kind?: string } })
  | (DiffEntryBase & { type: 'remove';          details: { parentId: string | null } })
  | (DiffEntryBase & { type: 'rename';          details: { from: string; to: string } })
  | (DiffEntryBase & { type: 'move';            details: { fromParentId: string | null; toParentId: string | null; fromIndex: number; toIndex: number } })
  | (DiffEntryBase & { type: 'hide';            details: { parentId: string | null } })   // sets deleted: true
  | (DiffEntryBase & { type: 'unhide';          details: { parentId: string | null } })   // clears deleted: true
  | (DiffEntryBase & { type: 'property_change'; details: { property: string; from: unknown; to: unknown } });
type DiffActionType = DiffEntry['type'];
type TemplateDiff = { summary: Partial<Record<DiffActionType, number>>; entries: DiffEntry[] };
```

### Layer 2 — Project configuration (website-configured)

`**project**` (columns added)

- `workflow_template_id` (FK → workflow_template; nullable; the project's single workflow)
- `workflow_frozen` (blocks re-pointing mid-review)
- **No `project_workflow_link` table** — a 1-per-project link table is just columns on `project` in costume. Adoption mutates `project.workflow_template_id` in place (fork re-point); `set_project_workflow` RPC instantiates template-declared journal lists.
- **History** isn't version-pinned: protected by *constraining forks* (adoption compatibility check ensures every referenced `phase_id`/`group_slot_id` still exists) + the `review_event` log preserves true sequence.

`**project_group`**

- `id` (pk)
- `project_id` (FK)
- `name`
- `role_type` (`translator` | `reviewer` | `coordinator`)
- `description`, `active`

`**project_group_member**`

- `id` (pk)
- `project_group_id` (FK)
- `profile_id` (FK)
- `active`

`**project_phase_group**` (maps abstract slots → real groups)

- `id` (pk)
- `project_id` (FK)
- `phase_id` (string ref → workflow JSONB)
- `group_slot_id` (string ref → workflow JSONB)
- `project_group_id` (FK)

Coordinator picks template → maps each `group_slot` to a real `project_group`. No auto-propagation; new forks explicitly adopted with compatibility check.

### Layer 3 — Work

`**assignment**`

- `id` (pk)
- `project_id` (FK)
- `target_type` (`quest` | `asset` | `template_node`)
- `target_id` (UUID or opaque node id, per target_type) — **⚠ range repr TBD**
- `assignee_type` (`profile` | `group`)
- `assignee_id` (FK → profile | project_group)
- `assignment_type` (`translation` | `rework` | `review` | `approve`)
- `status` (`pending` | `in_progress` | `completed` | `cancelled`)
- `completion_rule` (`any` | `all`, default `any`)
- `assigner` (FK → profile)
- `notes`
- Early assignment can't target an asset (doesn't exist yet) → asset targeting mainly for **rework**. Once content template exists, target a template node id / range.

`**assignment_item_completion`**

- `id` (pk)
- `assignment_id` (FK)
- `node_id` (string ref — the completed node)
- `completed_at`

**Progress & completion (Option B — decided):**

- Discrete completion of named units, **not** percentages ("step 1 of 6 done"); any % derived at display.
- **Completability is implied by an assignment targeting a node** — no `completable` flag, no `step_progress` table. Single-node assignment done when assignment is; range/multi-node tracked per node in `assignment_item_completion`.
- **Multi-assignee merge:** `completion_rule` `any` (done when anyone completes — shared translation) or `all` (each must — study steps each person digests); objective view computed at query time, no rollup table.
- Study-material steps have non-countable prompts → **contributions never count toward completion** (surfaced/notified only).

`**asset_link`** (one polymorphic linking table)

- `id` (pk)
- `asset_id` (FK)
- `target_type` (`quest` | `asset` | `template_node` | `study_material_node` | `review_decision` | `review_submission`)
- `target_id` (UUID or opaque node id, per target_type)
- `link_role` (`anchor` | `comment_on` | `reply_to` | `revision_of` | `flag` | `references` | `applies_to` | `member_of` | …) — **⚠ role set governed (open Q)**
- `project_id` (FK; denormalized for RLS/sync)
- `anchor_data` (JSONB, nullable — see AnchorData)
- `order_index`, `active`, `created_at`

Notes:

- **Additive — does NOT replace `quest_asset_link`** (membership join stays). Replaced the *proposed* `asset_anchor`, `review_comment`, `review_asset_flag`.
- Polymorphic because half the targets are opaque JSONB node ids (no FK possible anyway); new target types = new enum value, not a migration; `link_role` is the real generalization.
- Costs handled: no DB referential integrity → server-side validation + server orphan checks; no FK path for sync → `project_id` denormalized on every row (contributions must link to project explicitly — may predate any quest, and template/study nodes are shared across projects). `asset_content_link` unchanged (it's the asset's *payload*; `asset_link` is what it *points at*).

**Contributions:**

- Extended `**asset.content_type*`*: `journal` | `journal_entry` | `comment` (+ existing `source`|`translation`|`transcription`). Kind subtypes dropped — **lists are the categories**. `content_type` = what an asset *is* (set once); `link_role` = how it *connects* (mutable).
- Study material lives in the LangQuest DB (own structured content, stable node ids) — see [library template system](./library-template-system.md).
- A contribution = asset + `asset_link` role `anchor` → study-material node, optional `anchor_data`.

**Anchoring (decided — fine-grained MVP, version-pinned):**

1. **Version pinning** — published study material immutable; anchor records which version (char offsets against immutable doc are permanent).
2. **Quote selectors** (W3C Web Annotation) — store offsets + exact text (+prefix/suffix). Three jobs: render without source, re-anchoring key on fork adoption, drift detector.

```typescript
type AnchorData = {
  text?:  { start: number; end: number; exact: string; prefix?: string; suffix?: string };
  audio?: { start_ms: number; end_ms?: number; audio_ref: string };
};
// either/both; null = node-level anchor
```

- Contributions cross-version (bind to study material + project). Revision threads = `revision_of` chains; `active` flag marks head.
- **Visibility project-wide** (anyone in project sees all; no per-asset ACL; visibility == `project_id` sync bucket). Contextual narrowing via anchors. Future group-private path: `visibility` enum on `asset_link`.
- **Deferred:** re-anchoring server job across study-material versions (exact-quote match → rewrite offsets; no match → mark stale but keep displayable).

**Key terms (first-class glossary):**

- A **key-term entry** = `journal_entry` asset that's a **member of the project's Key Terms list** (key-term-ness = list membership, no anchor required, created offline). Rendering = the entry's own `asset_content_link` content (text/audio); `revision_of` chain tracks evolution.
- Outbound `applies_to` → content-template nodes/ranges; inbound `references` from discussions/rationales/translations.
- Glossary view = the Key Terms list (template-declared, stable identity); filing-dependent.
- **Enter review** via **submit-time revision pinning**: when the `review_submission` row syncs in, the reducer trigger snapshots revision ids of Key-Terms members `applies_to`-linked to submitted nodes / `references`-linked from its assets → reviewers see exact glossary state; approvals can't drift.

**Lists & journal:**

- **List** = asset (`content_type='journal'`); name is acl content (oral-first); gets revisions/comments free.
- **Entry** = asset (`content_type='journal_entry'`); membership = `member_of` link (with `order_index`, LWW on reorder). One entry → many lists. Anchoring orthogonal to filing.
- **Template-declared lists:** `structure` JSONB carries `lists:[{id,name,kind}]`; `set_project_workflow` instantiates as `journal` rows with `template_list_id` backref. User-created lists = same rows minus backref.
- Project-wide reach falls out of sync (project-bucket rows). Future: server-suggested `applies_to` links.
- **The journal** = union of all non-quest-bound contributions + lists organizing them. (Lists = views into it. "Library" reserved for study content itself.)
- New surface: 2 content_types, 1 link role (`member_of`), 1 JSONB field (`lists`). No new tables, no CRDT.

### Layer 4 — Review

`**quest`** (column added)

- `submission_state` (`draft` | `submitted` | `in_review` | `rework` | `withdrawn` | `approved_final`, default `draft`)
- Partial unique constraint: only one quest per pericope per project in a non-draft/non-withdrawn state at a time (relies on quest remixing).

`**review_submission**` (one per quest-version pass; reused across rework)

- `id` (pk)
- `quest_id` (FK)
- `project_id` (FK)
- `current_phase_id` (string ref → workflow JSONB) — **projection**
- `status` (`pending` | `in_review` | `rework` | `completed` | `withdrawn`) — **projection**
- `submitted_by` (FK → profile), `submitted_at`

`**review_decision`** (one member's vote at one phase, within their group)

- `id` (pk)
- `review_submission_id` (FK)
- `phase_id` (string ref), `group_slot_id` (string ref)
- `project_group_id` (FK)
- `decision` (`approved` | `rejected` | `withdrawn`)
- `decided_by` (FK → profile) — the voting member
- `decided_at`
- `active`
- *Group verdict + phase outcome are computed by the reducer, not stored.*
- *Reason is not a column* — it's a `comment_on` comment-asset.

**Comments & flags are assets, not tables:**

- **Comment** = asset (`content_type='comment'`) + `asset_link` `comment_on` → submission/decision/asset; threads via `reply_to`.
- **Flag** = `asset_link` `flag` from a comment-asset → flagged asset, scoped to submission; resolution flips `active` (recorded as event → resolved_by/at in log).
- Each vote (`review_decision`) stays structured (two-level signoff needs typed/queryable). Comment visibility project-wide.

**Submission & decision separate (Q9):** approval aggregates at two levels — members → group (slot rule), then groups → phase (phase rule), each configurable (one/all/quorum) → one submission collects many member votes.

**State columns are projections** (`quest.submission_state`, `review_submission.status`, `current_phase_id`) — all server-computed from `review_event`, never client-written, recomputed in the appending txn (can't drift).

**Phase advancement:** submission enters phase → all mapped groups receive → members vote → each group resolves per **slot** signoff rule (over members) → phase resolves per **phase** signoff rule (over group verdicts) = advance; a group verdict of reject = rework; final satisfied = `approved_final`. Cannot advance while any flag link `active`.

**Withdraw cascade:** withdrawing at phase N invalidates all decisions at phases > N and returns to phase N.

### Layer 5 — Review engine (statechart + event-sourced projections)

- Formally a **hierarchical statechart**: `in_review` superstate → ordered phase substates → parallel regions (one per mapped group); each group resolves over its members' votes (slot signoff), then the phase transition is guarded by the phase signoff over those group verdicts — two nested levels, both over active `review_decision` rows; withdraw-cascade = transition with downstream side effects.
- **Event sourcing, server-owned projections, no external engine; reduction runs in a DB trigger** (not a client RPC).
- `**review_event*`* — the log; append-only, server-only (not synced):
  - `id` (pk)
  - `event_type` (`ReviewEventType` — 13 events)
  - `actor` (FK → profile)
  - `target_type`, `target_id` (finest-grained entity the event concerns)
  - `payload` (JSONB — `ReviewEventPayload`, discriminated on `event_type`)
  - `project_id` (FK)
  - `created_at`

`**review_event.payload**` — discriminated union keyed on `event_type`. Convention: every payload restates `submission_id` (the review spine) so the reducer locates the submission without consulting `target_type`. `approved`/`rejected` are **computed group verdicts** (member votes live only in `review_decision`); their `actor` is the member whose vote completed the group's signoff.

```typescript
type ReviewEventPayload =
  | { event_type: 'submitted';            submission_id: string; quest_id: string; entry_phase_id: string; pinned_revisions: string[] }
  | { event_type: 'approved';             submission_id: string; phase_id: string; group_slot_id: string; group_id: string; decision_ids: string[] }   // computed group verdict
  | { event_type: 'rejected';             submission_id: string; phase_id: string; group_slot_id: string; group_id: string; decision_ids: string[]; comment_asset_id: string | null }   // computed group verdict
  | { event_type: 'withdrawn';            submission_id: string; decision_id: string; phase_id: string; group_slot_id: string }   // a member withdrew their vote
  | { event_type: 'cascade_invalidated';  submission_id: string; from_phase_id: string; invalidated_decision_ids: string[] }
  | { event_type: 'comment_added';        submission_id: string; comment_asset_id: string; on_target_type: 'review_submission' | 'review_decision' | 'asset'; on_target_id: string; reply_to_asset_id: string | null }
  | { event_type: 'asset_flagged';        submission_id: string; flag_link_id: string; flagged_asset_id: string; comment_asset_id: string }
  | { event_type: 'flag_resolved';        submission_id: string; flag_link_id: string }
  | { event_type: 'rework_assigned';      submission_id: string; assignment_id: string; assignee_type: AssigneeType; assignee_id: string }
  | { event_type: 'rework_completed';     submission_id: string; assignment_id: string }
  | { event_type: 'phase_advanced';       submission_id: string; from_phase_id: string | null; to_phase_id: string }
  | { event_type: 'workflow_completed';   submission_id: string; quest_id: string; final_phase_id: string }
  | { event_type: 'submission_withdrawn'; submission_id: string; at_phase_id: string };
```

- **Clients only write rows — offline-first.** A vote = a `review_decision` row (comment = `asset` + `asset_link`; flag = `asset_link`). Ordinary local writes synced up via `ps_crud` like any edit; clients never write projections, never call a transition RPC.
- **A trigger reduces — not an RPC.** When a synced `review_decision` / `asset_link` row lands, a **DB trigger** runs the reducer in one txn: (1) validate row vs current state, (2) evaluate signoff at **both levels** against workflow JSONB + active votes — group verdict from members (slot rule), then phase outcome from group verdicts (phase rule) — (3) append `review_event`(s), (4) recompute projections, (5) on rejection create the rework `assignment`. *(Differs from content/library edits, which go through the `apply_table_mutation` upload RPC; trigger-driven so it fires however the row arrives — incl. a vote synced from offline.)*
- **"Reducer" =** pure fn: current votes + workflow JSONB → next state + events to append. **Template-driven** (new process = new template, not new code). **Determinism bonus:** projections rebuildable by replaying the log.
- **Offline behavior:** casting a vote works offline (local row write that syncs later); a group verdict + phase outcome need other members' votes from other devices, so they're computed server-side only after votes sync and converge. A lone device records its vote but can't finalize a group or phase.

---

## Columns added to existing tables

- `project.workflow_template_id`, `project.workflow_frozen`
- `quest.submission_state`
- `asset.content_type` — new values `journal` | `journal_entry` | `comment`

---

## Rework routing

1. Rejection/withdrawal → submission status `rework`; coordinator notified.
2. Coordinator reviews comments + flags.
3. Coordinator creates rework `assignment` (→ quest/assets, → translator).
4. Translator reworks, marks assignment completed.
5. Coordinator resubmits → **always re-enters at phase 1** (every reviewer re-validates — not configurable).

---

## Notifications

Extends `notification.target_table_name` with `review_submission`, `review_decision`, `assignment` (in-app only for now). Recipients: submitted→first-phase groups · advanced→next-phase groups · rejected→coordinator · rework assigned→translator · rework completed→coordinator · approved final→submitter+coordinator+subscribers · withdrawal→coordinator+affected downstream reviewers.

---

## App vs website split


| Surface                                          | App | Website |
| ------------------------------------------------ | --- | ------- |
| View assignments / submission state / comments   | ✓   | ✓       |
| Record translations / mark steps complete        | ✓   | —       |
| Create contributions                             | ✓   | —       |
| Submit for review / cast decisions / flag assets | ✓   | —       |
| Mark rework completed                            | ✓   | —       |
| Create/edit workflow templates                   | —   | ✓       |
| Map phases & groups, manage membership           | —   | ✓       |
| Create assignments / delegate rework             | —   | ✓       |
| Full audit timeline, oversight, analytics        | —   | ✓       |


---

## Sync (PowerSync)

- **Synced:** `workflow_template` (active only), `project_phase_group`, `project_group`, `project_group_member`, `assignment`, `assignment_item_completion`, `asset_link`, `review_submission`, `review_decision`. (Comments/flags sync as ordinary `asset`+`asset_link`; `asset_link.project_id` buckets.)
- **Server-only (not synced):** `review_event`, `workflow_template_revision`.
- **Conflict avoidance:** all state changes computed server-side — clients write `review_decision`/`asset_link` rows (synced via `ps_crud`), a **DB trigger** appends events + recomputes projections; clients never write projections; decisions/comments append-only.

---

## Migration & rollout

1. Additive only (just `quest.submission_state` default `draft` + new `asset.content_type` values).
2. Opt-in (null `workflow_template_id` = keep vote-based approval).
3. System templates ship together: CBBT process template (ETEN phases) + FIA study-material template (6 steps).
4. No auto-adoption (existing FIA projects opt in).
5. Website config first, app review surfaces second.

---

## Decisions / assumptions / open items

**Decided:** completion = Option B (assignment-anchored) · multi-assignee merge via `completion_rule` · reviewability is a content-template field (only reviewable nodes enter workflow) · contributions = bare assets + `asset_link` anchors (no study-quest container for MVP) · visibility project-wide.

**Assumptions (A1–A11):**

- **A1** — work tracked only when an assignment exists
- **A2** — content template ships first
- **A3** — study material lives in DB with stable node ids
- **A4** — reviewability declared on content template
- **A5** — quest remixing will exist
- **A6** — one workflow per project
- **A7** — template editing website-only
- **A8** — review opt-in/additive
- **A9** — phase outcomes computed server-side after decisions sync (casting works offline; finalizing needs other groups' decisions)
- **A10** — app-level integrity OK for links
- **A11** — nothing within a project hidden from members

**TBD / open:**

- **Assignment range targeting** — column shape (single `target_id`+span-end? child range table?) tied to content node-id scheme.
- `**link_role` governance** (open Q) — rule for admitting new roles (must change engine/UI behavior else reuse); per-role cardinality/target constraints; whether any role needs fields beyond `anchor_data`.
- `**lists` block** — provisional shape; which template owns it (content vs workflow) unsettled; hook currently `set_project_workflow`.
- **Reviewable-node field** — lives on content template (shape is content-side detail).
- **Node-id ref formats** — mirror whatever content/study-material docs land on.
- **Deferred:** coordinator-as-proxy (`on_behalf_of`?); re-anchoring across study-material versions.

**Structure-editing boogeyman (CRDT avoidance):** everything field users create offline is *rows* (PowerSync-handled). If offline *structure* additions are ever needed, the CRDT-free answer is an additive `extension_node` table (own row per added node, merged at read layer; additions commutative). Concurrent offline mutation of shared nodes stays forbidden by design.

---

## Terminology (quick)


| Term                         | Meaning                                                                                                          |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Workflow template            | JSONB defining ordered review phases                                                                             |
| Study material template      | Separate template for prep steps (FIA 1–6); future name `library_template`                                       |
| Phase                        | Ordered review stage with ≥1 group slots                                                                         |
| Group slot                   | Abstract reviewer role in template, mapped to a real project group                                               |
| Project group                | First-class team (translator/reviewer/coordinator)                                                               |
| Assignment                   | Unit of work for a profile/group at any stage                                                                    |
| Signoff rule                 | How approval resolves (`any_one`/`unanimous`/`quorum`) at two levels: within a group over members (`group_slot.signoff_rule`) and across a phase's groups (`phase.signoff_rule`) |
| Submission                   | One review pass of a quest version                                                                               |
| Decision (vote)              | One member's vote at one phase, within their group; group verdicts & phase outcomes are computed from these by the reducer |
| `asset_link`                 | Polymorphic link: asset → (target_type, target_id) + `link_role` + denormalized project_id                       |
| Link role                    | What a link means: `anchor`/`comment_on`/`reply_to`/`revision_of`/`flag`/`references`/`applies_to`/`member_of`   |
| `asset_content_link` (acl)   | The asset's payload (text/audio per languoid) — what it *contains* (vs `asset_link` = what it *points at*)       |
| Contribution / journal entry | Project-scoped `journal_entry` asset (anchored, filed, or both)                                                  |
| Key term                     | `journal_entry` in the Key Terms list; rendering = its own content                                               |
| List                         | `journal` asset; membership = `member_of` links; one entry → many lists                                          |
| Journal                      | Union of non-quest-bound contributions + their lists                                                             |
| Library                      | Reserved for the study content itself (read vs journal = written)                                                |
| Anchor                       | `asset_link` role `anchor` pinning to a study-material spot (+ optional `anchor_data`)                           |
| Quote selector               | Exact highlighted text (+prefix/suffix) in `anchor_data` — display, re-anchoring, drift detection                |
| Revision pinning             | Snapshotting referenced entry revision ids into the submit event                                                 |
| Completable node             | A node with an assignment targeting it (no separate flag)                                                        |
| Reviewable node              | Content-template node marked to participate in review (content-side field)                                       |
| Comment                      | Asset (`content_type='comment'`) via `comment_on`/`reply_to` — not a table                                       |
| Flag                         | `flag`-role `asset_link`; blocks advancement while `active`                                                      |
| Review event                 | Row in append-only `review_event` log — source of truth                                                          |
| Projection                   | Server-computed state column from the log (`submission_state`/`status`/`current_phase_id`); never client-written |
| Reducer trigger              | DB trigger on `review_decision`/`asset_link`; fires when a synced row lands; validates, guards against workflow JSONB, appends event(s), recomputes projections in one txn |
| Reducer                      | Template-driven pure fn (run in the trigger): current decisions + workflow JSONB → next state + events           |
| Study quest                  | Project-scoped quest container for study content (considered, not adopted)                                       |


