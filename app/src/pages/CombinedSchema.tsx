import { useCallback, useState } from "react";
import { Header, HeaderButton } from "../components/Header";
import {
  DiagramShell,
  clearDiagramLayout,
  edgeKeyOf,
  loadEdgeMidXs,
} from "../components/DiagramShell";
import { StepWalkthrough } from "../components/StepWalkthrough";
import { NODES, EDGES, STEPS, SYSTEMS } from "../data/combinedSchema";

const STORAGE_KEY = "lq-combined-schema";

export function CombinedSchema() {
  const [currentStep, setCurrentStep] = useState(0);
  const [layoutKey, setLayoutKey] = useState(0);
  const step = STEPS[currentStep];

  const resetLayout = useCallback(() => {
    clearDiagramLayout(STORAGE_KEY);
    setLayoutKey((k) => k + 1);
  }, []);

  const copyLayout = useCallback(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const saved: Record<string, { x: number; y: number }> = raw
        ? JSON.parse(raw)
        : {};
      const nodes = NODES.map((n) => {
        const pos = saved[n.id] ?? { x: n.x, y: n.y };
        return { id: n.id, x: Math.round(pos.x), y: Math.round(pos.y), w: n.w };
      });
      const savedMidXs = loadEdgeMidXs(STORAGE_KEY);
      const edges: Record<string, number> = {};
      for (const e of EDGES) {
        const midX = savedMidXs[edgeKeyOf(e)] ?? e.midX;
        if (midX != null) edges[edgeKeyOf(e)] = Math.round(midX);
      }
      void navigator.clipboard.writeText(
        JSON.stringify({ nodes, edges }, null, 2),
      );
    } catch {}
  }, []);

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <Header
        title="Combined Template Schema"
        subtitle="LangQuest · Content + Library + Process systems"
        actions={
          <>
            <HeaderButton onClick={copyLayout}>⎘ Copy Layout</HeaderButton>
            <HeaderButton onClick={resetLayout}>⟲ Reset</HeaderButton>
          </>
        }
        currentHash="#combined"
      />

      <div className="flex-1 min-h-0 relative flex flex-col">
        <DiagramShell
          key={layoutKey}
          storageKey={STORAGE_KEY}
          nodeDefs={NODES}
          edgeDefs={EDGES}
          highlightedNodes={step?.highlightNodes}
          diagramTitle="all three template systems + the existing tables they connect with"
        />
        <Legend />
      </div>

      <StepWalkthrough
        steps={STEPS}
        currentStep={currentStep}
        onStepChange={setCurrentStep}
        phaseLabel="Combined Schema"
        phaseColor="var(--color-accent-blue)"
      />
    </div>
  );
}

function Legend() {
  return (
    <div className="absolute top-2 left-2 z-10 bg-panel border border-border rounded-[10px] px-3 py-2.5 backdrop-blur-[8px] pointer-events-none">
      <div className="font-mono text-[.6rem] text-txt-dim uppercase tracking-[.12em] mb-1.5">
        Systems
      </div>
      <div className="flex flex-col gap-1">
        {Object.values(SYSTEMS).map((s) => (
          <div key={s.label} className="flex items-center gap-2">
            <span
              className="w-3 h-3 rounded-[3px] border-2 shrink-0"
              style={{ borderColor: s.color }}
            />
            <span className="font-mono text-[.72rem] text-txt-muted">
              {s.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
