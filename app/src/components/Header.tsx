import { useTheme } from "./ThemeProvider";
import type { ReactNode } from "react";

interface NavItem {
  label: string;
  hash: string;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Schema", hash: "" },
  { label: "Migration", hash: "#migration" },
  { label: "Sync", hash: "#sync" },
  { label: "CI/CD", hash: "#cicd" },
  { label: "Auth", hash: "#auth" },
  { label: "Content Templates", hash: "#template" },
  { label: "Process Templates", hash: "#workflow" },
];

export function Header({
  title,
  subtitle,
  actions,
  currentHash,
}: {
  title: string;
  subtitle: string;
  actions?: ReactNode;
  currentHash?: string;
}) {
  const { theme, toggle } = useTheme();
  const activeHash = currentHash ?? window.location.hash;

  return (
    <header className="border-b border-border bg-bg shrink-0 z-50">
      {/* Top row: title + page-specific actions + theme toggle */}
      <div className="flex items-center justify-between px-5 py-2 gap-3">
        <div>
          <h1 className="text-[.95rem] font-semibold">{title}</h1>
          <p className="font-mono text-[.52rem] text-txt-dim uppercase tracking-[.12em] mt-px">
            {subtitle}
          </p>
        </div>
        <div className="flex gap-1.5">
          {actions}
          <HeaderButton onClick={toggle}>
            {theme === "dark" ? "☀ Light" : "☾ Dark"}
          </HeaderButton>
        </div>
      </div>
      {/* Navigation row: fixed across all pages */}
      <div className="flex items-center gap-1 px-5 pb-2 overflow-x-auto">
        {NAV_ITEMS.map((item) => (
          <NavButton
            key={item.hash}
            active={activeHash === item.hash}
            onClick={() => (window.location.hash = item.hash)}
          >
            {item.label}
          </NavButton>
        ))}
      </div>
    </header>
  );
}

function NavButton({
  onClick,
  children,
  active,
}: {
  onClick: () => void;
  children: ReactNode;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`font-mono text-[.6rem] px-2.5 py-1 rounded-md border cursor-pointer transition-all whitespace-nowrap ${
        active
          ? "border-accent-purple text-accent-purple bg-accent-purple/10"
          : "border-transparent text-txt-dim hover:text-txt hover:bg-card"
      }`}
    >
      {children}
    </button>
  );
}

export function HeaderButton({
  onClick,
  children,
  active,
}: {
  onClick: () => void;
  children: ReactNode;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`font-mono text-[.65rem] px-3 py-1.5 rounded-lg border cursor-pointer transition-all ${
        active
          ? "border-accent-pink text-accent-pink bg-accent-pink/4"
          : "border-border bg-card text-txt-muted hover:border-border-hi hover:text-txt"
      }`}
    >
      {children}
    </button>
  );
}
