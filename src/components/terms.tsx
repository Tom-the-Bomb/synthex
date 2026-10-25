import katex from "katex";
import { useState, type CSSProperties } from "react";

import { groupInk, groupTint } from "../lib/groups";

import "katex/dist/katex.min.css";

const COLLAPSE_LIMIT = 16;
const EDGE = 6;

// Minimized expressions have far fewer, but much wider, terms than a raw term
// list, so they collapse sooner.
const EXPR_LIMIT = 8;
const EXPR_EDGE = 3;

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
      type="button"
      onClick={onClick}
      title={open ? "collapse" : "expand"}
      className="mx-1 rounded-md px-1 align-middle font-mono text-xs text-fg-2 transition-colors hover:bg-surface-3 hover:text-fg"
    >
      {open ? "[−]" : "[…]"}
    </button>
  );
}

// A term list, e.g. m(0, 1, 2), in KaTeX or plain text. Long lists collapse to
// head […] tail; an expanded plain list scrolls sideways.
export function TermSet({
  symbol,
  terms,
  plain = false,
}: {
  symbol: string;
  terms: number[];
  plain?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const long = terms.length > COLLAPSE_LIMIT;
  const collapsed = long && !open;

  // KaTeX may wrap a long list after any comma instead of running off the pane
  const sep = plain ? ", " : ",\\,\\allowbreak ";
  const lead = plain ? " " : "\\,";
  // the last two terms stay together, so a wrap never leaves "11)" alone
  const join = (nums: number[]) =>
    plain || nums.length < 2
      ? nums.join(sep)
      : `${nums.slice(0, -1).join(sep)},\\,${nums[nums.length - 1]}`;
  const frag = (text: string) =>
    plain ? <span>{text}</span> : <Tex tex={text} />;
  const toggle = long ? (
    <Toggle open={open} onClick={() => setOpen((o) => !o)} />
  ) : null;

  const wrap = plain ? "whitespace-nowrap" : "";
  const body = collapsed ? (
    <span className={wrap}>
      {frag(`${symbol}(${join(terms.slice(0, EDGE))}${sep}`)}
      {toggle}
      {frag(`${lead}${join(terms.slice(-EDGE))})`)}
    </span>
  ) : (
    <span className={wrap}>
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

// A minimized expression whose terms each wear their group's colour and select
// that group on click (a constant function has no colours). A long cover
// collapses to head […] tail, keeping the separator on both sides of the toggle.
export function TermChips({
  prefix,
  terms,
  sep,
  colors,
  active,
  onSelect,
}: {
  prefix: string;
  terms: string[];
  sep: string;
  colors: string[];
  active: number;
  onSelect: (index: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const long = terms.length > EXPR_LIMIT;
  const toggle = long ? (
    <Toggle key="toggle" open={open} onClick={() => setOpen((o) => !o)} />
  ) : null;

  const chip = (i: number) => {
    const color = colors[i];
    if (!color) {
      return <Tex key={terms[i]} tex={terms[i]} />;
    }
    const selected = active === i;
    return (
      <button
        key={terms[i]}
        type="button"
        onClick={() => onSelect(i)}
        aria-pressed={selected}
        aria-label={`group ${i + 1}`}
        className="rounded-md px-1 transition-[background-color,box-shadow] duration-150 ease-out hover:bg-(--chip-hover)"
        style={
          {
            color: groupInk(color),
            backgroundColor: selected ? groupTint(color, 18) : undefined,
            boxShadow: selected
              ? `inset 0 0 0 1px ${groupTint(color, 50)}`
              : undefined,
            "--chip-hover": groupTint(color, 10),
          } as CSSProperties
        }
      >
        <Tex tex={terms[i]} />
      </button>
    );
  };

  // each separator travels with the term after it, so a wrap never strands it
  const run = (indices: number[]) =>
    indices.map((i, k) =>
      k === 0 ? (
        chip(i)
      ) : (
        <span
          key={`sep-${i}`}
          className="inline-flex items-baseline whitespace-nowrap"
        >
          <Tex tex={sep} />
          {chip(i)}
        </span>
      ),
    );

  const all = terms.map((_, i) => i);
  const body =
    !long || open
      ? [...run(all), toggle]
      : [
          ...run(all.slice(0, EXPR_EDGE)),
          <Tex key="sep-head" tex={sep} />,
          toggle,
          <Tex key="sep-tail" tex={sep} />,
          ...run(all.slice(-EXPR_EDGE)),
        ];

  // the prefix hangs, so a wrapped cover lines up under its first term
  return (
    <span className="inline-flex items-baseline">
      <Tex tex={prefix} className="whitespace-nowrap" />
      <span className="flex flex-wrap items-baseline gap-y-1.5">{body}</span>
    </span>
  );
}
