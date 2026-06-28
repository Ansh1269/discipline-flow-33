import { useEffect, useState, useCallback } from "react";

export type Theme = "light" | "dark";
const KEY = "discipline-theme";

function getInitial(): Theme {
  if (typeof window === "undefined") return "dark";
  const stored = window.localStorage.getItem(KEY) as Theme | null;
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia?.("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

function apply(theme: Theme) {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.style.colorScheme = theme;
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => (typeof window === "undefined" ? "dark" : getInitial()));

  useEffect(() => {
    apply(theme);
    try { window.localStorage.setItem(KEY, theme); } catch {}
  }, [theme]);

  const toggle = useCallback(() => setTheme((t) => (t === "dark" ? "light" : "dark")), []);
  return { theme, setTheme, toggle };
}

export function initThemeOnce() {
  if (typeof window === "undefined") return;
  apply(getInitial());
}
