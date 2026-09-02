import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin, ViteDevServer } from "vite";

const PREFIX = "/api/schema-fs";
const MAX_BODY = 1_000_000;
const ALLOWED_EXT = new Set([".aml", ".json", ".md"]);

export function schemaFsPlugin(): Plugin {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../schema-designer");

  async function listFiles(): Promise<{ path: string; mtimeMs: number }[]> {
    const out: { path: string; mtimeMs: number }[] = [];
    async function walk(dir: string, rel: string) {
      let entries;
      try {
        entries = await fs.readdir(dir, { withFileTypes: true });
      } catch {
        return;
      }
      for (const entry of entries) {
        const name = String(entry.name);
        const nextRel = rel ? `${rel}/${name}` : name;
        const full = path.join(dir, name);
        if (entry.isDirectory()) await walk(full, nextRel);
        else if (ALLOWED_EXT.has(path.extname(name))) {
          const stat = await fs.stat(full);
          out.push({ path: nextRel, mtimeMs: stat.mtimeMs });
        }
      }
    }
    await walk(root, "");
    return out;
  }

  async function resolveSafe(relPath: string): Promise<string> {
    if (!relPath || relPath.includes("\0")) throw Object.assign(new Error("invalid path"), { status: 400 });
    const cleaned = relPath.replace(/^\/+/, "");
    const ext = path.extname(cleaned);
    if (!ALLOWED_EXT.has(ext)) throw Object.assign(new Error("extension not allowed"), { status: 400 });
    const resolved = path.resolve(root, cleaned);
    const rootReal = await fs.realpath(root).catch(() => root);
    if (resolved !== rootReal && !resolved.startsWith(rootReal + path.sep)) {
      throw Object.assign(new Error("path outside schema-designer"), { status: 400 });
    }
    return resolved;
  }

  function readBody(req: IncomingMessage): Promise<string> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      let size = 0;
      req.on("data", (chunk: Buffer) => {
        size += chunk.length;
        if (size > MAX_BODY) {
          reject(Object.assign(new Error("body too large"), { status: 413 }));
          req.destroy();
          return;
        }
        chunks.push(chunk);
      });
      req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
      req.on("error", reject);
    });
  }

  function send(res: ServerResponse, status: number, payload: unknown) {
    res.statusCode = status;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(payload));
  }

  async function handle(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
    const url = new URL(req.url ?? "/", "http://localhost");
    if (!url.pathname.startsWith(PREFIX)) return false;

    try {
      if (req.method === "GET" && url.pathname === `${PREFIX}/list`) {
        send(res, 200, { files: await listFiles() });
        return true;
      }

      if (url.pathname === `${PREFIX}/file`) {
        const rel = url.searchParams.get("path") ?? "";
        const full = await resolveSafe(rel);

        if (req.method === "GET") {
          const content = await fs.readFile(full, "utf8");
          const stat = await fs.stat(full);
          send(res, 200, { content, mtimeMs: stat.mtimeMs });
          return true;
        }

        if (req.method === "PUT") {
          const body = JSON.parse(await readBody(req)) as {
            content?: string;
            baseMtimeMs?: number;
          };
          if (typeof body.content !== "string") {
            send(res, 400, { error: "content required" });
            return true;
          }
          await fs.mkdir(path.dirname(full), { recursive: true });
          try {
            const stat = await fs.stat(full);
            if (body.baseMtimeMs != null && stat.mtimeMs > body.baseMtimeMs + 1) {
              send(res, 409, { diskMtimeMs: stat.mtimeMs });
              return true;
            }
          } catch {
            /* new file */
          }
          await fs.writeFile(full, body.content, "utf8");
          const stat = await fs.stat(full);
          send(res, 200, { mtimeMs: stat.mtimeMs });
          return true;
        }

        if (req.method === "DELETE") {
          await fs.unlink(full);
          send(res, 200, { ok: true });
          return true;
        }
      }

      send(res, 404, { error: "not found" });
    } catch (err) {
      const status = (err as { status?: number }).status ?? 500;
      const message = err instanceof Error ? err.message : "error";
      if (status === 404 || message.includes("ENOENT")) {
        send(res, 404, { error: "not found" });
        return true;
      }
      send(res, status, { error: message });
    }
    return true;
  }

  function attach(server: { middlewares: ViteDevServer["middlewares"] }) {
    server.middlewares.use((req, res, next) => {
      void handle(req, res).then((handled) => {
        if (!handled) next();
      });
    });
  }

  return {
    name: "schema-fs",
    configureServer(server) {
      attach(server);
    },
    configurePreviewServer(server) {
      attach(server);
    },
    resolveId(id) {
      if (id === "virtual:schema-fs-bundle") return id;
      return undefined;
    },
    async load(id) {
      if (id !== "virtual:schema-fs-bundle") return undefined;
      const files = await listFiles();
      const bundle: Record<string, string> = {};
      for (const file of files) {
        const full = path.join(root, file.path);
        bundle[file.path] = await fs.readFile(full, "utf8");
      }
      return `export const bundledFiles = ${JSON.stringify(bundle)};`;
    },
  };
}
