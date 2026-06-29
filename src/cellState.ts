export const CellState = {
  True: "1",
  False: "0",
  Any: "x",
} as const;

export type CellState = (typeof CellState)[keyof typeof CellState];

export function toggleCellState(state: CellState): CellState {
  switch (state) {
    case CellState.True:
      return CellState.False;
    case CellState.False:
      return CellState.Any;
    case CellState.Any:
      return CellState.True;
  }
}

// Cell highlight palette for the blueprint theme: minterms (1) are "marked"
// in amber ink, maxterms (0) sit in cool steel, don't-cares (x) are a ghosted
// dashed outline.
export function cellClasses(state: CellState): string {
  switch (state) {
    case CellState.True:
      return "bg-amber-400 text-slate-950 border border-amber-300 shadow-[0_0_14px_-3px_rgba(251,191,36,0.7)] hover:bg-amber-300";
    case CellState.False:
      return "bg-sky-950 text-sky-200 border border-sky-700/70 hover:bg-sky-900 hover:border-sky-500";
    case CellState.Any:
      return "bg-transparent text-teal-500/70 border border-dashed border-teal-600/60 hover:border-teal-400";
  }
}

export function stateLabel(state: CellState): string {
  switch (state) {
    case CellState.True:
      return "minterm";
    case CellState.False:
      return "maxterm";
    case CellState.Any:
      return "don't-care";
  }
}
