import Cell from "./Cell";
import type { CellState } from "../cellState";

export default function Grid({
  cells,
  onCellClick,
}: {
  cells: CellState[][];
  onCellClick: (row: number, col: number) => void;
}) {
  const n = cells.length;
  return (
    <div
      className="grid aspect-square w-full max-w-md mx-auto gap-1"
      style={{
        gridTemplateColumns: `repeat(${n}, 1fr)`,
        gridTemplateRows: `repeat(${n}, 1fr)`,
      }}
    >
      {cells.map((row, ri) =>
        row.map((value, ci) => (
          <Cell
            key={`${ri}-${ci}`}
            value={value}
            onClick={() => onCellClick(ri, ci)}
          />
        )),
      )}
    </div>
  );
}
