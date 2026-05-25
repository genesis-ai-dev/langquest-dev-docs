import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import {
  ReactFlow,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  MarkerType,
  Position,
  Handle,
  type NodeProps,
  type NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useTheme } from "../components/ThemeProvider";
import { cn } from "../cn";

// --- Shared types (re-exported from WorkflowBuilder) ---

type SignoffRule = "any_one" | "unanimous" | "quorum";

interface Profile {
  id: string;
  name: string;
  color: string;
}

interface GroupSlot {
  id: string;
  name: string;
  description: string;
  signoff_rule: SignoffRule;
  quorum_threshold?: number;
  assignedProfiles: string[];
}

interface Phase {
  id: string;
  name: string;
  order_index: number;
  signoff_rule: SignoffRule;
  quorum_threshold?: number;
  group_slots: GroupSlot[];
}

interface WorkflowState {
  phases: Phase[];
  profiles: Profile[];
}

// --- Simulation Types ---

interface QuestVersion {
  id: string;
  number: number;
  submittedBy: string;
  submittedAt: number;
}

interface Stamp {
  id: string;
  versionId: string;
  phaseId: string;
  slotId: string;
  profileId: string;
  type: "approve" | "reject";
  withdrawn: boolean;
}

interface SimComment {
  id: string;
  versionId: string;
  phaseId: string;
  slotId: string;
  profileId: string;
  text: string;
}

interface AuditEvent {
  id: string;
  timestamp: number;
  type: "submit" | "approve" | "reject" | "withdraw" | "comment" | "advance" | "return" | "complete";
  profileId?: string;
  phaseId?: string;
  slotId?: string;
  versionId: string;
  detail: string;
}

interface SimulationState {
  versions: QuestVersion[];
  activeVersionId: string | null;
  currentPhaseId: string | null;
  stamps: Stamp[];
  comments: SimComment[];
  events: AuditEvent[];
  status: "idle" | "in_review" | "approved" | "rejected";
  eventCounter: number;
}

// --- Simulation Actions ---

type SimAction =
  | { type: "SUBMIT_VERSION"; profileId: string; phases: Phase[] }
  | { type: "STAMP"; profileId: string; phaseId: string; slotId: string; stampType: "approve" | "reject"; phases: Phase[] }
  | { type: "WITHDRAW"; stampId: string; phases: Phase[] }
  | { type: "COMMENT"; profileId: string; phaseId: string; slotId: string; text: string }
  | { type: "RESET" };

// --- Utilities ---

let simIdCounter = 0;
function simUid() {
  return `sim_${++simIdCounter}_${Date.now().toString(36)}`;
}

const INITIAL_STATE: SimulationState = {
  versions: [],
  activeVersionId: null,
  currentPhaseId: null,
  stamps: [],
  comments: [],
  events: [],
  status: "idle",
  eventCounter: 0,
};

// --- Signoff Enforcement ---

type SlotStatus = "pending" | "approved" | "rejected";

function evaluateSlotStatus(
  slot: GroupSlot,
  stamps: Stamp[],
  versionId: string,
  phaseId: string,
): SlotStatus {
  const slotStamps = stamps.filter(
    (s) => s.versionId === versionId && s.phaseId === phaseId && s.slotId === slot.id && !s.withdrawn
  );
  const approvals = slotStamps.filter((s) => s.type === "approve").length;
  const rejections = slotStamps.filter((s) => s.type === "reject").length;
  const totalMembers = slot.assignedProfiles.length;

  if (totalMembers === 0) return "approved";

  switch (slot.signoff_rule) {
    case "any_one":
      if (rejections >= 1) return "rejected";
      if (approvals >= 1) return "approved";
      return "pending";
    case "unanimous":
      if (rejections >= 1) return "rejected";
      if (approvals >= totalMembers) return "approved";
      return "pending";
    case "quorum": {
      const threshold = slot.quorum_threshold ?? 0.75;
      if (approvals / totalMembers >= threshold) return "approved";
      if (rejections / totalMembers > (1 - threshold)) return "rejected";
      return "pending";
    }
  }
}

function evaluatePhaseStatus(
  phase: Phase,
  stamps: Stamp[],
  versionId: string,
): { status: SlotStatus; slotStatuses: Record<string, SlotStatus> } {
  const slotStatuses: Record<string, SlotStatus> = {};
  for (const slot of phase.group_slots) {
    slotStatuses[slot.id] = evaluateSlotStatus(slot, stamps, versionId, phase.id);
  }

  const slotResults = Object.values(slotStatuses);
  const approvedCount = slotResults.filter((s) => s === "approved").length;
  const rejectedCount = slotResults.filter((s) => s === "rejected").length;
  const totalSlots = slotResults.length;

  if (totalSlots === 0) return { status: "approved", slotStatuses };

  let phaseStatus: SlotStatus = "pending";
  switch (phase.signoff_rule) {
    case "any_one":
      if (rejectedCount >= 1) phaseStatus = "rejected";
      else if (approvedCount >= 1) phaseStatus = "approved";
      break;
    case "unanimous":
      if (rejectedCount >= 1) phaseStatus = "rejected";
      else if (approvedCount >= totalSlots) phaseStatus = "approved";
      break;
    case "quorum": {
      const threshold = phase.quorum_threshold ?? 0.75;
      if (approvedCount / totalSlots >= threshold) phaseStatus = "approved";
      else if (rejectedCount / totalSlots > (1 - threshold)) phaseStatus = "rejected";
      break;
    }
  }

  return { status: phaseStatus, slotStatuses };
}

// --- Reducer ---

function simReducer(state: SimulationState, action: SimAction): SimulationState {
  switch (action.type) {
    case "RESET":
      return { ...INITIAL_STATE };

    case "SUBMIT_VERSION": {
      const versionNumber = state.versions.length + 1;
      const versionId = simUid();
      const firstPhase = action.phases[0];
      if (!firstPhase) return state;

      const newVersion: QuestVersion = {
        id: versionId,
        number: versionNumber,
        submittedBy: action.profileId,
        submittedAt: state.eventCounter + 1,
      };

      const event: AuditEvent = {
        id: simUid(),
        timestamp: state.eventCounter + 1,
        type: "submit",
        profileId: action.profileId,
        phaseId: firstPhase.id,
        versionId,
        detail: `Version ${versionNumber} submitted → enters "${firstPhase.name}"`,
      };

      return {
        ...state,
        versions: [...state.versions, newVersion],
        activeVersionId: versionId,
        currentPhaseId: firstPhase.id,
        status: "in_review",
        events: [...state.events, event],
        eventCounter: state.eventCounter + 1,
      };
    }

    case "STAMP": {
      const { profileId, phaseId, slotId, stampType, phases } = action;
      if (!state.activeVersionId || state.currentPhaseId !== phaseId) return state;

      const existingStamp = state.stamps.find(
        (s) => s.versionId === state.activeVersionId && s.phaseId === phaseId &&
               s.slotId === slotId && s.profileId === profileId && !s.withdrawn
      );
      if (existingStamp) return state;

      const newStamp: Stamp = {
        id: simUid(),
        versionId: state.activeVersionId,
        phaseId,
        slotId,
        profileId,
        type: stampType,
        withdrawn: false,
      };

      const updatedStamps = [...state.stamps, newStamp];

      const stampEvent: AuditEvent = {
        id: simUid(),
        timestamp: state.eventCounter + 1,
        type: stampType,
        profileId,
        phaseId,
        slotId,
        versionId: state.activeVersionId,
        detail: `${stampType === "approve" ? "Approved" : "Rejected"}`,
      };

      let newEvents = [...state.events, stampEvent];
      let newStatus = state.status;
      let newPhaseId: string | null = state.currentPhaseId;
      let counter = state.eventCounter + 1;

      const currentPhase = phases.find((p) => p.id === phaseId);
      if (currentPhase) {
        const { status: phaseResult } = evaluatePhaseStatus(currentPhase, updatedStamps, state.activeVersionId);

        if (phaseResult === "approved") {
          const currentIdx = phases.findIndex((p) => p.id === phaseId);
          const nextPhase = phases[currentIdx + 1];

          if (nextPhase) {
            counter++;
            newPhaseId = nextPhase.id;
            newEvents = [...newEvents, {
              id: simUid(),
              timestamp: counter,
              type: "advance",
              phaseId: nextPhase.id,
              versionId: state.activeVersionId,
              detail: `Phase "${currentPhase.name}" passed → advancing to "${nextPhase.name}"`,
            }];
          } else {
            counter++;
            newPhaseId = null;
            newStatus = "approved";
            newEvents = [...newEvents, {
              id: simUid(),
              timestamp: counter,
              type: "complete",
              versionId: state.activeVersionId,
              detail: `All phases passed — version approved!`,
            }];
          }
        } else if (phaseResult === "rejected") {
          counter++;
          newPhaseId = null;
          newStatus = "rejected";
          newEvents = [...newEvents, {
            id: simUid(),
            timestamp: counter,
            type: "return",
            phaseId,
            versionId: state.activeVersionId,
            detail: `Phase "${currentPhase.name}" rejected → returned to translator`,
          }];
        }
      }

      return {
        ...state,
        stamps: updatedStamps,
        events: newEvents,
        status: newStatus,
        currentPhaseId: newPhaseId,
        eventCounter: counter,
      };
    }

    case "WITHDRAW": {
      const { stampId, phases } = action;
      const stamp = state.stamps.find((s) => s.id === stampId);
      if (!stamp || stamp.withdrawn) return state;

      const updatedStamps = state.stamps.map((s) =>
        s.id === stampId ? { ...s, withdrawn: true } : s
      );

      const counter = state.eventCounter + 1;
      const withdrawEvent: AuditEvent = {
        id: simUid(),
        timestamp: counter,
        type: "withdraw",
        profileId: stamp.profileId,
        phaseId: stamp.phaseId,
        slotId: stamp.slotId,
        versionId: stamp.versionId,
        detail: `Withdrew ${stamp.type} stamp`,
      };

      let newStatus = state.status;
      let newPhaseId = state.currentPhaseId;

      if (state.status === "in_review" && state.currentPhaseId) {
        const currentPhase = phases.find((p) => p.id === state.currentPhaseId);
        if (currentPhase) {
          evaluatePhaseStatus(currentPhase, updatedStamps, stamp.versionId);
        }
      }

      return {
        ...state,
        stamps: updatedStamps,
        events: [...state.events, withdrawEvent],
        status: newStatus,
        currentPhaseId: newPhaseId,
        eventCounter: counter,
      };
    }

    case "COMMENT": {
      const { profileId, phaseId, slotId, text } = action;
      if (!state.activeVersionId) return state;

      const comment: SimComment = {
        id: simUid(),
        versionId: state.activeVersionId,
        phaseId,
        slotId,
        profileId,
        text,
      };

      const event: AuditEvent = {
        id: simUid(),
        timestamp: state.eventCounter + 1,
        type: "comment",
        profileId,
        phaseId,
        slotId,
        versionId: state.activeVersionId,
        detail: text,
      };

      return {
        ...state,
        comments: [...state.comments, comment],
        events: [...state.events, event],
        eventCounter: state.eventCounter + 1,
      };
    }
  }
}

// --- Simulation Phase Node ---

interface SimPhaseNodeData {
  phase: Phase;
  profiles: Profile[];
  stamps: Stamp[];
  activeVersionId: string | null;
  currentPhaseId: string | null;
  overallStatus: "idle" | "in_review" | "approved" | "rejected";
  passedPhaseIds: string[];
  [key: string]: unknown;
}

type SimPhaseNodeType = Node<SimPhaseNodeData>;

function SimPhaseNode({ data }: NodeProps<SimPhaseNodeType>) {
  const { phase, profiles, stamps, activeVersionId, currentPhaseId, overallStatus, passedPhaseIds } = data;

  const isActive = currentPhaseId === phase.id;
  const isPassed = passedPhaseIds.includes(phase.id);
  const isRejectedHere = overallStatus === "rejected" && !isPassed && !isActive && currentPhaseId === null;

  let ringColor = "border-border";
  if (isActive) ringColor = "border-blue-400 shadow-[0_0_12px_rgba(96,165,250,.4)]";
  else if (isPassed) ringColor = "border-accent-green";
  else if (isRejectedHere) ringColor = "border-accent-red";

  return (
    <div className={cn("relative border-2 rounded-xl bg-card min-w-[240px] max-w-[300px] shadow-[0_4px_24px_rgba(0,0,0,.3)] transition-all duration-300", ringColor)}>
      <Handle type="target" position={Position.Left} className="!opacity-0 !w-2 !h-2" />
      <Handle type="source" position={Position.Right} className="!opacity-0 !w-2 !h-2" />

      <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
        <div className={cn(
          "w-2.5 h-2.5 rounded-full shrink-0 transition-all",
          isActive ? "bg-blue-400 animate-pulse" : isPassed ? "bg-accent-green" : "bg-border"
        )} />
        <div className="flex-1">
          <div className="font-mono text-[.7rem] font-semibold text-txt">{phase.name}</div>
          <div className="font-mono text-[.45rem] text-txt-dim">Phase {phase.order_index + 1} · {phase.signoff_rule}</div>
        </div>
        {isPassed && <span className="text-accent-green text-[.7rem]">✓</span>}
        {isRejectedHere && <span className="text-accent-red text-[.7rem]">✗</span>}
      </div>

      <div className="px-3 py-2 space-y-1.5">
        {phase.group_slots.map((slot) => {
          const slotStatus = activeVersionId
            ? evaluateSlotStatus(slot, stamps, activeVersionId, phase.id)
            : "pending";

          return (
            <div key={slot.id} className="border border-border rounded-md px-2 py-1.5">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[.5rem] text-txt-muted font-medium">{slot.name}</span>
                <span className={cn(
                  "font-mono text-[.4rem] px-1.5 py-0.5 rounded",
                  slotStatus === "approved" ? "bg-accent-green/10 text-accent-green" :
                  slotStatus === "rejected" ? "bg-accent-red/10 text-accent-red" :
                  "bg-border/50 text-txt-dim"
                )}>
                  {slotStatus}
                </span>
              </div>
              <div className="flex flex-wrap gap-1 mt-1">
                {slot.assignedProfiles.map((pId) => {
                  const profile = profiles.find((p) => p.id === pId);
                  if (!profile) return null;
                  const stamp = stamps.find(
                    (s) => s.versionId === activeVersionId && s.phaseId === phase.id &&
                           s.slotId === slot.id && s.profileId === pId && !s.withdrawn
                  );
                  return (
                    <span
                      key={pId}
                      className="inline-flex items-center gap-0.5 font-mono text-[.45rem] px-1 py-0.5 rounded border border-border"
                    >
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: profile.color }} />
                      <span className="text-txt-dim">{profile.name.split(" ")[0]}</span>
                      {stamp?.type === "approve" && <span className="text-accent-green ml-0.5">✓</span>}
                      {stamp?.type === "reject" && <span className="text-accent-red ml-0.5">✗</span>}
                    </span>
                  );
                })}
              </div>
            </div>
          );
        })}
        {phase.group_slots.length === 0 && (
          <div className="font-mono text-[.45rem] text-txt-dim italic">No slots</div>
        )}
      </div>
    </div>
  );
}

const simNodeTypes: NodeTypes = { simPhase: SimPhaseNode };

// --- Audit Event Colors ---

const EVENT_COLORS: Record<AuditEvent["type"], string> = {
  submit: "text-blue-400",
  approve: "text-accent-green",
  reject: "text-accent-red",
  withdraw: "text-accent-amber",
  comment: "text-accent-purple",
  advance: "text-accent-cyan",
  return: "text-accent-red",
  complete: "text-accent-green",
};

const EVENT_ICONS: Record<AuditEvent["type"], string> = {
  submit: "→",
  approve: "✓",
  reject: "✗",
  withdraw: "↩",
  comment: "💬",
  advance: "▶",
  return: "◀",
  complete: "★",
};

// --- Main Component ---

export function WorkflowSimulation({ state: workflowState }: { state: WorkflowState }) {
  const { theme } = useTheme();
  const [sim, dispatch] = useReducer(simReducer, INITIAL_STATE);
  const [selectedTranslator, setSelectedTranslator] = useState<string>("");
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});
  const [selectedPhaseId, setSelectedPhaseId] = useState<string | null>(null);
  const logRef = useRef<HTMLDivElement>(null);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  // Build flow graph
  useEffect(() => {
    const passed: string[] = [];
    if (sim.activeVersionId && sim.currentPhaseId) {
      const currentIdx = workflowState.phases.findIndex((p) => p.id === sim.currentPhaseId);
      for (let i = 0; i < currentIdx; i++) {
        passed.push(workflowState.phases[i].id);
      }
    } else if (sim.status === "approved") {
      workflowState.phases.forEach((p) => passed.push(p.id));
    }

    const builtNodes: Node[] = workflowState.phases.map((phase, i) => ({
      id: phase.id,
      type: "simPhase",
      position: { x: i * 360, y: 60 },
      data: {
        phase,
        profiles: workflowState.profiles,
        stamps: sim.stamps,
        activeVersionId: sim.activeVersionId,
        currentPhaseId: sim.currentPhaseId,
        overallStatus: sim.status,
        passedPhaseIds: passed,
      } as SimPhaseNodeData,
      draggable: true,
    }));

    const builtEdges: Edge[] = [];
    for (let i = 0; i < workflowState.phases.length - 1; i++) {
      const isPassed = passed.includes(workflowState.phases[i].id);
      builtEdges.push({
        id: `se-${workflowState.phases[i].id}-${workflowState.phases[i + 1].id}`,
        source: workflowState.phases[i].id,
        target: workflowState.phases[i + 1].id,
        type: "smoothstep",
        animated: true,
        style: {
          stroke: isPassed ? "var(--color-accent-green)" : "var(--color-accent-purple)",
          strokeWidth: 2,
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: isPassed ? "var(--color-accent-green)" : "var(--color-accent-purple)",
          width: 16,
          height: 16,
        },
      });
    }

    setNodes((curr) =>
      builtNodes.map((n) => {
        const existing = curr.find((en) => en.id === n.id);
        return existing ? { ...n, position: existing.position } : n;
      })
    );
    setEdges(builtEdges);
  }, [workflowState, sim, setNodes, setEdges]);

  // Auto-scroll audit log
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [sim.events.length]);

  // Phase to display in reviewer panel (defaults to current, user can select passed phases)
  const displayPhaseId = selectedPhaseId ?? sim.currentPhaseId;
  const displayPhase = workflowState.phases.find((p) => p.id === displayPhaseId) ?? null;

  // Reset selected phase when sim advances
  useEffect(() => {
    setSelectedPhaseId(null);
  }, [sim.currentPhaseId]);

  const handleSubmit = useCallback(() => {
    if (!selectedTranslator) return;
    dispatch({ type: "SUBMIT_VERSION", profileId: selectedTranslator, phases: workflowState.phases });
  }, [selectedTranslator, workflowState.phases]);

  const handleStamp = useCallback((profileId: string, phaseId: string, slotId: string, stampType: "approve" | "reject") => {
    dispatch({ type: "STAMP", profileId, phaseId, slotId, stampType, phases: workflowState.phases });
  }, [workflowState.phases]);

  const handleWithdraw = useCallback((stampId: string) => {
    dispatch({ type: "WITHDRAW", stampId, phases: workflowState.phases });
  }, [workflowState.phases]);

  const handleComment = useCallback((profileId: string, phaseId: string, slotId: string) => {
    const key = `${profileId}-${slotId}`;
    const text = commentInputs[key]?.trim();
    if (!text) return;
    dispatch({ type: "COMMENT", profileId, phaseId, slotId, text });
    setCommentInputs((prev) => ({ ...prev, [key]: "" }));
  }, [commentInputs]);

  const canSubmit = sim.status === "idle" || sim.status === "rejected";
  const getProfileById = (id: string) => workflowState.profiles.find((p) => p.id === id);

  return (
    <div className="flex-1 flex min-h-0">
      {/* Left Panel: Translator Controls */}
      <div className="w-60 border-r border-border bg-card/50 flex flex-col shrink-0 overflow-hidden">
        <div className="px-3 py-3 border-b border-border">
          <div className="font-mono text-[.7rem] text-txt-dim uppercase tracking-wider mb-2">
            Translator
          </div>
          <select
            value={selectedTranslator}
            onChange={(e) => setSelectedTranslator(e.target.value)}
            className="w-full font-mono text-[.7rem] px-2 py-2 rounded-md border border-border bg-bg text-txt outline-none focus:border-accent-purple mb-2"
          >
            <option value="">Select translator...</option>
            {workflowState.profiles.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit || !selectedTranslator}
            className={cn(
              "w-full font-mono text-[.7rem] px-3 py-2 rounded-md border cursor-pointer transition-all",
              canSubmit && selectedTranslator
                ? "border-accent-cyan text-accent-cyan hover:bg-accent-cyan/10"
                : "border-border text-txt-dim opacity-50 cursor-not-allowed"
            )}
          >
            Submit {sim.versions.length > 0 ? `v${sim.versions.length + 1}` : "v1"}
          </button>
          {sim.status === "in_review" && (
            <div className="font-mono text-[.6rem] text-txt-dim mt-2 italic">
              A version is currently in review.
            </div>
          )}
        </div>

        {/* Version History */}
        <div className="flex-1 overflow-y-auto px-3 py-2">
          <div className="font-mono text-[.65rem] text-txt-dim uppercase tracking-wider mb-2">
            Versions
          </div>
          {sim.versions.length === 0 && (
            <div className="font-mono text-[.6rem] text-txt-dim italic">
              No versions submitted yet
            </div>
          )}
          {sim.versions.map((v) => {
            const translator = getProfileById(v.submittedBy);
            const isActive = v.id === sim.activeVersionId;
            let vStatus: "active" | "approved" | "rejected" | "superseded" = "superseded";
            if (isActive && sim.status === "in_review") vStatus = "active";
            else if (isActive && sim.status === "approved") vStatus = "approved";
            else if (isActive && sim.status === "rejected") vStatus = "rejected";

            return (
              <div
                key={v.id}
                className={cn(
                  "flex items-center gap-2 px-2 py-1.5 rounded-md border mb-1.5 transition-all",
                  vStatus === "active" ? "border-blue-400/50 bg-blue-400/5" :
                  vStatus === "approved" ? "border-accent-green/50 bg-accent-green/5" :
                  vStatus === "rejected" ? "border-accent-red/50 bg-accent-red/5" :
                  "border-border"
                )}
              >
                <span className="font-mono text-[.7rem] font-semibold text-txt">v{v.number}</span>
                {translator && (
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full" style={{ background: translator.color }} />
                    <span className="font-mono text-[.6rem] text-txt-dim">{translator.name}</span>
                  </span>
                )}
                <span className={cn(
                  "ml-auto font-mono text-[.55rem] px-1.5 py-0.5 rounded",
                  vStatus === "active" ? "text-blue-400" :
                  vStatus === "approved" ? "text-accent-green" :
                  vStatus === "rejected" ? "text-accent-red" :
                  "text-txt-dim"
                )}>
                  {vStatus}
                </span>
              </div>
            );
          })}
        </div>

        {/* Status + Reset */}
        <div className="px-3 py-3 border-t border-border">
          <div className={cn(
            "font-mono text-[.55rem] font-semibold mb-2",
            sim.status === "approved" ? "text-accent-green" :
            sim.status === "rejected" ? "text-accent-red" :
            sim.status === "in_review" ? "text-blue-400" :
            "text-txt-dim"
          )}>
            Status: {sim.status === "in_review" ? "In Review" : sim.status.charAt(0).toUpperCase() + sim.status.slice(1)}
          </div>
          <button
            onClick={() => dispatch({ type: "RESET" })}
            className="w-full font-mono text-[.55rem] px-3 py-1.5 rounded-md border border-border text-txt-dim hover:text-accent-red hover:border-accent-red/50 cursor-pointer bg-transparent transition-all"
          >
            ⟲ Reset Simulation
          </button>
        </div>
      </div>

      {/* Center: Phase Diagram */}
      <div className="flex-1 min-h-0 relative">
        {workflowState.phases.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
            <div className="text-center">
              <div className="font-mono text-[.7rem] text-txt-dim">No phases defined</div>
              <div className="font-mono text-[.5rem] text-txt-dim/60 mt-1">
                Switch to Design tab to create phases
              </div>
            </div>
          </div>
        )}
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={simNodeTypes}
          colorMode={theme}
          fitView
          fitViewOptions={{ padding: 0.3 }}
          proOptions={{ hideAttribution: true }}
          minZoom={0.3}
          maxZoom={1.5}
          panOnScroll
          nodesDraggable
        />
      </div>

      {/* Right Panel: Reviewer Actions + Audit Log */}
      <div className="w-80 border-l border-border bg-card/50 flex flex-col shrink-0 overflow-hidden">
        {/* Phase Selector */}
        <div className="px-3 py-2 border-b border-border">
          <div className="font-mono text-[.65rem] text-txt-dim uppercase tracking-wider mb-2">
            Review Phase
          </div>
          <div className="flex flex-wrap gap-1">
            {workflowState.phases.map((phase) => {
              const isCurrentPhase = phase.id === sim.currentPhaseId;
              const isPassed = sim.activeVersionId && sim.currentPhaseId
                ? workflowState.phases.findIndex((p) => p.id === phase.id) < workflowState.phases.findIndex((p) => p.id === sim.currentPhaseId)
                : sim.status === "approved";
              const isSelected = phase.id === displayPhaseId;

              return (
                <button
                  key={phase.id}
                  onClick={() => setSelectedPhaseId(phase.id === sim.currentPhaseId ? null : phase.id)}
                  disabled={!isCurrentPhase && !isPassed}
                  className={cn(
                    "font-mono text-[.6rem] px-2 py-1 rounded-md border cursor-pointer transition-all",
                    isSelected
                      ? "border-accent-purple bg-accent-purple/10 text-accent-purple"
                      : isCurrentPhase
                      ? "border-blue-400/50 text-blue-400 hover:bg-blue-400/10"
                      : isPassed
                      ? "border-accent-green/50 text-accent-green hover:bg-accent-green/10"
                      : "border-border text-txt-dim opacity-40 cursor-not-allowed"
                  )}
                >
                  {phase.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* Reviewer Actions */}
        <div className="flex-1 overflow-y-auto border-b border-border">
          {!displayPhase && sim.status !== "in_review" && (
            <div className="px-3 py-6 text-center">
              <div className="font-mono text-[.65rem] text-txt-dim italic">
                {sim.status === "idle" && "Submit a version to begin review"}
                {sim.status === "approved" && "All phases complete! Select a phase to review stamps."}
                {sim.status === "rejected" && "Returned to translator. Submit a new version."}
              </div>
            </div>
          )}

          {displayPhase && displayPhase.group_slots.map((slot) => (
            <div key={slot.id} className="px-3 py-2.5 border-b border-border/50">
              <div className="font-mono text-[.65rem] text-txt-muted font-medium mb-2">
                {slot.name}
                <span className="text-txt-dim font-normal ml-1.5">({slot.signoff_rule})</span>
              </div>
              {slot.assignedProfiles.map((pId) => {
                const profile = getProfileById(pId);
                if (!profile) return null;
                const existingStamp = sim.stamps.find(
                  (s) => s.versionId === sim.activeVersionId && s.phaseId === displayPhase.id &&
                         s.slotId === slot.id && s.profileId === pId && !s.withdrawn
                );
                const commentKey = `${pId}-${slot.id}`;

                return (
                  <div key={pId} className="mb-2.5 last:mb-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ background: profile.color }} />
                      <span className="font-mono text-[.7rem] text-txt flex-1">{profile.name}</span>
                      {existingStamp ? (
                        <button
                          onClick={() => handleWithdraw(existingStamp.id)}
                          className="font-mono text-[.6rem] px-2 py-1 rounded border border-accent-amber/50 text-accent-amber hover:bg-accent-amber/10 cursor-pointer bg-transparent transition-all"
                        >
                          Withdraw {existingStamp.type === "approve" ? "✓" : "✗"}
                        </button>
                      ) : (
                        <>
                          <button
                            onClick={() => handleStamp(pId, displayPhase.id, slot.id, "approve")}
                            className="font-mono text-[.6rem] px-2 py-1 rounded border border-accent-green/50 text-accent-green hover:bg-accent-green/10 cursor-pointer bg-transparent transition-all"
                          >
                            ✓ Approve
                          </button>
                          <button
                            onClick={() => handleStamp(pId, displayPhase.id, slot.id, "reject")}
                            className="font-mono text-[.6rem] px-2 py-1 rounded border border-accent-red/50 text-accent-red hover:bg-accent-red/10 cursor-pointer bg-transparent transition-all"
                          >
                            ✗ Reject
                          </button>
                        </>
                      )}
                    </div>
                    {/* Comment input */}
                    <div className="flex gap-1.5 ml-4">
                      <input
                        value={commentInputs[commentKey] ?? ""}
                        onChange={(e) => setCommentInputs((prev) => ({ ...prev, [commentKey]: e.target.value }))}
                        onKeyDown={(e) => e.key === "Enter" && handleComment(pId, displayPhase.id, slot.id)}
                        placeholder="Leave a comment..."
                        className="flex-1 font-mono text-[.6rem] px-2 py-1 rounded border border-border bg-bg text-txt placeholder:text-txt-dim outline-none focus:border-accent-purple"
                      />
                      <button
                        onClick={() => handleComment(pId, displayPhase.id, slot.id)}
                        className="font-mono text-[.55rem] px-2 py-1 text-accent-purple hover:text-accent-purple/80 cursor-pointer bg-transparent border border-accent-purple/30 rounded transition-all"
                      >
                        Send
                      </button>
                    </div>
                  </div>
                );
              })}
              {slot.assignedProfiles.length === 0 && (
                <div className="font-mono text-[.6rem] text-txt-dim italic">No members assigned</div>
              )}
            </div>
          ))}
        </div>

        {/* Audit Log */}
        <div className="h-72 flex flex-col shrink-0">
          <div className="px-3 py-2 border-b border-border bg-card/80">
            <div className="font-mono text-[.65rem] text-txt-dim uppercase tracking-wider">
              Audit Log ({sim.events.length})
            </div>
          </div>
          <div ref={logRef} className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5">
            {sim.events.length === 0 && (
              <div className="font-mono text-[.6rem] text-txt-dim italic py-4 text-center">
                No events yet
              </div>
            )}
            {sim.events.map((event) => {
              const profile = event.profileId ? getProfileById(event.profileId) : null;
              const phase = event.phaseId ? workflowState.phases.find((p) => p.id === event.phaseId) : null;

              return (
                <div key={event.id} className="flex gap-2 items-start">
                  <span className={cn("font-mono text-[.65rem] shrink-0 w-4 text-center", EVENT_COLORS[event.type])}>
                    {EVENT_ICONS[event.type]}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      {profile && (
                        <span className="inline-flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full" style={{ background: profile.color }} />
                          <span className="font-mono text-[.6rem] text-txt-muted">{profile.name}</span>
                        </span>
                      )}
                      {phase && (
                        <span className="font-mono text-[.55rem] text-txt-dim">in {phase.name}</span>
                      )}
                    </div>
                    <div className={cn(
                      "font-mono text-[.6rem] leading-relaxed",
                      event.type === "comment" ? "text-txt-muted italic pl-1 border-l-2 border-accent-purple/30 mt-0.5" : EVENT_COLORS[event.type]
                    )}>
                      {event.type === "comment" ? `"${event.detail}"` : event.detail}
                    </div>
                  </div>
                  <span className="font-mono text-[.5rem] text-txt-dim shrink-0">
                    #{event.timestamp}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
