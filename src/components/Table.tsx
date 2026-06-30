import { CellState, cellClasses } from "../cellState";
import { bin } from "../kmap";

export default function Table({
  numVars,
  outputs,
  onToggle,
}: {
  numVars: number;
  outputs: CellState[];
  onToggle: (term: number) => void;
}) {
  const vars = Array.from({ length: numVars }, (_, i) => numVars - i);

  return (
    <div className="scroll-slim max-h-112 overflow-auto">
      <table className="w-full border-collapse text-center text-sm">
        <thead className="sticky top-0 z-10 bg-[#0c1f2c] text-[0.7rem] tracking-widest text-teal-300/90 uppercase">
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
              <td className="px-3 py-1 font-bold text-amber-300/70 tabular-nums">
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
