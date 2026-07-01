import type { ReactNode } from "react";

import computeExpression, { Table } from "../algorithm";
import type { CellState } from "../cellState";
import { Tex, TermSet } from "./terms";

const AMBER = "bg-amber-400/20 text-amber-200";
const SKY = "bg-sky-400/15 text-sky-200";

function Row({
  tag,
  tagClass,
  children,
}: {
  tag: string;
  tagClass: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-baseline gap-3">
      <span
        className={`w-12 shrink-0 rounded-sm px-2 py-0.5 text-center text-[0.7rem] font-bold tracking-widest uppercase ${tagClass}`}
      >
        {tag}
      </span>
      <div className="scroll-slim min-w-0 flex-1 overflow-x-auto py-1">
        {children}
      </div>
    </div>
  );
}

export default function Output({ outputs }: { outputs: CellState[] }) {
  const table = new Table(
    outputs.map((_, i) => i),
    outputs,
  );
  const ones = table.minterms;
  const zeros = table.maxterms;
  const dashes = table.dontcares;
  const hasDontCares = dashes.length > 0;

  return (
    <div className="flex flex-col gap-3 text-teal-100">
      <Row tag="Min" tagClass={AMBER}>
        <span className="whitespace-nowrap">
          <Tex tex="f = \textstyle\sum" className="text-lg" />
          <TermSet symbol="\,m" terms={ones} className="text-lg" />
          {hasDontCares && (
            <>
              <Tex tex="\,+ \textstyle\sum" className="text-lg" />
              <TermSet symbol="\,d" terms={dashes} className="text-lg" />
            </>
          )}
        </span>
      </Row>

      <Row tag="Max" tagClass={SKY}>
        <span className="whitespace-nowrap">
          <Tex tex="f = \textstyle\prod" className="text-lg" />
          <TermSet symbol="\,M" terms={zeros} className="text-lg" />
          {hasDontCares && (
            <>
              <Tex tex="\,\cdot \textstyle\prod" className="text-lg" />
              <TermSet symbol="\,d" terms={dashes} className="text-lg" />
            </>
          )}
        </span>
      </Row>

      <div className="mt-1 flex flex-col gap-3 border-t border-dashed border-teal-800/60 pt-3">
        <Row tag="SOP" tagClass={AMBER}>
          <Tex
            tex={`f = ${computeExpression(table, false)}`}
            className="text-lg"
          />
        </Row>
        <Row tag="POS" tagClass={SKY}>
          <Tex
            tex={`f = ${computeExpression(table, true)}`}
            className="text-lg"
          />
        </Row>
      </div>
    </div>
  );
}
