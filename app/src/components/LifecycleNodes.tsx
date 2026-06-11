import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import { cn } from "../cn";

const HANDLE_CLS = "!opacity-0 !w-1 !h-1 !min-w-0 !min-h-0";

// ─── Table Box Node ──────────────────────────────────────────────────────────

export interface LcTableData {
  title: string;
  subtitle?: string;
  color: string;
  dimmed?: boolean;
  fields: { name: string; pk?: boolean; fk?: boolean; highlight?: boolean }[];
  [key: string]: unknown;
}

export type LcTableNode = Node<LcTableData>;

export function LcTable({ data }: NodeProps<LcTableNode>) {
  const color = data.color;
  return (
    <div
      className={cn(
        "border rounded-lg bg-card min-w-[160px] max-w-[200px] font-mono text-[.6rem] select-none",
        data.dimmed && "opacity-35"
      )}
      style={{ borderColor: color }}
    >
      <div className="px-2 py-1.5">
        <div className="font-semibold text-[.7rem]" style={{ color }}>{data.title}</div>
        {data.subtitle && (
          <div className="text-[.48rem] text-txt-dim uppercase tracking-[.06em] mt-px">{data.subtitle}</div>
        )}
      </div>
      <div style={{ borderColor: color, borderTopWidth: 1, opacity: 0.3 }} />
      {data.fields.map((f) => (
        <div key={f.name} className="relative px-2 py-[3px]">
          {f.pk && (
            <div className="absolute inset-x-1 inset-y-0 rounded-sm" style={{ background: color, opacity: 0.12 }} />
          )}
          <span className={cn("relative", f.highlight ? "text-accent-amber font-semibold" : f.pk ? "font-semibold" : "text-txt-muted")}
            style={f.pk ? { color } : undefined}>
            {f.name}
          </span>
          {f.fk && <span className="ml-1 text-[.42rem] text-accent-purple opacity-60">FK</span>}
        </div>
      ))}
      <Handle type="source" position={Position.Right} className={HANDLE_CLS} />
      <Handle type="target" position={Position.Left} className={HANDLE_CLS} />
      <Handle type="source" position={Position.Bottom} id="bottom" className={HANDLE_CLS} />
      <Handle type="target" position={Position.Top} id="top" className={HANDLE_CLS} />
    </div>
  );
}

// ─── JSON Block Node ─────────────────────────────────────────────────────────

export interface LcJsonData {
  lines: { text: string; indent?: number; color?: string; dim?: boolean; highlight?: boolean }[];
  [key: string]: unknown;
}

export type LcJsonNode = Node<LcJsonData>;

export function LcJson({ data }: NodeProps<LcJsonNode>) {
  return (
    <div className="border border-border rounded bg-card px-2 py-1.5 font-mono text-[.52rem] leading-[1.7] select-none min-w-[180px] max-w-[240px]">
      {data.lines.map((l, i) => (
        <div key={i} style={{ paddingLeft: (l.indent ?? 0) * 8 }}
          className={cn(l.dim && "opacity-40", l.highlight && "font-bold text-accent-red")}>
          <span style={{ color: l.highlight ? undefined : l.color }}>{l.text}</span>
        </div>
      ))}
      <Handle type="source" position={Position.Right} className={HANDLE_CLS} />
      <Handle type="target" position={Position.Left} className={HANDLE_CLS} />
    </div>
  );
}

// ─── Tree Icons Node ─────────────────────────────────────────────────────────

interface TreeIconItem {
  type: "folder" | "file";
  label: string;
  nodeId: string;
  indent: number;
  deleted?: boolean;
}

export interface LcTreeData {
  items: TreeIconItem[];
  [key: string]: unknown;
}

export type LcTreeNode = Node<LcTreeData>;

function FolderSvg({ deleted }: { deleted?: boolean }) {
  const color = deleted ? "var(--color-txt-dim)" : "var(--color-accent-blue)";
  return (
    <svg width={24} height={20} viewBox="0 0 24 20">
      <rect x={0} y={3} width={24} height={17} rx={2} fill="transparent" stroke={color} strokeWidth={1.6}
        strokeDasharray={deleted ? "3 2" : undefined} />
      <rect x={0} y={3} width={10} height={4} rx={1} fill={color} opacity={0.6} />
    </svg>
  );
}

function FileSvg({ deleted }: { deleted?: boolean }) {
  const color = deleted ? "var(--color-txt-dim)" : "var(--color-accent-blue)";
  return (
    <svg width={20} height={24} viewBox="0 0 20 24">
      <rect x={0} y={0} width={20} height={24} rx={2} fill="transparent" stroke={color} strokeWidth={1.4}
        strokeDasharray={deleted ? "3 2" : undefined} />
      <line x1={4} y1={8} x2={16} y2={8} stroke={color} strokeWidth={0.8} opacity={0.5} />
      <line x1={4} y1={12} x2={16} y2={12} stroke={color} strokeWidth={0.8} opacity={0.5} />
      <line x1={4} y1={16} x2={12} y2={16} stroke={color} strokeWidth={0.8} opacity={0.5} />
    </svg>
  );
}

export function LcTree({ data }: NodeProps<LcTreeNode>) {
  return (
    <div className="select-none flex flex-col gap-1.5">
      {data.items.map((item, i) => (
        <div key={i} className={cn("flex items-center gap-1.5", item.deleted && "opacity-35")}
          style={{ paddingLeft: item.indent * 16 }}>
          {item.type === "folder" ? <FolderSvg deleted={item.deleted} /> : <FileSvg deleted={item.deleted} />}
          <div>
            <div className="font-mono text-[.52rem] text-txt-dim">node_id</div>
            <div className={cn("font-mono text-[.6rem] font-semibold", item.deleted ? "text-txt-dim line-through" : "text-txt")}>
              {item.label}
            </div>
          </div>
        </div>
      ))}
      <Handle type="source" position={Position.Right} className={HANDLE_CLS} />
      <Handle type="target" position={Position.Left} className={HANDLE_CLS} />
    </div>
  );
}

// ─── Annotation Box Node ─────────────────────────────────────────────────────

export interface LcNoteData {
  lines: { text: string; color?: string; bold?: boolean; size?: string }[];
  borderColor?: string;
  [key: string]: unknown;
}

export type LcNoteNode = Node<LcNoteData>;

export function LcNote({ data }: NodeProps<LcNoteNode>) {
  return (
    <div className="border rounded-lg bg-card px-4 py-3 font-mono select-none min-w-[180px] max-w-[280px]"
      style={{ borderColor: data.borderColor ?? "var(--color-border)" }}>
      {data.lines.map((l, i) => (
        <div key={i} className={cn("leading-relaxed", l.bold && "font-semibold")}
          style={{ color: l.color ?? "var(--color-txt-muted)", fontSize: l.size ?? "0.6rem" }}>
          {l.text}
        </div>
      ))}
      <Handle type="source" position={Position.Right} className={HANDLE_CLS} />
      <Handle type="target" position={Position.Left} className={HANDLE_CLS} />
    </div>
  );
}

// ─── Label Node ──────────────────────────────────────────────────────────────

export interface LcLabelData {
  text: string;
  color?: string;
  fontSize?: string;
  bold?: boolean;
  [key: string]: unknown;
}

export type LcLabelNode = Node<LcLabelData>;

export function LcLabel({ data }: NodeProps<LcLabelNode>) {
  return (
    <div className="font-mono select-none pointer-events-none whitespace-nowrap"
      style={{
        color: data.color ?? "var(--color-txt-dim)",
        fontSize: data.fontSize ?? "0.7rem",
        fontWeight: data.bold ? 700 : 400,
        letterSpacing: data.bold ? "0.04em" : undefined,
      }}>
      {data.text}
      <Handle type="source" position={Position.Bottom} className={HANDLE_CLS} />
      <Handle type="target" position={Position.Top} className={HANDLE_CLS} />
    </div>
  );
}
