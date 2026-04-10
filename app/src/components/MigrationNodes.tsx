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
  storage: "text-accent-green",
  bridge: "text-accent-blue",
};

const CAT_BORDER: Record<string, string> = {
  dev: "border-accent-amber/40",
  server: "border-accent-green/40",
  client: "border-accent-cyan/40",
  external: "border-accent-pink/40",
  auth: "border-accent-purple/40",
  service: "border-accent-amber/40",
  storage: "border-accent-green/40",
  bridge: "border-accent-blue/40",
};

// ── Standard node (Git repo, CI/CD, Postgres, etc.) ──

export interface MigrationNodeData {
  label: string;
  subtitle?: string;
  badge?: string;
  category: string;
  revealed: boolean;
  [key: string]: unknown;
}

export type MigrationNodeType = Node<MigrationNodeData>;

export function MigrationNode({ data }: NodeProps<MigrationNodeType>) {
  return (
    <div
      className={cn(
        "border-2 rounded-[10px] bg-card flex flex-col justify-center px-3.5 relative select-none",
        CAT_BORDER[data.category] ?? "border-border",
        "hover:border-border-hi shadow-[0_2px_16px_rgba(0,0,0,.35)]",
        "transition-[opacity,transform] duration-400",
        data.revealed
          ? "opacity-100 scale-100"
          : "opacity-0 scale-[0.97] pointer-events-none",
      )}
      style={{ width: "100%", height: "100%" }}
    >
      {data.badge && (
        <span className="absolute top-1.5 right-2 font-mono text-[.48rem] text-txt-muted uppercase tracking-[.06em]">
          {data.badge}
        </span>
      )}
      <div
        className={cn(
          "font-mono text-[.75rem] font-semibold leading-tight",
          CAT_COLORS[data.category] ?? "text-txt",
        )}
      >
        {data.label}
      </div>
      {data.subtitle && (
        <div className="text-[.62rem] text-txt-muted mt-0.5">
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
        "transition-[opacity] duration-400",
        data.revealed ? "opacity-100" : "opacity-0 pointer-events-none",
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
          "absolute top-2 left-3 font-mono text-[.55rem] font-semibold uppercase tracking-[.08em]",
          CAT_COLORS[data.category] ?? "text-txt-muted",
        )}
      >
        {data.label}
      </span>
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
