import katex from "katex";
import { useState, type CSSProperties } from "react";

import { groupText, groupTint } from "../lib/groups";

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
      className="relative mx-1 rounded-md px-1 align-middle font-mono text-xs text-fg-2 transition-colors hover:bg-surface-3 hover:text-fg pointer-coarse:after:absolute pointer-coarse:after:-inset-3"
    >
      {open ? "[−]" : "[…]"}
    </button>
  );
}

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

  // lets KaTeX wrap after any comma
  const sep = plain ? ", " : ",\\,\\allowbreak ";
  const lead = plain ? " " : "\\,";
  // keeps the last two terms together so "11)" never wraps alone
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

export function TermChips({
  prefix,
  terms,
  sep,
  colors,
  selected,
  onSelect,
}: {
  prefix: string;
  terms: string[];
  sep: string;
  colors: string[];
  selected: number;
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
    const isSelected = selected === i;
    return (
      <button
        key={terms[i]}
        type="button"
        onClick={() => onSelect(i)}
        aria-pressed={isSelected}
        aria-label={`group ${i + 1}`}
        className="relative rounded-md px-1 whitespace-nowrap transition-[background-color,box-shadow] duration-150 ease-out hover:bg-(--chip-hover) pointer-coarse:after:absolute pointer-coarse:after:inset-x-0 pointer-coarse:after:-inset-y-2"
        style={
          {
            color: groupText(color),
            backgroundColor: isSelected ? groupTint(color, 18) : undefined,
            boxShadow: isSelected
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

  // each separator wraps with the term after it
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

  return (
    <span className="inline-flex items-baseline">
      <Tex tex={prefix} className="whitespace-nowrap" />
      <span className="flex flex-wrap items-baseline gap-y-1.5">{body}</span>
    </span>
  );
}
