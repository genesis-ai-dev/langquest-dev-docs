import { describe, expect, it } from "vitest";
import { parseTrigger, parseTriggerList, serializeTrigger } from "./triggers";

describe("trigger codec", () => {
  it("parses timing, events, condition, and function", () => {
    const { trigger } = parseTrigger(
      "after delete when (OLD.active): cleanup_closure",
    );
    expect(trigger).toEqual({
      timing: "after",
      events: ["delete"],
      condition: "OLD.active",
      fn: "cleanup_closure",
    });
    expect(serializeTrigger(trigger!)).toBe(
      "after delete when (OLD.active): cleanup_closure",
    );
  });

  it("parses multiple events", () => {
    const { trigger } = parseTrigger("before insert,update: set_updated_at");
    expect(trigger?.events).toEqual(["insert", "update"]);
    expect(serializeTrigger(trigger!)).toBe("before insert,update: set_updated_at");
  });

  it("warns on malformed input without throwing", () => {
    const { trigger, warning } = parseTrigger("not a trigger");
    expect(trigger).toBeUndefined();
    expect(warning?.raw).toBe("not a trigger");
    const list = parseTriggerList(["before insert: ok", 12, "nope"]);
    expect(list.triggers).toHaveLength(1);
    expect(list.warnings).toHaveLength(2);
  });
});
