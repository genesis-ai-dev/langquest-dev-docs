import {
  ReactFlow,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type NodeTypes,
  MarkerType,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useCallback, useEffect, useRef } from "react";
import { useTheme } from "./ThemeProvider";
import { LcTable, LcJson, LcTree, LcNote, LcLabel } from "./LifecycleNodes";
import type { LcNodeDef, LcEdgeDef } from "../data/templateLifecycle";

const nodeTypes: NodeTypes = {
  lcTable: LcTable,
  lcJson: LcJson,
  lcTree: LcTree,
  lcNote: LcNote,
  lcLabel: LcLabel,
};

function buildNodes(defs: LcNodeDef[]): Node[] {
  return defs.map((d) => ({
    id: d.id,
    type: d.type,
    position: { x: d.x, y: d.y },
    data: d.data,
    style: d.w ? { width: d.w } : undefined,
    draggable: true,
  }));
}

function buildEdges(defs: LcEdgeDef[]): Edge[] {
  return defs.map((e, i) => ({
    id: `e-${i}-${e.from}-${e.to}`,
    source: e.from,
    target: e.to,
    type: "default",
    label: e.label,
    style: {
      stroke: e.color ?? "var(--color-border-hi)",
      strokeDasharray: e.dash ? "6 4" : undefined,
    },
    labelStyle: {
      fill: e.color ?? "var(--color-txt-dim)",
      fontFamily: "var(--font-mono)",
      fontSize: 10,
    },
    labelBgStyle: {
      fill: "var(--color-bg)",
      fillOpacity: 0.8,
    },
    markerEnd: {
      type: MarkerType.ArrowClosed,
      color: e.color ?? "var(--color-border-hi)",
      width: 14,
      height: 14,
    },
    animated: e.animated,
  }));
}

function storageKey(step: number) {
  return `lq-lifecycle-scene-${step}`;
}

function loadPositions(key: string): Record<string, { x: number; y: number }> | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function savePosition(key: string, nodeId: string, pos: { x: number; y: number }) {
  try {
    const existing = loadPositions(key) ?? {};
    existing[nodeId] = pos;
    localStorage.setItem(key, JSON.stringify(existing));
  } catch {}
}

export function TemplateLifecycleDiagram({
  step,
  nodeDefs,
  edgeDefs,
  layoutKey,
}: {
  step: number;
  nodeDefs: LcNodeDef[];
  edgeDefs: LcEdgeDef[];
  layoutKey: number;
}) {
  const { theme } = useTheme();
  const initialised = useRef(false);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  useEffect(() => {
    const key = storageKey(step);
    const saved = loadPositions(key);
    const built = buildNodes(nodeDefs);
    if (saved) {
      for (const n of built) {
        if (saved[n.id]) {
          n.position = saved[n.id];
        }
      }
    }
    setNodes(built);
    setEdges(buildEdges(edgeDefs));
    initialised.current = true;
  }, [step, nodeDefs, edgeDefs, setNodes, setEdges, layoutKey]);

  const onNodeDragStop = useCallback(
    (_: unknown, node: Node) => {
      savePosition(storageKey(step), node.id, node.position);
    },
    [step],
  );

  return (
    <div className="flex-1 min-h-0 relative">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeDragStop={onNodeDragStop}
        nodeTypes={nodeTypes}
        colorMode={theme}
        fitView
        fitViewOptions={{ padding: 0.15 }}
        proOptions={{ hideAttribution: true }}
        minZoom={0.2}
        maxZoom={2}
        panOnScroll
        defaultEdgeOptions={{ animated: false }}
      />
    </div>
  );
}

export function copySceneLayout(step: number, nodeDefs: LcNodeDef[]) {
  const key = storageKey(step);
  const saved = loadPositions(key) ?? {};
  const merged = nodeDefs.map((n) => {
    const pos = saved[n.id] ?? { x: n.x, y: n.y };
    return { id: n.id, x: Math.round(pos.x), y: Math.round(pos.y), w: n.w };
  });
  void navigator.clipboard.writeText(JSON.stringify(merged, null, 2));
}

export function resetSceneLayout(step: number) {
  try {
    localStorage.removeItem(storageKey(step));
  } catch {}
}
