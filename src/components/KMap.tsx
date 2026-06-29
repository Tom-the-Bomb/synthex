import { CellState, cellClasses } from "../cellState";
import { bin, cellTerm, gray, kmapDims } from "../kmap";

// Variable labels for a contiguous bit range, most-significant first.
// e.g. hi=4, lo=3 -> ["x4", "x3"]
function VarLabels({ hi, lo }: { hi: number; lo: number }) {
  const vars = [];
  for (let v = hi; v >= lo; v--) vars.push(v);
  return (
    <span className="inline-flex gap-0.5">
      {vars.map((v) => (
        <span key={v}>
          x<sub>{v}</sub>
        </span>
      ))}
    </span>
  );
}

// Styled Karnaugh map. Rows and columns are gray-code ordered so neighbouring
// cells differ in a single variable. Supports up to 5 variables (4 x 8).
export default function KMap({
  numVars,
  outputs,
  onToggle,
}: {
  numVars: number;
  outputs: CellState[];
  onToggle: (term: number) => void;
}) {
  const dims = kmapDims(numVars);
  const { rows, cols, rowBits, colBits } = dims;

  return (
    <table className="border-collapse text-center">
      <thead>
        <tr>
          {/* corner: row-vars over col-vars */}
          <th className="px-2 py-1 text-[0.65rem] text-teal-500">
            {rowBits > 0 && <VarLabels hi={numVars} lo={colBits + 1} />}
            <span className="px-1 text-teal-700">/</span>
            <VarLabels hi={colBits} lo={1} />
          </th>
          {Array.from({ length: cols }, (_, c) => (
            <th
              key={c}
              className="px-1 pb-1.5 text-xs font-bold tracking-widest text-amber-300/90"
            >
              {bin(gray(c), colBits)}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {Array.from({ length: rows }, (_, r) => (
          <tr key={r}>
            <th className="pr-2 text-xs font-bold tracking-widest text-amber-300/90">
              {rowBits > 0 ? bin(gray(r), rowBits) : ""}
            </th>
            {Array.from({ length: cols }, (_, c) => {
              const term = cellTerm(r, c, dims);
              const state = outputs[term];
              return (
                <td key={c} className="p-0.5">
                  <button
                    onClick={() => onToggle(term)}
                    title={`term ${term}`}
                    className={`flex h-12 w-12 flex-col items-center justify-center rounded-sm text-lg font-bold transition-colors ${cellClasses(state)}`}
                  >
                    <span className="leading-none">{state}</span>
                    <span className="text-[0.6rem] font-normal opacity-55">
                      {term}
                    </span>
                  </button>
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
