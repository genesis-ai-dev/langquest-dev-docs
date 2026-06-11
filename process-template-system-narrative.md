# How We Got Here: The Review System, One Need at a Time

A progressive walkthrough of the process/review featureset — each feature introduced by the problem that makes it necessary. Companion to [process-template-system.md](./process-template-system.md), which holds the full design. Each numbered stage can stand alone as a presentation slide.

---

## 0. Where the app is today

LangQuest right now: translators record translations on their phones, offline-first (PowerSync). Community members vote; net upvotes = approved. Projects have owners and members — that's the whole permission model. Pericopes can have multiple competing quest versions. Content templates (in development) define project structure as JSONB trees.

This works for open crowdsourcing. It does not work for partners like ETEN, whose church-governed process requires staged validation: a translation team checks the work, then the community, then church leadership, then a blessing board. Nothing in the app can represent that.

**The rest of this document is one long chain: each thing we add creates the need for the next.**

---

## 1. Partners need staged review → the workflow template

ETEN needs Team → Community → Church → Blessing Board. But ETEN is one partner; the next partner will have three stages, or two reviewers per stage, or majority-vote signoff. Hardcoding ETEN's process repeats the mistake of the old hardcoded `bible`/`fia` project types.

**So we add:** `workflow_template` — a reusable blueprint of ordered **phases**, each with **group slots** (abstract reviewer roles) and a **signoff rule** (any one / unanimous / quorum fraction). Stored as a single JSONB row, published immutably, edited by forking — exactly the architecture the content template system already uses (down to the server-only revision audit table), so we're reusing a proven pattern, not inventing one.

A project adopts a workflow via `project_workflow_link` (one per project). Projects without one keep vote-based approval — the whole system is opt-in. The link row is **permanent**: adopting a new fork re-points its `workflow_template_id` (under a compatibility check that existing review data still resolves) rather than creating a new row, and `frozen` blocks re-pointing mid-review. The table exists because the relationship has its own attributes (`frozen`, adoption time) that don't belong on `project` — history is protected by the compatibility check plus the event log (stage 11), not by pinning template versions.

| Considered | Rejected because |
|---|---|
| Hardcode ETEN's four stages | Next partner differs; repeats the old hardcoded `bible`/`fia` enum mistake |
| Normalized phase/slot tables with FKs | Heavier than one JSONB row; content templates already proved single-row + fork-always; string-refs into JSONB are an accepted pattern |
| Mutable templates with locking | Locking was built and rejected in the content template system (stale locks, doesn't prevent conflicts); immutable forks eliminate the problem |
| Workflow template declares which content templates it's compatible with | Inverted instead: content-template nodes carry a `reviewable` flag — the content side knows what's reviewable, the workflow side stays generic |
| A `workflow_template_id` FK column on `project` instead of a link table | Would work today, but the relationship's own attributes (`frozen`, adoption time, who adopted) would become nullable workflow columns on a core table; the link table also mirrors how content templates attach, and keeps multi-workflow-per-project a dropped-index away instead of a restructure |
| A new link row per fork adoption (version anchor) | The link is a pointer, not a history record — the compatibility check guarantees old review data still resolves in the new fork, and the event log already preserves the true history server-side |

---

## 2. The template names "reviewer roles" — but who actually reviews? → groups

The template says "the Church group reviews at phase 3." The app only knows owners and members. There's no way to say *these eight people are the church reviewers*.

**So we add:** `project_group` (+ `project_group_member`) — real, named teams with role types (translator / reviewer / coordinator), separate from the existing owner/member access control. And `project_phase_group` maps each abstract group slot in the template to a real group in the project.

Now "Team → Community → Church → Board" is fully expressed: template declares the slots, the project fills them with people.

| Considered | Rejected because |
|---|---|
| Extend `profile_project_link.membership` with more role values | Conflates access control with team organization; a person belongs to *multiple* groups; groups need their own identity, role type, and lifecycle |
| Bind templates to real groups directly | Templates are shared across projects — they can only name abstract slots; each project must map slots to its own people |

---

## 3. People don't know what they're supposed to do → assignments

A reviewer doesn't know pericope 5 is waiting for them. A translator doesn't know they've been given Mark 1–3. Today, work is discovered by browsing.

**So we add:** `assignment` — one table for every kind of task: translate this, rework that, review this, approve that. One mechanism means one notification pipeline: the same thing that tells a translator to translate tells a reviewer to review.

Assignments target quests, assets, or template nodes (with ranges) — because at assignment time, the work products often don't exist yet; the structure does.

| Considered | Rejected because |
|---|---|
| Assignments for translation/rework only (original RFC) | Reviewers and approvers need the same "you have a task" mechanism; one table = one notification pipeline |
| Assignments targeting only existing assets | Assets don't exist yet when work is first assigned — asset targets make sense mainly for rework; structure (template nodes + ranges) is the natural early target |

---

## 4. Coordinators ask "how far along are we?" → assignment-anchored completion

With assignments in place, coordinators need progress visibility. A percentage ("17% done") is noise — a coordinator wants *"step 1 of 6 is done"*, as checkmarks.

**So we add:** discrete completion records hanging off assignments (`assignment_item_completion` — one row per completed node in the assignment's target). What's "completable" needs no flag anywhere: **if an assignment targets it, it's completable.** Multiple people assigned to the same unit? The assignment's `completion_rule` (`any`/`all`) says how their records merge.

Key consequence we accept: work is only tracked when an assignment exists. No assignment, no progress tracking.

| Considered | Rejected because |
|---|---|
| A `percent` field on the assignment | Coordinators think in units done ("step 1 of 6"), not percentages; percentages are lossy and meaningless across versions/stages — derive them at display time if ever needed |
| A `completable` flag on template nodes | Redundant — the assignment targeting a node *is* what makes it completable; one less thing to author in templates |
| A standalone `step_progress` table (original RFC) | Duplicate of assignment-anchored completion; kept both briefly, then dropped — accepting that assignment-free work isn't tracked (assumption A1 in the design doc) |
| Standalone target-keyed completion records, no assignment required | "Scope" is ambiguous (completed per quest? per pericope? per assignment?); multi-person de-duping unsolved |
| Hybrid: target-keyed records *tagged* with an assignment | More rules and moving parts; the assignment-anchored model's one weakness (multi-assignee merge) was solved more cheaply with `completion_rule` |

---

## 5. Translators must *prepare*, not just record → the library (study material in the DB)

ETEN's methodology (FIA) requires translators to work through six understanding steps before recording. Two problems: the FIA content currently comes from an external API (fragile, unversionable), and "the six steps" have to live somewhere the system can point at.

They do **not** belong in the workflow template — that's about what happens to *finished* work. Mixing prep steps into the review template would couple two independent things (a partner might swap methodologies but keep their review chain).

**So we add:** study material stored in our own DB as its own template — same JSONB/fork-always architecture, stable node ids. Three templates now coexist, each owning one concern:

| Template | Owns |
|---|---|
| Content/project template | the passage structure (what gets translated) |
| Study material template — *the library* | the methodology steps (how to prepare) |
| Workflow/process template | the review phases (how finished work is validated) |

Step completion needs no new machinery — stage 4 already covers it: assign the steps, check them off.

| Considered | Rejected because |
|---|---|
| Keep fetching FIA from the external API | Fragile, unversionable, and impossible to anchor against reliably — anchors need stable node ids and immutable versions |
| Steps inside the workflow template (original RFC had `steps[]` + `phases[]`) | Couples methodology to review chain — a partner should be able to swap methodologies but keep their review process; prep and validation are independent concerns |
| Build the review system before content templates | Reversed: the process layer references content-template nodes heavily (assignments, reviewable work), so content templates land first to avoid rework |

---

## 6. Studying produces knowledge — where does it go? → asset_link

While working through FIA step 3, a team has a discussion about a phrase, decides how to render a term, draws a picture. This knowledge is valuable — to reviewers, to other pericopes, to future versions. Today it evaporates.

Our principle: **all language contributions are assets.** A discussion recording is an asset like any other. The real problem is *connecting* assets to things: this discussion belongs to *that sentence* of FIA step 3; this drawing relates to *that decision*. Assets can currently link to quests and template nodes only, each via bespoke plumbing.

**So we add:** `asset_link` — one polymorphic linking table: *(asset, target_type, target_id, link_role, anchor_data, project_id)*. Any asset can point at a quest, a template node, a library node, a review decision, or another asset, and `link_role` says what the link *means* (`anchor`, `comment_on`, `reply_to`, `revision_of`, `flag`, `references`, `applies_to`, `member_of`).

Anchoring is precise and durable by construction: library content is immutable per version, so the anchor pins a version + char offsets/audio timestamps, plus the exact quoted text (display without fetching, re-anchoring across versions, drift detection).

And because contributions exist before any quest does, and templates/library are shared across projects, every link carries its own `project_id` — which also gives sync bucketing and RLS for free.

Three properties fall out of this design, all decided:
- **Cross-version:** contributions bind to library content + project, never to a translation quest version — so every version of a pericope sees them. A contribution evolves as a `revision_of` chain, not competing copies.
- **Never counted toward completion:** study prompts are open-ended (discussions, decisions, drawings) — there's no machine-countable "expected number of contributions," so contributions are surfaced and notified but never flip a step's done/not-done state. Completion stays a deliberate checkmark (stage 4).
- **Project-wide visibility:** every project member sees every contribution. Anchors provide the contextual narrowing (you see step-3 notes when you're in step 3) — permissions don't.

| Considered | Rejected because |
|---|---|
| A bespoke link table per relationship (`asset_anchor`, `review_comment`, `review_asset_flag`, …) | N tables, painful "all links for asset X" unions, fragmented sync bucketing; each new relationship = a migration |
| Exclusive-arc (one nullable FK per target type + CHECK) | Table widens with every target type; and half the targets (JSONB node ids) can never be FKs anyway, so the FK benefit is already half-lost |
| Project linkage via quest or template node (no `project_id` on links) | Contributions can predate quests, and templates/library are shared across projects — neither path identifies the project |
| Node-level anchoring only for MVP (no text/audio ranges) | Highlight-to-comment and pause-to-comment are core to the contribution UX; version-pinning removes the fragility that motivated deferral |
| Offsets without the quoted text | The quote isn't redundancy — it's display-without-fetching, the re-anchoring key across versions, and a drift detector (W3C Web Annotation pattern) |

---

## 7. Knowledge piles up unorganized → the journal

Contributions anchored all over the library are findable *in context* but not *as a body of knowledge*. The team needs lists: the owner wants Key Terms and Discussions lists from day one; translators in the field realize they need a "Cultural notes" list — offline, immediately.

The trap to avoid: lists are **not** template structure. If lists lived in templates, field users would need offline template editing — the one problem that genuinely requires CRDT machinery, which we refuse to take on.

**So we add:** the **journal** — the union of a project's non-quest-bound contributions, organized by **lists**:

- A list is an asset (`content_type='journal'`) — so its name can be *recorded audio* in the community's own language.
- An entry is an asset (`content_type='journal_entry'`); membership is just a `member_of` link (ordered, playlist-style). Filing is optional and orthogonal to anchoring.
- Owner-predefined lists use the cookie-cutter pattern the app already uses for quests: the template *declares* list definitions; linking it to a project *instantiates* them as rows. User-created lists are the same rows, made offline. **Nobody ever edits a template in the field.**
- There are no content subtypes (`key_term`, `discussion`, …) — **the lists are the categories.**

*(Naming: the library is what the team reads; the journal is what the team writes.)*

| Considered | Rejected because |
|---|---|
| Tags / saved views only | No curation, no ordering, no identity — "the Discussion list" must be a nameable thing the owner predefines |
| A dedicated `project_list` table | A list's *name* needs multilingual text/audio payloads — that's `asset_content_link`, so a list wants to *be* an asset |
| Template-free "study quests" as containers (Option D) | Two parallel quest systems (kind discriminator, separate UI, undefined versioning semantics) for what bare assets + links already do; layerable later if download-units demand it |
| Lists declared only in templates | Field users need new lists offline, immediately; template declaration is just *one* way a list row gets created (cookie-cutter instantiation) |
| Auto-membership lists (rule-based, e.g. "all key_term assets") | Reified a query into a row; required content subtypes to match on; the simpler truth: lists are the categories, membership is explicit links, typed views aren't needed |
| Content subtypes (`discussion`/`rationale`/`key_term`/`media`) | Redundant once lists are the categories; an entry's kind = which list it's in |
| `content_type` values describing linkage (`anchor`, `member_of`) | Those describe *links*, which already exist as `link_role`; would make content_type mutable (filing flips it) and denormalize what links express |
| Team-scoped or per-asset ACL visibility | The rework loop requires content to cross roles; key terms must span pericopes; visibility == project sync bucket. Named additive path (`visibility` on `asset_link`) if a partner ever needs private deliberation |

---

## 8. The flagship journal use case → key terms

Translation teams must decide how to render critical terms ("covenant") and apply those decisions *consistently across the whole project* — the FIA content may never even mention the term.

**So we add** (almost nothing — the journal already does it): a template-declared **Key Terms list**. An entry's agreed rendering is its own content (text and/or audio). `applies_to` links surface a term wherever its passages appear; `references` links let translations cite the decision they followed. Entries are created offline in the field, like everything else.

This is the payoff of stages 6–7: a critical, partner-required feature lands as *zero new tables*.

| Considered | Rejected because |
|---|---|
| A dedicated `key_term` content type or table | The journal already provides identity, content, links, and offline creation; key terms differ from other entries only by *which list they're filed in* |
| Agreed rendering as a separate linked asset | The entry's own `asset_content_link` payloads already carry text/audio per language — a second asset adds a hop for nothing |
| Guaranteed-complete glossary lookup ("every term for this passage") | Works only for *filed* entries (`applies_to` links) — accepted as filing-dependent rather than building auto-classification machinery |

---

## 9. Now the actual review: submitting work → submission state & review records

With prep, assignments, and knowledge capture in place, a quest version is ready for review. We need to know *which* version is in the pipeline (only one per pericope at a time), *where* it is in the phases, and *what each group decided*.

**So we add:**
- `quest.submission_state` — draft → submitted → in_review → rework/approved_final, with a uniqueness constraint: one active version per pericope.
- `review_submission` — one review pass of one quest version through the phases.
- `review_decision` — one group's verdict at one phase. Separate from the submission because a phase can have several groups under a quorum rule — one submission, many decisions.

Feedback and rework markers need no new tables: a comment is an asset (`comment_on`/`reply_to` links — threads), and a rework flag is a `flag` link that blocks advancement while active. Even a decision's *reason* is a linked comment-asset, not a text column. Stage 6's investment keeps paying.

Two flows complete the picture:
- **Rework routes through a coordinator.** Rejection notifies the coordinator, who reviews the comments and flags and creates a rework `assignment` (stage 3 again) for a translator. When it's done, the coordinator resubmits — always restarting at phase 1, so every reviewer re-validates the changed work. Partial fixes lean on the **quest remixing** feature: compose a new submittable version from the good parts plus the fixed parts.
- **Notifications reuse the existing `notification` table** — new target types (`review_submission`, `review_decision`, `assignment`), no new mechanism. Submitted → first-phase groups; rejected → coordinator; rework assigned → translator; approved final → submitter and subscribers.

| Considered | Rejected because |
|---|---|
| Merge submission and decision into one record (Q9 review) | A phase can require *several* groups under a quorum rule — one submission must hold many decisions |
| Dedicated `review_comment` / `review_asset_flag` tables (original RFC) | Comments and flags are language contributions like any other — assets + links give threading, multilingual payloads, and anchoring for free |
| Resubmission resumes at the rejecting phase | Rework changes the work — earlier approvals no longer describe it; restart at phase 1 (template-configurable later if partners push back) |
| Quorum as percentage or absolute count | A fraction (`"2/3"`) is exact under integer group sizes and self-adjusts as membership changes |
| Drop `quest.submission_state` since `review_submission.status` exists | Both kept — they answer different questions (version lifecycle vs. pass-through-phases) and stage 10 makes them non-conflicting: both are projections of the same event log |

---

## 10. Who's allowed to change review state? → the event-sourced engine

Phase advancement involves guards (did the quorum approve? any open flags?), cascades (withdrawing at phase 2 invalidates phases 3+), and offline devices that might sync conflicting writes. If clients could write `submission_state` directly, two offline phones could disagree about reality.

**So we add:** the review engine — **clients append facts; the server decides.**

- `review_event` — an append-only log; the *source of truth*.
- The state columns (`submission_state`, `status`, `current_phase_id`) are **projections** — server-computed summaries, recomputed in the same transaction that appends each event. Clients never write them.
- One RPC per transition (`submit_quest`, `cast_decision`, `withdraw_decision`, …): validate actor → evaluate guards against the workflow JSONB → append event → recompute projections.
- The engine is a *generic interpreter* of the workflow template — a new review process is a new template, never new code.

Bonus: `submit_quest` snapshots the revision ids of the key terms the work relied on (**revision pinning**) — an approval can never silently drift against a later-edited glossary. And because state is a pure function of log + template, projections can be *rebuilt by replaying the log* — bug fixes and audits get determinism for free.

The accepted trade: **transition RPCs require connectivity.** Offline devices stage their intents locally (decisions, comments, flags), but state only advances when the server processes them — consistent with the conflict-avoidance posture everywhere else in the design.

| Considered | Rejected because |
|---|---|
| Clients write state columns directly, server reconciles | Two offline phones can disagree about reality; reconciliation after the fact is exactly the conflict problem we're avoiding |
| Flat FSM (status enum + trigger-enforced transitions) | Too weak for what the templates describe: nested states (in_review *contains* phase 2), parallel quorum decisions, guards, cascading invalidation |
| Hardcoded transition logic per process | Repeats the hardcoded-enum mistake; the engine must *interpret* the workflow JSONB so a new process is a new template, not a deploy |
| External workflow engine (Temporal, AWS Step Functions) | Massive operational dependency for transitions that are simple Postgres transactions; breaks the offline-first, Postgres-as-truth model |
| Event log without projections (compute state on read) | Sync and queries need plain columns to filter on; projections give both — log for truth, columns for speed |

---

## 11. "Prove what happened" → the audit trail (free)

Church-governed review demands accountability: who approved, when, why was it rejected, what did the translator change?

**So we add:** nothing. The event log from stage 10 *is* the audit trail — append-only, never edited, server-only. The website renders it as a timeline. One mechanism, two jobs: correctness and accountability.

| Considered | Rejected because |
|---|---|
| A separate `review_audit_log` written alongside state changes (original RFC framing) | Once events are the *source of truth* (stage 10), a second log is a copy that can drift; the same rows can't be wrong about what happened — they *caused* what happened |

---

## 12. The boogeyman we deliberately starved

Every field-user action in this design — contributions, key terms, lists, filings, completions, decisions, comments — is an **ordinary row**, which offline row-level sync already handles. Templates declare; rows are instantiated; users add rows.

The only thing that would ever require CRDTs (yjs/automerge) is concurrent offline editing of *shared template structure* — and the design never asks for it. If field-added structure is ever truly needed, the documented escape hatch is an additive extension-node table (rows again), still no CRDTs.

| Considered | Rejected because |
|---|---|
| CRDT layer (yjs/automerge) over template JSONB | Enormous complexity tax on every feature, to support an operation (concurrent offline structure editing) no user story actually requires |
| Offline template editing with merge-on-sync | Same conflict problem in different clothes; instead, templates are immutable once published and edited only on the website (fork-always) |
| List reordering as a structured merge | Overkill — `position` on the link row with last-write-wins is acceptable for ordering; worst case is a cosmetic order flip, never lost content |

---

## 13. Rollout posture

Everything is additive and opt-in: existing tables gain only `quest.submission_state` and new `content_type` values; projects without a workflow keep vote-based approval untouched; system templates (CBBT process, FIA library) ship as starting points; website configuration lands first, app surfaces second.

The division of labor is consistent throughout: **the app does the work** (record, contribute, mark steps done, submit, decide, flag — all offline-capable except state transitions), **the website configures and oversees** (build templates, map groups, create assignments, view the audit timeline).

| Considered | Rejected because |
|---|---|
| Migrate existing projects onto a default workflow | Open crowdsourcing projects work fine today; forcing a workflow adds risk and changes behavior nobody asked for — opt-in keeps the blast radius at zero |
| Build template editing in the app alongside the website | Editing is a connected, large-screen activity; app-side editing reopens the offline-structure-merge problem the whole design avoids |

---

## The chain, in one breath

> Partners need staged review → review processes differ, so **workflow templates** → templates need real people, so **groups** → people need to know their tasks, so **assignments** → coordinators need progress, so **assignment-anchored completion** → translators must prepare, so the **library** → preparation produces knowledge, so **asset_link** → knowledge needs organizing, so the **journal** → its flagship case, **key terms** → finished work enters **submissions & decisions** → state needs one owner, so the **event-sourced engine** → which gives the **audit trail** for free — all of it rows, never offline template editing.
