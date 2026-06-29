import { useState } from "react";
import Grid from "./components/Grid";
import { CellState, toggleCellState } from "./cellState";
import Output from "./components/Output";

const SIZE = 4;

function makeGrid(n: number): CellState[][] {
  return Array.from({ length: n }, () =>
    Array.from({ length: n }, () => CellState.False),
  );
}

function App() {
  const [cells, setCells] = useState<CellState[][]>(() => makeGrid(SIZE));

  return (
    <div className="flex flex-col items-center gap-4 p-4 bg-gray-800 min-h-screen">
      <h1>Grid of Cells</h1>
      <Grid
        cells={cells}
        onCellClick={(ri, ci) =>
          setCells((cells) =>
            cells.map((row, i) =>
              row.map((cell, j) =>
                i == ri && j == ci ? toggleCellState(cell) : cell,
              ),
            ),
          )
        }
      />
      <Output cells={cells} />
    </div>
  );
}

export default App;
