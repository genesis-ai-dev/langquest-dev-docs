import { create } from "zustand";
import { temporal } from "zundo";
import { generateSchema, parseSchema, type AmlError } from "../aml";
import { computeDiff } from "../diff/compute";
import type { StageDiff } from "../diff/types";
import {
  addField,
  addRelation,
  addTable,
  canRename,
  canRenameField,
  moveField,
  renameTable as renameTableOp,
  removeEnum,
  removeField,
  removeFunction,
  removeRelation,
  removeTable,
  setPolicies,
  setRelationCardinality,
  setTableDoc,
  setTableRlsEnabled,
  setTriggers,
  stripRenamedFrom,
  updateField,
  upsertEnum,
  upsertFunction,
} from "../domain/operations";
import { emptyManifest, nextStageId, type StageManifest, type StageMeta, type StageStatus } from "../domain/project";
import type { Cardinality, DbFunction, EnumType, Policy, Schema, Trigger } from "../domain/types";
import { emptySchema, functionNodeKey } from "../domain/types";
import { ensurePlaced, resolveLayout, withEdgeLayout, withEdgesStubbed, withNodeCollapsed, withNodePosition } from "../layout/resolve";
import { emptyLayoutDoc, type EdgeLayout, type LayoutDoc, type ResolvedLayout, type XY } from "../layout/types";
import {
  ConflictError,
  deleteFile,
  listFiles,
  loadBundled,
  readFile,
  writeFile,
  type SaveStatus,
} from "../persistence/client";

export type ViewMode = "edit" | "diff" | "compare";
export type EditSource = "editor" | "model" | "file";

export type Selection =
  | { kind: "table"; key: string }
  | { kind: "field"; key: string }
  | { kind: "relation"; key: string }
  | { kind: "function"; key: string }
  | { kind: "enum"; key: string }
  | { kind: "ghost"; key: string };

export interface DesignerState {
  manifest: StageManifest;
  activeStageId: string | null;
  viewMode: ViewMode;
  compareWith: string | null;
  compareSchema: Schema | null;
  readOnly: boolean;
  loaded: boolean;
  loadError: string | null;

  amlText: string;
  schema: Schema | null;
  parseErrors: AmlError[];
  prevSchema: Schema | null;
  textVersion: number;
  lastEditSource: EditSource;
  parsePending: boolean;

  layoutDoc: LayoutDoc;
  selected: Selection | null;
  focusRequest: { nodeId: string; nonce: number } | null;

  saveStatuses: Record<string, SaveStatus>;
  lastWriteMtimes: Record<string, number>;
  pending: Record<string, string>;
  conflictPaths: string[];

  editorOpen: boolean;
  inspectorOpen: boolean;
  migrationOpen: boolean;

  loadProject: () => Promise<void>;
  setAmlTextFromEditor: (text: string) => void;
  applySchema: (fn: (schema: Schema) => Schema) => void;
  addTableAt: (pos?: XY) => void;
  renameTable: (oldName: string, nextName: string) => boolean;
  removeTable: (name: string) => void;
  setTableDoc: (name: string, doc: string) => void;
  setTableRlsEnabled: (name: string, enabled: boolean) => void;
  setTriggers: (table: string, triggers: Trigger[]) => void;
  setPolicies: (table: string, policies: Policy[]) => void;
  addField: (table: string) => void;
  updateField: (
    table: string,
    field: string,
    patch: { name?: string; type?: string; nullable?: boolean; pk?: boolean; doc?: string },
  ) => boolean;
  removeField: (table: string, field: string) => void;
  moveField: (table: string, field: string, direction: -1 | 1) => void;
  addRelation: (
    src: { table: string; field: string },
    dst: { table: string; field: string },
  ) => void;
  removeRelation: (key: string) => void;
  setRelationCardinality: (key: string, cardinality: Cardinality) => void;
  upsertFunction: (fn: DbFunction) => void;
  removeFunction: (name: string) => void;
  upsertEnum: (en: EnumType) => void;
  removeEnum: (name: string) => void;

  moveNode: (nodeKey: string, pos: XY) => void;
  setNodeCollapsed: (nodeKey: string, collapsed: boolean) => void;
  setEdgeLayout: (edgeKey: string, patch: EdgeLayout) => void;
  setEdgesStubbed: (edgeKeys: string[], stub: boolean) => void;
  focusTable: (name: string) => void;

  activateStage: (id: string) => Promise<void>;
  createStage: (title: string, description?: string) => Promise<void>;
  deleteStage: (id: string) => Promise<void>;
  renameStage: (id: string, title: string, description?: string) => Promise<void>;
  setStageStatus: (id: string, status: StageStatus) => Promise<void>;
  reorderStage: (id: string, direction: -1 | 1) => Promise<void>;
  setViewMode: (mode: ViewMode) => Promise<void>;
  setCompareWith: (id: string | null) => Promise<void>;

  setSelected: (sel: Selection | null) => void;
  deleteSelection: () => void;
  undo: () => void;
  redo: () => void;

  setEditorOpen: (open: boolean) => void;
  setInspectorOpen: (open: boolean) => void;
  setMigrationOpen: (open: boolean) => void;

  keepMine: (path: string) => Promise<void>;
  reloadFromDisk: (path: string) => Promise<void>;
  startPolling: () => () => void;
}

const LAYOUT_PATH = "layout.json";
const MANIFEST_PATH = "stages.json";
const PARSE_MS = 300;
const SAVE_MS = 1000;

const saveTimers = new Map<string, ReturnType<typeof setTimeout>>();
let parseTimer: ReturnType<typeof setTimeout> | undefined;

function panelFlag(key: string, fallback: boolean): boolean {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return fallback;
    return raw === "1";
  } catch {
    return fallback;
  }
}

function setPanelFlag(key: string, open: boolean) {
  try {
    localStorage.setItem(key, open ? "1" : "0");
  } catch {
    /* ignore */
  }
}

function stageOrder(manifest: StageManifest): string[] {
  return manifest.stages.map((s) => s.id);
}

function activeMeta(state: { manifest: StageManifest; activeStageId: string | null }): StageMeta | undefined {
  return state.manifest.stages.find((s) => s.id === state.activeStageId);
}

function previousId(manifest: StageManifest, id: string | null): string | null {
  const i = manifest.stages.findIndex((s) => s.id === id);
  return i > 0 ? manifest.stages[i - 1].id : null;
}

function nodeKeysOf(schema: Schema | null): string[] {
  if (!schema) return [];
  return [
    ...schema.tables.map((t) => t.name),
    ...schema.functions.map((f) => functionNodeKey(f.name)),
  ];
}

function parseManifest(text: string): StageManifest {
  const parsed = JSON.parse(text) as StageManifest;
  if (!parsed?.stages || !Array.isArray(parsed.stages)) return emptyManifest();
  return { version: 1, stages: parsed.stages };
}

function parseLayout(text: string): LayoutDoc {
  try {
    const parsed = JSON.parse(text) as LayoutDoc;
    if (parsed?.version !== 1) return emptyLayoutDoc();
    return {
      version: 1,
      base: { nodes: parsed.base?.nodes ?? {}, edges: parsed.base?.edges ?? {} },
      stages: parsed.stages ?? {},
    };
  } catch {
    return emptyLayoutDoc();
  }
}

export function resolvedFor(
  layoutDoc: LayoutDoc,
  manifest: StageManifest,
  stageId: string | null,
): ResolvedLayout {
  if (!stageId) return { nodes: {}, edges: {} };
  return resolveLayout(layoutDoc, stageOrder(manifest), stageId);
}

export function diffFor(state: {
  schema: Schema | null;
  prevSchema: Schema | null;
  compareSchema: Schema | null;
  viewMode: ViewMode;
}): StageDiff | null {
  if (!state.schema) return null;
  if (state.viewMode === "compare") {
    if (!state.compareSchema) return null;
    return computeDiff(state.compareSchema, state.schema);
  }
  if (state.viewMode === "diff") return computeDiff(state.prevSchema, state.schema);
  return null;
}

export const useDesignerStore = create<DesignerState>()(
  temporal(
    (set, get) => {
      const mark = (path: string, status: SaveStatus) => {
        set((s) => ({ saveStatuses: { ...s.saveStatuses, [path]: status } }));
      };

      const flushPath = async (path: string, force = false) => {
        const { pending, lastWriteMtimes, readOnly } = get();
        const content = pending[path];
        if (content == null || readOnly) return;
        mark(path, "saving");
        try {
          const mtime = await writeFile(path, content, force ? undefined : lastWriteMtimes[path]);
          set((s) => {
            const nextPending = { ...s.pending };
            if (nextPending[path] === content) delete nextPending[path];
            const conflictPaths = s.conflictPaths.filter((p) => p !== path);
            return {
              pending: nextPending,
              lastWriteMtimes: { ...s.lastWriteMtimes, [path]: mtime },
              saveStatuses: { ...s.saveStatuses, [path]: "saved" },
              conflictPaths,
            };
          });
        } catch (err) {
          if (err instanceof ConflictError) {
            set((s) => ({
              saveStatuses: { ...s.saveStatuses, [path]: "conflict" },
              conflictPaths: s.conflictPaths.includes(path) ? s.conflictPaths : [...s.conflictPaths, path],
            }));
            return;
          }
          mark(path, "error");
        }
      };

      const schedule = (path: string, content: string) => {
        if (get().readOnly) return;
        set((s) => ({
          pending: { ...s.pending, [path]: content },
          saveStatuses: { ...s.saveStatuses, [path]: "dirty" },
        }));
        const prev = saveTimers.get(path);
        if (prev) clearTimeout(prev);
        saveTimers.set(
          path,
          setTimeout(() => {
            saveTimers.delete(path);
            void flushPath(path);
          }, SAVE_MS),
        );
      };

      const applyParsed = (text: string, source: EditSource) => {
        const { schema, errors } = parseSchema(text);
        set((s) => ({
          amlText: text,
          schema: schema ?? s.schema,
          parseErrors: errors,
          textVersion: s.textVersion + 1,
          lastEditSource: source,
          parsePending: false,
        }));
      };

      const applyOp = (fn: (schema: Schema) => Schema) => {
        const { schema, readOnly } = get();
        if (!schema || readOnly) return;
        const next = fn(schema);
        const text = generateSchema(next);
        const meta = activeMeta(get());
        set((s) => ({
          schema: next,
          amlText: text,
          parseErrors: [],
          textVersion: s.textVersion + 1,
          lastEditSource: "model",
        }));
        if (meta) schedule(meta.file, text);
      };

      const saveManifest = (manifest: StageManifest) => {
        set({ manifest });
        schedule(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + "\n");
      };

      const saveLayout = (layoutDoc: LayoutDoc) => {
        set({ layoutDoc });
        schedule(LAYOUT_PATH, JSON.stringify(layoutDoc, null, 2) + "\n");
      };

      const loadStageAml = async (id: string | null, files: Record<string, string>) => {
        if (!id) return { text: "", schema: emptySchema(), errors: [] as AmlError[] };
        const meta = get().manifest.stages.find((s) => s.id === id);
        if (!meta) return { text: "", schema: emptySchema(), errors: [] as AmlError[] };
        let text = files[meta.file];
        if (text == null) {
          const payload = await readFile(meta.file);
          text = payload.content;
          set((s) => ({ lastWriteMtimes: { ...s.lastWriteMtimes, [meta.file]: payload.mtimeMs } }));
        }
        const parsed = parseSchema(text);
        return { text, schema: parsed.schema ?? emptySchema(), errors: parsed.errors };
      };

      const hydrateStage = async (id: string) => {
        const loaded = await loadStageAml(id, {});
        const prevId = previousId(get().manifest, id);
        const prev = prevId ? await loadStageAml(prevId, {}) : { schema: null };
        let layoutDoc = get().layoutDoc;
        layoutDoc = ensurePlaced(layoutDoc, stageOrder(get().manifest), id, nodeKeysOf(loaded.schema));
        if (layoutDoc !== get().layoutDoc) {
          saveLayout(layoutDoc);
        }
        set((s) => ({
          activeStageId: id,
          amlText: loaded.text,
          schema: loaded.schema,
          parseErrors: loaded.errors,
          prevSchema: prev.schema,
          textVersion: s.textVersion + 1,
          lastEditSource: "file",
          selected: null,
        }));
        useDesignerStore.temporal.getState().clear();
      };

      return {
        manifest: emptyManifest(),
        activeStageId: null,
        viewMode: "edit",
        compareWith: null,
        compareSchema: null,
        readOnly: false,
        loaded: false,
        loadError: null,
        amlText: "",
        schema: null,
        parseErrors: [],
        prevSchema: null,
        textVersion: 0,
        lastEditSource: "file",
        parsePending: false,
        layoutDoc: emptyLayoutDoc(),
        selected: null,
        focusRequest: null,
        saveStatuses: {},
        lastWriteMtimes: {},
        pending: {},
        conflictPaths: [],
        editorOpen: panelFlag("lq-designer-editor", true),
        inspectorOpen: panelFlag("lq-designer-inspector", true),
        migrationOpen: panelFlag("lq-designer-migration", true),

        loadProject: async () => {
          try {
            const files = await listFiles();
            const mtimes: Record<string, number> = {};
            for (const f of files) mtimes[f.path] = f.mtimeMs;
            const manifestRaw = await readFile(MANIFEST_PATH);
            const layoutRaw = await readFile(LAYOUT_PATH).catch(() => ({
              content: JSON.stringify(emptyLayoutDoc()),
              mtimeMs: 0,
            }));
            const manifest = parseManifest(manifestRaw.content);
            const layoutDoc = parseLayout(layoutRaw.content);
            mtimes[MANIFEST_PATH] = manifestRaw.mtimeMs;
            if (layoutRaw.mtimeMs) mtimes[LAYOUT_PATH] = layoutRaw.mtimeMs;
            set({
              manifest,
              layoutDoc,
              lastWriteMtimes: mtimes,
              readOnly: false,
              loaded: true,
              loadError: null,
            });
            const first = manifest.stages[0]?.id;
            if (first) await hydrateStage(first);
          } catch {
            try {
              const bundled = await loadBundled();
              const manifest = parseManifest(bundled[MANIFEST_PATH] ?? '{"version":1,"stages":[]}');
              const layoutDoc = parseLayout(bundled[LAYOUT_PATH] ?? "");
              set({
                manifest,
                layoutDoc,
                readOnly: true,
                loaded: true,
                loadError: null,
              });
              const first = manifest.stages[0];
              if (first) {
                const parsed = parseSchema(bundled[first.file] ?? "");
                set((s) => ({
                  activeStageId: first.id,
                  amlText: bundled[first.file] ?? "",
                  schema: parsed.schema,
                  parseErrors: parsed.errors,
                  prevSchema: null,
                  textVersion: s.textVersion + 1,
                  lastEditSource: "file",
                }));
              }
            } catch (err) {
              set({
                loaded: true,
                loadError: err instanceof Error ? err.message : "Failed to load schema docs",
              });
            }
          }
        },

        setAmlTextFromEditor: (text) => {
          if (get().readOnly) return;
          set((s) => ({
            amlText: text,
            textVersion: s.textVersion + 1,
            lastEditSource: "editor",
            parsePending: true,
          }));
          const meta = activeMeta(get());
          if (meta) schedule(meta.file, text);
          if (parseTimer) clearTimeout(parseTimer);
          parseTimer = setTimeout(() => {
            const current = get().amlText;
            applyParsed(current, "editor");
          }, PARSE_MS);
        },

        applySchema: applyOp,

        addTableAt: (pos) => {
          const { schema, activeStageId } = get();
          if (!schema || !activeStageId) return;
          const before = new Set(schema.tables.map((t) => t.name));
          applyOp((s) => addTable(s));
          const created = get().schema?.tables.find((t) => !before.has(t.name));
          if (!created) return;
          const at = pos ?? { x: 80, y: 80 };
          saveLayout(
            withNodePosition(get().layoutDoc, stageOrder(get().manifest), activeStageId, created.name, at),
          );
          set({ selected: { kind: "table", key: created.name } });
        },

        renameTable: (oldName, nextName) => {
          const schema = get().schema;
          if (!schema || !canRename(schema, oldName, nextName)) return false;
          applyOp((s) => renameTableOp(s, oldName, nextName));
          set((s) =>
            s.selected?.kind === "table" && s.selected.key === oldName
              ? { selected: { kind: "table", key: nextName.trim() } }
              : {},
          );
          return true;
        },

        removeTable: (name) => applyOp((s) => removeTable(s, name)),
        setTableDoc: (name, doc) => applyOp((s) => setTableDoc(s, name, doc)),
        setTableRlsEnabled: (name, enabled) => applyOp((s) => setTableRlsEnabled(s, name, enabled)),
        setTriggers: (table, triggers) => applyOp((s) => setTriggers(s, table, triggers)),
        setPolicies: (table, policies) => applyOp((s) => setPolicies(s, table, policies)),
        addField: (table) => applyOp((s) => addField(s, table)),
        updateField: (table, field, patch) => {
          if (patch.name && get().schema && !canRenameField(get().schema!, table, field, patch.name)) {
            return false;
          }
          applyOp((s) => updateField(s, table, field, patch));
          return true;
        },
        removeField: (table, field) => applyOp((s) => removeField(s, table, field)),
        moveField: (table, field, direction) => applyOp((s) => moveField(s, table, field, direction)),
        addRelation: (src, dst) => applyOp((s) => addRelation(s, src, dst)),
        removeRelation: (key) => applyOp((s) => removeRelation(s, key)),
        setRelationCardinality: (key, cardinality) =>
          applyOp((s) => setRelationCardinality(s, key, cardinality)),
        upsertFunction: (fn) => applyOp((s) => upsertFunction(s, fn)),
        removeFunction: (name) => applyOp((s) => removeFunction(s, name)),
        upsertEnum: (en) => applyOp((s) => upsertEnum(s, en)),
        removeEnum: (name) => applyOp((s) => removeEnum(s, name)),

        moveNode: (nodeKey, pos) => {
          const { layoutDoc, manifest, activeStageId, readOnly } = get();
          if (!activeStageId || readOnly) return;
          saveLayout(withNodePosition(layoutDoc, stageOrder(manifest), activeStageId, nodeKey, pos));
        },
        setNodeCollapsed: (nodeKey, collapsed) => {
          const { layoutDoc, manifest, activeStageId, readOnly } = get();
          if (!activeStageId || readOnly) return;
          saveLayout(withNodeCollapsed(layoutDoc, stageOrder(manifest), activeStageId, nodeKey, collapsed));
        },
        setEdgeLayout: (edgeKey, patch) => {
          const { layoutDoc, manifest, activeStageId, readOnly } = get();
          if (!activeStageId || readOnly) return;
          saveLayout(withEdgeLayout(layoutDoc, stageOrder(manifest), activeStageId, edgeKey, patch));
        },
        setEdgesStubbed: (edgeKeys, stub) => {
          const { layoutDoc, manifest, activeStageId, readOnly } = get();
          if (!activeStageId || readOnly || edgeKeys.length === 0) return;
          saveLayout(withEdgesStubbed(layoutDoc, stageOrder(manifest), activeStageId, edgeKeys, stub));
        },
        focusTable: (name) => {
          get().setInspectorOpen(true);
          set({
            selected: { kind: "table", key: name },
            focusRequest: { nodeId: name, nonce: Date.now() },
          });
        },

        activateStage: async (id) => {
          if (id === get().activeStageId) return;
          const pending = Object.keys(get().pending);
          await Promise.all(pending.map((p) => flushPath(p)));
          useDesignerStore.temporal.getState().pause();
          await hydrateStage(id);
          useDesignerStore.temporal.getState().resume();
        },

        createStage: async (title, description = "") => {
          const { schema, manifest, readOnly } = get();
          if (!schema || readOnly) return;
          const { id, file } = nextStageId(manifest.stages, title);
          const text = generateSchema(stripRenamedFrom(schema));
          const mtime = await writeFile(file, text);
          const nextManifest: StageManifest = {
            ...manifest,
            stages: [
              ...manifest.stages,
              { id, file, title, description, status: "planned" },
            ],
          };
          set((s) => ({ lastWriteMtimes: { ...s.lastWriteMtimes, [file]: mtime } }));
          saveManifest(nextManifest);
          await get().activateStage(id);
        },

        deleteStage: async (id) => {
          const { manifest, readOnly } = get();
          if (readOnly || manifest.stages.length <= 1) return;
          const i = manifest.stages.findIndex((s) => s.id === id);
          if (i < 0) return;
          const [removed] = manifest.stages.slice(i, i + 1);
          const nextStages = manifest.stages.filter((s) => s.id !== id);
          try {
            await deleteFile(removed.file);
          } catch {
            /* keep going */
          }
          saveManifest({ ...manifest, stages: nextStages });
          const nextId = nextStages[Math.max(0, i - 1)]?.id;
          if (nextId) await get().activateStage(nextId);
        },

        renameStage: async (id, title, description) => {
          const { manifest } = get();
          saveManifest({
            ...manifest,
            stages: manifest.stages.map((s) =>
              s.id === id ? { ...s, title, description: description ?? s.description } : s,
            ),
          });
        },

        setStageStatus: async (id, status) => {
          const { manifest } = get();
          saveManifest({
            ...manifest,
            stages: manifest.stages.map((s) => (s.id === id ? { ...s, status } : s)),
          });
        },

        reorderStage: async (id, direction) => {
          const { manifest } = get();
          const i = manifest.stages.findIndex((s) => s.id === id);
          const j = i + direction;
          if (i < 0 || j < 0 || j >= manifest.stages.length) return;
          const stages = [...manifest.stages];
          const [item] = stages.splice(i, 1);
          stages.splice(j, 0, item);
          saveManifest({ ...manifest, stages });
        },

        setViewMode: async (mode) => {
          set({ viewMode: mode });
          if (mode === "compare") {
            const { manifest, activeStageId, compareWith } = get();
            const other = compareWith ?? previousId(manifest, activeStageId) ?? manifest.stages[0]?.id ?? null;
            if (other) await get().setCompareWith(other);
          }
        },

        setCompareWith: async (id) => {
          set({ compareWith: id });
          if (!id) {
            set({ compareSchema: null });
            return;
          }
          const loaded = await loadStageAml(id, {});
          set({ compareSchema: loaded.schema });
        },

        setSelected: (sel) => {
          const cur = get().selected;
          if (cur?.kind === sel?.kind && cur?.key === sel?.key) return;
          set({ selected: sel });
        },

        deleteSelection: () => {
          const { selected, readOnly } = get();
          if (!selected || readOnly) return;
          if (selected.kind === "table") applyOp((s) => removeTable(s, selected.key));
          else if (selected.kind === "function") applyOp((s) => removeFunction(s, selected.key));
          else if (selected.kind === "enum") applyOp((s) => removeEnum(s, selected.key));
          else if (selected.kind === "relation") applyOp((s) => removeRelation(s, selected.key));
          else if (selected.kind === "field") {
            const [table, field] = selected.key.split(".");
            if (table && field) applyOp((s) => removeField(s, table, field));
          }
          set({ selected: null });
        },

        undo: () => {
          useDesignerStore.temporal.getState().undo();
          const { amlText } = get();
          applyParsed(amlText, "model");
        },
        redo: () => {
          useDesignerStore.temporal.getState().redo();
          const { amlText } = get();
          applyParsed(amlText, "model");
        },

        setEditorOpen: (open) => {
          setPanelFlag("lq-designer-editor", open);
          set({ editorOpen: open });
        },
        setInspectorOpen: (open) => {
          setPanelFlag("lq-designer-inspector", open);
          set({ inspectorOpen: open });
        },
        setMigrationOpen: (open) => {
          setPanelFlag("lq-designer-migration", open);
          set({ migrationOpen: open });
        },

        keepMine: async (path) => {
          await flushPath(path, true);
        },

        reloadFromDisk: async (path) => {
          const payload = await readFile(path);
          set((s) => ({
            lastWriteMtimes: { ...s.lastWriteMtimes, [path]: payload.mtimeMs },
            conflictPaths: s.conflictPaths.filter((p) => p !== path),
            saveStatuses: { ...s.saveStatuses, [path]: "saved" },
            pending: Object.fromEntries(Object.entries(s.pending).filter(([k]) => k !== path)),
          }));
          if (path === MANIFEST_PATH) {
            set({ manifest: parseManifest(payload.content) });
            return;
          }
          if (path === LAYOUT_PATH) {
            set({ layoutDoc: parseLayout(payload.content) });
            useDesignerStore.temporal.getState().clear();
            return;
          }
          const meta = activeMeta(get());
          if (meta && meta.file === path) {
            applyParsed(payload.content, "file");
            useDesignerStore.temporal.getState().clear();
          }
        },

        startPolling: () => {
          let cancelled = false;
          const tick = async () => {
            if (cancelled || get().readOnly || document.hidden) return;
            try {
              const files = await listFiles();
              const { lastWriteMtimes, pending } = get();
              for (const file of files) {
                const last = lastWriteMtimes[file.path];
                if (last == null) continue;
                if (file.mtimeMs <= last + 1) continue;
                if (pending[file.path]) {
                  set((s) => ({
                    saveStatuses: { ...s.saveStatuses, [file.path]: "conflict" },
                    conflictPaths: s.conflictPaths.includes(file.path)
                      ? s.conflictPaths
                      : [...s.conflictPaths, file.path],
                  }));
                } else {
                  await get().reloadFromDisk(file.path);
                }
              }
            } catch {
              /* API gone — stay on current state */
            }
          };
          const id = setInterval(() => void tick(), 2000);
          return () => {
            cancelled = true;
            clearInterval(id);
          };
        },
      };
    },
    {
      partialize: (state) => ({
        amlText: state.amlText,
        layoutDoc: state.layoutDoc,
      }),
      equality: (a, b) => a.amlText === b.amlText && a.layoutDoc === b.layoutDoc,
      limit: 100,
    },
  ),
);

export function useSaveSummary(): SaveStatus {
  return useDesignerStore((s) => {
    const statuses = Object.values(s.saveStatuses);
    if (statuses.includes("conflict")) return "conflict";
    if (statuses.includes("error")) return "error";
    if (statuses.includes("saving")) return "saving";
    if (statuses.includes("dirty")) return "dirty";
    return "saved";
  });
}
