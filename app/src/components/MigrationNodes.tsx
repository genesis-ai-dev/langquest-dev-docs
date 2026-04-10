import { Handle, Position, NodeResizer, type NodeProps, type Node } from "@xyflow/react";
import { cn } from "../cn";

function Handles() {
  const cls = "!opacity-0 !w-px !h-px !min-w-0 !min-h-0";
  return (
    <>
      <Handle type="source" position={Position.Top} id="top" className={cls} />
      <Handle type="target" position={Position.Top} id="top" className={cls} />
      <Handle type="source" position={Position.Bottom} id="bottom" className={cls} />
      <Handle type="target" position={Position.Bottom} id="bottom" className={cls} />
      <Handle type="source" position={Position.Left} id="left" className={cls} />
      <Handle type="target" position={Position.Left} id="left" className={cls} />
      <Handle type="source" position={Position.Right} id="right" className={cls} />
      <Handle type="target" position={Position.Right} id="right" className={cls} />
    </>
  );
}

const CAT_COLORS: Record<string, string> = {
  dev: "text-accent-amber",
  server: "text-accent-green",
  client: "text-accent-cyan",
  external: "text-accent-pink",
  auth: "text-accent-purple",
  service: "text-accent-amber",
  storage: "text-accent-pink",
  bridge: "text-accent-blue",
  supabase: "text-accent-green",
  powersync: "text-accent-purple",
  authflow: "text-accent-cyan",
};

const CAT_BORDER: Record<string, string> = {
  dev: "border-accent-amber/40",
  server: "border-accent-green/40",
  client: "border-accent-cyan/40",
  external: "border-accent-pink/40",
  auth: "border-accent-purple/40",
  service: "border-accent-amber/40",
  storage: "border-accent-pink/40",
  bridge: "border-accent-blue/40",
  supabase: "border-accent-green/40",
  powersync: "border-accent-purple/40",
  authflow: "border-accent-cyan/40",
};

// ── Standard node (Git repo, CI/CD, Postgres, etc.) ──

export interface MigrationNodeData {
  label: string;
  subtitle?: string;
  badge?: string;
  category: string;
  revealed: boolean;
  highlighted?: boolean;
  [key: string]: unknown;
}

export type MigrationNodeType = Node<MigrationNodeData>;

export function MigrationNode({ data }: NodeProps<MigrationNodeType>) {
  return (
    <div
      className={cn(
        "border-2 rounded-[10px] bg-card flex flex-col justify-center px-3.5 relative select-none overflow-hidden",
        CAT_BORDER[data.category] ?? "border-border",
        "hover:border-border-hi shadow-[0_2px_16px_rgba(0,0,0,.35)]",
        "transition-[opacity,transform,box-shadow] duration-400",
        data.revealed
          ? "opacity-100 scale-100"
          : "opacity-0 scale-[0.97] pointer-events-none",
        data.highlighted &&
          "ring-2 ring-white/25 shadow-[0_0_24px_rgba(255,255,255,.12)]",
      )}
      style={{ width: "100%", height: "100%" }}
    >
      {data.badge && (
        <span className="absolute top-1.5 right-2 font-mono text-[.55rem] text-txt-dim uppercase tracking-[.06em] font-semibold">
          {data.badge}
        </span>
      )}
      <div
        className={cn(
          "font-mono text-[.85rem] font-semibold leading-tight",
          CAT_COLORS[data.category] ?? "text-txt",
        )}
      >
        {data.label}
      </div>
      {data.subtitle && (
        <div className="text-[.7rem] text-txt mt-0.5 opacity-70">
          {data.subtitle}
        </div>
      )}
      <Handles />
    </div>
  );
}

// ── Container node (App, Transform RPC, local-only, synced, PowerSync) ──

export interface ContainerNodeData {
  label: string;
  category: string;
  revealed: boolean;
  highlighted?: boolean;
  [key: string]: unknown;
}

export type ContainerNodeType = Node<ContainerNodeData>;

export function ContainerNode({ data, selected }: NodeProps<ContainerNodeType>) {
  return (
    <div
      className={cn(
        "border-2 border-dashed rounded-[14px] relative",
        CAT_BORDER[data.category] ?? "border-border",
        "bg-card/25",
        "transition-[opacity,box-shadow] duration-400",
        data.revealed ? "opacity-100" : "opacity-0 pointer-events-none",
        data.highlighted && "ring-1 ring-white/15",
      )}
      style={{ width: "100%", height: "100%" }}
    >
      <NodeResizer
        isVisible={selected}
        minWidth={80}
        minHeight={40}
        lineClassName="!border-accent-cyan/40"
        handleClassName="!w-2 !h-2 !bg-accent-cyan/60 !border-accent-cyan"
      />
      <span
        className={cn(
          "absolute top-2 left-3 font-mono text-[.65rem] font-semibold uppercase tracking-[.08em]",
          CAT_COLORS[data.category] ?? "text-txt-muted",
        )}
      >
        {data.label}
      </span>
      <Handles />
    </div>
  );
}

// ── Detail node (expandable item list) ──

export interface DetailNodeData {
  label: string;
  items?: Array<{ name: string; desc: string }>;
  category: string;
  revealed: boolean;
  highlighted?: boolean;
  [key: string]: unknown;
}

export type DetailNodeType = Node<DetailNodeData>;

export function DetailNode({ data }: NodeProps<DetailNodeType>) {
  return (
    <div
      className={cn(
        "border-2 rounded-[10px] bg-card px-3 py-2.5 relative select-none overflow-hidden",
        CAT_BORDER[data.category] ?? "border-border",
        "shadow-[0_2px_16px_rgba(0,0,0,.35)]",
        "transition-[opacity,transform,box-shadow] duration-400",
        data.revealed
          ? "opacity-100 scale-100"
          : "opacity-0 scale-[0.97] pointer-events-none",
        data.highlighted &&
          "ring-2 ring-white/25 shadow-[0_0_24px_rgba(255,255,255,.12)]",
      )}
      style={{ width: "100%", height: "100%" }}
    >
      <div
        className={cn(
          "font-mono text-[.75rem] font-semibold mb-1.5 pb-1 border-b border-border/50",
          CAT_COLORS[data.category] ?? "text-txt",
        )}
      >
        {data.label}
      </div>
      <div className="flex flex-col gap-1">
        {data.items?.map((item) => (
          <div key={item.name} className="flex items-baseline gap-2">
            <span className="font-mono text-[.7rem] text-txt font-medium shrink-0">
              {item.name}
            </span>
            <span className="text-[.6rem] text-txt-muted truncate">
              {item.desc}
            </span>
          </div>
        ))}
      </div>
      <Handles />
    </div>
  );
}

// ── Version box (small version label) ──

export interface VersionBoxData {
  label: string;
  revealed: boolean;
  [key: string]: unknown;
}

export type VersionBoxType = Node<VersionBoxData>;

export function VersionBoxNode({ data }: NodeProps<VersionBoxType>) {
  return (
    <div
      className={cn(
        "border-2 rounded-lg flex items-center justify-center select-none",
        "border-accent-amber/50 bg-accent-amber/5 hover:border-accent-amber/70",
        "transition-[opacity] duration-400",
        data.revealed
          ? "opacity-100"
          : "opacity-0 pointer-events-none",
      )}
      style={{ width: "100%", height: "100%" }}
    >
      <div className="text-center">
        <div className="font-mono text-[.44rem] text-txt-muted leading-none mb-0.5">
          version
        </div>
        <div className="font-mono text-[.78rem] font-bold text-accent-amber leading-none">
          {data.label}
        </div>
      </div>
      <Handles />
    </div>
  );
}

// ── Label node (APP_SCHEMA_VERSION) ──

export interface LabelNodeData {
  label: string;
  revealed: boolean;
  [key: string]: unknown;
}

export type LabelNodeType = Node<LabelNodeData>;

export function LabelNode({ data }: NodeProps<LabelNodeType>) {
  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-md border border-accent-pink/30 bg-accent-pink/5",
        "transition-[opacity] duration-400",
        data.revealed ? "opacity-100" : "opacity-0 pointer-events-none",
      )}
      style={{ width: "100%", height: "100%" }}
    >
      <span className="font-mono text-[.62rem] text-accent-pink font-bold">
        {data.label}
      </span>
    </div>
  );
}
