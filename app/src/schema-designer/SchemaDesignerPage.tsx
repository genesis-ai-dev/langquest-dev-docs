import { useEffect } from "react";
import { Header } from "../components/Header";
import { AmlEditorPane } from "./components/AmlEditorPane";
import { CanvasHost } from "./components/CanvasHost";
import { CompareView } from "./components/CompareView";
import { DesignerToolbar } from "./components/DesignerToolbar";
import { InspectorPanel } from "./components/InspectorPanel";
import { MigrationPanel } from "./components/MigrationPanel";
import { StageTimeline } from "./components/StageTimeline";
import { useDesignerStore } from "./state/store";

function isEditingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (el.isContentEditable) return true;
  return !!el.closest(".monaco-editor");
}

export function SchemaDesignerPage() {
  const loaded = useDesignerStore((s) => s.loaded);
  const loadError = useDesignerStore((s) => s.loadError);
  const viewMode = useDesignerStore((s) => s.viewMode);
  const activeStageId = useDesignerStore((s) => s.activeStageId);
  const schema = useDesignerStore((s) => s.schema);
  const migrationOpen = useDesignerStore((s) => s.migrationOpen);

  useEffect(() => {
    void useDesignerStore.getState().loadProject();
    return useDesignerStore.getState().startPolling();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isEditingTarget(e.target)) return;
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) useDesignerStore.getState().redo();
        else useDesignerStore.getState().undo();
        return;
      }
      if (e.key === "Escape") {
        useDesignerStore.getState().setSelected(null);
        return;
      }
      if (e.key === "Backspace" || e.key === "Delete") {
        e.preventDefault();
        useDesignerStore.getState().deleteSelection();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <Header
        title="Schema Designer"
        subtitle="AML · staged evolution"
        currentHash="#designer"
        actions={<DesignerToolbar />}
      />
      <StageTimeline />
      {!loaded ? (
        <div className="flex-1 flex items-center justify-center font-mono text-[.8rem] text-txt-dim">
          Loading schema docs…
        </div>
      ) : loadError ? (
        <div className="flex-1 flex items-center justify-center font-mono text-[.8rem] text-accent-red px-6 text-center">
          {loadError}
        </div>
      ) : !schema ? (
        <div className="flex-1 flex items-center justify-center font-mono text-[.8rem] text-txt-dim">
          No schema yet. Add a table or write AML in the editor.
        </div>
      ) : viewMode === "compare" ? (
        <CompareView />
      ) : (
        <>
          <div className="flex-1 min-h-0 flex">
            <AmlEditorPane />
            <CanvasHost fitKey={activeStageId ?? "none"} />
            <InspectorPanel />
          </div>
          {viewMode === "diff" && !migrationOpen && (
            <button
              type="button"
              className="shrink-0 border-t border-border bg-panel font-mono text-[.62rem] uppercase text-txt-dim px-3 py-1 cursor-pointer"
              onClick={() => useDesignerStore.getState().setMigrationOpen(true)}
            >
              Show migration
            </button>
          )}
          <MigrationPanel />
        </>
      )}
    </div>
  );
}
