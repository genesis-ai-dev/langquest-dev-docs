import { useState, useCallback } from "react";
import { Header, HeaderButton } from "../components/Header";
import { StepWalkthrough } from "../components/StepWalkthrough";
import {
  TemplateLifecycleDiagram,
  copySceneLayout,
  resetSceneLayout,
} from "../components/TemplateLifecycleDiagram";
import { STEPS, SCENES } from "../data/templateLifecycle";

export function TemplateLifecycle() {
  const [currentStep, setCurrentStep] = useState(0);
  const [layoutKey, setLayoutKey] = useState(0);

  const scene = SCENES[currentStep];

  const handleCopy = useCallback(() => {
    copySceneLayout(currentStep, scene.nodes);
  }, [currentStep, scene.nodes]);

  const handleReset = useCallback(() => {
    resetSceneLayout(currentStep);
    setLayoutKey((k) => k + 1);
  }, [currentStep]);

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <Header
        title="Template Lifecycle"
        subtitle="LangQuest · Template Actions & Reconciliation"
        actions={
          <>
            <HeaderButton onClick={handleCopy}>Copy Layout</HeaderButton>
            <HeaderButton onClick={handleReset}>Reset Layout</HeaderButton>
          </>
        }
        currentHash="#lifecycle"
      />

      <TemplateLifecycleDiagram
        step={currentStep}
        nodeDefs={scene.nodes}
        edgeDefs={scene.edges}
        layoutKey={layoutKey}
      />

      <StepWalkthrough
        steps={STEPS}
        currentStep={currentStep}
        onStepChange={setCurrentStep}
        phaseLabel="Lifecycle"
        phaseColor="var(--color-accent-green)"
      />
    </div>
  );
}
