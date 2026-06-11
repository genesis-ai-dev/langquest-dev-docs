# Process Template System

Everything about how LangQuest runs a multi-stage review process — what it is, how it works, and why it works that way. This is the review/workflow counterpart to the content [Template System](./template-system.md), and it reuses the same JSONB template ideas.

---

## What it is

A process template (a "workflow template") defines the shape of a review process: the **ordered phases a finished quest version passes through** before it's approved. ETEN's Team → Community → Church → Blessing Board flow is one instance. Other partners define their own.

It does **not** define the preparation work. Three templates are in play, and they're separate:

- **Content/project template** — the passage structure; translation assets tie to its nodes.
- **Study material template** — the FIA understanding steps (1–6); contribution and prep assets tie to its nodes.
- **Process/workflow template** — the review phases finished work passes through (this doc).

The finished work that enters review is a quest version whose assets are tied (indirectly) to content-template nodes and to study-material steps. The process template only governs what happens to that work once it's submitted.

Like content templates, a workflow template is stored as a single JSONB blob in a `workflow_template` table row. Projects link to one workflow via a join table (`project_workflow_link`). Review records (decisions) reference individual phases and group slots inside the template by opaque ID.

The mobile app does the work (record, mark steps done, submit, review, flag). The website configures everything (build templates, map groups, create assignments, view the audit trail).

The content/project template system is being integrated **first**. The process layer relies heavily on whatever content structuring system is used — assignments and reviewable work reference content-template nodes — so building content templates first avoids significant rework here.

---

## Why this design exists

### The problem

LangQuest has no formal review today. Translators record, the community votes, net upvotes = approved. There are no reviewer roles, no staged validation, and no audit trail. ETEN needs a church-governed, multi-stage process — but their process is just one configuration. The system has to be generic and configurable for other partners too.

### Constraints and decisions that shaped the solution

| # | Constraint / decision | Why it matters |
|---|-----------------------|----------------|
| C1 | Shared JSONB template architecture | Same single-row, fork-always model as content templates. Content templates are integrated first, since the process layer references their nodes heavily. |
| C2 | Fork-always, immutable published templates | No locks, no concurrent-edit conflicts. Edits create a new row; `copied_from_template_id` tracks lineage. |
| C3 | Website-only editing | Templates and configuration are edited in the browser (IndexedDB drafts). The app is read-only on templates. |
| C4 | String refs into JSONB, not FKs | `phase_id` / `group_slot_id` are strings pointing into the workflow JSONB, validated at the application level. Tombstones (`deleted: true`) keep removed phases referentially safe. (Study-material `step_id`s work the same way, but against the study-material template.) |
| C5 | Groups are first-class | `project_group` is separate from `profile_project_link` (which stays for owner/member access). Groups are the unit of both assignment and review. |
| C6 | Assignments drive every stage | One `assignment` mechanism covers translation, rework, review, and approval — the same thing that tells a translator to translate tells a reviewer to review. (Q5) |
| C7 | Progress follows the work, via assignments | Objective passage progress is **inferred from individual assignment progress**, because objective measures struggle across versions and review stages. (Q5 clarification) |
| C8 | All language contributions are assets | Journal entries (discussions, key terms, drawings), journal lists, and review comments are assets (`journal_entry`/`journal`/`comment`). Dedicated content tables (e.g. a `review_comment` table) are avoided; categorization comes from list membership, not type subtypes. |
| C9 | Contributions are cross-version | They bind to study-material steps and the project, not to a specific quest version, so every version can use them. (Q7) |
| C10 | `review_event` is the source of truth (event sourcing) | Append-only log, server-only, never synced. State columns (`submission_state`, `status`, `current_phase_id`) are projections recomputed from it by transition RPCs. Doubles as the full audit history. (Q1) |
| C11 | Additive, opt-in rollout | Existing tables unchanged except `quest.submission_state` and new `asset.content_type` values. Projects without a workflow keep vote-based approval. |
| C12 | Depends on quest remixing | Partial-work and partial-rework scenarios are resolved by the remix feature (compose a new version from good + fixed parts). (Q8) |
| C13 | One polymorphic `asset_link` table | Assets point at quests, template nodes, study-material nodes, decisions, and other assets through a single (target_type, target_id, link_role) table with denormalized `project_id` — not a link table per relationship. |
| C14 | Review transitions are server-only RPCs | Clients append facts (decisions, comment-assets, flags); a template-driven reducer evaluates guards and recomputes projections in one transaction. No client ever writes review state. |

---

## How it works now

The system has five layers. The first two are configured on the website; the last three are where the work and review happen.

### 1. Workflow template layer

- **`workflow_template`** — One JSONB row. Fields: id, name, description, slug, creator_id (null = system), `structure` (JSONB), copied_from_template_id (provenance), shared, active, project_count, created_at, last_updated.
- **`workflow_template_revision`** — Audit only, not synced. Fields: template ref, structure snapshot, actions (structured diff), saved_by, saved_at.

**`structure` JSONB shape:**

```typescript
type WorkflowStructure = {
  format_version: number;
  phases: WorkflowPhase[];  // ordered review stages — the only thing a process template defines
};

type WorkflowPhase = {
  id: string;               // nanoid(10), stable, immutable
  name: string;
  order_index: number;
  signoff_rule: 'any_one' | 'unanimous' | 'quorum';
  quorum_threshold?: number;  // fraction of mapped groups, auto-adjusting denominator (e.g. 2/3)
  group_slots: WorkflowGroupSlot[];
  deleted?: boolean;
};

type WorkflowGroupSlot = {
  id: string;               // nanoid(10), stable, immutable
  name: string;
  description?: string;
  deleted?: boolean;
};
```

Preparation steps and passage structure are **not** in here — they live in the study material template and the content/project template respectively. The process template references neither directly; the three are tied together at the work/assignment layer.

**RPCs:** `publish_workflow_template`, `fork_workflow_template`, `save_workflow_template_metadata` — mirror the content template system.

### 2. Project configuration layer

- **`project_workflow_link`** — One per project (unique on project_id). Fields: id, project_id, workflow_template_id, frozen, active, created_at. `frozen = true` blocks re-pointing mid-review; `active` is kept as generic metadata.
- **`project_phase_group`** — Maps abstract group slots to real groups. Fields: workflow_link ref, phase_id, group_slot_id, group ref (→ `project_group`).
- **`project_group`** — Fields: project ref, name, role_type (`translator`|`reviewer`|`coordinator`), description, active.
- **`project_group_member`** — Fields: group ref, profile ref, active.

A coordinator picks a template, then maps each `group_slot` to a real `project_group`. Template changes never propagate automatically — the coordinator explicitly adopts a new fork, and a compatibility check ensures every `phase_id`/`group_slot_id` referenced by existing review data still exists in the target template.

### 3. Work layer

**Assignments** drive every stage of the process, not just translation.

- **`assignment`** — Fields: project ref, target_type (`quest`|`asset`|*template node — see below*), target_id, assignee_type (`profile`|`group`), assignee_id, assignment_type (`translation`|`rework`|`review`|`approve`), status (`pending`|`in_progress`|`completed`|`cancelled`), completion_rule (`any`|`all`, default `any` — see below), assigner (profile ref), notes.

Notes on assignment targeting (Q3):
- At initial assignment time, the asset doesn't exist yet — so an early assignment can't point at an asset. Linking an assignment to an asset makes sense mainly for **rework**.
- Once the content/project template system exists, an assignment can reference a **template node id** instead, and should be able to indicate a **range** of nodes.

**Steps & progress.**

Preparation steps (e.g. FIA 1–6) are **defined in the study material template, not the process template** — the process template only governs review phases. Their completion is tracked the same way as any other work: through assignments.

- Progress is tracked as **discrete completion of named units, not a percentage**. A coordinator wants to see "step 1 of 6 done" (checkmarks), not "17% done". Any percentage, if ever needed, is derived at display time.
- **Completion is assignment-anchored (decided — Option B below).** What's completable is implied by an assignment targeting it (a study-material, content-template, or review node) — there's no separate `completable` flag, and **no separate `step_progress` table**. Completion is recorded once, per assignment, in **`assignment_item_completion`** — Fields: assignment ref, node_id, completed_at (a single-node assignment is simply complete when the assignment is). Study-step completion is just the case where the targeted node is a study-material step. Objective passage progress is rolled up from these per-assignment records. (This assumes work is only tracked when an assignment exists — see *Assumptions*.)
- **Multi-assignee merge (decided):** when several assignments target the same unit, the assignment's `completion_rule` says how the objective view merges them — `any` (default: the unit is done when any assignee completes it; fits shared translation work) or `all` (every assignee must complete it themselves; fits study steps each person must digest). The objective view is **computed at query time** (a view over `assignment_item_completion`) — no rollup table.
- Study-material steps contain non-programmatic prompts (discussions, key-term decisions). There's no machine-countable number of expected contributions per step, so **contributions never count toward completion** — they're surfaced and notified ("3 items contributed to step Y of pericope Z") but don't change a unit's done/not-done state. (Q6)

**Contributions & anchoring — the `asset_link` table.**

A driving goal of this schema is that **essentially all language contributions are assets**, and assets must be linkable to many kinds of things. Today an asset links to a quest (`quest_asset_link`) or a content-template node (`asset.template_node_id`); review needs assets that point at study-material spots, review decisions, other assets (threads), and more. Rather than a bespoke link table per relationship (the earlier `asset_anchor` proposal), there is **one polymorphic linking table**:

- **`asset_link`** — Fields: id, asset ref, **target_type** (`quest`|`asset`|`template_node`|`study_material_node`|`review_decision`|`review_submission`), **target_id** (UUID or opaque node id string, per target_type), **link_role** (`anchor`|`comment_on`|`reply_to`|`revision_of`|`flag`|`references`|`applies_to`|`member_of`|…), **project ref** (denormalized — see below), **anchor_data** (JSON, nullable — text offsets / audio timestamps, see *Anchoring* below), order_index, active, created_at.

Why polymorphic rather than FK-per-type:

- Half the targets are **opaque JSONB node ids** (content-template nodes, study-material steps) that can never have a FK anyway — the system already accepts string refs validated at the application level (C4). A polymorphic table makes real-row targets work the same way.
- New target types (a new kind of reviewable thing, a new anchor surface) are a new enum value, not a migration.
- `link_role` is the real generalization: the same table expresses "this asset is **anchored to** FIA step 3's audio at 0:42", "this asset is a **comment on** decision X", "this asset is a **reply to** that comment", "this asset is a **revision of** an earlier contribution".

Costs, and how they're handled:

- **No DB-level referential integrity** for real-row targets → integrity enforced in the write RPCs, plus periodic server-side orphan checks (same posture as `template_node_id` today).
- **No FK path for RLS/sync bucketing** → `project_id` is **denormalized onto every `asset_link` row** (with `download_profiles` if needed), matching the existing closure/bucketing patterns. This also directly satisfies the rule that contributions must link to the project explicitly — they can't be project-linked through a quest (a contribution may predate any quest) or through a shared template node id (templates and study material are shared across projects).
- **`asset_content_link` is unchanged** — it remains the asset's *payload* (text/audio per languoid). `asset_link` is about what an asset *points at*; the two concerns stay separate.

Contributions then work like this:

- Extended **`asset.content_type`** (simplified — decided): `journal` (a journal list) | `journal_entry` (any contribution — discussion, key term, drawing, rationale) | `comment` (review discussion), plus existing `source`|`translation`|`transcription`. **Kind subtypes (`discussion`/`rationale`/`key_term`/`media`) were dropped:** categorization comes from journal-list membership, not a type enum — the lists *are* the categories. `content_type` says what an asset *is*, is set once, and never changes; `asset_link.link_role` says how it *connects*, and links come and go freely. (E.g. an anchored-but-unfiled contribution = `journal_entry` + one `anchor` link; filed later = same asset gains a `member_of` link.)
- **Study material now lives in the LangQuest DB** as its own structured content (no longer pulled from an external API). It has stable node ids, so `asset_link` rows can target it reliably.
- A contribution = an asset + an `asset_link` (role `anchor`) to a study-material node, with optional `anchor_data` pinning a text range or audio timestamp. The link row's `project_id` scopes it.

**Anchoring (decided — fine-grained in MVP, version-pinned).** Users can link responses to specific passages and/or audio timestamps. Durability comes from two reinforcing choices:

1. **Version pinning.** Published study material is immutable (same fork-always template model), and the anchor records which study-material version it was made against. Char offsets against an immutable document are permanent — fragility only exists against mutable content.
2. **Quote selectors** (the W3C Web Annotation pattern). For text anchors, `anchor_data` stores the offsets *and* the exact highlighted text (with optional prefix/suffix context). The stored quote is not redundancy; it has three jobs: render the contribution without fetching the source ("you commented on: *'…'*"), serve as the re-anchoring key when a project adopts a new study-material fork, and act as a drift detector (quote/offset mismatch = bug).

```typescript
type AnchorData = {
  // text anchoring (against the pinned study-material version)
  text?: { start: number; end: number; exact: string; prefix?: string; suffix?: string };
  // audio anchoring (audio files are immutable attachments — timestamps never rot)
  audio?: { start_ms: number; end_ms?: number; audio_ref: string };
};
// either or both may be present; null anchor_data = node-level anchor
```

> **Deferred — re-anchoring across study-material versions.** When a project adopts a new study-material fork, a server job should try to migrate anchors: exact-quote match (disambiguated by prefix/suffix) in the new version's node text → rewrite offsets + version ref; no match → mark the anchor stale but keep it displayable via the stored quote (graceful degradation, never data loss). This job isn't needed until the first study-material version adoption, so it's noted here and not designed further yet.
- Contributions are **cross-version**: they bind to study material + project, not to a translation quest version, so every version of a pericope sees them. Revision threads are chains of `revision_of` links; an `active` flag marks the current head. (Q7 clarification)
- **Visibility is project-wide (decided).** Anyone in the project (`profile_project_link`) sees all contributions — no per-asset ACL. Key-term decisions only work project-wide (their purpose is consistency across pericopes), pericope-level gating would gate nothing (anyone in a project can work any pericope), and visibility == the `project_id` sync bucket, so no extra RLS or sync rules. Contextual narrowing comes from **anchors**, not permissions — you see step-3 contributions when you're in step 3. If group-private content is ever needed, the additive path is a `visibility` enum (`project`|`group`) on the `asset_link` row.

> **Decided: contributions are bare assets + `asset_link` anchors — no study-quest container for MVP.** Option D (below) is kept for reference: because it's a strict superset, it can be layered on later by creating study quests and attaching the existing contribution assets to them — no re-plumbing of anchors. Revisit if the download-unit / sync-closure story turns out to need a quest container for study content.

**Key terms — a first-class, separate feature.**

Key terms are **not anchored contributions**. They're a team-generated glossary: project-scoped decision artifacts ("how we render *covenant*") that exist independently of any FIA step — the study material may never mention the term. Other things point *to* a key term; a key term doesn't have to point at anything.

- A **key-term entry** = a `journal_entry` asset that's a **member of the project's Key Terms list** — key-term-ness comes from list membership, not a content type. No anchor required. Created on the fly, offline, by translators in the field — entries are ordinary rows, not template structure.
- **The agreed rendering is the entry's own content (decided)** — `asset_content_link` rows in the target languoid (text and/or recorded audio, oral-first friendly). Not a linked asset. The entry's `revision_of` chain tracks how the team's decision evolved.
- **Optional outbound links:** `applies_to` → content-template nodes/ranges ("this term matters in Gen 1–3"), so opening a passage surfaces its relevant terms.
- **Inbound links:** discussions, rationales, and translation assets `references` a key-term entry — "we rendered it this way because of glossary entry X."
- **The glossary view** = the Key Terms list itself (template-declared, so it has a stable identity). Note: the glossary is filing-dependent — an entry someone never files isn't in it. Accepted trade for the simpler model.
- **Key terms enter review (decided).** They're bundled with translation assets for review via **submit-time revision pinning**: when `submit_quest` runs, the engine snapshots (into the event payload) the revision ids of every Key Terms-list member `applies_to`-linked to the submitted quest's nodes or `references`-linked from its assets. Reviewers see the translation plus the exact glossary state it was built against, can comment on or flag entries like any asset, and an approved translation can't silently drift against a later-revised glossary. If a partner ever wants the glossary itself formally approved as a stage, the upgrade path is the documented wrap-in-a-template-free-quest move.

**Lists & the project journal.**

Teams need lists: the owner predefines some (Key Terms, Discussions), translators create more in the field ("Cultural notes"), and entries must be reachable **project-wide** — a key-term decision matters in every pericope where the term recurs. The reasoning that shaped the design:

- **"Predefined + user-extendable" is not a template-editing problem.** It's the cookie-cutter pattern this architecture already uses for quests: *templates declare; instantiation materializes rows; rows live their own life.* A template can declare list definitions, and applying it to a project instantiates them as rows — the same way template nodes generate quest rows, and the same way workflow `group_slots` get mapped to real `project_group` rows. Users adding a list = adding another row of the same shape, fully offline. Nobody ever edits a template in the field, so the offline-template-editing problem never arises (see *Containing the structure-editing boogeyman* below).
- **The lists are the categories.** There is no kind enum on entries (no `key_term`/`discussion` content subtypes — an earlier "auto-membership by content type" idea was considered and dropped as redundant). An entry is a key term *because it's in the Key Terms list*. Filing is always optional — an unfiled entry still exists in the journal, reachable via its anchors.

**The design — one list primitive, membership by links:**

- A **list** = an asset (`content_type = 'journal'`). Because it's an asset, its **name is acl content** — text and/or audio per languoid, so an oral-first community can name their list in their own language — and it gets revision chains and comments for free.
- **An entry** = an asset (`content_type = 'journal_entry'`), regardless of how it's connected. Membership = `asset_link` role **`member_of`** (with `order_index` for playlist-style ordering; concurrent offline reorders are last-write-wins per link row — worst case a shuffled order, never lost data). One entry can be in many lists. Anchoring (`anchor` links to library content) is fully orthogonal: anchored-and-filed, anchored-only, filed-only are all just different link combinations on the same stable asset.
- **The filing UX:** when contributing in context (highlighting library text, pausing audio), the composer offers "add to journal list…" — optional. Entries can also be created directly from a list, or filed into lists later from anywhere they're displayed; all of it is just link rows.
- **Template-declared lists:** a template's structure JSONB can carry `lists: [{id, name, kind}]`; the project-link RPC instantiates them as `journal` asset rows (with a `template_list_id` backref — this is how the engine finds e.g. the Key Terms list for revision pinning). **User-created lists** are the same rows minus the backref. Owners can also create lists directly, no template involved.
- **Project-wide reach falls out of sync:** lists and entries are project-bucket rows, so the full journal is on every device. Contextual surfacing ("this term appears here") comes from `applies_to` links — with a named future enhancement: **server-suggested links** that match term text against passage source text and create inactive `applies_to` links for the team to confirm.

**The journal.** The union of all non-quest-bound contributions — entries and the lists organizing them — is the project's **journal**: quests are the work; the journal is the accumulated team knowledge that travels across all of it. Lists are views into the journal. *(Naming note: "library" was considered and deliberately reserved — it better fits the study content itself, e.g. a future rename of the study material template to `library_template`. The FIA content is the library you read; the journal is what the team writes.)*

New schema surface for all of this: two content_types (`journal`, `journal_entry`), one link role (`member_of`), one JSONB field in templates (`lists`). No new tables, no CRDT.

### 4. Review layer

A submitted quest version moves through the project's configured phases.

- **`quest.submission_state`** — enum: `draft`|`submitted`|`in_review`|`rework`|`withdrawn`|`approved_final` (default `draft`). Only one quest per pericope per project can be in a non-draft/non-withdrawn state at a time (partial unique constraint). Combining partial work and partial rework into a single submittable version relies on **quest remixing**. (Q8)
- **`review_submission`** — One per quest-version review pass. Fields: quest ref, workflow_link ref, current_phase_id, status (`pending`|`in_review`|`rework`|`completed`|`withdrawn`), submitted_by, submitted_at. Reused across rework cycles.
- **`review_decision`** — One group's verdict at one phase. Fields: submission ref, phase_id, group_slot_id, group ref, decision (`approved`|`rejected`|`withdrawn`), decided_by, decided_at, active flag. A free-text *reason* is not a column — it's a comment-asset linked to the decision (below).

**Comments and flags are assets, not dedicated tables.** Consistent with the everything-is-an-asset principle, the former `review_comment` and `review_asset_flag` tables collapse into `asset` + `asset_link`:

- A **comment** = an asset (`content_type = 'comment'`, body/audio in `asset_content_link`) with an `asset_link` of role `comment_on` targeting a submission, decision, or asset. Threads chain via `reply_to` links between comment-assets.
- A **rework flag** = an `asset_link` of role `flag` from a (comment-)asset explaining the problem to the flagged asset, scoped to the submission. Resolution flips the link's `active` flag (recorded by the engine as an event, so resolved_by/resolved_at live in the log).
- The verdict itself (`review_decision`) **stays a structured row** — signoff aggregation needs typed, queryable decisions, not prose.
- **Comment visibility is project-wide (decided)** — same rule as contributions. The rework loop requires comments to cross roles (reviewer → coordinator → translator), and transparency matches the system's audit posture. Group-private deliberation, if ever needed, is the same additive `visibility`-on-`asset_link` path.

**Why submission and decision are separate entities (Q9):** a phase can have several groups, and the owner chooses whether approval needs **one**, **all**, or a **quorum** of them (`signoff_rule`). One submission therefore collects many decisions, so they can't collapse into a single record.

**State columns are projections, not sources of truth.** `quest.submission_state`, `review_submission.status`, and `current_phase_id` overlap deliberately — all three are **server-computed projections of the `review_event` log** (see layer 5). `submission_state` exists on `quest` because the one-active-version-per-pericope constraint must be enforceable there; `review_submission.status` describes the current pass. Neither is ever written by clients, so they can't drift: the engine recomputes both in the same transaction that appends the event.

**Phase advancement:** submission enters a phase → all mapped groups receive it → each group resolves per its signoff rule → all groups approve advances to the next phase; any group rejects sends it to rework → final phase approved sets `approved_final`. A quest cannot advance while any flag link is `active`.

**Withdraw cascade:** withdrawing at phase N invalidates all decisions at phases > N and returns the submission to phase N (a late concern from an early reviewer should invalidate downstream approvals).

### 5. Review engine — statechart + event-sourced projections

The review flow is formally a **hierarchical statechart**, not a flat state machine: `in_review` is a superstate containing the ordered phase substates; each phase contains **parallel regions** (one per mapped group) that independently resolve; phase→phase transitions are **guarded** by the signoff predicate (`any_one` / `unanimous` / `quorum` fraction over active `review_decision` rows); withdraw-cascade is a transition with side effects on downstream substates.

The backend mechanism is **event sourcing with server-owned projections** — no external workflow engine:

- **`review_event` is the log.** Append-only, never updated or deleted. Fields: event_type, actor, target_type, target_id, payload (JSON), project ref, created_at. Server-only (not synced); the website queries Postgres directly for the timeline. Event types: `submitted`, `approved`, `rejected`, `withdrawn`, `cascade_invalidated`, `comment_added`, `asset_flagged`, `flag_resolved`, `rework_assigned`, `rework_completed`, `phase_advanced`, `workflow_completed`, `submission_withdrawn`.
- **Clients append facts; the server reduces.** Devices only ever insert intent rows (a decision, a comment-asset, a flag link) through transition RPCs. They never write `submission_state`, `status`, or `current_phase_id`.
- **One RPC per transition** — `submit_quest`, `cast_decision`, `withdraw_decision`, `resolve_flag`, `assign_rework`, `complete_rework`, `resubmit_quest`. Each RPC, in a single transaction: (1) validates the actor and the current state, (2) evaluates the guard against the workflow JSONB (e.g. does this decision satisfy the phase's signoff rule? are any flag links still active?), (3) appends the `review_event`, (4) recomputes the projections (`review_submission.status`, `current_phase_id`, `quest.submission_state`). This mirrors the existing server-side mutation pipeline (`apply_table_mutation` + transforms), so it's an established pattern in this codebase, not new machinery.
- **The reducer is template-driven, not hardcoded.** Phases, group slots, and signoff rules are already declared in `workflow_template.structure`; the engine is a generic interpreter of that JSONB. A new review process is a new template, never new transition code.
- **Determinism bonus:** because state is a pure function of the log + template, projections can be rebuilt (bug fixes, audits) by replaying `review_event`.

**Offline caveat:** transition RPCs require connectivity. Offline devices can stage intents locally (votes, comments, flags), but state only advances when the server processes them — consistent with the existing conflict-avoidance posture.

---

## Design options: completion tracking & contributions

Two related things are still open and are best decided together: (1) how we record that a unit of work is **complete**, and (2) where project-specific **contributions** live. Both revolve around the same new piece — study material that now lives in the DB with its own node structure.

**Framing — discrete completion, not percentages.** Store completion as discrete states on named units ("step 3 of 6 done", per-verse/asset checkmarks) and derive any percentage only for display. Per-unit states stay actionable for coordinators and degrade gracefully when the set of units differs across versions and stages.

**What counts as completable is implied by assignments (chosen direction).** Rather than pre-marking nodes with a `completable` flag, the fact that an assignment *targets* a node — in a study-material, process, or content template — is what makes that node completable. Completion is recorded against the assignment. (Options A and C below instead use an explicit per-node flag; they're kept for context, but B was chosen. The assignment-implied approach still has details to work out down the road.)

The scenario to support: a pericope is assigned; it involves the 6 study steps (in the study material) **and** a range or specific quest in the project template. We need to know what's done for each.

### Option A — Unified node-completion records

One generic table records completion against any template node.

- `node_completion` — (template_link ref, node_id, scope ref, profile/group, completed_at).
- Progress for a scope = completed `completable` nodes / total, shown as checkmarks.

**Pros:** one mechanism across all three template types; checkmark-native; consistent with the opaque-node-id + string-ref design; no per-type schema.
**Cons:** must define "scope" precisely (per-quest? per-pericope? per-assignment?); a unit shared by several people needs de-duping; rows span three template types and rely on `template_link_id` to disambiguate.

### Option B — Assignment-anchored completion

Completion hangs off the assignment, matching the Q5 clarification ("objective progress inferred from individual assignment progress"). Completability is implied by the assignment targeting a node — no separate flag.

- A single-node assignment is complete when the assignment is complete; a range/multi-node assignment tracks per-node completion via `assignment_item_completion` — (assignment ref, node_id, completed_at).

**Pros:** clean ownership; natural per-stage/per-version separation; directly implements "infer passage progress from assignment progress".
**Cons:** a unit shared by multiple assignees appears in multiple assignments and must be merged for an objective per-pericope view; work done with no assignment is invisible.

### Option C — Hybrid (recommended starting point)

Completion records key on the **work target + completable node**, tagged with the assignment/profile that did it.

- The objective per-pericope view reads the target; the per-person/per-stage view reads the tag.

**Pros:** supports both the objective passage view and per-assignment attribution; handles multiple assignees without duplication.
**Cons:** more rules to define (which stages are "objective" vs "per-assignment"); slightly more moving parts than A or B.

### Option D — A parallel "study quest" system (not adopted — kept for reference)

Introduce a new kind of quest linked to a **study-material section** (e.g. an FIA step within a pericope) instead of a project-template node. It's project-scoped, and its assets hold the contributions. Translation quests (→ project-template nodes) and study quests (→ study-material nodes) become two parallel systems sharing the same quest/asset infrastructure.

**Pros:**
- Reuses all existing quest/asset machinery — assets, revision chains, sync, remix-pull — with almost no new contribution-specific schema.
- **Project-scoped by construction**, which directly satisfies "contributions must link to the project" with no special anchor-to-project plumbing.
- **Cross-version by construction**: study quests are separate from translation quest versions, so every version of a pericope sees the same study content.
- Study-step completion can be the study quest's own state (a `completed` flag or `submission_state`), so the study side may need no separate completion table at all.

**Cons:**
- Two parallel quest systems add conceptual overhead; needs a discriminator (e.g. `quest.kind = translation | study`) and careful UI so the two don't get confused.
- Study material is shared across projects but study quests are per-project, so it needs a per-project link (a `study_material_link`, analogous to `project_template_link`); a study quest points at `(study_material_link_id, study_node_id)`.
- Versioning / remix / "best" semantics differ — study quests likely evolve as a single revision thread rather than competing versions; that needs defining.
- `asset_link` anchoring (text-range/timestamp within a section) is still needed for sub-section anchoring; it just hangs off the study quest's assets.
- Doesn't address translation-side completion (verse/range done) on its own, so it pairs with A, B, or C for that.

### Decisions so far

- **Completion: Option B (decided).** Completion is assignment-anchored, and **completability is implied by the assignment itself** — if an assignment targets a node (study-material, process, or content template), that node is completable; there's no separate `completable` flag on template nodes. Completion is recorded per assignment (`assignment_item_completion` for range/multi-node assignments; the assignment's own status for single-node ones). Objective passage progress rolls up from these records.
- **Multi-assignee merge: `completion_rule` on the assignment (decided).** `any` (default) or `all`; the objective per-pericope view is computed at query time, no rollup table.
- **Reviewability lives on the content template (direction set).** Rather than a workflow template declaring which content templates it's compatible with, the content template system will carry a field indicating whether a node is **reviewable**. Only reviewable nodes/quests enter the workflow. (Exact field shape is a content-template-side detail.)
- **Contributions: bare assets + `asset_link` anchors (decided).** No study-quest container for MVP. Option D is a strict superset and can be layered on later (create study quests, attach existing contribution assets) if the download-unit / sync-closure story demands a container.
- **Visibility: project-wide (decided).** Contributions and comments are visible to all project members — no per-asset ACL, no team/pericope scoping. Anchors provide contextual narrowing; group-private content has a named additive path (`visibility` enum on `asset_link`) if a real need appears.

---

## Rework routing

Rejection always routes to a coordinator, who delegates:

1. Rejection/withdrawal → submission status becomes `rework`; coordinator is notified.
2. Coordinator reviews comments and asset flags.
3. Coordinator creates a rework `assignment` targeting the quest/assets, assigned to a translator.
4. Translator reworks, marks the assignment completed.
5. Coordinator resubmits → re-enters at **phase 1** (decided: always restart, so every reviewer re-validates — not configurable).

---

## Notifications

Extends the existing `notification` table with new `target_table_name` values: `review_submission`, `review_decision`, `assignment`. In-app only for now (push/email/WhatsApp deferred). Recipients: submitted → first-phase groups; advanced → next-phase groups; rejected → coordinator; rework assigned → translator; rework completed → coordinator; approved final → submitter + coordinator + subscribers; withdrawal → coordinator + affected downstream reviewers.

---

## App vs website split

| Surface | App | Website |
|---|:---:|:---:|
| View assignments / submission state / comments | Both | Both |
| Record translations / mark steps complete | App | — |
| Create contributions | App | — |
| Submit for review / cast decisions / flag assets | App | — |
| Mark rework completed | App | — |
| Create/edit workflow templates | — | Website |
| Map phases & groups, manage membership | — | Website |
| Create assignments / delegate rework | — | Website |
| Full audit timeline, oversight, analytics | — | Website |

---

## Sync (PowerSync)

- **Synced to devices:** `workflow_template` (active only), `project_workflow_link`, `project_phase_group`, `project_group`, `project_group_member`, `assignment`, `assignment_item_completion`, `asset_link`, `review_submission`, `review_decision`. (Comments and flags sync as ordinary `asset` + `asset_link` rows; `asset_link.project_id` drives bucketing.)
- **Server-only (not synced):** `review_event`, `workflow_template_revision`.
- **Conflict avoidance:** all review-state transitions go through server-only RPCs that append to `review_event` and recompute projections (`review_submission.status`, `current_phase_id`, `quest.submission_state`); clients never write these. Decisions and comment-assets are append-only.

---

## Migration & rollout

1. **Additive only** — existing tables unchanged except `quest.submission_state` (default `draft`) and new `asset.content_type` enum values.
2. **Opt-in** — projects without a `project_workflow_link` keep vote-based approval.
3. **System templates** ship together: a CBBT *process* template with the ETEN review phases, and an FIA *study material* template with the 6 understanding steps.
4. **No auto-adoption** — existing FIA projects get a workflow only if the coordinator opts in.
5. **Website config first**, app review surfaces second.

---

## Recent direction changes (from the Q&A review)

These adjust the original RFC based on answers and clarifications:

- **Assignments span the whole lifecycle** — `assignment_type` expands beyond `translation`/`rework` to also cover `review`/`approve`. (Q5)
- **Progress is recorded as discrete completion states, not a percentage** (checkmarks per named unit). Completion is **assignment-anchored (Option B)**: passage progress rolls up from per-assignment records (`assignment_item_completion`). (Q5 clarification)
- **Completability is implied by assignments, not a node flag** — if an assignment targets a node (study-material / process / content template), that node is completable.
- **Reviewability is a content-template field** — content-template nodes indicate whether they're reviewable; workflow templates don't declare compatible content templates. Only reviewable nodes enter the workflow.
- **Study material now lives in the LangQuest DB** as structured content (no longer an external API). This resolves the earlier "where does FIA content live" question and gives anchors stable node ids.
- **Contributions carry an explicit `project_id`** — they can't be project-linked through a quest (may predate quests) or by a shared template node id. Anchors pin to study-material text ranges / audio timestamps. (Q7 clarification)
- **Assignments will reference template node ids and ranges** once project templates exist; asset links are mainly for rework. (Q3)
- **`submission_state` depends on the quest remixing feature** for partial-work / partial-rework merging. (Q8)
- **`review_decision` stays separate from `review_submission`** because a phase aggregates multiple group decisions under a configurable signoff rule. (Q9)
- **One polymorphic `asset_link` table replaces `asset_anchor`** — (target_type, target_id, link_role, anchor_data, denormalized project_id). Half the link targets are opaque JSONB node ids that can't be FK'd anyway; `link_role` lets the same table express anchoring, comments, replies, revisions, and flags.
- **`review_comment` and `review_asset_flag` are gone as tables** — comments are assets (`content_type = 'comment'`) linked via `comment_on`/`reply_to`; flags are `flag`-role links. Decision *reason* becomes a linked comment-asset. Only the structured verdict (`review_decision`) remains a dedicated row.
- **The review flow is an event-sourced statechart** — `review_event` is the source of truth; `quest.submission_state` / `review_submission.status` / `current_phase_id` are server-computed projections (resolving the apparent redundancy between them); transitions are guarded server RPCs interpreting the workflow JSONB.
- **Visibility is project-wide** — contributions and comments are visible to every project member; no per-asset ACL. Resolves the former contribution-scope and asset-ACL open questions together.
- **Multi-assignee completion merges via `completion_rule`** (`any`|`all`) on the assignment; the objective view is computed at query time.
- **Contributions are bare assets + anchors** — no study-quest container for MVP; Option D can be layered on later if needed.
- **Anchoring is fine-grained and version-pinned (MVP)** — text offsets + exact-quote selectors (W3C Web Annotation pattern) and audio timestamps in `anchor_data`, pinned to an immutable study-material version. Re-anchoring across versions is noted but deferred.
- **Key terms are a first-class glossary feature** — `journal_entry` assets in the template-declared Key Terms list, created on the fly (offline-safe rows, not template structure); the agreed rendering is the entry's own content; entries link out via `applies_to` and are cited via `references`; they enter review via submit-time revision pinning.
- **Content types simplified; lists are the categories** — `content_type` is just `journal` | `journal_entry` | `comment` (+ existing `source`/`translation`/`transcription`); kind subtypes were dropped. List membership = `member_of` links (+ ordering); filing is optional and orthogonal to anchoring. Template-declared lists are instantiated as rows at project-link time (the same cookie-cutter pattern as quests); users create more lists offline as ordinary rows. No template editing in the field, ever.
- **The journal** names the union of all non-quest-bound contributions; lists are views into it. ("Library" is reserved for the study content itself — a likely future rename of the study material template to `library_template`.)

---

## Assumptions

Decisions in this doc rest on the following assumptions. If one turns out to be false, the decision it supports should be revisited.

- **A1 — Work is only tracked when an assignment exists.** Completion/progress is recorded against assignments (`assignment_item_completion`); there's no assignment-free attestation. Work done with no assignment is invisible to progress tracking. *(Supports: dropping `step_progress`; the assignment-anchored completion model.)*
- **A2 — The content/project template system ships first.** The process layer references content-template nodes (for assignments and reviewable work), so it's built on top of an existing content template system. *(Supports: build order; assignments referencing template node ids/ranges.)*
- **A3 — Study material lives in the LangQuest DB** as its own structured template with stable node ids (not fetched from an external API). *(Supports: anchoring contributions to study-material nodes; resolving the FIA-content-storage question.)*
- **A4 — Reviewability is declared on the content template.** Content-template nodes carry a "reviewable" indicator, and only reviewable nodes/quests enter the workflow. *(Supports: not putting content-template compatibility on the workflow template.)*
- **A5 — The quest remixing feature will exist.** Partial-work and partial-rework merging is handled by remixing rather than by this system. *(Supports: `quest.submission_state` lifecycle; per-asset rework flow.)*
- **A6 — One workflow per project.** `project_workflow_link` is unique on `project_id`; a project runs a single review process at a time. *(Supports: phase/group mapping; submission routing.)*
- **A7 — Template editing is website-only; clients are read-only on templates.** No server-side draft state; drafts live in the browser. *(Supports: fork-always immutability; the app/website split.)*
- **A8 — Review is opt-in and additive.** Projects without a `project_workflow_link` keep vote-based approval unchanged. *(Supports: the migration/rollout plan.)*
- **A9 — Review-state transitions can require connectivity.** Submitting, deciding, and advancing happen via server RPCs; offline devices stage intents but state only moves when the server processes them. *(Supports: the event-sourced engine; projection-only state columns.)*
- **A10 — Application-level integrity is acceptable for links.** `asset_link` targets (like template node ids today) are validated in RPCs, not by FKs; orphan checks run server-side. *(Supports: the polymorphic `asset_link` design.)*
- **A11 — No content within a project needs to be hidden from project members.** Review feedback must cross roles, key terms must span pericopes, and the governance model favors transparency. *(Supports: project-wide visibility; no per-asset ACL; visibility == project sync bucket. If a partner requires confidential group deliberation, revisit via a `visibility` enum on `asset_link`.)*

---

## Open questions

These are genuinely undecided:

1. **`link_role` governance** — the working set is `anchor`/`comment_on`/`reply_to`/`revision_of`/`flag`/`references`/`applies_to`/`member_of`. Open: the rule for admitting new roles (proposed: a new role must change engine/UI behavior, else reuse an existing one), per-role cardinality/target constraints, and whether any role needs structured fields beyond `anchor_data`.

**Deferred:**

- **Coordinator-as-proxy** — whether comment-assets/`review_decision` get an `on_behalf_of` field or just coordinator attribution with notes. Tied to the future WhatsApp/QR onboarding work; revisit then.
- **Re-anchoring across study-material versions** — the server job that migrates anchors via exact-quote matching when a project adopts a new study-material fork (see *Anchoring*). Not needed until the first version adoption.

**Containing the structure-editing boogeyman.** Offline editing of shared template structure is the one scenario that would demand CRDT-style merging (yjs/automerge), and this design deliberately never requires it. The containment logic, for future reference:

- Everything field users create offline — contributions, key terms, lists, list membership, completions — is **rows**, which row-level sync (PowerSync) already handles. Templates declare; rows are instantiated; users only ever add rows.
- If field users ever genuinely need to add *structure* offline, the pre-thought-out, CRDT-free answer is an **additive extension layer**: an `extension_node` table where each user-added node is its own row (`project_id`, `parent_node_id` → template or extension node, name, nanoid), merged into the tree at the read layer. Additions are commutative — two offline users adding different nodes never conflict. Users may edit/delete *their own* extension nodes; template-owned nodes stay website-only.
- The only thing that ever needs CRDTs is **concurrent offline mutation of shared nodes** — and that stays forbidden by design.

---

## Terminology

| Term | Meaning |
|------|---------|
| Workflow template | A JSONB structure defining the ordered review phases finished work passes through |
| Study material template | A separate template defining preparation steps (e.g. FIA 1–6); steps live here, not in the process template. (Candidate future name: `library_template` — the study content is the project's "library") |
| Step | A preparation task defined in the study material template (e.g. an FIA understanding stage) |
| Phase | An ordered review stage containing one or more group slots |
| Group slot | An abstract reviewer role in a template, mapped to a real project group |
| Project group | A first-class team of profiles (translator/reviewer/coordinator) |
| Assignment | A unit of work given to a profile/group across any stage of the process |
| Study material | FIA-style methodology content, now stored in the DB with its own node structure |
| Contribution / journal entry | A project-scoped `journal_entry` asset — anchored to library content, filed in lists, or both (links are orthogonal to type) |
| `asset_link` | The polymorphic linking table: asset → (target_type, target_id) with a `link_role` and denormalized project_id |
| Link role | What a link *means*: `anchor`, `comment_on`, `reply_to`, `revision_of`, `flag`, `references`, `applies_to`, … |
| Key term | A `journal_entry` in the project's Key Terms list; the agreed rendering is its own content, with `applies_to`/`references` links |
| Quote selector | The exact highlighted text (+ prefix/suffix) stored in `anchor_data` — used for display, re-anchoring, and drift detection |
| List | A `journal` asset; membership = `member_of` links with ordering; one entry can be in many lists |
| Journal | The union of a project's non-quest-bound contributions (entries) and the lists organizing them |
| Library | Reserved term for the study content itself (the material the team reads — vs the journal, which the team writes) |
| Revision pinning | Snapshotting the revision ids of referenced journal entries (e.g. key terms) into the submit event, so approvals can't drift against later edits |
| Anchor | An `asset_link` (role `anchor`) pinning an asset to a study-material spot, optionally with text/audio ranges in `anchor_data` |
| `asset_content_link` (acl) | The asset's *payload* (text/audio per languoid) — what an asset contains, vs `asset_link` = what it points at |
| Completable node | A node that has an assignment targeting it — the assignment is what makes it check-off-able (no separate flag) |
| Reviewable node | A content-template node marked as participating in review; only these enter the workflow (content-template-side field) |
| Study quest | A project-scoped quest container for study content (considered, not adopted; can be layered on later) |
| Completion rule | Per-assignment merge rule for multi-assignee units: `any` (default) or `all` |
| Submission | One review pass of a quest version through the phases |
| Decision | One group's verdict at one phase |
| Signoff rule | How a phase resolves: any one / unanimous / quorum |
| Comment | An asset (`content_type = 'comment'`) linked via `comment_on`/`reply_to` — not a dedicated table |
| Flag | A `flag`-role `asset_link` marking an asset for rework; blocks advancement while `active` |
| Review event | A row in the append-only `review_event` log — the source of truth for review state |
| Projection | A server-computed state column (`submission_state`, `status`, `current_phase_id`) derived from the event log; never client-written |
| Transition RPC | A server function (e.g. `cast_decision`) that validates, evaluates guards against the workflow JSONB, appends an event, and recomputes projections in one transaction |
| Reducer | The generic, template-driven interpreter that turns events + workflow JSONB into projections |
