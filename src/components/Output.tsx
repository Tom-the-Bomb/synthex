import { useState, type ReactNode } from "react";
import katex from "katex";
import computeExpression, { Table } from "../algorithm";
import type { CellState } from "../cellState";
import "katex/dist/katex.min.css";

const AMBER = "bg-amber-400/20 text-amber-200";
const SKY = "bg-sky-400/15 text-sky-200";

const COLLAPSE_LIMIT = 16;
const EDGE = 6;

const list = (terms: number[]) => terms.join(",\\,");

function Tex({ tex }: { tex: string }) {
  return (
    <span
      className="text-lg"
      dangerouslySetInnerHTML={{
        __html: katex.renderToString(tex, { throwOnError: false }),
      }}
    />
  );
}

function Toggle({ open, onClick }: { open: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title={open ? "collapse" : "expand"}
      className="mx-1 align-middle text-sm font-bold text-teal-500 transition-colors hover:text-amber-300"
    >
      {open ? "[−]" : "[…]"}
    </button>
  );
}

function TermSet({ symbol, terms }: { symbol: string; terms: number[] }) {
  const [open, setOpen] = useState(false);

  if (terms.length === 0) {
    return <Tex tex={`${symbol}(\\,)`} />;
  }

  if (open || terms.length <= COLLAPSE_LIMIT) {
    return (
      <span className="whitespace-nowrap">
        <Tex tex={`${symbol}(${list(terms)})`} />
        {terms.length > COLLAPSE_LIMIT && <Toggle open onClick={() => setOpen(false)} />}
      </span>
    );
  }

  return (
    <span className="whitespace-nowrap">
      <Tex tex={`${symbol}(${list(terms.slice(0, EDGE))},\\,`} />
      <Toggle open={false} onClick={() => setOpen(true)} />
      <Tex tex={`\\,${list(terms.slice(-EDGE))})`} />
    </span>
  );
}

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
        className={`w-12 shrink-0 rounded-sm px-2 py-0.5 text-center text-[0.7rem] font-bold uppercase tracking-widest ${tagClass}`}
      >
        {tag}
      </span>
      <div className="scroll-slim overflow-x-auto py-1">{children}</div>
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
          <Tex tex="f = \textstyle\sum" />
          <TermSet symbol="\,m" terms={ones} />
          {hasDontCares && (
            <>
              <Tex tex="+ \textstyle\sum" />
              <TermSet symbol="\,d" terms={dashes} />
            </>
          )}
        </span>
      </Row>

      <Row tag="Max" tagClass={SKY}>
        <span className="whitespace-nowrap">
          <Tex tex="f = \textstyle\prod" />
          <TermSet symbol="\,M" terms={zeros} />
          {hasDontCares && (
            <>
              <Tex tex="\cdot \textstyle\prod" />
              <TermSet symbol="\,d" terms={dashes} />
            </>
          )}
        </span>
      </Row>

      <div className="mt-1 flex flex-col gap-3 border-t border-dashed border-teal-800/60 pt-3">
        <Row tag="SOP" tagClass={AMBER}>
          <Tex tex={`f = ${computeExpression(table, false)}`} />
        </Row>
        <Row tag="POS" tagClass={SKY}>
          <Tex tex={`f = ${computeExpression(table, true)}`} />
        </Row>
      </div>
    </div>
  );
}
