# Recommended Changes — Content & Library Template Systems

Recommendations only. These come out of work on the [review template system](./review-template-system.md) and are **not yet applied** to the content or library docs, because those systems are under active review by other team members. Nothing here has been changed unilaterally — treat each item as a proposal to accept, reject, or adapt.

---

## R1 — Drop the redundant `structure` snapshot from the revision tables

**Applies to:** `template_revision` (content), `library_template_revision` (library). *(Already applied to `workflow_template_revision` in the review system.)*

### The change

Remove the full `structure` JSONB snapshot column from the revision table. Keep only:

- `id`
- `<template>_id` (FK → the template)
- `actions` (the structured diff)
- `saved_by`, `saved_at`

### Why

The snapshot duplicates data that's already preserved elsewhere:

- **Publishing is fork-always.** Every publish inserts a **new immutable template row** that holds the complete `structure`. (Content: C3 "Each publish = new immutable row." Library: same model.)
- **Drafts never hit the server.** All editing happens locally in the browser (IndexedDB) until publish; there are no intermediate server-side saves. So a revision is written **only at publish**, 1:1 with a fork row.
- Therefore the revision's `structure` is byte-for-byte the same as the fork row's `structure` it was created alongside. Snapshotting it again stores the same large blob twice.

The only fields unique to a revision are the **diff** (`actions`) and **authorship** (`saved_by`, `saved_at`).

### The one caveat (minor)

Without a snapshot, reconstructing a past state means replaying `actions` diffs across the fork chain instead of reading one row. In practice you rarely need this — every published structure is already directly readable from its own fork row — so the convenience doesn't justify duplicating multi-MB blobs on every publish.

### Also update the interactive schema

The full combined schema (`app/src/data/combinedSchema.ts`) still shows a `structure` field on:

- `n-template-rev` (`template_revision`)
- `n-lib-rev` (`library_template_revision`)

These should lose the field in tandem with the doc change, mirroring what was already done to `n-wf-rev`. The content-only "Template Design" page (`app/src/data/templateDesign.ts`, node `n-revision`, plus its walkthrough steps) also describes/stores the snapshot and would need the same edit.

---

## R2 — Adopt the shared `TemplateDiff` / `actions` type

The shape of `actions` was previously described **only in prose** (content doc, *Structured revision diffs*) with no TypeScript type. It is now formally defined in the [review template doc](./review-template-system.md) (*Revision diff (`actions`) shape*) as a discriminated union, since all three systems write the identical diff structure:

```typescript
type DiffEntryBase = { nodeId: string; nodeName: string };
type DiffEntry =
  | (DiffEntryBase & { type: 'add';             details: { parentId: string | null; index: number; kind?: string } })
  | (DiffEntryBase & { type: 'remove';          details: { parentId: string | null } })
  | (DiffEntryBase & { type: 'rename';          details: { from: string; to: string } })
  | (DiffEntryBase & { type: 'move';            details: { fromParentId: string | null; toParentId: string | null; fromIndex: number; toIndex: number } })
  | (DiffEntryBase & { type: 'hide';            details: { parentId: string | null } })
  | (DiffEntryBase & { type: 'unhide';          details: { parentId: string | null } })
  | (DiffEntryBase & { type: 'property_change'; details: { property: string; from: unknown; to: unknown } });
type DiffActionType = DiffEntry['type'];
type TemplateDiff = { summary: Partial<Record<DiffActionType, number>>; entries: DiffEntry[] };
```

**Recommendation:** the content and library docs should replace their prose description of `actions` with this same type (ideally one canonical definition the three systems share, rather than three copies).

---

## R3 — Define the `lists` block as a type, and move it to the **content** template

**Applies to:** the `lists` block currently shown (provisional) in the review doc and referenced by `set_project_workflow`. This is cross-system, so it's a recommendation rather than a unilateral change.

### The change

Replace the inline JSON example (`lists: [{id, name, kind}]`) with a named type, and host the block on the **content template**, instantiated when the content template is linked to a project — not on the workflow template via `set_project_workflow`.

```typescript
type TemplateListDef = {
  id: string;        // nanoid, stable
  name: string;
  role: 'key_terms' | 'generic';   // engine only special-cases key_terms (submit-time revision pinning); the rest are generic
};
```

### Why move it to the content template

Journaling and Key Terms must work for **every** project — including projects with **no review workflow** (vote-based approval, where `project.workflow_template_id` is null). The workflow template is optional; the **content template is always present**. Hosting `lists` on the workflow template makes a non-optional feature depend on an optional table. The content template is the natural, always-available home, so list instantiation should hang off content-template linking.

### Notes

- `role` replaces the vague `kind`. Today only `key_terms` needs special engine behavior (revision pinning); everything else is `generic`. New roles should be added only when they change engine/UI behavior.
- This resolves the existing "*which template owns `lists`*" TBD in the review doc.
- If accepted, the review doc's *Template-declared lists (provisional)* section and its `set_project_workflow` instantiation hook should be updated to point at the content-template path.

---

## Notes for reviewers

- R1 is a pure storage/redundancy cleanup — it doesn't change behavior, only stops persisting a duplicate blob.
- If either system has a reason a revision can be written **without** a corresponding fork row (e.g. a future server-side draft/autosave), then R1 does **not** apply to that system — the snapshot would be the only home for that state. As currently documented, neither system does this.
