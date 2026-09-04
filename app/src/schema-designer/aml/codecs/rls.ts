import type { Policy, PolicyCommand } from "../../domain/types";
import type { CodecWarning } from "../types";

const COMMANDS = new Set<PolicyCommand>(["select", "insert", "update", "delete", "all"]);

const POLICY_RE = /^(select|insert|update|delete|all)(?:\s+to\s+(\S+))?\s*:\s*(.*)$/i;

export function parsePolicy(raw: string): { policy?: Policy; warning?: CodecWarning } {
  const match = raw.trim().match(POLICY_RE);
  if (!match) {
    return { warning: { message: `Unparseable RLS policy: ${raw}`, raw } };
  }
  const command = match[1].toLowerCase() as PolicyCommand;
  if (!COMMANDS.has(command)) {
    return { warning: { message: `Unknown RLS command: ${match[1]}`, raw } };
  }
  let rest = match[3].trim();
  if (rest.toLowerCase().startsWith("using ")) rest = rest.slice(6).trim();

  let using: string | undefined;
  let check: string | undefined;
  const checkOnly = /^check\s+/i.exec(rest);
  if (checkOnly) {
    check = rest.slice(checkOnly[0].length).trim() || undefined;
  } else {
    const split = rest.match(/^(.*?)\s+check\s+(.*)$/i);
    if (split) {
      using = split[1].trim() || undefined;
      check = split[2].trim() || undefined;
    } else {
      using = rest || undefined;
    }
  }
  if (!using && !check) {
    return { warning: { message: `RLS policy is missing an expression: ${raw}`, raw } };
  }
  return {
    policy: {
      command,
      role: match[2] || undefined,
      using,
      check,
    },
  };
}

export function serializePolicy(policy: Policy): string {
  const role = policy.role ? ` to ${policy.role}` : "";
  const parts: string[] = [];
  if (policy.using) parts.push(policy.using);
  if (policy.check) parts.push(`check ${policy.check}`);
  return `${policy.command}${role}: ${parts.join(" ")}`;
}

export function parsePolicyList(raw: unknown): { policies: Policy[]; warnings: CodecWarning[] } {
  const items = Array.isArray(raw) ? raw : raw == null ? [] : [raw];
  const policies: Policy[] = [];
  const warnings: CodecWarning[] = [];
  for (const item of items) {
    if (typeof item !== "string") {
      warnings.push({ message: "RLS policy entry is not a string", raw: String(item) });
      continue;
    }
    const parsed = parsePolicy(item);
    if (parsed.policy) policies.push(parsed.policy);
    if (parsed.warning) warnings.push(parsed.warning);
  }
  return { policies, warnings };
}

export function isRlsEnabled(raw: unknown): boolean {
  return raw === null || raw === true || raw === "" || raw === "true";
}
