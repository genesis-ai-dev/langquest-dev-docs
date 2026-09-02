import { CanvasHost } from "./CanvasHost";
import { useDesignerStore } from "../state/store";

export function CompareView() {
  const compareWith = useDesignerStore((s) => s.compareWith);
  const active = useDesignerStore((s) => s.activeStageId);
  const manifest = useDesignerStore((s) => s.manifest);
  const compareSchema = useDesignerStore((s) => s.compareSchema);
  const schema = useDesignerStore((s) => s.schema);
  const leftTitle = manifest.stages.find((s) => s.id === compareWith)?.title ?? "Left";
  const rightTitle = manifest.stages.find((s) => s.id === active)?.title ?? "Right";

  return (
    <div className="flex-1 min-h-0 flex">
      <div className="flex-1 min-w-0 flex flex-col border-r border-border">
        <div className="px-3 py-1 font-mono text-[.62rem] uppercase text-txt-dim border-b border-border">
          {leftTitle}
        </div>
        {compareSchema ? (
          <CanvasHost
            fitKey={`left-${compareWith}`}
            locked
            schemaOverride={compareSchema}
            prevOverride={null}
            layoutStageId={compareWith}
            forceDiff={false}
          />
        ) : (
          <div className="flex-1 text-txt-dim font-mono text-[.75rem] p-4">
            Select a stage to compare.
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0 flex flex-col">
        <div className="px-3 py-1 font-mono text-[.62rem] uppercase text-txt-dim border-b border-border">
          {rightTitle}
        </div>
        <CanvasHost
          fitKey={`right-${compareWith}-${active}`}
          locked
          schemaOverride={schema}
          prevOverride={compareSchema}
          layoutStageId={active}
          prevLayoutStageId={compareWith}
          forceDiff
        />
      </div>
    </div>
  );
}
