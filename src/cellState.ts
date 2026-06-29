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
