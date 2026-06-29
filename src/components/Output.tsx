import { useState } from "react";
import katex from "katex";
import computeExpression from "../algorithm";
import type { CellState } from "../cellState";
import "katex/dist/katex.min.css";

export default function Output({ cells }: { cells: CellState[][] }) {
  const [exp, setExp] = useState("");

  return (
    <div className="flex gap-4 ">
      <button
        className="font-mono text-white"
        onClick={() => setExp(computeExpression(cells, false))}
      >
        [ Compute Expression ]
      </button>
      {exp ? (
        <div
          className="text-white"
          dangerouslySetInnerHTML={{
            __html: katex.renderToString(exp, {
              displayMode: true,
              throwOnError: false,
            }),
          }}
        />
      ) : (
        <p>Click the button to compute the expression.</p>
      )}
    </div>
  );
}
