import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
  type Edge,
  type EdgeTypes,
  type Node,
  type NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useEffect, useRef } from "react";
import { cn } from "../../cn";
import { useTheme } from "../../components/ThemeProvider";
import { buildFlow } from "../flow/buildFlow";
import type { Selection } from "../state/store";
import { diffFor, resolvedFor, useDesignerStore } from "../state/store";
import { FunctionNode } from "./FunctionNode";
import { RelationEdge } from "./RelationEdge";
import { TableNode } from "./TableNode";

const nodeTypes: NodeTypes = { tableNode: TableNode, functionNode: FunctionNode };
const edgeTypes: EdgeTypes = { relationEdge: RelationEdge };
const FIT_VIEW_OPTIONS = { padding: 0.15 };

function selectedNodeId(selection: Selection | null): string | null {
  if (!selection) return null;
  if (selection.kind === "table" || selection.kind === "ghost") return selection.key;
  if (selection.kind === "function") {
    return selection.key.startsWith("rpc.") ? selection.key : `rpc.${selection.key}`;
  }
  return null;
}

/** Keep React Flow's measured size / drag flags when the store rebuilds node data. */
function mergeFlowNodes(current: Node[], next: Node[]): Node[] {
  if (current === next) return current;
  const prev = new Map(current.map((n) => [n.id, n]));
  let changed = current.length !== next.length;
  const merged = next.map((n) => {
    const p = prev.get(n.id);
    if (!p) {
      changed = true;
      return n;
    }
    const out: Node = {
      ...n,
      measured: p.measured,
      width: p.width,
      height: p.height,
      dragging: p.dragging,
    };
    if (
      p.selected === out.selected &&
      p.position.x === out.position.x &&
      p.position.y === out.position.y &&
      p.data === out.data &&
      p.hidden === out.hidden &&
      p.draggable === out.draggable
    ) {
      return p;
    }
    changed = true;
    return out;
  });
  return changed ? merged : current;
}

function mergeFlowEdges(current: Edge[], next: Edge[]): Edge[] {
  if (current === next) return current;
  const prev = new Map(current.map((e) => [e.id, e]));
  let changed = current.length !== next.length;
  const merged = next.map((e) => {
    const p = prev.get(e.id);
    if (!p) {
      changed = true;
      return e;
    }
    if (
      p.selected === e.selected &&
      p.source === e.source &&
      p.target === e.target &&
      p.sourceHandle === e.sourceHandle &&
      p.targetHandle === e.targetHandle &&
      p.data === e.data
    ) {
      return p;
    }
    changed = true;
    return { ...e, selected: p.selected };
  });
  return changed ? merged : current;
}

function applyNodeSelection(nodes: Node[], selectedId: string | null): Node[] {
  let changed = false;
  const next = nodes.map((n) => {
    const selected = n.id === selectedId;
    if (n.selected === selected) return n;
    changed = true;
    return { ...n, selected };
  });
  return changed ? next : nodes;
}

function applyEdgeSelection(edges: Edge[], selectedId: string | null): Edge[] {
  let changed = false;
  const next = edges.map((e) => {
    const selected = e.id === selectedId;
    if (e.selected === selected) return e;
    changed = true;
    return { ...e, selected };
  });
  return changed ? next : edges;
}

export function CanvasHost({
  fitKey,
  dimmed,
  locked,
  schemaOverride,
  prevOverride,
  layoutStageId,
  prevLayoutStageId,
  forceDiff,
}: {
  fitKey?: string;
  dimmed?: boolean;
  locked?: boolean;
  schemaOverride?: import("../domain/types").Schema | null;
  prevOverride?: import("../domain/types").Schema | null;
  layoutStageId?: string | null;
  prevLayoutStageId?: string | null;
  forceDiff?: boolean;
}) {
  return (
    <ReactFlowProvider>
      <CanvasInner
        fitKey={fitKey}
        dimmed={dimmed}
        locked={locked}
        schemaOverride={schemaOverride}
        prevOverride={prevOverride}
        layoutStageId={layoutStageId}
        prevLayoutStageId={prevLayoutStageId}
        forceDiff={forceDiff}
      />
    </ReactFlowProvider>
  );
}

function CanvasInner({
  fitKey,
  dimmed,
  locked,
  schemaOverride,
  prevOverride,
  layoutStageId,
  prevLayoutStageId,
  forceDiff,
}: {
  fitKey?: string;
  dimmed?: boolean;
  locked?: boolean;
  schemaOverride?: import("../domain/types").Schema | null;
  prevOverride?: import("../domain/types").Schema | null;
  layoutStageId?: string | null;
  prevLayoutStageId?: string | null;
  forceDiff?: boolean;
}) {
  const { theme } = useTheme();
  const rf = useReactFlow();
  const rfRef = useRef(rf);
  useEffect(() => {
    rfRef.current = rf;
  }, [rf]);
  const storeSchema = useDesignerStore((s) => s.schema);
  const storePrev = useDesignerStore((s) => s.prevSchema);
  const compareSchema = useDesignerStore((s) => s.compareSchema);
  const viewMode = useDesignerStore((s) => s.viewMode);
  const selection = useDesignerStore((s) => s.selected);
  const readOnly = useDesignerStore((s) => s.readOnly);
  const layoutDoc = useDesignerStore((s) => s.layoutDoc);
  const manifest = useDesignerStore((s) => s.manifest);
  const activeStageId = useDesignerStore((s) => s.activeStageId);
  const compareWith = useDesignerStore((s) => s.compareWith);
  const parsePending = useDesignerStore((s) => s.parsePending);
  const parseErrors = useDesignerStore((s) => s.parseErrors);

  const schema = schemaOverride !== undefined ? schemaOverride : storeSchema;
  const prevSchema = prevOverride !== undefined ? prevOverride : storePrev;
  const showDiff =
    forceDiff === true ||
    (forceDiff !== false &&
      viewMode !== "edit" &&
      (viewMode === "compare" ? compareSchema != null : prevSchema != null));
  const diff = diffFor({
    schema,
    prevSchema,
    compareSchema: prevOverride !== undefined ? prevOverride : compareSchema,
    viewMode: forceDiff ? "diff" : viewMode,
  });
  const stageForLayout = layoutStageId ?? activeStageId;
  const resolvedLayout = resolvedFor(layoutDoc, manifest, stageForLayout);
  const prevId =
    prevLayoutStageId ??
    (viewMode === "compare"
      ? compareWith
      : (manifest.stages[manifest.stages.findIndex((s) => s.id === activeStageId) - 1]?.id ?? null));
  const prevResolvedLayout = resolvedFor(layoutDoc, manifest, prevId);

  const built = schema
    ? buildFlow({
        schema,
        prevSchema,
        diff,
        resolvedLayout,
        prevResolvedLayout,
        viewMode,
        selection,
        readOnly: readOnly || !!locked,
        showDiff,
      })
    : { nodes: [] as Node[], edges: [] as Edge[] };

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const draggingRef = useRef(false);
  const applyingSelection = useRef(false);
  const focusRequest = useDesignerStore((s) => s.focusRequest);

  useEffect(() => {
    if (draggingRef.current) return;
    setNodes((current) => mergeFlowNodes(current, built.nodes));
    setEdges((current) => mergeFlowEdges(current, built.edges));
    // built.nodes/edges are new arrays each render; store inputs above are the real deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- see above
  }, [
    schema,
    prevSchema,
    compareSchema,
    viewMode,
    layoutDoc,
    manifest,
    activeStageId,
    compareWith,
    readOnly,
    locked,
    showDiff,
    forceDiff,
    schemaOverride,
    prevOverride,
    layoutStageId,
    prevLayoutStageId,
    setNodes,
    setEdges,
  ]);

  useEffect(() => {
    applyingSelection.current = true;
    const nodeId = selectedNodeId(selection);
    const edgeId = selection?.kind === "relation" ? selection.key : null;
    setNodes((current) => applyNodeSelection(current, nodeId));
    setEdges((current) => applyEdgeSelection(current, edgeId));
    const id = requestAnimationFrame(() => {
      applyingSelection.current = false;
    });
    return () => cancelAnimationFrame(id);
  }, [selection, setNodes, setEdges]);

  useEffect(() => {
    if (!focusRequest) return;
    const node = rfRef.current.getNode(focusRequest.nodeId);
    if (!node) return;
    const w = node.measured?.width ?? 220;
    const h = node.measured?.height ?? 80;
    void rfRef.current.setCenter(node.position.x + w / 2, node.position.y + h / 2, {
      zoom: Math.max(rfRef.current.getZoom(), 0.85),
      duration: 240,
    });
  }, [focusRequest]);

  const fittedFor = useRef<string | null>(null);
  useEffect(() => {
    if (nodes.length === 0) return;
    const key = fitKey ?? "none";
    if (fittedFor.current === key) return;
    fittedFor.current = key;
    const id = requestAnimationFrame(() => {
      void rfRef.current.fitView(FIT_VIEW_OPTIONS);
    });
    return () => cancelAnimationFrame(id);
  }, [fitKey, nodes.length]);

  const invalid = parseErrors.some((e) => e.severity === "error");

  return (
    <div className={cn("flex-1 min-h-0 relative", (dimmed || parsePending || invalid) && "opacity-80")}>
      {(parsePending || invalid) && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-10 font-mono text-[.68rem] text-txt-dim bg-panel border border-border rounded-md px-2 py-1">
          {invalid ? "AML has errors — canvas shows last valid schema" : "editing…"}
        </div>
      )}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeDragStart={() => {
          draggingRef.current = true;
        }}
        onNodeDragStop={(_e, node) => {
          const key = node.id.startsWith("ghost:") ? null : node.id;
          if (key) useDesignerStore.getState().moveNode(key, node.position);
          draggingRef.current = false;
        }}
        onConnect={(c: Connection) => {
          if (locked || readOnly) return;
          const srcField = c.sourceHandle?.startsWith("field-") ? c.sourceHandle.slice(6) : null;
          const dstField = c.targetHandle?.startsWith("field-") ? c.targetHandle.slice(6) : null;
          if (!c.source || !c.target || !srcField || !dstField) return;
          useDesignerStore.getState().addRelation(
            { table: c.source, field: srcField },
            { table: c.target, field: dstField },
          );
        }}
        onSelectionChange={({ nodes: ns, edges: es }) => {
          if (applyingSelection.current || draggingRef.current) return;
          if (es[0]) {
            useDesignerStore.getState().setSelected({ kind: "relation", key: es[0].id });
            return;
          }
          if (ns[0]) {
            const id = ns[0].id;
            if (id.startsWith("ghost:")) {
              useDesignerStore.getState().setSelected({ kind: "ghost", key: id });
            } else if (id.startsWith("rpc.")) {
              useDesignerStore.getState().setSelected({ kind: "function", key: id.slice(4) });
            } else {
              useDesignerStore.getState().setSelected({ kind: "table", key: id });
            }
            return;
          }
          useDesignerStore.getState().setSelected(null);
        }}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        colorMode={theme}
        fitViewOptions={FIT_VIEW_OPTIONS}
        proOptions={{ hideAttribution: true }}
        minZoom={0.2}
        maxZoom={2}
        panOnScroll
        nodesDraggable={!locked && !readOnly}
        nodesConnectable={!locked && !readOnly}
        elementsSelectable
      >
        <Background />
        <Controls />
        <MiniMap pannable zoomable />
      </ReactFlow>
    </div>
  );
}
