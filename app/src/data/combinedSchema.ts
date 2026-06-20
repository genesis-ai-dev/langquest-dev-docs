import type { FieldDef } from "../components/SchemaNode";
import type { DiagramNodeDef, DiagramEdgeDef } from "../components/DiagramShell";
import type { Step } from "../components/StepWalkthrough";

function F(name: string, o?: Partial<FieldDef>): FieldDef {
  return { name, ...o };
}

/** One color per system, reused by node tints and the page legend. */
export const SYSTEMS = {
  existing: { label: "Existing data spine", color: "var(--color-accent-purple)" },
  content: { label: "Content template system", color: "var(--color-accent-green)" },
  library: { label: "Library template system", color: "var(--color-accent-cyan)" },
  process: { label: "Process template system", color: "var(--color-accent-pink)" },
} as const;

const EXISTING = SYSTEMS.existing.color;
const CONTENT = SYSTEMS.content.color;
const LIBRARY = SYSTEMS.library.color;
const PROCESS = SYSTEMS.process.color;

export const NODES: DiagramNodeDef[] = [
  // ───────────────────────── Existing data spine (purple) ─────────────────────────
  {
    id: "n-project",
    title: "project",
    sub: "workspace",
    tint: EXISTING,
    x: -84,
    y: -123,
    w: 200,
    fields: [
      F("id", { pk: true }),
      F("name"),
      F("template_id", {
        fk: { node: "n-template", field: "id" },
        hint: "The project's single content template. Re-pointed on fork adoption — quest/asset node refs stay stable because they reach the template via project_id. (Collapsed from the former project_template_link.)",
      }),
      F("template_frozen", {
        hint: "Blocks re-pointing the content template. Set on legacy backfilled projects.",
      }),
      F("download_profiles", {
        hint: "This project's enabled download profiles (moved here from the former link table).",
      }),
      F("workflow_template_id", {
        fk: { node: "n-wf-template", field: "id" },
        hint: "The project's single review workflow (nullable — null = vote-based approval). Adoption mutates this pointer. (Collapsed from the former project_workflow_link.)",
      }),
      F("workflow_frozen", {
        hint: "Blocks re-pointing the workflow mid-review.",
      }),
      F("creator_id"),
      F("private"),
    ],
  },
  {
    id: "n-profile",
    title: "profile",
    sub: "user",
    tint: EXISTING,
    x: 251,
    y: -545,
    w: 180,
    fields: [F("id", { pk: true }), F("username")],
  },
  {
    id: "n-languoid",
    title: "languoid",
    sub: "language",
    tint: EXISTING,
    x: -103,
    y: 388,
    w: 180,
    fields: [F("id", { pk: true }), F("name")],
  },
  {
    id: "n-quest",
    title: "quest",
    sub: "version of work",
    tint: EXISTING,
    x: 230,
    y: -335,
    w: 240,
    fields: [
      F("id", { pk: true }),
      F("project_id", { fk: { node: "n-project", field: "id" } }),
      F("template_node_id", {
        hint: "Opaque node ID into template.structure (reach the template via project_id → project.template_id). Multiple quests sharing the same node = versions.",
      }),
      F("submission_state", {
        hint: "From the process system: draft | submitted | in_review | rework | withdrawn | approved_final. Server-computed projection of the review_event log.",
      }),
      F("name"),
    ],
  },
  {
    id: "n-asset",
    title: "asset",
    sub: "contribution",
    tint: EXISTING,
    x: 221,
    y: 195,
    w: 250,
    fields: [
      F("id", { pk: true }),
      F("project_id", { fk: { node: "n-project", field: "id" } }),
      F("template_node_id", {
        hint: "Content-template node this contribution is for (start of range if spanning); reach the template via project_id. Loose assets leave this null.",
      }),
      F("span_end_template_node_id", {
        hint: "If set, asset spans template_node_id through this node.",
      }),
      F("content_type", {
        hint: "Extended by the process system: source | translation | transcription + journal | journal_entry | comment.",
      }),
      F("source_asset_id", { fk: { node: "n-asset", field: "id" }, selfRef: true }),
    ],
  },
  {
    id: "n-qal",
    title: "quest_asset_link",
    sub: "M:N join",
    tint: EXISTING,
    x: 268,
    y: -12,
    w: 190,
    fields: [
      F("quest_id", { fk: { node: "n-quest", field: "id" } }),
      F("asset_id", { fk: { node: "n-asset", field: "id" } }),
      F("active"),
      F("visible"),
    ],
  },

  // ───────────────────────── Content template system (green) ─────────────────────────
  {
    id: "n-template",
    title: "template",
    sub: "content structure (JSONB)",
    tint: CONTENT,
    x: -1236,
    y: -329,
    w: 260,
    fields: [
      F("id", { pk: true }),
      F("slug"),
      F("name"),
      F("structure", {
        hint: "JSONB tree of TemplateNode objects (max depth 5). Node IDs are opaque nanoid(10). A full Bible is ~4MB minified — under PowerSync's 15MB row limit.",
      }),
      F("source_languoid_id", {
        fk: { node: "n-languoid", field: "id" },
        hint: "Language the template itself is written in (node names/labels) — not the content's source language.",
      }),
      F("copied_from_template_id", {
        fk: { node: "n-template", field: "id" },
        selfRef: true,
        hint: "Fork provenance — every publish creates a new immutable row.",
      }),
      F("auto_sync", { hint: "Dev-only. Standard templates synced globally to all devices." }),
      F("shared", { hint: "Discoverable/usable by other users." }),
      F("active"),
      F("creator_id"),
    ],
  },
  {
    id: "n-template-rev",
    title: "template_revision",
    sub: "audit only · server-only",
    tint: CONTENT,
    x: -735,
    y: -443,
    w: 230,
    fields: [
      F("id", { pk: true }),
      F("template_id", { fk: { node: "n-template", field: "id" } }),
      F("structure", { hint: "Full JSONB snapshot at this version." }),
      F("actions", { hint: "TemplateDiff: add/remove/rename/move/hide/unhide/property_change entries." }),
      F("saved_by"),
      F("saved_at"),
    ],
  },

  // ───────────────────────── Library template system (cyan) ─────────────────────────
  {
    id: "n-lib-template",
    title: "library_template",
    sub: "study material skeleton (JSONB)",
    tint: LIBRARY,
    x: -1217,
    y: 228,
    w: 260,
    fields: [
      F("id", { pk: true }),
      F("slug"),
      F("name"),
      F("structure", {
        hint: "JSONB skeleton only — tree + catalogs (glossary/media/maps) + refs + alignment. Never contains prose; content lives in library_content rows.",
      }),
      F("source_languoid_id", {
        fk: { node: "n-languoid", field: "id" },
        hint: "Language the template's node labels are written in. Translated names are content rows.",
      }),
      F("copied_from_template_id", {
        fk: { node: "n-lib-template", field: "id" },
        selfRef: true,
        hint: "Fork provenance — same fork-always model as the other two systems.",
      }),
      F("auto_sync"),
      F("shared"),
      F("active"),
      F("creator_id", { hint: "Null = system/adapter-published (e.g. the FIA adapter)." }),
    ],
  },
  {
    id: "n-pll",
    title: "project_library_link",
    sub: "M:N junction",
    tint: LIBRARY,
    x: -784,
    y: -95,
    w: 230,
    fields: [
      F("id", { pk: true }),
      F("project_id", {
        fk: { node: "n-project", field: "id" },
        hint: "Not unique — a project can use several libraries, and a library can serve many projects. A genuine many-to-many junction (unlike content/workflow, which collapsed onto project).",
      }),
      F("library_template_id", { fk: { node: "n-lib-template", field: "id" } }),
      F("frozen"),
      F("active"),
      F("created_at"),
    ],
  },
  {
    id: "n-lib-rev",
    title: "library_template_revision",
    sub: "audit only · server-only",
    tint: LIBRARY,
    x: -786,
    y: 155,
    w: 230,
    fields: [
      F("id", { pk: true }),
      F("library_template_id", { fk: { node: "n-lib-template", field: "id" } }),
      F("structure"),
      F("actions"),
      F("saved_by"),
      F("saved_at"),
    ],
  },
  {
    id: "n-lib-content",
    title: "library_content",
    sub: "rendering per node × languoid × version",
    tint: LIBRARY,
    x: -820,
    y: 560,
    w: 270,
    fields: [
      F("id", { pk: true }),
      F("library_template_id", {
        fk: { node: "n-lib-template", field: "id" },
        hint: "The fork this row was published under.",
      }),
      F("node_id", {
        hint: "Opaque string ID into the structure JSONB (tree node or catalog item). App-validated — no FK possible.",
      }),
      F("languoid_id", { fk: { node: "n-languoid", field: "id" } }),
      F("version", {
        hint: "Monotonic per (node × languoid). Rows are immutable — superseding = inserting version + 1. UNIQUE(node_id, languoid_id, version).",
      }),
      F("title", { hint: "Localized node name, e.g. \u201c聆听并铭记于心\u201d." }),
      F("body", {
        hint: "Canonical block format JSONB: paragraph, heading, list, callout, action; inline node-ref for glossary/media/map references.",
      }),
      F("body_plain", { hint: "Derived plain text — the surface text anchors (offsets + exact quote) are measured against." }),
      F("attachments", { hint: "[{kind: audio|image|pdf, variant, url, bytes}] — variant selection is a download-profile decision." }),
      F("metadata", { hint: "Upstream version info, e.g. {fia: {vId: \"v2.1\"}}." }),
      F("published_at"),
    ],
  },

  // ───────────────────────── Process template system (pink) ─────────────────────────
  {
    id: "n-wf-template",
    title: "workflow_template",
    sub: "review phases (JSONB)",
    tint: PROCESS,
    x: 2086,
    y: -386,
    w: 250,
    fields: [
      F("id", { pk: true }),
      F("slug"),
      F("name"),
      F("structure", {
        hint: "JSONB: ordered phases, each with group_slots and a signoff_rule (any_one | unanimous | quorum). Preparation steps live in the library template, not here.",
      }),
      F("copied_from_template_id", {
        fk: { node: "n-wf-template", field: "id" },
        selfRef: true,
      }),
      F("shared"),
      F("active"),
      F("creator_id", { hint: "Null = system-provided (e.g. the ETEN CBBT template)." }),
    ],
  },
  {
    id: "n-wf-rev",
    title: "workflow_template_revision",
    sub: "audit only · server-only",
    tint: PROCESS,
    x: 2087,
    y: -629,
    w: 230,
    fields: [
      F("id", { pk: true }),
      F("workflow_template_id", { fk: { node: "n-wf-template", field: "id" } }),
      F("structure"),
      F("actions"),
      F("saved_by"),
      F("saved_at"),
    ],
  },
  {
    id: "n-ppg",
    title: "project_phase_group",
    sub: "slot → real group mapping",
    tint: PROCESS,
    x: 1678,
    y: -483,
    w: 230,
    fields: [
      F("id", { pk: true }),
      F("project_id", { fk: { node: "n-project", field: "id" } }),
      F("phase_id", { hint: "Opaque string ID into workflow_template.structure.phases[]." }),
      F("group_slot_id", { hint: "Opaque string ID into the phase's group_slots[]." }),
      F("group_id", { fk: { node: "n-group", field: "id" } }),
    ],
  },
  {
    id: "n-group",
    title: "project_group",
    sub: "first-class team",
    tint: PROCESS,
    x: 1369,
    y: -481,
    w: 210,
    fields: [
      F("id", { pk: true }),
      F("project_id", { fk: { node: "n-project", field: "id" } }),
      F("name"),
      F("role_type", { hint: "translator | reviewer | coordinator." }),
      F("active"),
    ],
  },
  {
    id: "n-group-member",
    title: "project_group_member",
    sub: "membership",
    tint: PROCESS,
    x: 1064,
    y: -604,
    w: 210,
    fields: [
      F("id", { pk: true }),
      F("group_id", { fk: { node: "n-group", field: "id" } }),
      F("profile_id", { fk: { node: "n-profile", field: "id" } }),
      F("active"),
    ],
  },
  {
    id: "n-assignment",
    title: "assignment",
    sub: "drives every stage",
    tint: PROCESS,
    x: 1508,
    y: 24,
    w: 250,
    fields: [
      F("id", { pk: true }),
      F("project_id", { fk: { node: "n-project", field: "id" } }),
      F("target_type", {
        hint: "quest | asset | template node (content, library, or process) — polymorphic, app-validated.",
      }),
      F("target_id", { hint: "UUID or opaque node ID string, per target_type. Can indicate a range of nodes." }),
      F("assignee_type", { hint: "profile | group." }),
      F("assignee_id"),
      F("assignment_type", { hint: "translation | rework | review | approve." }),
      F("status", { hint: "pending | in_progress | completed | cancelled." }),
      F("completion_rule", {
        hint: "Multi-assignee merge: any (default) or all. Objective view computed at query time.",
      }),
      F("assigner"),
      F("notes"),
    ],
  },
  {
    id: "n-aic",
    title: "assignment_item_completion",
    sub: "per-node checkmarks",
    tint: PROCESS,
    x: 1856,
    y: 24,
    w: 230,
    fields: [
      F("assignment_id", { fk: { node: "n-assignment", field: "id" } }),
      F("node_id", {
        hint: "The completed node within a range/multi-node assignment. Completability is implied by the assignment targeting it — no separate flag.",
      }),
      F("completed_at"),
    ],
  },
  {
    id: "n-asset-link",
    title: "asset_link",
    sub: "polymorphic linking",
    tint: PROCESS,
    x: 1079,
    y: 165,
    w: 250,
    fields: [
      F("id", { pk: true }),
      F("asset_id", { fk: { node: "n-asset", field: "id" } }),
      F("target_type", {
        hint: "quest | asset | template_node | study_material_node (library) | review_decision | review_submission.",
      }),
      F("target_id", { hint: "UUID or opaque node ID string — app-validated, no FK." }),
      F("link_role", {
        hint: "anchor | comment_on | reply_to | revision_of | flag | references | applies_to | member_of.",
      }),
      F("project_id", {
        fk: { node: "n-project", field: "id" },
        hint: "Denormalized — drives RLS/sync bucketing since half the targets are JSONB node IDs with no FK path.",
      }),
      F("anchor_data", {
        hint: "Text offsets + exact quote (W3C quote selector) and/or audio timestamps, pinned to an immutable library_content version.",
      }),
      F("order_index"),
      F("active"),
    ],
  },
  {
    id: "n-submission",
    title: "review_submission",
    sub: "one review pass",
    tint: PROCESS,
    x: 1320,
    y: -999,
    w: 240,
    fields: [
      F("id", { pk: true }),
      F("quest_id", { fk: { node: "n-quest", field: "id" } }),
      F("project_id", { fk: { node: "n-project", field: "id" } }),
      F("current_phase_id", {
        hint: "Opaque string ID into the workflow JSONB. Server-computed projection — never client-written.",
      }),
      F("status", { hint: "pending | in_review | rework | completed | withdrawn. Projection of review_event." }),
      F("submitted_by"),
      F("submitted_at"),
    ],
  },
  {
    id: "n-decision",
    title: "review_decision",
    sub: "one group's verdict at one phase",
    tint: PROCESS,
    x: 1675,
    y: -1043,
    w: 230,
    fields: [
      F("id", { pk: true }),
      F("submission_id", { fk: { node: "n-submission", field: "id" } }),
      F("phase_id", { hint: "String ID into the workflow JSONB." }),
      F("group_slot_id"),
      F("group_id", { fk: { node: "n-group", field: "id" } }),
      F("decision", { hint: "approved | rejected | withdrawn. Free-text reason = a linked comment-asset, not a column." }),
      F("decided_by"),
      F("decided_at"),
      F("active"),
    ],
  },
  {
    id: "n-event",
    title: "review_event",
    sub: "event log · server-only",
    tint: PROCESS,
    x: 1024,
    y: -1229,
    w: 230,
    fields: [
      F("id", { pk: true }),
      F("event_type", {
        hint: "submitted, approved, rejected, withdrawn, cascade_invalidated, phase_advanced, workflow_completed, …",
      }),
      F("actor"),
      F("target_type"),
      F("target_id"),
      F("payload", { hint: "JSON. E.g. submit-time revision pinning of key-term entries." }),
      F("project_id", { fk: { node: "n-project", field: "id" } }),
      F("created_at", {
        hint: "Append-only, never synced. Source of truth — state columns elsewhere are projections recomputed from this log.",
      }),
    ],
  },
];

export const EDGES: DiagramEdgeDef[] = [
  // Existing spine
  { from: "n-quest", fromField: "project_id", to: "n-project", toField: "id", midX: 183 },
  { from: "n-asset", fromField: "project_id", to: "n-project", toField: "id", midX: 183 },
  { from: "n-qal", fromField: "quest_id", to: "n-quest", toField: "id", midX: 532 },
  { from: "n-qal", fromField: "asset_id", to: "n-asset", toField: "id", midX: 531 },

  // Content template system
  { from: "n-project", fromField: "template_id", to: "n-template", toField: "id" },
  { from: "n-template", fromField: "source_languoid_id", to: "n-languoid", toField: "id", midX: -428 },
  { from: "n-template-rev", fromField: "template_id", to: "n-template", toField: "id", dash: true },
  // String refs into the content structure JSONB (reached via project.template_id)
  { from: "n-quest", fromField: "template_node_id", to: "n-template", toField: "structure", dash: true },
  { from: "n-asset", fromField: "template_node_id", to: "n-template", toField: "structure", dash: true },

  // Library template system
  { from: "n-pll", fromField: "project_id", to: "n-project", toField: "id" },
  { from: "n-pll", fromField: "library_template_id", to: "n-lib-template", toField: "id" },
  { from: "n-lib-template", fromField: "source_languoid_id", to: "n-languoid", toField: "id" },
  { from: "n-lib-rev", fromField: "library_template_id", to: "n-lib-template", toField: "id", dash: true },
  { from: "n-lib-content", fromField: "library_template_id", to: "n-lib-template", toField: "id" },
  { from: "n-lib-content", fromField: "languoid_id", to: "n-languoid", toField: "id", midX: -424 },
  // String ref into the library structure JSONB
  { from: "n-lib-content", fromField: "node_id", to: "n-lib-template", toField: "structure", dash: true },

  // Process template system
  { from: "n-project", fromField: "workflow_template_id", to: "n-wf-template", toField: "id" },
  { from: "n-wf-rev", fromField: "workflow_template_id", to: "n-wf-template", toField: "id", dash: true, midX: 2067 },
  { from: "n-ppg", fromField: "project_id", to: "n-project", toField: "id" },
  { from: "n-ppg", fromField: "group_id", to: "n-group", toField: "id", midX: 1623 },
  // String refs into the workflow structure JSONB
  { from: "n-ppg", fromField: "phase_id", to: "n-wf-template", toField: "structure", dash: true, midX: 2008 },
  { from: "n-group", fromField: "project_id", to: "n-project", toField: "id", midX: 676 },
  { from: "n-group-member", fromField: "group_id", to: "n-group", toField: "id" },
  { from: "n-group-member", fromField: "profile_id", to: "n-profile", toField: "id" },
  { from: "n-assignment", fromField: "project_id", to: "n-project", toField: "id" },
  { from: "n-aic", fromField: "assignment_id", to: "n-assignment", toField: "id" },
  { from: "n-asset-link", fromField: "asset_id", to: "n-asset", toField: "id" },
  { from: "n-asset-link", fromField: "project_id", to: "n-project", toField: "id", midX: 671 },
  // Cross-system: anchors target library content / structure nodes
  { from: "n-asset-link", fromField: "target_id", to: "n-lib-content", toField: "id", dash: true },
  { from: "n-submission", fromField: "quest_id", to: "n-quest", toField: "id", midX: 978 },
  { from: "n-submission", fromField: "project_id", to: "n-project", toField: "id", midX: 1589 },
  { from: "n-decision", fromField: "submission_id", to: "n-submission", toField: "id" },
  { from: "n-decision", fromField: "group_id", to: "n-group", toField: "id", midX: 1637 },
  { from: "n-event", fromField: "project_id", to: "n-project", toField: "id", dash: true, midX: 181 },
];

export const STEPS: Step[] = [
  {
    title: "Three template systems, one data spine",
    description:
      "All three template systems follow the same architecture: a single JSONB <code>structure</code> blob per template row, fork-always immutable publishing, and website-only editing. They attach to a project differently: <b style=\"color:var(--color-accent-green)\">content</b> and <b style=\"color:var(--color-accent-pink)\">workflow</b> are a single FK column on <code>project</code> (one per project), while the <b style=\"color:var(--color-accent-cyan)\">library</b> uses a many-to-many junction. They differ in <em>what they declare</em>: the content template declares what gets translated, the library template declares what the team reads to prepare, and the process template declares how finished work is validated. <em>Dashed edges</em> are application-validated string references (opaque node IDs into JSONB) — no FK possible.",
  },
  {
    title: "Existing data spine",
    description:
      "The tables every system hangs off: <code>project</code> is the workspace and the sync-bucketing unit; <code>quest</code> and <code>asset</code> carry the actual work. The template systems add columns here rather than replacing anything — <code>project.template_id</code> / <code>template_frozen</code> / <code>workflow_template_id</code> / <code>workflow_frozen</code> / <code>download_profiles</code> (the content and workflow link tables, collapsed onto <code>project</code>), plus <code>quest.template_node_id</code>, <code>asset.span_end_template_node_id</code>, <code>quest.submission_state</code>, and new <code>asset.content_type</code> values.",
    highlightNodes: ["n-project", "n-quest", "n-asset", "n-qal", "n-profile", "n-languoid"],
  },
  {
    title: "Content template system",
    description:
      "Declares <em>what gets translated</em>: a JSONB tree (Bible books → chapters → verses, FIA pericopes, …) with opaque nanoid(10) node IDs. Each project points at one template via <code>project.template_id</code>; quests and assets reference nodes by opaque ID and reach the template through their project — so forking a template and re-pointing <code>project.template_id</code> never breaks references. Multiple bodies of content compose as subtrees of the single template. The materialized layer is user-created quests and assets.",
    highlightNodes: ["n-template", "n-template-rev", "n-project", "n-quest", "n-asset"],
  },
  {
    title: "Library template system",
    description:
      "Declares <em>what the team reads to prepare</em> (FIA study steps, glossary terms, media, maps). The big split: <code>library_template.structure</code> holds only the skeleton — tree + catalogs + refs + alignment, never prose — while <code>library_content</code> holds one immutable row per (node × languoid × version) with the canonical block-format body, plain-text shadow, and attachments. Devices sync only the rows for their project's languages. Adapters (FIA first) publish both structure forks and content rows; a new partner = a new adapter, never new schema.",
    highlightNodes: ["n-lib-template", "n-pll", "n-lib-rev", "n-lib-content", "n-project", "n-languoid"],
  },
  {
    title: "Process template system",
    description:
      "Declares <em>how finished work is validated</em>: ordered review phases with group slots and signoff rules in <code>workflow_template.structure</code>. <code>project_phase_group</code> maps abstract slots to real <code>project_group</code> teams. A submitted quest gets a <code>review_submission</code>; each group's verdict is a <code>review_decision</code>. State columns are projections — the append-only, server-only <code>review_event</code> log is the source of truth, and a template-driven reducer recomputes projections inside transition RPCs.",
    highlightNodes: [
      "n-wf-template", "n-wf-rev", "n-ppg", "n-group", "n-group-member",
      "n-submission", "n-decision", "n-event", "n-project", "n-quest", "n-profile",
    ],
  },
  {
    title: "Work layer: assignments & completion",
    description:
      "<code>assignment</code> drives every stage — translation, rework, review, approval — and can target a quest, an asset, or a node in <em>any</em> of the three templates (polymorphic <code>target_type</code>/<code>target_id</code>). Completability is implied by an assignment targeting a node; per-node completion lands in <code>assignment_item_completion</code>, and objective passage progress is rolled up at query time using each assignment's <code>completion_rule</code> (any | all).",
    highlightNodes: ["n-assignment", "n-aic", "n-project", "n-quest", "n-asset"],
  },
  {
    title: "The glue: asset_link",
    description:
      "One polymorphic table connects contributions to everything: <code>anchor</code> links pin a journal entry to a library node — with <code>anchor_data</code> holding text offsets + exact quote against an immutable <code>library_content</code> version — while <code>comment_on</code>/<code>reply_to</code>/<code>flag</code> serve review, <code>member_of</code> files entries into journal lists, and <code>applies_to</code>/<code>references</code> wire up key terms. <code>project_id</code> is denormalized onto every row for RLS/sync bucketing, since half the targets are JSONB node IDs with no FK path.",
    highlightNodes: ["n-asset-link", "n-asset", "n-lib-content", "n-submission", "n-decision", "n-project"],
  },
  {
    title: "Cross-system links",
    description:
      "How the three systems meet: library nodes carry <code>alignment</code> metadata (e.g. <code>{scheme: \"bible\", start, end}</code>) that resolves to content-template node ranges — \u201cthis pericope = Gen 2:4–25\u201d. Contributions anchor to library nodes/rows via <code>asset_link</code>. Assignments target content <em>and</em> library nodes. And the content template declares which nodes are <code>reviewable</code> — only those enter the process system's workflow.",
    highlightNodes: [
      "n-template", "n-lib-template", "n-wf-template",
      "n-asset-link", "n-assignment", "n-lib-content",
    ],
  },
];
