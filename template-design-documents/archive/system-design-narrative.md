# The Whole Story: From Voting App to Three-Template Architecture

How LangQuest's entire next-generation design — content templates, the process/review system, the library, the journal, `asset_link`, and the event-sourced review engine — was developed, decision by decision, from where the app stands today. This is the long-form companion to [template-system.md](./template-system.md), [process-template-system.md](./process-template-system.md), [library-template-system.md](./library-template-system.md), and [process-template-system-narrative.md](./process-template-system-narrative.md), which hold the full designs. This document tells the story of how we got there — including the parts we built and then deleted.

---

## Prologue: the app as it stands

LangQuest today is deceptively simple. Translators in low-connectivity regions record translations on their phones. PowerSync replicates SQLite rows to and from Postgres whenever a connection appears. The community votes on recordings; net upvotes mean approved. A project has owners and members — `profile_project_link.membership` — and that is the entire permission model.

Structure is where the cracks show. Every project carries a hardcoded enum: `bible`, `fia`, or `unstructured`. The app contains literal branches on those values — Bible projects get book/chapter/verse navigation; FIA projects get pericopes fetched live from FIA's external API; unstructured projects get a free-form `quest.parent_id` hierarchy. Three product lines welded into one codebase, and every new partner would mean a fourth.

Two forces collided with this architecture at the same time:

1. **Users wanted their own structures** — dictionaries by letter, poetry by theme, video by timestamp. The enum could never keep up.
2. **ETEN arrived** with a requirement the app could not even express: church-governed, multi-stage review. A translation team checks the work, then the community, then church leadership, then a blessing board. The app's answer to "who approved this?" was a vote count.

Everything that follows grew out of those two pressures — and out of one constraint that never relaxed: **the app is offline-first, and PowerSync syncs rows.** Every design below was ultimately judged by a single question: *can this survive a phone that's been offline for three weeks?*

---

## Chapter 1: Killing the enum — content templates

### The obvious design, and why it died in arithmetic

The natural relational answer to "arbitrary hierarchy" is a `template_node` table: one row per book, chapter, and verse, FK to parent, FK from quests and assets. We did the arithmetic before writing the migration. A Protestant Bible is roughly **31,000 nodes**. A hundred projects using it means **3.1 million rows** of pure structure — O(projects × template_size) — flowing through sync buckets to phones that mostly just need to render a tree. Materialized node rows died on that estimate (constraint C12: no record accumulation).

The replacement inverted the model: **the entire tree is one JSONB blob** in a `template.structure` column. One row, shared by every project that uses it. The app browses structure offline by reading the blob directly — no server call, no join (C23). Quests and assets reference nodes inside the blob by ID.

Which raised the question that quietly shaped everything afterward: *what is a node ID?* The answer became a load-bearing decision: **`nanoid(10)`, opaque, immutable once created, no `external_id` column** (C9/C10). Semantic IDs ("gen-1-1") invite renaming, collision, and migration pain; opaque IDs never change meaning because they never had one. Backfill scripts and the FIA cron match nodes by tree-walking plus `metadata` instead. Every system built later — anchors, assignments, review records — leans on the guarantee that a node ID, once minted, refers to the same conceptual thing forever.

### The editing problem: we built locks, and then we tore them out

If templates are shared and editable, what happens when two people edit one? The first answer was textbook: **pessimistic locking**. We built it — `acquire_lock`, `heartbeat_lock`, `release_lock`, `force_release_stale`, plus `locked_by` and `locked_at` columns, plus `structure_version` optimistic concurrency as a second line of defense.

It worked, and it was miserable. Crashed browsers left stale locks needing timeout logic and forced takeover. The lock didn't *prevent* conflicts, it just narrowed the window. Four RPCs and three columns of machinery defended against a problem we then realized we could simply delete:

**Published templates are immutable. Editing is forking.**

Every publish inserts a *new* `template` row; `copied_from_template_id` chains provenance like a linked list. Drafts live only in the editor's browser (IndexedDB) — the server never holds mutable draft state (C19). There is nothing to lock because there is nothing shared that can change. The lock RPCs, the lock columns, and `structure_version` were all removed. CRDTs were considered for about as long as it took to notice that a single-writer-per-browser, website-only editing model needs none of it (C4).

This "fork-always" move is the single most consequential decision in the whole architecture. It gets reused twice more in this story.

### The reconciliation insight

Forking creates a riddle: a project has quests pointing at node `fKa9y8aSdj`; the owner deletes that verse from the template and republishes. Now what?

The answer is the system's quiet centerpiece: **the editor never asks the user about backend integrity; the system decides contextually at publish time.** The user just deletes. The draft records `deleted: true`. Then:

- Publishing **to existing projects** keeps deleted nodes as tombstones — IDs stay valid, contributions stay anchored, links get re-pointed to the new row.
- Publishing **for new use** strips tombstones — nothing references those IDs yet, so the template ships clean.
- **Both at once** publishes two forks from one draft.
- Applying a tombstone-bearing template to a *new* project strips tombstones at the read layer (`buildTemplateIndex` on mobile, `node-resolver` on the website) — no mutation of the shared row needed.

A runtime compatibility check (`check_template_compatibility`) guards every re-point: every `template_node_id` referenced by the project's quests and assets must exist in the target structure (tombstoned counts). Missing IDs block the publish with an actionable error. And `frozen = true` on `project_template_link` protects legacy backfilled links from ever being re-pointed, without making the template itself unforkable — an earlier `locked_for_backward_compat` flag on the template was rejected for conflating the template with the *connection* (the freeze belongs to the link).

### Indirection that pays rent

Quests and assets don't reference the `template` row — they reference the **link**: `template_link_id` (UUID FK to `project_template_link`) plus `template_node_id` (the nanoid). When a fork is adopted, the link's `template_id` pointer mutates; every quest and asset reference stays untouched. The link row is the stable identity; the template behind it is swappable.

One review later, the link table gained its strictest constraint. The original design allowed **multiple templates per project** — several side-by-side trees. Rejected: a project is by definition one concerted effort to translate one body of material, and a second top-level tree behaves like a sub-project, adding a management layer for nothing. Now `project_template_link` is **unique on `project_id`** — one template per project (C6). Want a Bible *and* a myth collection? **Composition**: import subtrees from another template into your draft, copied with fresh nanoids, as top-level branches of your single tree.

### The day we measured the Bible

The early size estimate for a template blob was 20–100KB. Then we generated a fully populated Protestant Bible tree (`scripts/generate-bible-template.py`) — every book, chapter, and verse with `id`, `name`, `node_type`, `linkable_type`, `allows_spanning` — and measured:

- **~7MB pretty-printed, ~4MB minified.** Forty times the estimate's ceiling.
- Postgres TOAST compresses JSONB over ~2KB, so the stored estimate is **~1.5–3MB**.
- PowerSync's row limit is **15MB**. It fits — with headroom, not with comfort.

The decision held: **one large JSONB field**, with a defense-in-depth plan written down before it's needed (C34): a user-facing size cap first ("this template is too large" — preventing someone composing three full Bibles into one blob), then multi-row splitting (same template id, fractional indexing, client reassembly) if testing demands it, then attribute slimming. Validating actual `pg_column_size` and a real PowerSync round-trip of a Bible-sized row is a named pre-launch task.

This measurement matters beyond the content template — it's the number that later forced the library's most important decision.

### What shipped

Three tables (`template`, `project_template_link`, `template_revision` — the last audit-only and never synced), columns on `quest` and `asset` (`template_link_id`, `template_node_id`, `span_end_template_node_id` for verse-spanning assets), three RPCs (`publish_template`, `fork_template`, `save_template_metadata`), structured revision diffs (`computeTreeDiff` walking both trees by stable ID — add/remove/rename/move/hide/unhide/property_change, no CRDT library needed for a snapshot comparison), discovery RPCs (`get_template_lineage`, `adopt_template_fork`, `link_template_to_project`), a daily `pg_cron` FIA refresh, five Supabase migrations, the website tree editor (react-arborist over IndexedDB drafts), and the mobile read path.

Migration posture: **every project gets a template** (C30). Existing Bible/FIA projects get seeded templates with frozen links; unstructured projects get auto-generated ones. Legacy quests that mix subquests and assets at one level — which the template model forbids, a node's `linkable_type` being `quest` *or* `asset` (C31) — are handled by the **loose asset** rule: an asset may hang off its quest with no node assignment at all, excluded from template-derived ordering and coverage until someone files it (C32). No "generic node" hack required.

---

## Chapter 2: ETEN knocks — the review RFC and the Q&A that bent it

With content templates underway, the ETEN requirement could finally be confronted. An RFC laid out a review system: workflow templates, groups, assignments, submissions, decisions, comments, flags, step progress, an audit log. Then it went through review — nine questions from Rafael — and the answers reshaped it more than the original draft did. Three exchanges in particular set the trajectory.

**Q5 — "could assignments be more versatile?"** The RFC had assignments for translation and rework only, and Rafael suggested both widening them to every stage and adding a `percent` progress field. The answer split the suggestion in half, and both halves became architecture. Yes to widening: `assignment_type` grew to `translation | rework | review | approve`, because **one mechanism means one notification pipeline** — the thing that tells a translator to translate is the same thing that tells a reviewer to review. No to percentages: coordinators think in *units* ("step 1 of 6 done"), not percentages; a percent is lossy and meaningless across versions and review stages. The clarification that followed — *objective progress must be inferred from individual assignment progress, because objective measures struggle across versions and stages* — became constraint C7 and eventually killed the RFC's standalone `step_progress` table. Completion now hangs off assignments: `assignment_item_completion`, one row per completed node in an assignment's target. Nothing is pre-marked "completable" — **if an assignment targets it, it's completable.** Multiple assignees merge via `completion_rule` (`any`/`all`) at query time. The accepted cost is written down as assumption A1: work with no assignment is invisible to progress tracking.

**Q6 — "how does step progress work exactly?"** The answer surfaced a truth that shaped the contribution system: FIA's steps contain prompts — "discuss this," "decide how to render that" — that are **not programmatically identifiable**. There is no machine-countable number of expected contributions per step. Therefore contributions can *never* count toward completion; they're surfaced and notified ("3 items contributed to step Y of pericope Z"), but a step's done/not-done state is always a deliberate human checkmark.

**Q7 — "I'm not sure exactly what this is" (on `asset_anchor`).** The clarification notes attached to this question are, in hindsight, the seed of two entire systems. Working through how a highlighted-sentence contribution could survive across quest versions, the notes concluded: contributions must bind to the *study content and the project*, never to a quest version; the study content **would have to be stored in the LangQuest database**, versioned, with stable linkable IDs; contributions need their own revision threads with active flags. That paragraph is the library template system and the cross-version contribution model, in embryo.

Two more answers locked in structural decisions. **Q8** (what about partial work and partial rework?) pinned the submission lifecycle to the **quest remixing** feature — compose a new submittable version from the good parts plus the fixed parts — recorded as assumption A5. **Q9** (couldn't submission and decision be one entity?) got the definitive no: a phase can have several reviewing groups under a configurable signoff rule (`any_one | unanimous | quorum` with a fractional threshold like `2/3` that self-adjusts as group membership changes), so one submission must collect many decisions.

---

## Chapter 3: The second template — process

The ETEN flow is Team → Community → Church → Blessing Board. The next partner's will be three stages, or two reviewers per stage, or majority signoff. Hardcoding ETEN's process would repeat the exact `bible`/`fia` enum mistake the content system had just escaped — and the team had a proven pattern sitting right there.

So the review process became the **second JSONB template**. `workflow_template.structure` holds ordered **phases**, each with **group slots** (abstract reviewer roles) and a signoff rule. Same single-row storage, same nanoid IDs, same fork-always immutable publishing, same `copied_from_template_id` provenance, same website-only IndexedDB editing, same server-only revision audit table (`workflow_template_revision`), same RPC trio (`publish_workflow_template`, `fork_workflow_template`, `save_workflow_template_metadata`). Normalized phase/slot tables with FKs were considered and rejected as heavier than one row — string refs into JSONB validated at the application level were by now an *accepted pattern*, not a compromise (C4).

The template names roles; projects supply people. `project_group` (+ `project_group_member`) introduced first-class teams — translator/reviewer/coordinator role types — deliberately separate from `profile_project_link`, which keeps owning access control. Extending the membership enum was rejected because it conflates access with organization: a person belongs to multiple groups, and groups need identity and lifecycle. `project_phase_group` then maps each abstract slot to a real group, per project.

A project adopts a workflow via `project_workflow_link` — one per project, opt-in, and **permanent**: adopting a new fork mutates the row's `workflow_template_id` pointer under a compatibility check (every `phase_id`/`group_slot_id` referenced by existing review data must resolve in the target fork), rather than spawning a new row. A plain FK column on `project` would have worked today, but the relationship has its own attributes — `frozen` blocks re-pointing mid-review, adoption time matters — and the link table mirrors how content templates attach. Nothing pins past submissions to template versions; history is protected by *constraining forks* plus the event log (Chapter 6), not by version anchors.

One subtle inversion is worth recording: the workflow template does **not** declare which content templates it's compatible with. Instead, content-template nodes will carry a `reviewable` flag — the content side knows what's reviewable; the workflow side stays generic (assumption A4).

---

## Chapter 4: The third template — the library

### The problem FIA forced

The process design kept assuming a thing that didn't exist: study material with stable, linkable, versioned node IDs. FIA's six understanding steps were being pulled live from FIA's external API — fragile, unversionable, impossible to anchor against. And the steps emphatically did *not* belong inside the workflow template (the RFC originally had `steps[]` next to `phases[]`): preparation methodology and review chains are independent concerns — a partner should be able to swap methodologies while keeping their review process.

So: a **third template**. Study material stored in our own DB. The proposal began with an inventory — read FIA's API docs and scraped output (`fia/output/pericope_gen-p2.json`) and catalogue every mechanism their content model actually uses. Thirteen mechanisms (M1–M13), each generalized: hierarchical navigation (Testament → Book → Pericope → Step), flat shared catalogs (terms, media, maps) attached to pericopes by reference, inline references in text (`[水果](#m387)`), structured rich text blocks, embedded action prompts ("pause the audio here and…"), multi-bitrate audio variants, scripture alignment coordinates, stable-ID splits (`p1` → `p1a`/`p1b` so other IDs never move), per-language-per-node semantic versioning, discontinuation dates.

The headline discovery: **FIA had independently converged on LangQuest's own core split** — an immutable language-agnostic skeleton with stable opaque IDs, and per-language content attached per node. A `Pericope` node exists once; a `StepRendering` sits at (pericope × step × language) and carries the actual prose and audio. Almost nothing needed inventing. It needed *placing* — each FIA mechanism mapped into existing LangQuest machinery, behind an **adapter contract** so the next partner is a new adapter, never new schema.

### The decision the Bible measurement made for us

Here Chapter 1's 4MB number came due. FIA content is *prose*: six steps × ~3,000 pericopes × 15 languages, plus term articles, media, audio. Inlining content into the template JSONB would detonate the 15MB PowerSync row limit immediately — and force every device to sync every language.

So the library enforces M1 strictly, and it's the system's defining split:

- **`library_template.structure`** — the *skeleton only*: tree + catalogs + typed `refs` (term/illustration/map edges into catalogs) + `alignment` (declared scheme + coordinates, e.g. `"bible"` book/chapter/verse ranges that resolve against content-template node ranges — not a hardcoded Bible assumption). Same JSONB/fork-always/website-only model as the other two. The template never contains prose.
- **`library_content`** — one row per **(node × languoid × version)**: the rendering. `title`, `body` (a small canonical block format — paragraphs, headings, lists, callouts, and a first-class `action` block for FIA's pause-and-do prompts, with `node-ref` inlines making term/map references tappable), `body_plain` (derived, the surface text anchors measure against), `attachments` (`{kind, variant, url, bytes}` — FIA's four audio bitrates generalized), `metadata` (upstream semver preserved). **Rows are immutable; superseding inserts `version + 1`.** Unique on (node_id, languoid_id, version). Old versions are retained because anchors point at them.

Devices sync the skeleton plus only the content rows for their project's configured languages and download profiles — the per-row granularity that inlining would have destroyed. Reusing `asset`/`asset_content_link` for this was considered and rejected: assets are project-scoped user contributions with votes and project bucketing; library content is global, read-only, system-published material. The clean analogy: `library_content` is to the library template what quests and assets are to the content template — the materialized layer.

`project_library_link` (unique on `project_id`, mirroring its two siblings), `library_template_revision` (audit-only), and the mirrored RPC set complete the system. The existing FIA edge functions and daily cron are the seed of the first adapter, whose contract is explicit: fetch upstream, match IDs idempotently via `metadata.upstream` (mint nanoids only for genuinely new nodes; splits become new tombstone-preserving siblings), publish structure changes as forks (additive flows automatically; destructive gets flagged for human review), publish content as new immutable rows, normalize rich text and attachments, declare alignment, and **drop what doesn't generalize** — FIA's internal workflow fields stay out of the schema.

Three templates now stand in a row, each owning one concern: the content template declares **what gets translated**, the library declares **what the team reads to prepare**, the process template declares **how finished work is validated**.

---

## Chapter 5: One table to link them — asset_link and the journal

### All language contributions are assets

While working FIA step 3, a team argues about a phrase, decides how to render a term, draws a picture. Today that knowledge evaporates. The design principle that catches it: **all language contributions are assets** — a discussion recording is an asset like any other, with `asset_content_link` payloads (text/audio per languoid), votes, and revision chains for free.

The real problem is *connection*. The RFC's answer was bespoke: an `asset_anchor` table here, `review_comment` and `review_asset_flag` tables there, each new relationship a new migration and another UNION in "show me everything for asset X." The replacement is **one polymorphic table**:

**`asset_link`** — *(asset, target_type, target_id, link_role, anchor_data, project_id, order_index, active)*. Targets: quests, assets, content-template nodes, library nodes, review decisions, review submissions. The generalization lives in `link_role`: `anchor`, `comment_on`, `reply_to`, `revision_of`, `flag`, `references`, `applies_to`, `member_of`. The same six columns express "anchored to FIA step 3's audio at 0:42," "comment on decision X," "reply to that comment," "revision of an earlier contribution," "this term applies to Genesis 1–3."

Why polymorphic instead of FK-per-type? Because **half the targets can never be FKs anyway** — they're opaque nanoids inside shared JSONB. The system had already accepted application-validated string refs (content C2, process C4); the polymorphic table just makes real-row targets play by the same rules, with integrity enforced in write RPCs plus periodic orphan sweeps (assumption A10). An exclusive-arc design (one nullable FK per type plus a CHECK) was rejected for widening with every new target while still losing the FK benefit on the JSONB half.

And one denormalization does triple duty: **every link carries `project_id`**, because contributions can predate any quest and templates/library are shared across projects — neither path identifies the project — and because `project_id` *is* the sync bucket and the RLS predicate. Visibility fell out of the same column: **project-wide, no per-asset ACL** (assumption A11). The rework loop needs comments crossing roles, key terms must span pericopes, and contextual narrowing comes from *anchors*, not permissions — you see step-3 notes when you're in step 3. If a partner ever needs private deliberation, the named additive path is a `visibility` enum on the link row.

Anchoring itself got the W3C Web Annotation treatment. `anchor_data` holds text offsets *and* the exact quoted text (with prefix/suffix context), and/or audio timestamps. Durability comes from Chapter 4: library content rows are **immutable per version**, and the anchor pins the row — char offsets against an immutable document never rot. The stored quote isn't redundancy; it renders the contribution without fetching the source, serves as the re-anchoring key when a project adopts a new library fork (a deferred server job: exact-quote match → rewrite offsets; no match → mark stale but keep displayable — graceful degradation, never data loss), and acts as a drift detector.

### The journal: lists are the categories

Anchored contributions are findable *in context* but not *as a body of knowledge*. Teams need lists — the owner wants Key Terms and Discussions from day one; translators in the field realize they need "Cultural notes" *offline, immediately*.

The trap was making lists template structure: field users would then need offline template editing — the one problem that genuinely demands CRDTs, which this architecture refuses on principle. The escape is the **cookie-cutter pattern** the app already uses for quests: *templates declare; instantiation materializes rows; rows live their own lives.*

- A **list** is an asset (`content_type = 'journal'`) — so its *name* is asset content, meaning an oral-first community can name their list with recorded audio in their own language.
- An **entry** is an asset (`content_type = 'journal_entry'`); membership is a `member_of` link with `order_index` (playlist-style; concurrent offline reorders are last-write-wins per link row — worst case a cosmetic shuffle, never lost content).
- Template-declared lists (a `lists: [{id, name, kind}]` field in structure JSONB) are instantiated as rows by the project-link RPC, with a `template_list_id` backref. User-created lists are the same rows minus the backref, made offline.
- The earlier content subtypes (`discussion`/`rationale`/`key_term`/`media`) were **deleted from the design**: categorization comes from list membership — **the lists are the categories.** `content_type` says what an asset *is*, set once, never mutated; `link_role` says how it *connects*, and links come and go freely.

The union of all non-quest-bound contributions is the project's **journal**. The naming settled deliberately: the **library** is what the team *reads*; the **journal** is what the team *writes*.

New schema surface for the entire journal: two content_type values, one link role, one JSONB field. **Zero new tables.**

### Key terms: the payoff

The flagship case proves the model. Teams must decide how to render critical terms ("covenant") and apply the decision consistently project-wide — the library may never even mention the term. A key term is just a `journal_entry` in the template-declared Key Terms list. Its agreed rendering is *its own content* (text and/or audio in the target language). `applies_to` links surface it wherever its passages appear; `references` links let translations cite the decision they followed; its `revision_of` chain records how the team's thinking evolved. Created offline, in the field, like everything else. A critical, partner-required feature landed as **zero new tables** — that's stages 6 and 7 paying rent.

---

## Chapter 6: Who owns the truth — the event-sourced review engine

The last hard problem was state. A submitted quest version moves through phases under guards (did the quorum approve? any open flags?) with cascades (withdrawing at phase 2 invalidates phases 3+) — while offline phones might sync conflicting writes. If clients could write `submission_state` directly, two phones could disagree about reality, and reconciling them afterward is exactly the conflict problem this architecture exists to avoid.

Formally, the flow is a **hierarchical statechart**, not a flat FSM: `in_review` is a superstate containing ordered phase substates; each phase contains parallel regions (one per mapped group) resolving independently; transitions are guarded by the signoff predicate over active `review_decision` rows. A flat status enum with trigger-enforced transitions is simply too weak for that shape. External engines (Temporal, Step Functions) were rejected as a massive operational dependency for what are, in the end, simple Postgres transactions.

The mechanism: **clients append facts; the server decides.**

- **`review_event`** is the append-only log — the *source of truth*. Server-only, never synced, never edited. Event types: `submitted`, `approved`, `rejected`, `withdrawn`, `cascade_invalidated`, `comment_added`, `asset_flagged`, `flag_resolved`, `rework_assigned`, `rework_completed`, `phase_advanced`, `workflow_completed`, `submission_withdrawn`.
- The state columns — `quest.submission_state` (draft → submitted → in_review → rework/withdrawn/approved_final, with a partial unique constraint enforcing one active version per pericope), `review_submission.status`, `current_phase_id` — are **projections**: server-computed summaries recomputed in the same transaction that appends each event. Their apparent redundancy dissolved once both were understood as projections of one log. Clients never write them, so they cannot drift.
- **One RPC per transition** — `submit_quest`, `cast_decision`, `withdraw_decision`, `resolve_flag`, `assign_rework`, `complete_rework`, `resubmit_quest`. Each, in one transaction: validate the actor and current state → evaluate guards against the workflow JSONB → append the event → recompute projections. This mirrors the codebase's existing `apply_table_mutation` pipeline — an established pattern, not new machinery.
- **The reducer is template-driven.** The engine is a generic interpreter of `workflow_template.structure`. A new review process is a new template, never new transition code — the same claim, note, that the library makes about partners ("a new partner is a new adapter, never new schema").

Chapter 5's investment kept compounding here: the RFC's `review_comment` and `review_asset_flag` tables are *gone*. A comment is an asset (`content_type='comment'`) with `comment_on`/`reply_to` links — threads for free. A rework flag is a `flag`-role link that blocks phase advancement while `active`. Even a decision's *reason* is a linked comment-asset, not a text column — only the structured verdict (`review_decision`) stays a typed row, because signoff aggregation needs queryable decisions, not prose. And `submit_quest` performs **revision pinning**: it snapshots into the event payload the revision IDs of every Key Terms entry linked to the submitted work — an approval can never silently drift against a glossary edited afterward.

Rework routes through humans, not state machines: rejection notifies the coordinator, who reads the comments and flags, creates a rework `assignment` (Chapter 2's machinery, again), and resubmits when it's done — always restarting at **phase 1**, because rework changed the work and earlier approvals no longer describe it. Partial fixes lean on quest remixing. Notifications reuse the existing `notification` table with new target types — no new mechanism.

Two free prizes fell out. Because state is a pure function of log + template, projections can be **rebuilt by replaying the log** — determinism for bug fixes and audits. And the audit trail ETEN's governance demands costs *nothing*: the event log **is** the audit trail. The RFC's separate `review_audit_log` was deleted — a second log is a copy that can drift, while the event rows can't be wrong about what happened because they *caused* what happened.

The one accepted trade, stated plainly as assumption A9: **transition RPCs require connectivity.** Offline devices stage their intents — decisions, comments, flags — but state only advances when the server processes them. Consistent with the conflict-avoidance posture everywhere else.

---

## Chapter 7: The boogeyman we starved

Threaded through every chapter is one adversary, named early and starved deliberately: **concurrent offline editing of shared structure** — the one workload that genuinely requires CRDTs (yjs/automerge), an enormous complexity tax on every feature it touches.

The containment strategy, in three lines:

1. Everything field users create — recordings, contributions, key terms, lists, filings, completions, decisions, comments, flags — is an **ordinary row**, which row-level sync already handles. *Templates declare; rows are instantiated; users add rows.*
2. Structure editing is website-only, fork-always, single-writer-per-browser. Nobody ever edits a template in the field. Not because the UI hides it — because no user story requires it.
3. If field-added structure is ever truly needed, the pre-designed escape hatch is an additive `extension_node` table — each user-added node its own row, merged into the tree at the read layer; additions are commutative, so two offline users adding different nodes never conflict. Still rows. Still no CRDTs.

Every time the design wobbled toward shared mutable structure — offline list creation, journal organization, list reordering — the answer was the same: make it a row (lists are assets, membership is links, ordering is last-write-wins `order_index`).

---

## Epilogue: one data spine

Step back and the whole plan is one picture — the [combined schema](./app) renders it interactively:

| | Content template | Library template | Process template |
|---|---|---|---|
| Declares | what gets translated | what the team reads | how work is validated |
| Structure | JSONB tree | JSONB tree + catalogs | JSONB phases/slots |
| Materialized layer | quests + assets (user-created) | `library_content` rows (adapter-published) | groups, assignments, submissions, decisions |
| Linked by | `project_template_link` | `project_library_link` | `project_workflow_link` — each unique per project |

Three template systems, one architecture, used three times: a single JSONB blob with opaque nanoid node IDs, immutable fork-always publishing with provenance chains, website-only IndexedDB editing, a one-per-project link table whose pointer mutates under compatibility checks, a server-only revision audit table, and string refs validated at the application level. Crossing them all: `asset_link`, the one polymorphic connector; the journal, where team knowledge accumulates as ordinary rows; and the event log, the single owner of review truth.

The rollout posture matches the design's temperament: everything additive (existing tables gain only `quest.submission_state` and new `content_type` values), everything opt-in (no workflow link = vote-based approval, untouched), system templates shipped as starting points (a CBBT process template, an FIA library), website configuration first, app surfaces second. The app does the work — record, contribute, check off, submit, decide, flag, all offline-capable except state transitions. The website configures and oversees — build templates, map groups, assign, audit.

And the chain that got here, in one breath:

> A hardcoded enum couldn't hold user structure, so **content templates** — materialized rows died in arithmetic, so **one JSONB blob** — shared editing demanded locks, which we built and tore out, so **fork-always immutability** — ETEN needed staged review and the pattern was proven, so the **process template** — templates name roles, so **groups** — people need tasks, so **assignments** — coordinators need checkmarks, so **assignment-anchored completion** — preparation needs a home with stable IDs, so the **library**, split skeleton-from-content by the Bible's own 4 megabytes — preparation produces knowledge, so **asset_link** — knowledge needs organizing without touching templates, so the **journal**, whose lists *are* the categories — its flagship, **key terms**, costing zero tables — finished work enters **submissions and decisions** — state needs one owner, so the **event-sourced engine** — which hands over the **audit trail** for free — and through all of it, every field action is a row, and the CRDT boogeyman never gets fed.
