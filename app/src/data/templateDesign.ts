import type { FieldDef } from "../components/SchemaNode";
import type { DiagramNodeDef, DiagramEdgeDef } from "../components/DiagramShell";
import type { Step } from "../components/StepWalkthrough";

function F(name: string, o?: Partial<FieldDef>): FieldDef {
  return { name, ...o };
}

const DIA_TEMPLATE_TREE = `<div class="font-mono text-[.6rem] leading-[1.9] text-txt-muted mt-1.5">
<b class="text-accent-green">template.structure (Bible example)</b><br/>
&nbsp;&nbsp;<b class="text-accent-pink">📖 root</b> <span class="text-txt-dim text-[.5rem]">id=root · node_type=root</span><br/>
&nbsp;&nbsp;&nbsp;&nbsp;└ <b class="text-accent-green">Luke</b> <span class="text-txt-dim text-[.5rem]">id=x7kQ3mP9nR · node_type=book · linkable_type=quest</span><br/>
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;├ <b class="text-accent-green">Chapter 1</b> <span class="text-txt-dim text-[.5rem]">id=Rj2wLp8vKe · node_type=chapter · linkable_type=quest · <b class="text-accent-amber">is_download_unit</b></span><br/>
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;│&nbsp;&nbsp;├ <span class="text-accent-cyan">1:1</span> <span class="text-txt-dim text-[.5rem]">id=mN4tYq6hXa · linkable_type=asset · allows_spanning</span><br/>
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;│&nbsp;&nbsp;├ <span class="text-accent-cyan">1:2</span> <span class="text-txt-dim text-[.5rem]">id=bF9cWs3dZv · linkable_type=asset</span><br/>
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;│&nbsp;&nbsp;└ <span class="text-accent-cyan">1:3</span> <span class="text-txt-dim text-[.5rem]">id=pL7eUn2gTk · linkable_type=asset</span><br/>
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;└ <b class="text-accent-green">Chapter 2</b> <span class="text-txt-dim text-[.5rem]">id=hD5aVm1fQw · node_type=chapter · <b class="text-accent-amber">is_download_unit</b></span><br/>
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;└ <span class="text-accent-cyan">2:1</span> <span class="text-txt-dim text-[.5rem]">id=cJ8rXo4iSy · linkable_type=asset</span><br/>
<span class="text-txt-dim text-[.5rem]">Hierarchy, order, depth are intrinsic to JSON nesting. Node IDs are opaque nanoid(10).</span></div>`;

const DIA_VERSIONS = `<div class="font-mono text-[.6rem] leading-[1.9] text-txt-muted mt-1.5">
<b class="text-accent-purple">quest versions of Chapter 1</b><br/>
&nbsp;&nbsp;├ <span class="text-accent-purple">quest q-A</span> <span class="text-txt-dim text-[.5rem]">template_node_id → "Rj2wLp8vKe" · creator=Ana</span><br/>
&nbsp;&nbsp;└ <span class="text-accent-purple">quest q-B</span> <span class="text-txt-dim text-[.5rem]">template_node_id → "Rj2wLp8vKe" · creator=Ben</span><br/>
<span class="text-txt-dim text-[.5rem] ml-4">Both quests reference the same template node → they are versions.</span></div>`;

const DIA_SPANNING = `<div class="font-mono text-[.6rem] leading-[1.9] text-txt-muted mt-1.5">
<b class="text-accent-amber">Ana's assets</b> (version q-A — each verse separate)<br/>
&nbsp;&nbsp;├ <span class="text-accent-amber">a-1</span> template_node_id→<span class="text-accent-cyan">mN4tYq6hXa</span> · span_end=<span class="text-txt-dim">null</span> <span class="text-accent-green text-[.5rem]">← dedicated</span><br/>
&nbsp;&nbsp;├ <span class="text-accent-amber">a-2</span> template_node_id→<span class="text-accent-cyan">bF9cWs3dZv</span> · span_end=<span class="text-txt-dim">null</span> <span class="text-accent-green text-[.5rem]">← dedicated</span><br/>
&nbsp;&nbsp;└ <span class="text-accent-amber">a-3</span> template_node_id→<span class="text-accent-cyan">pL7eUn2gTk</span> · span_end=<span class="text-txt-dim">null</span> <span class="text-accent-green text-[.5rem]">← dedicated</span><br/>
<b class="text-accent-amber">Ben's assets</b> (version q-B — combined 1:1–2)<br/>
&nbsp;&nbsp;├ <span class="text-accent-amber">a-4</span> template_node_id→<span class="text-accent-cyan">mN4tYq6hXa</span> · span_end→<span class="text-accent-cyan">bF9cWs3dZv</span> <span class="text-accent-pink text-[.5rem]">← SPANNING</span><br/>
&nbsp;&nbsp;└ <span class="text-accent-amber">a-5</span> template_node_id→<span class="text-accent-cyan">pL7eUn2gTk</span> · span_end=<span class="text-txt-dim">null</span> <span class="text-accent-green text-[.5rem]">← dedicated</span></div>`;

export const NODES: DiagramNodeDef[] = [
  {
    id: "n-template",
    title: "template",
    sub: "JSONB structure tree (NEW)",
    x: 122,
    y: 329,
    w: 300,
    fields: [
      F("id", { pk: true }),
      F("slug", {
        hint: "Unique human-readable slug for standard templates. e.g. 'protestant-bible-v2-frozen'.",
      }),
      F("name"),
      F("icon"),
      F("structure", {
        hint: "JSONB tree of TemplateNode objects. Contains the full template hierarchy: node IDs, names, types, children. Node IDs are opaque nanoid(10).",
      }),
      F("source_languoid_id", {
        fk: { node: "n-languoid", field: "id" },
        hint: "Languoid this template is designed for. Standard templates exist per-languoid.",
      }),
      F("copied_from_template_id", {
        fk: { node: "n-template", field: "id" },
        selfRef: true,
        hint: "Fork provenance. Points to the template this was cloned from.",
      }),
      F("auto_sync", {
        hint: "If true, template syncs globally via PowerSync (standard templates). Dev-only, not user-editable.",
      }),
      F("shared", {
        hint: "Whether other users can see and fork this template.",
      }),
      F("description", {
        hint: "Optional description for the template.",
      }),
      F("project_count", {
        hint: "Maintained by trigger on project_template_link. Used for popularity sorting.",
      }),
      F("creator_id"),
    ],
  },
  {
    id: "n-pbl",
    title: "project_template_link",
    sub: "links project to template (NEW)",
    x: -100,
    y: 329,
    w: 220,
    fields: [
      F("id", { pk: true }),
      F("project_id", { fk: { node: "n-project", field: "id" } }),
      F("template_id", { fk: { node: "n-template", field: "id" } }),
      F("role", {
        hint: "Optional label like 'primary'. A project can link to multiple templates.",
      }),
      F("active"),
      F("frozen", {
        hint: "If true, this link cannot be re-pointed to a new template. Set on legacy backfilled projects.",
      }),
      F("download_profiles"),
    ],
  },
  {
    id: "n-revision",
    title: "template_revision",
    sub: "audit history (NEW, server-only)",
    x: 122,
    y: 600,
    w: 250,
    fields: [
      F("id", { pk: true }),
      F("template_id", { fk: { node: "n-template", field: "id" } }),
      F("structure", { hint: "Snapshot of the full JSONB structure at this version." }),
      F("actions", { hint: "Structured diff (nodes added/removed/renamed/moved) computed at publish time." }),
      F("saved_by"),
      F("saved_at"),
    ],
  },
  {
    id: "n-project",
    title: "project",
    sub: "workspace (unchanged)",
    x: -224,
    y: -11,
    w: 200,
    fields: [
      F("id", { pk: true }),
      F("name"),
      F("template", {
        hint: "Legacy enum: unstructured | bible | fia. Vestigial once template links are adopted.",
      }),
      F("creator_id"),
      F("private"),
    ],
  },
  {
    id: "n-quest",
    title: "quest",
    sub: "version of work (add 2 cols)",
    x: 817,
    y: 106,
    w: 250,
    fields: [
      F("id", { pk: true }),
      F("project_id", { fk: { node: "n-project", field: "id" } }),
      F("template_link_id", {
        fk: { node: "n-pbl", field: "id" },
        hint: "NEW — FK to project_template_link. Identifies which template tree this quest belongs to.",
      }),
      F("template_node_id", {
        hint: "NEW — Opaque node ID within the template structure. Multiple quests sharing the same node = versions.",
      }),
      F("parent_id", {
        fk: { node: "n-quest", field: "id" },
        selfRef: true,
        hint: "Retained for unstructured/legacy projects.",
      }),
      F("name"),
      F("creator_id"),
      F("metadata", {
        hint: "Legacy JSON (bible/fia positioning). Redundant once template_node_id is set.",
      }),
      F("download_profiles"),
    ],
  },
  {
    id: "n-qal",
    title: "quest_asset_link",
    sub: "M:N join (unchanged)",
    x: 1241,
    y: 272,
    w: 200,
    fields: [
      F("quest_id", { fk: { node: "n-quest", field: "id" } }),
      F("asset_id", { fk: { node: "n-asset", field: "id" } }),
      F("active"),
      F("visible"),
    ],
  },
  {
    id: "n-asset",
    title: "asset",
    sub: "contribution (add 3 cols)",
    x: 820,
    y: 389,
    w: 270,
    fields: [
      F("id", { pk: true }),
      F("project_id", { fk: { node: "n-project", field: "id" } }),
      F("template_link_id", {
        fk: { node: "n-pbl", field: "id" },
        hint: "NEW — FK to project_template_link.",
      }),
      F("template_node_id", {
        hint: "NEW — What template node this contribution is for. The 'start' of the range if spanning.",
      }),
      F("span_end_template_node_id", {
        hint: "NEW — If set, asset spans from template_node_id through this node. If null, single-node contribution.",
      }),
      F("content_type", {
        hint: "'source', 'translation', or 'transcription'.",
      }),
      F("source_asset_id", {
        fk: { node: "n-asset", field: "id" },
        selfRef: true,
      }),
      F("order_index"),
      F("metadata"),
      F("download_profiles"),
    ],
  },
];

export const EDGES: DiagramEdgeDef[] = [
  { from: "n-pbl", fromField: "project_id", to: "n-project", toField: "id" },
  { from: "n-pbl", fromField: "template_id", to: "n-template", toField: "id" },
  { from: "n-revision", fromField: "template_id", to: "n-template", toField: "id", dash: true },
  { from: "n-quest", fromField: "project_id", to: "n-project", toField: "id" },
  { from: "n-quest", fromField: "template_link_id", to: "n-pbl", toField: "id", dash: true },
  { from: "n-qal", fromField: "quest_id", to: "n-quest", toField: "id" },
  { from: "n-qal", fromField: "asset_id", to: "n-asset", toField: "id" },
  { from: "n-asset", fromField: "project_id", to: "n-project", toField: "id" },
  { from: "n-asset", fromField: "template_link_id", to: "n-pbl", toField: "id", dash: true },
];

export const SHARING_STEP_INDEX = 8;

export const STEPS: Step[] = [
  {
    title: "Template-only template system — overview",
    description:
      'A <strong>template</strong> table stores the full template structure as JSONB. Projects link to templates via <strong>project_template_link</strong>. Quests and assets reference template nodes by opaque ID. Editing uses a fork-based model: drafts are local in IndexedDB, and publishing always creates a new template row. The mobile app reads plain JSONB snapshots. <em>Dashed edges</em> are the new FK relationships.',
    highlightNodes: ["n-template", "n-pbl", "n-project", "n-quest", "n-qal", "n-asset", "n-revision"],
  },
  {
    title: "template — structure as JSONB",
    description:
      'Each template stores a full tree in <code>structure</code> (JSONB). Node IDs are opaque <code>nanoid(10)</code>. Hierarchy, order, and depth are intrinsic to JSON nesting — no separate parent_id or order_key columns needed. Once published, a template row is immutable — edits always produce a new fork.' +
      DIA_TEMPLATE_TREE,
    highlightNodes: ["n-template"],
  },
  {
    title: "Fork-based editing lifecycle",
    description:
      'Template editing has two modes: <strong>starting from scratch</strong> (new blank template) or <strong>updating an existing template</strong> (fork the current version). In both cases, drafts live in browser IndexedDB with full undo/redo. No locks are needed — each editor works on their own local copy. Publishing always creates a new template row. There is no concurrent-write problem because published rows are immutable.',
    highlightNodes: ["n-template"],
  },
  {
    title: "Hard delete vs hidden nodes",
    description:
      'Users simply delete nodes in the editor — all deletions set <code>deleted: true</code> on the node in the draft. At <strong>publish time</strong>, the system decides what to do: for forks applied to <strong>existing projects</strong>, tombstones (<code>deleted: true</code>) are preserved so existing quests/assets keep valid node references. For forks applied to <strong>new projects</strong> or made generally available, tombstones are stripped entirely. The editor surfaces deleted nodes as greyed-out entries that can be restored.',
    highlightNodes: ["n-template"],
  },
  {
    title: "Publishing a fork",
    description:
      'When a user publishes, the system: <strong>1.</strong> Inserts a new <code>template</code> row with the edited structure and <code>copied_from_template_id</code> pointing to the source. <strong>2.</strong> Updates the project\'s <code>project_template_link.template_id</code> to point to the new row. <strong>3.</strong> Creates a <code>template_revision</code> snapshot. Quest and asset references remain stable because they point to the link, not the template directly. The <code>copied_from_template_id</code> chain provides full provenance.',
    highlightNodes: ["n-template", "n-pbl", "n-revision"],
  },
  {
    title: "Quest versioning via template_node_id",
    description:
      'Quests gain two new nullable columns: <code>template_link_id</code> (FK to project_template_link) and <code>template_node_id</code> (opaque node ID). Two quests pointing to the same template node are <strong>versions</strong> of that structural unit.' +
      DIA_VERSIONS,
    highlightNodes: ["n-quest", "n-pbl"],
  },
  {
    title: "Asset contributions & verse spanning",
    description:
      'Assets gain <code>template_node_id</code> (start node) and <code>span_end_template_node_id</code> (range endpoint). Null span = <strong>dedicated</strong> contribution. Set span = <strong>spanning</strong> across a range.' +
      DIA_SPANNING,
    highlightNodes: ["n-asset", "n-pbl"],
  },
  {
    title: "project_template_link — stable identity",
    description:
      'The link table has its own UUID PK. Quests and assets reference this stable ID via <code>template_link_id</code>. When a template is forked, the link\'s <code>template_id</code> is re-pointed to the new template — quest/asset references remain stable. A project can link to multiple templates simultaneously.',
    highlightNodes: ["n-pbl", "n-project", "n-template"],
  },
  {
    title: "Sharing & forking templates",
    description:
      'Forking is the core editing mechanism, not just a sharing convenience. Every edit — whether updating your own template or adapting someone else\'s — produces a fork. Templates with <code>shared = true</code> are visible to all users for forking. <code>copied_from_template_id</code> records provenance. <code>auto_sync = true</code> makes standard templates (Bible, FIA) sync globally via PowerSync.' +
      `<div class="font-mono text-[.6rem] leading-[1.9] text-txt-muted mt-1.5">
<b class="text-accent-green">1.</b> Standard <b class="text-accent-pink">"Protestant Bible"</b> template exists <span class="text-txt-dim text-[.5rem]">auto_sync=true, shared=true</span><br/>
<b class="text-accent-green">2.</b> Ben forks it for his Yoruba project<br/>
&nbsp;&nbsp;&nbsp;→ new template <b class="text-accent-purple">"Protestant Bible (fork)"</b> <span class="text-txt-dim text-[.5rem]">copied_from_template_id → original</span><br/>
<b class="text-accent-green">3.</b> Ben edits locally in IndexedDB, then publishes<br/>
&nbsp;&nbsp;&nbsp;→ another new template row, link re-pointed<br/>
<b class="text-accent-green">4.</b> Ben sets shared=true, renames to <b class="text-accent-purple">"Yoruba Protestant Bible"</b></div>`,
    highlightNodes: ["n-template"],
  },
  {
    title: "template_revision — audit history",
    description:
      'Each published fork creates a <code>template_revision</code> row storing the full JSONB snapshot and optional action log. Since every publish produces a new template row, each revision is tied 1:1 to a specific template. Server-only (not synced to clients via PowerSync). Provides audit trail but no rollback — reverting would orphan linked contributions.',
    highlightNodes: ["n-revision", "n-template"],
  },
  {
    title: "Backward compatibility",
    description:
      'All new columns are <strong>nullable</strong>. Existing unstructured projects continue using <code>quest.parent_id</code> for hierarchy. Pre-migration Bible/FIA projects have <code>frozen = true</code> on their <code>project_template_link</code> rows (preventing re-pointing). The old <code>project.template</code> enum and <code>quest.metadata</code> remain until full migration.',
    highlightNodes: ["n-project", "n-quest", "n-asset"],
  },
];
