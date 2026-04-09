import { useCallback, useState } from "react";
import { Header, HeaderButton } from "../components/Header";
import { TabBar } from "../components/TabBar";
import { DiagramShell } from "../components/DiagramShell";
import { StepWalkthrough } from "../components/StepWalkthrough";
import { SECTIONS } from "../data/databaseSchema";

export function DatabaseSchema() {
  const [tabIndex, setTabIndex] = useState(0);
  const [currentStep, setCurrentStep] = useState(0);

  const section = SECTIONS[tabIndex];
  const step = section.steps[currentStep];

  const handleTabChange = useCallback((i: number) => {
    setTabIndex(i);
    setCurrentStep(0);
  }, []);

  const resetLayout = useCallback(() => {
    const key = `lq-schema-react-${section.id}`;
    try {
      localStorage.removeItem(key);
    } catch {}
    // Force re-mount by toggling tab
    setTabIndex((prev) => {
      setTimeout(() => setTabIndex(prev), 0);
      return -1;
    });
  }, [section.id]);

  if (tabIndex < 0) return null;

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <Header
        title="Database Schema"
        subtitle="LangQuest · Postgres / Supabase"
        actions={
          <>
            <HeaderButton onClick={() => (window.location.hash = "#migration")}>
              Migration
            </HeaderButton>
            <HeaderButton onClick={() => (window.location.hash = "#sync")}>
              Sync
            </HeaderButton>
            <HeaderButton onClick={() => (window.location.hash = "#cicd")}>
              CI/CD
            </HeaderButton>
            <HeaderButton onClick={resetLayout}>⟲ Reset</HeaderButton>
          </>
        }
      />

      <TabBar
        items={SECTIONS.map((s) => ({ id: s.id, label: s.label }))}
        activeIndex={tabIndex}
        onChange={handleTabChange}
      />

      <DiagramShell
        storageKey={`lq-schema-react-${section.id}`}
        nodeDefs={section.nodes}
        edgeDefs={section.edges}
        highlightedNodes={step?.highlightNodes}
        diagramTitle={section.diagramTitle}
      />

      <StepWalkthrough
        steps={section.steps}
        currentStep={currentStep}
        onStepChange={setCurrentStep}
        phaseLabel={section.label}
        phaseColor={section.phaseColor}
      />
    </div>
  );
}
