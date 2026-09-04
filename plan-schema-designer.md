# Plan: Schema Designer — interactive DB schema evolution platform

A new page in the existing `app/` that lets us design the LangQuest database schema visually (React Flow), persist it as AML text docs plus a separate layout doc, and plan schema evolution as a sequence of stages with visual diffs between them.

This document is the full implementation spec. It is written so an implementing agent can build it phase by phase without further design decisions. Before implementing, the agent MUST read the three project skills in `.cursor/skills/`:

- `schema-designer-architecture` — layering rules, module boundaries, state management
- `aml-schema-conventions` — AML usage, custom-property grammars, file formats
- `schema-designer-ui` — visual/interaction conventions, theme tokens, React Flow patterns

Also use the already-available workspace skills where relevant: `supabase-postgres-best-practices` (when modeling tables/RLS/triggers content), `vercel-react-best-practices` and `vercel-composition-patterns` (component design), `building-components` (accessibility/composability).

---

## 1. Locked decisions

| Decision | Choice |
|---|---|
| Location | New page (`#designer`) inside the existing `app/` Vite application |
| Schema language | AML (Azimutt Markup Language) via `@azimutt/aml` |
| Persistence | Real files in the repo under `schema-designer/`, read/written through a dev-server file API (Vite plugin) |
| Stage model | One full AML snapshot per stage; diffs computed automatically between stages |
| Stage visualization | Timeline stepper + color-coded diff overlay, side-by-side compare, textual migration panel |
| First-class objects | Tables, fields, relations, enums/custom types, triggers, functions/RPCs, RLS policies |
| Editing model | Bidirectional: in-app Monaco AML editor pane synced live with the diagram; both writable |
| Seed | Stage `00` generated from the current schema (`database_schema.sql`) |

Non-goals for v1 (do NOT build): SQL/migration generation, branching stage graphs (linear only), views and indexes as first-class UI (AML parses them; they're just not surfaced), collaborative editing, writable production deployment (file API is dev-only; production builds are read-only).

## 2. Why AML (context for the implementer)

- `@azimutt/aml` exports `parseAml(text): ParserResult<Database>` and `generateAml(db: Database): string` — true round-trip, which bidirectional editing requires.
- Custom properties (`{key: value}` on entities/attributes/relations) are preserved through parse/generate. We use them to encode triggers, RLS, and function metadata that no schema DSL supports natively.
- Ships Monaco editor integration: `aml.monaco.language()`, `.completion()`, `.codeAction()`, `.codeLens()`, `createMarker()` for inline parse errors.
- The `Database` type (from `@azimutt/models`, re-exported) is zod-validated JSON — our AML adapter maps it to/from our own domain model.

## 3. Repository layout (new files)

```
langquest-dev-docs/
├── schema-designer/                  # DATA — the documents this platform edits
│   ├── stages/
│   │   ├── 00-current.aml            # seeded from database_schema.sql
│   │   ├── 01-<slug>.aml             # created in-app ("duplicate stage")
│   │   └── ...
│   ├── stages.json                   # stage manifest: order, titles, descriptions, status
│   └── layout.json                   # diagram layout doc (positions, collapsed, edge labels)
├── app/
│   ├── vite-plugin-schema-fs.ts      # dev-server file API (GET/PUT/DELETE under schema-designer/)
│   └── src/schema-designer/          # FEATURE CODE — everything for this page lives here
│       ├── domain/                   # pure types + pure operations (no React, no libs)
│       ├── aml/                      # adapter: AML text <-> domain model
│       ├── diff/                     # stage diff engine (pure)
│       ├── layout/                   # layout doc types + resolution/merge logic (pure)
│       ├── persistence/              # file API client, autosave, external-change detection
│       ├── state/                    # zustand store (single writer), undo/redo
│       ├── flow/                     # domain+layout+diff -> React Flow nodes/edges mapping
│       ├── editor/                   # Monaco setup + text<->model sync
│       ├── components/               # all UI components for this feature
│       └── SchemaDesignerPage.tsx    # page entry, panel layout shell
└── .cursor/skills/                   # the three skills listed above
```

Wire-up outside the feature folder (the only edits allowed outside `app/src/schema-designer/`):

- `app/src/App.tsx`: add `"designer"` to the `Page` union, `#designer` in `getPage()`, render `SchemaDesignerPage`.
- `app/src/components/Header.tsx`: add `{ label: "Designer (beta)", hash: "#designer" }` to `NAV_ITEMS`.
- `app/vite.config.ts`: register `vite-plugin-schema-fs`.
- `app/package.json`: dependencies below.

## 4. Dependencies to add

Runtime: `@azimutt/aml`, `@monaco-editor/react`, `monaco-editor`, `zustand`, `zundo` (undo/redo middleware for zustand).

Dev: `vitest` (unit tests for `domain/`, `aml/`, `diff/`, `layout/`), `tsx` (seed script runner), `@azimutt/parser-sql` (seed script only).

Do not add a router, a CSS lib, or a forms lib. React Flow (`@xyflow/react@12`) and Tailwind 4 are already present.

## 5. Data formats

### 5.1 Stage AML documents (`schema-designer/stages/NN-slug.aml`)

Standard AML for tables, fields, relations, enums. Extended concepts use the conventions below (full grammar in the `aml-schema-conventions` skill; the adapter in `aml/` is the only code that knows these):

- **Triggers** — entity custom property, one string per trigger:
  `quest {triggers: ["before insert,update: set_quest_download_profiles", "after delete: cleanup_closure"]}`
  Grammar: `<before|after|instead_of> <event>[,<event>]* [when (<condition>)]: <function_name>`
- **RLS policies** — entity custom properties:
  `{rls: ["select to authenticated: is_project_member(project_id)", "insert to authenticated: check profile_id = auth.uid()"]}` plus bare `{rlsEnabled}` flag.
  Grammar: `<select|insert|update|delete|all> [to <role>]: [using] <expr> [check <expr>]`
- **Functions / RPCs** — AML entities in the `rpc` namespace; attributes are parameters:

  ```aml
  rpc.download_quest_closure {kind: function, returns: void, security: definer, touches: [quest, asset]} | stamps download_profiles on the closure
    quest_id uuid
    profile_id uuid
  ```

  `touches: [table...]` drives dashed "touches" edges on the canvas.
- **Renames** — `{renamedFrom: old_name}` on a table or field so the diff engine reports a rename instead of remove+add. Cleared when a new stage is duplicated from this one (the rename already "happened").
- Documentation uses AML `|` doc syntax, not `#` comments (GUI edits regenerate the file; `#` comments would be lost — see §8).

### 5.2 Stage manifest (`schema-designer/stages.json`)

Source of truth for stage order and metadata. Filenames carry a numeric prefix only for human readability.

```json
{
  "version": 1,
  "stages": [
    { "id": "00-current", "file": "stages/00-current.aml", "title": "Current production", "description": "Schema as deployed today", "status": "live" },
    { "id": "01-attachment-queue", "file": "stages/01-attachment-queue.aml", "title": "Attachment queue", "description": "...", "status": "planned" }
  ]
}
```

`status` ∈ `"live" | "in-progress" | "planned" | "done"`. The manifest is edited via the UI (create/rename/reorder/delete stage) and saved like any other file.

### 5.3 Layout doc (`schema-designer/layout.json`)

One file for all stages: a `base` layout plus sparse per-stage overrides. **Resolution rule:** the effective layout for stage N = `base`, then apply each stage's override in manifest order from the first stage through N (a table moved in stage 2 stays there in stages 3+ unless overridden again). **Write rule:** dragging in the first stage writes `base`; dragging in any later stage writes that stage's override entry.

```json
{
  "version": 1,
  "base": {
    "nodes": {
      "quest":                  { "x": 120, "y": 240, "collapsed": false },
      "rpc.download_quest_closure": { "x": 800, "y": 60 }
    },
    "edges": {
      "quest.parent_id->quest.id": { "labelOffset": { "x": 0, "y": -14 } }
    }
  },
  "stages": {
    "01-attachment-queue": {
      "nodes": { "attachment_queue": { "x": 500, "y": 400 } },
      "edges": {}
    }
  }
}
```

Keys: node key = entity name including namespace (`quest`, `rpc.foo`). Edge key = `srcTable.srcField->dstTable.dstField`. Values are partial — only overridden properties present. Ghost (removed-in-diff) nodes render at the position resolved for the *previous* stage.

## 6. Domain model (`domain/types.ts`)

Pure TypeScript, no imports from React/@xyflow/monaco/@azimutt. This is the single vocabulary the whole feature speaks; the AML `Database` type never leaves the `aml/` adapter.

```ts
export interface Schema {
  tables: Table[]; enums: EnumType[]; functions: DbFunction[]; relations: Relation[];
}
export interface Table {
  name: string; doc?: string; renamedFrom?: string; rlsEnabled: boolean;
  fields: Field[]; triggers: Trigger[]; policies: Policy[];
}
export interface Field {
  name: string; type: string; nullable: boolean; pk: boolean;
  default?: string; doc?: string; renamedFrom?: string;
}
export interface Relation {
  src: { table: string; field: string }; dst: { table: string; field: string };
  cardinality: 'n:1' | '1:1' | 'n:m'; doc?: string;
}
export interface Trigger { timing: 'before'|'after'|'instead_of'; events: TriggerEvent[]; condition?: string; fn: string; }
export type TriggerEvent = 'insert'|'update'|'delete'|'truncate';
export interface Policy { command: 'select'|'insert'|'update'|'delete'|'all'; role?: string; using?: string; check?: string; }
export interface DbFunction {
  name: string; params: { name: string; type: string }[];
  returns?: string; security?: 'definer'|'invoker'; language?: string; touches: string[]; doc?: string;
}
export interface EnumType { name: string; values: string[]; doc?: string; }
```

`domain/operations.ts` contains pure functions `(schema, args) => Schema` for every edit the GUI can make: `addTable`, `renameTable`, `removeTable`, `addField`, `updateField`, `removeField`, `addRelation`, `removeRelation`, `setTriggers`, `setPolicies`, `upsertFunction`, `upsertEnum`, etc. These return new objects (no mutation) and enforce invariants (unique names, relations reference existing fields — dangling relations are dropped with the table/field that owned them).

## 7. Module specifications

Dependency direction (enforced; see architecture skill): `domain` ← `aml`/`diff`/`layout` ← `state` ← `flow`/`editor`/`persistence` ← `components` ← `SchemaDesignerPage`.

### 7.1 `aml/` — adapter

```ts
parseSchema(amlText: string): { schema: Schema | null; errors: AmlError[] }
generateSchema(schema: Schema): string
```

- Wraps `parseAml`/`generateAml`. Maps `Database` ⇄ `Schema`, encoding/decoding the custom-property grammars (§5.1) via small codec functions (`aml/codecs/triggers.ts`, `rls.ts`, `functions.ts`), each with unit tests including malformed input (a malformed property string becomes a parse *warning* surfaced in the editor gutter, never a crash).
- `rpc.*` entities become `DbFunction`s; everything else becomes `Table`s. Unknown custom properties must round-trip untouched.
- Relation cardinality: AML `->` ⇒ `n:1`; `--` ⇒ `1:1`; junction tables are modeled explicitly (no `n:m` sugar in v1 — the type exists for the diff/edge renderer when both ends of a junction are collapsed later; do not implement collapsing in v1).
- `AmlError = { message: string; line: number; column: number; severity: 'error'|'warning' }`.

### 7.2 `diff/` — stage diff engine (pure)

```ts
computeDiff(before: Schema | null, after: Schema): StageDiff
```

- Match by name, honoring `renamedFrom` (a table/field whose `renamedFrom` matches a `before` name is `renamed`, not added).
- Output:

```ts
type ChangeKind = 'added'|'removed'|'modified'|'renamed';
interface StageDiff {
  tables: TableDiff[]; enums: NamedDiff[]; functions: NamedDiff[]; relations: RelationDiff[];
}
interface TableDiff {
  name: string; kind: ChangeKind; renamedFrom?: string;
  fields: FieldDiff[]; triggers: NamedDiff[]; policies: NamedDiff[];
  changes: PropertyChange[];             // e.g. rlsEnabled flipped, doc changed
}
interface FieldDiff { name: string; kind: ChangeKind; changes: PropertyChange[]; }
interface PropertyChange { property: string; from: string; to: string; }
```

- A table with `kind: 'modified'` has at least one child diff or property change. Unchanged objects are omitted entirely.
- `before === null` (first stage) ⇒ everything `added`, but the UI treats stage 0 as baseline and shows no overlay for it.

### 7.3 `layout/` — pure layout logic

```ts
resolveLayout(doc: LayoutDoc, stageOrder: string[], stageId: string): ResolvedLayout
withNodePosition(doc: LayoutDoc, stageOrder: string[], stageId: string, nodeKey: string, pos: XY): LayoutDoc
autoPlace(existing: ResolvedLayout, newNodeKey: string): XY   // grid-scan for free spot near viewport center
```

Implements the resolution/write rules from §5.3. Never touches React Flow types — returns plain `{ [nodeKey]: {x, y, collapsed} }` maps.

### 7.4 `persistence/` — file API client

Client for the Vite plugin API (§9): `listFiles()`, `readFile(path)`, `writeFile(path, content, baseMtime)`, `deleteFile(path)`.

- **Autosave:** the store calls `scheduleSave(path, content)`; persistence debounces 1000 ms per path, tracks status `'saved'|'saving'|'dirty'|'error'|'conflict'` per path, and records the mtime of its own last write.
- **External changes:** poll `listFiles()` every 2 s while the window has focus. If a file's mtime is newer than our last write and there are no unsaved local edits for it → reload silently into the store. If there ARE unsaved local edits → set status `'conflict'` and let the UI show a banner ("changed on disk — Reload / Keep mine"). No merging.
- **Read-only fallback (production builds):** if the API returns 404/network error on startup, load all docs via `import.meta.glob('../../../schema-designer/**/*', { query: '?raw', import: 'default' })` and set a global `readOnly` flag (hides all editing affordances). Vite config needs `server.fs.allow` to include the repo root for this glob in dev, too.

### 7.5 `state/` — zustand store

One store, sliced; the **only** writer of application state. Components never call adapters directly.

- `projectSlice`: manifest, `activeStageId`, `viewMode: 'edit' | 'diff' | 'compare'`, `compareWith: stageId | null`, `readOnly`.
- `schemaSlice`: `schema: Schema | null` (active stage), `amlText: string`, `parseErrors: AmlError[]`, `prevSchema: Schema | null` (previous stage, for diff), `diff: StageDiff | null` (derived, recomputed on schema/prevSchema change).
- `layoutSlice`: `layoutDoc`, derived `resolvedLayout` for active stage.
- `selectionSlice`: `selected: { kind: 'table'|'field'|'relation'|'function'|'enum'; key: string } | null`.
- Actions are the GUI edit verbs; each one: applies a `domain/operations` function → runs `generateSchema` → updates `amlText` → schedules save. Text-edit action: sets `amlText` → debounced (300 ms) `parseSchema` → on success replaces `schema` (and clears errors); on failure keeps last valid `schema` and sets `parseErrors`.
- **Undo/redo:** wrap with `zundo` temporal middleware tracking only `{ amlText, layoutDoc }` (schema is re-derived on undo by parsing). Keyboard: ⌘Z / ⇧⌘Z, scoped so Monaco keeps its own undo while focused (do not intercept when `document.activeElement` is inside the editor).
- Stage lifecycle actions: `createStage(afterId, title)` = copy active stage's AML text, strip all `renamedFrom` properties, write new file + manifest entry; `deleteStage`, `renameStage`, `setStageStatus`, `reorderStage`.

### 7.6 `flow/` — React Flow mapping

```ts
buildFlow(input: { schema, prevSchema, diff, resolvedLayout, prevResolvedLayout, viewMode, selection }):
  { nodes: Node[]; edges: Edge[] }
```

- Node types: `tableNode` (per `Table`), `functionNode` (per `DbFunction`), `ghostTableNode` (tables in `prevSchema` removed in the active stage — diff mode only, positioned from `prevResolvedLayout`, non-interactive except selectable).
- Edge types: `relationEdge` (per `Relation`, field-anchored handles `field-<name>` like the existing `SchemaNode`), `touchesEdge` (dashed, `DbFunction.touches` → table).
- Diff mode decorates node/edge `data` with the relevant `TableDiff`/`ChangeKind`; the components render badges/colors (see UI skill §diff palette). Edit mode passes no diff data.
- Connection handler: dragging from a field handle to another field handle dispatches `addRelation` (new relation defaults `n:1` from source to target; the inspector can flip to `1:1`).
- Node drag-stop dispatches `layout.withNodePosition`. Edge label drag-stop writes `labelOffset`.

### 7.7 `editor/` — Monaco integration

- `@monaco-editor/react`, language `aml` registered once (module-level guard) with `aml.monaco.language()/completion()/codeAction()/codeLens()`.
- Sync protocol (loop-prevention): store holds `amlText` + a monotonically increasing `textVersion` and `lastEditSource: 'editor' | 'model' | 'file'`. Editor pushes changes with source `'editor'`; the editor component only calls `setValue` when incoming `textVersion` change has source ≠ `'editor'`, using `executeEdits` with a full-range replacement to preserve cursor/scroll where possible.
- Parse errors → `setModelMarkers` via `aml.monaco.createMarker`.
- Read-only in diff/compare modes and when `readOnly`.

### 7.8 `components/` — UI inventory

Layout shell (`SchemaDesignerPage.tsx`): Header (existing component) → `StageTimeline` bar → three-pane body: collapsible `AmlEditorPane` (left, default 380 px), `CanvasHost` (center), collapsible `InspectorPanel` (right, 300 px). `MigrationPanel` slides in as a bottom drawer in diff mode. `CompareView` replaces the body in compare mode.

| Component | Responsibility |
|---|---|
| `StageTimeline` | Stepper chips (id, title, status dot) in manifest order; click = activate; `+` button = duplicate-as-new-stage dialog; context menu = rename/reorder/delete/status; toggle buttons for Diff and Compare modes |
| `DesignerToolbar` | Inside header `actions`: save-status indicator, Add table, undo/redo, panel toggles |
| `AmlEditorPane` | Monaco wrapper (§7.7) + `ParseErrorBar` listing errors, click → go to line |
| `CanvasHost` | `<ReactFlow>` with nodeTypes/edgeTypes, Background, Controls, MiniMap; wires drag/connect/select events to store actions |
| `TableNode` | Editable evolution of the existing read-only `SchemaNode`: double-click header = rename; field rows with inline edit (name input, type combobox with common Postgres types + defined enums, pk/nullable toggles); trailing "+ field" row; per-row context menu (delete, move up/down); collapse toggle; badges for triggers/RLS counts; diff decorations |
| `FunctionNode` | Distinct look (see UI skill); name, param list, returns; diff decorations |
| `RelationEdge` | Bezier edge, cardinality markers at ends (`1`/`n` labels), draggable label, selected state |
| `InspectorPanel` | Context-sensitive editor for selection: table → doc, rlsEnabled, triggers list (add/edit rows mapping to grammar §5.1), policies list; relation → cardinality, delete; function → signature, touches multi-select, security/language; enum → values editor. Also hosts the `TypesPanel` (enum list) when nothing is selected |
| `MigrationPanel` | Renders `StageDiff` as grouped operation list ("+ table attachment_queue", "~ quest.download_profiles type text[] → uuid[]", "− trigger …"); click focuses/centers the object on canvas |
| `CompareView` | Two read-only `CanvasHost`es side by side (left = `compareWith`, right = active), synchronized pan/zoom (share one viewport state), each with its own resolved layout |

## 8. Bidirectional sync — rules summary

1. Single source of truth is the store; Monaco and the canvas are views.
2. GUI edit → domain operation → `generateSchema` → new `amlText` (source `'model'`) → autosave. Consequence: **GUI edits normalize AML formatting and drop `#` comments** — documented behavior; use `|` docs instead.
3. Text edit → `amlText` (source `'editor'`) → debounce 300 ms → parse → valid: replace `schema`; invalid: keep last valid `schema`, show markers + `ParseErrorBar`, canvas dims 20% with an "editing…" hint. Autosave saves whatever text is in the buffer (invalid AML on disk is acceptable — it's a working document).
4. File changed externally → reload or conflict banner (§7.4). Undo history is cleared on external reload.

## 9. Dev-server file API (`app/vite-plugin-schema-fs.ts`)

Vite plugin, `configureServer` middleware, dev + preview only.

| Endpoint | Behavior |
|---|---|
| `GET /api/schema-fs/list` | `{ files: [{ path, mtimeMs }] }` for everything under `schema-designer/` |
| `GET /api/schema-fs/file?path=…` | `{ content, mtimeMs }`; 404 if missing |
| `PUT /api/schema-fs/file?path=…` | Body `{ content, baseMtimeMs? }`. If `baseMtimeMs` present and disk mtime is newer → `409 { diskMtimeMs }`. Creates parent dirs. Returns new `{ mtimeMs }` |
| `DELETE /api/schema-fs/file?path=…` | Deletes file |

Security/validation: resolve against `<repoRoot>/schema-designer/`, reject any resolved path outside it (`..`, absolute paths, symlinks via `fs.realpath` check); allow only `.aml` and `.json` extensions; 1 MB body cap. No auth (localhost dev tool).

## 10. Stage & diff UX specification

- **Timeline:** chips `00 Current ▸ 01 Attachment queue ▸ …` with status dots (live=green, in-progress=amber, planned=dim, done=purple). Active chip highlighted. Diff toggle appears when active stage > 0.
- **Diff overlay (edit canvas, diff mode ON):** compares active stage against the *previous* stage. Added tables/fields/relations/functions = green accents; removed = red ghost nodes / struck-through ghost field rows appended at the bottom of the table (max 5, "+N more removed"); modified fields = amber with tooltip listing `PropertyChange`s; renamed = blue badge `was: old_name`. Exact classes in the UI skill. Editing stays enabled in diff mode.
- **Migration panel:** bottom drawer listing the same `StageDiff` textually, grouped by object type, ordered tables → relations → enums → functions. Each row: kind icon (＋/−/～/→), object path, detail. Click → select + center on canvas.
- **Compare mode:** pick any two stages (dropdowns in the timeline bar). Read-only, synced viewports, diff overlay applied on the right canvas computed between the two chosen stages.

## 11. Seeding stage 00 (`app/scripts/seed-stage-00.ts`)

One-time script, run `npx tsx scripts/seed-stage-00.ts` from `app/`:

1. Read `../database_schema.sql`.
2. Parse with `@azimutt/parser-sql` (`parseSql(content, 'postgres')` → `Database`) and emit with `generateAml`.
3. Post-process: keep tables/relations/types; triggers, functions, and RLS from the SQL dump are NOT auto-converted (parser support is unreliable) — emit them into a sidecar report `schema-designer/stages/00-current.todo.md` listing every `CREATE TRIGGER` / `CREATE FUNCTION` / `CREATE POLICY` statement found (regex scan is fine), so they can be added by hand in the app using the §5.1 conventions.
4. Write `schema-designer/stages/00-current.aml`, a fresh `stages.json` with the single stage, and an empty `layout.json` (`{"version":1,"base":{"nodes":{},"edges":{}},"stages":{}}`). Missing layout entries are auto-placed on first load (§7.3 `autoPlace`) and saved on first drag.

If `@azimutt/parser-sql` fails on the dump, fallback: paste the SQL into https://azimutt.app/converters/sql/to/aml and save the output manually; the script's sidecar-report step still runs.

## 12. Implementation phases & acceptance criteria

Build in order; each phase must meet its criteria (and `npm run build` + `npx vitest run` must pass) before the next starts.

**Phase 1 — Foundation: files, parsing, read-only canvas.**
Vite plugin + persistence client; seed script run; domain types; `aml/` adapter (tables/fields/relations/enums only); store skeleton; `CanvasHost` + read-only `TableNode`; layout load/resolve; drag-to-move persists to `layout.json`.
✓ Open `#designer`, see stage 00 rendered from the real AML file. ✓ Drag a table, reload the browser — position kept, `layout.json` changed on disk. ✓ Unit tests: aml round-trip (`parse(generate(s)) deep-equals s`), layout resolution.

**Phase 2 — Editor pane + bidirectional sync.**
Monaco with AML language support; sync protocol; parse errors; autosave with status indicator; external-change polling + conflict banner.
✓ Type a new table in the editor → node appears within ~300 ms. ✓ Introduce a syntax error → markers + error bar, canvas keeps last valid state. ✓ Edit the `.aml` in Cursor → app picks it up ≤2 s. ✓ Concurrent edit conflict shows the banner, never silently overwrites.

**Phase 3 — GUI editing.**
`domain/operations` complete; editable `TableNode` (rename, field add/edit/delete, type combobox, pk/nullable); connect-to-create relations; `InspectorPanel` for tables/relations/enums; triggers + RLS + `rpc` codecs in `aml/`; `FunctionNode` + touches edges; undo/redo.
✓ Every edit made in the GUI appears in the editor text and on disk. ✓ Round-trip property preservation test covers triggers/rls/rpc/touches. ✓ ⌘Z reverts both text and layout changes.

**Phase 4 — Stages.**
Manifest CRUD + `StageTimeline`; stage duplication; `diff/` engine; diff overlay incl. ghost nodes; `MigrationPanel`.
✓ Duplicate stage 00 → 01, delete a table + add a field in 01, toggle diff → red ghost table, green field row, and both listed in the migration panel; clicking a panel row centers the object. ✓ Diff engine unit tests incl. rename detection via `renamedFrom`.

**Phase 5 — Compare mode + polish.**
`CompareView` with synced viewports; edge label dragging; read-only production fallback; keyboard shortcuts (delete key, ⌘Z/⇧⌘Z, esc); empty states; `npm run lint` clean.
✓ Compare 00 vs 02 shows cumulative diff on the right canvas. ✓ `npm run build && npm run preview` serves a working read-only designer.

## 13. Testing

Vitest, colocated `*.test.ts`, pure modules only (`domain/`, `aml/` codecs + round-trip, `diff/`, `layout/`). No component/E2E tests in v1. The AML round-trip test is the load-bearing one: `generateSchema` → `parseSchema` must be lossless for every domain feature, including all custom-property grammars.

## 14. Risks / notes for the implementer

- **Monaco bundle size:** `@monaco-editor/react` lazy-loads from CDN by default; keep that (no `vite-plugin-monaco-editor` needed). The designer page should lazy-import the editor pane so other pages don't pay for it.
- **`@azimutt/aml` API drift:** pin the version; verify the exact export names (`parseAml`, `generateAml`, `monaco` helpers) against the installed package before wiring, and confine every `@azimutt/*` import to `aml/` (+ the seed script).
- **React Flow controlled state:** nodes/edges are derived from the store every render (`buildFlow`); apply React Flow's `onNodesChange` only for position/selection changes, never as a second source of structural truth.
- **`useUpdateNodeInternals`** must be called when a table's field list or collapsed state changes (handles move) — the existing `SchemaNode` shows the pattern.
- **Handle IDs** must stay `field-<name>` format for stable edge anchoring across renames (rename = edge key change; the layout entry for the old edge key is dropped).
