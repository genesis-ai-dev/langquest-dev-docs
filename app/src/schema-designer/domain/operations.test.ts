import { describe, expect, it } from "vitest";
import {
  addField,
  addRelation,
  addTable,
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

  it("tracks field renames and strips them on duplicate", () => {
    let schema = addTable(emptySchema(), "quest");
    schema = updateField(schema, "quest", "id", { name: "quest_id" });
    expect(schema.tables[0].fields[0].renamedFrom).toBe("id");
    schema = stripRenamedFrom(schema);
    expect(schema.tables[0].fields[0].renamedFrom).toBeUndefined();
  });
});
