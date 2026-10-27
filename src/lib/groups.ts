import type { CSSProperties } from "react";

import type { Implicant } from "./algorithm";
import type { CellState } from "./cellState";

export type Mode = "sop" | "pos" | "off";

// what every view of the function (map, 3D, table, timing) draws from
export interface ViewProps {
  numVars: number;
  outputs: CellState[];
  onToggle: (term: number) => void;
  groups: Implicant[];
  isPOS: boolean;
  selected: number;
}

const SOP_COLORS = [
  "#2563eb",
  "#dc2626",
  "#9333ea",
  "#db2777",
  "#0891b2",
  "#15803d",
  "#4f46e5",
  "#e11d48",
];
const POS_COLORS = [
  "#f87171",
  "#38bdf8",
  "#34d399",
  "#c084fc",
  "#fb923c",
  "#f472b6",
  "#a3e635",
  "#22d3ee",
];

export function groupColor(isPOS: boolean, index: number): string {
  const palette = isPOS ? POS_COLORS : SOP_COLORS;
  return palette[index % palette.length];
}

// mixed toward the theme for contrast; the 3D view uses the raw colour
export function groupInk(color: string): string {
  return `color-mix(in oklab, ${color} var(--group-pct), var(--group-mix))`;
}

// lightness clamped per theme so pale hues hold 4.5:1 as text
export function groupText(color: string): string {
  return `oklch(from ${groupInk(color)} clamp(var(--group-l-min), l, var(--group-l-max)) c h)`;
}

export function groupTint(color: string, percent: number): string {
  return `color-mix(in oklab, ${groupInk(color)} ${percent}%, transparent)`;
}

// selected rows are tinted, so their tertiary text steps up to stay legible
export function rowGroups(
  groups: Implicant[],
  isPOS: boolean,
  selected: number,
) {
  const shade =
    selected >= 0
      ? ({
          backgroundColor: groupTint(groupColor(isPOS, selected), 11),
          "--text-3": "var(--text-2)",
        } as CSSProperties)
      : undefined;
  return (term: number) => {
    const covering = groups.flatMap((group, i) =>
      group.terms.includes(term) ? [i] : [],
    );
    return { covering, shade: covering.includes(selected) ? shade : undefined };
  };
}
