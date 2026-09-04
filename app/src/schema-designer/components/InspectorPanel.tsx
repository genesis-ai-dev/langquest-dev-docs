import { useState } from "react";
import { cn } from "../../cn";
import { relationKey } from "../domain/types";
import { resolvedFor, useDesignerStore } from "../state/store";

export function InspectorPanel() {
  const open = useDesignerStore((s) => s.inspectorOpen);
  const selected = useDesignerStore((s) => s.selected);
  const schema = useDesignerStore((s) => s.schema);
  const readOnly = useDesignerStore((s) => s.readOnly);

  if (!open) return null;

  return (
    <aside className="w-[300px] shrink-0 border-l border-border bg-card overflow-auto min-h-0">
      <div className="px-3 py-1.5 font-mono text-[.62rem] uppercase tracking-[.1em] text-txt-dim border-b border-border">
        Inspector
      </div>
      <div className="p-3 flex flex-col gap-3">
        {!selected && schema && <TypesPanel readOnly={readOnly} />}
        {selected?.kind === "table" && schema && (
          <TableInspector tableName={selected.key} readOnly={readOnly} />
        )}
        {selected?.kind === "relation" && schema && (
          <RelationInspector relKey={selected.key} readOnly={readOnly} />
        )}
        {selected?.kind === "function" && schema && (
          <FunctionInspector name={selected.key} readOnly={readOnly} />
        )}
        {selected?.kind === "field" && (
          <p className="text-[.8rem] text-txt-muted">
            Field <span className="font-mono">{selected.key}</span>. Double-click the name or type on
            the canvas to edit.
          </p>
        )}
        {selected?.kind === "ghost" && (
          <p className="text-[.8rem] text-txt-muted">Removed in this stage. Not editable.</p>
        )}
      </div>
    </aside>
  );
}

function TypesPanel({ readOnly }: { readOnly: boolean }) {
  const schema = useDesignerStore((s) => s.schema);
  const [name, setName] = useState("");
  const [values, setValues] = useState("");
  if (!schema) return null;
  return (
    <div>
      <h3 className="font-mono text-[.7rem] uppercase text-txt-dim mb-2">Enums</h3>
      {schema.enums.length === 0 && <p className="text-[.75rem] text-txt-dim">No enums yet.</p>}
      {schema.enums.map((en) => (
        <div key={en.name} className="mb-2">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[.8rem]">{en.name}</span>
            {!readOnly && (
              <button
                type="button"
                className="bg-transparent border-none text-txt-dim hover:text-accent-red cursor-pointer"
                onClick={() => useDesignerStore.getState().removeEnum(en.name)}
              >
                ×
              </button>
            )}
          </div>
          <div className="font-mono text-[.62rem] text-txt-dim">{en.values.join(", ")}</div>
        </div>
      ))}
      {!readOnly && (
        <form
          className="flex flex-col gap-1 mt-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim()) return;
            useDesignerStore.getState().upsertEnum({
              name: name.trim(),
              values: values.split(",").map((v) => v.trim()).filter(Boolean),
            });
            setName("");
            setValues("");
          }}
        >
          <input
            className="bg-code-bg border border-border rounded px-2 py-1 font-mono text-[.75rem] text-txt"
            placeholder="enum name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            className="bg-code-bg border border-border rounded px-2 py-1 font-mono text-[.75rem] text-txt"
            placeholder="values, comma-separated"
            value={values}
            onChange={(e) => setValues(e.target.value)}
          />
          <button
            type="submit"
            className="font-mono text-[.7rem] border border-border rounded px-2 py-1 bg-card text-txt-muted cursor-pointer hover:border-border-hi"
          >
            Add enum
          </button>
        </form>
      )}
    </div>
  );
}

function TableInspector({ tableName, readOnly }: { tableName: string; readOnly: boolean }) {
  const table = useDesignerStore((s) => s.schema?.tables.find((t) => t.name === tableName));
  const [trig, setTrig] = useState("");
  const [pol, setPol] = useState("");
  if (!table) return <p className="text-txt-dim text-[.8rem]">Table not found.</p>;
  return (
    <div className="flex flex-col gap-3">
      <h3 className="font-mono text-[.85rem] font-semibold">{table.name}</h3>
      <label className="flex flex-col gap-1 text-[.72rem] text-txt-dim">
        Doc
        <textarea
          disabled={readOnly}
          className="bg-code-bg border border-border rounded px-2 py-1 font-sans text-[.8rem] text-txt min-h-16"
          value={table.doc ?? ""}
          onChange={(e) => useDesignerStore.getState().setTableDoc(table.name, e.target.value)}
        />
      </label>
      <label className="flex items-center gap-2 text-[.8rem]">
        <input
          type="checkbox"
          disabled={readOnly}
          checked={table.rlsEnabled}
          onChange={(e) => useDesignerStore.getState().setTableRlsEnabled(table.name, e.target.checked)}
        />
        RLS enabled
      </label>
      <section>
        <h4 className="font-mono text-[.68rem] uppercase text-txt-dim mb-1">Triggers</h4>
        {table.triggers.map((t, i) => (
          <div key={`${t.fn}-${i}`} className="flex items-start gap-1 font-mono text-[.68rem] mb-1">
            <span className="flex-1 text-txt-muted">
              {t.timing} {t.events.join(",")}
              {t.condition ? ` when (${t.condition})` : ""}: {t.fn}
            </span>
            {!readOnly && (
              <button
                type="button"
                className="bg-transparent border-none text-txt-dim cursor-pointer"
                onClick={() =>
                  useDesignerStore.getState().setTriggers(
                    table.name,
                    table.triggers.filter((_, j) => j !== i),
                  )
                }
              >
                ×
              </button>
            )}
          </div>
        ))}
        {!readOnly && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const raw = trig.trim();
              if (!raw) return;
              const match = raw.match(
                /^(before|after|instead_of)\s+([a-z]+(?:,\s*[a-z]+)*)(?:\s+when\s+\((.*)\))?\s*:\s*(\S+)$/i,
              );
              if (!match) return;
              useDesignerStore.getState().setTriggers(table.name, [
                ...table.triggers,
                {
                  timing: match[1].toLowerCase() as "before" | "after" | "instead_of",
                  events: match[2].split(",").map((x) => x.trim().toLowerCase()) as Array<
                    "insert" | "update" | "delete" | "truncate"
                  >,
                  condition: match[3] || undefined,
                  fn: match[4],
                },
              ]);
              setTrig("");
            }}
          >
            <input
              className="w-full bg-code-bg border border-border rounded px-2 py-1 font-mono text-[.68rem] text-txt"
              placeholder="before insert: fn_name"
              value={trig}
              onChange={(e) => setTrig(e.target.value)}
            />
          </form>
        )}
      </section>
      <section>
        <h4 className="font-mono text-[.68rem] uppercase text-txt-dim mb-1">RLS policies</h4>
        {table.policies.map((p, i) => (
          <div key={`${p.command}-${i}`} className="flex items-start gap-1 font-mono text-[.68rem] mb-1">
            <span className="flex-1 text-txt-muted">
              {p.command}
              {p.role ? ` to ${p.role}` : ""}: {p.using ?? ""}
              {p.check ? ` check ${p.check}` : ""}
            </span>
            {!readOnly && (
              <button
                type="button"
                className="bg-transparent border-none text-txt-dim cursor-pointer"
                onClick={() =>
                  useDesignerStore.getState().setPolicies(
                    table.name,
                    table.policies.filter((_, j) => j !== i),
                  )
                }
              >
                ×
              </button>
            )}
          </div>
        ))}
        {!readOnly && (
          <input
            className="w-full bg-code-bg border border-border rounded px-2 py-1 font-mono text-[.68rem] text-txt"
            placeholder="select to authenticated: expr"
            value={pol}
            onChange={(e) => setPol(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              const raw = pol.trim();
              const match = raw.match(/^(select|insert|update|delete|all)(?:\s+to\s+(\S+))?\s*:\s*(.*)$/i);
              if (!match) return;
              let rest = match[3].trim();
              if (rest.toLowerCase().startsWith("using ")) rest = rest.slice(6).trim();
              let using: string | undefined;
              let check: string | undefined;
              if (/^check\s+/i.test(rest)) check = rest.replace(/^check\s+/i, "");
              else {
                const split = rest.match(/^(.*?)\s+check\s+(.*)$/i);
                if (split) {
                  using = split[1];
                  check = split[2];
                } else using = rest;
              }
              useDesignerStore.getState().setPolicies(table.name, [
                ...table.policies,
                {
                  command: match[1].toLowerCase() as "select" | "insert" | "update" | "delete" | "all",
                  role: match[2],
                  using,
                  check,
                },
              ]);
              setPol("");
            }}
          />
        )}
      </section>
    </div>
  );
}

function RelationInspector({ relKey, readOnly }: { relKey: string; readOnly: boolean }) {
  const rel = useDesignerStore((s) => s.schema?.relations.find((r) => relationKey(r) === relKey));
  const stubbed = useDesignerStore((s) => {
    if (!s.activeStageId) return false;
    const resolved = resolvedFor(s.layoutDoc, s.manifest, s.activeStageId);
    return !!resolved.edges[relKey]?.stub;
  });
  if (!rel) return <p className="text-txt-dim text-[.8rem]">Relation not found.</p>;
  return (
    <div className="flex flex-col gap-2">
      <h3 className="font-mono text-[.8rem]">{relKey}</h3>
      <label className="text-[.75rem] text-txt-dim">
        Cardinality
        <select
          disabled={readOnly}
          className={cn("ml-2 bg-code-bg border border-border rounded px-1 py-0.5 text-txt")}
          value={rel.cardinality}
          onChange={(e) =>
            useDesignerStore.getState().setRelationCardinality(relKey, e.target.value as "n:1" | "1:1")
          }
        >
          <option value="n:1">n:1</option>
          <option value="1:1">1:1</option>
        </select>
      </label>
      <label className="flex items-center gap-2 text-[.75rem] text-txt-dim">
        <input
          type="checkbox"
          disabled={readOnly}
          checked={stubbed}
          onChange={(e) => useDesignerStore.getState().setEdgeLayout(relKey, { stub: e.target.checked })}
        />
        Pin as tag (hide line)
      </label>
      <button
        type="button"
        className="font-mono text-[.7rem] text-accent-purple border border-border rounded px-2 py-1 bg-transparent cursor-pointer"
        onClick={() => useDesignerStore.getState().focusTable(rel.dst.table)}
      >
        Go to {rel.dst.table}
      </button>
      {!readOnly && (
        <button
          type="button"
          className="font-mono text-[.7rem] border border-accent-red/40 text-accent-red rounded px-2 py-1 bg-transparent cursor-pointer"
          onClick={() => useDesignerStore.getState().removeRelation(relKey)}
        >
          Delete relation
        </button>
      )}
    </div>
  );
}

function FunctionInspector({ name, readOnly }: { name: string; readOnly: boolean }) {
  const fn = useDesignerStore((s) => s.schema?.functions.find((f) => f.name === name));
  const tables = useDesignerStore((s) => s.schema?.tables ?? []);
  if (!fn) return <p className="text-txt-dim text-[.8rem]">Function not found.</p>;
  return (
    <div className="flex flex-col gap-2">
      <h3 className="font-mono text-[.85rem] text-accent-pink">fn {fn.name}</h3>
      <p className="font-mono text-[.7rem] text-txt-dim">{fn.doc}</p>
      <label className="text-[.75rem] text-txt-dim">
        Security
        <select
          disabled={readOnly}
          className="ml-2 bg-code-bg border border-border rounded px-1 py-0.5 text-txt"
          value={fn.security ?? "invoker"}
          onChange={(e) =>
            useDesignerStore.getState().upsertFunction({
              ...fn,
              security: e.target.value as "definer" | "invoker",
            })
          }
        >
          <option value="invoker">invoker</option>
          <option value="definer">definer</option>
        </select>
      </label>
      <div>
        <h4 className="font-mono text-[.68rem] uppercase text-txt-dim mb-1">Touches</h4>
        {tables.map((t) => (
          <label key={t.name} className="flex items-center gap-1 font-mono text-[.72rem]">
            <input
              type="checkbox"
              disabled={readOnly}
              checked={fn.touches.includes(t.name)}
              onChange={(e) => {
                const touches = e.target.checked
                  ? [...fn.touches, t.name]
                  : fn.touches.filter((x) => x !== t.name);
                useDesignerStore.getState().upsertFunction({ ...fn, touches });
              }}
            />
            {t.name}
          </label>
        ))}
      </div>
      {!readOnly && (
        <button
          type="button"
          className="font-mono text-[.7rem] border border-accent-red/40 text-accent-red rounded px-2 py-1 bg-transparent cursor-pointer"
          onClick={() => useDesignerStore.getState().removeFunction(fn.name)}
        >
          Delete function
        </button>
      )}
    </div>
  );
}
