import type { CellState } from "../cellState";

export default function Cell({
  value,
  onClick,
}: {
  value: CellState;
  onClick: () => void;
}) {
  return (
    <button
      className="flex h-full w-full items-center justify-center bg-amber-100 text-sm rounded-sm"
      onClick={onClick}
    >
      {value}
    </button>
  );
}
