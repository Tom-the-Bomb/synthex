import { useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";

export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
  );
}

// observes the element present on mount, so its owner must mount with it
export function useWidth<T extends HTMLElement>(initial: number) {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(initial);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) {
      return;
    }
    const style = getComputedStyle(el);
    setWidth(
      Math.floor(
        el.clientWidth -
          parseFloat(style.paddingLeft) -
          parseFloat(style.paddingRight),
      ),
    );
    const observer = new ResizeObserver(([entry]) =>
      setWidth(Math.floor(entry.contentRect.width)),
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

// the browser's text-size setting, relative to the 16px default
export function remScale(): number {
  return parseFloat(getComputedStyle(document.documentElement).fontSize) / 16;
}
