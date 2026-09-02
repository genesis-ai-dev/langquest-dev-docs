import { useState } from "react";
import { cn } from "../../cn";
import type { StageStatus } from "../domain/project";
import { useDesignerStore } from "../state/store";

const STATUS_DOT: Record<StageStatus, string> = {
  live: "bg-accent-green",
  "in-progress": "bg-accent-amber",
  planned: "bg-txt-dim",
  done: "bg-accent-purple",
};

export function StageTimeline() {
  const manifest = useDesignerStore((s) => s.manifest);
  const active = useDesignerStore((s) => s.activeStageId);
  const viewMode = useDesignerStore((s) => s.viewMode);
  const compareWith = useDesignerStore((s) => s.compareWith);
  const readOnly = useDesignerStore((s) => s.readOnly);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [menu, setMenu] = useState<string | null>(null);
  const activeIndex = manifest.stages.findIndex((s) => s.id === active);

  return (
    <div className="shrink-0 border-b border-border bg-bg px-4 py-2 flex items-center gap-2 overflow-x-auto">
      {manifest.stages.map((stage, i) => (
        <div key={stage.id} className="flex items-center gap-2">
          {i > 0 && <span className="text-txt-dim text-[.7rem]">▸</span>}
          <button
            type="button"
            onClick={() => void useDesignerStore.getState().activateStage(stage.id)}
            onContextMenu={(e) => {
              e.preventDefault();
              setMenu(stage.id);
            }}
            className={cn(
              "flex items-center gap-1.5 font-mono text-[.72rem] px-2.5 py-1 rounded-md border cursor-pointer",
              stage.id === active
                ? "border-accent-purple text-accent-purple bg-accent-purple/10"
                : "border-transparent text-txt-dim hover:text-txt hover:bg-card",
            )}
          >
            <span className={cn("w-1.5 h-1.5 rounded-full", STATUS_DOT[stage.status])} />
            {stage.id.slice(0, 2)} {stage.title}
          </button>
          {menu === stage.id && (
            <StageMenu
              stageId={stage.id}
              onClose={() => setMenu(null)}
              canDelete={manifest.stages.length > 1 && !readOnly}
            />
          )}
        </div>
      ))}

      {!readOnly && (
        creating ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!title.trim()) return;
              void useDesignerStore.getState().createStage(title.trim());
              setTitle("");
              setCreating(false);
            }}
          >
            <input
              autoFocus
              className="bg-code-bg border border-border rounded px-2 py-1 font-mono text-[.72rem] text-txt"
              placeholder="Stage title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={() => {
                if (!title.trim()) setCreating(false);
              }}
            />
          </form>
        ) : (
          <button
            type="button"
            className="font-mono text-[.72rem] px-2 py-1 rounded-md border border-dashed border-border text-txt-dim hover:text-txt cursor-pointer bg-transparent"
            onClick={() => setCreating(true)}
          >
            +
          </button>
        )
      )}

      <div className="ml-auto flex items-center gap-1.5">
        {activeIndex > 0 && (
          <Toggle
            label="Diff"
            active={viewMode === "diff"}
            onClick={() =>
              void useDesignerStore.getState().setViewMode(viewMode === "diff" ? "edit" : "diff")
            }
          />
        )}
        {manifest.stages.length > 1 && (
          <>
            <Toggle
              label="Compare"
              active={viewMode === "compare"}
              onClick={() =>
                void useDesignerStore
                  .getState()
                  .setViewMode(viewMode === "compare" ? "edit" : "compare")
              }
            />
            {viewMode === "compare" && (
              <select
                className="bg-code-bg border border-border rounded px-1 py-0.5 font-mono text-[.68rem] text-txt"
                value={compareWith ?? ""}
                onChange={(e) => void useDesignerStore.getState().setCompareWith(e.target.value)}
              >
                {manifest.stages
                  .filter((s) => s.id !== active)
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title}
                    </option>
                  ))}
              </select>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Toggle({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "font-mono text-[.68rem] px-2 py-1 rounded-md border cursor-pointer",
        active
          ? "border-accent-amber text-accent-amber bg-accent-amber/10"
          : "border-border text-txt-dim bg-card",
      )}
    >
      {label}
    </button>
  );
}

function StageMenu({
  stageId,
  onClose,
  canDelete,
}: {
  stageId: string;
  onClose: () => void;
  canDelete: boolean;
}) {
  const stage = useDesignerStore((s) => s.manifest.stages.find((x) => x.id === stageId));
  const [title, setTitle] = useState(stage?.title ?? "");
  if (!stage) return null;
  return (
    <div className="absolute z-50 bg-card border border-border-hi rounded-md p-2 shadow-lg flex flex-col gap-1 min-w-[180px]">
      <input
        className="bg-code-bg border border-border rounded px-2 py-1 font-mono text-[.7rem] text-txt"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={() => void useDesignerStore.getState().renameStage(stageId, title)}
      />
      {(["live", "in-progress", "planned", "done"] as StageStatus[]).map((status) => (
        <button
          key={status}
          type="button"
          className="text-left font-mono text-[.68rem] bg-transparent border-none text-txt-muted cursor-pointer hover:text-txt"
          onClick={() => {
            void useDesignerStore.getState().setStageStatus(stageId, status);
            onClose();
          }}
        >
          status: {status}
        </button>
      ))}
      <button
        type="button"
        className="text-left font-mono text-[.68rem] bg-transparent border-none text-txt-muted cursor-pointer"
        onClick={() => {
          void useDesignerStore.getState().reorderStage(stageId, -1);
          onClose();
        }}
      >
        Move left
      </button>
      <button
        type="button"
        className="text-left font-mono text-[.68rem] bg-transparent border-none text-txt-muted cursor-pointer"
        onClick={() => {
          void useDesignerStore.getState().reorderStage(stageId, 1);
          onClose();
        }}
      >
        Move right
      </button>
      {canDelete && (
        <button
          type="button"
          className="text-left font-mono text-[.68rem] bg-transparent border-none text-accent-red cursor-pointer"
          onClick={() => {
            if (window.confirm(`Delete stage “${stage.title}”?`)) {
              void useDesignerStore.getState().deleteStage(stageId);
            }
            onClose();
          }}
        >
          Delete
        </button>
      )}
      <button
        type="button"
        className="text-left font-mono text-[.62rem] bg-transparent border-none text-txt-dim cursor-pointer"
        onClick={onClose}
      >
        Close
      </button>
    </div>
  );
}
