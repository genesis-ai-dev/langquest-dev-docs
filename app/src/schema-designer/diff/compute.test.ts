import { describe, expect, it } from "vitest";
import { addField, addTable, emptySchema, removeTable, renameTable, updateField } from "../domain/operations";
import { computeDiff } from "./compute";

describe("computeDiff", () => {
  it("treats a null before as all-added", () => {
    const after = addTable(emptySchema(), "quest");
    const diff = computeDiff(null, after);
    expect(diff.tables[0]).toMatchObject({ name: "quest", kind: "added" });
  });

  it("detects added and removed tables", () => {
    let before = addTable(emptySchema(), "quest");
    before = addTable(before, "legacy");
    const after = removeTable(before, "legacy");
    const after2 = addTable(after, "queue");
    const diff = computeDiff(before, after2);
    expect(diff.tables.find((t) => t.name === "legacy")?.kind).toBe("removed");
    expect(diff.tables.find((t) => t.name === "queue")?.kind).toBe("added");
    expect(diff.tables.find((t) => t.name === "quest")).toBeUndefined();
  });

  it("detects field add/modify and table rename via renamedFrom", () => {
    const before = addTable(emptySchema(), "quest");
    let after = renameTable(before, "quest", "node");
    after = addField(after, "node", { name: "title", type: "text" });
    after = updateField(after, "node", "id", { type: "text" });
    const diff = computeDiff(before, after);
    const table = diff.tables[0];
    expect(table.kind).toBe("renamed");
    expect(table.renamedFrom).toBe("quest");
    expect(table.fields.find((f) => f.name === "title")?.kind).toBe("added");
    expect(table.fields.find((f) => f.name === "id")).toMatchObject({
      kind: "modified",
      changes: [{ property: "type", from: "uuid", to: "text" }],
    });
  });
});
