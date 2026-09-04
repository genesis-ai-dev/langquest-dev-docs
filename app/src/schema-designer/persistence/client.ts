export interface FileMeta {
  path: string;
  mtimeMs: number;
}

export interface FilePayload {
  content: string;
  mtimeMs: number;
}

export class ConflictError extends Error {
  diskMtimeMs: number;
  constructor(diskMtimeMs: number) {
    super("conflict");
    this.diskMtimeMs = diskMtimeMs;
  }
}

const BASE = "/api/schema-fs";

export async function listFiles(): Promise<FileMeta[]> {
  const res = await fetch(`${BASE}/list`);
  if (!res.ok) throw new Error(`list failed ${res.status}`);
  const data = (await res.json()) as { files: FileMeta[] };
  return data.files;
}

export async function readFile(relPath: string): Promise<FilePayload> {
  const res = await fetch(`${BASE}/file?path=${encodeURIComponent(relPath)}`);
  if (!res.ok) throw new Error(`read failed ${res.status}`);
  return (await res.json()) as FilePayload;
}

export async function writeFile(
  relPath: string,
  content: string,
  baseMtimeMs?: number,
): Promise<number> {
  const res = await fetch(`${BASE}/file?path=${encodeURIComponent(relPath)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content, baseMtimeMs }),
  });
  if (res.status === 409) {
    const data = (await res.json()) as { diskMtimeMs: number };
    throw new ConflictError(data.diskMtimeMs);
  }
  if (!res.ok) throw new Error(`write failed ${res.status}`);
  const data = (await res.json()) as { mtimeMs: number };
  return data.mtimeMs;
}

export async function deleteFile(relPath: string): Promise<void> {
  const res = await fetch(`${BASE}/file?path=${encodeURIComponent(relPath)}`, {
    method: "DELETE",
  });
  if (!res.ok && res.status !== 404) throw new Error(`delete failed ${res.status}`);
}

export async function loadBundled(): Promise<Record<string, string>> {
  const mod = await import("virtual:schema-fs-bundle");
  return mod.bundledFiles;
}

export type SaveStatus = "saved" | "saving" | "dirty" | "error" | "conflict";
