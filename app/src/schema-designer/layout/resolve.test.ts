import { describe, expect, it } from "vitest";
import { autoPlace, resolveLayout, withEdgeLayout, withEdgesStubbed, withNodePosition } from "./resolve";
import { emptyLayoutDoc, type ResolvedLayout } from "./types";

describe("layout resolution", () => {
  it("applies base then stage overrides in order", () => {
    const doc = emptyLayoutDoc();
    doc.base.nodes.quest = { x: 10, y: 20 };
    doc.stages["01"] = { nodes: { quest: { x: 50, y: 20 }, extra: { x: 1, y: 2 } }, edges: {} };
    doc.stages["02"] = { nodes: { quest: { y: 90 } }, edges: {} };

    const at0 = resolveLayout(doc, ["00", "01", "02"], "00");
    expect(at0.nodes.quest).toMatchObject({ x: 10, y: 20 });
    expect(at0.nodes.extra).toBeUndefined();

    const at1 = resolveLayout(doc, ["00", "01", "02"], "01");
    expect(at1.nodes.quest).toMatchObject({ x: 50, y: 20 });
    expect(at1.nodes.extra).toMatchObject({ x: 1, y: 2 });

    const at2 = resolveLayout(doc, ["00", "01", "02"], "02");
    expect(at2.nodes.quest).toMatchObject({ x: 50, y: 90 });
  });

  it("writes the first stage into base and later stages into overrides", () => {
    const order = ["00", "01"];
    let doc = withNodePosition(emptyLayoutDoc(), order, "00", "quest", { x: 1, y: 2 });
    expect(doc.base.nodes.quest).toMatchObject({ x: 1, y: 2 });
    expect(doc.stages["00"]).toBeUndefined();
    doc = withNodePosition(doc, order, "01", "quest", { x: 8, y: 9 });
    expect(doc.stages["01"].nodes.quest).toMatchObject({ x: 8, y: 9 });
    expect(doc.base.nodes.quest).toMatchObject({ x: 1, y: 2 });
  });

  it("cascades stub flags on edges", () => {
    const order = ["00", "01"];
    let doc = withEdgeLayout(emptyLayoutDoc(), order, "00", "asset.project_id->project.id", { stub: true });
    expect(resolveLayout(doc, order, "00").edges["asset.project_id->project.id"]?.stub).toBe(true);
    doc = withEdgesStubbed(doc, order, "01", ["asset.project_id->project.id"], false);
    expect(resolveLayout(doc, order, "00").edges["asset.project_id->project.id"]?.stub).toBe(true);
    expect(resolveLayout(doc, order, "01").edges["asset.project_id->project.id"]?.stub).toBe(false);
  });

  it("auto-places into a free grid cell", () => {
    const existing: ResolvedLayout = {
      nodes: { a: { x: 80, y: 80 } },
      edges: {},
    };
    const pos = autoPlace(existing);
    expect(pos).toEqual({ x: 360, y: 80 });
  });
});
