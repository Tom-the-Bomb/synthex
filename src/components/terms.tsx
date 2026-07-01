import katex from "katex";
import { useState } from "react";

import "katex/dist/katex.min.css";

const COLLAPSE_LIMIT = 16;
const EDGE = 6;

export function Tex({ tex, className }: { tex: string; className?: string }) {
  return (
    <span
      className={className}
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

// Collapsible term list, e.g. m(0, 1, 2). Rendered through KaTeX by default, or
// as plain text when `plain` is set. Long lists collapse to head […] tail;
// a plain list only scrolls horizontally once it has been expanded.
export function TermSet({
  symbol,
  terms,
  plain = false,
  className,
}: {
  symbol: string;
  terms: number[];
  plain?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const long = terms.length > COLLAPSE_LIMIT;
  const collapsed = long && !open;

  const sep = plain ? ", " : ",\\,";
  const lead = plain ? " " : "\\,";
  const join = (nums: number[]) => nums.join(sep);
  const frag = (text: string) =>
    plain ? <span>{text}</span> : <Tex tex={text} className={className} />;
  const toggle = long ? (
    <Toggle open={open} onClick={() => setOpen((o) => !o)} />
  ) : null;

  const body = collapsed ? (
    <span className="whitespace-nowrap">
      {frag(`${symbol}(${join(terms.slice(0, EDGE))}${sep}`)}
      {toggle}
      {frag(`${lead}${join(terms.slice(-EDGE))})`)}
    </span>
  ) : (
    <span className="whitespace-nowrap">
      {frag(`${symbol}(${join(terms)})`)}
      {toggle}
    </span>
  );

  if (plain && open) {
    return (
      <div className="scroll-slim max-w-[min(60vw,22rem)] min-w-0 overflow-x-auto">
        {body}
      </div>
    );
  }

  return body;
}
