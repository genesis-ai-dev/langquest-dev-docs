import { useCallback, useState } from "react";
import { Header } from "../components/Header";
import { StepWalkthrough } from "../components/StepWalkthrough";
import { AuthDiagram } from "../components/AuthDiagram";
import { STEPS } from "../data/authFlow";

export function AuthFlow() {
  const [currentStep, setCurrentStep] = useState(0);

  const handleStepChange = useCallback((step: number) => {
    setCurrentStep(step);
  }, []);

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <Header
        title="Auth Flow"
        subtitle="LangQuest · Supabase Auth + PowerSync"
        currentHash="#auth"
      />

      <AuthDiagram currentStep={currentStep} />

      <StepWalkthrough
        steps={STEPS}
        currentStep={currentStep}
        onStepChange={handleStepChange}
      />
    </div>
  );
}
