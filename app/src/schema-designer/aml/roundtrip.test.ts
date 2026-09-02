import { describe, expect, it } from "vitest";
import type { Schema } from "../domain/types";
import { generateSchema, parseSchema } from "./index";

const rich: Schema = {
  tables: [
    {
      name: "quest",
      doc: "a quest node",
      renamedFrom: "old_quest",
      rlsEnabled: true,
      fields: [
        { name: "id", type: "uuid", nullable: false, pk: true },
        { name: "parent_id", type: "uuid", nullable: true, pk: false },
        {
          name: "name",
          type: "varchar",
          nullable: false,
          pk: false,
          renamedFrom: "title",
        },
        {
          name: "download_profiles",
          type: "uuid[]",
          nullable: false,
          pk: false,
          doc: "who flagged for offline sync",
        },
      ],
      triggers: [
        { timing: "before", events: ["insert", "update"], fn: "set_quest_download_profiles" },
        {
          timing: "after",
          events: ["delete"],
          condition: "OLD.active",
          fn: "cleanup_closure",
        },
      ],
      policies: [
        {
          command: "select",
          role: "authenticated",
          using: "is_project_member(project_id)",
        },
        {
          command: "insert",
          role: "authenticated",
          check: "profile_id = auth.uid()",
        },
      ],
      extras: { extraCustom: "hello" },
    },
  ],
  enums: [{ name: "quest_status", values: ["draft", "active", "done"] }],
  functions: [
    {
      name: "download_quest_closure",
      params: [
        { name: "quest_id", type: "uuid" },
        { name: "profile_id", type: "uuid" },
      ],
      returns: "void",
      security: "definer",
      touches: ["quest", "asset"],
      doc: "stamps closure",
    },
  ],
  relations: [
    {
      src: { table: "quest", field: "parent_id" },
      dst: { table: "quest", field: "id" },
      cardinality: "n:1",
    },
  ],
};

function stripUndefined<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

describe("aml round-trip", () => {
  it("is lossless for tables, extras, triggers, rls, rpc, and relations", () => {
    const text = generateSchema(rich);
    const { schema, errors } = parseSchema(text);
    expect(errors.filter((e) => e.severity === "error")).toEqual([]);
    expect(schema).not.toBeNull();
    expect(stripUndefined(schema)).toEqual(stripUndefined(rich));
  });

  it("round-trips 1:1 cardinality", () => {
    const schema: Schema = {
      tables: [
        {
          name: "a",
          rlsEnabled: false,
          fields: [{ name: "id", type: "uuid", nullable: false, pk: true }],
          triggers: [],
          policies: [],
        },
        {
          name: "b",
          rlsEnabled: false,
          fields: [
            { name: "id", type: "uuid", nullable: false, pk: true },
            { name: "a_id", type: "uuid", nullable: false, pk: false },
          ],
          triggers: [],
          policies: [],
        },
      ],
      enums: [],
      functions: [],
      relations: [
        {
          src: { table: "b", field: "a_id" },
          dst: { table: "a", field: "id" },
          cardinality: "1:1",
        },
      ],
    };
    const { schema: again } = parseSchema(generateSchema(schema));
    expect(again?.relations[0].cardinality).toBe("1:1");
  });

  it("surfaces codec warnings without losing the raw property on malformed triggers", () => {
    const { schema, errors } = parseSchema(`quest {triggers: ["not-a-trigger"]}
  id uuid pk
`);
    expect(schema).not.toBeNull();
    expect(schema?.tables[0].triggers).toEqual([]);
    expect(errors.some((e) => e.severity === "warning")).toBe(true);
  });
});
