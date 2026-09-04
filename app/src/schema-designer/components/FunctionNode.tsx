import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { cn } from "../../cn";
import type { FunctionNodeData } from "../flow/types";
import { useDesignerStore } from "../state/store";
import { kindBadge } from "./diffStyles";

export function FunctionNode({ data }: NodeProps<Node<FunctionNodeData>>) {
  const fn = data.fn;
  const kind = data.diffKind;

  return (
    <div
      className={cn(
        "border border-dashed rounded-[10px] bg-card min-w-[180px] max-w-[280px] px-3 py-2 select-none",
        kind === "added" && "border-accent-green",
        kind === "removed" && "border-accent-red opacity-45",
        kind === "modified" && "border-accent-amber",
        !kind && "border-accent-pink/60",
      )}
      onClick={() => useDesignerStore.getState().setSelected({ kind: "function", key: fn.name })}
    >
      <Handle type="source" position={Position.Right} id="fn" className="!opacity-0 !w-1 !h-1" />
      <div className="font-mono text-[.8rem] font-semibold text-accent-pink">
        fn {fn.name}
        {kind && <span className="ml-1 text-[.56rem] text-txt-dim">{kindBadge(kind)}</span>}
      </div>
      {fn.params.map((p) => (
        <div key={p.name} className="font-mono text-[.68rem] text-txt-dim">
          {p.name} {p.type}
        </div>
      ))}
      {fn.returns && (
        <div className="font-mono text-[.62rem] text-txt-dim mt-1">→ {fn.returns}</div>
      )}
    </div>
  );
}
