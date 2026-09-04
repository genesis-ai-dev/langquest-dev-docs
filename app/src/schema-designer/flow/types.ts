import type { ChangeKind, FieldDiff, TableDiff } from "../diff/types";
import type { Cardinality, DbFunction, Table } from "../domain/types";
import type { XY } from "../layout/types";

export interface FkRef {
  edgeKey: string;
  srcField: string;
  destTable: string;
  destField: string;
  stubbed: boolean;
}

export interface TableNodeData extends Record<string, unknown> {
  table: Table;
  collapsed: boolean;
  diffKind?: ChangeKind;
  tableDiff?: TableDiff;
  ghostFields: FieldDiff[];
  fkFields: string[];
  fkRefs: FkRef[];
  incomingEdgeKeys: string[];
  incomingAllStubbed: boolean;
  enumNames: string[];
  readOnly: boolean;
  ghost?: boolean;
}

export interface FunctionNodeData extends Record<string, unknown> {
  fn: DbFunction;
  collapsed: boolean;
  diffKind?: ChangeKind;
  readOnly: boolean;
}

export interface RelationEdgeData extends Record<string, unknown> {
  edgeKey: string;
  cardinality: Cardinality;
  kind?: ChangeKind;
  midX?: number | null;
  labelOffset?: XY;
  touches?: boolean;
}

export const COMMON_PG_TYPES = [
  "uuid",
  "text",
  "varchar",
  "integer",
  "bigint",
  "boolean",
  "jsonb",
  "json",
  "timestamptz",
  "timestamp",
  "date",
  "numeric",
  "float",
  "text[]",
  "uuid[]",
  "integer[]",
];
