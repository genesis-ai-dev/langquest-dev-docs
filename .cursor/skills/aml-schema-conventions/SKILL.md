---
name: aml-schema-conventions
description: AML document conventions for the Schema Designer — custom-property grammars for Postgres triggers, RLS policies, and RPC functions, plus stage-file and layout.json formats. Use when writing or editing .aml files under schema-designer/, implementing the aml/ adapter or its codecs, or working with stages.json / layout.json.
---

# AML Schema Conventions

Applies to everything under `schema-designer/` and the `aml/` adapter in `app/src/schema-designer/`. Full context: `plan-schema-designer.md` §5.

## AML basics used here

```aml
type quest_status (draft, active, done)          # enum

quest {rlsEnabled, triggers: ["before insert,update: set_quest_download_profiles"]} | a quest node
  id uuid pk
  parent_id uuid nullable -> quest(id)           # relation inline (n:1)
  name varchar
  status quest_status
  download_profiles "uuid[]" | who flagged for offline sync
```

- Attributes are NOT NULL by default; add `nullable` explicitly (opposite of SQL).
- Quote types containing brackets or spaces: `"uuid[]"`, `"timestamp with time zone"`.
- Use `| doc` for documentation, **never `#` comments** — GUI edits regenerate the file and `#` comments are lost; `|` docs survive the round-trip.
- Relations: `->` = n:1 (FK), `--` = 1:1. Many-to-many = explicit junction table.

## Custom-property grammars

Encoded as AML custom properties; parsed/serialized ONLY by `aml/codecs/*`. Malformed strings become warnings, never crashes. Unknown properties must pass through untouched.

**Triggers** (table property, one string each):

```
{triggers: ["<before|after|instead_of> <event>[,<event>]* [when (<cond>)]: <function_name>"]}
```

Example: `{triggers: ["before insert,update: set_updated_at", "after delete when (OLD.active): cleanup_closure"]}`

**RLS** (table properties): bare flag `{rlsEnabled}` plus policy strings:

```
{rls: ["<select|insert|update|delete|all> [to <role>]: [using] <expr> [check <expr>]"]}
```

Example: `{rls: ["select to authenticated: is_project_member(project_id)", "insert to authenticated: check profile_id = auth.uid()"]}`

**Functions / RPCs** — entities in the `rpc` namespace; attributes = parameters:

```aml
rpc.download_quest_closure {kind: function, returns: void, security: definer, touches: [quest, asset]} | stamps closure
  quest_id uuid
  profile_id uuid
```

`touches` lists table names and renders as dashed edges. `rpc.*` entities map to `DbFunction`, never `Table`.

**Renames** — `{renamedFrom: old_name}` on a table or field makes the diff engine report `renamed` instead of removed+added. Strip all `renamedFrom` properties when duplicating a stage.

## File formats

- `stages/NN-slug.aml` — one full schema snapshot per stage. Numeric prefix is cosmetic; `stages.json` order is authoritative.
- `stages.json` — `{ version, stages: [{ id, file, title, description, status }] }`, status ∈ `live | in-progress | planned | done`.
- `layout.json` — `{ version, base: { nodes, edges }, stages: { <stageId>: { nodes, edges } } }`. Node key = entity name incl. namespace (`quest`, `rpc.foo`); edge key = `srcTable.srcField->dstTable.dstField`. Edge layout may include `midX`, `labelOffset`, and `stub` (hide the wire; show a destination tag on the FK field). Resolution: base, then each stage's override applied in manifest order up to the active stage. Writes: first stage → `base`; later stages → that stage's override.

## Validation loop

After any change to codec logic or hand-edited `.aml` files:

1. `parseSchema(text)` must return zero errors.
2. `parseSchema(generateSchema(schema))` must deep-equal `schema` (round-trip test in `aml/`).
3. If a grammar string can't be parsed, surface it as a `warning` with line/column — keep the raw string intact so it round-trips.
