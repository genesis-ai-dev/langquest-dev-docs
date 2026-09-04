import type { ChangeKind } from "../diff/types";

export function kindBadge(kind?: ChangeKind): string {
  if (kind === "added") return "+";
  if (kind === "removed") return "−";
  if (kind === "modified") return "~";
  if (kind === "renamed") return "→";
  return "";
}

export function kindLabel(kind?: ChangeKind): string {
  if (kind === "added") return "added";
  if (kind === "removed") return "removed";
  if (kind === "modified") return "modified";
  if (kind === "renamed") return "renamed";
  return "";
}
