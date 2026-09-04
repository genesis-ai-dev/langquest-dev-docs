import { useRef, useState, type MouseEvent, type PointerEvent } from "react";
import { cn } from "../../cn";
import type { StageMeta, StageStatus } from "../domain/project";
import { useDesignerStore } from "../state/store";
import { CreateStageForm } from "./CreateStageForm";

const DRAG_THRESHOLD = 6;

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
  const [menu, setMenu] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const skipClick = useRef(false);
  const overRef = useRef<string | null>(null);
  const pointer = useRef<{ id: string; x: number; y: number; dragging: boolean } | null>(null);
  const activeIndex = manifest.stages.findIndex((s) => s.id === active);

  function setHover(next: string | null) {
    overRef.current = next;
    setOverId((cur) => (cur === next ? cur : next));
  }

  function endPointerDrag() {
    const p = pointer.current;
    const target = overRef.current;
    pointer.current = null;
    setDragId(null);
    setHover(null);
    if (!p?.dragging || !target) return;
    const toIndex = useDesignerStore.getState().manifest.stages.findIndex((s) => s.id === target);
    if (toIndex >= 0) void useDesignerStore.getState().reorderStage(p.id, toIndex);
    window.setTimeout(() => {
      skipClick.current = false;
    }, 50);
  }

  function startChipDrag(
    id: string,
    clientX: number,
    clientY: number,
    capture?: { target: HTMLElement; pointerId: number },
  ) {
    if (readOnly || pointer.current) return;
    pointer.current = { id, x: clientX, y: clientY, dragging: false };
    if (capture) {
      try {
        capture.target.setPointerCapture(capture.pointerId);
      } catch {
        /* synthetic / automation pointers may not support capture */
      }
    }
    const onMove = (ev: { clientX: number; clientY: number }) => {
      const p = pointer.current;
      if (!p) return;
      if (!p.dragging) {
        if (Math.hypot(ev.clientX - p.x, ev.clientY - p.y) < DRAG_THRESHOLD) return;
        p.dragging = true;
        skipClick.current = true;
        setDragId(p.id);
      }
      const el = document.elementFromPoint(ev.clientX, ev.clientY);
      const chip = el?.closest("[data-stage-id]");
      setHover(chip instanceof HTMLElement ? chip.dataset.stageId ?? null : null);
    };
    let finished = false;
    const onUp = () => {
      if (finished) return;
      finished = true;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      endPointerDrag();
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  return (
    <div className="shrink-0 border-b border-border bg-bg px-4 py-2 flex items-center gap-2 overflow-x-auto">
      {manifest.stages.map((stage, i) => (
        <StageChip
          key={stage.id}
          stage={stage}
          index={i}
          isActive={stage.id === active}
          readOnly={readOnly}
          isDragging={dragId === stage.id}
          isDropTarget={overId === stage.id && dragId !== null && dragId !== stage.id}
          menuOpen={menu === stage.id}
          canDelete={manifest.stages.length > 1 && !readOnly}
          onActivate={() => {
            if (skipClick.current) {
              skipClick.current = false;
              return;
            }
            void useDesignerStore.getState().activateStage(stage.id);
          }}
          onOpenMenu={() => setMenu(stage.id)}
          onCloseMenu={() => setMenu(null)}
          onPointerDown={(e) => {
            if (e.button !== 0) return;
            startChipDrag(stage.id, e.clientX, e.clientY, {
              target: e.currentTarget,
              pointerId: e.pointerId,
            });
          }}
          onMouseDown={(e) => {
            if (e.button !== 0) return;
            startChipDrag(stage.id, e.clientX, e.clientY);
          }}
        />
      ))}

      {!readOnly && (
        creating ? (
          <CreateStageForm onDone={() => setCreating(false)} />
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

function StageChip({
  stage,
  index,
  isActive,
  readOnly,
  isDragging,
  isDropTarget,
  menuOpen,
  canDelete,
  onActivate,
  onOpenMenu,
  onCloseMenu,
  onPointerDown,
  onMouseDown,
}: {
  stage: StageMeta;
  index: number;
  isActive: boolean;
  readOnly: boolean;
  isDragging: boolean;
  isDropTarget: boolean;
  menuOpen: boolean;
  canDelete: boolean;
  onActivate: () => void;
  onOpenMenu: () => void;
  onCloseMenu: () => void;
  onPointerDown: (e: PointerEvent<HTMLButtonElement>) => void;
  onMouseDown: (e: MouseEvent<HTMLButtonElement>) => void;
}) {
  return (
    <div className="relative flex items-center gap-2" data-stage-id={stage.id}>
      {index > 0 && <span className="text-txt-dim text-[.7rem]">▸</span>}
      {isDropTarget && (
        <span className="absolute left-0 top-0.5 bottom-0.5 w-0.5 rounded-full bg-accent-cyan" />
      )}
      <button
        type="button"
        onPointerDown={readOnly ? undefined : onPointerDown}
        onMouseDown={readOnly ? undefined : onMouseDown}
        onClick={onActivate}
        onContextMenu={(e) => {
          e.preventDefault();
          onOpenMenu();
        }}
        className={cn(
          "flex items-center gap-1.5 font-mono text-[.72rem] px-2.5 py-1 rounded-md border select-none touch-none",
          readOnly ? "cursor-pointer" : "cursor-grab active:cursor-grabbing",
          isDragging && "opacity-40",
          isActive
            ? "border-accent-purple text-accent-purple bg-accent-purple/10"
            : "border-transparent text-txt-dim hover:text-txt hover:bg-card",
        )}
      >
        <span className={cn("w-1.5 h-1.5 rounded-full", STATUS_DOT[stage.status])} />
        {String(index).padStart(2, "0")} {stage.title}
      </button>
      {menuOpen && <StageMenu stageId={stage.id} onClose={onCloseMenu} canDelete={canDelete} />}
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
          const i = useDesignerStore.getState().manifest.stages.findIndex((s) => s.id === stageId);
          void useDesignerStore.getState().reorderStage(stageId, i - 1);
          onClose();
        }}
      >
        Move left
      </button>
      <button
        type="button"
        className="text-left font-mono text-[.68rem] bg-transparent border-none text-txt-muted cursor-pointer"
        onClick={() => {
          const i = useDesignerStore.getState().manifest.stages.findIndex((s) => s.id === stageId);
          void useDesignerStore.getState().reorderStage(stageId, i + 1);
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
