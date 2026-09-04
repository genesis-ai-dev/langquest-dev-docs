import { cn } from "../../cn";
import { diffFor, useDesignerStore } from "../state/store";
import { kindBadge } from "./diffStyles";

export function MigrationPanel() {
  const open = useDesignerStore((s) => s.migrationOpen);
  const viewMode = useDesignerStore((s) => s.viewMode);
  const schema = useDesignerStore((s) => s.schema);
  const prevSchema = useDesignerStore((s) => s.prevSchema);
  const compareSchema = useDesignerStore((s) => s.compareSchema);
  const diff = diffFor({ schema, prevSchema, compareSchema, viewMode });

  if (viewMode !== "diff" || !open || !diff) return null;

  const rows: { kind: string; path: string; detail: string; select?: () => void }[] = [];
  for (const t of diff.tables) {
    rows.push({
      kind: t.kind,
      path: t.name,
      detail: t.renamedFrom ? `was ${t.renamedFrom}` : t.changes.map((c) => `${c.property} ${c.from} → ${c.to}`).join(", "),
      select: () =>
        useDesignerStore.getState().setSelected({
          kind: t.kind === "removed" ? "ghost" : "table",
          key: t.kind === "removed" ? `ghost:${t.name}` : t.name,
        }),
    });
    for (const f of t.fields) {
      rows.push({
        kind: f.kind,
        path: `${t.name}.${f.name}`,
        detail: f.changes.map((c) => `${c.property} ${c.from} → ${c.to}`).join(", "),
      });
    }
    for (const tr of t.triggers) rows.push({ kind: tr.kind, path: `${t.name} trigger`, detail: tr.name });
    for (const p of t.policies) rows.push({ kind: p.kind, path: `${t.name} policy`, detail: p.name });
  }
  for (const r of diff.relations) {
    rows.push({
      kind: r.kind,
      path: r.name,
      detail: r.changes.map((c) => `${c.property} ${c.from} → ${c.to}`).join(", "),
      select: () => useDesignerStore.getState().setSelected({ kind: "relation", key: r.name }),
    });
  }
  for (const e of diff.enums) rows.push({ kind: e.kind, path: e.name, detail: e.changes.map((c) => `${c.property}`).join(", ") });
  for (const f of diff.functions) {
    rows.push({
      kind: f.kind,
      path: `rpc.${f.name}`,
      detail: "",
      select: () => useDesignerStore.getState().setSelected({ kind: "function", key: f.name }),
    });
  }

  return (
    <div className="shrink-0 border-t border-border bg-panel max-h-40 overflow-auto">
      <div className="flex items-center justify-between px-3 py-1">
        <span className="font-mono text-[.62rem] uppercase tracking-[.1em] text-txt-dim">
          Migration
        </span>
        <button
          type="button"
          className="bg-transparent border-none text-txt-dim text-[.7rem] cursor-pointer"
          onClick={() => useDesignerStore.getState().setMigrationOpen(false)}
        >
          hide
        </button>
      </div>
      {rows.length === 0 && (
        <p className="px-3 pb-2 text-[.75rem] text-txt-dim">No changes from the previous stage.</p>
      )}
      {rows.map((row, i) => (
        <button
          key={`${row.path}-${i}`}
          type="button"
          onClick={row.select}
          className={cn(
            "flex w-full gap-2 text-left px-3 py-0.5 font-mono text-[.68rem] bg-transparent border-none cursor-pointer hover:bg-code-bg",
            row.kind === "added" && "text-accent-green",
            row.kind === "removed" && "text-accent-red",
            row.kind === "modified" && "text-accent-amber",
            row.kind === "renamed" && "text-accent-blue",
          )}
        >
          <span className="w-4">{kindBadge(row.kind as "added")}</span>
          <span>{row.path}</span>
          {row.detail && <span className="text-txt-dim truncate">{row.detail}</span>}
        </button>
      ))}
    </div>
  );
}
