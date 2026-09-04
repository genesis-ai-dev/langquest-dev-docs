import { lazy, Suspense } from "react";
import { cn } from "../../cn";
import { useDesignerStore } from "../state/store";

const AmlMonaco = lazy(() => import("../editor/AmlMonaco"));

export function AmlEditorPane() {
  const open = useDesignerStore((s) => s.editorOpen);
  const errors = useDesignerStore((s) => s.parseErrors);

  if (!open) return null;

  return (
    <div className="w-[380px] shrink-0 border-r border-border flex flex-col min-h-0 bg-card">
      <div className="px-3 py-1.5 font-mono text-[.62rem] uppercase tracking-[.1em] text-txt-dim border-b border-border">
        AML
      </div>
      <div className="flex-1 min-h-0">
        <Suspense fallback={<div className="p-3 font-mono text-[.7rem] text-txt-dim">Loading editor…</div>}>
          <AmlMonaco />
        </Suspense>
      </div>
      {errors.length > 0 && (
        <div className="max-h-28 overflow-auto border-t border-border">
          {errors.map((e, i) => (
            <button
              key={`${e.line}-${e.column}-${i}`}
              type="button"
              className={cn(
                "block w-full text-left font-mono text-[.62rem] px-3 py-1 border-none bg-transparent cursor-pointer",
                e.severity === "error" ? "text-accent-red" : "text-accent-amber",
              )}
            >
              {e.line}:{e.column} {e.message}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
