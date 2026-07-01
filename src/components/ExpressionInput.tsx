import { useState } from "react";

import type { CellState } from "../cellState";
import { parseExpression } from "../parser";

export default function ExpressionInput({
  numVars,
  onApply,
}: {
  numVars: number;
  onApply: (numVars: number, outputs: CellState[]) => void;
}) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    try {
      const parsed = parseExpression(text, numVars);
      onApply(parsed.numVars, parsed.outputs);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "invalid expression");
    }
  };

  return (
    <div className="flex flex-col gap-2 border border-dashed border-teal-800/60 bg-[#0c1f2c]/60 px-4 py-3">
      <span className="text-[0.7rem] tracking-widest text-teal-400 uppercase">
        Expression
      </span>
      <div className="flex flex-wrap gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              submit();
            }
          }}
          placeholder="e.g. x1'x2' + x3"
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          className="min-w-0 flex-1 border border-teal-700/70 bg-[#0a1722] px-2 py-1.5 text-sm text-teal-100 placeholder:text-teal-700 focus:border-teal-500 focus:outline-none"
        />
        <button
          onClick={submit}
          className="shrink-0 border border-teal-700/70 px-3 py-1.5 text-[0.7rem] font-bold tracking-widest text-teal-300 uppercase transition-colors hover:bg-teal-400/10"
        >
          Load
        </button>
      </div>
      {error && (
        <span className="text-[0.7rem] tracking-wide text-rose-400">
          {error}
        </span>
      )}
    </div>
  );
}
