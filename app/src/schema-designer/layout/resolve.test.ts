import { describe, expect, it } from "vitest";
import {
  autoPlace,
  nextGroupId,
  resolveLayout,
  withEdgeLayout,
  withEdgesStubbed,
  normalizeLayout,
  withGroup,
  withNodePosition,
  withNodePositions,
  withoutGroup,
} from "./resolve";
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
      groups: {},
    };
    const pos = autoPlace(existing);
    expect(pos).toEqual({ x: 360, y: 80 });
  });

  it("stores groups on the first stage only", () => {
    const group = {
      id: nextGroupId({}),
      label: "Auth",
      color: "purple" as const,
      x: 10,
      y: 20,
      width: 200,
      height: 120,
    };
    expect(group.id).toBe("g1");
    const order = ["00", "01"];
    let doc = withGroup(emptyLayoutDoc(), order, "00", group);
    expect(resolveLayout(doc, order, "00").groups.g1.label).toBe("Auth");
    expect(resolveLayout(doc, order, "01").groups.g1).toBeUndefined();
    doc = withGroup(doc, order, "00", { ...group, label: "Identity" });
    expect(doc.base.groups?.g1.label).toBe("Identity");
    doc = withoutGroup(doc, order, "00", "g1");
    expect(doc.base.groups?.g1).toBeUndefined();
  });

  it("keeps later-stage groups off the first stage", () => {
    const order = ["00", "01"];
    const group = {
      id: "g1",
      label: "Later",
      color: "cyan" as const,
      x: 4,
      y: 5,
      width: 100,
      height: 80,
    };
    const doc = withGroup(emptyLayoutDoc(), order, "01", group);
    expect(resolveLayout(doc, order, "00").groups.g1).toBeUndefined();
    expect(resolveLayout(doc, order, "01").groups.g1.label).toBe("Later");
    expect(doc.stages["01"].groups?.g1.label).toBe("Later");
  });

  it("shows leftover top-level groups only on the first stage", () => {
    const doc = emptyLayoutDoc();
    doc.groups = {
      g1: {
        id: "g1",
        label: "Legacy",
        color: "amber",
        x: 1,
        y: 2,
        width: 10,
        height: 10,
      },
    };
    const order = ["00", "01"];
    expect(resolveLayout(doc, order, "00").groups.g1.label).toBe("Legacy");
    expect(resolveLayout(doc, order, "01").groups.g1).toBeUndefined();
    const migrated = normalizeLayout(doc);
    expect(migrated.base.groups?.g1.label).toBe("Legacy");
    expect(migrated.groups).toEqual({});
  });

  it("writes several node positions in one pass", () => {
    const doc = withNodePositions(emptyLayoutDoc(), ["00"], "00", {
      quest: { x: 1, y: 2 },
      asset: { x: 3, y: 4 },
    });
    expect(doc.base.nodes.quest).toMatchObject({ x: 1, y: 2 });
    expect(doc.base.nodes.asset).toMatchObject({ x: 3, y: 4 });
  });
});
