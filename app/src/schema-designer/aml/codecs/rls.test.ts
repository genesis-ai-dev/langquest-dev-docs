import { describe, expect, it } from "vitest";
import { parsePolicy, serializePolicy } from "./rls";

describe("rls codec", () => {
  it("parses using-only policies", () => {
    const { policy } = parsePolicy("select to authenticated: is_project_member(project_id)");
    expect(policy).toEqual({
      command: "select",
      role: "authenticated",
      using: "is_project_member(project_id)",
      check: undefined,
    });
    expect(serializePolicy(policy!)).toBe(
      "select to authenticated: is_project_member(project_id)",
    );
  });

  it("parses check-only policies", () => {
    const { policy } = parsePolicy("insert to authenticated: check profile_id = auth.uid()");
    expect(policy).toEqual({
      command: "insert",
      role: "authenticated",
      using: undefined,
      check: "profile_id = auth.uid()",
    });
  });

  it("parses using + check", () => {
    const { policy } = parsePolicy("update: using old_row() check new_row()");
    expect(policy?.using).toBe("old_row()");
    expect(policy?.check).toBe("new_row()");
  });

  it("warns on malformed input", () => {
    const { policy, warning } = parsePolicy("not a policy");
    expect(policy).toBeUndefined();
    expect(warning).toBeDefined();
  });
});
