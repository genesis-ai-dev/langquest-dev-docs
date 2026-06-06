import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "../cn";

// --- Types ---

export interface Contribution {
  id: string;
  type: "text" | "audio";
  content: string;
  timestamp: number;
  audioTimestamp?: number;
  highlightedText?: string;
}

export interface Step {
  id: string;
  name: string;
  description: string;
  done: boolean;
  contributions: Contribution[];
}

interface TranslatorStepsProps {
  steps: Step[];
  onStepsChange: (steps: Step[]) => void;
  readonly?: boolean;
}

// --- Default FIA Steps ---

const DEFAULT_STEP_DESCRIPTIONS: Record<string, string> = {
  "Hear and Heart":
    "Listen carefully to the passage being read aloud. Let the words settle in your mind and heart. Absorb the meaning, tone, and emotion before attempting to translate.",
  "Setting the Stage":
    "Identify the context of the passage: who is speaking, to whom, when, and where. Understand the cultural and historical background that shapes the meaning.",
  "Defining the Scenes":
    "Break the passage into natural scenes or segments. Identify the key events, transitions, and logical divisions in the narrative or argument.",
  "Embodying the Text":
    "Internalize the passage so you can retell it naturally in the target language. Focus on the meaning rather than individual words. Practice expressing it conversationally.",
  "Filling the Gaps":
    "Identify any gaps in understanding: unfamiliar idioms, cultural references, or theological concepts. Research and discuss with the team to resolve ambiguities.",
  "Speaking the Word":
    "Record your translation attempt. Speak naturally and clearly. This is the final oral rendering of the passage in the target language.",
};

export function getDefaultSteps(): Step[] {
  return [
    "Hear and Heart",
    "Setting the Stage",
    "Defining the Scenes",
    "Embodying the Text",
    "Filling the Gaps",
    "Speaking the Word",
  ].map((name, i) => ({
    id: `step-${i}`,
    name,
    description: DEFAULT_STEP_DESCRIPTIONS[name],
    done: false,
    contributions: [],
  }));
}

// --- Fake Audio Player ---

function FakeAudioPlayer({
  onPause,
  progressRef,
}: {
  onPause?: () => void;
  progressRef: React.MutableRefObject<number>;
}) {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    progressRef.current = progress;
  }, [progress, progressRef]);

  useEffect(() => {
    if (playing && progress < 100) {
      intervalRef.current = setInterval(() => {
        setProgress((p) => {
          if (p >= 100) {
            setPlaying(false);
            return 100;
          }
          return p + 1;
        });
      }, 100);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [playing, progress]);

  const togglePlay = () => {
    if (progress >= 100) {
      setProgress(0);
      setPlaying(true);
    } else if (playing) {
      setPlaying(false);
      onPause?.();
    } else {
      setPlaying(true);
    }
  };

  const seconds = Math.floor(progress / 10);

  return (
    <div className="flex items-center gap-2 p-2 rounded-md border border-border bg-bg/80">
      <button
        onClick={togglePlay}
        className="w-7 h-7 flex items-center justify-center rounded-full border border-accent-cyan text-accent-cyan hover:bg-accent-cyan/10 cursor-pointer bg-transparent transition-all shrink-0"
      >
        <span className="text-xs">{playing ? "⏸" : progress >= 100 ? "↺" : "▶"}</span>
      </button>
      <div className="flex-1 h-2 bg-border rounded-full overflow-hidden relative">
        <div
          className="h-full bg-accent-cyan rounded-full transition-all duration-100"
          style={{ width: `${progress}%` }}
        />
      </div>
      <span className="font-mono text-[.6rem] text-txt-dim shrink-0 w-8 text-right">
        {seconds}s
      </span>
    </div>
  );
}

// --- Contribution display helper ---

function ContributionItem({ c }: { c: Contribution }) {
  return (
    <div className="flex items-start gap-2 px-2.5 py-2 rounded border border-border/50 bg-card/50">
      <span className={cn(
        "font-mono text-[.65rem] shrink-0 mt-0.5",
        c.type === "audio" ? "text-accent-red" : "text-accent-purple"
      )}>
        {c.type === "audio" ? "🎙" : "📝"}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          {c.audioTimestamp != null && c.audioTimestamp > 0 && (
            <span className="font-mono text-[.55rem] px-1.5 py-0.5 rounded bg-accent-cyan/10 text-accent-cyan">
              @{c.audioTimestamp}s
            </span>
          )}
          {c.highlightedText && (
            <span className="font-mono text-[.55rem] text-txt-dim italic truncate max-w-[180px]">
              re: "{c.highlightedText}"
            </span>
          )}
        </div>
        <div className="font-mono text-[.65rem] text-txt">{c.content}</div>
      </div>
    </div>
  );
}

// --- Step Content View ---

function StepContent({
  step,
  onToggleDone,
  onAddContribution,
  onUpdateDescription,
}: {
  step: Step;
  onToggleDone: () => void;
  onAddContribution: (contribution: Omit<Contribution, "id" | "timestamp">) => void;
  onUpdateDescription?: (description: string) => void;
}) {
  const [selectedText, setSelectedText] = useState("");
  const [showTextInput, setShowTextInput] = useState(false);
  const [textInput, setTextInput] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [recordProgress, setRecordProgress] = useState(0);
  const [editingDescription, setEditingDescription] = useState(false);
  const [descDraft, setDescDraft] = useState(step.description);
  const recordInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioProgressRef = useRef(0);

  useEffect(() => {
    setDescDraft(step.description);
    setEditingDescription(false);
  }, [step.id, step.description]);

  const getAudioSeconds = () => Math.floor(audioProgressRef.current / 10);

  const handleTextSelect = () => {
    const selection = window.getSelection();
    if (selection && selection.toString().trim()) {
      setSelectedText(selection.toString().trim());
    }
  };

  const handleAddTextContribution = () => {
    if (textInput.trim()) {
      onAddContribution({
        type: "text",
        content: textInput.trim(),
        audioTimestamp: getAudioSeconds() > 0 ? getAudioSeconds() : undefined,
        highlightedText: selectedText || undefined,
      });
      setTextInput("");
      setSelectedText("");
      setShowTextInput(false);
    }
  };

  const handleStartRecording = () => {
    setIsRecording(true);
    setRecordProgress(0);
    recordInterval.current = setInterval(() => {
      setRecordProgress((p) => {
        if (p >= 100) {
          setIsRecording(false);
          if (recordInterval.current) clearInterval(recordInterval.current);
          return 100;
        }
        return p + 2;
      });
    }, 100);
  };

  const handleStopRecording = () => {
    setIsRecording(false);
    if (recordInterval.current) clearInterval(recordInterval.current);
    if (recordProgress > 10) {
      onAddContribution({
        type: "audio",
        content: `Recording (${Math.floor(recordProgress / 20)}s)`,
        audioTimestamp: getAudioSeconds() > 0 ? getAudioSeconds() : undefined,
        highlightedText: selectedText || undefined,
      });
    }
    setRecordProgress(0);
    setSelectedText("");
  };

  const handleSaveDescription = () => {
    onUpdateDescription?.(descDraft.trim() || step.description);
    setEditingDescription(false);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={step.done}
              onChange={onToggleDone}
              className="w-4 h-4 rounded border-border accent-accent-green cursor-pointer"
            />
            <span className={cn(
              "font-mono text-[.7rem]",
              step.done ? "text-accent-green" : "text-txt-dim"
            )}>
              Done
            </span>
          </label>
          <h3 className="font-mono text-sm font-semibold text-txt">{step.name}</h3>
        </div>
        <span className="font-mono text-[.65rem] text-txt-dim">
          {step.contributions.length} contribution{step.contributions.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {/* Audio player */}
        <FakeAudioPlayer onPause={() => setShowTextInput(true)} progressRef={audioProgressRef} />

        {/* Passage text (editable) */}
        {editingDescription ? (
          <div className="space-y-2">
            <textarea
              value={descDraft}
              onChange={(e) => setDescDraft(e.target.value)}
              rows={4}
              className="w-full font-serif text-sm leading-relaxed text-txt p-3 rounded-md border border-accent-purple bg-bg/50 outline-none focus:border-accent-purple resize-y"
            />
            <div className="flex gap-2">
              <button
                onClick={handleSaveDescription}
                className="font-mono text-[.65rem] px-3 py-1.5 rounded-md border border-accent-green text-accent-green hover:bg-accent-green/10 cursor-pointer bg-transparent transition-all"
              >
                Save
              </button>
              <button
                onClick={() => { setDescDraft(step.description); setEditingDescription(false); }}
                className="font-mono text-[.65rem] px-3 py-1.5 rounded-md border border-border text-txt-dim hover:text-txt cursor-pointer bg-transparent transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div
            onMouseUp={handleTextSelect}
            onDoubleClick={onUpdateDescription ? () => setEditingDescription(true) : undefined}
            className="font-serif text-sm leading-relaxed text-txt p-3 rounded-md border border-border bg-bg/50 select-text cursor-text group relative"
          >
            {step.description}
            {onUpdateDescription && (
              <span className="absolute top-1 right-2 font-mono text-[.5rem] text-txt-dim opacity-0 group-hover:opacity-60 transition-opacity">
                double-click to edit
              </span>
            )}
          </div>
        )}

        {/* Selection indicator */}
        {selectedText && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-md border border-accent-purple/30 bg-accent-purple/5">
            <span className="font-mono text-[.6rem] text-accent-purple shrink-0">Selected:</span>
            <span className="font-mono text-[.65rem] text-txt truncate italic">"{selectedText}"</span>
            <button
              onClick={() => setSelectedText("")}
              className="ml-auto font-mono text-[.55rem] text-txt-dim hover:text-txt cursor-pointer bg-transparent border-none"
            >
              ×
            </button>
          </div>
        )}

        {/* Contribution tools */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setShowTextInput(!showTextInput)}
            className="font-mono text-[.65rem] px-3 py-1.5 rounded-md border border-accent-purple/50 text-accent-purple hover:bg-accent-purple/10 cursor-pointer bg-transparent transition-all"
          >
            + Text Note
          </button>
          {!isRecording ? (
            <button
              onClick={handleStartRecording}
              className="font-mono text-[.65rem] px-3 py-1.5 rounded-md border border-accent-red/50 text-accent-red hover:bg-accent-red/10 cursor-pointer bg-transparent transition-all"
            >
              ● Record Audio
            </button>
          ) : (
            <button
              onClick={handleStopRecording}
              className="font-mono text-[.65rem] px-3 py-1.5 rounded-md border border-accent-red bg-accent-red/10 text-accent-red cursor-pointer transition-all animate-pulse"
            >
              ■ Stop ({Math.floor(recordProgress / 20)}s)
            </button>
          )}
          {getAudioSeconds() > 0 && (
            <span className="font-mono text-[.55rem] text-accent-cyan">
              @{getAudioSeconds()}s
            </span>
          )}
        </div>

        {/* Recording progress bar */}
        {isRecording && (
          <div className="h-1.5 bg-border rounded-full overflow-hidden">
            <div
              className="h-full bg-accent-red rounded-full transition-all duration-100"
              style={{ width: `${recordProgress}%` }}
            />
          </div>
        )}

        {/* Text input area */}
        {showTextInput && (
          <div className="flex gap-2">
            <input
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddTextContribution()}
              placeholder={selectedText ? `Note about "${selectedText.slice(0, 30)}..."` : "Add a text note..."}
              className="flex-1 font-mono text-[.7rem] px-3 py-2 rounded-md border border-border bg-bg text-txt placeholder:text-txt-dim outline-none focus:border-accent-purple"
              autoFocus
            />
            <button
              onClick={handleAddTextContribution}
              disabled={!textInput.trim()}
              className="font-mono text-[.65rem] px-3 py-2 rounded-md border border-accent-purple text-accent-purple hover:bg-accent-purple/10 cursor-pointer bg-transparent transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Add
            </button>
          </div>
        )}

        {/* Contributions list */}
        {step.contributions.length > 0 && (
          <div className="space-y-2 pt-2 border-t border-border">
            <div className="font-mono text-[.6rem] text-txt-dim uppercase tracking-wider">
              Contributions
            </div>
            {step.contributions.map((c) => (
              <ContributionItem key={c.id} c={c} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// --- Dashboard View ---

function StepsDashboard({ steps }: { steps: Step[] }) {
  const totalContributions = steps.reduce((sum, s) => sum + s.contributions.length, 0);
  const completedSteps = steps.filter((s) => s.done).length;

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-border">
        <h3 className="font-mono text-sm font-semibold text-txt">Progress Dashboard</h3>
        <div className="flex items-center gap-4 mt-2">
          <div className="font-mono text-[.65rem] text-txt-dim">
            Steps: <span className="text-accent-green font-medium">{completedSteps}/{steps.length}</span>
          </div>
          <div className="font-mono text-[.65rem] text-txt-dim">
            Contributions: <span className="text-accent-purple font-medium">{totalContributions}</span>
          </div>
        </div>
        <div className="mt-2 h-2 bg-border rounded-full overflow-hidden">
          <div
            className="h-full bg-accent-green rounded-full transition-all duration-300"
            style={{ width: `${steps.length > 0 ? (completedSteps / steps.length) * 100 : 0}%` }}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {steps.map((step, i) => (
          <div
            key={step.id}
            className={cn(
              "rounded-lg border p-3 transition-all",
              step.done ? "border-accent-green/30 bg-accent-green/5" : "border-border"
            )}
          >
            <div className="flex items-center gap-2 mb-1.5">
              <span className={cn(
                "w-5 h-5 rounded-full flex items-center justify-center text-[.6rem] font-mono font-bold shrink-0",
                step.done ? "bg-accent-green/20 text-accent-green" : "bg-border text-txt-dim"
              )}>
                {step.done ? "✓" : i + 1}
              </span>
              <span className="font-mono text-[.7rem] text-txt font-medium flex-1">{step.name}</span>
              <span className="font-mono text-[.6rem] text-txt-dim">
                {step.contributions.length} contrib.
              </span>
            </div>

            {step.contributions.length > 0 && (
              <div className="ml-7 space-y-1.5 mt-1.5">
                {step.contributions.map((c) => (
                  <div key={c.id} className="flex items-center gap-1.5 flex-wrap">
                    <span className={cn(
                      "text-[.6rem]",
                      c.type === "audio" ? "text-accent-red" : "text-accent-purple"
                    )}>
                      {c.type === "audio" ? "🎙" : "📝"}
                    </span>
                    {c.audioTimestamp != null && c.audioTimestamp > 0 && (
                      <span className="font-mono text-[.5rem] px-1 rounded bg-accent-cyan/10 text-accent-cyan">
                        @{c.audioTimestamp}s
                      </span>
                    )}
                    <span className="font-mono text-[.6rem] text-txt-muted truncate">{c.content}</span>
                    {c.highlightedText && (
                      <span className="font-mono text-[.5rem] text-txt-dim italic truncate">
                        ← "{c.highlightedText.slice(0, 25)}{c.highlightedText.length > 25 ? "…" : ""}"
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// --- Main Component ---

export function TranslatorSteps({ steps, onStepsChange, readonly = false }: TranslatorStepsProps) {
  const [activeStepId, setActiveStepId] = useState<string | null>(null);
  const [view, setView] = useState<"steps" | "dashboard">("steps");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  const activeStep = steps.find((s) => s.id === activeStepId) ?? null;

  const handleToggleDone = useCallback((stepId: string) => {
    onStepsChange(steps.map((s) => s.id === stepId ? { ...s, done: !s.done } : s));
  }, [steps, onStepsChange]);

  const handleAddContribution = useCallback((stepId: string, contribution: Omit<Contribution, "id" | "timestamp">) => {
    onStepsChange(steps.map((s) => {
      if (s.id !== stepId) return s;
      return {
        ...s,
        contributions: [
          ...s.contributions,
          { ...contribution, id: `c-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, timestamp: Date.now() },
        ],
      };
    }));
  }, [steps, onStepsChange]);

  const handleUpdateDescription = useCallback((stepId: string, description: string) => {
    onStepsChange(steps.map((s) => s.id === stepId ? { ...s, description } : s));
  }, [steps, onStepsChange]);

  const handleAddStep = () => {
    const newStep: Step = {
      id: `step-custom-${Date.now()}`,
      name: `Custom Step ${steps.length + 1}`,
      description: "Describe what the translator should do in this step. This text will appear as the passage content for the step.",
      done: false,
      contributions: [],
    };
    onStepsChange([...steps, newStep]);
    setActiveStepId(newStep.id);
  };

  const handleRemoveStep = (stepId: string) => {
    onStepsChange(steps.filter((s) => s.id !== stepId));
    if (activeStepId === stepId) setActiveStepId(null);
  };

  const handleRenameStep = (stepId: string) => {
    if (!editName.trim()) { setEditingId(null); return; }
    onStepsChange(steps.map((s) => s.id === stepId ? { ...s, name: editName.trim() } : s));
    setEditingId(null);
  };

  const handleRestoreDefaults = () => {
    onStepsChange(getDefaultSteps());
    setActiveStepId(null);
  };

  // Drag and drop handlers
  const handleDragStart = (idx: number) => {
    setDragIdx(idx);
  };

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    setDragOverIdx(idx);
  };

  const handleDrop = (idx: number) => {
    if (dragIdx === null || dragIdx === idx) {
      setDragIdx(null);
      setDragOverIdx(null);
      return;
    }
    const reordered = [...steps];
    const [moved] = reordered.splice(dragIdx, 1);
    reordered.splice(idx, 0, moved);
    onStepsChange(reordered);
    setDragIdx(null);
    setDragOverIdx(null);
  };

  const handleDragEnd = () => {
    setDragIdx(null);
    setDragOverIdx(null);
  };

  const completedCount = steps.filter((s) => s.done).length;

  return (
    <div className="flex-1 flex min-h-0">
      {/* Left: Step List */}
      <div className="w-56 border-r border-border bg-card/50 flex flex-col shrink-0 overflow-hidden">
        {/* View switcher */}
        <div className="flex border-b border-border">
          <button
            onClick={() => setView("steps")}
            className={cn(
              "flex-1 font-mono text-[.65rem] py-2 cursor-pointer bg-transparent border-none transition-all",
              view === "steps" ? "text-accent-purple border-b-2 border-accent-purple" : "text-txt-dim hover:text-txt"
            )}
          >
            Steps
          </button>
          <button
            onClick={() => setView("dashboard")}
            className={cn(
              "flex-1 font-mono text-[.65rem] py-2 cursor-pointer bg-transparent border-none transition-all",
              view === "dashboard" ? "text-accent-purple border-b-2 border-accent-purple" : "text-txt-dim hover:text-txt"
            )}
          >
            Dashboard
          </button>
        </div>

        {/* Progress summary */}
        <div className="px-3 py-2 border-b border-border">
          <div className="flex items-center justify-between mb-1">
            <span className="font-mono text-[.6rem] text-txt-dim">Progress</span>
            <span className="font-mono text-[.65rem] text-accent-green font-medium">
              {completedCount}/{steps.length}
            </span>
          </div>
          <div className="h-1.5 bg-border rounded-full overflow-hidden">
            <div
              className="h-full bg-accent-green rounded-full transition-all duration-300"
              style={{ width: `${steps.length > 0 ? (completedCount / steps.length) * 100 : 0}%` }}
            />
          </div>
        </div>

        {/* Step list */}
        <div className="flex-1 overflow-y-auto py-1">
          {steps.map((step, i) => (
            <div
              key={step.id}
              draggable={!readonly}
              onDragStart={readonly ? undefined : () => handleDragStart(i)}
              onDragOver={readonly ? undefined : (e) => handleDragOver(e, i)}
              onDrop={readonly ? undefined : () => handleDrop(i)}
              onDragEnd={readonly ? undefined : handleDragEnd}
              className={cn(
                "group flex items-center gap-2 px-3 py-2 cursor-pointer transition-all border-l-2",
                activeStepId === step.id
                  ? "border-accent-purple bg-accent-purple/5"
                  : "border-transparent hover:bg-card/80",
                !readonly && dragIdx === i && "opacity-40",
                !readonly && dragOverIdx === i && dragIdx !== i && "border-t-2 border-t-accent-cyan"
              )}
              onClick={() => { setActiveStepId(step.id); setView("steps"); }}
            >
              {!readonly && <span className="text-[.55rem] text-txt-dim cursor-grab opacity-0 group-hover:opacity-60 shrink-0">⠿</span>}
              <span className={cn(
                "w-5 h-5 rounded-full flex items-center justify-center text-[.55rem] font-mono font-bold shrink-0",
                step.done ? "bg-accent-green/20 text-accent-green" : "bg-border text-txt-dim"
              )}>
                {step.done ? "✓" : i + 1}
              </span>
              <div className="flex-1 min-w-0">
                {!readonly && editingId === step.id ? (
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onBlur={() => handleRenameStep(step.id)}
                    onKeyDown={(e) => { if (e.key === "Enter") handleRenameStep(step.id); if (e.key === "Escape") setEditingId(null); }}
                    className="w-full font-mono text-[.65rem] px-1 py-0.5 rounded border border-accent-purple bg-bg text-txt outline-none"
                    autoFocus
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <span
                    className={cn(
                      "font-mono text-[.65rem] truncate block",
                      step.done ? "text-accent-green" : "text-txt"
                    )}
                    onDoubleClick={readonly ? undefined : (e) => { e.stopPropagation(); setEditingId(step.id); setEditName(step.name); }}
                  >
                    {step.name}
                  </span>
                )}
              </div>
              {step.contributions.length > 0 && (
                <span className="font-mono text-[.5rem] text-accent-purple bg-accent-purple/10 px-1 rounded">
                  {step.contributions.length}
                </span>
              )}
              {!readonly && (
                <button
                  onClick={(e) => { e.stopPropagation(); handleRemoveStep(step.id); }}
                  className="font-mono text-[.6rem] text-txt-dim hover:text-accent-red opacity-0 group-hover:opacity-100 cursor-pointer bg-transparent border-none transition-all"
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Bottom actions (only in edit mode) */}
        {!readonly && (
        <div className="px-3 py-2 border-t border-border space-y-1.5">
          <button
            onClick={handleAddStep}
            className="w-full font-mono text-[.65rem] px-3 py-1.5 rounded-md border border-dashed border-border text-txt-dim hover:border-accent-purple hover:text-accent-purple cursor-pointer bg-transparent transition-all"
          >
            + Add Step
          </button>
          <button
            onClick={handleRestoreDefaults}
            className="w-full font-mono text-[.55rem] px-3 py-1 rounded-md text-txt-dim hover:text-accent-amber cursor-pointer bg-transparent border-none transition-all"
          >
            ↺ Restore Defaults
          </button>
        </div>
        )}
      </div>

      {/* Right: Content or Dashboard */}
      <div className="flex-1 flex flex-col min-h-0 min-w-0">
        {view === "dashboard" ? (
          <StepsDashboard steps={steps} />
        ) : activeStep ? (
          <StepContent
            step={activeStep}
            onToggleDone={() => handleToggleDone(activeStep.id)}
            onAddContribution={(c) => handleAddContribution(activeStep.id, c)}
            onUpdateDescription={readonly ? undefined : (desc) => handleUpdateDescription(activeStep.id, desc)}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="font-mono text-lg text-txt-dim mb-2">📖</div>
              <div className="font-mono text-[.7rem] text-txt-dim">
                Select a step to begin
              </div>
              {!readonly && (
                <div className="font-mono text-[.6rem] text-txt-dim mt-1 opacity-70">
                  Double-click step name to rename · Drag to reorder
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
