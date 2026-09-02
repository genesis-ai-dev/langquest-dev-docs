import { Handle, Position, useUpdateNodeInternals, type Node, type NodeProps } from "@xyflow/react";
import { Fragment, useEffect, useState } from "react";
import { cn } from "../../cn";
import type { TableNodeData } from "../flow/types";
import { useDesignerStore } from "../state/store";
import { kindBadge } from "./diffStyles";
import { FieldRow } from "./FieldRow";

const HANDLE_CLS = "!opacity-0 !w-1 !h-1 !min-w-0 !min-h-0";

function kindBorder(kind?: string, ghost?: boolean): string | undefined {
  if (ghost || kind === "removed") return "border-accent-red border-dashed opacity-45";
  if (kind === "added") return "border-accent-green";
  if (kind === "modified") return "border-accent-amber";
  if (kind === "renamed") return "border-accent-blue";
  return undefined;
}

export function TableNode({ id, data }: NodeProps<Node<TableNodeData>>) {
  const updateNodeInternals = useUpdateNodeInternals();
  const collapsed = data.collapsed;
  const table = data.table;
  const store = useDesignerStore;

  const stubbed = data.fkRefs.filter((r) => r.stubbed).length;
  useEffect(() => {
    updateNodeInternals(id);
  }, [collapsed, table.fields.length, stubbed, id, updateNodeInternals]);

  const border = kindBorder(data.diffKind, data.ghost);

  return (
    <div
      className={cn(
        "relative border rounded-[10px] bg-card min-w-[200px] max-w-[360px] select-none shadow-[0_2px_16px_rgba(0,0,0,.35)]",
        border ?? "border-border hover:border-border-hi",
      )}
    >
      <Handle type="target" position={Position.Left} id="table" className={HANDLE_CLS} />
      <div className={cn("flex items-center gap-1.5 px-3 py-2", !collapsed && "border-b border-border")}>
        <HeaderName
          name={table.name}
          readOnly={data.readOnly || !!data.ghost}
          onCommit={(next) => store.getState().renameTable(table.name, next)}
        />
        {data.diffKind && data.diffKind !== "modified" && (
          <span className="font-mono text-[.56rem] uppercase text-txt-dim">
            {kindBadge(data.diffKind)}
            {data.diffKind === "renamed" && data.tableDiff?.renamedFrom
              ? ` was: ${data.tableDiff.renamedFrom}`
              : ""}
          </span>
        )}
        {table.triggers.length > 0 && (
          <span className="font-mono text-[.56rem] text-accent-amber">⚡{table.triggers.length}</span>
        )}
        {table.policies.length > 0 && (
          <span className="font-mono text-[.56rem] text-accent-blue">🛡{table.policies.length}</span>
        )}
        {data.incomingEdgeKeys.length > 0 && !data.readOnly && (
          <button
            type="button"
            className={cn(
              "nodrag nopan appearance-none border-none cursor-pointer font-mono text-[.56rem] px-1 py-0.5 rounded-[3px]",
              data.incomingAllStubbed
                ? "bg-accent-purple/10 text-accent-purple"
                : "bg-transparent text-txt-dim hover:text-accent-purple",
            )}
            title={
              data.incomingAllStubbed
                ? "Show incoming connection lines"
                : "Pin incoming FKs as tags"
            }
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              store.getState().setEdgesStubbed(data.incomingEdgeKeys, !data.incomingAllStubbed);
            }}
          >
            ⊥{data.incomingEdgeKeys.length}
          </button>
        )}
        <button
          type="button"
          className={cn(
            "appearance-none border-none bg-transparent w-6 h-6 flex items-center justify-center rounded-md text-[.5rem] text-txt-dim cursor-pointer p-0 hover:bg-border ml-auto",
            !collapsed && "rotate-90",
          )}
          onClick={() => store.getState().setNodeCollapsed(table.name, !collapsed)}
        >
          ▶
        </button>
      </div>

      {collapsed ? (
        <div className="absolute left-0 right-0 top-1/2 h-0 overflow-visible pointer-events-none">
          {table.fields.map((f) => (
            <Fragment key={f.name}>
              <Handle type="source" position={Position.Right} id={`field-${f.name}`} className={HANDLE_CLS} />
              <Handle type="target" position={Position.Left} id={`field-${f.name}`} className={HANDLE_CLS} />
            </Fragment>
          ))}
        </div>
      ) : (
        <div>
          {table.fields.map((field) => (
            <FieldRow
              key={field.name}
              table={table.name}
              field={field}
              fk={data.fkFields.includes(field.name)}
              fkRefs={data.fkRefs.filter((r) => r.srcField === field.name)}
              fieldDiff={data.tableDiff?.fields.find((f) => f.name === field.name)}
              enumNames={data.enumNames}
              readOnly={data.readOnly || !!data.ghost}
            />
          ))}
          {data.ghostFields.slice(0, 5).map((gf) => (
            <div
              key={`ghost-${gf.name}`}
              className="font-mono text-[.74rem] px-[10px] py-[5px] text-accent-red line-through opacity-70"
            >
              {gf.name}
            </div>
          ))}
          {data.ghostFields.length > 5 && (
            <div className="font-mono text-[.62rem] px-[10px] py-1 text-accent-red">
              +{data.ghostFields.length - 5} more removed
            </div>
          )}
          {!data.readOnly && !data.ghost && (
            <button
              type="button"
              className="w-full text-left font-mono text-[.7rem] px-[10px] py-1.5 text-txt-dim hover:text-txt hover:bg-code-bg border-none bg-transparent cursor-pointer"
              onClick={() => store.getState().addField(table.name)}
            >
              + field
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function HeaderName({
  name,
  readOnly,
  onCommit,
}: {
  name: string;
  readOnly: boolean;
  onCommit: (next: string) => boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  const [invalid, setInvalid] = useState(false);

  if (!editing) {
    return (
      <div
        className="font-mono text-[.85rem] font-semibold leading-tight text-txt flex-1 min-w-0 truncate"
        onDoubleClick={() => {
          if (readOnly) return;
          setValue(name);
          setEditing(true);
          setInvalid(false);
        }}
      >
        {name}
      </div>
    );
  }

  return (
    <input
      autoFocus
      value={value}
      className={cn(
        "flex-1 min-w-0 font-mono text-[.85rem] bg-code-bg border rounded px-1 py-0.5 text-txt",
        invalid ? "border-accent-red animate-pulse" : "border-border",
      )}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          if (onCommit(value)) setEditing(false);
          else setInvalid(true);
        }
        if (e.key === "Escape") setEditing(false);
      }}
      onBlur={() => {
        if (onCommit(value)) setEditing(false);
        else setInvalid(true);
      }}
    />
  );
}
