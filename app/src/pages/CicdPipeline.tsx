import { useCallback, useMemo, useState } from "react";
import { Header, HeaderButton } from "../components/Header";
import { StepWalkthrough, type Step } from "../components/StepWalkthrough";
import { CicdDiagram } from "../components/CicdDiagram";
import { STEPS } from "../data/cicdPipeline";

export function CicdPipeline() {
  const [currentStep, setCurrentStep] = useState(0);

  const handleStepChange = useCallback((step: number) => {
    setCurrentStep(step);
  }, []);

  const walkthroughSteps: Step[] = useMemo(
    () =>
      STEPS.map((s) => ({
        title: s.title,
        description: s.description,
        phase: s.phase,
        phaseColor: s.phaseColor,
      })),
    [],
  );

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <Header
        title="CI/CD Pipeline"
        subtitle="LangQuest · Developer Workflow"
        actions={
          <>
            <HeaderButton onClick={() => (window.location.hash = "")}>
              ← Schema
            </HeaderButton>
            <HeaderButton onClick={() => (window.location.hash = "migration")}>
              Migration
            </HeaderButton>
          </>
        }
      />

      <CicdDiagram step={STEPS[currentStep]} />

      <StepWalkthrough
        steps={walkthroughSteps}
        currentStep={currentStep}
        onStepChange={handleStepChange}
      />
    </div>
  );
}
