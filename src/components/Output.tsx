import type { ReactNode } from "react";

import { Tex, TermChips, TermSet } from "./terms";
import { CopyButton } from "./ui/copy-button";
import type { Implicant, Table } from "../lib/algorithm";
import { coverTerms, coverText, implicantLatex } from "../lib/expression";
import {
  groupColor,
  groupInk,
  groupText,
  groupTint,
  type Mode,
} from "../lib/groups";
import { cn } from "../lib/utils";

function Row({
  tag,
  action,
  children,
}: {
  tag: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "grid items-baseline gap-3 border-b border-line px-4 py-3 text-lg last:border-b-0",
        action
          ? "grid-cols-[2.75rem_minmax(0,1fr)_auto]"
          : "grid-cols-[2.75rem_minmax(0,1fr)]",
      )}
    >
      <span className="text-2xs font-medium tracking-[0.06em] text-fg-2 uppercase">
        {tag}
      </span>
      <div className="scroll-slim min-w-0 overflow-x-auto overflow-y-hidden py-1">
        {children}
      </div>
      {action && <div className="flex self-start pt-0.5">{action}</div>}
    </div>
  );
}

function shortList(symbol: string, terms: number[]): string {
  const shown =
    terms.length > 6 ? [...terms.slice(0, 3), "…", ...terms.slice(-2)] : terms;
  return `${symbol}(${shown.join(", ")})`;
}

function GroupList({
  groups,
  numVars,
  isPOS,
  selected,
  onSelect,
}: {
  groups: Implicant[];
  numVars: number;
  isPOS: boolean;
  selected: number;
  onSelect: (index: number) => void;
}) {
  return (
    <div className="px-2 pt-3 pb-2">
      <div className="flex items-baseline justify-between px-2 pb-2 text-xs text-fg-2">
        <span className="font-medium">Groups</span>
        <span className="font-mono">
          {isPOS ? "POS" : "SOP"} · {groups.length}
        </span>
      </div>
      <ul className="flex flex-col gap-0.5">
        {groups.map((group, i) => {
          const color = groupColor(isPOS, i);
          const isSelected = selected === i;
          const terms = [...group.covered].sort((a, b) => a - b);
          return (
            <li key={group.key()}>
              <button
                type="button"
                onClick={() => onSelect(i)}
                aria-pressed={isSelected}
                className="grid w-full grid-cols-[0.625rem_1.25rem_minmax(0,1fr)_auto] items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-[background-color,box-shadow] duration-150 ease-out hover:bg-surface-2"
                style={
                  isSelected
                    ? {
                        backgroundColor: groupTint(color, 10),
                        boxShadow: `inset 0 0 0 1px ${groupTint(color, 42)}`,
                      }
                    : undefined
                }
              >
                <span
                  className="size-2.5 rounded-[3px]"
                  style={{ backgroundColor: groupInk(color) }}
                />
                <span className="font-mono text-xs text-fg-2">{i + 1}</span>
                <span
                  className="min-w-0 truncate text-[0.95rem]"
                  style={{ color: groupText(color) }}
                >
                  <Tex tex={implicantLatex(group, numVars, isPOS)} />
                </span>
                <span className="font-mono text-xs whitespace-nowrap text-fg-2">
                  {shortList(isPOS ? "M" : "m", terms)}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function CoverRow({
  isPOS,
  cover,
  numVars,
  selected,
  onSelect,
}: {
  isPOS: boolean;
  cover: Implicant[];
  numVars: number;
  selected: number;
  onSelect: (index: number) => void;
}) {
  const tag = isPOS ? "POS" : "SOP";
  return (
    <Row
      tag={tag}
      action={
        <CopyButton
          text={coverText(cover, numVars, isPOS)}
          label={`Copy ${tag} as text`}
        />
      }
    >
      <TermChips
        prefix={"f = \\;"}
        terms={coverTerms(cover, numVars, isPOS)}
        sep={isPOS ? "\\," : "\\:+\\:"}
        colors={cover.map((_, i) => groupColor(isPOS, i))}
        selected={selected}
        onSelect={onSelect}
      />
    </Row>
  );
}

function CanonicalRow({
  isMax,
  terms,
  dontCares,
}: {
  isMax: boolean;
  terms: number[];
  dontCares: number[];
}) {
  return (
    <Row tag={isMax ? "Max" : "Min"}>
      <span className="flex items-baseline">
        <Tex
          tex={isMax ? "f = \\textstyle\\prod" : "f = \\textstyle\\sum"}
          className="whitespace-nowrap"
        />
        <span className="min-w-0">
          <TermSet symbol={isMax ? "\\,M" : "\\,m"} terms={terms} />
          {dontCares.length > 0 && (
            <>
              <Tex
                tex={
                  isMax
                    ? "\\,\\cdot \\textstyle\\prod"
                    : "\\,+ \\textstyle\\sum"
                }
              />
              <TermSet symbol={"\\,d"} terms={dontCares} />
            </>
          )}
        </span>
      </span>
    </Row>
  );
}

export default function Output({
  table,
  sopCover,
  posCover,
  groups,
  mode,
  selected,
  onSelect,
}: {
  table: Table;
  sopCover: Implicant[];
  posCover: Implicant[];
  groups: Implicant[];
  mode: Mode;
  selected: number;
  onSelect: (isPOS: boolean, index: number) => void;
}) {
  const { numVars } = table;
  const isPOS = mode === "pos";

  return (
    <div className="flex flex-col">
      <CoverRow
        isPOS={false}
        cover={sopCover}
        numVars={numVars}
        selected={mode === "sop" ? selected : -1}
        onSelect={(i) => onSelect(false, i)}
      />
      <CoverRow
        isPOS
        cover={posCover}
        numVars={numVars}
        selected={isPOS ? selected : -1}
        onSelect={(i) => onSelect(true, i)}
      />
      <CanonicalRow
        isMax={false}
        terms={table.minterms}
        dontCares={table.dontcares}
      />
      <CanonicalRow isMax terms={table.maxterms} dontCares={table.dontcares} />
      {groups.length > 0 && (
        <GroupList
          groups={groups}
          numVars={numVars}
          isPOS={isPOS}
          selected={selected}
          onSelect={(i) => onSelect(isPOS, i)}
        />
      )}
    </div>
  );
}
