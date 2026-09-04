import { describe, expect, it } from "vitest";
import { moveStage, type StageMeta } from "./project";

function stage(id: string): StageMeta {
  return { id, file: `stages/${id}.aml`, title: id, description: "", status: "planned" };
}

describe("moveStage", () => {
  const abc = [stage("a"), stage("b"), stage("c")];

  it("moves a stage to a later index", () => {
    expect(moveStage(abc, "a", 2).map((s) => s.id)).toEqual(["b", "c", "a"]);
  });

  it("moves a stage to an earlier index", () => {
    expect(moveStage(abc, "c", 0).map((s) => s.id)).toEqual(["c", "a", "b"]);
  });

  it("returns the same array when the index does not change", () => {
    expect(moveStage(abc, "b", 1)).toBe(abc);
  });

  it("clamps out-of-range indexes and ignores unknown ids", () => {
    expect(moveStage(abc, "a", 99).map((s) => s.id)).toEqual(["b", "c", "a"]);
    expect(moveStage(abc, "missing", 0)).toBe(abc);
  });
});
