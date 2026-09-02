export type ExtraProps = Record<string, unknown>;

export interface Schema {
  tables: Table[];
  enums: EnumType[];
  functions: DbFunction[];
  relations: Relation[];
}

export interface Table {
  name: string;
  doc?: string;
  renamedFrom?: string;
  rlsEnabled: boolean;
  fields: Field[];
  triggers: Trigger[];
  policies: Policy[];
  extras?: ExtraProps;
}

export interface Field {
  name: string;
  type: string;
  nullable: boolean;
  pk: boolean;
  default?: string;
  doc?: string;
  renamedFrom?: string;
  extras?: ExtraProps;
}

export type Cardinality = "n:1" | "1:1" | "n:m";

export interface Relation {
  src: { table: string; field: string };
  dst: { table: string; field: string };
  cardinality: Cardinality;
  doc?: string;
  extras?: ExtraProps;
}

export type TriggerTiming = "before" | "after" | "instead_of";
export type TriggerEvent = "insert" | "update" | "delete" | "truncate";

export interface Trigger {
  timing: TriggerTiming;
  events: TriggerEvent[];
  condition?: string;
  fn: string;
}

export type PolicyCommand = "select" | "insert" | "update" | "delete" | "all";

export interface Policy {
  command: PolicyCommand;
  role?: string;
  using?: string;
  check?: string;
}

export interface DbFunction {
  name: string;
  params: { name: string; type: string }[];
  returns?: string;
  security?: "definer" | "invoker";
  language?: string;
  touches: string[];
  doc?: string;
  extras?: ExtraProps;
}

export interface EnumType {
  name: string;
  values: string[];
  doc?: string;
  extras?: ExtraProps;
}

export function emptySchema(): Schema {
  return { tables: [], enums: [], functions: [], relations: [] };
}

export function relationKey(rel: Relation): string {
  return `${rel.src.table}.${rel.src.field}->${rel.dst.table}.${rel.dst.field}`;
}

export function functionNodeKey(name: string): string {
  return `rpc.${name}`;
}

export function fieldIsFk(schema: Schema, table: string, field: string): boolean {
  return schema.relations.some((r) => r.src.table === table && r.src.field === field);
}
