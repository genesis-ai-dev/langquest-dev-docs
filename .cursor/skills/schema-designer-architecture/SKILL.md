---
name: schema-designer-architecture
description: Layering rules, module boundaries, and state-management conventions for the Schema Designer feature in app/src/schema-designer/. Use when implementing, reviewing, or refactoring any code for the schema designer page, its Vite file-API plugin, or its tests.
---

# Schema Designer Architecture

The feature lives entirely in `app/src/schema-designer/` (plus `app/vite-plugin-schema-fs.ts`). The spec is `plan-schema-designer.md` at the repo root — read it first.

## Layering (dependency direction is one-way)

```
domain  ←  aml, diff, layout          (pure logic ring)
        ←  state                      (zustand store, the only writer)
        ←  flow, editor, persistence  (integration ring)
        ←  components                 (UI)
        ←  SchemaDesignerPage.tsx
```

Hard rules — reject any code that breaks them:

- `domain/`, `diff/`, `layout/` import **nothing** from React, `@xyflow/react`, Monaco, zustand, or `@azimutt/*`. Pure types and pure functions only. All schema edits are pure `(Schema, args) => Schema` operations in `domain/operations.ts` — no mutation.
- `aml/` is the **only** place `@azimutt/aml` (or any `@azimutt/*` type) may be imported. The Azimutt `Database` type must never appear in another module's signature. Same idea for the custom-property grammars (triggers/rls/rpc): only `aml/codecs/*` knows them.
- `state/` is the only writer of application state. Components never call `parseSchema`, `generateSchema`, or the persistence client directly — they dispatch store actions. Derived data (diff, resolved layout, flow nodes) is computed from store state, never stored redundantly by components.
- `flow/buildFlow` is a pure function from store data to React Flow nodes/edges. Sync that output into `useNodesState` and apply every `onNodesChange` (including dimensions). Structure still comes from the domain model; persist positions on drag stop, never replace the node array while dragging.
- `components/` contain no business logic: they render store state and dispatch actions. If a component needs a decision (e.g. "is this field removable?"), that predicate lives in `domain/`.

## Adapter pattern

`aml/` and `persistence/` are adapters behind narrow interfaces defined by their consumers:

```ts
// aml/index.ts — the entire public surface
parseSchema(text: string): { schema: Schema | null; errors: AmlError[] }
generateSchema(schema: Schema): string
```

If `@azimutt/aml`'s API differs from expectations, absorb the difference inside the adapter; never let it leak upward.

## State conventions

- One zustand store, sliced (`projectSlice`, `schemaSlice`, `layoutSlice`, `selectionSlice`); actions named as verbs (`addField`, `activateStage`).
- Undo/redo via `zundo`, tracking `{ amlText, layoutDoc }` only; schema re-derives by parsing on undo.
- Every GUI action follows: domain operation → `generateSchema` → set `amlText` → schedule save. Every text action follows: set `amlText` → debounce parse → replace schema only when valid.

## Code hygiene

- React 19 with the React Compiler: no `useMemo`/`useCallback`/`memo` unless profiling proves the compiler missed it.
- Components under ~200 lines; split by extracting child components, not helper booleans.
- Tailwind class strings combined only with the existing `cn` helper (`app/src/cn.ts`), never template literals.
- Colocated `*.test.ts` (vitest) for every file in `domain/`, `aml/`, `diff/`, `layout/`. The AML round-trip test (`parseSchema(generateSchema(s))` lossless) must be extended with every new domain property.
- Only three files outside the feature folder may be touched: `App.tsx`, `Header.tsx`, `vite.config.ts` (plus `package.json`).

## Review checklist

- [ ] No React/@xyflow/monaco/@azimutt import in `domain/`, `diff/`, `layout/`
- [ ] No `@azimutt/*` import outside `aml/` and the seed script
- [ ] No component calls an adapter or mutates state directly
- [ ] New domain properties covered by round-trip + diff tests
- [ ] `npm run build`, `npm run lint`, `npx vitest run` all pass
