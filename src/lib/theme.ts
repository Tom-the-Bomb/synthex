import { useSyncExternalStore } from "react";

export type Theme = "light" | "dark";

const root = document.documentElement;

function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(root, { attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
}

export function useTheme(): Theme {
  return useSyncExternalStore(subscribe, () => root.dataset.theme as Theme);
}

export function setTheme(theme: Theme) {
  const system = matchMedia("(prefers-color-scheme: light)").matches
    ? "light"
    : "dark";
  if (theme === system) {
    localStorage.removeItem("theme");
  } else {
    localStorage.setItem("theme", theme);
  }
  dispatchEvent(new Event("themechange"));
}
