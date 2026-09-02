import { HeaderButton } from "../../components/Header";
import { useDesignerStore, useSaveSummary } from "../state/store";

export function DesignerToolbar() {
  const status = useSaveSummary();
  const readOnly = useDesignerStore((s) => s.readOnly);
  const editorOpen = useDesignerStore((s) => s.editorOpen);
  const inspectorOpen = useDesignerStore((s) => s.inspectorOpen);
  const conflictPaths = useDesignerStore((s) => s.conflictPaths);

  const label =
    status === "saved"
      ? "Saved"
      : status === "saving"
        ? "Saving…"
        : status === "dirty"
          ? "Unsaved"
          : status === "conflict"
            ? "Conflict"
            : "Save error";

  return (
    <>
      <span
        className={
          status === "conflict" || status === "error"
            ? "font-mono text-[.68rem] text-accent-red self-center"
            : status === "dirty"
              ? "font-mono text-[.68rem] text-accent-amber self-center"
              : "font-mono text-[.68rem] text-txt-dim self-center"
        }
      >
        {readOnly ? "Read-only" : label}
      </span>
      {conflictPaths.map((path) => (
        <span key={path} className="flex items-center gap-1">
          <HeaderButton onClick={() => void useDesignerStore.getState().reloadFromDisk(path)}>
            Reload
          </HeaderButton>
          <HeaderButton onClick={() => void useDesignerStore.getState().keepMine(path)}>
            Keep mine
          </HeaderButton>
        </span>
      ))}
      {!readOnly && (
        <>
          <HeaderButton onClick={() => useDesignerStore.getState().addTableAt()}>+ Table</HeaderButton>
          <HeaderButton onClick={() => useDesignerStore.getState().undo()}>Undo</HeaderButton>
          <HeaderButton onClick={() => useDesignerStore.getState().redo()}>Redo</HeaderButton>
        </>
      )}
      <HeaderButton
        active={editorOpen}
        onClick={() => useDesignerStore.getState().setEditorOpen(!editorOpen)}
      >
        AML
      </HeaderButton>
      <HeaderButton
        active={inspectorOpen}
        onClick={() => useDesignerStore.getState().setInspectorOpen(!inspectorOpen)}
      >
        Inspector
      </HeaderButton>
    </>
  );
}
