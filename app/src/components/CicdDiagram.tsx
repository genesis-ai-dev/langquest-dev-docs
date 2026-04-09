import { useEffect, useRef, useState } from "react";
import type { CicdStep } from "../data/cicdPipeline";
import { ALL_PATH_IDS } from "../data/cicdPipeline";

const SVG_W = 1200;
const SVG_H = 520;
const PARTICLE_SPEED = 120;

// All SVG sub-components use inline styles instead of Tailwind classes
// because Tailwind v4 utility classes don't reliably apply to SVG elements.

type Vis = "hidden" | "dim" | "vis" | "hi";

function visOpacity(vis: Vis): number {
  if (vis === "hi" || vis === "vis") return 1;
  if (vis === "dim") return 0.25;
  return 0;
}

const T = "opacity 0.5s";

function SvcNode({
  id, x, y, w, h, label, sub, vis, hiColor,
}: {
  id: string; x: number; y: number; w: number; h: number;
  label: string; sub: string; vis: Vis; hiColor: string;
}) {
  const isHi = vis === "hi";
  return (
    <g id={id} style={{ opacity: visOpacity(vis), transition: T }}>
      <rect
        x={x} y={y} width={w} height={h} rx={6} strokeWidth={1.5}
        fill="var(--color-card)"
        stroke={isHi ? hiColor : "var(--color-border)"}
        filter={isHi ? "url(#glow)" : undefined}
      />
      <text x={x + w / 2} y={y + 24} textAnchor="middle" fontSize={13} fontWeight={600} fill="var(--color-txt)">{label}</text>
      {sub && <text x={x + w / 2} y={y + 42} textAnchor="middle" fontSize={9} fill="var(--color-txt-muted)">{sub}</text>}
    </g>
  );
}

function EnvNode({
  id, x, y, vis, hiColor,
}: {
  id: string; x: number; y: number; vis: Vis; hiColor: string;
}) {
  const isHi = vis === "hi";
  return (
    <g id={id} style={{ opacity: visOpacity(vis), transition: T }}>
      <rect
        x={x} y={y} width={128} height={30} rx={6} strokeWidth={1.5}
        fill="var(--color-card)"
        stroke={isHi ? hiColor : "var(--color-border)"}
        filter={isHi ? "url(#glow)" : undefined}
      />
      <text x={x + 64} y={y + 20} textAnchor="middle" fontSize={10} fill="var(--color-txt)">.env.local</text>
    </g>
  );
}

function PillNode({
  id, x, y, label, vis, hiColor,
}: {
  id: string; x: number; y: number; label: string; vis: Vis; hiColor: string;
}) {
  const isHi = vis === "hi";
  return (
    <g id={id} style={{ opacity: visOpacity(vis), transition: T }}>
      <rect
        x={x} y={y} width={120} height={34} rx={17} strokeWidth={1.5}
        fill="var(--color-card)"
        stroke={isHi ? hiColor : "var(--color-border)"}
        filter={isHi ? "url(#glow)" : undefined}
      />
      <text x={x + 60} y={y + 22} textAnchor="middle" fontSize={10} fontWeight={600} fill="var(--color-txt)">{label}</text>
    </g>
  );
}

function MergeNode({
  id, x1, y1, x2, y2, vis,
}: {
  id: string; x1: number; y1: number; x2: number; y2: number; vis: Vis;
}) {
  const cx = x1;
  const cy = (y1 + y2) / 2;
  const isHi = vis === "hi";
  const sc = isHi ? "var(--color-accent-green)" : "var(--color-txt-dim)";
  return (
    <g id={id} style={{ opacity: visOpacity(vis), transition: T }} filter={isHi ? "url(#glow)" : undefined}>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={sc} strokeWidth={2.5} strokeLinecap="round" />
      <circle cx={cx} cy={cy} r={11} fill="var(--color-card)" stroke={sc} strokeWidth={2} />
      <text x={cx} y={cy + 5} textAnchor="middle" fontSize={13} fontWeight={700} fill="var(--color-accent-green)">✓</text>
    </g>
  );
}

function NoEditNode({
  id, cx, cy, vis,
}: {
  id: string; cx: number; cy: number; vis: Vis;
}) {
  return (
    <g id={id} style={{ opacity: visOpacity(vis), transition: T }}>
      <circle cx={cx} cy={cy} r={14} fill="rgba(248,113,113,0.12)" stroke="var(--color-accent-red)" strokeWidth={2} />
      <text x={cx} y={cy + 6} textAnchor="middle" fontSize={16} fontWeight={700} fill="var(--color-accent-red)">✕</text>
    </g>
  );
}

function BranchLane({
  id, x1, y, x2, label, color, vis,
}: {
  id: string; x1: number; y: number; x2: number; label: string; color: string; vis: Vis;
}) {
  const isHi = vis === "hi";
  return (
    <g id={id} style={{ opacity: visOpacity(vis), transition: T }} filter={isHi ? "url(#glow)" : undefined}>
      <line
        x1={x1} y1={y} x2={x2} y2={y}
        stroke={isHi ? color : "var(--color-txt-dim)"}
        strokeWidth={3} strokeLinecap="round"
      />
      <circle cx={x1} cy={y} r={5} fill={color} />
      <text x={18} y={y + 4} fontSize={12} fill="var(--color-txt-muted)" fontStyle="italic">{label}</text>
    </g>
  );
}

function ConnPath({ id, d, visible }: { id: string; d: string; visible: boolean }) {
  return (
    <path
      id={id} d={d} fill="none" strokeWidth={2} strokeLinecap="round"
      stroke="var(--color-txt-dim)"
      style={{ opacity: visible ? 0.4 : 0, transition: T }}
    />
  );
}

function ConnLine({ id, x1, y1, x2, y2, visible }: { id: string; x1: number; y1: number; x2: number; y2: number; visible: boolean }) {
  return (
    <line
      id={id} x1={x1} y1={y1} x2={x2} y2={y2} fill="none" strokeWidth={2} strokeLinecap="round"
      stroke="var(--color-txt-dim)"
      style={{ opacity: visible ? 0.4 : 0, transition: T }}
    />
  );
}

const ALWAYS_DIM = new Set(["b-feat", "b-dev", "b-main"]);

// Module-level pure function — explicit step dependency, no closure, no memoization issues
function nodeVis(id: string, step: CicdStep): Vis {
  if (step.hi.includes(id)) return "hi";
  if (step.vis.includes(id)) return "vis";
  if (step.dim.includes(id)) return "dim";
  if (ALWAYS_DIM.has(id)) return "dim";
  return "hidden";
}

function connVis(id: string, step: CicdStep): boolean {
  return step.conns.includes(id);
}

// ── Particle system ──

interface Particle {
  seq: string[];
  si: number;
  progress: number;
  color: string;
  trail: { x: number; y: number }[];
  alive: boolean;
}

function resolveColor(cssVar: string): string {
  return getComputedStyle(document.documentElement)
    .getPropertyValue(cssVar.replace("var(", "").replace(")", ""))
    .trim();
}

// ── Main diagram ──

export function CicdDiagram({ step }: { step: CicdStep }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const pathCacheRef = useRef<Record<string, { el: SVGPathElement | SVGLineElement; len: number }>>({});
  const spawnRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const rafRef = useRef(0);
  const lastTsRef = useRef(0);
  const [scale, setScale] = useState(1);

  // No local state or derived sets — use module-level nodeVis/connVis with explicit step param

  // Cache SVG path elements for particle animation
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const cache: typeof pathCacheRef.current = {};
    for (const id of ALL_PATH_IDS) {
      const el = svg.getElementById(id) as SVGPathElement | SVGLineElement | null;
      if (!el) continue;
      const len =
        "getTotalLength" in el ? el.getTotalLength() : 0;
      if (len > 0) cache[id] = { el: el as SVGPathElement, len };
    }
    pathCacheRef.current = cache;
  }, []);

  // Responsive scaling
  useEffect(() => {
    function fit() {
      const wrap = wrapRef.current;
      if (!wrap) return;
      const vw = wrap.clientWidth;
      const vh = wrap.clientHeight;
      setScale(Math.min(vw / (SVG_W + 20), vh / (SVG_H + 10), 1));
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
        const pid = p.seq[p.si];
        const entry = cache[pid];
        if (!entry) {
          p.alive = false;
          continue;
        }
        p.progress += (PARTICLE_SPEED / entry.len) * cdt;
        const pt = (entry.el as SVGGeometryElement).getPointAtLength(
          Math.min(p.progress, 1) * entry.len,
        );
        p.trail.unshift({ x: pt.x, y: pt.y });
        if (p.trail.length > 6) p.trail.pop();
        if (p.progress >= 1) {
          p.si++;
          p.progress = 0;
          if (p.si >= p.seq.length) p.alive = false;
        }
      }
      particlesRef.current = particlesRef.current.filter((p) => p.alive);

      ctx!.clearRect(0, 0, SVG_W, SVG_H);
      for (const p of particlesRef.current) {
        if (!p.trail.length) continue;
        for (let i = p.trail.length - 1; i >= 0; i--) {
          const t = p.trail[i];
          const a = 1 - i / p.trail.length;
          const r = 3 - i * 0.35;
          if (r <= 0 || a <= 0) continue;
          ctx!.save();
          ctx!.globalAlpha = a * 0.2;
          ctx!.shadowBlur = 10;
          ctx!.shadowColor = p.color;
          ctx!.beginPath();
          ctx!.arc(t.x, t.y, r + 2, 0, Math.PI * 2);
          ctx!.fillStyle = p.color;
          ctx!.fill();
          ctx!.restore();
          ctx!.save();
          ctx!.globalAlpha = a * 0.7;
          ctx!.beginPath();
          ctx!.arc(t.x, t.y, r, 0, Math.PI * 2);
          ctx!.fillStyle = p.color;
          ctx!.fill();
          ctx!.restore();
        }
        const h = p.trail[0];
        ctx!.save();
        ctx!.globalAlpha = 0.8;
        ctx!.beginPath();
        ctx!.arc(h.x, h.y, 1.5, 0, Math.PI * 2);
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

    if (!step.particles) return;

    const color = resolveColor(step.particles.colorVar);
    const spawn = () => {
      particlesRef.current.push({
        seq: step.particles!.seq,
        si: 0,
        progress: 0,
        color,
        trail: [],
        alive: true,
      });
      if (step.particles!.alt) {
        particlesRef.current.push({
          seq: step.particles!.alt,
          si: 0,
          progress: 0,
          color,
          trail: [],
          alive: true,
        });
      }
    };
    spawn();
    spawnRef.current = setInterval(spawn, 4000);

    return () => {
      if (spawnRef.current) clearInterval(spawnRef.current);
    };
  }, [step]);

  return (
    <div ref={wrapRef} className="flex-1 min-h-0 flex items-start justify-center overflow-hidden pt-2">
      <div
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
          className="relative z-[1] font-mono"
        >
          <defs>
            <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="4" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Environment group backgrounds */}
          <rect x={30} y={8} width={245} height={155} rx={12} strokeWidth={1.5} fill="var(--color-bg)" fillOpacity={0.06} stroke="var(--color-bg)" strokeOpacity={0.1} />
          <text x={152} y={30} textAnchor="middle" fontSize={11} fontWeight={600} fill="var(--color-txt-dim)" fillOpacity={0.5}>DOCKER / DEV</text>
          <rect x={310} y={8} width={245} height={155} rx={12} strokeWidth={1.5} fill="var(--color-bg)" fillOpacity={0.06} stroke="var(--color-bg)" strokeOpacity={0.1} />
          <text x={432} y={30} textAnchor="middle" fontSize={11} fontWeight={600} fill="var(--color-txt-dim)" fillOpacity={0.5}>REMOTE / PREVIEW</text>
          <rect x={590} y={8} width={245} height={155} rx={12} strokeWidth={1.5} fill="var(--color-bg)" fillOpacity={0.06} stroke="var(--color-bg)" strokeOpacity={0.1} />
          <text x={712} y={30} textAnchor="middle" fontSize={11} fontWeight={600} fill="var(--color-txt-dim)" fillOpacity={0.5}>REMOTE / PRODUCTION</text>

          {/* Connection wires */}
          <ConnPath id="c-up-d" d="M152,295 L152,140 Q152,128 140,128 L106,128 Q94,128 94,116 L94,103" visible={connVis("c-up-d", step)} />
          <ConnPath id="c-across-d" d="M94,75 L209,75" visible={connVis("c-across-d", step)} />
          <ConnPath id="c-down-d" d="M209,103 L209,116 Q209,128 197,128 L164,128 Q152,128 152,140 L152,295" visible={connVis("c-down-d", step)} />
          <ConnPath id="c-up-p-feat" d="M432,295 L432,140 Q432,128 420,128 L386,128 Q374,128 374,116 L374,103" visible={connVis("c-up-p-feat", step)} />
          <ConnPath id="c-up-p" d="M432,370 L432,140 Q432,128 420,128 L386,128 Q374,128 374,116 L374,103" visible={connVis("c-up-p", step)} />
          <ConnPath id="c-across-p" d="M374,75 L489,75" visible={connVis("c-across-p", step)} />
          <ConnPath id="c-down-p-feat" d="M489,103 L489,116 Q489,128 477,128 L444,128 Q432,128 432,140 L432,295" visible={connVis("c-down-p-feat", step)} />
          <ConnPath id="c-down-p" d="M489,103 L489,116 Q489,128 477,128 L444,128 Q432,128 432,140 L432,370" visible={connVis("c-down-p", step)} />
          <ConnPath id="c-up-r" d="M712,445 L712,140 Q712,128 700,128 L666,128 Q654,128 654,116 L654,103" visible={connVis("c-up-r", step)} />
          <ConnPath id="c-across-r" d="M654,75 L769,75" visible={connVis("c-across-r", step)} />
          <ConnPath id="c-down-r" d="M769,103 L769,116 Q769,128 757,128 L724,128 Q712,128 712,140 L712,445" visible={connVis("c-down-r", step)} />
          <ConnLine id="c-main-expo" x1={1025} y1={445} x2={1025} y2={355} visible={connVis("c-main-expo", step)} />
          <ConnPath id="c-expo-play" d="M1010,335 L1010,260 Q1010,240 995,240 L960,240 Q945,240 945,220 L945,77" visible={connVis("c-expo-play", step)} />
          <ConnPath id="c-expo-app" d="M1040,335 L1040,260 Q1040,240 1060,240 L1085,240 Q1105,240 1105,220 L1105,77" visible={connVis("c-expo-app", step)} />

          {/* Routing-only paths for particle animation (invisible) */}
          <path id="r-merge-fd" d="M355,295 L355,370" fill="none" stroke="none" className="pointer-events-none" />
          <path id="r-merge-dm" d="M640,370 L640,445" fill="none" stroke="none" className="pointer-events-none" />

          {/* Service nodes */}
          <SvcNode id="n-sb-dev" x={42} y={48} w={105} h={55} label="SB" sub="Supabase" vis={nodeVis("n-sb-dev", step)} hiColor="var(--color-accent-cyan)" />
          <SvcNode id="n-ps-dev" x={157} y={48} w={105} h={55} label="PS" sub="PowerSync" vis={nodeVis("n-ps-dev", step)} hiColor="var(--color-accent-cyan)" />
          <SvcNode id="n-sb-prev" x={322} y={48} w={105} h={55} label="SB" sub="Supabase" vis={nodeVis("n-sb-prev", step)} hiColor="var(--color-accent-purple)" />
          <SvcNode id="n-ps-prev" x={437} y={48} w={105} h={55} label="PS" sub="PowerSync" vis={nodeVis("n-ps-prev", step)} hiColor="var(--color-accent-purple)" />
          <SvcNode id="n-sb-prod" x={602} y={48} w={105} h={55} label="SB" sub="Supabase" vis={nodeVis("n-sb-prod", step)} hiColor="var(--color-accent-green)" />
          <SvcNode id="n-ps-prod" x={717} y={48} w={105} h={55} label="PS" sub="PowerSync" vis={nodeVis("n-ps-prod", step)} hiColor="var(--color-accent-green)" />

          {/* Env nodes */}
          <EnvNode id="n-env-dev" x={88} y={190} vis={nodeVis("n-env-dev", step)} hiColor="var(--color-accent-cyan)" />
          <EnvNode id="n-env-prev" x={368} y={190} vis={nodeVis("n-env-prev", step)} hiColor="var(--color-accent-purple)" />
          <EnvNode id="n-env-prod" x={648} y={190} vis={nodeVis("n-env-prod", step)} hiColor="var(--color-accent-green)" />

          {/* Store nodes */}
          <SvcNode id="n-play" x={880} y={12} w={130} h={65} label="Play Store" sub="Google Play" vis={nodeVis("n-play", step)} hiColor="var(--color-accent-green)" />
          <SvcNode id="n-app" x={1040} y={12} w={130} h={65} label="App Store" sub="Apple" vis={nodeVis("n-app", step)} hiColor="var(--color-accent-green)" />

          {/* PR checks */}
          <PillNode id="n-pr-dev" x={295} y={322} label="PR checks" vis={nodeVis("n-pr-dev", step)} hiColor="var(--color-accent-pink)" />
          <PillNode id="n-pr-main" x={580} y={397} label="PR checks" vis={nodeVis("n-pr-main", step)} hiColor="var(--color-accent-green)" />

          {/* Merge indicators */}
          <MergeNode id="n-merge-fd" x1={355} y1={295} x2={355} y2={370} vis={nodeVis("n-merge-fd", step)} />
          <MergeNode id="n-merge-dm" x1={640} y1={370} x2={640} y2={445} vis={nodeVis("n-merge-dm", step)} />

          {/* No-edit indicators */}
          <NoEditNode id="n-noedit-sp" cx={374} cy={75} vis={nodeVis("n-noedit-sp", step)} />
          <NoEditNode id="n-noedit-pp" cx={489} cy={75} vis={nodeVis("n-noedit-pp", step)} />
          <NoEditNode id="n-noedit-sr" cx={654} cy={75} vis={nodeVis("n-noedit-sr", step)} />
          <NoEditNode id="n-noedit-pr" cx={769} cy={75} vis={nodeVis("n-noedit-pr", step)} />

          {/* Expo */}
          <SvcNode id="n-expo" x={960} y={335} w={130} h={40} label="Expo / EAS" sub="" vis={nodeVis("n-expo", step)} hiColor="var(--color-accent-green)" />

          {/* Branch lanes */}
          <BranchLane id="b-feat" x1={130} y={295} x2={460} label="Your branch" color="var(--color-accent-amber)" vis={nodeVis("b-feat", step)} />
          <BranchLane id="b-dev" x1={130} y={370} x2={740} label="dev branch" color="var(--color-accent-purple)" vis={nodeVis("b-dev", step)} />
          <BranchLane id="b-main" x1={130} y={445} x2={1140} label="main branch" color="var(--color-accent-green)" vis={nodeVis("b-main", step)} />
        </svg>

        <canvas
          ref={canvasRef}
          width={SVG_W}
          height={SVG_H}
          className="absolute inset-0 pointer-events-none z-[2]"
          style={{ width: SVG_W, height: SVG_H }}
        />
      </div>
    </div>
  );
}
