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
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTheme } from "./ThemeProvider";
import { MigrationNode, ContainerNode, DetailNode } from "./MigrationNodes";
import {
  NODES,
  EDGES,
  EDGE_COLORS,
  STEPS,
  type AuthNodeDef,
} from "../data/authFlow";

const nodeTypes: NodeTypes = {
  migration: MigrationNode,
  container: ContainerNode,
  detail: DetailNode,
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

function buildRevealedSet(step: number): Set<string> {
  const s = new Set<string>();
  for (let i = 0; i <= step; i++) {
    STEPS[i].revealNodes?.forEach((id) => s.add(id));
  }
  return s;
}

function defToNode(
  d: AuthNodeDef,
  saved: SavedLayout | undefined,
  revealed: boolean,
  highlighted: boolean,
): Node {
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
      items: d.items,
      revealed,
      highlighted,
    },
    style: { width: saved?.w ?? d.w, height: saved?.h ?? d.h },
    draggable: true,
    zIndex: d.zIndex ?? 0,
  };
}

function AuthDiagramInner({ currentStep }: { currentStep: number }) {
  const { theme } = useTheme();
  const { fitView, getNodes } = useReactFlow();
  const savedPos = useRef(loadSavedLayouts());
  const [handleOverrides, setHandleOverrides] = useState<
    Record<string, HandleOverride>
  >(loadEdgeOverrides);

  // Build initial nodes with step-0 reveal state
  const [nodes, setNodes] = useState<Node[]>(() => {
    const revealed = buildRevealedSet(0);
    const highlighted = new Set(STEPS[0]?.highlightNodes ?? []);
    return NODES.map((d) =>
      defToNode(
        d,
        savedPos.current[d.id],
        d.type === "detail" ? highlighted.has(d.id) : revealed.has(d.id),
        highlighted.has(d.id),
      ),
    );
  });

  // Update node reveal/highlight when step changes
  useEffect(() => {
    const revealed = buildRevealedSet(currentStep);
    const highlighted = new Set(STEPS[currentStep]?.highlightNodes ?? []);
    setNodes((nds) =>
      nds.map((n) => {
        const isDetail = NODES.find((d) => d.id === n.id)?.type === "detail";
        return {
          ...n,
          data: {
            ...n.data,
            revealed: isDetail ? highlighted.has(n.id) : revealed.has(n.id),
            highlighted: highlighted.has(n.id),
          },
        };
      }),
    );
  }, [currentStep]);

  // Fit view when new nodes are revealed (only on expansion, not backward)
  const prevRevealCount = useRef(buildRevealedSet(0).size);
  useEffect(() => {
    const count = buildRevealedSet(currentStep).size;
    if (count > prevRevealCount.current) {
      const t = setTimeout(() => fitView({ padding: 0.08, duration: 400 }), 80);
      prevRevealCount.current = count;
      return () => clearTimeout(t);
    }
    prevRevealCount.current = count;
  }, [currentStep, fitView]);

  // Build edges with reveal/highlight awareness
  const edges: Edge[] = useMemo(() => {
    const revealed = buildRevealedSet(currentStep);
    const activeSet = new Set(STEPS[currentStep]?.activeEdges ?? []);

    return EDGES.map((d) => {
      const c = EDGE_COLORS[d.color] ?? EDGE_COLORS.default;
      const ov = handleOverrides[d.id];
      const srcRevealed = revealed.has(d.source);
      const tgtRevealed = revealed.has(d.target);
      const visible = srcRevealed && tgtRevealed;
      const active = activeSet.has(d.id);

      return {
        id: d.id,
        source: d.source,
        sourceHandle: ov?.sourceHandle ?? d.sourceHandle,
        target: d.target,
        targetHandle: ov?.targetHandle ?? d.targetHandle,
        type: "smoothstep" as const,
        hidden: !visible,
        animated: active,
        style: {
          stroke: c,
          strokeWidth: active ? 2.5 : 1.5,
          opacity: visible ? (active ? 1 : 0.35) : 0,
          ...(d.dash && !active ? { strokeDasharray: "5 4" } : {}),
        },
        label: d.label,
        labelStyle: d.label
          ? {
              fill: c,
              fontFamily: "JetBrains Mono, monospace",
              fontSize: 10,
              fontWeight: 600,
              opacity: visible ? (active ? 1 : 0.4) : 0,
            }
          : undefined,
        labelBgStyle: d.label
          ? {
              fill: "var(--color-bg)",
              fillOpacity: visible ? (active ? 0.9 : 0.5) : 0,
            }
          : undefined,
      };
    });
  }, [currentStep, handleOverrides]);

  const onEdgeClick: EdgeMouseHandler = useCallback(
    (event, edge) => {
      const rfNodes = getNodes();
      const sourceNode = rfNodes.find((n) => n.id === edge.source);
      const targetNode = rfNodes.find((n) => n.id === edge.target);
      if (!sourceNode || !targetNode) return;

      const rect = (event.target as Element)
        .closest(".react-flow")
        ?.getBoundingClientRect();
      if (!rect) return;

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

      const flowX = (event.clientX - rect.left - tx) / scale;
      const flowY = (event.clientY - rect.top - ty) / scale;

      const sourceCenter = {
        x: sourceNode.position.x + (sourceNode.measured?.width ?? 100) / 2,
        y: sourceNode.position.y + (sourceNode.measured?.height ?? 50) / 2,
      };
      const targetCenter = {
        x: targetNode.position.x + (targetNode.measured?.width ?? 100) / 2,
        y: targetNode.position.y + (targetNode.measured?.height ?? 50) / 2,
      };

      const distSource =
        (flowX - sourceCenter.x) ** 2 + (flowY - sourceCenter.y) ** 2;
      const distTarget =
        (flowX - targetCenter.x) ** 2 + (flowY - targetCenter.y) ** 2;

      const side: "sourceHandle" | "targetHandle" =
        distSource < distTarget ? "sourceHandle" : "targetHandle";

      const edgeDef = EDGES.find((e) => e.id === edge.id);
      if (!edgeDef) return;

      const currentOverrides = handleOverrides[edge.id] ?? {};
      const currentHandle = currentOverrides[side] ?? edgeDef[side];
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
      const entry: {
        id: string;
        sourceHandle?: string;
        targetHandle?: string;
      } = { id: d.id };
      if (ov.sourceHandle && ov.sourceHandle !== d.sourceHandle)
        entry.sourceHandle = ov.sourceHandle;
      if (ov.targetHandle && ov.targetHandle !== d.targetHandle)
        entry.targetHandle = ov.targetHandle;
      if (!entry.sourceHandle && !entry.targetHandle) return null;
      return entry;
    }).filter(Boolean);

    const output: {
      nodes: typeof nodeLayouts;
      edges?: typeof edgeOverrideList;
    } = { nodes: nodeLayouts };
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
    const revealed = buildRevealedSet(currentStep);
    const highlighted = new Set(STEPS[currentStep]?.highlightNodes ?? []);
    setNodes(
      NODES.map((d) =>
        defToNode(d, undefined, revealed.has(d.id), highlighted.has(d.id)),
      ),
    );
  }, [currentStep]);

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

export function AuthDiagram({ currentStep }: { currentStep: number }) {
  return (
    <ReactFlowProvider>
      <AuthDiagramInner currentStep={currentStep} />
    </ReactFlowProvider>
  );
}
