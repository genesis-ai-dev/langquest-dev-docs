export interface XY {
  x: number;
  y: number;
}

export interface NodeLayout {
  x: number;
  y: number;
  collapsed?: boolean;
}

export interface EdgeLayout {
  labelOffset?: XY;
  midX?: number | null;
  /** Hide the wire and show a destination tag on the FK field instead. */
  stub?: boolean;
}

export interface LayoutLayer {
  nodes: Record<string, Partial<NodeLayout>>;
  edges: Record<string, Partial<EdgeLayout>>;
}

export interface LayoutDoc {
  version: 1;
  base: LayoutLayer;
  stages: Record<string, LayoutLayer>;
}

export interface ResolvedLayout {
  nodes: Record<string, NodeLayout>;
  edges: Record<string, EdgeLayout>;
}

export function emptyLayoutDoc(): LayoutDoc {
  return { version: 1, base: { nodes: {}, edges: {} }, stages: {} };
}

export function emptyLayer(): LayoutLayer {
  return { nodes: {}, edges: {} };
}
