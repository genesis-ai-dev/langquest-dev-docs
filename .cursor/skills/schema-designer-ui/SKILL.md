---
name: schema-designer-ui
description: Visual and interaction conventions for the Schema Designer UI — theme tokens, node/edge styling, diff color palette, inline-edit behavior, and React Flow 12 patterns. Use when building or modifying any component under app/src/schema-designer/components/ or flow/, or styling the designer page.
---

# Schema Designer UI Conventions

The designer must look native to the existing app. Reference implementations: `app/src/components/SchemaNode.tsx` (table card look, field rows, invisible field handles), `DiagramShell.tsx`, `Header.tsx`.

## Theme

Use only the tokens from `app/src/index.css` via Tailwind utilities (`bg-card`, `border-border`, `text-txt-dim`, `text-accent-purple`, …). Both dark and light themes must work — never hardcode hex colors; the tokens flip automatically. Monospace (`font-mono`) for identifiers/types, sans for prose. Combine classes with `cn` from `app/src/cn.ts` only.

## Node & edge styling

- **TableNode**: evolve the existing `SchemaNode` card (rounded-[10px], `bg-card`, `border-border`, hover `border-border-hi`). pk rows keep the cyan left rule + `pk` badge; fk rows the purple rule + `fk` badge. Add small count badges in the header for triggers (`⚡n`, amber) and RLS (`🛡n`, blue) — clicking selects the table and opens the inspector.
- **FunctionNode**: visually distinct from tables — dashed border, `text-accent-pink` title prefixed `fn`, parameter list in dim mono. Smaller than tables.
- **RelationEdge**: bezier, `stroke: var(--color-edge-fk)`; cardinality as tiny mono labels (`1`, `n`) near each end; selected edge uses `--color-edge-dot` at full opacity. `touchesEdge`: dashed, pink, no cardinality.
- **Handles**: keep the invisible per-field handle pattern with ids `field-<name>`; call `useUpdateNodeInternals` whenever the field list or collapsed state changes.
- **FK tags**: an FK field can pin its destination as a schematic-style tag (`⊥ table`) instead of drawing a wire. Persist `stub: true` on that edge in `layout.json`. Clicking the tag focuses that table (`setCenter`). Hub tables show `⊥n` to pin/unpin all incoming FKs. Diff/compare always draws wires.

## Diff palette (used by nodes, edges, migration panel — keep identical everywhere)

| Kind | Treatment |
|---|---|
| added | `--color-accent-green` border/left-rule + `+` badge |
| removed | `--color-accent-red`, ghost style: 45% opacity, dashed border, struck-through text |
| modified | `--color-accent-amber` + `~` badge; tooltip lists `property: from → to` |
| renamed | `--color-accent-blue` + badge `was: old_name` |

Ghost nodes are selectable (to read them) but not editable or connectable.

## Interaction rules

- Inline edit: double-click to enter, Enter commits, Esc cancels, blur commits. Invalid input (duplicate/empty name) shakes the field and keeps edit mode with a red border — never silently drops input.
- Type field is a combobox: free text + suggestions (common Postgres types first, then defined enums).
- Delete key deletes the current selection (with edges cascading); no confirm dialog — undo (⌘Z) is the safety net. Deleting a *stage* does confirm.
- Keyboard shortcuts must not fire while focus is inside Monaco or any input.
- Every panel (editor, inspector, migration drawer) is collapsible; persist collapsed state in `localStorage` (`lq-designer-*` keys), not in `layout.json`.
- Save status in the header: `Saved`, `Saving…`, amber `Unsaved`, red `Conflict` (with Reload / Keep-mine actions).

## React Flow 12 patterns

- `nodeTypes` / `edgeTypes` defined at module scope (stable identity).
- Nodes/edges are derived via `buildFlow`, then synced into `useNodesState`. Apply **all** `onNodesChange` events (including `dimensions`) so nodes stay initialized; persist positions on drag stop. Never swap in a freshly built node array while a drag is in progress — that drops `measured` and makes tables vanish mid-drag.
- `fitView` on first load and on stage switch; preserve viewport otherwise. Compare mode: both canvases share one viewport state (`onMove` of either sets it).
- React 19 + Compiler: no manual memoization; write plain components and let the compiler optimize.
