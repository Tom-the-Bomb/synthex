// wraps when a pane is too narrow; isolate and -z-1 keep each item's touch
// area under the items of the row next to it
export const segmentTrack =
  "isolate flex flex-wrap rounded-lg border border-line bg-surface-2 p-0.5";

export const segmentItem =
  "relative grow rounded-md px-2.5 py-1 text-xs font-medium text-fg-2 transition-colors duration-150 hover:text-fg chosen:bg-seg-on chosen:text-fg chosen:shadow-(--seg-shadow) forced-colors:chosen:outline pointer-coarse:after:absolute pointer-coarse:after:inset-x-0 pointer-coarse:after:-inset-y-2.5 pointer-coarse:after:-z-1";

// the 3D canvas's box, shared by its loading and failure placeholders
export const canvasWell = "h-canvas rounded-lg border border-line bg-surface-2";
