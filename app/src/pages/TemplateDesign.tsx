import { useCallback, useState } from "react";
import { Header, HeaderButton } from "../components/Header";
import { DiagramShell } from "../components/DiagramShell";
import { StepWalkthrough } from "../components/StepWalkthrough";
import { NODES, EDGES, STEPS } from "../data/templateDesign";

export function TemplateDesign() {
  const [currentStep, setCurrentStep] = useState(0);
  const [layoutKey, setLayoutKey] = useState(0);
  const step = STEPS[currentStep];

  const resetLayout = useCallback(() => {
    try {
      localStorage.removeItem("lq-template-design");
    } catch {}
    setLayoutKey((k) => k + 1);
  }, []);

  const copyLayout = useCallback(() => {
    try {
      const raw = localStorage.getItem("lq-template-design");
      const saved: Record<string, { x: number; y: number }> = raw
        ? JSON.parse(raw)
        : {};
      const merged = NODES.map((n) => {
        const pos = saved[n.id] ?? { x: n.x, y: n.y };
        return { id: n.id, x: Math.round(pos.x), y: Math.round(pos.y), w: n.w };
      });
      void navigator.clipboard.writeText(JSON.stringify(merged, null, 2));
    } catch {}
  }, []);

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <Header
        title="Template Design"
        subtitle="LangQuest · Proposal"
        actions={
          <>
            <HeaderButton onClick={() => (window.location.hash = "")}>
              Schema
            </HeaderButton>
            <HeaderButton onClick={() => (window.location.hash = "#migration")}>
              Migration
            </HeaderButton>
            <HeaderButton onClick={() => (window.location.hash = "#sync")}>
              Sync
            </HeaderButton>
            <HeaderButton onClick={() => (window.location.hash = "#auth")}>
              Auth
            </HeaderButton>
            <HeaderButton onClick={copyLayout}>⎘ Copy Layout</HeaderButton>
            <HeaderButton onClick={resetLayout}>⟲ Reset</HeaderButton>
          </>
        }
      />

      <DiagramShell
        key={layoutKey}
        storageKey="lq-template-design"
        nodeDefs={NODES}
        edgeDefs={EDGES}
        highlightedNodes={step?.highlightNodes}
        diagramTitle="template_node proposal — canonical structure separate from data spine"
      />

      <StepWalkthrough
        steps={STEPS}
        currentStep={currentStep}
        onStepChange={setCurrentStep}
        phaseLabel="Proposal"
        phaseColor="var(--color-accent-green)"
      />
    </div>
  );
}
