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

export function cellClasses(state: CellState): string {
  switch (state) {
    case CellState.True:
      return "border-one-edge bg-one-soft text-one-fg hover:border-one";
    case CellState.False:
      return "border-line bg-surface-2 text-fg-2 hover:border-line-2 hover:text-fg";
    case CellState.Any:
      return "border-dashed border-fg-3 bg-surface text-fg-2 hover:border-fg-2 hover:text-fg";
  }
}

export function chipClasses(state: CellState): string {
  switch (state) {
    case CellState.True:
      return "border-one bg-one text-one-ink hover:brightness-105";
    case CellState.False:
      return "border-line-2 bg-transparent text-fg-2 hover:border-fg-3 hover:text-fg";
    case CellState.Any:
      return "border-dashed border-fg-3 bg-transparent text-fg-2 hover:text-fg";
  }
}
