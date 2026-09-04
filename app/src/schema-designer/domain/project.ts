export type StageStatus = "live" | "in-progress" | "planned" | "done";

export interface StageMeta {
  id: string;
  file: string;
  title: string;
  description: string;
  status: StageStatus;
}

export interface StageManifest {
  version: 1;
  stages: StageMeta[];
}

export function emptyManifest(): StageManifest {
  return { version: 1, stages: [] };
}

export function slugify(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return slug || "stage";
}

export function nextStageId(existing: StageMeta[], title: string): { id: string; file: string } {
  const max = existing.reduce((acc, stage) => {
    const n = Number.parseInt(stage.id, 10);
    return Number.isFinite(n) ? Math.max(acc, n) : acc;
  }, -1);
  const num = String(max + 1).padStart(2, "0");
  const slug = slugify(title);
  const id = `${num}-${slug}`;
  return { id, file: `stages/${id}.aml` };
}

export function moveStage(stages: StageMeta[], id: string, toIndex: number): StageMeta[] {
  const from = stages.findIndex((s) => s.id === id);
  if (from < 0) return stages;
  const to = Math.max(0, Math.min(Math.trunc(toIndex), stages.length - 1));
  if (from === to) return stages;
  const next = [...stages];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}
