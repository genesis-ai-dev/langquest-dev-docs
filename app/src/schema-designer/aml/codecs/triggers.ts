import type { Trigger, TriggerEvent, TriggerTiming } from "../../domain/types";
import type { CodecWarning } from "../types";

const TIMINGS = new Set<TriggerTiming>(["before", "after", "instead_of"]);
const EVENTS = new Set<TriggerEvent>(["insert", "update", "delete", "truncate"]);

const TRIGGER_RE =
  /^(before|after|instead_of)\s+([a-z]+(?:,\s*[a-z]+)*)(?:\s+when\s+\((.*)\))?\s*:\s*(\S+)\s*$/i;

export function parseTrigger(raw: string): { trigger?: Trigger; warning?: CodecWarning } {
  const match = raw.trim().match(TRIGGER_RE);
  if (!match) {
    return { warning: { message: `Unparseable trigger: ${raw}`, raw } };
  }
  const timing = match[1].toLowerCase() as TriggerTiming;
  if (!TIMINGS.has(timing)) {
    return { warning: { message: `Unknown trigger timing: ${match[1]}`, raw } };
  }
  const events = match[2]
    .split(",")
    .map((e) => e.trim().toLowerCase() as TriggerEvent)
    .filter((e) => EVENTS.has(e));
  if (events.length === 0) {
    return { warning: { message: `Trigger has no valid events: ${raw}`, raw } };
  }
  return {
    trigger: {
      timing,
      events,
      condition: match[3] || undefined,
      fn: match[4],
    },
  };
}

export function serializeTrigger(trigger: Trigger): string {
  const events = trigger.events.join(",");
  const when = trigger.condition ? ` when (${trigger.condition})` : "";
  return `${trigger.timing} ${events}${when}: ${trigger.fn}`;
}

export function parseTriggerList(raw: unknown): { triggers: Trigger[]; warnings: CodecWarning[] } {
  const items = Array.isArray(raw) ? raw : raw == null ? [] : [raw];
  const triggers: Trigger[] = [];
  const warnings: CodecWarning[] = [];
  for (const item of items) {
    if (typeof item !== "string") {
      warnings.push({ message: "Trigger entry is not a string", raw: String(item) });
      continue;
    }
    const parsed = parseTrigger(item);
    if (parsed.trigger) triggers.push(parsed.trigger);
    if (parsed.warning) warnings.push(parsed.warning);
  }
  return { triggers, warnings };
}
