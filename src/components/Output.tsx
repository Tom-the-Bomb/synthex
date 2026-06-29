import { useState, useMemo, type ReactNode } from "react";
import katex from "katex";
import computeExpression, { Table } from "../algorithm";
import type { CellState } from "../cellState";
import "katex/dist/katex.min.css";

function Math({ tex }: { tex: string }) {
  return (
    <span
      className="text-lg"
      dangerouslySetInnerHTML={{
        __html: katex.renderToString(tex, { throwOnError: false }),
      }}
    />
  );
}

const join = (terms: number[]) => terms.join(",\\,");

// How many terms before the list collapses, and how many to keep on each end.
const COLLAPSE_LIMIT = 16;
const EDGE = 6;

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

// Renders `<sym>(t0, t1, …)`. When the list is long it collapses to head/tail
// with a `[…]` toggle in the middle.
function TermMath({ sym, terms }: { sym: string; terms: number[] }) {
  const [open, setOpen] = useState(false);

  if (terms.length === 0) return <Math tex={`${sym}(\\,)`} />;

  if (open || terms.length <= COLLAPSE_LIMIT) {
    return (
      <span className="whitespace-nowrap">
        <Math tex={`${sym}(${join(terms)})`} />
        {terms.length > COLLAPSE_LIMIT && (
          <Toggle open onClick={() => setOpen(false)} />
        )}
      </span>
    );
  }

  const head = terms.slice(0, EDGE);
  const tail = terms.slice(-EDGE);
  return (
    <span className="whitespace-nowrap">
      <Math tex={`${sym}(${join(head)},\\,`} />
      <Toggle open={false} onClick={() => setOpen(true)} />
      <Math tex={`\\,${join(tail)})`} />
    </span>
  );
}

function Line({
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

const AMBER = "bg-amber-400/20 text-amber-200";
const SKY = "bg-sky-400/15 text-sky-200";

export default function Output({ outputs }: { outputs: CellState[] }) {
  const result = useMemo(() => {
    const table = new Table(
      outputs.map((_, i) => i),
      outputs,
    );
    return {
      sop: computeExpression(table, false),
      pos: computeExpression(table, true),
      minterms: table.minterms,
      maxterms: table.maxterms,
      dontcares: table.dontcares,
    };
  }, [outputs]);

  const { sop, pos, minterms, maxterms, dontcares } = result;
  const hasDc = dontcares.length > 0;

  return (
    <div className="flex flex-col gap-3 text-teal-100">
      <Line tag="Min" tagClass={AMBER}>
        <span className="whitespace-nowrap">
          <Math tex="f = \textstyle\sum" />
          <TermMath sym="\,m" terms={minterms} />
          {hasDc && (
            <>
              <Math tex="+ \textstyle\sum" />
              <TermMath sym="\,d" terms={dontcares} />
            </>
          )}
        </span>
      </Line>

      <Line tag="Max" tagClass={SKY}>
        <span className="whitespace-nowrap">
          <Math tex="f = \textstyle\prod" />
          <TermMath sym="\,M" terms={maxterms} />
          {hasDc && (
            <>
              <Math tex="\cdot \textstyle\prod" />
              <TermMath sym="\,d" terms={dontcares} />
            </>
          )}
        </span>
      </Line>

      <div className="mt-1 flex flex-col gap-3 border-t border-dashed border-teal-800/60 pt-3">
        <Line tag="SOP" tagClass={AMBER}>
          <Math tex={`f = ${sop}`} />
        </Line>
        <Line tag="POS" tagClass={SKY}>
          <Math tex={`f = ${pos}`} />
        </Line>
      </div>
    </div>
  );
}
