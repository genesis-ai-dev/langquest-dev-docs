import { useEffect, useState } from "react";
import { cn } from "../../cn";
import { useDesignerStore } from "../state/store";

export function BorrowTablesDialog({ onClose }: { onClose: () => void }) {
  const manifest = useDesignerStore((s) => s.manifest);
  const active = useDesignerStore((s) => s.activeStageId);
  const tables = useDesignerStore((s) => s.schema?.tables);
  const have = new Set((tables ?? []).map((t) => t.name));
  const others = manifest.stages.filter((s) => s.id !== active);
  const [fromId, setFromId] = useState(others[0]?.id ?? "");
  const [names, setNames] = useState<string[]>([]);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!fromId) return;
    let cancelled = false;
    void useDesignerStore.getState().listStageTables(fromId).then((tables) => {
      if (cancelled) return;
      setNames(tables);
      setPicked(new Set());
    });
    return () => {
      cancelled = true;
    };
  }, [fromId]);

  const available = names.filter((n) => !have.has(n));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="w-[420px] max-h-[70vh] flex flex-col bg-card border border-border-hi rounded-lg shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-3 py-2 border-b border-border font-mono text-[.75rem] uppercase text-txt-dim">
          Borrow tables
        </div>
        <div className="p-3 flex flex-col gap-2 min-h-0 overflow-auto">
          <label className="font-mono text-[.7rem] text-txt-dim">
            From stage
            <select
              className="ml-2 bg-code-bg border border-border rounded px-1 py-0.5 text-txt"
              value={fromId}
              onChange={(e) => setFromId(e.target.value)}
            >
              {others.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.id.slice(0, 2)} {s.title}
                </option>
              ))}
            </select>
          </label>
          {available.length === 0 ? (
            <p className="font-mono text-[.72rem] text-txt-dim">
              {names.length === 0
                ? "That stage has no tables."
                : "Every table from that stage is already here."}
            </p>
          ) : (
            <ul className="flex flex-col gap-1">
              {available.map((name) => (
                <label key={name} className="flex items-center gap-2 font-mono text-[.75rem] text-txt">
                  <input
                    type="checkbox"
                    checked={picked.has(name)}
                    onChange={() => {
                      setPicked((cur) => {
                        const next = new Set(cur);
                        if (next.has(name)) next.delete(name);
                        else next.add(name);
                        return next;
                      });
                    }}
                  />
                  {name}
                </label>
              ))}
            </ul>
          )}
        </div>
        <div className="px-3 py-2 border-t border-border flex items-center gap-2">
          <button
            type="button"
            className="font-mono text-[.68rem] bg-transparent border-none text-txt-dim cursor-pointer"
            onClick={() => setPicked(new Set(available))}
          >
            Select all
          </button>
          <div className="flex-1" />
          <button
            type="button"
            className="font-mono text-[.68rem] bg-transparent border-none text-txt-dim cursor-pointer"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={picked.size === 0 || loading}
            className={cn(
              "font-mono text-[.68rem] px-2 py-1 rounded-md border cursor-pointer",
              picked.size > 0
                ? "border-accent-purple text-accent-purple bg-accent-purple/10"
                : "border-border text-txt-dim bg-transparent",
            )}
            onClick={async () => {
              setLoading(true);
              await useDesignerStore.getState().borrowTables(fromId, [...picked]);
              onClose();
            }}
          >
            Borrow {picked.size || ""}
          </button>
        </div>
      </div>
    </div>
  );
}
