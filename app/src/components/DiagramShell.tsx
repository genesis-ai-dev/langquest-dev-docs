import {
  ReactFlow,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type NodeTypes,
  type EdgeTypes,
  MarkerType,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useCallback, useEffect, useRef } from "react";
import { SchemaNode, type SchemaNodeData } from "./SchemaNode";
import { SchemaEdge } from "./SchemaEdge";
import { useTheme } from "./ThemeProvider";

const nodeTypes: NodeTypes = { schema: SchemaNode };
const edgeTypes: EdgeTypes = { schema: SchemaEdge };

export interface DiagramNodeDef {
  id: string;
  title: string;
  sub?: string;
  x: number;
  y: number;
  w: number;
  fields: SchemaNodeData["fields"];
  /** Optional accent color (CSS color value) used to group tables by system. */
  tint?: string;
}

export interface DiagramEdgeDef {
  from: string;
  fromField: string;
  to: string;
  toField: string;
  dash?: boolean;
  /** Optional absolute X (flow coords) for the edge's vertical segment. Drag the segment in the diagram to adjust. */
  midX?: number;
}

/** Stable key identifying an edge for layout persistence / copy output. */
export function edgeKeyOf(e: DiagramEdgeDef): string {
  return `${e.from}.${e.fromField}->${e.to}.${e.toField}`;
}

/** Saved per-edge vertical-segment positions for a diagram. */
export function loadEdgeMidXs(storageKey: string): Record<string, number> {
  try {
    const raw = localStorage.getItem(`${storageKey}:edges`);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveEdgeMidX(storageKey: string, edgeKey: string, midX: number | null) {
  try {
    const all = loadEdgeMidXs(storageKey);
    if (midX == null) {
      delete all[edgeKey];
    } else {
      all[edgeKey] = midX;
    }
    localStorage.setItem(`${storageKey}:edges`, JSON.stringify(all));
  } catch {}
}

/** Clears both node positions and edge vertical-segment positions for a diagram. */
export function clearDiagramLayout(storageKey: string) {
  try {
    localStorage.removeItem(storageKey);
    localStorage.removeItem(`${storageKey}:edges`);
  } catch {}
}

function buildNodes(
  defs: DiagramNodeDef[],
  highlighted: string[] | undefined,
): Node[] {
  return defs.map((d) => ({
    id: d.id,
    type: "schema",
    position: { x: d.x, y: d.y },
    data: {
      label: d.title,
      subtitle: d.sub,
      fields: d.fields,
      highlighted: highlighted ? highlighted.includes(d.id) : true,
      tint: d.tint,
    } satisfies SchemaNodeData,
    style: { width: d.w },
    draggable: true,
  }));
}

function buildEdges(
  defs: DiagramEdgeDef[],
  savedMidXs: Record<string, number>,
  onMidXChange: (edgeKey: string, midX: number | null) => void,
): Edge[] {
  return defs.map((e, i) => {
    const key = edgeKeyOf(e);
    return {
      id: `e-${i}-${e.from}-${e.to}`,
      source: e.from,
      sourceHandle: `field-${e.fromField}`,
      target: e.to,
      targetHandle: `field-${e.toField}`,
      type: "schema",
      data: {
        dash: e.dash,
        edgeKey: key,
        midX: savedMidXs[key] ?? e.midX,
        onMidXChange,
      },
      markerEnd: {
        type: MarkerType.Arrow,
        color: "var(--color-edge-dot)",
        width: 12,
        height: 12,
      },
    };
  });
}

export function DiagramShell({
  storageKey,
  nodeDefs,
  edgeDefs,
  highlightedNodes,
  diagramTitle,
}: {
  storageKey: string;
  nodeDefs: DiagramNodeDef[];
  edgeDefs: DiagramEdgeDef[];
  highlightedNodes?: string[];
  diagramTitle?: string;
}) {
  const { theme } = useTheme();
  const initialised = useRef(false);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  const onMidXChange = useCallback(
    (edgeKey: string, midX: number | null) => {
      saveEdgeMidX(storageKey, edgeKey, midX);
    },
    [storageKey],
  );

  // Rebuild nodes/edges when section changes
  useEffect(() => {
    const saved = loadPositions(storageKey);
    const built = buildNodes(nodeDefs, highlightedNodes);
    if (saved) {
      for (const n of built) {
        if (saved[n.id]) {
          n.position = saved[n.id];
        }
      }
    }
    setNodes(built);
    setEdges(buildEdges(edgeDefs, loadEdgeMidXs(storageKey), onMidXChange));
    initialised.current = true;
  }, [storageKey, nodeDefs, edgeDefs, setNodes, setEdges, onMidXChange]); // deliberately exclude highlightedNodes to avoid position reset

  // Update highlighting without resetting positions
  useEffect(() => {
    if (!initialised.current) return;
    setNodes((nds) =>
      nds.map((n) => ({
        ...n,
        data: {
          ...n.data,
          highlighted: highlightedNodes
            ? highlightedNodes.includes(n.id)
            : true,
        },
      })),
    );
  }, [highlightedNodes, setNodes]);

  const onNodeDragStop = useCallback(
    (_: unknown, node: Node) => {
      savePosition(storageKey, node.id, node.position);
    },
    [storageKey],
  );

  return (
    <div className="flex-1 min-h-0 relative">
      {diagramTitle && (
        <div className="absolute left-1/2 -translate-x-1/2 top-1.5 font-mono text-[11px] text-txt-dim uppercase tracking-[.14em] pointer-events-none z-10 opacity-70">
          {diagramTitle}
        </div>
      )}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeDragStop={onNodeDragStop}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        colorMode={theme}
        fitView
        fitViewOptions={{ padding: 0.15 }}
        proOptions={{ hideAttribution: true }}
        minZoom={0.3}
        maxZoom={2}
        panOnScroll
        defaultEdgeOptions={{ animated: false }}
      />
    </div>
  );
}

function loadPositions(
  key: string,
): Record<string, { x: number; y: number }> | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function savePosition(
  key: string,
  nodeId: string,
  pos: { x: number; y: number },
) {
  try {
    const existing = loadPositions(key) ?? {};
    existing[nodeId] = pos;
    localStorage.setItem(key, JSON.stringify(existing));
  } catch {}
}
