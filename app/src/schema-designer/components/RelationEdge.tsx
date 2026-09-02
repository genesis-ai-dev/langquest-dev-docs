import { getBezierPath, useReactFlow, type Edge, type EdgeProps } from "@xyflow/react";
import { useRef, useState } from "react";
import type { RelationEdgeData } from "../flow/types";
import { useDesignerStore } from "../state/store";

export function RelationEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  markerEnd,
  data,
  selected,
}: EdgeProps<Edge<RelationEdgeData>>) {
  const edge = data;
  const { getZoom } = useReactFlow();
  const [dragMidX, setDragMidX] = useState<number | null>(null);
  const [hovered, setHovered] = useState(false);
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef<{ clientX: number; mx: number } | null>(null);
  const liveMidX = useRef<number | null>(null);

  const mx = dragMidX ?? edge?.midX ?? (sourceX + targetX) / 2;
  const dy = targetY - sourceY;
  const r = Math.max(
    0,
    Math.min(8, Math.abs(mx - sourceX) - 1, Math.abs(mx - targetX) - 1, Math.abs(dy) / 2),
  );

  let d: string;
  let hasVertical = false;
  if (Math.abs(dy) < 1) {
    d = `M${sourceX} ${sourceY} L${targetX} ${targetY}`;
  } else if (r < 1 && dragMidX == null && edge?.midX == null) {
    [d] = getBezierPath({ sourceX, sourceY, targetX, targetY });
  } else {
    const s1 = mx > sourceX ? 1 : -1;
    const sy = targetY > sourceY ? 1 : -1;
    const s2 = targetX > mx ? 1 : -1;
    const f = (v: number) => v.toFixed(1);
    d = `M${f(sourceX)} ${f(sourceY)} L${f(mx - s1 * r)} ${f(sourceY)} Q${f(mx)} ${f(sourceY)} ${f(mx)} ${f(sourceY + sy * r)} L${f(mx)} ${f(targetY - sy * r)} Q${f(mx)} ${f(targetY)} ${f(mx + s2 * r)} ${f(targetY)} L${f(targetX)} ${f(targetY)}`;
    hasVertical = true;
  }

  const srcLabel = edge?.cardinality === "1:1" ? "1" : "n";
  const dstLabel = "1";
  const stroke =
    edge?.kind === "added"
      ? "var(--color-accent-green)"
      : edge?.kind === "removed"
        ? "var(--color-accent-red)"
        : selected
          ? "var(--color-edge-dot)"
          : edge?.touches
            ? "var(--color-accent-pink)"
            : "var(--color-edge-fk)";

  const onPointerDown = (e: React.PointerEvent<SVGPathElement>) => {
    e.stopPropagation();
    e.preventDefault();
    try {
      (e.target as Element).setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    dragStart.current = { clientX: e.clientX, mx };
    setDragging(true);
  };

  const onPointerMove = (e: React.PointerEvent<SVGPathElement>) => {
    if (!dragStart.current) return;
    const zoom = getZoom() || 1;
    const next = dragStart.current.mx + (e.clientX - dragStart.current.clientX) / zoom;
    liveMidX.current = next;
    setDragMidX(next);
  };

  const onPointerUp = () => {
    if (!dragStart.current) return;
    dragStart.current = null;
    setDragging(false);
    if (edge?.edgeKey && liveMidX.current != null) {
      useDesignerStore.getState().setEdgeLayout(edge.edgeKey, { midX: Math.round(liveMidX.current) });
    }
    liveMidX.current = null;
    setDragMidX(null);
  };

  const vTop = Math.min(sourceY, targetY);
  const vBottom = Math.max(sourceY, targetY);

  return (
    <g onClick={() => edge?.edgeKey && useDesignerStore.getState().setSelected({ kind: "relation", key: id })}>
      <path
        d={d}
        fill="none"
        stroke={stroke}
        strokeWidth={selected ? 2 : 1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={edge?.touches || edge?.kind === "removed" ? "5 4" : undefined}
        markerEnd={edge?.touches ? undefined : markerEnd}
      />
      {!edge?.touches && (
        <>
          <text x={sourceX + 8} y={sourceY - 6} className="fill-[var(--color-txt-dim)]" fontSize={9} fontFamily="IBM Plex Mono, monospace">
            {srcLabel}
          </text>
          <text x={targetX - 14} y={targetY - 6} className="fill-[var(--color-txt-dim)]" fontSize={9} fontFamily="IBM Plex Mono, monospace">
            {dstLabel}
          </text>
        </>
      )}
      {hasVertical && edge?.edgeKey && (
        <>
          {(hovered || dragging) && (
            <path
              d={`M${mx} ${vTop} L${mx} ${vBottom}`}
              fill="none"
              stroke="var(--color-edge-dot)"
              strokeWidth={2.5}
              opacity={0.55}
              pointerEvents="none"
            />
          )}
          <path
            d={`M${mx} ${vTop} L${mx} ${vBottom}`}
            fill="none"
            stroke="transparent"
            strokeWidth={14}
            style={{ cursor: "col-resize", pointerEvents: "stroke" }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerEnter={() => setHovered(true)}
            onPointerLeave={() => setHovered(false)}
            onDoubleClick={() => {
              setDragMidX(null);
              if (edge.edgeKey) useDesignerStore.getState().setEdgeLayout(edge.edgeKey, { midX: null });
            }}
          />
        </>
      )}
    </g>
  );
}
