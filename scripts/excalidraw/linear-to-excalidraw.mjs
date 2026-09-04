#!/usr/bin/env node
/**
 * Build Excalidraw labelled rectangles from a Linear issue snapshot.
 *
 *   node linear-to-excalidraw.mjs langquest-issues.json --copy
 *   node linear-to-excalidraw.mjs langquest-issues.json --out board.excalidraw
 *   node linear-to-excalidraw.mjs langquest-issues.json --expand existing.excalidraw --copy
 *   node linear-to-excalidraw.mjs langquest-issues.json --update existing.excalidraw --out existing.excalidraw
 *
 * Style matches the white 35px rounded rectangles used in the LQ architecture board.
 * Re-run after editing the snapshot (or after a Linear refresh) instead of regenerating JSON by hand.
 */

import { execFileSync } from "node:child_process";
import { createHash, randomInt } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const BOX_W = 377.70634028373644;
const BOX_H = 35;
const TEXT_H = 25;
const FONT_SIZE = 20;
const FONT_FAMILY = 5;
const LINE_HEIGHT = 1.25;
const LINE_PX = FONT_SIZE * LINE_HEIGHT;
const VERT_PAD = BOX_H - TEXT_H;
const CHAR_W = 10.6;
const GAP_X = 40;
const GAP_Y = 16;
const SECTION_GAP = 56;
const PAD_X = 16;

const STYLE = {
  strokeColor: "#1e1e1e",
  backgroundColor: "#ffffff",
  fillStyle: "solid",
  strokeWidth: 2,
  strokeStyle: "solid",
  roughness: 0,
  opacity: 100,
};

function parseArgs(argv) {
  const args = {
    input: null,
    out: null,
    update: null,
    copy: false,
    excludeCompleted: false,
    expand: null,
    label: "id-title",
  };
  const rest = [];
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--copy") args.copy = true;
    else if (token === "--exclude-completed") args.excludeCompleted = true;
    else if (token === "--out") args.out = argv[++i];
    else if (token === "--update") args.update = argv[++i];
    else if (token === "--expand") args.expand = argv[++i];
    else if (token === "--label") args.label = argv[++i];
    else if (!token.startsWith("-")) rest.push(token);
    else throw new Error(`Unknown flag: ${token}`);
  }
  args.input = rest[0];
  if (!args.input) {
    throw new Error(
      "Usage: node linear-to-excalidraw.mjs <issues.json> [--copy] [--out file] [--expand file] [--update file] [--exclude-completed] [--label id|title|id-title]",
    );
  }
  return args;
}

function loadSnapshot(path) {
  const raw = JSON.parse(readFileSync(path, "utf8"));
  const issues = Array.isArray(raw) ? raw : raw.issues;
  if (!Array.isArray(issues)) throw new Error("Snapshot must be { issues: [...] } or an array");
  return {
    team: raw.team ?? "LangQuest",
    statusOrder: raw.statusOrder ?? [],
    issues,
  };
}

function issueLabel(issue, mode) {
  if (mode === "id") return issue.id;
  if (mode === "title") return issue.title;
  return `${issue.id} ${issue.title}`;
}

function wrapLines(text, maxWidth) {
  const maxChars = Math.max(8, Math.floor((maxWidth - PAD_X) / CHAR_W));
  const words = text.split(/\s+/).filter(Boolean);
  const lines = [];
  let current = "";

  const pushChunks = (word) => {
    if (word.length <= maxChars) {
      current = word;
      return;
    }
    for (let i = 0; i < word.length; i += maxChars) {
      const chunk = word.slice(i, i + maxChars);
      if (i + maxChars < word.length) lines.push(chunk);
      else current = chunk;
    }
  };

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= maxChars) {
      current = next;
    } else {
      if (current) lines.push(current);
      pushChunks(word);
    }
  }
  if (current) lines.push(current);
  return lines.length > 0 ? lines : [""];
}

function layoutLabel(text, boxWidth) {
  const lines = wrapLines(text, boxWidth);
  const textH = lines.length * LINE_PX;
  const longest = Math.max(...lines.map((line) => line.length), 1);
  return {
    lines,
    wrapped: lines.join("\n"),
    textH,
    textW: Math.min(longest * CHAR_W, boxWidth - PAD_X),
    rectH: textH + VERT_PAD,
  };
}

function stableId(kind, key) {
  const digest = createHash("sha1").update(`${kind}:${key}`).digest("base64url");
  return digest.slice(0, 21);
}

function nextIndex(n) {
  const alphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
  let value = n + 1;
  let out = "a";
  while (value > 0) {
    out += alphabet[value % alphabet.length];
    value = Math.floor(value / alphabet.length);
  }
  return out;
}

function makeRect({ id, x, y, width, height, textId, link, index, role, linearId }) {
  return {
    id,
    type: "rectangle",
    x,
    y,
    width,
    height,
    angle: 0,
    ...STYLE,
    groupIds: [],
    frameId: null,
    index,
    roundness: { type: 3 },
    seed: randomInt(1, 2 ** 31),
    version: 1,
    versionNonce: randomInt(1, 2 ** 31),
    isDeleted: false,
    boundElements: [{ type: "text", id: textId }],
    updated: Date.now(),
    link: link ?? null,
    locked: false,
    customData: { role, linearId: linearId ?? null },
  };
}

function makeText({ id, containerId, x, y, width, height, text, index, role, linearId, autoResize }) {
  return {
    id,
    type: "text",
    x,
    y,
    width,
    height,
    angle: 0,
    ...STYLE,
    groupIds: [],
    frameId: null,
    index,
    roundness: null,
    seed: randomInt(1, 2 ** 31),
    version: 1,
    versionNonce: randomInt(1, 2 ** 31),
    isDeleted: false,
    boundElements: [],
    updated: Date.now(),
    link: null,
    locked: false,
    text,
    fontSize: FONT_SIZE,
    fontFamily: FONT_FAMILY,
    textAlign: "center",
    verticalAlign: "middle",
    containerId,
    originalText: text.replaceAll("\n", " "),
    autoResize,
    lineHeight: LINE_HEIGHT,
    customData: { role, linearId: linearId ?? null },
  };
}

function addLabeledBox(elements, { key, text, x, y, width, link, role, linearId, indexStart }) {
  const layout = layoutLabel(text, width);
  const rectId = stableId("rect", key);
  const textId = stableId("text", key);
  const rect = makeRect({
    id: rectId,
    x,
    y,
    width,
    height: layout.rectH,
    textId,
    link,
    index: nextIndex(indexStart),
    role,
    linearId,
  });
  const textEl = makeText({
    id: textId,
    containerId: rectId,
    x: x + (width - layout.textW) / 2,
    y: y + (layout.rectH - layout.textH) / 2,
    width: layout.textW,
    height: layout.textH,
    text: layout.wrapped,
    index: nextIndex(indexStart + 1),
    role,
    linearId,
    autoResize: layout.lines.length === 1,
  });
  elements.push(rect, textEl);
  return 2;
}

function statusRank(name, order) {
  const i = order.indexOf(name);
  return i === -1 ? order.length + 1 : i;
}

function groupIssues(issues, statusOrder) {
  const projects = new Map();
  for (const issue of issues) {
    const project = issue.project ?? "No project";
    if (!projects.has(project)) projects.set(project, new Map());
    const byStatus = projects.get(project);
    if (!byStatus.has(issue.status)) byStatus.set(issue.status, []);
    byStatus.get(issue.status).push(issue);
  }

  return [...projects.entries()]
    .sort(([a], [b]) => {
      if (a === "No project") return 1;
      if (b === "No project") return -1;
      return a.localeCompare(b);
    })
    .map(([project, byStatus]) => ({
      project,
      columns: [...byStatus.entries()]
        .sort(([a], [b]) => statusRank(a, statusOrder) - statusRank(b, statusOrder))
        .map(([status, columnIssues]) => ({
          status,
          issues: columnIssues.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true })),
        })),
    }));
}

function buildElements(snapshot, { excludeCompleted, label }) {
  const issues = snapshot.issues.filter((issue) => {
    if (!excludeCompleted) return true;
    return issue.status !== "Done & Shipped";
  });
  const groups = groupIssues(issues, snapshot.statusOrder);
  const elements = [];
  let index = 0;
  let y = 0;

  index += addLabeledBox(elements, {
    key: "team",
    text: snapshot.team,
    x: 0,
    y,
    width: BOX_W,
    role: "team",
    indexStart: index,
  });
    y += layoutLabel(snapshot.team, BOX_W).rectH + 28;

  for (const group of groups) {
    const colCount = Math.max(1, group.columns.length);
    const headerW = colCount * (BOX_W + GAP_X) - GAP_X;
    index += addLabeledBox(elements, {
      key: `project:${group.project}`,
      text: group.project,
      x: 0,
      y,
      width: Math.max(BOX_W, headerW),
      role: "project",
      indexStart: index,
    });
    y += layoutLabel(group.project, Math.max(BOX_W, headerW)).rectH + GAP_Y;

    let tallest = 0;
    group.columns.forEach((column, col) => {
      const x = col * (BOX_W + GAP_X);
      let cy = y;
      index += addLabeledBox(elements, {
        key: `status:${group.project}:${column.status}`,
        text: column.status,
        x,
        y: cy,
        width: BOX_W,
        role: "status",
        indexStart: index,
      });
      cy += layoutLabel(column.status, BOX_W).rectH + GAP_Y;
      for (const issue of column.issues) {
        const title = issueLabel(issue, label);
        index += addLabeledBox(elements, {
          key: `issue:${issue.id}`,
          text: title,
          x,
          y: cy,
          width: BOX_W,
          link: issue.url,
          role: "issue",
          linearId: issue.id,
          indexStart: index,
        });
        cy += layoutLabel(title, BOX_W).rectH + GAP_Y;
      }
      tallest = Math.max(tallest, cy - y);
    });
    y += tallest + SECTION_GAP;
  }

  return elements;
}

function applyUpdate(existingDoc, nextElements) {
  const current = existingDoc.elements ?? existingDoc;
  if (!Array.isArray(current)) throw new Error("--update file must be an Excalidraw document or element list");

  const byKey = new Map();
  for (const el of current) {
    const linearId = el.customData?.linearId;
    if (el.customData?.role === "issue" && linearId) {
      byKey.set(`${el.type}:${linearId}`, el);
    }
  }

  return nextElements.map((el) => {
    const linearId = el.customData?.linearId;
    if (el.customData?.role !== "issue" || !linearId) return el;
    const prev = byKey.get(`${el.type}:${linearId}`);
    if (!prev) return el;
    return {
      ...el,
      x: prev.x,
      y: prev.y,
      width: prev.width,
    };
  });
}

function fullLabelFor(el, snapshot, labelMode) {
  const role = el.customData?.role;
  const linearId = el.customData?.linearId;
  if (role === "issue" && linearId) {
    const issue = snapshot.issues.find((item) => item.id === linearId);
    if (issue) return issueLabel(issue, labelMode);
  }
  return (el.originalText || el.text || "").replaceAll("\n", " ").replace(/[…]+$/u, "");
}

function expandExisting(doc, snapshot, labelMode) {
  const elements = doc.elements ?? doc;
  const texts = new Map(elements.filter((el) => el.type === "text").map((el) => [el.id, el]));

  for (const rect of elements) {
    if (rect.type !== "rectangle") continue;
    const text = texts.get(rect.boundElements?.[0]?.id);
    if (!text) continue;
    const full = fullLabelFor(text, snapshot, labelMode);
    const layout = layoutLabel(full, rect.width);
    rect.height = layout.rectH;
    rect.updated = Date.now();
    rect.version = (rect.version ?? 1) + 1;
    text.text = layout.wrapped;
    text.originalText = full;
    text.height = layout.textH;
    text.width = layout.textW;
    text.autoResize = layout.lines.length === 1;
    text.x = rect.x + (rect.width - layout.textW) / 2;
    text.y = rect.y + (layout.rectH - layout.textH) / 2;
    text.updated = Date.now();
    text.version = (text.version ?? 1) + 1;
  }

  const columns = new Map();
  for (const rect of elements) {
    if (rect.type !== "rectangle") continue;
    const key = Math.round(rect.x / 25) * 25;
    if (!columns.has(key)) columns.set(key, []);
    columns.get(key).push(rect);
  }

  for (const col of columns.values()) {
    col.sort((a, b) => a.y - b.y);
    for (let i = 0; i < col.length - 1; i += 1) {
      const current = col[i];
      const next = col[i + 1];
      const overflow = current.y + current.height + GAP_Y - next.y;
      if (overflow <= 0.5) continue;
      for (let j = i + 1; j < col.length; j += 1) {
        col[j].y += overflow;
        const bound = texts.get(col[j].boundElements?.[0]?.id);
        if (bound) bound.y += overflow;
      }
    }
  }

  return doc;
}

function toClipboard(elements) {
  return { type: "excalidraw/clipboard", elements, files: {} };
}

function toScene(elements) {
  return {
    type: "excalidraw",
    version: 2,
    source: "https://excalidraw.com",
    elements,
    appState: {
      gridSize: null,
      viewBackgroundColor: "#ffffff",
    },
    files: {},
  };
}

function copyClipboard(payload) {
  try {
    execFileSync("pbcopy", { input: JSON.stringify(payload) });
  } catch (error) {
    console.warn(`Could not copy to clipboard (${error.code ?? error.message}). Use --out and pbcopy the file instead.`);
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const snapshot = loadSnapshot(resolve(args.input));

  if (args.expand) {
    const path = resolve(args.expand);
    const doc = JSON.parse(readFileSync(path, "utf8"));
    expandExisting(doc, snapshot, args.label);
    const dest = args.out ? resolve(args.out) : path;
    mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(dest, `${JSON.stringify(doc)}\n`);
    console.log(`Expanded labels in ${dest} (${(doc.elements ?? doc).length} elements)`);
    if (args.copy) {
      copyClipboard(doc.type === "excalidraw/clipboard" ? doc : toClipboard(doc.elements));
      console.log("Copied expanded board to the clipboard. Paste into Excalidraw.");
    }
    return;
  }

  let elements = buildElements(snapshot, args);

  let existingDoc = null;
  if (args.update) {
    existingDoc = JSON.parse(readFileSync(resolve(args.update), "utf8"));
    elements = applyUpdate(existingDoc, elements);
  }

  const outPath = args.out ? resolve(args.out) : args.update ? resolve(args.update) : null;
  if (outPath) {
    mkdirSync(dirname(outPath), { recursive: true });
    const isScene = outPath.endsWith(".excalidraw") || outPath.endsWith(".excalidraw.json");
    const doc = isScene
      ? existingDoc?.type === "excalidraw"
        ? { ...existingDoc, elements }
        : toScene(elements)
      : toClipboard(elements);
    writeFileSync(outPath, `${JSON.stringify(doc)}\n`);
    console.log(`Wrote ${outPath} (${elements.length} elements)`);
  }

  if (args.copy || !outPath) {
    copyClipboard(toClipboard(elements));
    console.log(`Copied ${elements.length} elements to the clipboard. Paste into Excalidraw.`);
  }
}

main();
