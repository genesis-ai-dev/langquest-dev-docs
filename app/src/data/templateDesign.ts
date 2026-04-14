import type { FieldDef } from "../components/SchemaNode";
import type { DiagramNodeDef, DiagramEdgeDef } from "../components/DiagramShell";
import type { Step } from "../components/StepWalkthrough";

function F(name: string, o?: Partial<FieldDef>): FieldDef {
  return { name, ...o };
}

const DIA_TEMPLATE_TREE = `<div class="font-mono text-[.6rem] leading-[1.9] text-txt-muted mt-1.5">
<b class="text-accent-green">template_node tree (Bible example)</b><br/>
&nbsp;&nbsp;└ <b class="text-accent-green">Luke</b> <span class="text-txt-dim text-[.5rem]">node_type=book · order_key="a"</span><br/>
&nbsp;&nbsp;&nbsp;&nbsp;├ <b class="text-accent-green">Chapter 1</b> <span class="text-txt-dim text-[.5rem]">node_type=chapter · linkable_type=quest</span><br/>
&nbsp;&nbsp;&nbsp;&nbsp;│&nbsp;&nbsp;├ <span class="text-accent-cyan">1:1</span> <span class="text-txt-dim text-[.5rem]">node_type=verse · linkable_type=asset</span><br/>
&nbsp;&nbsp;&nbsp;&nbsp;│&nbsp;&nbsp;├ <span class="text-accent-cyan">1:2</span> <span class="text-txt-dim text-[.5rem]">linkable_type=asset</span><br/>
&nbsp;&nbsp;&nbsp;&nbsp;│&nbsp;&nbsp;└ <span class="text-accent-cyan">1:3</span> <span class="text-txt-dim text-[.5rem]">linkable_type=asset</span><br/>
&nbsp;&nbsp;&nbsp;&nbsp;└ <b class="text-accent-green">Chapter 2</b> <span class="text-txt-dim text-[.5rem]">node_type=chapter · linkable_type=quest</span><br/>
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;└ <span class="text-accent-cyan">2:1</span> <span class="text-txt-dim text-[.5rem]">node_type=verse · linkable_type=asset</span></div>`;

const DIA_VERSIONS = `<div class="font-mono text-[.6rem] leading-[1.9] text-txt-muted mt-1.5">
<b class="text-accent-purple">quest versions of Chapter 1</b><br/>
&nbsp;&nbsp;├ <span class="text-accent-purple">quest q-A</span> <span class="text-txt-dim text-[.5rem]">template_node_id → "Chapter 1" · creator=Ana</span><br/>
&nbsp;&nbsp;└ <span class="text-accent-purple">quest q-B</span> <span class="text-txt-dim text-[.5rem]">template_node_id → "Chapter 1" · creator=Ben</span><br/>
<span class="text-txt-dim text-[.5rem] ml-4">Both quests point to the same template_node → they are versions.</span></div>`;

const DIA_SPANNING = `<div class="font-mono text-[.6rem] leading-[1.9] text-txt-muted mt-1.5">
<b class="text-accent-amber">Ana's assets</b> (version q-A — each verse separate)<br/>
&nbsp;&nbsp;├ <span class="text-accent-amber">a-1</span> template_node_id→<span class="text-accent-cyan">v1:1</span> · span_end=<span class="text-txt-dim">null</span> <span class="text-accent-green text-[.5rem]">← dedicated</span><br/>
&nbsp;&nbsp;├ <span class="text-accent-amber">a-2</span> template_node_id→<span class="text-accent-cyan">v1:2</span> · span_end=<span class="text-txt-dim">null</span> <span class="text-accent-green text-[.5rem]">← dedicated</span><br/>
&nbsp;&nbsp;└ <span class="text-accent-amber">a-3</span> template_node_id→<span class="text-accent-cyan">v1:3</span> · span_end=<span class="text-txt-dim">null</span> <span class="text-accent-green text-[.5rem]">← dedicated</span><br/>
<b class="text-accent-amber">Ben's assets</b> (version q-B — combined v1:1–2)<br/>
&nbsp;&nbsp;├ <span class="text-accent-amber">a-4</span> template_node_id→<span class="text-accent-cyan">v1:1</span> · span_end→<span class="text-accent-cyan">v1:2</span> <span class="text-accent-pink text-[.5rem]">← SPANNING</span><br/>
&nbsp;&nbsp;└ <span class="text-accent-amber">a-5</span> template_node_id→<span class="text-accent-cyan">v1:3</span> · span_end=<span class="text-txt-dim">null</span> <span class="text-accent-green text-[.5rem]">← dedicated</span></div>`;

export const NODES: DiagramNodeDef[] = [
  {
    id: "n-template",
    title: "template_node",
    sub: "canonical structure (NEW)",
    x: 122,
    y: 329,
    w: 280,
    fields: [
      F("id", { pk: true }),
      F("parent_id", {
        fk: { node: "n-template", field: "id" },
        selfRef: true,
        hint: "Tree hierarchy. null = root node. Multiple roots per project = multiple templates.",
      }),
      F("project_id", {
        fk: { node: "n-project", field: "id" },
        hint: "Which project owns this template tree.",
      }),
      F("name"),
      F("node_type", {
        hint: "Semantic type: book, chapter, verse, pericope, section, word, scene, timestamp, custom, etc.",
      }),
      F("order_key", {
        hint: "Fractional-index string for sibling ordering. Lexicographic sort. Insert between any two siblings with zero updates to other rows.",
      }),
      F("linkable_type", {
        hint: "'quest' = versions (quests) link here. 'asset' = contributions (assets) link here. null = structural grouping only.",
      }),
      F("source_template_node_id", {
        fk: { node: "n-template", field: "id" },
        selfRef: true,
        hint: "Copy-on-instantiate provenance: tracks which shared template node this was cloned from.",
      }),
      F("active", {
        hint: "Soft-delete. Inactive nodes are hidden from new work but preserved for existing contributions.",
      }),
      F("metadata", {
        hint: "Flexible JSON for node-specific data (e.g. timestamp ranges, custom fields).",
      }),
    ],
  },
  {
    id: "n-project",
    title: "project",
    sub: "workspace (minimal changes)",
    x: -224,
    y: -11,
    w: 200,
    fields: [
      F("id", { pk: true }),
      F("name"),
      F("template", {
        hint: "Legacy enum: unstructured | bible | fia. Becomes vestigial once template_node trees are adopted.",
      }),
      F("creator_id"),
      F("private"),
    ],
  },
  {
    id: "n-quest",
    title: "quest",
    sub: "version of work (add 1 col)",
    x: 817,
    y: 106,
    w: 250,
    fields: [
      F("id", { pk: true }),
      F("project_id", { fk: { node: "n-project", field: "id" } }),
      F("template_node_id", {
        fk: { node: "n-template", field: "id" },
        hint: "NEW — Links quest to a template node. Multiple quests sharing the same template_node_id = versions of that structural unit.",
      }),
      F("parent_id", {
        fk: { node: "n-quest", field: "id" },
        selfRef: true,
        hint: "Retained for unstructured projects. In templated projects, hierarchy comes from template_node.parent_id instead.",
      }),
      F("name"),
      F("creator_id"),
      F("metadata", {
        hint: "Legacy JSON (bible/fia positioning). Redundant for templated projects — position is encoded by template_node_id.",
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
    sub: "contribution (add 2 cols)",
    x: 820,
    y: 389,
    w: 270,
    fields: [
      F("id", { pk: true }),
      F("project_id", { fk: { node: "n-project", field: "id" } }),
      F("template_node_id", {
        fk: { node: "n-template", field: "id" },
        hint: "NEW — What structural node this contribution is for (e.g. a verse). The 'start' of the range if spanning.",
      }),
      F("span_end_node_id", {
        fk: { node: "n-template", field: "id" },
        hint: "NEW — If set, this asset spans from template_node_id through span_end_node_id. If null, it's a single-node contribution. Both are real FKs.",
      }),
      F("content_type", {
        hint: "'source', 'translation', or 'transcription'.",
      }),
      F("source_asset_id", {
        fk: { node: "n-asset", field: "id" },
        selfRef: true,
        hint: "Translation/transcription chain. Points to the source asset this was derived from.",
      }),
      F("order_index", {
        hint: "Display ordering within a quest. Could migrate to fractional indexing too.",
      }),
      F("metadata", {
        hint: "Legacy verse range data. Redundant once template_node_id + span_end_node_id encode position.",
      }),
      F("download_profiles"),
    ],
  },
];

export const EDGES: DiagramEdgeDef[] = [
  { from: "n-template", fromField: "project_id", to: "n-project", toField: "id" },
  { from: "n-quest", fromField: "project_id", to: "n-project", toField: "id" },
  { from: "n-quest", fromField: "template_node_id", to: "n-template", toField: "id", dash: true },
  { from: "n-qal", fromField: "quest_id", to: "n-quest", toField: "id" },
  { from: "n-qal", fromField: "asset_id", to: "n-asset", toField: "id" },
  { from: "n-asset", fromField: "project_id", to: "n-project", toField: "id" },
  { from: "n-asset", fromField: "template_node_id", to: "n-template", toField: "id", dash: true },
  { from: "n-asset", fromField: "span_end_node_id", to: "n-template", toField: "id", dash: true },
];

export const STEPS: Step[] = [
  {
    title: "Template design proposal — overview",
    description:
      'A <strong>template_node</strong> table defines the canonical project structure — separate from the working quest/asset spine. Quests and assets link to template nodes via FK, but the structure lives in its own table. <strong>Drag</strong> tables to rearrange, click <strong>▶</strong> to expand fields, hover <strong>?</strong> for details. <em>Dashed edges</em> are the new FK relationships.',
    highlightNodes: ["n-template", "n-project", "n-quest", "n-qal", "n-asset"],
  },
  {
    title: "template_node — the canonical structure",
    description:
      'Each row is one node in a project\'s hierarchical structure. The tree uses <code>parent_id</code> (self-ref) and <code>order_key</code> (fractional index) for ordering. <code>node_type</code> carries semantic meaning. <code>linkable_type</code> tells the app what kind of entity contributes at this level — quests at chapter level, assets at verse level, etc.' +
      DIA_TEMPLATE_TREE,
    highlightNodes: ["n-template"],
  },
  {
    title: "Quest versioning via template_node_id",
    description:
      'Quests gain one new nullable FK: <code>template_node_id</code>. Two quests pointing to the <em>same</em> template node are <strong>versions</strong> of that structural unit. This replaces metadata-matching for version detection and works for any template type — Bible, FIA, dictionary, video timestamps, or custom.' +
      DIA_VERSIONS,
    highlightNodes: ["n-quest", "n-template"],
  },
  {
    title: "Asset contributions & verse spanning",
    description:
      'Assets gain <code>template_node_id</code> (what structural node this is for) and <code>span_end_node_id</code> (range endpoint). A null <code>span_end_node_id</code> = <strong>dedicated</strong> contribution to one node. A set value = <strong>spanning</strong> contribution across a range. Queries can distinguish the two cleanly.' +
      DIA_SPANNING,
    highlightNodes: ["n-asset", "n-template"],
  },
  {
    title: "quest_asset_link — which version owns which asset",
    description:
      'Unchanged. <code>quest_asset_link</code> ties an asset to a specific quest (version). The asset\'s <code>template_node_id</code> says <em>what</em> structural unit it covers. The <code>quest_asset_link</code> says <em>which version</em> it belongs to. Each concern is separate and queryable independently.',
    highlightNodes: ["n-qal", "n-quest", "n-asset"],
  },
  {
    title: "Fractional indexing for ordering",
    description:
      '<code>order_key</code> uses <strong>fractional indexing</strong> — lexicographic strings that allow inserting between any two siblings with <em>zero</em> updates to existing rows. Perfect for offline-first sync (PowerSync) since only the new row is written.' +
      `<div class="font-mono text-[.6rem] leading-[1.7] text-txt-muted mt-1.5">
<span class="text-accent-cyan">Item A</span> order_key = <span class="text-accent-green">"a"</span><br/>
<span class="text-accent-pink">Item X</span> order_key = <span class="text-accent-green">"aV"</span> <span class="text-txt-dim text-[.5rem]">← inserted, 0 sibling updates</span><br/>
<span class="text-accent-cyan">Item B</span> order_key = <span class="text-accent-green">"b"</span><br/>
<span class="text-accent-cyan">Item C</span> order_key = <span class="text-accent-green">"c"</span></div>`,
    highlightNodes: ["n-template"],
  },
  {
    title: "Completion queries become trivial",
    description:
      'To check verse completion, query template_node children and left-join assets. No JSON parsing, no tag lookups.' +
      `<div class="font-mono text-[.55rem] leading-[1.7] text-txt-muted mt-1.5 bg-code-bg rounded-lg px-3 py-2">
<span class="text-accent-pink">SELECT</span> tn.name,<br/>
&nbsp;&nbsp;<span class="text-accent-pink">COUNT</span>(a.id) <span class="text-accent-pink">FILTER</span> (<span class="text-accent-pink">WHERE</span> a.span_end_node_id <span class="text-accent-pink">IS NULL</span>) <span class="text-accent-pink">AS</span> dedicated,<br/>
&nbsp;&nbsp;<span class="text-accent-pink">COUNT</span>(a.id) <span class="text-accent-pink">FILTER</span> (<span class="text-accent-pink">WHERE</span> a.span_end_node_id <span class="text-accent-pink">IS NOT NULL</span>) <span class="text-accent-pink">AS</span> spanning<br/>
<span class="text-accent-pink">FROM</span> template_node tn<br/>
<span class="text-accent-pink">LEFT JOIN</span> asset a <span class="text-accent-pink">ON</span> a.template_node_id = tn.id<br/>
<span class="text-accent-pink">WHERE</span> tn.parent_id = <span class="text-accent-green">'tn-ch1'</span><br/>
&nbsp;&nbsp;<span class="text-accent-pink">AND</span> tn.node_type = <span class="text-accent-green">'verse'</span><br/>
<span class="text-accent-pink">GROUP BY</span> tn.id <span class="text-accent-pink">ORDER BY</span> tn.order_key;</div>`,
    highlightNodes: ["n-template", "n-asset"],
  },
  {
    title: "Multiple templates per project",
    description:
      'A project can contain multiple template trees — just multiple root template_nodes (<code>parent_id = null</code>) within the same <code>project_id</code>. A Yoruba project could host a Bible tree, a dictionary tree, and a story collection simultaneously.' +
      `<div class="font-mono text-[.6rem] leading-[1.9] text-txt-muted mt-1.5">
<b class="text-accent-cyan">Project: Yoruba Documentation</b><br/>
&nbsp;&nbsp;├ <b class="text-accent-green">Bible – Luke</b> <span class="text-txt-dim text-[.5rem]">template_node root, parent_id=null</span><br/>
&nbsp;&nbsp;│&nbsp;&nbsp;├ Chapter 1 → verses…<br/>
&nbsp;&nbsp;│&nbsp;&nbsp;└ Chapter 2 → verses…<br/>
&nbsp;&nbsp;├ <b class="text-accent-green">Dictionary</b> <span class="text-txt-dim text-[.5rem]">template_node root, parent_id=null</span><br/>
&nbsp;&nbsp;│&nbsp;&nbsp;├ Animals → [Cat, Dog, …]<br/>
&nbsp;&nbsp;│&nbsp;&nbsp;└ Colors → [Red, Blue, …]<br/>
&nbsp;&nbsp;└ <b class="text-accent-green">Story Collection</b> <span class="text-txt-dim text-[.5rem]">template_node root, parent_id=null</span><br/>
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;└ Creation Stories → [Story 1, Story 2, …]</div>`,
    highlightNodes: ["n-template", "n-project"],
  },
  {
    title: "Backward compatibility",
    description:
      'All new columns are <strong>nullable</strong>. Existing unstructured projects continue using <code>quest.parent_id</code> for hierarchy and <code>asset.metadata</code> for verse info. Template-aware code checks <code>template_node_id</code> first, falls back to legacy fields. The old <code>project.template</code> enum and <code>quest.metadata</code> remain until all projects migrate to template_node trees.',
    highlightNodes: ["n-project", "n-quest", "n-asset"],
  },
];
