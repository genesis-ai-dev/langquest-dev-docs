export type ChangeKind = "added" | "removed" | "modified" | "renamed";

export interface PropertyChange {
  property: string;
  from: string;
  to: string;
}

export interface NamedDiff {
  name: string;
  kind: ChangeKind;
  renamedFrom?: string;
  changes: PropertyChange[];
}

export interface FieldDiff {
  name: string;
  kind: ChangeKind;
  renamedFrom?: string;
  changes: PropertyChange[];
}

export interface TableDiff {
  name: string;
  kind: ChangeKind;
  renamedFrom?: string;
  fields: FieldDiff[];
  triggers: NamedDiff[];
  policies: NamedDiff[];
  changes: PropertyChange[];
}

export interface RelationDiff {
  name: string;
  kind: ChangeKind;
  changes: PropertyChange[];
}

export interface StageDiff {
  tables: TableDiff[];
  enums: NamedDiff[];
  functions: NamedDiff[];
  relations: RelationDiff[];
}

export function emptyStageDiff(): StageDiff {
  return { tables: [], enums: [], functions: [], relations: [] };
}
