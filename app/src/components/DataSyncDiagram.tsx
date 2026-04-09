import { useCallback, useEffect, useRef, useState } from "react";
import {
  DEFAULT_NODES,
  CONNECTIONS,
  ALL_CONNECTION_IDS,
  type SyncNode,
  type SyncStep,
  type SyncConnection,
} from "../data/dataSyncFlow";

const SVG_W = 1300;
const SVG_H = 800;
const HW = 95;
const HH = 29;
const CORNER_R = 14;
const PACKET_SPEED = 300;
const LS_KEY = "lq-sync-pos";

const NODE_COLORS: Record<SyncNode["color"], string> = {
  cyan: "var(--color-accent-cyan)",
  green: "var(--color-accent-green)",
  purple: "var(--color-accent-purple)",
};

// ── Path routing (matching original HTML logic exactly) ──

interface NodePos {
  cx: number;
  cy: number;
}

function edgePoint(n: NodePos, edge: string): [number, number] {
  switch (edge) {
    case "top": return [n.cx, n.cy - HH];
    case "bottom": return [n.cx, n.cy + HH];
    case "left": return [n.cx - HW, n.cy];
    case "right": return [n.cx + HW, n.cy];
    default: return [n.cx, n.cy];
  }
}

function routePoints(
  conn: SyncConnection,
  positions: Record<string, NodePos>,
): number[][] {
  const fn = positions[conn.from];
  const tn = positions[conn.to];
  if (!fn || !tn) return [];
  const [x1, y1] = edgePoint(fn, conn.fromEdge);
  const [x2, y2] = edgePoint(tn, conn.toEdge);
  const fH = conn.fromEdge === "left" || conn.fromEdge === "right";
  const tH = conn.toEdge === "left" || conn.toEdge === "right";

  if (!fH && !tH) {
    if (Math.abs(x1 - x2) < 3) return [[x1, y1], [x2, y2]];
    const my = (y1 + y2) / 2;
    return [[x1, y1], [x1, my], [x2, my], [x2, y2]];
  }
  if (fH && tH) {
    if (Math.abs(y1 - y2) < 3) return [[x1, y1], [x2, y2]];
    const mx = (x1 + x2) / 2;
    return [[x1, y1], [mx, y1], [mx, y2], [x2, y2]];
  }
  if (fH && !tH) return [[x1, y1], [x2, y1], [x2, y2]];
  return [[x1, y1], [x1, y2], [x2, y2]];
}

function pointsToD(pts: number[][], r: number): string {
  if (pts.length < 2) return "";
  let d = `M ${pts[0][0]} ${pts[0][1]}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const [px, py] = pts[i - 1];
    const [cx, cy] = pts[i];
    const [nx, ny] = pts[i + 1];
    const dx1 = Math.sign(cx - px), dy1 = Math.sign(cy - py);
    const dx2 = Math.sign(nx - cx), dy2 = Math.sign(ny - cy);
    const s1 = Math.abs(cx - px) + Math.abs(cy - py);
    const s2 = Math.abs(nx - cx) + Math.abs(ny - cy);
    const ar = Math.min(r, s1 / 2.2, s2 / 2.2);
    d += ` L ${cx - dx1 * ar} ${cy - dy1 * ar} Q ${cx} ${cy} ${cx + dx2 * ar} ${cy + dy2 * ar}`;
  }
  const last = pts[pts.length - 1];
  d += ` L ${last[0]} ${last[1]}`;
  return d;
}

function labelPos(pts: number[][]): { x: number; y: number } {
  if (pts.length === 2)
    return { x: (pts[0][0] + pts[1][0]) / 2, y: (pts[0][1] + pts[1][1]) / 2 };
  if (pts.length === 4)
    return { x: (pts[1][0] + pts[2][0]) / 2, y: (pts[1][1] + pts[2][1]) / 2 };
  const m = Math.floor(pts.length / 2);
  return { x: pts[m][0], y: pts[m][1] };
}

// ── Particle ──

interface Particle {
  pathIds: string[];
  pi: number;
  progress: number;
  color: string;
  trail: { x: number; y: number }[];
  alive: boolean;
}

// ── Diagram Component ──

export function DataSyncDiagram({
  step,
  isOnline,
}: {
  step: SyncStep | null;
  isOnline: boolean;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const pathCacheRef = useRef<Record<string, { el: SVGPathElement; len: number }>>({});
  const spawnRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const rafRef = useRef(0);
  const lastTsRef = useRef(0);
  const [scale, setScale] = useState(1);
  const [positions, setPositions] = useState<Record<string, NodePos>>(() => {
    const init: Record<string, NodePos> = {};
    for (const n of DEFAULT_NODES) init[n.id] = { cx: n.cx, cy: n.cy };
    try {
      const saved = localStorage.getItem(LS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        for (const k in parsed) {
          if (init[k]) Object.assign(init[k], parsed[k]);
        }
      }
    } catch { /* ignore */ }
    return init;
  });
  const [tooltip, setTooltip] = useState<{
    node: SyncNode;
    x: number;
    y: number;
  } | null>(null);
  const dragRef = useRef<{
    nodeId: string;
    startX: number;
    startY: number;
    origCx: number;
    origCy: number;
  } | null>(null);

  // Compute paths from current positions
  const pathData = CONNECTIONS.map((c) => {
    const pts = routePoints(c, positions);
    return { conn: c, pts, d: pointsToD(pts, CORNER_R), lp: pts.length >= 2 ? labelPos(pts) : { x: 0, y: 0 } };
  });

  // Offline marker position
  const offlineConn: SyncConnection = { id: "_off", from: "connector", fromEdge: "top", to: "rpc", toEdge: "bottom", label: "" };
  const offlinePts = routePoints(offlineConn, positions);
  const offlinePos = offlinePts.length >= 2 ? labelPos(offlinePts) : { x: 0, y: 0 };

  // Active path/label sets
  const activePathSet = new Set(step?.paths ?? []);
  const activeLabelSet = new Set(step?.labels ?? []);
  const stepColor = step?.color ?? null;

  // Cache SVG path elements after render
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const cache: typeof pathCacheRef.current = {};
    for (const id of ALL_CONNECTION_IDS) {
      const el = svg.getElementById("path-" + id) as SVGPathElement | null;
      if (!el) continue;
      const len = el.getTotalLength();
      if (len > 0) cache[id] = { el, len };
    }
    pathCacheRef.current = cache;
  });

  // Responsive scaling
  useEffect(() => {
    function fit() {
      const wrap = wrapRef.current;
      if (!wrap) return;
      setScale(Math.min(wrap.clientWidth / (SVG_W + 20), wrap.clientHeight / (SVG_H + 10), 1));
    }
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  // Init canvas DPR
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = SVG_W * dpr;
    canvas.height = SVG_H * dpr;
    const ctx = canvas.getContext("2d");
    if (ctx) ctx.scale(dpr, dpr);
  }, []);

  // Particle animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    function animate(ts: number) {
      const dt = lastTsRef.current ? (ts - lastTsRef.current) / 1000 : 0.016;
      lastTsRef.current = ts;
      const cdt = Math.min(dt, 0.05);
      const cache = pathCacheRef.current;

      for (let i = particlesRef.current.length - 1; i >= 0; i--) {
        const p = particlesRef.current[i];
        if (!p.alive) continue;
        const pid = p.pathIds[p.pi];
        const entry = cache[pid];
        if (!entry) { p.alive = false; continue; }
        p.progress += (PACKET_SPEED / entry.len) * cdt;
        const pt = entry.el.getPointAtLength(Math.min(p.progress, 1) * entry.len);
        p.trail.unshift({ x: pt.x, y: pt.y });
        if (p.trail.length > 10) p.trail.pop();
        if (p.progress >= 1) {
          p.pi++;
          p.progress = 0;
          if (p.pi >= p.pathIds.length) p.alive = false;
        }
      }
      particlesRef.current = particlesRef.current.filter((p) => p.alive);

      ctx!.clearRect(0, 0, SVG_W, SVG_H);
      for (const p of particlesRef.current) {
        if (!p.trail.length) continue;
        for (let i = p.trail.length - 1; i >= 0; i--) {
          const t = p.trail[i];
          const a = 1 - i / p.trail.length;
          const r = 5 - i * 0.4;
          if (r <= 0 || a <= 0) continue;
          ctx!.save();
          ctx!.globalAlpha = a * 0.3;
          ctx!.shadowBlur = 16;
          ctx!.shadowColor = p.color;
          ctx!.beginPath();
          ctx!.arc(t.x, t.y, r + 3, 0, Math.PI * 2);
          ctx!.fillStyle = p.color;
          ctx!.fill();
          ctx!.restore();
          ctx!.save();
          ctx!.globalAlpha = a;
          ctx!.beginPath();
          ctx!.arc(t.x, t.y, r, 0, Math.PI * 2);
          ctx!.fillStyle = p.color;
          ctx!.fill();
          ctx!.restore();
        }
        const h = p.trail[0];
        ctx!.save();
        ctx!.globalAlpha = 1;
        ctx!.beginPath();
        ctx!.arc(h.x, h.y, 2, 0, Math.PI * 2);
        ctx!.fillStyle = "#fff";
        ctx!.fill();
        ctx!.restore();
      }
      rafRef.current = requestAnimationFrame(animate);
    }
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  // Spawn particles on step change
  useEffect(() => {
    if (spawnRef.current) {
      clearInterval(spawnRef.current);
      spawnRef.current = null;
    }
    particlesRef.current = [];

    if (!step || step.paths.length === 0 || !step.color) return;

    const color = step.color;
    const spawn = () => {
      particlesRef.current.push({
        pathIds: [...step.paths],
        pi: 0,
        progress: 0,
        color,
        trail: [],
        alive: true,
      });
    };
    spawn();
    spawnRef.current = setInterval(spawn, 2800);

    return () => {
      if (spawnRef.current) clearInterval(spawnRef.current);
    };
  }, [step]);

  // Drag handlers
  const handleMouseDown = useCallback(
    (e: React.MouseEvent, nodeId: string) => {
      if (e.button !== 0) return;
      e.preventDefault();
      const n = positions[nodeId];
      dragRef.current = {
        nodeId,
        startX: e.clientX,
        startY: e.clientY,
        origCx: n.cx,
        origCy: n.cy,
      };
      setTooltip(null);
    },
    [positions],
  );

  useEffect(() => {
    function onMove(e: MouseEvent) {
      if (!dragRef.current) return;
      e.preventDefault();
      const d = document.querySelector<HTMLElement>("[data-sync-diagram]");
      const s = d ? new DOMMatrix(getComputedStyle(d).transform).a : 1;
      const { nodeId, startX, startY, origCx, origCy } = dragRef.current;
      const dx = (e.clientX - startX) / s;
      const dy = (e.clientY - startY) / s;
      setPositions((prev) => ({
        ...prev,
        [nodeId]: { cx: origCx + dx, cy: origCy + dy },
      }));
    }
    function onUp() {
      if (!dragRef.current) return;
      dragRef.current = null;
      setPositions((p) => {
        try { localStorage.setItem(LS_KEY, JSON.stringify(p)); } catch { /* ignore */ }
        return p;
      });
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  const resetLayout = useCallback(() => {
    const init: Record<string, NodePos> = {};
    for (const n of DEFAULT_NODES) init[n.id] = { cx: n.cx, cy: n.cy };
    setPositions(init);
    try { localStorage.removeItem(LS_KEY); } catch { /* ignore */ }
  }, []);

  return (
    <div ref={wrapRef} className="flex-1 min-h-0 flex items-start justify-center overflow-hidden pt-2 relative">
      <div
        data-sync-diagram
        style={{
          width: SVG_W,
          height: SVG_H,
          transform: `scale(${scale})`,
          transformOrigin: "top center",
          position: "relative",
          flexShrink: 0,
        }}
      >
        <svg
          ref={svgRef}
          viewBox={`0 0 ${SVG_W} ${SVG_H}`}
          width={SVG_W}
          height={SVG_H}
          style={{ position: "absolute", inset: 0, zIndex: 1 }}
          className="font-mono"
        >
          <defs>
            <filter id="sync-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="4" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Zone labels */}
          <text x={650} y={30} textAnchor="middle" fontSize={12} letterSpacing=".25em" fill="var(--color-txt-dim)" fillOpacity={0.15} style={{ textTransform: "uppercase" }}>
            Supabase / Postgres
          </text>
          <text x={650} y={790} textAnchor="middle" fontSize={12} letterSpacing=".25em" fill="var(--color-txt-dim)" fillOpacity={0.15} style={{ textTransform: "uppercase" }}>
            Client / React Native
          </text>

          {/* Connection paths */}
          {pathData.map(({ conn, d, lp }) => {
            const isActive = activePathSet.has(conn.id);
            const isOffline = !isOnline && (conn.id === "toRpc" || conn.id === "toConnector");
            return (
              <g key={conn.id}>
                <path
                  id={"path-" + conn.id}
                  d={d}
                  fill="none"
                  strokeLinecap="round"
                  stroke={
                    isOffline
                      ? "var(--color-accent-red)"
                      : isActive && stepColor
                        ? stepColor + "60"
                        : "var(--color-txt-dim)"
                  }
                  strokeWidth={isActive ? 4 : 3}
                  strokeOpacity={isOffline ? 0.1 : isActive ? 1 : 0.12}
                  strokeDasharray={isOffline ? "8 10" : undefined}
                  style={{
                    transition: "stroke 0.4s, stroke-width 0.3s",
                    filter: isActive && stepColor ? `drop-shadow(0 0 5px ${stepColor}40)` : undefined,
                  }}
                />
                <text
                  x={lp.x}
                  y={lp.y - 8}
                  textAnchor="middle"
                  fontSize={8.5}
                  fill="var(--color-txt)"
                  fillOpacity={activeLabelSet.has(conn.id) ? 0.35 : 0}
                  style={{ transition: "fill-opacity 0.4s", pointerEvents: "none" }}
                >
                  {conn.label}
                </text>
              </g>
            );
          })}

          {/* Offline X marker */}
          <g
            transform={`translate(${offlinePos.x},${offlinePos.y})`}
            style={{ opacity: isOnline ? 0 : 1, transition: "opacity 0.4s", pointerEvents: "none" }}
          >
            <circle r={12} fill="rgba(248,113,113,0.09)" stroke="rgba(248,113,113,0.25)" strokeWidth={1} />
            <line x1={-5} y1={-5} x2={5} y2={5} stroke="var(--color-accent-red)" strokeWidth={2} strokeLinecap="round" />
            <line x1={5} y1={-5} x2={-5} y2={5} stroke="var(--color-accent-red)" strokeWidth={2} strokeLinecap="round" />
          </g>
        </svg>

        {/* Nodes (HTML for better text/tooltip support) */}
        {DEFAULT_NODES.map((n) => {
          const pos = positions[n.id];
          const color = NODE_COLORS[n.color];
          const isPulsing = step?.pulse.includes(n.id);
          return (
            <div
              key={n.id}
              onMouseDown={(e) => handleMouseDown(e, n.id)}
              onMouseEnter={(e) => {
                if (dragRef.current) return;
                const rect = e.currentTarget.getBoundingClientRect();
                const wrap = wrapRef.current?.getBoundingClientRect();
                if (!wrap) return;
                setTooltip({
                  node: n,
                  x: (rect.right - wrap.left) / scale + 10,
                  y: (rect.top - wrap.top) / scale,
                });
              }}
              onMouseLeave={() => setTooltip(null)}
              style={{
                position: "absolute",
                left: pos.cx - HW,
                top: pos.cy - HH,
                width: n.w,
                height: n.h,
                zIndex: 15,
                cursor: dragRef.current?.nodeId === n.id ? "grabbing" : "grab",
                userSelect: "none",
                animation: isPulsing ? undefined : undefined,
              }}
              className={`rounded-[10px] border border-border bg-card flex flex-col justify-center px-3.5 transition-[border-color,box-shadow] hover:border-border-hi ${
                isPulsing ? "animate-pulse-node" : ""
              }`}
              data-pulse-color={n.color}
            >
              <span className="absolute top-1.5 right-2 font-mono text-[.48rem] text-txt-dim uppercase tracking-[.06em]">
                {n.badge}
              </span>
              <div className="font-mono text-[.73rem] font-semibold leading-tight" style={{ color }}>
                {n.label}
              </div>
              <div className="text-[.62rem] text-txt-muted mt-0.5">{n.desc}</div>
            </div>
          );
        })}

        <canvas
          ref={canvasRef}
          width={SVG_W}
          height={SVG_H}
          className="absolute inset-0 pointer-events-none"
          style={{ width: SVG_W, height: SVG_H, zIndex: 10 }}
        />
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="absolute z-[200] bg-[#161622ee] border border-border-hi rounded-[10px] px-4 py-3 max-w-[280px] pointer-events-none backdrop-blur-xl shadow-[0_10px_30px_rgba(0,0,0,.5)]"
          style={{
            left: tooltip.x * scale,
            top: tooltip.y * scale,
          }}
        >
          <div
            className="font-mono text-[.75rem] font-semibold mb-1 [&_code]:font-mono [&_code]:text-[.65rem] [&_code]:bg-code-bg [&_code]:px-1 [&_code]:rounded [&_code]:text-accent-pink"
            dangerouslySetInnerHTML={{ __html: tooltip.node.tooltip.name }}
          />
          <div
            className="text-[.72rem] text-txt-muted leading-relaxed [&_code]:font-mono [&_code]:text-[.65rem] [&_code]:bg-code-bg [&_code]:px-1 [&_code]:rounded [&_code]:text-accent-pink"
            dangerouslySetInnerHTML={{ __html: tooltip.node.tooltip.desc }}
          />
          {tooltip.node.tooltip.file && (
            <div className="font-mono text-[.55rem] text-txt-dim mt-1.5">
              📁 {tooltip.node.tooltip.file}
            </div>
          )}
        </div>
      )}

      {/* Reset button (floating) */}
      <button
        type="button"
        onClick={resetLayout}
        className="absolute bottom-2 right-2 font-mono text-[.62rem] px-2.5 py-1.5 rounded-lg border border-border bg-card text-txt-muted hover:border-border-hi hover:text-txt cursor-pointer transition-all z-20"
        title="Reset node positions"
      >
        ⟲ Reset
      </button>
    </div>
  );
}
