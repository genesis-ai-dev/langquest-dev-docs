import { relationKey, type DbFunction, type EnumType, type Field, type Policy, type Relation, type Schema, type Table, type Trigger } from "../domain/types";
import { emptyStageDiff, type ChangeKind, type FieldDiff, type NamedDiff, type PropertyChange, type RelationDiff, type StageDiff, type TableDiff } from "./types";

function str(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

function prop(property: string, from: unknown, to: unknown): PropertyChange | null {
  const a = str(from);
  const b = str(to);
  if (a === b) return null;
  return { property, from: a, to: b };
}

function collect(...changes: Array<PropertyChange | null>): PropertyChange[] {
  return changes.filter((c): c is PropertyChange => c != null);
}

function triggerKey(t: Trigger): string {
  return `${t.timing} ${t.events.join(",")}${t.condition ? ` when (${t.condition})` : ""}: ${t.fn}`;
}

function policyKey(p: Policy): string {
  return `${p.command}${p.role ? ` to ${p.role}` : ""}: ${p.using ?? ""}${p.check ? ` check ${p.check}` : ""}`;
}

function matchByName<T extends { name: string; renamedFrom?: string }>(
  before: T[],
  after: T[],
): Array<{ before?: T; after?: T; kind: ChangeKind }> {
  const usedBefore = new Set<number>();
  const pairs: Array<{ before?: T; after?: T; kind: ChangeKind }> = [];

  for (const item of after) {
    const renameIdx = item.renamedFrom
      ? before.findIndex((b, i) => !usedBefore.has(i) && b.name === item.renamedFrom)
      : -1;
    if (renameIdx >= 0) {
      usedBefore.add(renameIdx);
      pairs.push({ before: before[renameIdx], after: item, kind: "renamed" });
      continue;
    }
    const sameIdx = before.findIndex((b, i) => !usedBefore.has(i) && b.name === item.name);
    if (sameIdx >= 0) {
      usedBefore.add(sameIdx);
      pairs.push({ before: before[sameIdx], after: item, kind: "modified" });
    } else {
      pairs.push({ after: item, kind: "added" });
    }
  }
  before.forEach((item, i) => {
    if (!usedBefore.has(i)) pairs.push({ before: item, kind: "removed" });
  });
  return pairs;
}

function fieldChanges(before: Field, after: Field): PropertyChange[] {
  return collect(
    prop("type", before.type, after.type),
    prop("nullable", before.nullable, after.nullable),
    prop("pk", before.pk, after.pk),
    prop("default", before.default, after.default),
    prop("doc", before.doc, after.doc),
  );
}

function tableProps(before: Table, after: Table): PropertyChange[] {
  return collect(prop("doc", before.doc, after.doc), prop("rlsEnabled", before.rlsEnabled, after.rlsEnabled));
}

function diffFields(before: Field[], after: Field[]): FieldDiff[] {
  const out: FieldDiff[] = [];
  for (const { before: b, after: a, kind } of matchByName(before, after)) {
    if (kind === "added" && a) {
      out.push({ name: a.name, kind: "added", changes: [] });
      continue;
    }
    if (kind === "removed" && b) {
      out.push({ name: b.name, kind: "removed", changes: [] });
      continue;
    }
    if (!a || !b) continue;
    const changes = fieldChanges(b, a);
    if (kind === "renamed") {
      out.push({ name: a.name, kind: "renamed", renamedFrom: b.name, changes });
      continue;
    }
    if (changes.length) out.push({ name: a.name, kind: "modified", changes });
  }
  return out;
}

function diffNamedList<T>(
  before: T[],
  after: T[],
  keyOf: (item: T) => string,
): NamedDiff[] {
  const beforeMap = new Map(before.map((item) => [keyOf(item), item]));
  const afterMap = new Map(after.map((item) => [keyOf(item), item]));
  const diffs: NamedDiff[] = [];
  for (const [key] of afterMap) {
    if (!beforeMap.has(key)) diffs.push({ name: key, kind: "added", changes: [] });
  }
  for (const [key] of beforeMap) {
    if (!afterMap.has(key)) diffs.push({ name: key, kind: "removed", changes: [] });
  }
  return diffs;
}

function functionChanges(before: DbFunction, after: DbFunction): PropertyChange[] {
  return collect(
    prop("returns", before.returns, after.returns),
    prop("security", before.security, after.security),
    prop("language", before.language, after.language),
    prop("touches", before.touches, after.touches),
    prop("params", before.params, after.params),
    prop("doc", before.doc, after.doc),
  );
}

function enumChanges(before: EnumType, after: EnumType): PropertyChange[] {
  return collect(prop("values", before.values, after.values), prop("doc", before.doc, after.doc));
}

function relationChanges(before: Relation, after: Relation): PropertyChange[] {
  return collect(prop("cardinality", before.cardinality, after.cardinality), prop("doc", before.doc, after.doc));
}

function allAdded(after: Schema): StageDiff {
  return {
    tables: after.tables.map((t) => ({
      name: t.name,
      kind: "added",
      fields: t.fields.map((f) => ({ name: f.name, kind: "added", changes: [] })),
      triggers: t.triggers.map((tr) => ({ name: triggerKey(tr), kind: "added", changes: [] })),
      policies: t.policies.map((p) => ({ name: policyKey(p), kind: "added", changes: [] })),
      changes: [],
    })),
    enums: after.enums.map((e) => ({ name: e.name, kind: "added", changes: [] })),
    functions: after.functions.map((f) => ({ name: f.name, kind: "added", changes: [] })),
    relations: after.relations.map((r) => ({ name: relationKey(r), kind: "added", changes: [] })),
  };
}

export function computeDiff(before: Schema | null, after: Schema): StageDiff {
  if (!before) return allAdded(after);

  const tables: TableDiff[] = [];
  for (const pair of matchByName(before.tables, after.tables)) {
    if (pair.kind === "added" && pair.after) {
      tables.push({
        name: pair.after.name,
        kind: "added",
        fields: pair.after.fields.map((f) => ({ name: f.name, kind: "added", changes: [] })),
        triggers: pair.after.triggers.map((t) => ({ name: triggerKey(t), kind: "added", changes: [] })),
        policies: pair.after.policies.map((p) => ({ name: policyKey(p), kind: "added", changes: [] })),
        changes: [],
      });
      continue;
    }
    if (pair.kind === "removed" && pair.before) {
      tables.push({
        name: pair.before.name,
        kind: "removed",
        fields: pair.before.fields.map((f) => ({ name: f.name, kind: "removed", changes: [] })),
        triggers: pair.before.triggers.map((t) => ({ name: triggerKey(t), kind: "removed", changes: [] })),
        policies: pair.before.policies.map((p) => ({ name: policyKey(p), kind: "removed", changes: [] })),
        changes: [],
      });
      continue;
    }
    if (!pair.before || !pair.after) continue;
    const fields = diffFields(pair.before.fields, pair.after.fields);
    const triggers = diffNamedList(pair.before.triggers, pair.after.triggers, triggerKey);
    const policies = diffNamedList(pair.before.policies, pair.after.policies, policyKey);
    const changes = tableProps(pair.before, pair.after);
    const renamed = pair.kind === "renamed";
    if (!renamed && fields.length === 0 && triggers.length === 0 && policies.length === 0 && changes.length === 0) {
      continue;
    }
    tables.push({
      name: pair.after.name,
      kind: renamed ? "renamed" : "modified",
      renamedFrom: renamed ? pair.before.name : undefined,
      fields,
      triggers,
      policies,
      changes,
    });
  }

  const enums: NamedDiff[] = [];
  for (const { before: b, after: a, kind } of matchByName(before.enums, after.enums)) {
    if (kind === "added" && a) enums.push({ name: a.name, kind: "added", changes: [] });
    else if (kind === "removed" && b) enums.push({ name: b.name, kind: "removed", changes: [] });
    else if (a && b) {
      const changes = enumChanges(b, a);
      if (kind === "renamed") enums.push({ name: a.name, kind: "renamed", renamedFrom: b.name, changes });
      else if (changes.length) enums.push({ name: a.name, kind: "modified", changes });
    }
  }

  const functions: NamedDiff[] = [];
  for (const { before: b, after: a, kind } of matchByName(before.functions, after.functions)) {
    if (kind === "added" && a) functions.push({ name: a.name, kind: "added", changes: [] });
    else if (kind === "removed" && b) functions.push({ name: b.name, kind: "removed", changes: [] });
    else if (a && b) {
      const changes = functionChanges(b, a);
      if (kind === "renamed") functions.push({ name: a.name, kind: "renamed", renamedFrom: b.name, changes });
      else if (changes.length) functions.push({ name: a.name, kind: "modified", changes });
    }
  }

  const relations: RelationDiff[] = [];
  const beforeRels = new Map(before.relations.map((r) => [relationKey(r), r]));
  const afterRels = new Map(after.relations.map((r) => [relationKey(r), r]));
  for (const [key, rel] of afterRels) {
    const prev = beforeRels.get(key);
    if (!prev) {
      relations.push({ name: key, kind: "added", changes: [] });
      continue;
    }
    const changes = relationChanges(prev, rel);
    if (changes.length) relations.push({ name: key, kind: "modified", changes });
  }
  for (const [key] of beforeRels) {
    if (!afterRels.has(key)) relations.push({ name: key, kind: "removed", changes: [] });
  }

  return { tables, enums, functions, relations };
}

export { emptyStageDiff };
