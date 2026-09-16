import {
  emptyLayer,
  type EdgeLayout,
  type GroupLayout,
  type LayoutDoc,
  type LayoutLayer,
  type ResolvedLayout,
  type XY,
} from "./types";

const EMPTY_GROUPS: Record<string, GroupLayout> = {};

const CELL_W = 280;
const CELL_H = 220;
const ORIGIN_X = 80;
const ORIGIN_Y = 80;

function mergeLayer(
  target: ResolvedLayout,
  layer: { nodes: Record<string, Partial<{ x: number; y: number; collapsed?: boolean }>>; edges: Record<string, Partial<EdgeLayout>> },
): void {
  for (const [key, node] of Object.entries(layer.nodes)) {
    const prev = target.nodes[key] ?? { x: 0, y: 0 };
    target.nodes[key] = {
      x: node.x ?? prev.x,
      y: node.y ?? prev.y,
      collapsed: node.collapsed ?? prev.collapsed,
    };
  }
  for (const [key, edge] of Object.entries(layer.edges)) {
    const prev = target.edges[key] ?? {};
    target.edges[key] = {
      labelOffset: edge.labelOffset ?? prev.labelOffset,
      midX: edge.midX === undefined ? prev.midX : edge.midX,
      stub: edge.stub === undefined ? prev.stub : edge.stub,
    };
  }
}

export function groupsOnStage(
  doc: LayoutDoc,
  firstStageId: string | null,
  stageId: string,
): Record<string, GroupLayout> {
  if (!firstStageId || stageId === firstStageId) {
    return doc.base.groups && Object.keys(doc.base.groups).length > 0
      ? doc.base.groups
      : (doc.groups ?? EMPTY_GROUPS);
  }
  return doc.stages[stageId]?.groups ?? EMPTY_GROUPS;
}

export function allGroups(doc: LayoutDoc): Record<string, GroupLayout> {
  const out: Record<string, GroupLayout> = { ...(doc.groups ?? {}) };
  Object.assign(out, doc.base.groups ?? {});
  for (const layer of Object.values(doc.stages)) {
    Object.assign(out, layer.groups ?? {});
  }
  return out;
}

export function normalizeLayout(doc: LayoutDoc): LayoutDoc {
  const top = doc.groups ?? {};
  const stages: Record<string, LayoutLayer> = {};
  for (const [id, layer] of Object.entries(doc.stages ?? {})) {
    stages[id] = {
      nodes: layer.nodes ?? {},
      edges: layer.edges ?? {},
      groups: layer.groups ?? {},
    };
  }
  return {
    version: 1,
    base: {
      nodes: doc.base?.nodes ?? {},
      edges: doc.base?.edges ?? {},
      groups: { ...top, ...(doc.base?.groups ?? {}) },
    },
    stages,
    groups: {},
  };
}

export function resolveLayout(
  doc: LayoutDoc,
  stageOrder: string[],
  stageId: string,
): ResolvedLayout {
  const resolved: ResolvedLayout = {
    nodes: {},
    edges: {},
    groups: { ...groupsOnStage(doc, stageOrder[0] ?? null, stageId) },
  };
  mergeLayer(resolved, doc.base);
  const end = stageOrder.indexOf(stageId);
  const through = end < 0 ? stageOrder : stageOrder.slice(0, end + 1);
  for (const id of through) {
    const layer = doc.stages[id];
    if (layer) mergeLayer(resolved, layer);
  }
  return resolved;
}

function writeTarget(doc: LayoutDoc, stageOrder: string[], stageId: string) {
  const first = stageOrder[0];
  if (!first || stageId === first) return { layer: doc.base, intoBase: true };
  const layer = doc.stages[stageId] ?? emptyLayer();
  return { layer, intoBase: false };
}

export function withNodePosition(
  doc: LayoutDoc,
  stageOrder: string[],
  stageId: string,
  nodeKey: string,
  pos: XY,
): LayoutDoc {
  const next: LayoutDoc = structuredClone(doc);
  const { layer, intoBase } = writeTarget(next, stageOrder, stageId);
  layer.nodes[nodeKey] = { ...layer.nodes[nodeKey], x: pos.x, y: pos.y };
  if (!intoBase) next.stages[stageId] = layer;
  return next;
}

export function withNodePositions(
  doc: LayoutDoc,
  stageOrder: string[],
  stageId: string,
  positions: Record<string, XY>,
): LayoutDoc {
  const keys = Object.keys(positions);
  if (keys.length === 0) return doc;
  const next: LayoutDoc = structuredClone(doc);
  const { layer, intoBase } = writeTarget(next, stageOrder, stageId);
  for (const key of keys) {
    const pos = positions[key];
    layer.nodes[key] = { ...layer.nodes[key], x: pos.x, y: pos.y };
  }
  if (!intoBase) next.stages[stageId] = layer;
  return next;
}

export function withGroup(
  doc: LayoutDoc,
  stageOrder: string[],
  stageId: string,
  group: GroupLayout,
): LayoutDoc {
  const next: LayoutDoc = structuredClone(doc);
  const { layer, intoBase } = writeTarget(next, stageOrder, stageId);
  layer.groups = { ...(layer.groups ?? {}), [group.id]: group };
  if (!intoBase) next.stages[stageId] = layer;
  return next;
}

export function withoutGroup(
  doc: LayoutDoc,
  stageOrder: string[],
  stageId: string,
  id: string,
): LayoutDoc {
  const first = stageOrder[0] ?? null;
  if (!groupsOnStage(doc, first, stageId)[id]) return doc;
  const next: LayoutDoc = structuredClone(doc);
  const { layer, intoBase } = writeTarget(next, stageOrder, stageId);
  const rest = { ...(layer.groups ?? {}) };
  if (!(id in rest)) return doc;
  delete rest[id];
  layer.groups = rest;
  if (!intoBase) next.stages[stageId] = layer;
  return next;
}

export function nextGroupId(groups: Record<string, GroupLayout>): string {
  let max = 0;
  for (const id of Object.keys(groups)) {
    const n = Number.parseInt(id.replace(/^g/i, ""), 10);
    if (Number.isFinite(n)) max = Math.max(max, n);
  }
  return `g${max + 1}`;
}

export function withNodeCollapsed(
  doc: LayoutDoc,
  stageOrder: string[],
  stageId: string,
  nodeKey: string,
  collapsed: boolean,
): LayoutDoc {
  const next: LayoutDoc = structuredClone(doc);
  const { layer, intoBase } = writeTarget(next, stageOrder, stageId);
  layer.nodes[nodeKey] = { ...layer.nodes[nodeKey], collapsed };
  if (!intoBase) next.stages[stageId] = layer;
  return next;
}

export function withEdgeLayout(
  doc: LayoutDoc,
  stageOrder: string[],
  stageId: string,
  edgeKey: string,
  patch: EdgeLayout,
): LayoutDoc {
  const next: LayoutDoc = structuredClone(doc);
  const { layer, intoBase } = writeTarget(next, stageOrder, stageId);
  layer.edges[edgeKey] = { ...layer.edges[edgeKey], ...patch };
  if (!intoBase) next.stages[stageId] = layer;
  return next;
}

export function withEdgesStubbed(
  doc: LayoutDoc,
  stageOrder: string[],
  stageId: string,
  edgeKeys: string[],
  stub: boolean,
): LayoutDoc {
  let next = doc;
  for (const key of edgeKeys) {
    next = withEdgeLayout(next, stageOrder, stageId, key, { stub });
  }
  return next;
}

export function autoPlace(existing: ResolvedLayout): XY {
  const taken = new Set(
    Object.values(existing.nodes).map((n) => `${Math.round(n.x / CELL_W)}:${Math.round(n.y / CELL_H)}`),
  );
  for (let row = 0; row < 40; row += 1) {
    for (let col = 0; col < 8; col += 1) {
      const key = `${col}:${row}`;
      if (!taken.has(key)) {
        return { x: ORIGIN_X + col * CELL_W, y: ORIGIN_Y + row * CELL_H };
      }
    }
  }
  return { x: ORIGIN_X, y: ORIGIN_Y + Object.keys(existing.nodes).length * CELL_H };
}

export function ensurePlaced(doc: LayoutDoc, stageOrder: string[], stageId: string, nodeKeys: string[]): LayoutDoc {
  let next = doc;
  let resolved = resolveLayout(next, stageOrder, stageId);
  let changed = false;
  for (const key of nodeKeys) {
    if (resolved.nodes[key]) continue;
    const pos = autoPlace(resolved);
    next = withNodePosition(next, stageOrder, stageId, key, pos);
    resolved = resolveLayout(next, stageOrder, stageId);
    changed = true;
  }
  return changed ? next : doc;
}
