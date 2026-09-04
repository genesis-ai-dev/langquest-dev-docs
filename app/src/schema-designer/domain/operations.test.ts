import { describe, expect, it } from "vitest";
import {
  addField,
  addRelation,
  addTable,
  importTables,
  removeField,
  removeTable,
  renameTable,
  stripRenamedFrom,
  updateField,
} from "./operations";
import { emptySchema } from "./types";

describe("domain operations", () => {
  it("adds uniquely named tables with an id pk", () => {
    let schema = addTable(emptySchema());
    schema = addTable(schema);
    expect(schema.tables.map((t) => t.name)).toEqual(["table", "table_2"]);
    expect(schema.tables[0].fields[0]).toMatchObject({ name: "id", pk: true, type: "uuid" });
  });

  it("renames tables and rewrites relations + touches", () => {
    let schema = addTable(emptySchema(), "quest");
    schema = addField(schema, "quest", { name: "parent_id", type: "uuid" });
    schema = addRelation(
      schema,
      { table: "quest", field: "parent_id" },
      { table: "quest", field: "id" },
    );
    schema.functions.push({
      name: "stamp",
      params: [],
      touches: ["quest"],
    });
    schema = renameTable(schema, "quest", "node");
    expect(schema.tables[0].name).toBe("node");
    expect(schema.tables[0].renamedFrom).toBe("quest");
    expect(schema.relations[0].src.table).toBe("node");
    expect(schema.functions[0].touches).toEqual(["node"]);
  });

  it("drops dangling relations when a field or table is removed", () => {
    let schema = addTable(emptySchema(), "a");
    schema = addTable(schema, "b");
    schema = addField(schema, "b", { name: "a_id", type: "uuid" });
    schema = addRelation(schema, { table: "b", field: "a_id" }, { table: "a", field: "id" });
    schema = removeField(schema, "b", "a_id");
    expect(schema.relations).toHaveLength(0);
    schema = addField(schema, "b", { name: "a_id", type: "uuid" });
    schema = addRelation(schema, { table: "b", field: "a_id" }, { table: "a", field: "id" });
    schema = removeTable(schema, "a");
    expect(schema.relations).toHaveLength(0);
  });

  it("imports tables, their enums, and relations that can resolve", () => {
    let source = addTable(emptySchema(), "profile");
    source = addTable(source, "quest");
    source = addField(source, "quest", { name: "owner_id", type: "uuid" });
    source = addRelation(
      source,
      { table: "quest", field: "owner_id" },
      { table: "profile", field: "id" },
    );
    source.enums.push({ name: "quest_status", values: ["draft", "live"] });
    source = addField(source, "quest", { name: "status", type: "quest_status" });
    source.tables[1].renamedFrom = "old_quest";

    const target = addTable(emptySchema(), "profile");
    const next = importTables(target, source, ["quest", "missing"]);
    expect(next.tables.map((t) => t.name)).toEqual(["profile", "quest"]);
    expect(next.tables[1].renamedFrom).toBeUndefined();
    expect(next.enums.map((e) => e.name)).toEqual(["quest_status"]);
    expect(next.relations).toHaveLength(1);
    expect(next.relations[0].src.table).toBe("quest");
    expect(next.relations[0].dst.table).toBe("profile");
  });

  it("skips tables that already exist and drops FKs to tables that do not", () => {
    let source = addTable(emptySchema(), "asset");
    source = addTable(source, "project");
    source = addField(source, "asset", { name: "project_id", type: "uuid" });
    source = addRelation(
      source,
      { table: "asset", field: "project_id" },
      { table: "project", field: "id" },
    );
    const next = importTables(emptySchema(), source, ["asset"]);
    expect(next.tables.map((t) => t.name)).toEqual(["asset"]);
    expect(next.relations).toHaveLength(0);
  });

  it("tracks field renames and strips them on duplicate", () => {
    let schema = addTable(emptySchema(), "quest");
    schema = updateField(schema, "quest", "id", { name: "quest_id" });
    expect(schema.tables[0].fields[0].renamedFrom).toBe("id");
    schema = stripRenamedFrom(schema);
    expect(schema.tables[0].fields[0].renamedFrom).toBeUndefined();
  });
});
