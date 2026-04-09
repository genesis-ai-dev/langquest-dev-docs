import {
  ReactFlow,
  type Node,
  type Edge,
  type NodeTypes,
  type OnNodesChange,
  applyNodeChanges,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useTheme } from "./ThemeProvider";
import {
  MigrationNode,
  ContainerNode,
  VersionBoxNode,
  LabelNode,
} from "./MigrationNodes";
import {
  type VersionVars,
  type MigrationScenario,
  type NodeDef,
  buildAllNodes,
  buildAllEdges,
  EDGE_COLORS,
  CAPABILITY_IDS,
} from "../data/migrationFlow";

const nodeTypes: NodeTypes = {
  migration: MigrationNode,
  container: ContainerNode,
  versionBox: VersionBoxNode,
  label: LabelNode,
};

const STORAGE_KEY = "lq-migration-pos";

interface SavedLayout {
  x: number;
  y: number;
  w?: number;
  h?: number;
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

function isRevealed(id: string, caps: Set<string> | null): boolean {
  if (caps === null) return true;
  if (!CAPABILITY_IDS.has(id)) return true;
  return caps.has(id);
}

function defToNode(
  d: NodeDef,
  revealed: boolean,
  saved?: SavedLayout,
): Node {
  return {
    id: d.id,
    type: d.type,
    position: saved?.x != null ? { x: saved.x, y: saved.y } : { x: d.x, y: d.y },
    data: {
      label: d.label,
      subtitle: d.subtitle,
      badge: d.badge,
      category: d.category ?? "server",
      revealed,
    },
    style: { width: saved?.w ?? d.w, height: saved?.h ?? d.h },
    draggable: d.draggable !== false,
    zIndex: d.zIndex ?? 0,
  };
}

export function MigrationDiagram({
  versionVars,
  scenario,
  currentStep,
}: {
  versionVars: VersionVars;
  scenario: MigrationScenario | null;
  currentStep: number;
}) {
  const { theme } = useTheme();
  const savedPos = useRef(loadSavedLayouts());

  const revealedCaps = useMemo(() => {
    if (!scenario) return null;
    const s = new Set<string>();
    for (let i = 0; i <= currentStep && i < scenario.steps.length; i++)
      for (const id of scenario.steps[i].reveal) s.add(id);
    return s;
  }, [scenario, currentStep]);

  const activeEdgeIds = useMemo(() => {
    if (!scenario) return new Set<string>();
    return new Set(scenario.steps[currentStep]?.activeEdges ?? []);
  }, [scenario, currentStep]);

  const nodeDefs = useMemo(() => buildAllNodes(versionVars), [versionVars]);
  const edgeDefs = useMemo(() => buildAllEdges(versionVars), [versionVars]);

  const computedNodes: Node[] = useMemo(
    () =>
      nodeDefs.map((d) =>
        defToNode(d, isRevealed(d.id, revealedCaps), savedPos.current[d.id]),
      ),
    [nodeDefs, revealedCaps],
  );

  const [nodes, setNodes] = useState(computedNodes);

  // Sync node data when scenario step or version vars change.
  // useLayoutEffect prevents a flash of stale state before paint.
  useLayoutEffect(() => {
    setNodes(computedNodes);
  }, [computedNodes]);

  const edges: Edge[] = useMemo(() => {
    return edgeDefs.map((d) => {
      const both =
        isRevealed(d.source, revealedCaps) &&
        isRevealed(d.target, revealedCaps);
      const active = activeEdgeIds.has(d.id);
      const c = EDGE_COLORS[d.color] ?? EDGE_COLORS.default;
      return {
        id: d.id,
        source: d.source,
        sourceHandle: d.sourceHandle,
        target: d.target,
        targetHandle: d.targetHandle,
        type: "smoothstep" as const,
        animated: active,
        style: {
          stroke: both ? c : "transparent",
          strokeWidth: active ? 3 : 1.5,
          opacity: both ? (active ? 1 : 0.35) : 0,
          transition: "all .4s ease",
        },
        label: active && d.label ? d.label : undefined,
        labelStyle: d.label
          ? {
              fill: c,
              fontFamily: "JetBrains Mono, monospace",
              fontSize: 11,
              fontWeight: 600,
            }
          : undefined,
        labelBgStyle: d.label
          ? { fill: "var(--color-bg)", fillOpacity: 0.9 }
          : undefined,
      };
    });
  }, [edgeDefs, revealedCaps, activeEdgeIds]);

  const flowKey = useMemo(
    () =>
      revealedCaps ? "r-" + [...revealedCaps].sort().join(",") : "all",
    [revealedCaps],
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
    ) => Math.round(measured ?? explicit ?? (typeof style === "number" ? style : parseFloat(String(style ?? 0))));

    const layout = nodes.map((n) => ({
      id: n.id,
      x: Math.round(n.position.x),
      y: Math.round(n.position.y),
      w: dim(n.measured?.width, n.width, n.style?.width),
      h: dim(n.measured?.height, n.height, n.style?.height),
    }));
    navigator.clipboard.writeText(JSON.stringify(layout, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [nodes]);

  return (
    <div className="flex-1 min-h-0 relative">
      <ReactFlow
        key={flowKey}
        nodes={nodes}
        edges={edges}
        onNodesChange={onNC}
        nodeTypes={nodeTypes}
        colorMode={theme}
        fitView
        fitViewOptions={{ padding: 0.12 }}
        proOptions={{ hideAttribution: true }}
        minZoom={0.3}
        maxZoom={2}
        panOnScroll
      />
      <button
        onClick={copyLayout}
        className="absolute bottom-3 right-3 z-50 px-3 py-1.5 rounded-lg text-xs font-mono bg-card border border-border hover:border-border-hi text-txt-muted hover:text-txt transition-colors"
      >
        {copied ? "✓ Copied!" : "Copy Layout"}
      </button>
    </div>
  );
}

export function resetMigrationLayout() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* noop */
  }
}
