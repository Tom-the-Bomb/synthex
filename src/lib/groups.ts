import type { Implicant } from "./algorithm";

// Which cover the map groups: minterms (SOP), maxterms (POS), or none.
export type Mode = "sop" | "pos" | "off";

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

// The 2D shade of a group colour, mixed toward the theme's ground so it holds
// contrast in light and dark (the 3D view uses the raw colour).
export function groupInk(color: string): string {
  return `color-mix(in oklab, ${color} var(--group-pct), var(--group-mix))`;
}

export function groupTint(color: string, percent: number): string {
  return `color-mix(in oklab, ${groupInk(color)} ${percent}%, transparent)`;
}

// For a truth-table row: the groups covering its term, and the selected
// group's tint when the row is in it.
export function rowGroups(
  groups: Implicant[],
  isPOS: boolean,
  selected: number,
) {
  const tint =
    selected >= 0 ? groupTint(groupColor(isPOS, selected), 11) : undefined;
  return (term: number) => {
    const covering = groups.flatMap((group, i) =>
      group.terms.includes(term) ? [i] : [],
    );
    return { covering, tint: covering.includes(selected) ? tint : undefined };
  };
}
