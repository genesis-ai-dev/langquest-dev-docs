import {
  Handle,
  Position,
  useUpdateNodeInternals,
  type NodeProps,
  type Node,
} from "@xyflow/react";
import { useState, useCallback, useEffect, Fragment } from "react";
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
  /** Optional accent color (CSS color value) used for the border + title, e.g. to group tables by system. */
  tint?: string;
  [key: string]: unknown;
}

export type SchemaNodeType = Node<SchemaNodeData>;

const HANDLE_CLS = "!opacity-0 !w-1 !h-1 !min-w-0 !min-h-0";

export function SchemaNode({ id, data }: NodeProps<SchemaNodeType>) {
  const [expanded, setExpanded] = useState(false);
  const updateNodeInternals = useUpdateNodeInternals();
  const toggle = useCallback(() => setExpanded((v) => !v), []);
  const highlighted = data.highlighted;
  const tint = data.tint;

  useEffect(() => {
    updateNodeInternals(id);
  }, [expanded, id, updateNodeInternals]);

  return (
    <div
      className={cn(
        "relative border rounded-[10px] bg-card min-w-[170px] max-w-[330px] transition-all duration-250 select-none",
        !tint &&
          (highlighted
            ? "border-accent-purple shadow-[0_0_16px_#a78bfa18,0_0_0_1px_var(--color-accent-purple)] border-2"
            : "border-border hover:border-border-hi shadow-[0_2px_16px_rgba(0,0,0,.35)]"),
        tint &&
          (highlighted
            ? "border-2"
            : "border-border opacity-35 hover:opacity-80 shadow-[0_2px_16px_rgba(0,0,0,.35)]"),
      )}
      style={
        tint && highlighted
          ? {
              borderColor: tint,
              boxShadow: `0 0 16px color-mix(in srgb, ${tint} 10%, transparent), 0 0 0 1px ${tint}`,
            }
          : undefined
      }
    >
      {/* Header */}
      <div
        className={cn(
          "flex items-center gap-[7px] px-3 py-2",
          expanded && "border-b border-border",
        )}
      >
        <div className="flex-1 min-w-0">
          <div
            className={cn(
              "font-mono text-[.85rem] font-semibold leading-tight",
              !tint && "text-txt",
            )}
            style={tint ? { color: tint } : undefined}
          >
            {data.label}
          </div>
          {data.subtitle && (
            <div className="font-mono text-[.62rem] text-txt-dim mt-0.5 uppercase tracking-[.06em]">
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

      {expanded ? (
        <div>
          {data.fields.map((f) => (
            <div key={f.name} className="relative">
              <FieldRow field={f} />
              <Handle type="source" position={Position.Right} id={`field-${f.name}`} className={HANDLE_CLS} />
              <Handle type="target" position={Position.Left} id={`field-${f.name}`} className={HANDLE_CLS} />
            </div>
          ))}
        </div>
      ) : (
        <div className="absolute left-0 right-0 top-1/2 h-0 overflow-visible pointer-events-none">
          {data.fields.map((f) => (
            <Fragment key={f.name}>
              <Handle type="source" position={Position.Right} id={`field-${f.name}`} className={HANDLE_CLS} />
              <Handle type="target" position={Position.Left} id={`field-${f.name}`} className={HANDLE_CLS} />
            </Fragment>
          ))}
        </div>
      )}
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
        "font-mono text-[.74rem] px-[10px] py-[5px] flex items-center gap-[6px] border-t border-white/[.02] relative",
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
        <span className="text-[.56rem] px-1 py-px rounded-[3px] uppercase tracking-[.04em] shrink-0 bg-accent-cyan/10 text-accent-cyan">
          pk
        </span>
      )}
      {isFk && field.selfRef && (
        <span className="text-[.56rem] px-1 py-px rounded-[3px] uppercase tracking-[.04em] shrink-0 bg-accent-amber/10 text-accent-amber">
          self
        </span>
      )}
      {isFk && !field.selfRef && (
        <span className="text-[.56rem] px-1 py-px rounded-[3px] uppercase tracking-[.04em] shrink-0 bg-accent-purple/10 text-accent-purple">
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
            className="w-[16px] h-[16px] rounded-full border border-txt-dim inline-flex items-center justify-center text-[.55rem] text-txt-dim cursor-pointer shrink-0 transition-all p-0 bg-transparent font-mono leading-none hover:border-txt-muted hover:text-txt-muted hover:bg-border"
          >
            ?
          </button>
          {showHint && (
            <div className="absolute z-[200] right-0 top-full mt-1 bg-card/95 border border-border-hi rounded-[10px] px-3.5 py-2.5 w-max min-w-[180px] max-w-[340px] font-sans text-[.82rem] text-txt-muted leading-relaxed backdrop-blur-[12px] shadow-[0_8px_24px_rgba(0,0,0,.5)]">
              {field.hint}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
