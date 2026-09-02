import { generateAml, parseAml, type Database, type Entity, type Relation as AmlRelation } from "@azimutt/aml";
import type {
  Cardinality,
  DbFunction,
  ExtraProps,
  Field,
  Relation,
  Schema,
  Table,
} from "../domain/types";
import { emptySchema } from "../domain/types";
import { parsePolicyList, serializePolicy, isRlsEnabled } from "./codecs/rls";
import { parseTriggerList, serializeTrigger } from "./codecs/triggers";
import type { AmlError } from "./types";

export type { AmlError } from "./types";

const ENTITY_CONSUMED = new Set([
  "line",
  "statement",
  "triggers",
  "rls",
  "rlsEnabled",
  "renamedFrom",
  "kind",
  "returns",
  "security",
  "touches",
  "language",
]);

const ATTR_CONSUMED = new Set([
  "line",
  "statement",
  "autoIncrement",
  "hidden",
  "renamedFrom",
]);

const REL_CONSUMED = new Set([
  "line",
  "statement",
  "inline",
  "natural",
  "onUpdate",
  "onDelete",
  "srcAlias",
  "refAlias",
]);

const TYPE_CONSUMED = new Set(["line", "statement", "inline"]);

function leftoverExtras(
  extra: Record<string, unknown> | undefined,
  consumed: Set<string>,
): ExtraProps | undefined {
  if (!extra) return undefined;
  const out: ExtraProps = {};
  for (const [key, value] of Object.entries(extra)) {
    if (consumed.has(key)) continue;
    out[key] = value;
  }
  return Object.keys(out).length ? out : undefined;
}

function stringifyDefault(value: unknown): string | undefined {
  if (value == null) return undefined;
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function attrName(attrs: string[][] | undefined): string {
  return attrs?.[0]?.[0] ?? "";
}

function mapField(attr: NonNullable<Entity["attrs"]>[number], pkNames: Set<string>): Field {
  const extras = leftoverExtras(attr.extra as ExtraProps | undefined, ATTR_CONSUMED);
  const renamedFrom = attr.extra?.renamedFrom;
  return {
    name: attr.name,
    type: attr.type ?? "text",
    nullable: attr.null === true,
    pk: pkNames.has(attr.name),
    default: stringifyDefault(attr.default),
    doc: attr.doc,
    renamedFrom: typeof renamedFrom === "string" ? renamedFrom : undefined,
    extras,
  };
}

function mapTable(
  entity: Entity,
  warnings: AmlError[],
): Table {
  const extra = (entity.extra ?? {}) as ExtraProps;
  const pkNames = new Set((entity.pk?.attrs ?? []).map((path) => path[0]).filter(Boolean));
  const { triggers, warnings: triggerWarns } = parseTriggerList(extra.triggers);
  const { policies, warnings: policyWarns } = parsePolicyList(extra.rls);
  const line = typeof extra.line === "number" ? extra.line : 1;
  for (const w of [...triggerWarns, ...policyWarns]) {
    warnings.push({ message: w.message, line, column: 1, severity: "warning" });
  }
  const renamedFrom = extra.renamedFrom;
  return {
    name: entity.name,
    doc: entity.doc,
    renamedFrom: typeof renamedFrom === "string" ? renamedFrom : undefined,
    rlsEnabled: isRlsEnabled(extra.rlsEnabled),
    fields: (entity.attrs ?? []).map((attr) => mapField(attr, pkNames)),
    triggers,
    policies,
    extras: leftoverExtras(extra, ENTITY_CONSUMED),
  };
}

function mapFunction(entity: Entity): DbFunction {
  const extra = (entity.extra ?? {}) as ExtraProps;
  const touchesRaw = extra.touches;
  const touches = Array.isArray(touchesRaw)
    ? touchesRaw.filter((t): t is string => typeof t === "string")
    : [];
  const security = extra.security === "invoker" || extra.security === "definer"
    ? extra.security
    : undefined;
  return {
    name: entity.name,
    params: (entity.attrs ?? []).map((attr) => ({ name: attr.name, type: attr.type ?? "text" })),
    returns: typeof extra.returns === "string" ? extra.returns : undefined,
    security,
    language: typeof extra.language === "string" ? extra.language : undefined,
    touches,
    doc: entity.doc,
    extras: leftoverExtras(extra, ENTITY_CONSUMED),
  };
}

function mapRelation(rel: AmlRelation): Relation | null {
  const srcField = attrName(rel.src.attrs);
  const dstField = attrName(rel.ref.attrs);
  if (!rel.src.entity || !rel.ref.entity || !srcField || !dstField) return null;
  const cardinality: Cardinality = rel.src.cardinality === "1" ? "1:1" : "n:1";
  return {
    src: {
      table: rel.src.schema ? `${rel.src.schema}.${rel.src.entity}` : rel.src.entity,
      field: srcField,
    },
    dst: {
      table: rel.ref.schema ? `${rel.ref.schema}.${rel.ref.entity}` : rel.ref.entity,
      field: dstField,
    },
    cardinality,
    doc: rel.doc,
    extras: leftoverExtras(rel.extra as ExtraProps | undefined, REL_CONSUMED),
  };
}

function toDomain(db: Database, warnings: AmlError[]): Schema {
  const schema = emptySchema();
  for (const entity of db.entities ?? []) {
    if (entity.schema === "rpc") schema.functions.push(mapFunction(entity));
    else schema.tables.push(mapTable(entity, warnings));
  }
  for (const rel of db.relations ?? []) {
    const mapped = mapRelation(rel);
    if (mapped) schema.relations.push(mapped);
  }
  for (const type of db.types ?? []) {
    if (!type.values) continue;
    schema.enums.push({
      name: type.name,
      values: type.values,
      doc: type.doc,
      extras: leftoverExtras(type.extra as ExtraProps | undefined, TYPE_CONSUMED),
    });
  }
  return schema;
}

function fieldToAttr(field: Field): NonNullable<Entity["attrs"]>[number] {
  const extra: ExtraProps = { ...(field.extras ?? {}) };
  if (field.renamedFrom) extra.renamedFrom = field.renamedFrom;
  return {
    name: field.name,
    type: field.type,
    null: field.nullable || undefined,
    default: field.default,
    doc: field.doc,
    extra: Object.keys(extra).length ? extra : undefined,
  };
}

function tableToEntity(table: Table): Entity {
  const pkNames = table.fields.filter((f) => f.pk).map((f) => f.name);
  const extra: ExtraProps = { ...(table.extras ?? {}) };
  if (table.rlsEnabled) extra.rlsEnabled = null;
  if (table.renamedFrom) extra.renamedFrom = table.renamedFrom;
  if (table.triggers.length) extra.triggers = table.triggers.map(serializeTrigger);
  if (table.policies.length) extra.rls = table.policies.map(serializePolicy);
  return {
    name: table.name,
    doc: table.doc,
    attrs: table.fields.map((f) => fieldToAttr(f)),
    pk: pkNames.length ? { attrs: pkNames.map((n) => [n]) } : undefined,
    extra: Object.keys(extra).length ? extra : undefined,
  };
}

function functionToEntity(fn: DbFunction): Entity {
  const extra: ExtraProps = { ...(fn.extras ?? {}), kind: "function" };
  if (fn.returns) extra.returns = fn.returns;
  if (fn.security) extra.security = fn.security;
  if (fn.language) extra.language = fn.language;
  if (fn.touches.length) extra.touches = fn.touches;
  return {
    schema: "rpc",
    name: fn.name,
    doc: fn.doc,
    attrs: fn.params.map((p) => ({ name: p.name, type: p.type })),
    extra,
  };
}

function splitEntityRef(name: string): { schema?: string; entity: string } {
  const i = name.indexOf(".");
  if (i < 0) return { entity: name };
  return { schema: name.slice(0, i), entity: name.slice(i + 1) };
}

function relationToAml(rel: Relation): AmlRelation {
  const src = splitEntityRef(rel.src.table);
  const dst = splitEntityRef(rel.dst.table);
  return {
    src: {
      ...src,
      attrs: [[rel.src.field]],
      cardinality: rel.cardinality === "1:1" ? "1" : undefined,
    },
    ref: {
      ...dst,
      attrs: [[rel.dst.field]],
    },
    doc: rel.doc,
    extra: { inline: true, ...(rel.extras ?? {}) },
  };
}

function toAzimutt(schema: Schema): Database {
  return {
    entities: [
      ...schema.tables.map(tableToEntity),
      ...schema.functions.map(functionToEntity),
    ],
    relations: schema.relations.map(relationToAml),
    types: schema.enums.map((en) => ({
      name: en.name,
      values: en.values,
      doc: en.doc,
      extra: en.extras,
    })),
  };
}

export function parseSchema(amlText: string): { schema: Schema | null; errors: AmlError[] } {
  const parsed = parseAml(amlText);
  const errors: AmlError[] = (parsed.errors ?? []).map((e) => ({
    message: e.message,
    line: e.position?.start.line ?? 1,
    column: e.position?.start.column ?? 1,
    severity: e.level === "error" ? "error" : "warning",
  }));
  if (!parsed.result) return { schema: null, errors };
  const warnings: AmlError[] = [];
  const schema = toDomain(parsed.result, warnings);
  return { schema, errors: [...errors, ...warnings] };
}

export function generateSchema(schema: Schema): string {
  return generateAml(toAzimutt(schema));
}

