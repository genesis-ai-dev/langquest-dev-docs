import type {
  Cardinality,
  DbFunction,
  EnumType,
  Field,
  Policy,
  Schema,
  Trigger,
} from "./types";
import { emptySchema, relationKey } from "./types";

function clone<T>(value: T): T {
  return structuredClone(value);
}

function uniqueName(existing: Set<string>, base: string): string {
  if (!existing.has(base)) return base;
  let i = 2;
  while (existing.has(`${base}_${i}`)) i += 1;
  return `${base}_${i}`;
}

function dropDanglingRelations(schema: Schema): Schema {
  const tables = new Map(schema.tables.map((t) => [t.name, t]));
  return {
    ...schema,
    relations: schema.relations.filter((r) => {
      const src = tables.get(r.src.table);
      const dst = tables.get(r.dst.table);
      if (!src || !dst) return false;
      return (
        src.fields.some((f) => f.name === r.src.field) &&
        dst.fields.some((f) => f.name === r.dst.field)
      );
    }),
  };
}

export function addTable(schema: Schema, name?: string): Schema {
  const next = clone(schema);
  const taken = new Set(next.tables.map((t) => t.name));
  const tableName = uniqueName(taken, name ?? "table");
  next.tables.push({
    name: tableName,
    rlsEnabled: false,
    fields: [{ name: "id", type: "uuid", nullable: false, pk: true }],
    triggers: [],
    policies: [],
  });
  return next;
}

export function renameTable(schema: Schema, oldName: string, newName: string): Schema {
  const trimmed = newName.trim();
  if (!trimmed || trimmed === oldName) return schema;
  if (schema.tables.some((t) => t.name === trimmed)) return schema;
  const next = clone(schema);
  const table = next.tables.find((t) => t.name === oldName);
  if (!table) return schema;
  if (!table.renamedFrom) table.renamedFrom = oldName;
  table.name = trimmed;
  for (const rel of next.relations) {
    if (rel.src.table === oldName) rel.src.table = trimmed;
    if (rel.dst.table === oldName) rel.dst.table = trimmed;
  }
  for (const fn of next.functions) {
    fn.touches = fn.touches.map((t) => (t === oldName ? trimmed : t));
  }
  return next;
}

export function removeTable(schema: Schema, name: string): Schema {
  const next = clone(schema);
  next.tables = next.tables.filter((t) => t.name !== name);
  for (const fn of next.functions) {
    fn.touches = fn.touches.filter((t) => t !== name);
  }
  return dropDanglingRelations(next);
}

export function setTableDoc(schema: Schema, name: string, doc: string | undefined): Schema {
  const next = clone(schema);
  const table = next.tables.find((t) => t.name === name);
  if (!table) return schema;
  table.doc = doc || undefined;
  return next;
}

export function setTableRlsEnabled(schema: Schema, name: string, enabled: boolean): Schema {
  const next = clone(schema);
  const table = next.tables.find((t) => t.name === name);
  if (!table) return schema;
  table.rlsEnabled = enabled;
  return next;
}

export function setTriggers(schema: Schema, tableName: string, triggers: Trigger[]): Schema {
  const next = clone(schema);
  const table = next.tables.find((t) => t.name === tableName);
  if (!table) return schema;
  table.triggers = triggers;
  return next;
}

export function setPolicies(schema: Schema, tableName: string, policies: Policy[]): Schema {
  const next = clone(schema);
  const table = next.tables.find((t) => t.name === tableName);
  if (!table) return schema;
  table.policies = policies;
  return next;
}

export function addField(schema: Schema, tableName: string, field?: Partial<Field>): Schema {
  const next = clone(schema);
  const table = next.tables.find((t) => t.name === tableName);
  if (!table) return schema;
  const taken = new Set(table.fields.map((f) => f.name));
  const name = uniqueName(taken, field?.name ?? "column");
  table.fields.push({
    name,
    type: field?.type ?? "text",
    nullable: field?.nullable ?? true,
    pk: field?.pk ?? false,
    default: field?.default,
    doc: field?.doc,
  });
  return next;
}

export function updateField(
  schema: Schema,
  tableName: string,
  fieldName: string,
  patch: Partial<Field>,
): Schema {
  const next = clone(schema);
  const table = next.tables.find((t) => t.name === tableName);
  if (!table) return schema;
  const field = table.fields.find((f) => f.name === fieldName);
  if (!field) return schema;
  const nextName = patch.name?.trim();
  if (nextName && nextName !== fieldName) {
    if (table.fields.some((f) => f.name === nextName)) return schema;
    if (!field.renamedFrom) field.renamedFrom = fieldName;
    field.name = nextName;
    for (const rel of next.relations) {
      if (rel.src.table === tableName && rel.src.field === fieldName) rel.src.field = nextName;
      if (rel.dst.table === tableName && rel.dst.field === fieldName) rel.dst.field = nextName;
    }
  }
  if (patch.type !== undefined) field.type = patch.type;
  if (patch.nullable !== undefined) field.nullable = patch.nullable;
  if (patch.pk !== undefined) field.pk = patch.pk;
  if (patch.default !== undefined) field.default = patch.default || undefined;
  if (patch.doc !== undefined) field.doc = patch.doc || undefined;
  return next;
}

export function removeField(schema: Schema, tableName: string, fieldName: string): Schema {
  const next = clone(schema);
  const table = next.tables.find((t) => t.name === tableName);
  if (!table) return schema;
  table.fields = table.fields.filter((f) => f.name !== fieldName);
  return dropDanglingRelations(next);
}

export function moveField(
  schema: Schema,
  tableName: string,
  fieldName: string,
  direction: -1 | 1,
): Schema {
  const next = clone(schema);
  const table = next.tables.find((t) => t.name === tableName);
  if (!table) return schema;
  const i = table.fields.findIndex((f) => f.name === fieldName);
  const j = i + direction;
  if (i < 0 || j < 0 || j >= table.fields.length) return schema;
  const [item] = table.fields.splice(i, 1);
  table.fields.splice(j, 0, item);
  return next;
}

export function addRelation(
  schema: Schema,
  src: { table: string; field: string },
  dst: { table: string; field: string },
  cardinality: Cardinality = "n:1",
): Schema {
  const exists = schema.relations.some(
    (r) =>
      r.src.table === src.table &&
      r.src.field === src.field &&
      r.dst.table === dst.table &&
      r.dst.field === dst.field,
  );
  if (exists) return schema;
  const srcTable = schema.tables.find((t) => t.name === src.table);
  const dstTable = schema.tables.find((t) => t.name === dst.table);
  if (!srcTable?.fields.some((f) => f.name === src.field)) return schema;
  if (!dstTable?.fields.some((f) => f.name === dst.field)) return schema;
  const next = clone(schema);
  next.relations.push({ src: { ...src }, dst: { ...dst }, cardinality });
  return next;
}

export function removeRelation(schema: Schema, key: string): Schema {
  const next = clone(schema);
  next.relations = next.relations.filter(
    (r) => `${r.src.table}.${r.src.field}->${r.dst.table}.${r.dst.field}` !== key,
  );
  return next;
}

export function setRelationCardinality(
  schema: Schema,
  key: string,
  cardinality: Cardinality,
): Schema {
  const next = clone(schema);
  const rel = next.relations.find(
    (r) => `${r.src.table}.${r.src.field}->${r.dst.table}.${r.dst.field}` === key,
  );
  if (!rel) return schema;
  rel.cardinality = cardinality;
  return next;
}

export function upsertFunction(schema: Schema, fn: DbFunction): Schema {
  const next = clone(schema);
  const i = next.functions.findIndex((f) => f.name === fn.name);
  if (i >= 0) next.functions[i] = clone(fn);
  else next.functions.push(clone(fn));
  return next;
}

export function removeFunction(schema: Schema, name: string): Schema {
  const next = clone(schema);
  next.functions = next.functions.filter((f) => f.name !== name);
  return next;
}

export function upsertEnum(schema: Schema, en: EnumType): Schema {
  const next = clone(schema);
  const i = next.enums.findIndex((e) => e.name === en.name);
  if (i >= 0) next.enums[i] = clone(en);
  else next.enums.push(clone(en));
  return next;
}

export function removeEnum(schema: Schema, name: string): Schema {
  const next = clone(schema);
  next.enums = next.enums.filter((e) => e.name !== name);
  return next;
}

export function importTables(target: Schema, source: Schema, names: string[]): Schema {
  const want = new Set(names);
  const next = clone(target);
  const taken = new Set(next.tables.map((t) => t.name));
  const imported = new Set<string>();
  for (const table of source.tables) {
    if (!want.has(table.name) || taken.has(table.name)) continue;
    const copy = clone(table);
    delete copy.renamedFrom;
    for (const field of copy.fields) delete field.renamedFrom;
    next.tables.push(copy);
    taken.add(table.name);
    imported.add(table.name);
  }
  const importedTypes = new Set(
    next.tables.filter((t) => imported.has(t.name)).flatMap((t) => t.fields.map((f) => f.type)),
  );
  const haveEnums = new Set(next.enums.map((e) => e.name));
  for (const en of source.enums) {
    if (!importedTypes.has(en.name) || haveEnums.has(en.name)) continue;
    next.enums.push(clone(en));
    haveEnums.add(en.name);
  }
  const haveTables = new Set(next.tables.map((t) => t.name));
  const haveRels = new Set(next.relations.map((r) => relationKey(r)));
  for (const rel of source.relations) {
    if (!imported.has(rel.src.table) && !imported.has(rel.dst.table)) continue;
    if (!haveTables.has(rel.src.table) || !haveTables.has(rel.dst.table)) continue;
    const key = relationKey(rel);
    if (haveRels.has(key)) continue;
    next.relations.push(clone(rel));
    haveRels.add(key);
  }
  return next;
}

export function stripRenamedFrom(schema: Schema): Schema {
  const next = clone(schema);
  for (const table of next.tables) {
    delete table.renamedFrom;
    for (const field of table.fields) delete field.renamedFrom;
  }
  return next;
}

export function canRename(schema: Schema, tableName: string, nextName: string): boolean {
  const trimmed = nextName.trim();
  if (!trimmed) return false;
  return !schema.tables.some((t) => t.name === trimmed && t.name !== tableName);
}

export function canRenameField(
  schema: Schema,
  tableName: string,
  fieldName: string,
  nextName: string,
): boolean {
  const trimmed = nextName.trim();
  if (!trimmed) return false;
  const table = schema.tables.find((t) => t.name === tableName);
  if (!table) return false;
  return !table.fields.some((f) => f.name === trimmed && f.name !== fieldName);
}

export { emptySchema };
