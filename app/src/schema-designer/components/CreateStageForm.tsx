import { useState } from "react";
import { cn } from "../../cn";
import { useDesignerStore } from "../state/store";

export function CreateStageForm({ onDone }: { onDone: () => void }) {
  const [title, setTitle] = useState("");
  const [blank, setBlank] = useState(false);

  return (
    <form
      className="flex items-center gap-1.5"
      onSubmit={(e) => {
        e.preventDefault();
        if (!title.trim()) return;
        void useDesignerStore.getState().createStage(title.trim(), { blank });
        onDone();
      }}
    >
      <input
        autoFocus
        className="bg-code-bg border border-border rounded px-2 py-1 font-mono text-[.72rem] text-txt w-[160px]"
        placeholder={blank ? "Ideal end state" : "Stage title"}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") onDone();
        }}
      />
      <label className="flex items-center gap-1 font-mono text-[.62rem] text-txt-dim cursor-pointer">
        <input type="radio" name="stage-seed" checked={!blank} onChange={() => setBlank(false)} />
        Copy current
      </label>
      <label className="flex items-center gap-1 font-mono text-[.62rem] text-txt-dim cursor-pointer">
        <input type="radio" name="stage-seed" checked={blank} onChange={() => setBlank(true)} />
        Blank slate
      </label>
      <button
        type="submit"
        disabled={!title.trim()}
        className={cn(
          "font-mono text-[.68rem] px-2 py-1 rounded-md border cursor-pointer",
          title.trim()
            ? "border-accent-purple text-accent-purple bg-accent-purple/10"
            : "border-border text-txt-dim bg-transparent",
        )}
      >
        Create
      </button>
      <button
        type="button"
        className="font-mono text-[.62rem] bg-transparent border-none text-txt-dim cursor-pointer"
        onClick={onDone}
      >
        Cancel
      </button>
    </form>
  );
}
