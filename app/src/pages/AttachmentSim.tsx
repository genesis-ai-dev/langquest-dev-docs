import { useEffect, useRef, useState } from "react";
import { Header, HeaderButton } from "../components/Header";
import { cn } from "../cn";

/**
 * Side-by-side simulation of the OLD PowerSync attachment queue vs the NEW
 * domain-driven audio sync (AudioUploader / AudioDownloader / LocalFileIndex).
 *
 * Both systems receive the same event at the same time. Each event expands
 * into the sequence of real function calls that system performs, with costs
 * derived from the record counts. Stage duration is proportional to
 * log(work), so the old system's O(n²) reconcile loops and per-file disk
 * stats visibly grind while the new system's index seek + Set lookups flash
 * past.
 *
 * The mutable simulation state lives in a module-level object (SIM); React
 * renders an immutable snapshot taken once per animation frame.
 */

// ---------------------------------------------------------------------------
// Cost model
// ---------------------------------------------------------------------------

interface Counters {
  queries: number; // SQL statements issued
  rows: number; // rows scanned / materialized
  compares: number; // JS comparisons (Array.find loops)
  disk: number; // file system operations (stat / write / move / list)
  writes: number; // DB writes (INSERT / UPDATE)
  net: number; // network transfers attempted
  set: number; // in-memory Set/Map operations
}

const ZERO: Counters = {
  queries: 0,
  rows: 0,
  compares: 0,
  disk: 0,
  writes: 0,
  net: 0,
  set: 0,
};

const COUNTER_META: { key: keyof Counters; label: string; weight: number }[] = [
  { key: "queries", label: "SQL queries", weight: 5 },
  { key: "rows", label: "rows scanned", weight: 1 },
  { key: "compares", label: "JS compares", weight: 0.05 },
  { key: "disk", label: "disk ops", weight: 20 },
  { key: "writes", label: "DB writes", weight: 10 },
  { key: "net", label: "network", weight: 30 },
  { key: "set", label: "Set ops", weight: 0.5 },
];

function addCounters(a: Counters, b: Partial<Counters>, k = 1): Counters {
  return {
    queries: a.queries + (b.queries ?? 0) * k,
    rows: a.rows + (b.rows ?? 0) * k,
    compares: a.compares + (b.compares ?? 0) * k,
    disk: a.disk + (b.disk ?? 0) * k,
    writes: a.writes + (b.writes ?? 0) * k,
    net: a.net + (b.net ?? 0) * k,
    set: a.set + (b.set ?? 0) * k,
  };
}

function workOf(c: Partial<Counters>): number {
  let w = 0;
  for (const m of COUNTER_META) w += (c[m.key] ?? 0) * m.weight;
  return w;
}

/** Duration in ms at 1× speed. Logarithmic so 50k records stays watchable. */
function stageDurMs(stage: Stage): number {
  if (stage.baseMs !== undefined) return stage.baseMs;
  return 240 + 700 * Math.log10(1 + workOf(stage.counters));
}

const compactFmt = new Intl.NumberFormat("en", {
  notation: "compact",
  maximumFractionDigits: 1,
});
const f = (n: number) => compactFmt.format(Math.round(n));

// ---------------------------------------------------------------------------
// World + stages
// ---------------------------------------------------------------------------

interface World {
  /** acl rows with audio_uploaded_at set (uploaded; file usually on device) */
  confirmed: number;
  /** acl rows published but unconfirmed (audio_uploaded_at IS NULL) */
  pendingUp: number;
  /** pre-publish recordings ('local/…' audio values) */
  localRec: number;
  /** confirmed rows whose file is NOT on this device (download work) */
  missing: number;
  online: boolean;
}

/** Rows the old attachments bookkeeping table tracks (≈ every audio file). */
const tableRows = (w: World) => w.confirmed + w.pendingUp + w.localRec;
const filesOnDevice = (w: World) =>
  w.confirmed - w.missing + w.pendingUp + w.localRec;

type OldComp =
  | "watchJoin"
  | "debounce"
  | "watchIds"
  | "attTable"
  | "disk"
  | "transfer";
type NewComp = "acl" | "watch" | "index" | "drain" | "transfer" | "server";

interface Stage {
  comp: string;
  fn: string;
  detail: string;
  counters: Partial<Counters>;
  note?: string;
  /** Fixed duration override (e.g. visualized debounce waits). */
  baseMs?: number;
}

function st(
  comp: OldComp | NewComp,
  fn: string,
  detail: string,
  counters: Partial<Counters> = {},
  extra: { note?: string; baseMs?: number } = {},
): Stage {
  return { comp, fn, detail, counters, ...extra };
}

// ---------------------------------------------------------------------------
// Event builders — each expands to the real call sequence per system
// ---------------------------------------------------------------------------

type EventId =
  | "record"
  | "publish"
  | "syncDown"
  | "tick"
  | "restart"
  | "toggleNet";

interface BuiltEvent {
  id: EventId;
  label: string;
  old: Stage[];
  neu: Stage[];
  apply: (w: World) => World;
}

const SYNC_DOWN_K = 50;

/** One full old-system sweep: join watch → reconcile → per-file disk stats. */
function oldFullSweep(T: number, reason: string): Stage[] {
  return [
    st(
      "watchJoin",
      "db.watch(join) fires",
      `${reason} → re-materialize asset_synced ⨝ acl_synced: ${f(T)} rows`,
      { queries: 1, rows: T },
    ),
    st(
      "debounce",
      "refreshAllAttachments()",
      "debounce 2 s, then onUpdate(all ids)",
      {},
      { baseMs: 800 },
    ),
    st(
      "watchIds",
      "watchAttachmentIds()",
      `SELECT * FROM attachments WHERE state < ARCHIVED → ${f(T)} rows`,
      { queries: 1, rows: T },
    ),
    st(
      "watchIds",
      "reconcile loop",
      `${f(T)} ids × attachmentsInDatabase.find() ≈ ${f((T * T) / 2)} comparisons`,
      { compares: (T * T) / 2 },
    ),
    st(
      "disk",
      `storage.fileExists() × ${f(T)}`,
      "one disk stat per tracked file, every sweep",
      { disk: T },
    ),
  ];
}

function buildEvent(id: EventId, w: World): BuiltEvent {
  const T = tableRows(w);

  switch (id) {
    case "record": {
      const old: Stage[] = [
        st("disk", "saveAudioLocally()", "write recording to shared_attachments/local/", { disk: 1 }),
        st("attTable", "saveToQueue()", "INSERT attachment record (state QUEUED_UPLOAD)", { writes: 1 }, { note: "attachments write re-fires watchers ↻" }),
        ...oldFullSweep(T + 1, "acl + attachments rows changed"),
        w.online
          ? st("transfer", "uploadRecordsWithProgress()", "SELECT COUNT + upload 1 file + UPDATE state=SYNCED", { queries: 2, net: 1, writes: 1 }, { note: "state UPDATE re-fires watchers ↻" })
          : st("transfer", "uploadRecordsWithProgress()", "attempts upload while offline → fails; retried next sweep", { queries: 1, net: 1 }),
      ];
      const neu: Stage[] = [
        st("index", "saveAudioLocally()", "write file + localFileIndex.add('local/…') → emit()", { disk: 1, set: 1 }),
        st("watch", "schedule()", "debounce 2 s (watch + fileIndex listeners coalesce)", {}, { baseMs: 600 }),
        st(
          "drain",
          "drainOnce() → pendingSyncedQuery()",
          `index seek idx_acl_audio_uploaded_at → ${f(w.pendingUp)} pending rows`,
          { queries: 1, rows: w.pendingUp },
        ),
        st("drain", "getWorkList()", "'local/…' values excluded — pre-publish audio never uploads", { set: Math.max(1, w.pendingUp) }),
      ];
      return {
        id,
        label: "🎙 New recording",
        old,
        neu,
        apply: (world) => ({ ...world, localRec: world.localRec + 1 }),
      };
    }

    case "publish": {
      const K = w.localRec;
      const old: Stage[] = [
        st("attTable", `update() × ${f(K)}`, "convert queue records temporary → permanent, state QUEUED_SYNC", { writes: K }),
        ...oldFullSweep(T, "acl rows rewritten by publish"),
        w.online
          ? st("transfer", "uploadRecordsWithProgress()", `upload ${f(K)} files + ${f(K)} state UPDATEs`, { queries: 2, net: K, writes: K }, { note: "every UPDATE re-fires the join watch ↻" })
          : st("transfer", "uploadRecordsWithProgress()", `attempts ${f(K)} uploads offline → all fail; retried next sweep`, { queries: 1, net: K }),
      ];
      const neu: Stage[] = [
        st("index", `promoteLocalAudio() × ${f(K)}`, "moveFile local/→published name + localFileIndex.add()", { disk: K, set: K }),
        st("acl", "publishQuest() transaction", `${f(K)} acl rows now synced, audio_uploaded_at NULL — the rows ARE the work list`, { writes: K }),
        st("watch", "audioUploader.trigger()", "backoffs cleared, schedule(0) — immediate pass", { set: K }),
        st(
          "drain",
          "drainOnce() → pendingSyncedQuery()",
          `index seek → ${f(w.pendingUp + K)} pending rows; getWorkList(): ${f(w.pendingUp + K)} Set lookups`,
          { queries: 1, rows: w.pendingUp + K, set: w.pendingUp + K },
        ),
        ...(w.online
          ? [
              st("transfer", `uploadOne() × ${f(K + w.pendingUp)}`, "4 concurrent; failures get in-memory backoff", { net: K + w.pendingUp }),
              st("server", "storage trigger stamps audio_uploaded_at", "syncs down → rows fall out of the query", { rows: K + w.pendingUp }),
            ]
          : [
              st("drain", "isOnline() → false", "publish pending counts, return — no attempts, no backoff inflation", {}),
            ]),
      ];
      return {
        id,
        label: `📤 Publish quest (${f(K)} recordings)`,
        old,
        neu,
        apply: (world) => {
          if (world.online) {
            return {
              ...world,
              confirmed: world.confirmed + world.localRec + world.pendingUp,
              pendingUp: 0,
              localRec: 0,
            };
          }
          return {
            ...world,
            pendingUp: world.pendingUp + world.localRec,
            localRec: 0,
          };
        },
      };
    }

    case "syncDown": {
      const K = SYNC_DOWN_K;
      const old: Stage[] = [
        st("attTable", "PowerSync sync", `${f(K)} new acl rows (audio_uploaded_at set) arrive from server`, { writes: K }),
        ...oldFullSweep(T + K, `${f(K)} synced rows changed the join`),
        st("attTable", `saveToQueue() × ${f(K)}`, "INSERT queue records (state QUEUED_DOWNLOAD)", { writes: K }, { note: "each INSERT re-fires watchers ↻" }),
        w.online
          ? st("transfer", "downloadRecordsWithProgress()", `download ${f(K)} files + ${f(K)} state UPDATEs`, { net: K, disk: K, writes: K })
          : st("transfer", "downloadRecordsWithProgress()", `attempts ${f(K)} downloads offline → all fail`, { net: K }),
      ];
      const neu: Stage[] = [
        st("acl", "PowerSync sync", `${f(K)} new acl rows (audio_uploaded_at set) arrive from server`, { writes: K }),
        st("watch", "db.watch(confirmedAudioQuery) fires", "schedule() — debounce 500 ms", {}, { baseMs: 500 }),
        st(
          "drain",
          "drainOnce() → confirmedAudioQuery()",
          `scan confirmed rows → ${f(w.confirmed + K)} rows; getWorkList(): Set lookups, ${f(K + w.missing)} missing`,
          { queries: 1, rows: w.confirmed + K, set: w.confirmed + K },
        ),
        ...(w.online
          ? [
              st("transfer", `downloadOne() × ${f(K + w.missing)}`, "25 concurrent; writeFile + localFileIndex.add()", { net: K + w.missing, disk: K + w.missing, set: K + w.missing }),
            ]
          : [
              st("drain", "isOnline() → false", "publish pending counts, return — nothing attempted", {}),
            ]),
      ];
      return {
        id,
        label: `⬇ Sync down ${SYNC_DOWN_K} records`,
        old,
        neu,
        apply: (world) => ({
          ...world,
          confirmed: world.confirmed + K,
          missing: world.online ? 0 : world.missing + K,
        }),
      };
    }

    case "tick": {
      const old: Stage[] = [
        ...oldFullSweep(T, "syncInterval (30 s) — runs even with nothing to do"),
        w.pendingUp > 0 && !w.online
          ? st("transfer", "uploadRecordsWithProgress()", `re-attempts ${f(w.pendingUp)} uploads offline → all fail, again`, { queries: 1, net: w.pendingUp })
          : st("transfer", "uploadRecordsWithProgress()", "SELECT COUNT → nothing queued", { queries: 1 }),
      ];
      const neu: Stage[] = [
        st("watch", "tickTimer (60 s)", "schedule() → drain()", {}, { baseMs: 400 }),
        st(
          "drain",
          "drainOnce() × 2 workers",
          `uploader index seek: ${f(w.pendingUp)} rows · downloader scan: ${f(w.confirmed)} rows + Set lookups`,
          { queries: 2, rows: w.pendingUp + w.confirmed, set: w.confirmed },
        ),
        !w.online && (w.pendingUp > 0 || w.missing > 0)
          ? st("drain", "isOnline() → false", "early return — no attempts, backoff untouched", {})
          : st("drain", "work list empty", "publishWorkStatus() and done", {}),
      ];
      return {
        id,
        label: "⏱ Background tick",
        old,
        neu,
        apply: (world) => world,
      };
    }

    case "restart": {
      const F = filesOnDevice(w);
      const old: Stage[] = [
        st(
          "attTable",
          "init() initial sync",
          `UPDATE state=QUEUED_SYNC in ${f(Math.ceil(T / 500))} batches of 500 (${f(T)} rows)`,
          { queries: Math.ceil(T / 500), rows: T, writes: Math.ceil(T / 500) },
        ),
        ...oldFullSweep(T, "startup watch registration"),
      ];
      const neu: Stage[] = [
        st(
          "index",
          "LocalFileIndex.scan()",
          `2 directory listings → ${f(F)} names into the Set (once per app run)`,
          { disk: 2, set: F },
        ),
        st(
          "drain",
          "start() → drainOnce() × 2 workers",
          `uploader index seek: ${f(w.pendingUp)} rows · downloader scan: ${f(w.confirmed)} rows`,
          { queries: 2, rows: w.pendingUp + w.confirmed, set: w.confirmed },
        ),
      ];
      return {
        id,
        label: "🔄 App restart",
        old,
        neu,
        apply: (world) => world,
      };
    }

    case "toggleNet": {
      if (w.online) {
        return {
          id,
          label: "🔌 Go offline",
          old: [st("transfer", "connection lost", "sweeps + retries keep running on syncInterval regardless", {})],
          neu: [st("watch", "connection lost", "workers keep deriving counts; drainOnce() early-returns", {})],
          apply: (world) => ({ ...world, online: false }),
        };
      }
      const P = w.pendingUp;
      const M = w.missing;
      const old: Stage[] = [
        ...oldFullSweep(tableRows(w), "reconnect trigger()"),
        st("transfer", "upload + download loops", `${f(P)} uploads + ${f(M)} downloads + ${f(P + M)} state UPDATEs`, { net: P + M, disk: M, writes: P + M }, { note: "every UPDATE re-fires the join watch ↻" }),
      ];
      const neu: Stage[] = [
        st("watch", "trigger() × 2 workers", "nextAttemptAt = 0 for all attempts; schedule(0)", { set: P + M }),
        st(
          "drain",
          "drainOnce() × 2 workers",
          `uploader index seek: ${f(P)} rows · downloader scan: ${f(w.confirmed)} rows + Set lookups`,
          { queries: 2, rows: P + w.confirmed, set: w.confirmed },
        ),
        st("transfer", `uploadOne() × ${f(P)} · downloadOne() × ${f(M)}`, "4 / 25 concurrent, straight to Supabase Storage", { net: P + M, disk: M, set: M }),
        st("server", "storage trigger stamps audio_uploaded_at", "confirmations sync down → rows fall out of the query", { rows: P }),
      ];
      return {
        id,
        label: "🔌 Reconnect",
        old,
        neu,
        apply: (world) => ({
          ...world,
          online: true,
          confirmed: world.confirmed + world.pendingUp,
          pendingUp: 0,
          missing: 0,
        }),
      };
    }
  }
}

// ---------------------------------------------------------------------------
// Simulation engine (module-level mutable state; React renders snapshots)
// ---------------------------------------------------------------------------

interface LogEntry {
  key: number;
  fn: string;
  detail: string;
  work: number;
  note?: string;
}

interface SideRun {
  stages: Stage[];
  idx: number;
  progress: number; // 0..1 within current stage
  totals: Counters;
  eventWork: number;
  log: LogEntry[];
}

interface FinishedEvent {
  key: number;
  label: string;
  oldWork: number;
  neuWork: number;
}

interface Sim {
  world: World;
  queue: { key: number; id: EventId; label: string }[];
  current: BuiltEvent | null;
  old: SideRun;
  neu: SideRun;
  finished: FinishedEvent[];
  paused: boolean;
  speed: number;
  keyCounter: number;
}

function freshSide(): SideRun {
  return { stages: [], idx: 0, progress: 0, totals: { ...ZERO }, eventWork: 0, log: [] };
}

function freshSim(confirmed: number, localRec: number, speed = 1): Sim {
  return {
    world: { confirmed, pendingUp: 0, localRec, missing: 0, online: true },
    queue: [],
    current: null,
    old: freshSide(),
    neu: freshSide(),
    finished: [],
    paused: false,
    speed,
    keyCounter: 0,
  };
}

const DEFAULT_CONFIRMED = 20000;
const DEFAULT_LOCAL_REC = 300;

let SIM: Sim = freshSim(DEFAULT_CONFIRMED, DEFAULT_LOCAL_REC);

function sideDone(side: SideRun): boolean {
  return side.idx >= side.stages.length;
}

function tickSide(sim: Sim, side: SideRun, dtMs: number): void {
  const stage = side.stages[side.idx];
  if (!stage) return;
  const dur = stageDurMs(stage);
  side.progress += (dtMs * sim.speed) / dur;
  if (side.progress >= 1) {
    side.totals = addCounters(side.totals, stage.counters);
    side.eventWork += workOf(stage.counters);
    side.log.push({
      key: sim.keyCounter++,
      fn: stage.fn,
      detail: stage.detail,
      work: workOf(stage.counters),
      note: stage.note,
    });
    if (side.log.length > 120) side.log.splice(0, side.log.length - 120);
    side.idx += 1;
    side.progress = 0;
  }
}

function tickSim(sim: Sim, dtMs: number): void {
  if (sim.paused) return;

  if (!sim.current) {
    const next = sim.queue.shift();
    if (!next) return;
    const built = buildEvent(next.id, sim.world);
    sim.current = built;
    sim.old.stages = built.old;
    sim.neu.stages = built.neu;
    sim.old.idx = 0;
    sim.neu.idx = 0;
    sim.old.progress = 0;
    sim.neu.progress = 0;
    sim.old.eventWork = 0;
    sim.neu.eventWork = 0;
    return;
  }

  tickSide(sim, sim.old, dtMs);
  tickSide(sim, sim.neu, dtMs);

  if (sideDone(sim.old) && sideDone(sim.neu)) {
    sim.world = sim.current.apply(sim.world);
    sim.finished.push({
      key: sim.keyCounter++,
      label: sim.current.label,
      oldWork: sim.old.eventWork,
      neuWork: sim.neu.eventWork,
    });
    if (sim.finished.length > 30) sim.finished.splice(0, sim.finished.length - 30);
    sim.current = null;
  }
}

// ---------------------------------------------------------------------------
// Render snapshot (immutable; rebuilt once per frame)
// ---------------------------------------------------------------------------

interface SideSnap {
  activeStage: Stage | null;
  progress: number;
  totals: Counters;
  log: LogEntry[];
}

interface Snap {
  world: World;
  queue: { key: number; label: string }[];
  currentLabel: string | null;
  paused: boolean;
  speed: number;
  old: SideSnap;
  neu: SideSnap;
  finished: FinishedEvent[];
}

function snapshotSide(side: SideRun): SideSnap {
  return {
    activeStage: side.stages[side.idx] ?? null,
    progress: side.progress,
    totals: side.totals,
    log: side.log.slice(),
  };
}

function takeSnapshot(sim: Sim): Snap {
  return {
    world: { ...sim.world },
    queue: sim.queue.map((q) => ({ key: q.key, label: q.label })),
    currentLabel: sim.current?.label ?? null,
    paused: sim.paused,
    speed: sim.speed,
    old: snapshotSide(sim.old),
    neu: snapshotSide(sim.neu),
    finished: sim.finished.slice(),
  };
}

// ---------------------------------------------------------------------------
// Component boxes
// ---------------------------------------------------------------------------

interface CompDef {
  id: string;
  name: string;
  sub: string;
}

const OLD_COMPS: CompDef[] = [
  { id: "watchJoin", name: "db.watch(join)", sub: "asset_synced ⨝ acl_synced — every audio row" },
  { id: "debounce", name: "debounce 2 s", sub: "refreshAllAttachments()" },
  { id: "watchIds", name: "watchAttachmentIds()", sub: "O(n²) reconcile loop" },
  { id: "attTable", name: "attachments table", sub: "second copy of the truth" },
  { id: "disk", name: "file system", sub: "fileExists() per file, per sweep" },
  { id: "transfer", name: "up/downloadRecordsWithProgress()", sub: "per-file state UPDATEs" },
];

const NEW_COMPS: CompDef[] = [
  { id: "acl", name: "asset_content_link", sub: "pending = audio_uploaded_at IS NULL" },
  { id: "watch", name: "db.watch + timers", sub: "signal only; drain re-derives" },
  { id: "index", name: "LocalFileIndex", sub: "in-memory Set of filenames" },
  { id: "drain", name: "drainOnce() / getWorkList()", sub: "index seek + Set lookups" },
  { id: "transfer", name: "uploadOne() / downloadOne()", sub: "in-memory backoff Map" },
  { id: "server", name: "server stamp", sub: "storage trigger → audio_uploaded_at" },
];

// ---------------------------------------------------------------------------
// UI
// ---------------------------------------------------------------------------

const EVENT_BUTTONS: { id: EventId; label: (w: World) => string; hint: string }[] = [
  { id: "record", label: () => "🎙 New recording", hint: "user records one audio" },
  { id: "publish", label: (w) => `📤 Publish quest (${f(w.localRec)})`, hint: "all unpublished recordings" },
  { id: "syncDown", label: () => `⬇ Sync down ${SYNC_DOWN_K}`, hint: "new records arrive from server" },
  { id: "tick", label: () => "⏱ Background tick", hint: "old: 30 s syncInterval · new: 60 s tick" },
  { id: "restart", label: () => "🔄 App restart", hint: "startup cost" },
  { id: "toggleNet", label: (w) => (w.online ? "🔌 Go offline" : "🔌 Reconnect"), hint: "connectivity change" },
];

const SPEED_STEPS = [0.25, 0.5, 1, 2, 4, 8, 16, 32];

export function AttachmentSim() {
  const [snap, setSnap] = useState<Snap>(() => takeSnapshot(SIM));
  const [seeds, setSeeds] = useState({
    confirmed: DEFAULT_CONFIRMED,
    localRec: DEFAULT_LOCAL_REC,
  });

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const loop = (t: number) => {
      const dt = Math.min(t - last, 100);
      last = t;
      tickSim(SIM, dt);
      setSnap(takeSnapshot(SIM));
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const w = snap.world;

  const enqueue = (id: EventId) => {
    if (id === "publish" && SIM.world.localRec === 0) return;
    const label = EVENT_BUTTONS.find((b) => b.id === id)?.label(SIM.world) ?? id;
    SIM.queue.push({ key: SIM.keyCounter++, id, label });
  };

  const reseed = (next: { confirmed: number; localRec: number }) => {
    setSeeds(next);
    SIM = freshSim(next.confirmed, next.localRec, SIM.speed);
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <Header
        title="Attachment Sync Simulator"
        subtitle="old PowerSync queue vs new domain-driven workers"
        currentHash="#attachment-sim"
        actions={
          <>
            <HeaderButton
              onClick={() => {
                SIM.paused = !SIM.paused;
              }}
              active={snap.paused}
            >
              {snap.paused ? "▶ Resume" : "⏸ Pause"}
            </HeaderButton>
            <HeaderButton onClick={() => reseed(seeds)}>↺ Reset</HeaderButton>
          </>
        }
      />

      <div className="flex-1 overflow-auto px-5 py-4 flex flex-col gap-4">
        <ControlsCard
          snap={snap}
          seeds={seeds}
          onEnqueue={enqueue}
          onReseed={reseed}
          onReset={() => reseed(seeds)}
        />

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <SystemPanel
            title="OLD — PowerSync attachment queue"
            accent="amber"
            comps={OLD_COMPS}
            side={snap.old}
            badges={[
              { label: "attachments rows", value: f(tableRows(w)) },
              { label: "queued upload", value: f(w.pendingUp + (w.online ? 0 : w.localRec)) },
              { label: "queued download", value: f(w.missing) },
            ]}
          />
          <SystemPanel
            title="NEW — AudioUploader / AudioDownloader"
            accent="green"
            comps={NEW_COMPS}
            side={snap.neu}
            badges={[
              { label: "pending rows (IS NULL)", value: f(w.pendingUp) },
              { label: "LocalFileIndex size", value: f(filesOnDevice(w)) },
              { label: "missing files", value: f(w.missing) },
            ]}
          />
        </div>

        <Scoreboard finished={snap.finished} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function ControlsCard({
  snap,
  seeds,
  onEnqueue,
  onReseed,
  onReset,
}: {
  snap: Snap;
  seeds: { confirmed: number; localRec: number };
  onEnqueue: (id: EventId) => void;
  onReseed: (next: { confirmed: number; localRec: number }) => void;
  onReset: () => void;
}) {
  const w = snap.world;
  const speedIdx = Math.max(0, SPEED_STEPS.indexOf(snap.speed));

  return (
    <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-[.62rem] uppercase tracking-[.12em] text-txt-dim w-20 shrink-0">
          Events
        </span>
        {EVENT_BUTTONS.map((b) => (
          <button
            key={b.id}
            type="button"
            title={b.hint}
            onClick={() => onEnqueue(b.id)}
            disabled={b.id === "publish" && w.localRec === 0}
            className={cn(
              "font-mono text-[.72rem] px-3 py-1.5 rounded-lg border cursor-pointer transition-all",
              "border-border bg-bg text-txt-muted hover:border-border-hi hover:text-txt",
              "disabled:opacity-35 disabled:cursor-not-allowed",
            )}
          >
            {b.label(w)}
          </button>
        ))}
        <span
          className={cn(
            "ml-auto font-mono text-[.68rem] px-2.5 py-1 rounded-md border",
            w.online
              ? "border-accent-green/40 text-accent-green"
              : "border-accent-red/40 text-accent-red",
          )}
        >
          {w.online ? "● online" : "○ offline"}
        </span>
        <button
          type="button"
          title="Clear the running event, queue, logs, counters, scoreboard, and upload/download state; reseed the world from the sliders"
          onClick={onReset}
          className={cn(
            "font-mono text-[.72rem] px-3 py-1.5 rounded-lg border cursor-pointer transition-all",
            "border-accent-red/40 text-accent-red bg-bg hover:bg-accent-red/10 hover:border-accent-red/70",
          )}
        >
          ↺ Reset simulator
        </button>
      </div>

      {(snap.queue.length > 0 || snap.currentLabel) && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-[.62rem] uppercase tracking-[.12em] text-txt-dim w-20 shrink-0">
            Queue
          </span>
          {snap.currentLabel && (
            <span className="font-mono text-[.68rem] px-2.5 py-1 rounded-md border border-accent-purple/50 text-accent-purple bg-accent-purple/10 animate-pulse">
              {snap.currentLabel}
            </span>
          )}
          {snap.queue.map((q) => (
            <span
              key={q.key}
              className="font-mono text-[.68rem] px-2.5 py-1 rounded-md border border-border text-txt-dim flex items-center gap-1.5"
            >
              {q.label}
              <button
                type="button"
                className="text-txt-dim hover:text-accent-red cursor-pointer"
                onClick={() => {
                  const i = SIM.queue.findIndex((x) => x.key === q.key);
                  if (i >= 0) SIM.queue.splice(i, 1);
                }}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-8 gap-y-2">
        <label className="flex items-center gap-3">
          <span className="font-mono text-[.62rem] uppercase tracking-[.12em] text-txt-dim w-20 shrink-0">
            Speed
          </span>
          <input
            type="range"
            min={0}
            max={SPEED_STEPS.length - 1}
            step={1}
            value={speedIdx}
            onChange={(e) => {
              SIM.speed = SPEED_STEPS[Number(e.target.value)] ?? 1;
            }}
            className="w-36 accent-[var(--color-accent-purple)]"
          />
          <span className="font-mono text-[.72rem] text-txt w-10">{snap.speed}×</span>
        </label>

        <label className="flex items-center gap-3">
          <span className="font-mono text-[.62rem] uppercase tracking-[.12em] text-txt-dim shrink-0">
            Synced records
          </span>
          <input
            type="range"
            min={100}
            max={50000}
            step={100}
            value={seeds.confirmed}
            onChange={(e) => onReseed({ ...seeds, confirmed: Number(e.target.value) })}
            className="w-36 accent-[var(--color-accent-purple)]"
          />
          <span className="font-mono text-[.72rem] text-txt w-12">{f(seeds.confirmed)}</span>
        </label>

        <label className="flex items-center gap-3">
          <span className="font-mono text-[.62rem] uppercase tracking-[.12em] text-txt-dim shrink-0">
            Unpublished recordings
          </span>
          <input
            type="range"
            min={0}
            max={30000}
            step={50}
            value={seeds.localRec}
            onChange={(e) => onReseed({ ...seeds, localRec: Number(e.target.value) })}
            className="w-36 accent-[var(--color-accent-purple)]"
          />
          <span className="font-mono text-[.72rem] text-txt w-12">{f(seeds.localRec)}</span>
        </label>

        <span className="font-mono text-[.62rem] text-txt-dim">
          changing record counts resets the sim
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

const ACCENTS = {
  amber: {
    title: "text-accent-amber",
    ring: "ring-accent-amber border-accent-amber/70",
    bar: "bg-accent-amber",
  },
  green: {
    title: "text-accent-green",
    ring: "ring-accent-green border-accent-green/70",
    bar: "bg-accent-green",
  },
} as const;

function SystemPanel({
  title,
  accent,
  comps,
  side,
  badges,
}: {
  title: string;
  accent: keyof typeof ACCENTS;
  comps: CompDef[];
  side: SideSnap;
  badges: { label: string; value: string }[];
}) {
  const a = ACCENTS[accent];
  const stage = side.activeStage;
  const liveTotals = stage
    ? addCounters(side.totals, stage.counters, Math.min(side.progress, 1))
    : side.totals;

  return (
    <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-3 min-h-0">
      <div className="flex items-center justify-between gap-2">
        <h2 className={cn("font-mono text-[.8rem] font-semibold", a.title)}>{title}</h2>
        <div className="flex gap-1.5 flex-wrap justify-end">
          {badges.map((b) => (
            <span
              key={b.label}
              className="font-mono text-[.6rem] px-2 py-0.5 rounded border border-border text-txt-dim"
            >
              {b.label}: <span className="text-txt">{b.value}</span>
            </span>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        {comps.map((c) => {
          const active = stage?.comp === c.id;
          return (
            <div
              key={c.id}
              className={cn(
                "rounded-lg border px-2.5 py-2 transition-all relative overflow-hidden",
                active ? cn("ring-1", a.ring) : "border-border",
              )}
            >
              <div className="font-mono text-[.66rem] font-medium text-txt truncate">{c.name}</div>
              <div className="text-[.6rem] text-txt-dim truncate">{c.sub}</div>
              {active && (
                <div className="absolute bottom-0 left-0 h-[3px] w-full bg-border">
                  <div
                    className={cn("h-full", a.bar)}
                    style={{ width: `${Math.min(side.progress, 1) * 100}%` }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <NowLine stage={stage} progress={side.progress} accent={accent} />

      <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-border pt-2">
        {COUNTER_META.map((m) => (
          <span key={m.key} className="font-mono text-[.62rem] text-txt-dim">
            {m.label}: <span className="text-txt">{f(liveTotals[m.key])}</span>
          </span>
        ))}
      </div>

      <LogList entries={side.log} />
    </div>
  );
}

function NowLine({
  stage,
  progress,
  accent,
}: {
  stage: Stage | null;
  progress: number;
  accent: keyof typeof ACCENTS;
}) {
  const a = ACCENTS[accent];
  if (!stage) {
    return (
      <div className="font-mono text-[.66rem] text-txt-dim h-9 flex items-center">
        idle — waiting for an event
      </div>
    );
  }
  const p = Math.min(progress, 1);
  // Show the dominant counter counting up while the stage grinds.
  let dom: { label: string; value: number } | null = null;
  let domWeighted = 0;
  for (const m of COUNTER_META) {
    const v = stage.counters[m.key] ?? 0;
    if (v * m.weight > domWeighted) {
      domWeighted = v * m.weight;
      dom = { label: m.label, value: v };
    }
  }
  return (
    <div className="h-9">
      <div className="font-mono text-[.66rem] text-txt truncate">
        <span className={a.title}>{stage.fn}</span>
        <span className="text-txt-dim"> — {stage.detail}</span>
      </div>
      <div className="font-mono text-[.6rem] text-txt-dim">
        {dom ? (
          <>
            {f(dom.value * p)} / {f(dom.value)} {dom.label}
          </>
        ) : (
          "…"
        )}
      </div>
    </div>
  );
}

function LogList({ entries }: { entries: LogEntry[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const len = entries.length;
  const lastKey = entries.length > 0 ? entries[entries.length - 1]?.key : undefined;
  useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight });
  }, [len, lastKey]);

  return (
    <div
      ref={ref}
      className="h-44 overflow-y-auto rounded-lg border border-border bg-code-bg px-2.5 py-1.5 flex flex-col gap-1"
    >
      {entries.length === 0 && (
        <span className="font-mono text-[.62rem] text-txt-dim">no operations yet</span>
      )}
      {entries.map((e) => (
        <div key={e.key} className="font-mono text-[.62rem] leading-snug">
          <span className="text-txt">{e.fn}</span>
          <span className="text-txt-dim"> — {e.detail}</span>
          {e.work >= 1 && <span className="text-accent-purple"> · {f(e.work)} wu</span>}
          {e.note && <span className="text-accent-amber"> · {e.note}</span>}
        </div>
      ))}
    </div>
  );
}

function Scoreboard({ finished }: { finished: FinishedEvent[] }) {
  if (finished.length === 0) return null;
  const maxWork = Math.max(...finished.map((e) => Math.max(e.oldWork, e.neuWork)), 1);
  const scale = (v: number) =>
    v <= 0 ? 0 : (Math.log10(1 + v) / Math.log10(1 + maxWork)) * 100;

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <h3 className="font-mono text-[.7rem] uppercase tracking-[.12em] text-txt-dim mb-2">
        Completed events — total work units (log-scaled bars)
      </h3>
      <div className="flex flex-col gap-1.5">
        {[...finished].reverse().map((e) => {
          const ratio =
            e.neuWork > 0 ? e.oldWork / e.neuWork : e.oldWork > 0 ? Infinity : 1;
          return (
            <div key={e.key} className="grid grid-cols-[13rem_1fr_5rem] items-center gap-3">
              <span className="font-mono text-[.66rem] text-txt truncate">{e.label}</span>
              <div className="flex flex-col gap-[3px]">
                <div className="h-[6px] rounded bg-border/40">
                  <div
                    className="h-full rounded bg-accent-amber"
                    style={{ width: `${scale(e.oldWork)}%` }}
                  />
                </div>
                <div className="h-[6px] rounded bg-border/40">
                  <div
                    className="h-full rounded bg-accent-green"
                    style={{ width: `${scale(e.neuWork)}%` }}
                  />
                </div>
              </div>
              <span className="font-mono text-[.62rem] text-txt-dim text-right">
                {ratio === Infinity ? "∞" : `${f(ratio)}×`} less
              </span>
            </div>
          );
        })}
      </div>
      <div className="flex gap-4 mt-2 font-mono text-[.6rem] text-txt-dim">
        <span>
          <span className="inline-block w-2.5 h-2.5 rounded-sm bg-accent-amber align-middle mr-1" />
          old queue
        </span>
        <span>
          <span className="inline-block w-2.5 h-2.5 rounded-sm bg-accent-green align-middle mr-1" />
          new workers
        </span>
      </div>
    </div>
  );
}
