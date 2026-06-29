import { CellState, cellClasses } from "../cellState";
import { bin } from "../kmap";

// Truth table: one row per input combination (term), one column per variable
// plus the output. Variables are ordered x_n .. x_1 left-to-right so each row
// reads as a normal binary count, consistent with algorithm.ts where x_{k} is
// bit (k - 1). The leading "#" column is the decimal term index for reference.
export default function Table({
  numVars,
  outputs,
  onToggle,
}: {
  numVars: number;
  outputs: CellState[];
  onToggle: (term: number) => void;
}) {
  // x_n (most significant) first, down to x_1.
  const vars = Array.from({ length: numVars }, (_, i) => numVars - i);

  return (
    <div className="scroll-slim max-h-112 overflow-auto">
      <table className="w-full border-collapse text-center text-sm">
        <thead className="sticky top-0 z-10 bg-[#0c1f2c] text-[0.7rem] uppercase tracking-widest text-teal-300/90">
          <tr>
            <th className="border-b border-teal-800/60 px-3 py-2 font-semibold text-amber-300/80">
              #
            </th>
            {vars.map((v) => (
              <th
                key={v}
                className="border-b border-teal-800/60 px-3 py-2 font-semibold"
              >
                x<sub>{v}</sub>
              </th>
            ))}
            <th className="border-b border-l border-teal-800/60 px-3 py-2 font-semibold">
              Out
            </th>
          </tr>
        </thead>
        <tbody className="text-teal-100/90">
          {outputs.map((state, term) => (
            <tr
              key={term}
              className="border-b border-teal-900/40 last:border-0 hover:bg-teal-400/5"
            >
              <td className="px-3 py-1 font-bold tabular-nums text-amber-300/70">
                {term}
              </td>
              {bin(term, numVars)
                .split("")
                .map((b, i) => (
                  <td
                    key={i}
                    className={`px-3 py-1 tabular-nums ${b === "1" ? "text-teal-200" : "text-teal-700"}`}
                  >
                    {b}
                  </td>
                ))}
              <td className="border-l border-teal-900/40 p-1">
                <button
                  onClick={() => onToggle(term)}
                  title={`term ${term}`}
                  className={`w-9 rounded-sm py-1 font-bold transition-colors ${cellClasses(state)}`}
                >
                  {state}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
