import { useEffect, useState } from "react";

/**
 * Horizontal CLI-tree diagram:
 *   LEFT   Ana's shared template (blueprint)
 *   →      source_copied_id provenance lines
 *   CENTER Ben's copied template (project-specific)
 *   →      template_node_id link lines
 *   RIGHT  Linked quests/assets (or ghost "waiting" slots)
 */

// ─── Data ────────────────────────────────────────────────────────────────────

interface TNode {
  id: string;
  label: string;
  type: string;
  depth: number;
  isLast: boolean;
  continuations: number[];
  linkableType?: "quest" | "asset";
}

interface LinkedItem {
  label: string;
  sub: string;
  filled: boolean;
}

const TREE: TNode[] = [
  { id: "m",  label: "📖 Prot. Bible", type: "mother",  depth: 0, isLast: true,  continuations: [] },
  { id: "b",  label: "Luke",           type: "book",    depth: 1, isLast: true,  continuations: [] },
  { id: "c1", label: "Chapter 1",      type: "chapter", depth: 2, isLast: false, continuations: [2], linkableType: "quest" },
  { id: "v1", label: "1:1",            type: "verse",   depth: 3, isLast: false, continuations: [2, 3], linkableType: "asset" },
  { id: "v2", label: "1:2",            type: "verse",   depth: 3, isLast: false, continuations: [2, 3], linkableType: "asset" },
  { id: "v3", label: "1:3",            type: "verse",   depth: 3, isLast: true,  continuations: [2], linkableType: "asset" },
  { id: "c2", label: "Chapter 2",      type: "chapter", depth: 2, isLast: true,  continuations: [], linkableType: "quest" },
  { id: "v4", label: "2:1",            type: "verse",   depth: 3, isLast: true,  continuations: [], linkableType: "asset" },
];

const LINKS: Record<string, LinkedItem[]> = {
  c1: [
    { label: "quest q-A", sub: "Ana v1", filled: true },
    { label: "quest q-B", sub: "Ben v2", filled: true },
  ],
  v1: [{ label: "asset a-1", sub: "audio", filled: true }],
  v2: [{ label: "asset a-2", sub: "audio", filled: true }],
  v3: [{ label: "waiting…", sub: "no asset", filled: false }],
  c2: [{ label: "waiting…", sub: "no quest", filled: false }],
  v4: [{ label: "waiting…", sub: "no asset", filled: false }],
};

// ─── Layout ──────────────────────────────────────────────────────────────────

const ROW_H = 40;
const INDENT = 22;
const ELBOW = 12;
const NODE_W = 110;
const NODE_H = 26;
const NODE_RX = 4;
const LINK_W = 88;
const LINK_H = 26;
const LINK_SPACING = 4;
const MAX_DEPTH = 3;
const LABEL_H = 26;

const TREE_W = MAX_DEPTH * INDENT + NODE_W + INDENT;
const PROV_GAP = 44;
const LINK_GAP = 18;

const COL_LEFT = 12;
const COL_CENTER = COL_LEFT + TREE_W + PROV_GAP;
const COL_RIGHT = COL_CENTER + TREE_W + LINK_GAP;

const TOP = LABEL_H + 8;
const TOTAL_H = TOP + TREE.length * ROW_H + 12;
const TOTAL_W = COL_RIGHT + (LINK_W + LINK_SPACING) * 2 + 16;

function nodeColor(type: string) {
  if (type === "mother") return "var(--color-accent-pink)";
  if (type === "book" || type === "chapter") return "var(--color-accent-green)";
  return "var(--color-accent-cyan)";
}

// ─── Tree row ────────────────────────────────────────────────────────────────

function TreeRow({
  node, rowIndex, baseX, opacity, isCopy,
}: {
  node: TNode; rowIndex: number; baseX: number; opacity: number; isCopy?: boolean;
}) {
  const x = baseX + node.depth * INDENT;
  const y = TOP + rowIndex * ROW_H;
  const color = nodeColor(node.type);

  const lines: React.ReactNode[] = [];

  if (node.depth > 0) {
    const elbowX = x - ELBOW;
    const midY = y + NODE_H / 2;
    const prevY = TOP + (rowIndex - 1) * ROW_H + NODE_H / 2;

    lines.push(
      <line key="h" x1={elbowX} y1={midY} x2={x - 2} y2={midY}
        stroke="var(--color-border-hi)" strokeWidth={1} opacity={opacity} />
    );
    lines.push(
      <line key="v" x1={elbowX} y1={prevY} x2={elbowX} y2={midY}
        stroke="var(--color-border-hi)" strokeWidth={1} opacity={opacity} />
    );
  }

  for (const d of node.continuations) {
    const cx = baseX + d * INDENT - ELBOW;
    lines.push(
      <line key={`c-${d}`}
        x1={cx} y1={TOP + (rowIndex - 1) * ROW_H + NODE_H / 2}
        x2={cx} y2={TOP + rowIndex * ROW_H + NODE_H / 2}
        stroke="var(--color-border-hi)" strokeWidth={1} opacity={opacity} />
    );
  }

  return (
    <g style={{ opacity, transition: "opacity 0.5s ease" }}>
      {lines}
      <rect x={x} y={y} width={NODE_W} height={NODE_H} rx={NODE_RX}
        fill={isCopy ? "var(--color-card)" : "var(--color-bg)"}
        stroke={color} strokeWidth={isCopy ? 1.6 : 1.2}
        strokeDasharray={isCopy ? "5 3" : undefined} />
      <text x={x + 6} y={y + 10.5}
        fontFamily="var(--font-mono)" fontSize={7.5} fontWeight={600} fill={color}>
        {node.label}
      </text>
      <text x={x + 6} y={y + 20}
        fontFamily="var(--font-mono)" fontSize={5.8} fill="var(--color-txt-dim)">
        {node.type}{node.linkableType ? ` → ${node.linkableType}` : ""}
      </text>
    </g>
  );
}

// ─── Linked items ────────────────────────────────────────────────────────────

function LinkedItems({
  node, rowIndex, centerBaseX, opacity,
}: {
  node: TNode; rowIndex: number; centerBaseX: number; opacity: number;
}) {
  const items = LINKS[node.id];
  if (!items) return null;

  const nodeRight = centerBaseX + node.depth * INDENT + NODE_W;
  const y = TOP + rowIndex * ROW_H;
  const midY = y + NODE_H / 2;

  return (
    <g style={{ opacity, transition: "opacity 0.6s ease" }}>
      <line x1={nodeRight + 2} y1={midY} x2={COL_RIGHT - 2} y2={midY}
        stroke={items[0].filled ? "var(--color-accent-purple)" : "var(--color-border)"}
        strokeWidth={1} strokeDasharray="3 3"
        markerEnd={items[0].filled ? "url(#arr-link)" : undefined} />

      {items.map((item, i) => {
        const ix = COL_RIGHT + i * (LINK_W + LINK_SPACING);
        return (
          <g key={i}>
            <rect x={ix} y={y} width={LINK_W} height={LINK_H} rx={NODE_RX}
              fill={item.filled ? "var(--color-card)" : "transparent"}
              stroke={item.filled ? "var(--color-accent-purple)" : "var(--color-border)"}
              strokeWidth={item.filled ? 1.4 : 0.8}
              strokeDasharray={item.filled ? undefined : "4 3"}
              opacity={item.filled ? 1 : 0.35} />
            <text x={ix + 5} y={y + 10.5}
              fontFamily="var(--font-mono)" fontSize={7}
              fontWeight={item.filled ? 600 : 400}
              fill={item.filled ? "var(--color-accent-purple)" : "var(--color-txt-dim)"}
              opacity={item.filled ? 1 : 0.45}>
              {item.label}
            </text>
            <text x={ix + 5} y={y + 20}
              fontFamily="var(--font-mono)" fontSize={5.5}
              fill="var(--color-txt-dim)" opacity={item.filled ? 0.6 : 0.25}>
              {item.sub}
            </text>
          </g>
        );
      })}
    </g>
  );
}

// ─── Main ────────────────────────────────────────────────────────────────────

export function TemplateCopyDiagram({ active }: { active: boolean }) {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    if (!active) { setPhase(0); return; }
    const t1 = setTimeout(() => setPhase(1), 300);
    const t2 = setTimeout(() => setPhase(2), 1200);
    const t3 = setTimeout(() => setPhase(3), 2100);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [active]);

  return (
    <div className="flex-1 min-h-0 relative flex items-center justify-center bg-bg overflow-auto p-4">
      <svg viewBox={`0 0 ${TOTAL_W} ${TOTAL_H}`}
        style={{ width: "100%", height: "100%", maxWidth: TOTAL_W * 1.3, maxHeight: TOTAL_H * 1.3 }}
        preserveAspectRatio="xMidYMid meet">
        <defs>
          <marker id="arr-link" viewBox="0 0 8 8" refX="7" refY="4"
            markerWidth={5} markerHeight={5} orient="auto">
            <path d="M0,1 L7,4 L0,7" fill="none"
              stroke="var(--color-accent-purple)" strokeWidth={1.4} />
          </marker>
          <marker id="arr-prov" viewBox="0 0 8 8" refX="7" refY="4"
            markerWidth={5} markerHeight={5} orient="auto">
            <path d="M0,1 L7,4 L0,7" fill="none"
              stroke="var(--color-accent-pink)" strokeWidth={1.4} />
          </marker>
        </defs>

        {/* ── Column labels ── */}
        <text x={COL_LEFT + TREE_W / 2} y={12}
          fontFamily="var(--font-mono)" fontSize={8} fontWeight={700}
          fill="var(--color-accent-green)" textAnchor="middle" letterSpacing="0.06em">
          ANA'S SHARED TEMPLATE
        </text>
        <text x={COL_LEFT + TREE_W / 2} y={22}
          fontFamily="var(--font-mono)" fontSize={5.8}
          fill="var(--color-txt-dim)" textAnchor="middle">
          shared = true · blueprint only
        </text>

        <text x={COL_CENTER + TREE_W / 2} y={12}
          fontFamily="var(--font-mono)" fontSize={8} fontWeight={700}
          fill="var(--color-accent-purple)" textAnchor="middle" letterSpacing="0.06em"
          opacity={phase >= 1 ? 1 : 0} style={{ transition: "opacity 0.5s ease" }}>
          BEN'S COPY (project)
        </text>
        <text x={COL_CENTER + TREE_W / 2} y={22}
          fontFamily="var(--font-mono)" fontSize={5.8}
          fill="var(--color-txt-dim)" textAnchor="middle"
          opacity={phase >= 1 ? 1 : 0} style={{ transition: "opacity 0.5s ease" }}>
          source_copied_id → Ana's nodes
        </text>

        <text x={COL_RIGHT + LINK_W} y={12}
          fontFamily="var(--font-mono)" fontSize={8} fontWeight={700}
          fill="var(--color-accent-purple)" textAnchor="middle" letterSpacing="0.06em"
          opacity={phase >= 2 ? 1 : 0} style={{ transition: "opacity 0.5s ease" }}>
          QUESTS & ASSETS
        </text>
        <text x={COL_RIGHT + LINK_W} y={22}
          fontFamily="var(--font-mono)" fontSize={5.8}
          fill="var(--color-txt-dim)" textAnchor="middle"
          opacity={phase >= 2 ? 1 : 0} style={{ transition: "opacity 0.5s ease" }}>
          template_node_id → Ben's nodes
        </text>

        {/* ── Left: original tree ── */}
        {TREE.map((node, i) => (
          <TreeRow key={`L-${node.id}`} node={node} rowIndex={i}
            baseX={COL_LEFT} opacity={1} />
        ))}

        {/* ── Center: copied tree ── */}
        {TREE.map((node, i) => (
          <TreeRow key={`C-${node.id}`} node={node} rowIndex={i}
            baseX={COL_CENTER} opacity={phase >= 1 ? 1 : 0} isCopy />
        ))}

        {/* ── Provenance arrows (left → center) ── */}
        {TREE.map((node, i) => {
          const leftX = COL_LEFT + node.depth * INDENT + NODE_W + 2;
          const rightX = COL_CENTER + node.depth * INDENT - 2;
          const y = TOP + i * ROW_H + NODE_H / 2;
          return (
            <line key={`P-${node.id}`}
              x1={leftX} y1={y} x2={rightX} y2={y}
              stroke="var(--color-accent-pink)" strokeWidth={1}
              strokeDasharray="3 4" markerEnd="url(#arr-prov)"
              opacity={phase >= 1 ? 0.4 : 0}
              style={{ transition: "opacity 0.6s ease" }} />
          );
        })}

        {/* ── "source_copied_id" label ── */}
        <text x={(COL_LEFT + TREE_W + COL_CENTER) / 2} y={TOP - 2}
          fontFamily="var(--font-mono)" fontSize={6}
          fill="var(--color-accent-pink)" textAnchor="middle"
          opacity={phase >= 1 ? 0.6 : 0}
          style={{ transition: "opacity 0.6s ease" }}>
          source_copied_id →
        </text>

        {/* ── Right: linked quests/assets ── */}
        {TREE.map((node, i) =>
          node.linkableType ? (
            <LinkedItems key={`R-${node.id}`} node={node} rowIndex={i}
              centerBaseX={COL_CENTER} opacity={phase >= 2 ? 1 : 0} />
          ) : null
        )}

        {/* ── "template_node_id" label ── */}
        <text x={(COL_CENTER + TREE_W + COL_RIGHT) / 2} y={TOP - 2}
          fontFamily="var(--font-mono)" fontSize={6}
          fill="var(--color-accent-purple)" textAnchor="middle"
          opacity={phase >= 2 ? 0.6 : 0}
          style={{ transition: "opacity 0.6s ease" }}>
          template_node_id →
        </text>
      </svg>
    </div>
  );
}
