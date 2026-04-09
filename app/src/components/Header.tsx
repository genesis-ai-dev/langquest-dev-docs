import { useTheme } from "./ThemeProvider";
import type { ReactNode } from "react";

export function Header({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle: string;
  actions?: ReactNode;
}) {
  const { theme, toggle } = useTheme();

  return (
    <header className="flex items-center justify-between px-5 py-2 border-b border-border bg-bg shrink-0 z-50 gap-3">
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
    </header>
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
