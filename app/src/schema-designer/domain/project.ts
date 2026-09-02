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
