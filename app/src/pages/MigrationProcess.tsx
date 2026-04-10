import { useCallback, useMemo, useState } from "react";
import { Header, HeaderButton } from "../components/Header";
import { StepWalkthrough, type Step } from "../components/StepWalkthrough";
import {
  MigrationDiagram,
  resetMigrationLayout,
} from "../components/MigrationDiagram";
import {
  type VersionVars,
  type MigrationScenario,
  DEFAULT_VERSIONS,
  VERSION_CHAIN,
  SCENARIOS,
} from "../data/migrationFlow";

function VersionSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <label className="flex items-center gap-1.5">
      <span className="font-mono text-[.52rem] text-txt-dim uppercase tracking-[.06em]">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="font-mono text-[.62rem] px-2 py-1 rounded-lg border border-border bg-card text-accent-amber cursor-pointer appearance-none transition-all hover:border-border-hi focus:border-accent-amber focus:outline-none"
      >
        {options.map((o) => (
          <option key={o} value={o}>
            v{o}
          </option>
        ))}
      </select>
    </label>
  );
}

export function MigrationProcess() {
  const [versions, setVersions] = useState<VersionVars>(DEFAULT_VERSIONS);
  const [activeScenarioId, setActiveScenarioId] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(0);

  const activeScenario: MigrationScenario | null = useMemo(
    () => SCENARIOS.find((s) => s.id === activeScenarioId) ?? null,
    [activeScenarioId],
  );

  const resolvedSteps: Step[] = useMemo(() => {
    if (!activeScenario) return [];
    return activeScenario.steps.map((s) => ({
      title: s.title,
      description:
        typeof s.desc === "function" ? s.desc(versions) : s.desc,
    }));
  }, [activeScenario, versions]);

  const handleScenarioClick = useCallback(
    (id: string) => {
      if (activeScenarioId === id) {
        setActiveScenarioId(null);
        setCurrentStep(0);
      } else {
        setActiveScenarioId(id);
        setCurrentStep(0);
      }
    },
    [activeScenarioId],
  );

  const handleStepChange = useCallback((step: number) => {
    setCurrentStep(step);
  }, []);

  const handleReset = useCallback(() => {
    resetMigrationLayout();
    setActiveScenarioId((prev) => {
      const cur = prev;
      setTimeout(() => setActiveScenarioId(cur), 0);
      return null;
    });
  }, []);

  const updateVersion = useCallback(
    (key: keyof VersionVars) => (value: string) => {
      setVersions((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <Header
        title="Migration Process"
        subtitle="LangQuest · Schema Versioning + Backward Compatibility"
        actions={
          <>
            <HeaderButton onClick={() => (window.location.hash = "")}>
              Schema
            </HeaderButton>
            <HeaderButton onClick={() => (window.location.hash = "#sync")}>
              Sync
            </HeaderButton>
            <HeaderButton onClick={() => (window.location.hash = "#cicd")}>
              CI/CD
            </HeaderButton>
            <HeaderButton onClick={() => (window.location.hash = "#auth")}>
              Auth
            </HeaderButton>
            <div className="w-px h-5 bg-border mx-0.5" />
            <VersionSelect
              label="Phone"
              value={versions.phone}
              onChange={updateVersion("phone")}
              options={VERSION_CHAIN}
            />
            <VersionSelect
              label="Target"
              value={versions.target}
              onChange={updateVersion("target")}
              options={VERSION_CHAIN}
            />
            <VersionSelect
              label="Min"
              value={versions.minCompat}
              onChange={updateVersion("minCompat")}
              options={VERSION_CHAIN}
            />
            <div className="w-px h-5 bg-border mx-0.5" />
            {SCENARIOS.map((s) => (
              <HeaderButton
                key={s.id}
                onClick={() => handleScenarioClick(s.id)}
                active={activeScenarioId === s.id}
              >
                {s.buttonLabel}
              </HeaderButton>
            ))}
            <div className="w-px h-5 bg-border mx-0.5" />
            <HeaderButton onClick={handleReset}>⟲ Reset</HeaderButton>
          </>
        }
      />

      <MigrationDiagram
        versionVars={versions}
        scenario={activeScenario}
        currentStep={currentStep}
      />

      {activeScenario && resolvedSteps.length > 0 && (
        <StepWalkthrough
          steps={resolvedSteps}
          currentStep={currentStep}
          onStepChange={handleStepChange}
          phaseLabel={activeScenario.phaseLabel}
          phaseColor={activeScenario.phaseColor}
        />
      )}
    </div>
  );
}
