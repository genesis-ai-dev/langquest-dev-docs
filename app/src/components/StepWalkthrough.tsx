import { useCallback, useEffect, useMemo } from "react";

export interface Step {
  title: string;
  description: string;
  highlightNodes?: string[];
  phase?: string;
  phaseColor?: string;
}

export function StepWalkthrough({
  steps,
  currentStep,
  onStepChange,
  phaseLabel,
  phaseColor,
}: {
  steps: Step[];
  currentStep: number;
  onStepChange: (step: number) => void;
  phaseLabel?: string;
  phaseColor?: string;
}) {
  const step = steps[currentStep];
  const isFirst = currentStep === 0;
  const isLast = currentStep === steps.length - 1;

  const resolvedPhase = step.phase ?? phaseLabel ?? "";
  const resolvedColor = step.phaseColor ?? phaseColor ?? "var(--color-txt)";

  const hasPhaseGroups = steps.some((s) => s.phase);

  const phaseGroups = useMemo(() => {
    if (!hasPhaseGroups) return null;
    const groups: { label: string; indices: number[] }[] = [];
    let prev = "";
    for (let i = 0; i < steps.length; i++) {
      const p = steps[i].phase ?? "";
      if (p !== prev) {
        groups.push({ label: p, indices: [i] });
        prev = p;
      } else {
        groups[groups.length - 1].indices.push(i);
      }
    }
    return groups;
  }, [steps, hasPhaseGroups]);

  const goPrev = useCallback(
    () => !isFirst && onStepChange(currentStep - 1),
    [isFirst, currentStep, onStepChange],
  );
  const goNext = useCallback(
    () => !isLast && onStepChange(currentStep + 1),
    [isLast, currentStep, onStepChange],
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        goNext();
      }
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        goPrev();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [goNext, goPrev]);

  return (
    <div className="border-t border-border bg-panel px-6 py-3 shrink-0 backdrop-blur-[16px] flex flex-col gap-[5px] max-h-[45vh] overflow-y-auto">
      {/* Dot navigation */}
      <div className="flex items-center justify-center gap-1 flex-wrap">
        {phaseGroups
          ? phaseGroups.map((g) => (
              <div key={g.label} className="flex items-center gap-[3px] mx-1.5">
                <span className="font-mono text-[.5rem] text-txt-dim uppercase tracking-[.08em] mr-1">
                  {g.label}
                </span>
                {g.indices.map((idx) => (
                  <DotButton
                    key={idx}
                    active={idx === currentStep}
                    title={steps[idx].title}
                    onClick={() => onStepChange(idx)}
                  />
                ))}
              </div>
            ))
          : steps.map((s, i) => (
              <DotButton
                key={i}
                active={i === currentStep}
                title={s.title}
                onClick={() => onStepChange(i)}
              />
            ))}
      </div>

      <div
        className="font-mono text-[.6rem] font-semibold uppercase tracking-[.1em]"
        style={{ color: resolvedColor }}
      >
        {resolvedPhase}
      </div>
      <div className="text-[.95rem] font-semibold">{step.title}</div>
      <div
        className="text-[.82rem] text-txt-muted leading-relaxed [&_code]:font-mono [&_code]:text-[.72rem] [&_code]:bg-code-bg [&_code]:px-[5px] [&_code]:py-px [&_code]:rounded-[3px] [&_code]:text-accent-pink [&_strong]:text-txt [&_strong]:font-semibold"
        dangerouslySetInnerHTML={{ __html: step.description }}
      />

      {/* Navigation */}
      <div className="flex items-center justify-between mt-0.5">
        <span className="font-mono text-[.6rem] text-txt-dim">
          Step {currentStep + 1} of {steps.length}
        </span>
        <div className="flex gap-2">
          <NavButton onClick={goPrev} disabled={isFirst}>
            ← Back
          </NavButton>
          <NavButton onClick={goNext} disabled={isLast} primary>
            {isLast ? "End of section ✓" : "Next →"}
          </NavButton>
        </div>
      </div>
    </div>
  );
}

function DotButton({
  active,
  title,
  onClick,
}: {
  active: boolean;
  title: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`w-2 h-2 rounded-full border-[1.5px] p-0 cursor-pointer transition-all ${
        active
          ? "bg-accent-pink border-accent-pink shadow-[0_0_6px_#f472b640]"
          : "bg-transparent border-border hover:border-txt-muted"
      }`}
    />
  );
}

function NavButton({
  onClick,
  disabled,
  primary,
  children,
}: {
  onClick: () => void;
  disabled: boolean;
  primary?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`font-mono text-[.68rem] px-4 py-[7px] rounded-lg border cursor-pointer transition-all disabled:opacity-30 disabled:pointer-events-none ${
        primary
          ? "border-accent-pink text-accent-pink hover:bg-accent-pink/3"
          : "border-border bg-card text-txt-muted hover:border-border-hi hover:text-txt"
      }`}
    >
      {children}
    </button>
  );
}
