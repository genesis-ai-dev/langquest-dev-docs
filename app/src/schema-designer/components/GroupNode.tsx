import { NodeResizer, type NodeProps } from "@xyflow/react";
import { useState } from "react";
import { cn } from "../../cn";
import type { GroupColor } from "../layout/types";
import { groupIdFromNode } from "../layout/types";
import type { GroupNodeData } from "../flow/types";
import { useDesignerStore } from "../state/store";

const FRAME: Record<GroupColor, string> = {
  purple: "bg-accent-purple/15 border-accent-purple/45 text-accent-purple",
  cyan: "bg-accent-cyan/15 border-accent-cyan/45 text-accent-cyan",
  amber: "bg-accent-amber/15 border-accent-amber/45 text-accent-amber",
  green: "bg-accent-green/15 border-accent-green/45 text-accent-green",
  pink: "bg-accent-pink/15 border-accent-pink/45 text-accent-pink",
  red: "bg-accent-red/15 border-accent-red/45 text-accent-red",
  blue: "bg-accent-blue/15 border-accent-blue/45 text-accent-blue",
};

export function GroupNode({ id, data, selected }: NodeProps) {
  const { label, color, readOnly } = data as GroupNodeData;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(label);
  const groupId = groupIdFromNode(id);

  return (
    <div
      className={cn(
        "w-full h-full rounded-[12px] border-2 border-dashed font-mono",
        FRAME[color] ?? FRAME.purple,
        selected && "border-solid",
      )}
    >
      <NodeResizer
        isVisible={selected && !readOnly}
        minWidth={140}
        minHeight={80}
        color="var(--color-accent-purple)"
        onResizeStart={() => useDesignerStore.getState().beginLayoutGesture()}
        onResizeEnd={(_e, params) => {
          if (groupId) {
            useDesignerStore.getState().updateGroup(groupId, {
              x: params.x,
              y: params.y,
              width: params.width,
              height: params.height,
            });
          }
          useDesignerStore.getState().endLayoutGesture();
        }}
      />
      <div className="px-2 py-1 text-[.68rem] uppercase tracking-[.08em] nodrag nopan">
        {editing && !readOnly ? (
          <input
            autoFocus
            className="bg-code-bg border border-border rounded px-1 py-0.5 text-txt w-full"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => {
              if (groupId && draft.trim()) {
                useDesignerStore.getState().updateGroup(groupId, { label: draft.trim() });
              }
              setEditing(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              if (e.key === "Escape") {
                setDraft(label);
                setEditing(false);
              }
            }}
          />
        ) : (
          <button
            type="button"
            className="bg-transparent border-none p-0 text-inherit cursor-text"
            onDoubleClick={() => {
              if (readOnly) return;
              setDraft(label);
              setEditing(true);
            }}
          >
            {label}
          </button>
        )}
      </div>
    </div>
  );
}
