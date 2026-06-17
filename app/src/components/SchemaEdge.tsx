import { type EdgeProps, getBezierPath, useReactFlow } from "@xyflow/react";
import { useRef, useState } from "react";

export interface SchemaEdgeData {
  dash?: boolean;
  /** Stable key identifying this edge for layout persistence. */
  edgeKey?: string;
  /** Absolute X (flow coords) for the vertical segment. Null/undefined = auto midpoint. */
  midX?: number;
  /** Called when the user finishes dragging the vertical segment (null = reset to auto). */
  onMidXChange?: (edgeKey: string, midX: number | null) => void;
  [key: string]: unknown;
}

/**
 * H-V-H edge with rounded corners, matching the original schema diagrams.
 * Falls back to a simple bezier when nodes are very close.
 * The vertical segment can be dragged horizontally (double-click to reset to auto).
 */
export function SchemaEdge({
  sourceX,
  sourceY,
  targetX,
  targetY,
  style,
  data,
  markerEnd,
}: EdgeProps) {
  const edgeData = data as SchemaEdgeData | undefined;
  const dash = edgeData?.dash;
  const { getZoom } = useReactFlow();

  const [midXOverride, setMidXOverride] = useState<number | null>(
    edgeData?.midX ?? null,
  );
  const [hovered, setHovered] = useState(false);
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef<{ clientX: number; mx: number } | null>(null);
  const liveMidX = useRef<number | null>(null);

  // If this component instance gets reused for a different edge, resync local state.
  const lastKey = useRef(edgeData?.edgeKey);
  if (lastKey.current !== edgeData?.edgeKey) {
    lastKey.current = edgeData?.edgeKey;
    setMidXOverride(edgeData?.midX ?? null);
  }

  const hasOverride = midXOverride != null;
  const mx = midXOverride ?? (sourceX + targetX) / 2;
  const dy = targetY - sourceY;
  const r = Math.max(
    0,
    Math.min(8, Math.abs(mx - sourceX) - 1, Math.abs(mx - targetX) - 1, Math.abs(dy) / 2),
  );

  let d: string;
  let hasVertical = false;
  if (Math.abs(dy) < 1) {
    d = `M${sourceX} ${sourceY} L${targetX} ${targetY}`;
  } else if (r < 1 && !hasOverride) {
    [d] = getBezierPath({ sourceX, sourceY, targetX, targetY });
  } else {
    const s1 = mx > sourceX ? 1 : -1;
    const sy = targetY > sourceY ? 1 : -1;
    const s2 = targetX > mx ? 1 : -1;
    const f = (v: number) => v.toFixed(1);
    d = `M${f(sourceX)} ${f(sourceY)} L${f(mx - s1 * r)} ${f(sourceY)} Q${f(mx)} ${f(sourceY)} ${f(mx)} ${f(sourceY + sy * r)} L${f(mx)} ${f(targetY - sy * r)} Q${f(mx)} ${f(targetY)} ${f(mx + s2 * r)} ${f(targetY)} L${f(targetX)} ${f(targetY)}`;
    hasVertical = true;
  }

  const draggable =
    hasVertical && !!edgeData?.edgeKey && !!edgeData?.onMidXChange;

  const onPointerDown = (e: React.PointerEvent<SVGPathElement>) => {
    e.stopPropagation();
    e.preventDefault();
    try {
      (e.target as Element).setPointerCapture(e.pointerId);
    } catch {}
    dragStart.current = { clientX: e.clientX, mx };
    setDragging(true);
  };

  const onPointerMove = (e: React.PointerEvent<SVGPathElement>) => {
    if (!dragStart.current) return;
    const zoom = getZoom() || 1;
    const next =
      dragStart.current.mx + (e.clientX - dragStart.current.clientX) / zoom;
    liveMidX.current = next;
    setMidXOverride(next);
  };

  const onPointerUp = () => {
    if (!dragStart.current) return;
    dragStart.current = null;
    setDragging(false);
    if (edgeData?.edgeKey && edgeData.onMidXChange && liveMidX.current != null) {
      edgeData.onMidXChange(edgeData.edgeKey, Math.round(liveMidX.current));
    }
    liveMidX.current = null;
  };

  const onDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setMidXOverride(null);
    if (edgeData?.edgeKey && edgeData.onMidXChange) {
      edgeData.onMidXChange(edgeData.edgeKey, null);
    }
  };

  const vTop = Math.min(sourceY, targetY);
  const vBottom = Math.max(sourceY, targetY);

  return (
    <g>
      <path
        d={d}
        fill="none"
        stroke="var(--color-edge-fk)"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={dash ? "5 4" : undefined}
        markerEnd={markerEnd}
        style={style}
      />
      {draggable && (
        <>
          {(hovered || dragging) && (
            <>
              <path
                d={`M${mx} ${vTop} L${mx} ${vBottom}`}
                fill="none"
                stroke="var(--color-edge-dot)"
                strokeWidth={2.5}
                strokeLinecap="round"
                opacity={0.55}
                pointerEvents="none"
              />
              <circle
                cx={mx}
                cy={(vTop + vBottom) / 2}
                r={3.5}
                fill="var(--color-edge-dot)"
                pointerEvents="none"
              />
            </>
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
            onDoubleClick={onDoubleClick}
          />
        </>
      )}
    </g>
  );
}
