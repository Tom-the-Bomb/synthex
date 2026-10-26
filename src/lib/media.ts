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

// An element's content width in whole pixels, kept current as it resizes. The
// first measurement lands before paint.
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

// The user's text size relative to the 16px default (a browser setting), for
// layout drawn in pixels that should grow with the text.
export function remScale(): number {
  return parseFloat(getComputedStyle(document.documentElement).fontSize) / 16;
}
