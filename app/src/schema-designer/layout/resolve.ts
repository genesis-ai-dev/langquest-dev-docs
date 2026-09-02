import { emptyLayer, type EdgeLayout, type LayoutDoc, type ResolvedLayout, type XY } from "./types";

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

export function resolveLayout(
  doc: LayoutDoc,
  stageOrder: string[],
  stageId: string,
): ResolvedLayout {
  const resolved: ResolvedLayout = { nodes: {}, edges: {} };
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
