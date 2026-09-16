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
  /** Isolated to this stage; not inherited. */
  groups?: Record<string, GroupLayout>;
}

export const GROUP_COLORS = ["purple", "cyan", "amber", "green", "pink", "red", "blue"] as const;
export type GroupColor = (typeof GROUP_COLORS)[number];
export const GROUP_NODE_PREFIX = "group:";

export function groupNodeId(id: string): string {
  return `${GROUP_NODE_PREFIX}${id}`;
}

export function groupIdFromNode(nodeId: string): string | null {
  return nodeId.startsWith(GROUP_NODE_PREFIX) ? nodeId.slice(GROUP_NODE_PREFIX.length) : null;
}

export interface GroupLayout {
  id: string;
  label: string;
  color: GroupColor;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LayoutDoc {
  version: 1;
  base: LayoutLayer;
  stages: Record<string, LayoutLayer>;
  /** @deprecated Top-level groups migrate onto the first stage's layer. */
  groups?: Record<string, GroupLayout>;
}

export interface ResolvedLayout {
  nodes: Record<string, NodeLayout>;
  edges: Record<string, EdgeLayout>;
  groups: Record<string, GroupLayout>;
}

export function emptyLayoutDoc(): LayoutDoc {
  return { version: 1, base: { nodes: {}, edges: {}, groups: {} }, stages: {}, groups: {} };
}

export function emptyLayer(): LayoutLayer {
  return { nodes: {}, edges: {}, groups: {} };
}
