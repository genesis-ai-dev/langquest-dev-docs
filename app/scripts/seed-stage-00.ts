import { generateAml, parseAml } from "@azimutt/aml";
import { parseSql } from "@azimutt/parser-sql";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const appDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(appDir, "../..");
const sqlPath = path.join(repoRoot, "database_schema.sql");
const outDir = path.join(repoRoot, "schema-designer");
const stagesDir = path.join(outDir, "stages");

function sidecarReport(sql: string): string {
  const triggers = [...sql.matchAll(/CREATE\s+(?:OR\s+REPLACE\s+)?TRIGGER\s+[\s\S]+?;/gi)].map((m) => m[0]);
  const functions = [
    ...sql.matchAll(/CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+[\s\S]+?\$\$[\s\S]+?\$\$[\s\S]*?;/gi),
    ...sql.matchAll(/CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+[\s\S]+?;/gi),
  ].map((m) => m[0]);
  const policies = [...sql.matchAll(/CREATE\s+POLICY\s+[\s\S]+?;/gi)].map((m) => m[0]);
  const uniq = (items: string[]) => [...new Set(items)];
  return `# Stage 00 — objects to add by hand

The SQL dump parser does not reliably convert triggers, functions, or RLS policies.
Add them in the designer using the AML conventions in \`.cursor/skills/aml-schema-conventions\`.

## CREATE TRIGGER (${uniq(triggers).length})

${uniq(triggers).map((s) => "```sql\n" + s.trim() + "\n```").join("\n\n") || "_none found_"}

## CREATE FUNCTION (${uniq(functions).length})

${uniq(functions).map((s) => "```sql\n" + s.trim() + "\n```").join("\n\n") || "_none found_"}

## CREATE POLICY (${uniq(policies).length})

${uniq(policies).map((s) => "```sql\n" + s.trim() + "\n```").join("\n\n") || "_none found_"}
`;
}

function parseDumpFallback(sql: string): string {
  const tables: string[] = [];
  const relations: string[] = [];
  const tableRe = /CREATE TABLE\s+(?:public\.)?(\w+)\s*\(([\s\S]*?)\);/gi;
  let match: RegExpExecArray | null;
  while ((match = tableRe.exec(sql))) {
    const name = match[1];
    const body = match[2];
    const fields: string[] = [];
    const pks = new Set<string>();
    for (const rawLine of body.split("\n")) {
      const line = rawLine.trim().replace(/,$/, "");
      if (!line) continue;
      const pkTable = line.match(/^CONSTRAINT\s+\w+\s+PRIMARY KEY\s*\(([^)]+)\)/i);
      if (pkTable) {
        pkTable[1].split(",").forEach((c) => pks.add(c.trim()));
        continue;
      }
      const fk = line.match(
        /^CONSTRAINT\s+\w+\s+FOREIGN KEY\s*\((\w+)\)\s+REFERENCES\s+(?:public\.)?(\w+)\((\w+)\)/i,
      );
      if (fk) {
        relations.push(`rel ${name}(${fk[1]}) -> ${fk[2]}(${fk[3]})`);
        continue;
      }
      if (/^CONSTRAINT\b/i.test(line)) continue;
      const col = line.match(/^(\w+)\s+(.+)$/);
      if (!col) continue;
      const colName = col[1];
      let rest = col[2];
      const nullable = !/\bNOT NULL\b/i.test(rest);
      rest = rest.replace(/\bNOT NULL\b/gi, "").replace(/\bNULL\b/gi, "");
      const def = rest.match(/\bDEFAULT\s+(.+)$/i);
      if (def) rest = rest.slice(0, def.index).trim();
      let type = rest.replace(/\s+/g, " ").trim() || "text";
      if (/^ARRAY$/i.test(type)) type = '"text[]"';
      if (/\s/.test(type) || /[\[\]]/.test(type)) type = `"${type.replace(/"/g, "")}"`;
      fields.push({ name: colName, type, nullable } as unknown as string);
      void fields;
    }
    const fieldLines = body
      .split("\n")
      .map((l) => l.trim().replace(/,$/, ""))
      .filter((l) => l && !/^CONSTRAINT\b/i.test(l))
      .map((l) => {
        const col = l.match(/^(\w+)\s+(.+)$/);
        if (!col) return null;
        const colName = col[1];
        let rest = col[2];
        const nullable = !/\bNOT NULL\b/i.test(rest);
        rest = rest.replace(/\bNOT NULL\b/gi, "").trim();
        rest = rest.replace(/\bDEFAULT\s+.+$/i, "").trim();
        rest = rest.replace(/\bCHECK\s*\([\s\S]+$/i, "").trim();
        let type = rest || "text";
        if (/^ARRAY$/i.test(type)) type = "text[]";
        const pk = pks.has(colName) || /\bPRIMARY KEY\b/i.test(l);
        const typeOut = /[\s\[\]]/.test(type) ? `"${type}"` : type;
        return `  ${colName} ${typeOut}${nullable ? " nullable" : ""}${pk ? " pk" : ""}`;
      })
      .filter(Boolean);
    tables.push(`${name}\n${fieldLines.join("\n")}`);
  }
  const relLines = [...sql.matchAll(
    /FOREIGN KEY\s*\((\w+)\)\s+REFERENCES\s+(?:public\.)?(\w+)\((\w+)\)/gi,
  )];
  const relAml = relLines.map((m, i) => {
    const tableMatch = sql.slice(0, m.index).match(/CREATE TABLE\s+(?:public\.)?(\w+)/gi);
    const last = tableMatch?.[tableMatch.length - 1]?.replace(/CREATE TABLE\s+(?:public\.)?/i, "") ?? `t${i}`;
    return `rel ${last}(${m[1]}) -> ${m[2]}(${m[3]})`;
  });
  return `${tables.join("\n\n")}\n\n${relAml.join("\n")}\n`;
}

async function main() {
  const sql = await fs.readFile(sqlPath, "utf8");
  await fs.mkdir(stagesDir, { recursive: true });

  let aml = "";
  try {
    const parsed = parseSql(sql, "postgres");
    if (parsed.result) {
      aml = generateAml(parsed.result);
      console.log("seed: parsed SQL via @azimutt/parser-sql");
    } else {
      throw new Error(parsed.errors?.map((e) => e.message).join("; ") || "no result");
    }
  } catch (err) {
    console.warn("seed: parser-sql failed, using dump fallback:", err instanceof Error ? err.message : err);
    aml = parseDumpFallback(sql);
    const check = parseAml(aml);
    if (!check.result) {
      console.warn("seed: fallback AML has parse issues; writing anyway");
    } else {
      aml = generateAml(check.result);
    }
  }

  await fs.writeFile(path.join(stagesDir, "00-current.aml"), aml.endsWith("\n") ? aml : aml + "\n");
  await fs.writeFile(path.join(stagesDir, "00-current.todo.md"), sidecarReport(sql));
  await fs.writeFile(
    path.join(outDir, "stages.json"),
    JSON.stringify(
      {
        version: 1,
        stages: [
          {
            id: "00-current",
            file: "stages/00-current.aml",
            title: "Current production",
            description: "Schema as deployed today",
            status: "live",
          },
        ],
      },
      null,
      2,
    ) + "\n",
  );
  await fs.writeFile(
    path.join(outDir, "layout.json"),
    JSON.stringify({ version: 1, base: { nodes: {}, edges: {} }, stages: {} }, null, 2) + "\n",
  );
  console.log("seed: wrote schema-designer/stages/00-current.aml");
}

void main();
