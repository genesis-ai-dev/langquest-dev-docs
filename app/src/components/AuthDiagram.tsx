import {
  ReactFlow,
  useReactFlow,
  ReactFlowProvider,
  type Node,
  type Edge,
  type NodeTypes,
  type OnNodesChange,
  type EdgeMouseHandler,
  applyNodeChanges,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useCallback, useMemo, useRef, useState } from "react";
import { useTheme } from "./ThemeProvider";
import { MigrationNode, ContainerNode } from "./MigrationNodes";
import {
  NODES,
  EDGES,
  EDGE_COLORS,
  type AuthNodeDef,
} from "../data/authFlow";

const nodeTypes: NodeTypes = {
  migration: MigrationNode,
  container: ContainerNode,
};

const STORAGE_KEY = "lq-auth-pos";
const EDGE_STORAGE_KEY = "lq-auth-edges";
const HANDLE_CYCLE = ["top", "right", "bottom", "left"] as const;

interface SavedLayout {
  x: number;
  y: number;
  w?: number;
  h?: number;
}

interface HandleOverride {
  sourceHandle?: string;
  targetHandle?: string;
}

function loadSavedLayouts(): Record<string, SavedLayout> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function persistLayout(id: string, update: Partial<SavedLayout>) {
  try {
    const existing = loadSavedLayouts();
    existing[id] = { ...existing[id], ...update };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
  } catch {
    /* noop */
  }
}

function loadEdgeOverrides(): Record<string, HandleOverride> {
  try {
    const raw = localStorage.getItem(EDGE_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function persistEdgeOverrides(overrides: Record<string, HandleOverride>) {
  try {
    localStorage.setItem(EDGE_STORAGE_KEY, JSON.stringify(overrides));
  } catch {
    /* noop */
  }
}

function nextHandle(current: string): string {
  const idx = HANDLE_CYCLE.indexOf(current as (typeof HANDLE_CYCLE)[number]);
  return HANDLE_CYCLE[(idx + 1) % HANDLE_CYCLE.length];
}

function defToNode(d: AuthNodeDef, saved?: SavedLayout): Node {
  return {
    id: d.id,
    type: d.type,
    position:
      saved?.x != null ? { x: saved.x, y: saved.y } : { x: d.x, y: d.y },
    data: {
      label: d.label,
      subtitle: d.subtitle,
      badge: d.badge,
      category: d.category,
      revealed: true,
    },
    style: { width: saved?.w ?? d.w, height: saved?.h ?? d.h },
    draggable: true,
    zIndex: d.zIndex ?? 0,
  };
}

function AuthDiagramInner() {
  const { theme } = useTheme();
  const { getNodes } = useReactFlow();
  const savedPos = useRef(loadSavedLayouts());
  const [handleOverrides, setHandleOverrides] = useState<
    Record<string, HandleOverride>
  >(loadEdgeOverrides);

  const initialNodes: Node[] = useMemo(
    () => NODES.map((d) => defToNode(d, savedPos.current[d.id])),
    [],
  );

  const [nodes, setNodes] = useState(initialNodes);

  const edges: Edge[] = useMemo(
    () =>
      EDGES.map((d) => {
        const c = EDGE_COLORS[d.color] ?? EDGE_COLORS.default;
        const ov = handleOverrides[d.id];
        return {
          id: d.id,
          source: d.source,
          sourceHandle: ov?.sourceHandle ?? d.sourceHandle,
          target: d.target,
          targetHandle: ov?.targetHandle ?? d.targetHandle,
          type: "smoothstep" as const,
          style: {
            stroke: c,
            strokeWidth: 1.5,
            opacity: 0.55,
            strokeDasharray: d.dash ? "5 4" : undefined,
          },
          label: d.label,
          labelStyle: d.label
            ? {
                fill: c,
                fontFamily: "JetBrains Mono, monospace",
                fontSize: 10,
                fontWeight: 600,
              }
            : undefined,
          labelBgStyle: d.label
            ? { fill: "var(--color-bg)", fillOpacity: 0.85 }
            : undefined,
        };
      }),
    [handleOverrides],
  );

  const onEdgeClick: EdgeMouseHandler = useCallback(
    (event, edge) => {
      const rfNodes = getNodes();
      const sourceNode = rfNodes.find((n) => n.id === edge.source);
      const targetNode = rfNodes.find((n) => n.id === edge.target);
      if (!sourceNode || !targetNode) return;

      const clickX = event.clientX;
      const clickY = event.clientY;

      const rect = (event.target as Element)
        .closest(".react-flow")
        ?.getBoundingClientRect();
      if (!rect) return;

      const sourceCenter = {
        x: sourceNode.position.x + (sourceNode.measured?.width ?? 100) / 2,
        y: sourceNode.position.y + (sourceNode.measured?.height ?? 50) / 2,
      };
      const targetCenter = {
        x: targetNode.position.x + (targetNode.measured?.width ?? 100) / 2,
        y: targetNode.position.y + (targetNode.measured?.height ?? 50) / 2,
      };

      const viewportEl = (event.target as Element).closest(
        ".react-flow__viewport",
      );
      if (!viewportEl) return;
      const transform = viewportEl.getAttribute("style") ?? "";
      const m = /translate\(([^,]+)px,\s*([^)]+)px\)\s*scale\(([^)]+)\)/.exec(
        transform,
      );
      const tx = m ? parseFloat(m[1]) : 0;
      const ty = m ? parseFloat(m[2]) : 0;
      const scale = m ? parseFloat(m[3]) : 1;

      const flowX = (clickX - rect.left - tx) / scale;
      const flowY = (clickY - rect.top - ty) / scale;

      const distSource =
        (flowX - sourceCenter.x) ** 2 + (flowY - sourceCenter.y) ** 2;
      const distTarget =
        (flowX - targetCenter.x) ** 2 + (flowY - targetCenter.y) ** 2;

      const side: "sourceHandle" | "targetHandle" =
        distSource < distTarget ? "sourceHandle" : "targetHandle";

      const edgeDef = EDGES.find((e) => e.id === edge.id);
      if (!edgeDef) return;

      const currentOverrides = handleOverrides[edge.id] ?? {};
      const currentHandle =
        currentOverrides[side] ?? edgeDef[side];
      const next = nextHandle(currentHandle);

      setHandleOverrides((prev) => {
        const updated = {
          ...prev,
          [edge.id]: { ...prev[edge.id], [side]: next },
        };
        persistEdgeOverrides(updated);
        return updated;
      });
    },
    [handleOverrides, getNodes],
  );

  const onNC: OnNodesChange = useCallback((changes) => {
    setNodes((nds) => applyNodeChanges(changes, nds));
    for (const ch of changes) {
      if (ch.type === "position" && ch.position && !ch.dragging) {
        persistLayout(ch.id, { x: ch.position.x, y: ch.position.y });
        savedPos.current[ch.id] = {
          ...savedPos.current[ch.id],
          x: ch.position.x,
          y: ch.position.y,
        };
      }
      if (ch.type === "dimensions" && ch.dimensions && ch.resizing === true) {
        persistLayout(ch.id, {
          w: ch.dimensions.width,
          h: ch.dimensions.height,
        });
        savedPos.current[ch.id] = {
          ...savedPos.current[ch.id],
          w: ch.dimensions.width,
          h: ch.dimensions.height,
        };
      }
    }
  }, []);

  const [copied, setCopied] = useState(false);

  const copyLayout = useCallback(() => {
    const dim = (
      measured: number | undefined,
      explicit: number | undefined,
      style: string | number | undefined,
    ) =>
      Math.round(
        measured ??
          explicit ??
          (typeof style === "number" ? style : parseFloat(String(style ?? 0))),
      );

    const nodeLayouts = nodes.map((n) => ({
      id: n.id,
      x: Math.round(n.position.x),
      y: Math.round(n.position.y),
      w: dim(n.measured?.width, n.width, n.style?.width),
      h: dim(n.measured?.height, n.height, n.style?.height),
    }));

    const edgeOverrideList = EDGES.map((d) => {
      const ov = handleOverrides[d.id];
      if (!ov) return null;
      const entry: { id: string; sourceHandle?: string; targetHandle?: string } =
        { id: d.id };
      if (ov.sourceHandle && ov.sourceHandle !== d.sourceHandle)
        entry.sourceHandle = ov.sourceHandle;
      if (ov.targetHandle && ov.targetHandle !== d.targetHandle)
        entry.targetHandle = ov.targetHandle;
      if (!entry.sourceHandle && !entry.targetHandle) return null;
      return entry;
    }).filter(Boolean);

    const output: { nodes: typeof nodeLayouts; edges?: typeof edgeOverrideList } =
      { nodes: nodeLayouts };
    if (edgeOverrideList.length > 0) output.edges = edgeOverrideList;

    navigator.clipboard.writeText(JSON.stringify(output, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [nodes, handleOverrides]);

  const resetLayout = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(EDGE_STORAGE_KEY);
    } catch {
      /* noop */
    }
    savedPos.current = {};
    setHandleOverrides({});
    setNodes(NODES.map((d) => defToNode(d)));
  }, []);

  return (
    <div className="flex-1 min-h-0 relative">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNC}
        onEdgeClick={onEdgeClick}
        nodeTypes={nodeTypes}
        colorMode={theme}
        fitView
        fitViewOptions={{ padding: 0.08 }}
        proOptions={{ hideAttribution: true }}
        minZoom={0.25}
        maxZoom={2}
        panOnScroll
      />
      <div className="absolute bottom-3 right-3 z-50 flex gap-2">
        <button
          type="button"
          onClick={resetLayout}
          className="px-3 py-1.5 rounded-lg text-xs font-mono bg-card border border-border hover:border-border-hi text-txt-muted hover:text-txt transition-colors cursor-pointer"
        >
          ⟲ Reset
        </button>
        <button
          type="button"
          onClick={copyLayout}
          className="px-3 py-1.5 rounded-lg text-xs font-mono bg-card border border-border hover:border-border-hi text-txt-muted hover:text-txt transition-colors cursor-pointer"
        >
          {copied ? "✓ Copied!" : "Copy Layout"}
        </button>
      </div>
    </div>
  );
}

export function AuthDiagram() {
  return (
    <ReactFlowProvider>
      <AuthDiagramInner />
    </ReactFlowProvider>
  );
}
