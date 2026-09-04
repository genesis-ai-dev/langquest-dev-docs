import type { Edge, Node } from "@xyflow/react";
import { MarkerType } from "@xyflow/react";
import type { ChangeKind, StageDiff, TableDiff } from "../diff/types";
import { functionNodeKey, relationKey, type Schema } from "../domain/types";
import type { ResolvedLayout } from "../layout/types";
import type { Selection, ViewMode } from "../state/store";
import type { FkRef, FunctionNodeData, RelationEdgeData, TableNodeData } from "./types";

export interface BuildFlowInput {
  schema: Schema;
  prevSchema: Schema | null;
  diff: StageDiff | null;
  resolvedLayout: ResolvedLayout;
  prevResolvedLayout: ResolvedLayout;
  viewMode: ViewMode;
  selection: Selection | null;
  readOnly: boolean;
  showDiff: boolean;
}

function tableDiffOf(diff: StageDiff | null, name: string): TableDiff | undefined {
  return diff?.tables.find((t) => t.name === name);
}

function selectedId(selection: Selection | null): string | null {
  if (!selection) return null;
  if (selection.kind === "table" || selection.kind === "function" || selection.kind === "ghost") {
    return selection.key;
  }
  return null;
}

export function buildFlow(input: BuildFlowInput): { nodes: Node[]; edges: Edge[] } {
  const {
    schema,
    prevSchema,
    diff,
    resolvedLayout,
    prevResolvedLayout,
    selection,
    readOnly,
    showDiff,
  } = input;
  const sel = selectedId(selection);
  const enumNames = schema.enums.map((e) => e.name);
  const fkFields = new Map<string, string[]>();
  const fkRefs = new Map<string, FkRef[]>();
  const incoming = new Map<string, string[]>();
  for (const rel of schema.relations) {
    const key = relationKey(rel);
    const stubbed = !showDiff && !!resolvedLayout.edges[key]?.stub;
    const srcList = fkFields.get(rel.src.table) ?? [];
    srcList.push(rel.src.field);
    fkFields.set(rel.src.table, srcList);
    const refs = fkRefs.get(rel.src.table) ?? [];
    refs.push({
      edgeKey: key,
      srcField: rel.src.field,
      destTable: rel.dst.table,
      destField: rel.dst.field,
      stubbed,
    });
    fkRefs.set(rel.src.table, refs);
    const incomingKeys = incoming.get(rel.dst.table) ?? [];
    incomingKeys.push(key);
    incoming.set(rel.dst.table, incomingKeys);
  }

  const nodes: Node[] = [];

  for (const table of schema.tables) {
    const pos = resolvedLayout.nodes[table.name] ?? { x: 80, y: 80 };
    const tDiff = showDiff ? tableDiffOf(diff, table.name) : undefined;
    const ghostFields = showDiff
      ? (tDiff?.fields.filter((f) => f.kind === "removed") ?? [])
      : [];
    nodes.push({
      id: table.name,
      type: "tableNode",
      position: { x: pos.x, y: pos.y },
      selected: sel === table.name,
      data: {
        table,
        collapsed: pos.collapsed ?? false,
        diffKind: tDiff?.kind,
        tableDiff: tDiff,
        ghostFields,
        fkFields: fkFields.get(table.name) ?? [],
        fkRefs: fkRefs.get(table.name) ?? [],
        incomingEdgeKeys: incoming.get(table.name) ?? [],
        incomingAllStubbed:
          (incoming.get(table.name) ?? []).length > 0 &&
          (incoming.get(table.name) ?? []).every((key) => !showDiff && !!resolvedLayout.edges[key]?.stub),
        enumNames,
        readOnly,
      } satisfies TableNodeData,
    });
  }

  for (const fn of schema.functions) {
    const key = functionNodeKey(fn.name);
    const pos = resolvedLayout.nodes[key] ?? { x: 80, y: 80 };
    const fDiff = showDiff ? diff?.functions.find((f) => f.name === fn.name) : undefined;
    nodes.push({
      id: key,
      type: "functionNode",
      position: { x: pos.x, y: pos.y },
      selected: sel === key || sel === fn.name,
      data: {
        fn,
        collapsed: pos.collapsed ?? false,
        diffKind: fDiff?.kind,
        readOnly,
      } satisfies FunctionNodeData,
    });
  }

  if (showDiff && prevSchema && diff) {
    for (const tDiff of diff.tables) {
      if (tDiff.kind !== "removed") continue;
      const prev = prevSchema.tables.find((t) => t.name === tDiff.name);
      if (!prev) continue;
      const pos = prevResolvedLayout.nodes[prev.name] ?? { x: 80, y: 80 };
      nodes.push({
        id: `ghost:${prev.name}`,
        type: "tableNode",
        position: { x: pos.x, y: pos.y },
        selectable: true,
        draggable: false,
        connectable: false,
        selected: sel === `ghost:${prev.name}`,
        data: {
          table: prev,
          collapsed: pos.collapsed ?? false,
          diffKind: "removed",
          tableDiff: tDiff,
          ghostFields: [],
          fkFields: [],
          fkRefs: [],
          incomingEdgeKeys: [],
          incomingAllStubbed: false,
          enumNames,
          readOnly: true,
          ghost: true,
        } satisfies TableNodeData,
      });
    }
  }

  const edges: Edge[] = [];

  for (const rel of schema.relations) {
    const key = relationKey(rel);
    if (!showDiff && resolvedLayout.edges[key]?.stub) continue;
    const eDiff = showDiff ? diff?.relations.find((r) => r.name === key) : undefined;
    const edgeLayout = resolvedLayout.edges[key];
    edges.push({
      id: key,
      type: "relationEdge",
      source: rel.src.table,
      target: rel.dst.table,
      sourceHandle: `field-${rel.src.field}`,
      targetHandle: `field-${rel.dst.field}`,
      selected: selection?.kind === "relation" && selection.key === key,
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: "var(--color-edge-dot)",
        width: 12,
        height: 12,
      },
      data: {
        edgeKey: key,
        cardinality: rel.cardinality,
        kind: eDiff?.kind,
        midX: edgeLayout?.midX,
        labelOffset: edgeLayout?.labelOffset,
      } satisfies RelationEdgeData,
    });
  }

  if (showDiff && prevSchema && diff) {
    for (const rDiff of diff.relations) {
      if (rDiff.kind !== "removed") continue;
      const prev = prevSchema.relations.find((r) => relationKey(r) === rDiff.name);
      if (!prev) continue;
      const srcExists = schema.tables.some((t) => t.name === prev.src.table) ||
        nodes.some((n) => n.id === `ghost:${prev.src.table}`);
      const dstExists = schema.tables.some((t) => t.name === prev.dst.table) ||
        nodes.some((n) => n.id === `ghost:${prev.dst.table}`);
      if (!srcExists || !dstExists) continue;
      edges.push({
        id: `ghost:${rDiff.name}`,
        type: "relationEdge",
        source: schema.tables.some((t) => t.name === prev.src.table)
          ? prev.src.table
          : `ghost:${prev.src.table}`,
        target: schema.tables.some((t) => t.name === prev.dst.table)
          ? prev.dst.table
          : `ghost:${prev.dst.table}`,
        sourceHandle: `field-${prev.src.field}`,
        targetHandle: `field-${prev.dst.field}`,
        selectable: false,
        data: {
          edgeKey: rDiff.name,
          cardinality: prev.cardinality,
          kind: "removed" satisfies ChangeKind,
        } satisfies RelationEdgeData,
      });
    }
  }

  for (const fn of schema.functions) {
    const src = functionNodeKey(fn.name);
    for (const table of fn.touches) {
      if (!schema.tables.some((t) => t.name === table)) continue;
      const key = `${src}->${table}`;
      edges.push({
        id: key,
        type: "relationEdge",
        source: src,
        target: table,
        sourceHandle: "fn",
        targetHandle: "table",
        selectable: false,
        data: {
          edgeKey: key,
          cardinality: "n:1",
          touches: true,
        } satisfies RelationEdgeData,
      });
    }
  }

  return { nodes, edges };
}
