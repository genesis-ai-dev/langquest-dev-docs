import type { Step } from "../components/StepWalkthrough";
import type { LcTableData, LcJsonData, LcTreeData, LcNoteData, LcLabelData } from "../components/LifecycleNodes";

export interface LcNodeDef {
  id: string;
  type: "lcTable" | "lcJson" | "lcTree" | "lcNote" | "lcLabel";
  x: number;
  y: number;
  w?: number;
  data: LcTableData | LcJsonData | LcTreeData | LcNoteData | LcLabelData;
}

export interface LcEdgeDef {
  from: string;
  to: string;
  label?: string;
  color?: string;
  dash?: boolean;
  animated?: boolean;
}

const IDS = {
  root: "root",
  genesis: "4ar28cRTn5",
  ch1: "sr1kHCBHOL",
  v1: "fKa9y8aSdj",
  v2: "dqCl5Vq8dc",
  v3: "lOTUXSdWuG",
};

const FORKED = {
  genesis: "hD5aVr",
  ch1: "apBl5xyr",
  v1: "D3xqpr7",
  v2: "rN52cxaW",
};

// ─── Scene 0: Initial State ──────────────────────────────────────────────────

export const SCENE0_NODES: LcNodeDef[] = [
  {
    id: "title", type: "lcLabel", x: 260, y: -20,
    data: { text: "Initial state", color: "var(--color-accent-green)", fontSize: "0.9rem", bold: true },
  },
  {
    id: "project", type: "lcTable", x: 0, y: 30,
    data: {
      title: "project", subtitle: "WORKSPACE (UNCHANGED)", color: "var(--color-accent-blue)",
      fields: [{ name: "id", pk: true }, { name: "name" }, { name: "template" }, { name: "creator_id" }, { name: "private" }],
    },
  },
  {
    id: "pbl", type: "lcTable", x: 0, y: 200,
    data: {
      title: "project_template_link", subtitle: "LINKS PROJECT TO TEMPLATE (NEW)", color: "var(--color-accent-purple)",
      fields: [{ name: "id", pk: true }, { name: "project_id", fk: true }, { name: "template_id", fk: true, highlight: true }, { name: "role" }, { name: "active" }, { name: "frozen" }, { name: "download_profiles" }],
    },
  },
  {
    id: "tpl", type: "lcTable", x: 0, y: 440,
    data: {
      title: "template", subtitle: "JSONB STRUCTURE TREE (NEW)", color: "var(--color-accent-green)",
      fields: [
        { name: "id", pk: true }, { name: "slug" }, { name: "name" }, { name: "description" },
        { name: "icon" }, { name: "structure", highlight: true }, { name: "source_languoid_id", fk: true },
        { name: "copied_from_template_id", fk: true }, { name: "auto_sync" }, { name: "shared" },
        { name: "project_count" }, { name: "creator_id" },
      ],
    },
  },
  {
    id: "json", type: "lcJson", x: 260, y: 40, w: 240,
    data: {
      lines: [
        { text: '{ "format_version": 1, "root": {', color: "var(--color-txt-dim)" },
        { text: '"id": "root",', indent: 1, color: "var(--color-accent-pink)" },
        { text: '"name": "Protestant Bible",', indent: 1 },
        { text: '"node_type": "root",', indent: 1 },
        { text: '"linkable_type": "quest",', indent: 1 },
        { text: '"children": [{', indent: 1 },
        { text: `"id": "${IDS.genesis}",`, indent: 2, color: "var(--color-accent-green)" },
        { text: '"name": "Genesis",', indent: 2 },
        { text: '"node_type": "book", "children": [{', indent: 2 },
        { text: `"id": "${IDS.ch1}",`, indent: 3, color: "var(--color-accent-green)" },
        { text: '"name": "Genesis 1",', indent: 3 },
        { text: '"node_type": "chapter",', indent: 3 },
        { text: '"linkable_type": "quest",', indent: 3 },
        { text: '"children": [', indent: 3 },
        { text: `{ "id": "${IDS.v1}",`, indent: 4, color: "var(--color-accent-cyan)" },
        { text: '  "name": "Genesis 1:1", ... },', indent: 4 },
        { text: `{ "id": "${IDS.v2}",`, indent: 4, color: "var(--color-accent-cyan)" },
        { text: '  "name": "Genesis 1:2", ... },', indent: 4 },
        { text: `{ "id": "${IDS.v3}",`, indent: 4, color: "var(--color-accent-cyan)" },
        { text: '  "name": "Genesis 1:3", ... }', indent: 4 },
        { text: '] } ] } ] } }', indent: 1, color: "var(--color-txt-dim)" },
      ],
    },
  },
  {
    id: "tree", type: "lcTree", x: 560, y: 40,
    data: {
      items: [
        { type: "folder", label: "Protestant Bible", nodeId: IDS.root, indent: 0 },
        { type: "folder", label: "Genesis", nodeId: IDS.genesis, indent: 1 },
        { type: "folder", label: "Chapter 1", nodeId: IDS.ch1, indent: 2 },
        { type: "file", label: "Verse 1", nodeId: IDS.v1, indent: 3 },
        { type: "file", label: "Verse 2", nodeId: IDS.v2, indent: 3 },
        { type: "file", label: "Verse 3", nodeId: IDS.v3, indent: 3 },
      ],
    },
  },
  {
    id: "linked-label", type: "lcLabel", x: 750, y: 20,
    data: { text: "Quests/assets reference\nnode IDs via template_node_id", color: "var(--color-txt-dim)", fontSize: "0.55rem" },
  },
  {
    id: "quest", type: "lcNote", x: 740, y: 110,
    data: {
      borderColor: "var(--color-accent-purple)",
      lines: [
        { text: "quest q-A", color: "var(--color-accent-purple)", bold: true },
        { text: "template_node_id → ch1", size: "0.5rem" },
      ],
    },
  },
  {
    id: "asset1", type: "lcNote", x: 740, y: 180,
    data: {
      borderColor: "var(--color-accent-purple)",
      lines: [
        { text: "asset a-1 (audio)", color: "var(--color-accent-purple)", bold: true },
        { text: "template_node_id → v1", size: "0.5rem" },
      ],
    },
  },
  {
    id: "asset2", type: "lcNote", x: 740, y: 250,
    data: {
      borderColor: "var(--color-accent-purple)",
      lines: [
        { text: "asset a-2 (audio)", color: "var(--color-accent-purple)", bold: true },
        { text: "template_node_id → v2", size: "0.5rem" },
      ],
    },
  },
  {
    id: "asset3", type: "lcNote", x: 740, y: 320,
    data: {
      borderColor: "var(--color-accent-purple)",
      lines: [
        { text: "asset a-3 (audio)", color: "var(--color-accent-purple)", bold: true },
        { text: "template_node_id → v3", size: "0.5rem" },
      ],
    },
  },
];

export const SCENE0_EDGES: LcEdgeDef[] = [
  { from: "project", to: "pbl", dash: true, color: "var(--color-accent-purple)" },
  { from: "pbl", to: "tpl", dash: true, color: "var(--color-accent-green)", label: "template_id" },
  { from: "tpl", to: "json", dash: true, color: "var(--color-accent-green)", label: "structure →" },
  { from: "json", to: "tree", dash: true, color: "var(--color-border-hi)", label: "node_id" },
  { from: "tree", to: "quest", dash: true, color: "var(--color-accent-purple)" },
  { from: "tree", to: "asset1", dash: true, color: "var(--color-accent-purple)" },
  { from: "tree", to: "asset2", dash: true, color: "var(--color-accent-purple)" },
  { from: "tree", to: "asset3", dash: true, color: "var(--color-accent-purple)" },
];

// ─── Scene 1: Fork → Existing Project ────────────────────────────────────────

export const SCENE1_NODES: LcNodeDef[] = [
  {
    id: "title", type: "lcLabel", x: 200, y: -20,
    data: { text: "Edit (verse removed) → existing project", color: "var(--color-accent-purple)", fontSize: "0.9rem", bold: true },
  },
  {
    id: "project", type: "lcTable", x: 560, y: 0,
    data: {
      title: "project", subtitle: "WORKSPACE (UNCHANGED)", color: "var(--color-accent-blue)",
      fields: [{ name: "id", pk: true }, { name: "name" }, { name: "creator_id" }],
    },
  },
  {
    id: "pbl", type: "lcTable", x: 560, y: 110,
    data: {
      title: "project_template_link", color: "var(--color-accent-purple)",
      fields: [{ name: "id", pk: true }, { name: "project_id", fk: true }, { name: "template_id → bp-002", highlight: true }, { name: "active" }],
    },
  },
  {
    id: "old-label", type: "lcLabel", x: 50, y: 70,
    data: { text: "Old Template", color: "var(--color-txt-dim)", fontSize: "0.65rem" },
  },
  {
    id: "old-bp", type: "lcTable", x: 0, y: 90,
    data: {
      title: "template", subtitle: "bp-001 (old)", color: "var(--color-txt-dim)", dimmed: true,
      fields: [{ name: "id: bp-001", pk: true }, { name: "structure: { ... }" }, { name: "copied_from_template_id: null" }],
    },
  },
  {
    id: "fork-label", type: "lcLabel", x: 30, y: 290,
    data: { text: "Forked/Edited Template", color: "var(--color-accent-green)", fontSize: "0.65rem" },
  },
  {
    id: "new-bp", type: "lcTable", x: 0, y: 310,
    data: {
      title: "template", subtitle: "bp-002 (forked/edited)", color: "var(--color-accent-green)",
      fields: [{ name: "id: bp-002", pk: true }, { name: "structure: { ... }", highlight: true }, { name: "copied_from_template_id: bp-001", fk: true }, { name: "shared" }],
    },
  },
  {
    id: "json", type: "lcJson", x: 250, y: 240, w: 240,
    data: {
      lines: [
        { text: '{ "format_version": 1, "root": {', color: "var(--color-txt-dim)" },
        { text: '"id": "root", "name": "Protestant Bible v2",', indent: 1 },
        { text: '"children": [{ ...Genesis..., "children": [{', indent: 1 },
        { text: `"id": "${IDS.ch1}", "children": [`, indent: 2, color: "var(--color-accent-green)" },
        { text: `  { "id": "${IDS.v1}", ... },`, indent: 2, color: "var(--color-accent-cyan)" },
        { text: `  { "id": "${IDS.v2}", ... },`, indent: 2, color: "var(--color-accent-cyan)" },
        { text: `  { "id": "${IDS.v3}",`, indent: 2, color: "var(--color-accent-cyan)", dim: true },
        { text: '    "name": "Genesis 1:3",', indent: 3, dim: true },
        { text: '    "allows_spanning": true,', indent: 3, dim: true },
        { text: '    "deleted": true', indent: 3, highlight: true },
        { text: '  }', indent: 2, dim: true },
        { text: '] } ] } ] } }', indent: 1, color: "var(--color-txt-dim)" },
      ],
    },
  },
  {
    id: "tree", type: "lcTree", x: 600, y: 270,
    data: {
      items: [
        { type: "folder", label: "Protestant Bible", nodeId: IDS.root, indent: 0 },
        { type: "folder", label: "Genesis", nodeId: IDS.genesis, indent: 1 },
        { type: "folder", label: "Chapter 1", nodeId: IDS.ch1, indent: 2 },
        { type: "file", label: "Verse 1", nodeId: IDS.v1, indent: 3 },
        { type: "file", label: "Verse 2", nodeId: IDS.v2, indent: 3 },
        { type: "file", label: "Verse 3", nodeId: IDS.v3, indent: 3, deleted: true },
      ],
    },
  },
  {
    id: "note", type: "lcNote", x: 450, y: 530,
    data: {
      borderColor: "var(--color-accent-amber)",
      lines: [
        { text: "- unique node ids stay the same", color: "var(--color-accent-amber)", bold: true },
        { text: "- deleted nodes just marked deleted", color: "var(--color-accent-amber)", bold: true },
      ],
    },
  },
];

export const SCENE1_EDGES: LcEdgeDef[] = [
  { from: "project", to: "pbl", dash: true, color: "var(--color-accent-purple)" },
  { from: "old-bp", to: "new-bp", dash: true, color: "var(--color-accent-pink)", label: "fork (copied_from)" },
  { from: "pbl", to: "new-bp", dash: true, color: "var(--color-accent-green)", label: "re-pointed" },
  { from: "new-bp", to: "json", dash: true, color: "var(--color-accent-green)", label: "structure →" },
  { from: "json", to: "tree", dash: true, color: "var(--color-border-hi)", label: "node_id" },
];

// ─── Scene 2: Fork → New Project ─────────────────────────────────────────────

export const SCENE2_NODES: LcNodeDef[] = [
  {
    id: "title", type: "lcLabel", x: 150, y: -20,
    data: { text: "Edit (verse removed) → new project (first template)", color: "var(--color-accent-cyan)", fontSize: "0.9rem", bold: true },
  },
  {
    id: "project1", type: "lcTable", x: 0, y: 30,
    data: {
      title: "project", subtitle: "WORKSPACE (UNCHANGED)", color: "var(--color-accent-blue)",
      fields: [{ name: "id", pk: true }, { name: "name" }, { name: "creator_id" }],
    },
  },
  {
    id: "pbl1", type: "lcTable", x: 0, y: 140,
    data: {
      title: "project_template_link", color: "var(--color-accent-purple)",
      fields: [{ name: "id", pk: true }, { name: "project_id", fk: true }, { name: "template_id → bp-001" }, { name: "active" }],
    },
  },
  {
    id: "project2", type: "lcTable", x: 250, y: 30,
    data: {
      title: "project", subtitle: "WORKSPACE (UNCHANGED)", color: "var(--color-accent-blue)",
      fields: [{ name: "id", pk: true }, { name: "name" }, { name: "creator_id" }],
    },
  },
  {
    id: "pbl2", type: "lcTable", x: 250, y: 140,
    data: {
      title: "project_template_link", color: "var(--color-accent-purple)",
      fields: [{ name: "id", pk: true }, { name: "project_id", fk: true }, { name: "template_id → bp-002", highlight: true }, { name: "active" }],
    },
  },
  {
    id: "old-label", type: "lcLabel", x: 80, y: 280,
    data: { text: "Old Template", color: "var(--color-txt-dim)", fontSize: "0.65rem" },
  },
  {
    id: "old-bp", type: "lcTable", x: 40, y: 300,
    data: {
      title: "template", subtitle: "bp-001 (old)", color: "var(--color-txt-dim)", dimmed: true,
      fields: [{ name: "id: bp-001", pk: true }, { name: "structure: { ... }" }, { name: "copied_from_template_id: null" }],
    },
  },
  {
    id: "fork-label", type: "lcLabel", x: 60, y: 470,
    data: { text: "Forked/Edited Template", color: "var(--color-accent-green)", fontSize: "0.65rem" },
  },
  {
    id: "new-bp", type: "lcTable", x: 40, y: 490,
    data: {
      title: "template", subtitle: "bp-002 (forked/edited)", color: "var(--color-accent-green)",
      fields: [{ name: "id: bp-002", pk: true }, { name: "structure: { ... }", highlight: true }, { name: "copied_from_template_id: bp-001", fk: true }],
    },
  },
  {
    id: "json", type: "lcJson", x: 310, y: 430, w: 240,
    data: {
      lines: [
        { text: '{ "format_version": 1, "root": {', color: "var(--color-txt-dim)" },
        { text: '"id": "root", "name": "Protestant Bible v2",', indent: 1 },
        { text: '"children": [{ ...Genesis..., "children": [{', indent: 1 },
        { text: `"id": "${FORKED.ch1}", "children": [`, indent: 2, color: "var(--color-accent-green)" },
        { text: `  { "id": "${FORKED.v1}", "name": "Genesis 1:1" },`, indent: 2, color: "var(--color-accent-cyan)" },
        { text: `  { "id": "${FORKED.v2}", "name": "Genesis 1:2" }`, indent: 2, color: "var(--color-accent-cyan)" },
        { text: '] } ] } ] } }', indent: 1, color: "var(--color-txt-dim)" },
      ],
    },
  },
  {
    id: "tree", type: "lcTree", x: 600, y: 300,
    data: {
      items: [
        { type: "folder", label: "Protestant Bible", nodeId: "root", indent: 0 },
        { type: "folder", label: "Genesis", nodeId: FORKED.genesis, indent: 1 },
        { type: "folder", label: "Chapter 1", nodeId: FORKED.ch1, indent: 2 },
        { type: "file", label: "Verse 1", nodeId: FORKED.v1, indent: 3 },
        { type: "file", label: "Verse 2", nodeId: FORKED.v2, indent: 3 },
      ],
    },
  },
  {
    id: "removed", type: "lcLabel", x: 680, y: 530,
    data: { text: "Template node removed ✕", color: "var(--color-accent-red)", fontSize: "0.7rem", bold: true },
  },
  {
    id: "note", type: "lcNote", x: 450, y: 610,
    data: {
      borderColor: "var(--color-accent-cyan)",
      lines: [
        { text: "- all unique node ids changed", color: "var(--color-accent-cyan)", bold: true },
        { text: "- deleted nodes completely removed", color: "var(--color-accent-cyan)", bold: true },
      ],
    },
  },
];

export const SCENE2_EDGES: LcEdgeDef[] = [
  { from: "project1", to: "pbl1", dash: true, color: "var(--color-accent-purple)" },
  { from: "project2", to: "pbl2", dash: true, color: "var(--color-accent-purple)" },
  { from: "pbl1", to: "old-bp", dash: true, color: "var(--color-txt-dim)" },
  { from: "pbl2", to: "new-bp", dash: true, color: "var(--color-accent-green)" },
  { from: "old-bp", to: "new-bp", dash: true, color: "var(--color-accent-pink)", label: "fork (copied_from)" },
  { from: "new-bp", to: "json", dash: true, color: "var(--color-accent-green)", label: "structure →" },
  { from: "json", to: "tree", dash: true, color: "var(--color-border-hi)", label: "node_id" },
];

// ─── Scene 3: Reconciliation Principle ───────────────────────────────────────

export const SCENE3_NODES: LcNodeDef[] = [
  {
    id: "title", type: "lcLabel", x: 150, y: -10,
    data: { text: "DESIRED-STATE RECONCILIATION", color: "var(--color-accent-green)", fontSize: "1rem", bold: true },
  },
  {
    id: "editor", type: "lcNote", x: 0, y: 50,
    data: {
      borderColor: "var(--color-accent-amber)",
      lines: [
        { text: "EDITOR PERSPECTIVE", color: "var(--color-accent-amber)", bold: true, size: "0.75rem" },
        { text: "Delete means delete." },
        { text: "No modes. No ghost nodes." },
        { text: 'No "hide vs remove" choice.' },
        { text: "" },
        { text: "Template = what I want it to look like.", color: "var(--color-accent-green)", bold: true },
        { text: "(deleted nodes stored as tombstones under the hood)", size: "0.5rem" },
      ],
    },
  },
  {
    id: "system", type: "lcNote", x: 400, y: 50,
    data: {
      borderColor: "var(--color-accent-cyan)",
      lines: [
        { text: "SYSTEM (APPLICATION TIME)", color: "var(--color-accent-cyan)", bold: true, size: "0.75rem" },
        { text: "Existing project with contributions?" },
        { text: "→ Keep tombstones. Protect data.", color: "var(--color-accent-purple)", bold: true },
        { text: "→ Preserve node IDs.", color: "var(--color-accent-purple)" },
        { text: "" },
        { text: "Brand-new project, no contributions?" },
        { text: "→ Strip tombstones. Clean slate.", color: "var(--color-accent-cyan)", bold: true },
        { text: "→ Regenerate node IDs.", color: "var(--color-accent-cyan)" },
        { text: "" },
        { text: "Intelligence lives here, not in the editor.", size: "0.5rem" },
      ],
    },
  },
  {
    id: "summary", type: "lcLabel", x: 100, y: 310,
    data: { text: "Template is declarative. Reconciliation is contextual.", color: "var(--color-txt)", fontSize: "0.8rem", bold: true },
  },
  {
    id: "analogy", type: "lcLabel", x: 80, y: 345,
    data: { text: "Same pattern as Kubernetes desired-state, Terraform plans, database migrations.", color: "var(--color-txt-dim)", fontSize: "0.6rem" },
  },
  {
    id: "existing-box", type: "lcNote", x: 0, y: 390,
    data: {
      borderColor: "var(--color-accent-purple)",
      lines: [
        { text: "EXISTING PROJECT", color: "var(--color-accent-purple)", bold: true },
        { text: "node IDs: same (4ar28c, sr1kHC, ...)" },
        { text: 'deleted verse: { "deleted": true }', color: "var(--color-accent-amber)" },
        { text: "contributions: preserved and linked" },
      ],
    },
  },
  {
    id: "new-box", type: "lcNote", x: 400, y: 390,
    data: {
      borderColor: "var(--color-accent-cyan)",
      lines: [
        { text: "NEW PROJECT", color: "var(--color-accent-cyan)", bold: true },
        { text: "node IDs: regenerated (hD5aVr, apBl5x, ...)" },
        { text: "deleted verse: completely removed", color: "var(--color-accent-red)" },
        { text: "no orphan risk — nothing to protect" },
      ],
    },
  },
];

export const SCENE3_EDGES: LcEdgeDef[] = [
  { from: "editor", to: "system", label: "publish", color: "var(--color-accent-green)" },
];

// ─── All scenes ──────────────────────────────────────────────────────────────

export const SCENES: { nodes: LcNodeDef[]; edges: LcEdgeDef[] }[] = [
  { nodes: SCENE0_NODES, edges: SCENE0_EDGES },
  { nodes: SCENE1_NODES, edges: SCENE1_EDGES },
  { nodes: SCENE2_NODES, edges: SCENE2_EDGES },
  { nodes: SCENE3_NODES, edges: SCENE3_EDGES },
];

// ─── Steps ───────────────────────────────────────────────────────────────────

export const STEPS: Step[] = [
  {
    title: "Initial state — project linked to a template",
    description:
      "A <strong>project</strong> links to a <strong>template</strong> via <code>project_template_link</code>. " +
      "The template's <code>structure</code> JSONB contains the full tree. Each node has a stable opaque ID (nanoid). " +
      "Quests and assets in the project reference these node IDs via <code>template_node_id</code>. " +
      "The visual tree on the right is derived from the JSON — <code>node_id</code> lines show the connection.",
  },
  {
    title: "Edit (verse removed) — applied to existing project",
    description:
      "Publishing creates a <strong>new template row</strong> (fork-always model). " +
      "<code>project_template_link</code> is re-pointed to the new fork. " +
      "Key behavior: <strong>unique node IDs stay the same</strong> and <strong>deleted nodes are just marked <code>deleted: true</code></strong>. " +
      "This preserves referential integrity — existing quests/assets still reference valid node IDs.",
  },
  {
    title: "Edit (verse removed) — applied to new project (first template)",
    description:
      "When the same edit is applied to a <strong>brand-new project</strong> (no existing contributions), the behavior differs: " +
      "<strong>all unique node IDs are regenerated</strong> and <strong>deleted nodes are completely removed</strong>. " +
      "There's nothing to orphan, so the template is applied clean. The new project gets its own project_template_link pointing to the forked template.",
  },
  {
    title: "The reconciliation principle",
    description:
      "The editor always just deletes. The <strong>system decides</strong> based on context: " +
      "<strong>existing project</strong> → keep tombstones, preserve node IDs (protect data). " +
      "<strong>new project</strong> → strip tombstones, regenerate IDs (clean slate). " +
      "This is <em>desired-state reconciliation</em> — the template declares what should exist, and the application layer " +
      "computes the safest transition per-project.",
  },
];
