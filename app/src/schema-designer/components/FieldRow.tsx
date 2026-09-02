import { Handle, Position } from "@xyflow/react";
import { useState } from "react";
import { cn } from "../../cn";
import type { FieldDiff } from "../diff/types";
import type { Field } from "../domain/types";
import { COMMON_PG_TYPES, type FkRef } from "../flow/types";
import { useDesignerStore } from "../state/store";
import { kindBadge } from "./diffStyles";
import { FkPin } from "./FkPin";

const HANDLE_CLS = "!opacity-0 !w-1 !h-1 !min-w-0 !min-h-0";

export function FieldRow({
  table,
  field,
  fk,
  fkRefs,
  fieldDiff,
  enumNames,
  readOnly,
}: {
  table: string;
  field: Field;
  fk: boolean;
  fkRefs: FkRef[];
  fieldDiff?: FieldDiff;
  enumNames: string[];
  readOnly: boolean;
}) {
  const [editing, setEditing] = useState<"name" | "type" | null>(null);
  const [draft, setDraft] = useState("");
  const [invalid, setInvalid] = useState(false);
  const types = [...COMMON_PG_TYPES, ...enumNames.filter((n) => !COMMON_PG_TYPES.includes(n))];
  const store = useDesignerStore;
  const kind = fieldDiff?.kind;

  return (
    <div
      className={cn(
        "relative font-mono text-[.74rem] px-[10px] py-[5px] flex items-center gap-[6px] border-t border-white/[.02]",
        field.pk && "pl-2 border-l-2 border-l-accent-cyan",
        fk && !field.pk && "pl-2 border-l-2 border-l-accent-purple",
        kind === "added" && "bg-accent-green/10",
        kind === "modified" && "bg-accent-amber/10",
        kind === "renamed" && "bg-accent-blue/10",
      )}
    >
      <Handle type="source" position={Position.Right} id={`field-${field.name}`} className={HANDLE_CLS} />
      <Handle type="target" position={Position.Left} id={`field-${field.name}`} className={HANDLE_CLS} />

      {editing === "name" ? (
        <input
          autoFocus
          value={draft}
          className={cn(
            "flex-1 min-w-0 bg-code-bg border rounded px-1 py-0 text-[.74rem] text-txt",
            invalid ? "border-accent-red" : "border-border",
          )}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              if (store.getState().updateField(table, field.name, { name: draft })) setEditing(null);
              else setInvalid(true);
            }
            if (e.key === "Escape") setEditing(null);
          }}
          onBlur={() => {
            if (store.getState().updateField(table, field.name, { name: draft })) setEditing(null);
            else setInvalid(true);
          }}
        />
      ) : (
        <button
          type="button"
          className={cn(
            "bg-transparent border-none p-0 cursor-text text-left break-all",
            field.pk ? "text-accent-cyan" : fk ? "text-accent-purple" : "text-txt-dim",
          )}
          onDoubleClick={() => {
            if (readOnly) return;
            setDraft(field.name);
            setInvalid(false);
            setEditing("name");
          }}
          onClick={() => store.getState().setSelected({ kind: "field", key: `${table}.${field.name}` })}
        >
          {field.name}
        </button>
      )}

      {editing === "type" ? (
        <input
          autoFocus
          list={`types-${table}`}
          value={draft}
          className="ml-auto w-[90px] bg-code-bg border border-border rounded px-1 py-0 text-[.62rem] text-txt"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              store.getState().updateField(table, field.name, { type: draft });
              setEditing(null);
            }
            if (e.key === "Escape") setEditing(null);
          }}
          onBlur={() => {
            store.getState().updateField(table, field.name, { type: draft });
            setEditing(null);
          }}
        />
      ) : (
        <button
          type="button"
          className="ml-auto bg-transparent border-none p-0 text-[.62rem] text-txt-dim cursor-text"
          onDoubleClick={() => {
            if (readOnly) return;
            setDraft(field.type);
            setEditing("type");
          }}
        >
          {field.type}
        </button>
      )}
      <datalist id={`types-${table}`}>
        {types.map((t) => (
          <option key={t} value={t} />
        ))}
      </datalist>

      {field.pk && (
        <span className="text-[.56rem] px-1 rounded-[3px] uppercase bg-accent-cyan/10 text-accent-cyan">pk</span>
      )}
      {fk && !field.pk && (
        <span className="text-[.56rem] px-1 rounded-[3px] uppercase bg-accent-purple/10 text-accent-purple">fk</span>
      )}
      <FkPin refs={fkRefs} readOnly={readOnly} />
      {kind && kind !== "removed" && (
        <span
          className="text-[.56rem] text-txt-dim"
          title={fieldDiff?.changes.map((c) => `${c.property}: ${c.from} → ${c.to}`).join("\n")}
        >
          {kindBadge(kind)}
          {kind === "renamed" && fieldDiff?.renamedFrom ? ` was: ${fieldDiff.renamedFrom}` : ""}
        </span>
      )}

      {!readOnly && (
        <button
          type="button"
          className="bg-transparent border-none p-0 text-txt-dim hover:text-accent-red cursor-pointer text-[.7rem]"
          onClick={() => store.getState().removeField(table, field.name)}
          aria-label={`Remove ${field.name}`}
        >
          ×
        </button>
      )}
    </div>
  );
}
