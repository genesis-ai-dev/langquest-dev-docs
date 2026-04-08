import { type EdgeProps, getBezierPath } from "@xyflow/react";

export interface SchemaEdgeData {
  dash?: boolean;
  [key: string]: unknown;
}

/**
 * H-V-H edge with rounded corners, matching the original schema diagrams.
 * Falls back to a simple bezier when nodes are very close.
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
  const dash = (data as SchemaEdgeData | undefined)?.dash;
  const mx = (sourceX + targetX) / 2;
  const dy = targetY - sourceY;
  const r = Math.min(8, Math.abs(mx - sourceX) - 1, Math.abs(mx - targetX) - 1, Math.abs(dy) / 2);

  let d: string;
  if (Math.abs(dy) < 1) {
    d = `M${sourceX} ${sourceY} L${targetX} ${targetY}`;
  } else if (r < 1) {
    [d] = getBezierPath({ sourceX, sourceY, targetX, targetY });
  } else {
    const s1 = mx > sourceX ? 1 : -1;
    const sy = targetY > sourceY ? 1 : -1;
    const s2 = targetX > mx ? 1 : -1;
    const f = (v: number) => v.toFixed(1);
    d = `M${f(sourceX)} ${f(sourceY)} L${f(mx - s1 * r)} ${f(sourceY)} Q${f(mx)} ${f(sourceY)} ${f(mx)} ${f(sourceY + sy * r)} L${f(mx)} ${f(targetY - sy * r)} Q${f(mx)} ${f(targetY)} ${f(mx + s2 * r)} ${f(targetY)} L${f(targetX)} ${f(targetY)}`;
  }

  return (
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
  );
}
