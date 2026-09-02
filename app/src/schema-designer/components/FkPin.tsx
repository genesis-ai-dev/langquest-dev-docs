import { cn } from "../../cn";
import type { FkRef } from "../flow/types";
import { useDesignerStore } from "../state/store";

export function FkPin({
  refs,
  readOnly,
}: {
  refs: FkRef[];
  readOnly: boolean;
}) {
  if (refs.length === 0) return null;
  return (
    <span className="flex items-center gap-0.5 shrink-0">
      {refs.map((ref) => (
        <span key={ref.edgeKey} className="flex items-center gap-0.5">
          {ref.stubbed ? (
            <button
              type="button"
              className={cn(
                "nodrag nopan appearance-none border-none cursor-pointer font-mono text-[.56rem] px-1 py-0.5 rounded-[3px]",
                "bg-accent-purple/10 text-accent-purple hover:bg-accent-purple/20",
              )}
              title={`Go to ${ref.destTable}`}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                useDesignerStore.getState().focusTable(ref.destTable);
              }}
            >
              ⊥ {ref.destTable}
            </button>
          ) : null}
          {!readOnly && (
            <button
              type="button"
              className={cn(
                "nodrag nopan appearance-none border-none cursor-pointer font-mono text-[.56rem] px-1 py-0.5 rounded-[3px]",
                ref.stubbed
                  ? "bg-transparent text-txt-dim hover:text-txt"
                  : "bg-transparent text-txt-dim hover:text-accent-purple",
              )}
              title={ref.stubbed ? "Show connection line" : `Pin as tag (hide line to ${ref.destTable})`}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                useDesignerStore.getState().setEdgeLayout(ref.edgeKey, { stub: !ref.stubbed });
              }}
            >
              {ref.stubbed ? "─" : "⊥"}
            </button>
          )}
        </span>
      ))}
    </span>
  );
}
