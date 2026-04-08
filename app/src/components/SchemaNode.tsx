import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import { useState, useCallback } from "react";
import { cn } from "../cn";

export interface FieldDef {
  name: string;
  pk?: boolean;
  fk?: { node: string; field: string };
  selfRef?: boolean;
  hint?: string;
}

export interface SchemaNodeData {
  label: string;
  subtitle?: string;
  fields: FieldDef[];
  highlighted?: boolean;
  [key: string]: unknown;
}

export type SchemaNodeType = Node<SchemaNodeData>;

export function SchemaNode({ data }: NodeProps<SchemaNodeType>) {
  const [expanded, setExpanded] = useState(false);
  const toggle = useCallback(() => setExpanded((v) => !v), []);

  return (
    <div
      className={cn(
        "border rounded-[10px] bg-card shadow-[0_2px_16px_rgba(0,0,0,.35)] min-w-[150px] max-w-[280px] transition-all select-none",
        data.highlighted
          ? "border-accent-purple shadow-[0_0_16px_#a78bfa18,0_0_0_1px_var(--color-accent-purple)]"
          : "border-border hover:border-border-hi",
      )}
    >
      {/* Header */}
      <div
        className={cn(
          "flex items-center gap-[7px] px-3 py-2",
          expanded && "border-b border-border",
        )}
      >
        <div className="flex-1 min-w-0">
          <div className="font-mono text-[.7rem] font-semibold leading-tight text-txt">
            {data.label}
          </div>
          {data.subtitle && (
            <div className="font-mono text-[.5rem] text-txt-dim mt-px uppercase tracking-[.06em]">
              {data.subtitle}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={toggle}
          className={cn(
            "appearance-none border-none bg-transparent w-6 h-6 flex items-center justify-center rounded-md text-[.5rem] text-txt-dim cursor-pointer transition-all p-0 hover:bg-border hover:text-txt-muted shrink-0",
            expanded && "rotate-90",
          )}
        >
          ▶
        </button>
      </div>

      {/* Fields */}
      {expanded && (
        <div>
          {data.fields.map((f) => (
            <FieldRow key={f.name} field={f} />
          ))}
        </div>
      )}

      <Handle type="target" position={Position.Left} className="!opacity-0" />
      <Handle type="source" position={Position.Right} className="!opacity-0" />
    </div>
  );
}

function FieldRow({ field }: { field: FieldDef }) {
  const [showHint, setShowHint] = useState(false);
  const isFk = !!field.fk;
  const isPk = !!field.pk;

  return (
    <div
      className={cn(
        "font-mono text-[.58rem] px-[10px] py-1 flex items-center gap-[5px] border-t border-white/[.02] relative",
        isPk && "pl-2 border-l-2 border-l-accent-cyan",
        isFk && !isPk && "pl-2 border-l-2 border-l-accent-purple",
      )}
    >
      <span
        className={cn(
          "break-all transition-colors",
          isPk && "text-accent-cyan",
          isFk && !isPk && "text-accent-purple",
          !isPk && !isFk && "text-txt-dim",
        )}
      >
        {field.name}
      </span>

      {isPk && (
        <span className="text-[.44rem] px-1 py-px rounded-[3px] uppercase tracking-[.04em] shrink-0 bg-accent-cyan/10 text-accent-cyan">
          pk
        </span>
      )}
      {isFk && field.selfRef && (
        <span className="text-[.44rem] px-1 py-px rounded-[3px] uppercase tracking-[.04em] shrink-0 bg-accent-amber/10 text-accent-amber">
          self
        </span>
      )}
      {isFk && !field.selfRef && (
        <span className="text-[.44rem] px-1 py-px rounded-[3px] uppercase tracking-[.04em] shrink-0 bg-accent-purple/10 text-accent-purple">
          fk
        </span>
      )}

      {field.hint && (
        <div className="relative ml-auto">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShowHint((v) => !v);
            }}
            className="w-[14px] h-[14px] rounded-full border border-txt-dim inline-flex items-center justify-center text-[.42rem] text-txt-dim cursor-pointer shrink-0 transition-all p-0 bg-transparent font-mono leading-none hover:border-txt-muted hover:text-txt-muted hover:bg-border"
          >
            ?
          </button>
          {showHint && (
            <div className="absolute z-[200] right-0 top-full mt-1 bg-card/95 border border-border-hi rounded-[10px] px-3.5 py-2.5 max-w-[280px] font-sans text-[.72rem] text-txt-muted leading-relaxed backdrop-blur-[12px] shadow-[0_8px_24px_rgba(0,0,0,.5)]">
              {field.hint}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
