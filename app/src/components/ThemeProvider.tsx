import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

type Theme = "dark" | "light";

const ThemeCtx = createContext<{ theme: Theme; toggle: () => void }>({
  theme: "dark",
  toggle: () => {},
});

export function useTheme() {
  return useContext(ThemeCtx);
}

export function ThemeProvider({
  storageKey,
  children,
}: {
  storageKey: string;
  children: ReactNode;
}) {
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      return (localStorage.getItem(storageKey) as Theme) ?? "dark";
    } catch {
      return "dark";
    }
  });

  useEffect(() => {
    document.documentElement.classList.toggle("light", theme === "light");
    try {
      localStorage.setItem(storageKey, theme);
    } catch {}
  }, [theme, storageKey]);

  const toggle = useCallback(
    () => setTheme((t) => (t === "dark" ? "light" : "dark")),
    [],
  );

  return (
    <ThemeCtx.Provider value={{ theme, toggle }}>{children}</ThemeCtx.Provider>
  );
}
