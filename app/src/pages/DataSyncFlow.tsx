import { useCallback, useMemo, useState } from "react";
import { Header, HeaderButton } from "../components/Header";
import { StepWalkthrough, type Step } from "../components/StepWalkthrough";
import { DataSyncDiagram } from "../components/DataSyncDiagram";
import { SCENARIOS, type SyncScenario } from "../data/dataSyncFlow";

export function DataSyncFlow() {
  const [activeScenario, setActiveScenario] = useState<SyncScenario | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [isOnline, setIsOnline] = useState(true);

  const handleScenarioClick = useCallback(
    (scenario: SyncScenario) => {
      if (activeScenario?.id === scenario.id) {
        setActiveScenario(null);
        setCurrentStep(0);
      } else {
        setActiveScenario(scenario);
        setCurrentStep(0);
      }
    },
    [activeScenario],
  );

  const handleStepChange = useCallback((step: number) => {
    setCurrentStep(step);
  }, []);

  const toggleOnline = useCallback(() => {
    setIsOnline((prev) => !prev);
  }, []);

  const currentSyncStep = activeScenario ? activeScenario.steps[currentStep] : null;

  const walkthroughSteps: Step[] = useMemo(() => {
    if (!activeScenario) return [];
    return activeScenario.steps.map((s) => ({
      title: s.title,
      description: s.description,
    }));
  }, [activeScenario]);

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <Header
        title="Data Sync Flow"
        subtitle="LangQuest · Supabase + PowerSync"
        actions={
          <>
            <HeaderButton onClick={() => (window.location.hash = "")}>
              Schema
            </HeaderButton>
            <HeaderButton onClick={() => (window.location.hash = "#migration")}>
              Migration
            </HeaderButton>
            <HeaderButton onClick={() => (window.location.hash = "#cicd")}>
              CI/CD
            </HeaderButton>
            <HeaderButton onClick={() => (window.location.hash = "#auth")}>
              Auth
            </HeaderButton>
            <div className="w-px h-5 bg-border mx-0.5" />
            {SCENARIOS.map((sc) => (
              <HeaderButton
                key={sc.id}
                onClick={() => handleScenarioClick(sc)}
                active={activeScenario?.id === sc.id}
              >
                {sc.icon} {sc.name.split(" ")[0]}
              </HeaderButton>
            ))}
            <div className="w-px h-5 bg-border mx-0.5" />
            <button
              type="button"
              onClick={toggleOnline}
              className="flex items-center gap-[7px] px-3 py-1.5 rounded-lg border border-border bg-card cursor-pointer transition-all hover:border-border-hi select-none"
            >
              <span
                className="w-[7px] h-[7px] rounded-full transition-all"
                style={{
                  background: isOnline ? "var(--color-accent-green)" : "var(--color-accent-red)",
                  boxShadow: isOnline
                    ? "0 0 6px var(--color-accent-green)"
                    : "0 0 6px var(--color-accent-red)",
                }}
              />
              <span className="font-mono text-[.6rem] text-txt-muted min-w-[38px]">
                {isOnline ? "Online" : "Offline"}
              </span>
            </button>
          </>
        }
      />

      <DataSyncDiagram step={currentSyncStep} isOnline={isOnline} />

      {activeScenario && (
        <StepWalkthrough
          steps={walkthroughSteps}
          currentStep={currentStep}
          onStepChange={handleStepChange}
          phaseLabel={activeScenario.name}
          phaseColor="var(--color-accent-pink)"
        />
      )}
    </div>
  );
}
