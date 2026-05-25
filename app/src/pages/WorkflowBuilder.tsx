import { useCallback, useEffect, useState } from "react";
import { Header, HeaderButton } from "../components/Header";
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

// --- Types ---

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

// --- Utilities ---

const PROFILE_COLORS = [
  "#22d3ee",
  "#a78bfa",
  "#34d399",
  "#f472b6",
  "#fbbf24",
  "#f87171",
  "#60a5fa",
  "#fb923c",
];

let idCounter = 0;
function uid() {
  return `id_${++idCounter}_${Date.now().toString(36)}`;
}

const SIGNOFF_LABELS: Record<SignoffRule, string> = {
  any_one: "Any One",
  unanimous: "Unanimous",
  quorum: "Quorum",
};

const SIGNOFF_DESCRIPTIONS: Record<SignoffRule, string> = {
  any_one: "First approval passes",
  unanimous: "All must approve",
  quorum: "Threshold fraction must approve",
};

// --- Signoff Rule Selector (shared between phase and slot) ---

function SignoffRuleSelector({
  value,
  quorumThreshold,
  onChange,
  label,
  compact,
}: {
  value: SignoffRule;
  quorumThreshold?: number;
  onChange: (rule: SignoffRule, threshold?: number) => void;
  label: string;
  compact?: boolean;
}) {
  return (
    <div>
      <div className="font-mono text-[.5rem] text-txt-dim uppercase tracking-wider mb-1">
        {label}
      </div>
      <div className="flex gap-1">
        {(["any_one", "unanimous", "quorum"] as SignoffRule[]).map((rule) => (
          <button
            key={rule}
            onClick={() => onChange(rule, rule === "quorum" ? (quorumThreshold ?? 0.75) : undefined)}
            className={cn(
              "font-mono px-2 py-1 rounded-md border cursor-pointer transition-all",
              compact ? "text-[.5rem]" : "text-[.55rem]",
              value === rule
                ? "border-accent-green bg-accent-green/10 text-accent-green"
                : "border-border text-txt-dim hover:border-border-hi hover:text-txt-muted"
            )}
          >
            {SIGNOFF_LABELS[rule]}
          </button>
        ))}
      </div>
      {value === "quorum" && (
        <div className="mt-1.5 flex items-center gap-2">
          <span className="font-mono text-[.5rem] text-txt-dim">Threshold:</span>
          <input
            type="range"
            min={0.5}
            max={1}
            step={0.05}
            value={quorumThreshold ?? 0.75}
            onChange={(e) => onChange("quorum", parseFloat(e.target.value))}
            className="flex-1 h-1 accent-accent-green"
          />
          <span className="font-mono text-[.55rem] text-accent-green w-8 text-right">
            {Math.round((quorumThreshold ?? 0.75) * 100)}%
          </span>
        </div>
      )}
    </div>
  );
}

// --- Phase Node Component ---

interface PhaseNodeData {
  phase: Phase;
  profiles: Profile[];
  onUpdate: (phase: Phase) => void;
  onDelete: (id: string) => void;
  onAddSlot: (phaseId: string) => void;
  onDeleteSlot: (phaseId: string, slotId: string) => void;
  onUpdateSlot: (phaseId: string, slot: GroupSlot) => void;
  onAssignProfile: (phaseId: string, slotId: string, profileId: string) => void;
  onRemoveProfile: (phaseId: string, slotId: string, profileId: string) => void;
  [key: string]: unknown;
}

type PhaseNodeType = Node<PhaseNodeData>;

function PhaseNode({ data }: NodeProps<PhaseNodeType>) {
  const { phase, profiles, onUpdate, onDelete, onAddSlot, onDeleteSlot, onUpdateSlot, onAssignProfile, onRemoveProfile } = data;
  const [editing, setEditing] = useState(false);
  const [localName, setLocalName] = useState(phase.name);
  const [expanded, setExpanded] = useState(true);

  const commitName = () => {
    if (localName.trim()) {
      onUpdate({ ...phase, name: localName.trim() });
    } else {
      setLocalName(phase.name);
    }
    setEditing(false);
  };

  return (
    <div className="relative border-2 border-accent-purple rounded-xl bg-card min-w-[280px] max-w-[340px] shadow-[0_4px_24px_rgba(0,0,0,.3)]">
      <Handle type="target" position={Position.Left} className="!opacity-0 !w-2 !h-2" />
      <Handle type="source" position={Position.Right} className="!opacity-0 !w-2 !h-2" />

      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border">
        <div className="w-2 h-2 rounded-full bg-accent-purple shrink-0" />
        <div className="flex-1 min-w-0">
          {editing ? (
            <input
              autoFocus
              value={localName}
              onChange={(e) => setLocalName(e.target.value)}
              onBlur={commitName}
              onKeyDown={(e) => e.key === "Enter" && commitName()}
              className="font-mono text-[.75rem] font-semibold bg-transparent border-b border-accent-purple outline-none w-full text-txt"
            />
          ) : (
            <div
              className="font-mono text-[.75rem] font-semibold text-txt cursor-pointer hover:text-accent-purple transition-colors"
              onClick={() => setEditing(true)}
            >
              {phase.name}
            </div>
          )}
          <div className="font-mono text-[.5rem] text-txt-dim mt-0.5">
            Phase {phase.order_index + 1}
          </div>
        </div>
        <button
          onClick={() => setExpanded((v) => !v)}
          className="text-[.55rem] text-txt-dim hover:text-txt cursor-pointer bg-transparent border-none p-1"
        >
          {expanded ? "▼" : "▶"}
        </button>
        <button
          onClick={() => onDelete(phase.id)}
          className="text-[.6rem] text-accent-red/60 hover:text-accent-red cursor-pointer bg-transparent border-none p-1"
        >
          ✕
        </button>
      </div>

      {expanded && (
        <div className="px-3 py-2 space-y-2.5">
          {/* Phase Signoff Rule */}
          <div>
            <SignoffRuleSelector
              value={phase.signoff_rule}
              quorumThreshold={phase.quorum_threshold}
              onChange={(rule, threshold) => onUpdate({ ...phase, signoff_rule: rule, quorum_threshold: threshold })}
              label="Phase Signoff (across slots)"
            />
            <div className="font-mono text-[.42rem] text-txt-dim mt-1 italic">
              {SIGNOFF_DESCRIPTIONS[phase.signoff_rule]} — applied to group slots
            </div>
          </div>

          {/* Group Slots */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="font-mono text-[.5rem] text-txt-dim uppercase tracking-wider">
                Group Slots
              </span>
              <button
                onClick={() => onAddSlot(phase.id)}
                className="font-mono text-[.5rem] text-accent-cyan hover:text-accent-cyan/80 cursor-pointer bg-transparent border-none"
              >
                + Add Slot
              </button>
            </div>
            <div className="space-y-2">
              {phase.group_slots.map((slot) => (
                <SlotCard
                  key={slot.id}
                  slot={slot}
                  phaseId={phase.id}
                  profiles={profiles}
                  onUpdateSlot={onUpdateSlot}
                  onDeleteSlot={onDeleteSlot}
                  onAssign={(profileId) => onAssignProfile(phase.id, slot.id, profileId)}
                  onRemove={(profileId) => onRemoveProfile(phase.id, slot.id, profileId)}
                />
              ))}
              {phase.group_slots.length === 0 && (
                <div className="font-mono text-[.5rem] text-txt-dim italic py-1">
                  No group slots defined
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Slot Card ---

function SlotCard({
  slot,
  phaseId,
  profiles,
  onUpdateSlot,
  onDeleteSlot,
  onAssign,
  onRemove,
}: {
  slot: GroupSlot;
  phaseId: string;
  profiles: Profile[];
  onUpdateSlot: (phaseId: string, slot: GroupSlot) => void;
  onDeleteSlot: (phaseId: string, slotId: string) => void;
  onAssign: (profileId: string) => void;
  onRemove: (profileId: string) => void;
}) {
  const [editingName, setEditingName] = useState(false);
  const [localName, setLocalName] = useState(slot.name);
  const [showSlotRule, setShowSlotRule] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const assigned = profiles.filter((p) => slot.assignedProfiles.includes(p.id));

  const commitName = () => {
    if (localName.trim()) {
      onUpdateSlot(phaseId, { ...slot, name: localName.trim() });
    } else {
      setLocalName(slot.name);
    }
    setEditingName(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    setDragOver(true);
  };

  const handleDragLeave = () => setDragOver(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const profileId = e.dataTransfer.getData("application/profile-id");
    if (profileId && !slot.assignedProfiles.includes(profileId)) {
      onAssign(profileId);
    }
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn(
        "border rounded-lg px-2.5 py-2 transition-all",
        dragOver
          ? "border-accent-cyan bg-accent-cyan/5 shadow-[0_0_8px_rgba(34,211,238,.15)]"
          : "border-border bg-bg/50"
      )}
    >
      {/* Slot Header */}
      <div className="flex items-center justify-between gap-1">
        {editingName ? (
          <input
            autoFocus
            value={localName}
            onChange={(e) => setLocalName(e.target.value)}
            onBlur={commitName}
            onKeyDown={(e) => e.key === "Enter" && commitName()}
            className="font-mono text-[.6rem] font-medium bg-transparent border-b border-accent-cyan outline-none flex-1 text-txt"
          />
        ) : (
          <span
            onClick={() => setEditingName(true)}
            className="font-mono text-[.6rem] text-txt-muted font-medium cursor-pointer hover:text-accent-cyan transition-colors"
          >
            {slot.name}
          </span>
        )}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowSlotRule((v) => !v)}
            className={cn(
              "font-mono text-[.42rem] px-1.5 py-0.5 rounded border cursor-pointer transition-all",
              showSlotRule
                ? "border-accent-green/50 text-accent-green bg-accent-green/5"
                : "border-border text-txt-dim hover:border-border-hi"
            )}
          >
            {SIGNOFF_LABELS[slot.signoff_rule]}
          </button>
          <button
            onClick={() => onDeleteSlot(phaseId, slot.id)}
            className="text-[.55rem] text-accent-red/40 hover:text-accent-red cursor-pointer bg-transparent border-none p-0.5"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Slot Signoff Rule (expandable) */}
      {showSlotRule && (
        <div className="mt-2 pt-2 border-t border-border">
          <SignoffRuleSelector
            value={slot.signoff_rule}
            quorumThreshold={slot.quorum_threshold}
            onChange={(rule, threshold) => onUpdateSlot(phaseId, { ...slot, signoff_rule: rule, quorum_threshold: threshold })}
            label="Slot Signoff (across members)"
            compact
          />
          <div className="font-mono text-[.4rem] text-txt-dim mt-1 italic">
            {SIGNOFF_DESCRIPTIONS[slot.signoff_rule]} — applied to members in this slot
          </div>
        </div>
      )}

      {/* Assigned Profiles */}
      {assigned.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1.5">
          {assigned.map((p) => (
            <span
              key={p.id}
              className="inline-flex items-center gap-1 font-mono text-[.5rem] px-1.5 py-0.5 rounded-md border border-border"
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: p.color }} />
              {p.name}
              <button
                onClick={() => onRemove(p.id)}
                className="text-accent-red/50 hover:text-accent-red cursor-pointer bg-transparent border-none text-[.5rem] ml-0.5"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Drop hint when empty */}
      {assigned.length === 0 && !dragOver && (
        <div className="font-mono text-[.45rem] text-txt-dim italic mt-1.5">
          Drag people here from the sidebar
        </div>
      )}
      {dragOver && (
        <div className="font-mono text-[.45rem] text-accent-cyan mt-1.5 font-medium">
          Drop to assign
        </div>
      )}
    </div>
  );
}

// --- Node Types ---

const nodeTypes: NodeTypes = { phase: PhaseNode };

// --- Build React Flow graph ---

function buildFlowGraph(
  state: WorkflowState,
  callbacks: PhaseNodeData
): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = state.phases.map((phase, i) => ({
    id: phase.id,
    type: "phase",
    position: { x: i * 400, y: 80 },
    data: { ...callbacks, phase },
    draggable: true,
  }));

  const edges: Edge[] = [];
  for (let i = 0; i < state.phases.length - 1; i++) {
    edges.push({
      id: `e-${state.phases[i].id}-${state.phases[i + 1].id}`,
      source: state.phases[i].id,
      target: state.phases[i + 1].id,
      type: "smoothstep",
      animated: true,
      style: { stroke: "var(--color-accent-purple)", strokeWidth: 2 },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: "var(--color-accent-purple)",
        width: 16,
        height: 16,
      },
    });
  }

  return { nodes, edges };
}

// --- Main Page ---

export function WorkflowBuilder() {
  const { theme } = useTheme();
  const [state, setState] = useState<WorkflowState>({
    phases: [
      {
        id: uid(),
        name: "Team Review",
        order_index: 0,
        signoff_rule: "unanimous",
        group_slots: [
          { id: uid(), name: "Translation Team", description: "", signoff_rule: "unanimous", assignedProfiles: [] },
        ],
      },
    ],
    profiles: [
      { id: uid(), name: "Sarah", color: PROFILE_COLORS[0] },
      { id: uid(), name: "James", color: PROFILE_COLORS[1] },
      { id: uid(), name: "Maria", color: PROFILE_COLORS[2] },
      { id: uid(), name: "Pastor David", color: PROFILE_COLORS[3] },
      { id: uid(), name: "Elder Ruth", color: PROFILE_COLORS[4] },
    ],
  });

  const [newProfileName, setNewProfileName] = useState("");
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  // --- Callbacks ---

  const onUpdatePhase = useCallback((updated: Phase) => {
    setState((s) => ({
      ...s,
      phases: s.phases.map((p) => (p.id === updated.id ? updated : p)),
    }));
  }, []);

  const onDeletePhase = useCallback((id: string) => {
    setState((s) => ({
      ...s,
      phases: s.phases
        .filter((p) => p.id !== id)
        .map((p, i) => ({ ...p, order_index: i })),
    }));
  }, []);

  const onAddSlot = useCallback((phaseId: string) => {
    setState((s) => ({
      ...s,
      phases: s.phases.map((p) =>
        p.id === phaseId
          ? {
              ...p,
              group_slots: [
                ...p.group_slots,
                { id: uid(), name: `Group ${p.group_slots.length + 1}`, description: "", signoff_rule: "any_one" as SignoffRule, assignedProfiles: [] },
              ],
            }
          : p
      ),
    }));
  }, []);

  const onDeleteSlot = useCallback((phaseId: string, slotId: string) => {
    setState((s) => ({
      ...s,
      phases: s.phases.map((p) =>
        p.id === phaseId
          ? { ...p, group_slots: p.group_slots.filter((slot) => slot.id !== slotId) }
          : p
      ),
    }));
  }, []);

  const onUpdateSlot = useCallback((phaseId: string, updatedSlot: GroupSlot) => {
    setState((s) => ({
      ...s,
      phases: s.phases.map((p) =>
        p.id === phaseId
          ? { ...p, group_slots: p.group_slots.map((slot) => (slot.id === updatedSlot.id ? updatedSlot : slot)) }
          : p
      ),
    }));
  }, []);

  const onAssignProfile = useCallback((phaseId: string, slotId: string, profileId: string) => {
    setState((s) => ({
      ...s,
      phases: s.phases.map((p) =>
        p.id === phaseId
          ? {
              ...p,
              group_slots: p.group_slots.map((slot) =>
                slot.id === slotId
                  ? { ...slot, assignedProfiles: [...slot.assignedProfiles, profileId] }
                  : slot
              ),
            }
          : p
      ),
    }));
  }, []);

  const onRemoveProfile = useCallback((phaseId: string, slotId: string, profileId: string) => {
    setState((s) => ({
      ...s,
      phases: s.phases.map((p) =>
        p.id === phaseId
          ? {
              ...p,
              group_slots: p.group_slots.map((slot) =>
                slot.id === slotId
                  ? { ...slot, assignedProfiles: slot.assignedProfiles.filter((id) => id !== profileId) }
                  : slot
              ),
            }
          : p
      ),
    }));
  }, []);

  const addPhase = useCallback(() => {
    setState((s) => ({
      ...s,
      phases: [
        ...s.phases,
        {
          id: uid(),
          name: `Phase ${s.phases.length + 1}`,
          order_index: s.phases.length,
          signoff_rule: "any_one",
          group_slots: [],
        },
      ],
    }));
  }, []);

  const addProfile = useCallback(() => {
    if (!newProfileName.trim()) return;
    setState((s) => ({
      ...s,
      profiles: [
        ...s.profiles,
        {
          id: uid(),
          name: newProfileName.trim(),
          color: PROFILE_COLORS[s.profiles.length % PROFILE_COLORS.length],
        },
      ],
    }));
    setNewProfileName("");
  }, [newProfileName]);

  const removeProfile = useCallback((profileId: string) => {
    setState((s) => ({
      ...s,
      profiles: s.profiles.filter((p) => p.id !== profileId),
      phases: s.phases.map((phase) => ({
        ...phase,
        group_slots: phase.group_slots.map((slot) => ({
          ...slot,
          assignedProfiles: slot.assignedProfiles.filter((id) => id !== profileId),
        })),
      })),
    }));
  }, []);

  const exportJson = useCallback(() => {
    const structure = {
      format_version: 1,
      steps: [],
      phases: state.phases.map((p) => ({
        id: p.id,
        name: p.name,
        order_index: p.order_index,
        signoff_rule: p.signoff_rule,
        ...(p.signoff_rule === "quorum" ? { quorum_threshold: p.quorum_threshold ?? 0.75 } : {}),
        group_slots: p.group_slots.map((s) => ({
          id: s.id,
          name: s.name,
          signoff_rule: s.signoff_rule,
          ...(s.signoff_rule === "quorum" ? { quorum_threshold: s.quorum_threshold ?? 0.75 } : {}),
          ...(s.description ? { description: s.description } : {}),
        })),
      })),
    };
    const blob = new Blob([JSON.stringify(structure, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "workflow-template.json";
    a.click();
    URL.revokeObjectURL(url);
  }, [state]);

  // --- Sync React Flow graph with state ---

  useEffect(() => {
    const callbacks: PhaseNodeData = {
      phase: state.phases[0],
      profiles: state.profiles,
      onUpdate: onUpdatePhase,
      onDelete: onDeletePhase,
      onAddSlot,
      onDeleteSlot,
      onUpdateSlot,
      onAssignProfile,
      onRemoveProfile,
    };
    const { nodes: builtNodes, edges: builtEdges } = buildFlowGraph(state, callbacks);

    setNodes((currentNodes) =>
      builtNodes.map((n) => {
        const existing = currentNodes.find((en) => en.id === n.id);
        return existing ? { ...n, position: existing.position } : n;
      })
    );
    setEdges(builtEdges);
  }, [state, onUpdatePhase, onDeletePhase, onAddSlot, onDeleteSlot, onUpdateSlot, onAssignProfile, onRemoveProfile, setNodes, setEdges]);

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <Header
        title="Workflow Builder"
        subtitle="LangQuest · Review Process Template"
        actions={
          <>
            <HeaderButton onClick={addPhase}>+ Phase</HeaderButton>
            <HeaderButton onClick={exportJson}>↓ Export JSON</HeaderButton>
          </>
        }
        currentHash="#workflow"
      />

      <div className="flex-1 flex min-h-0">
        {/* Sidebar - Profiles */}
        <div className="w-56 border-r border-border bg-card/50 flex flex-col shrink-0 overflow-hidden">
          <div className="px-3 py-3 border-b border-border">
            <div className="font-mono text-[.6rem] text-txt-dim uppercase tracking-wider mb-2">
              People
            </div>
            <div className="flex gap-1">
              <input
                value={newProfileName}
                onChange={(e) => setNewProfileName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addProfile()}
                placeholder="New person..."
                className="flex-1 font-mono text-[.6rem] px-2 py-1.5 rounded-md border border-border bg-bg text-txt placeholder:text-txt-dim outline-none focus:border-accent-purple"
              />
              <button
                onClick={addProfile}
                className="font-mono text-[.55rem] px-2 py-1.5 rounded-md border border-border text-accent-cyan hover:bg-accent-cyan/10 cursor-pointer bg-transparent transition-all"
              >
                +
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
            <div className="font-mono text-[.45rem] text-txt-dim mb-2 italic">
              Drag people into group slots →
            </div>
            {state.profiles.map((p) => (
              <div
                key={p.id}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData("application/profile-id", p.id);
                  e.dataTransfer.effectAllowed = "copy";
                }}
                className="flex items-center gap-2 px-2 py-1.5 rounded-md border border-border hover:border-accent-purple hover:bg-accent-purple/5 transition-all group cursor-grab active:cursor-grabbing select-none"
              >
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ background: p.color }}
                />
                <span className="font-mono text-[.6rem] text-txt flex-1 truncate">
                  {p.name}
                </span>
                <button
                  onClick={() => removeProfile(p.id)}
                  className="text-[.55rem] text-accent-red/0 group-hover:text-accent-red/50 hover:!text-accent-red cursor-pointer bg-transparent border-none transition-all"
                >
                  ✕
                </button>
              </div>
            ))}
            {state.profiles.length === 0 && (
              <div className="font-mono text-[.5rem] text-txt-dim italic py-4 text-center">
                No profiles yet. Add people above.
              </div>
            )}
          </div>

          {/* Legend */}
          <div className="px-3 py-3 border-t border-border space-y-1.5">
            <div className="font-mono text-[.5rem] text-txt-dim uppercase tracking-wider mb-1">
              How it works
            </div>
            <div className="font-mono text-[.45rem] text-txt-dim leading-relaxed space-y-1">
              <p>1. Add <span className="text-accent-purple">phases</span> — sequential review stages</p>
              <p>2. Set <span className="text-accent-green">phase signoff</span> — rule across slots</p>
              <p>3. Add <span className="text-accent-cyan">group slots</span> — parallel reviewer groups</p>
              <p>4. Set <span className="text-accent-green">slot signoff</span> — rule across members</p>
              <p>5. <span className="text-txt-muted">Drag people</span> into slots</p>
              <p>6. Export as JSON template</p>
            </div>
          </div>
        </div>

        {/* Flow Canvas */}
        <div className="flex-1 min-h-0 relative">
          {state.phases.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
              <div className="text-center space-y-2">
                <div className="font-mono text-[.8rem] text-txt-dim">No phases yet</div>
                <div className="font-mono text-[.6rem] text-txt-dim/60">
                  Click "+ Phase" to add a review stage
                </div>
              </div>
            </div>
          )}
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            nodeTypes={nodeTypes}
            colorMode={theme}
            fitView
            fitViewOptions={{ padding: 0.3 }}
            proOptions={{ hideAttribution: true }}
            minZoom={0.3}
            maxZoom={1.5}
            panOnScroll
          />
        </div>
      </div>
    </div>
  );
}
