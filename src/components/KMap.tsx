import { lazy, Suspense, useState, type ReactNode } from "react";

import { Table, computeCover, type Implicant } from "../algorithm";
import { CellState, cellClasses } from "../cellState";
import { bin, cellTerm, gray, kmapDims } from "../kmap";
import { TermSet } from "./terms";

const KmapSurface = lazy(() => import("./KmapSurface"));

const CELL = 46;
const GAP = 6;
const CORNER = 54;
const HEADER = 34;
const ORIGIN_X = CORNER + GAP;
const ORIGIN_Y = HEADER + GAP;

const SOP_COLORS = [
  "#2563eb",
  "#dc2626",
  "#9333ea",
  "#db2777",
  "#0891b2",
  "#15803d",
  "#4f46e5",
  "#e11d48",
];
const POS_COLORS = [
  "#f87171",
  "#38bdf8",
  "#34d399",
  "#c084fc",
  "#fb923c",
  "#f472b6",
  "#a3e635",
  "#22d3ee",
];

type Mode = "sop" | "pos" | "off";
type View = "flat" | "3d";

interface Loop {
  key: string;
  groupIndex: number;
  color: string;
  left: number;
  top: number;
  width: number;
  height: number;
}

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly T[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      <span className="mr-1 text-teal-500">{label}</span>
      {options.map((option) => (
        <button
          key={option}
          onClick={() => onChange(option)}
          className={`rounded-sm border px-2 py-0.5 font-bold transition-colors ${
            value === option
              ? "border-amber-400/60 bg-amber-400/20 text-amber-200"
              : "border-teal-800/60 text-teal-400 hover:bg-teal-400/10"
          }`}
        >
          {option}
        </button>
      ))}
    </div>
  );
}

function StepButton({
  dir,
  onClick,
}: {
  dir: "prev" | "next";
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={dir === "prev" ? "previous group" : "next group"}
      className="flex items-center rounded-sm border border-teal-800/60 px-2 py-1 text-teal-300 transition-colors hover:bg-teal-400/10"
    >
      <svg viewBox="0 0 10 10" className="h-2.5 w-2.5 fill-current">
        <path d={dir === "prev" ? "M8 1 2 5 8 9Z" : "M2 1 8 5 2 9Z"} />
      </svg>
    </button>
  );
}

function VarLabels({ hi, lo }: { hi: number; lo: number }) {
  const vars = [];
  for (let v = hi; v >= lo; v--) vars.push(v);
  return (
    <span className="inline-flex gap-0.5">
      {vars.map((v) => (
        <span key={v}>
          x<sub>{v}</sub>
        </span>
      ))}
    </span>
  );
}

function runs(indices: number[]): [number, number][] {
  const out: [number, number][] = [];
  for (const i of indices) {
    const last = out[out.length - 1];
    if (last && i === last[1] + 1) {
      last[1] = i;
    } else {
      out.push([i, i]);
    }
  }
  return out;
}

function coveredCells(
  group: Implicant,
  rowCount: number,
  colCount: number,
  colBits: number,
) {
  const onesLow = group.ones & (colCount - 1);
  const dashLow = group.dashes & (colCount - 1);
  const onesHigh = group.ones >> colBits;
  const dashHigh = group.dashes >> colBits;

  const rows: number[] = [];
  for (let r = 0; r < rowCount; r++) {
    if ((gray(r) & ~dashHigh) === onesHigh) {
      rows.push(r);
    }
  }
  const cols: number[] = [];
  for (let c = 0; c < colCount; c++) {
    if ((gray(c) & ~dashLow) === onesLow) {
      cols.push(c);
    }
  }
  return { rows, cols };
}

function loops(
  groups: Implicant[],
  rowCount: number,
  colCount: number,
  colBits: number,
  colors: string[],
): Loop[] {
  return groups.flatMap((group, index) => {
    const { rows, cols } = coveredCells(group, rowCount, colCount, colBits);
    const pad = 3 + (index % 3) * 3;
    const color = colors[index % colors.length];
    return runs(rows).flatMap(([r0, r1]) =>
      runs(cols).map(([c0, c1]) => ({
        key: `${index}-${r0}-${c0}`,
        groupIndex: index,
        color,
        left: ORIGIN_X + c0 * (CELL + GAP) + pad,
        top: ORIGIN_Y + r0 * (CELL + GAP) + pad,
        width: (c1 - c0 + 1) * CELL + (c1 - c0) * GAP - 2 * pad,
        height: (r1 - r0 + 1) * CELL + (r1 - r0) * GAP - 2 * pad,
      })),
    );
  });
}

function GroupExpression({
  group,
  numVars,
  isPOS,
}: {
  group: Implicant;
  numVars: number;
  isPOS: boolean;
}) {
  const literals: ReactNode[] = [];
  for (let bit = numVars - 1; bit >= 0; bit--) {
    const mask = 1 << bit;
    if (group.dashes & mask) {
      continue;
    }
    const complemented = ((group.ones & mask) !== 0) === isPOS;
    literals.push(
      <span key={bit} className="whitespace-nowrap">
        {complemented ? <span className="overline">x</span> : "x"}
        <sub>{bit + 1}</sub>
      </span>,
    );
  }

  if (literals.length === 0) {
    return <span className="mb-0.5">{isPOS ? "0" : "1"}</span>;
  }

  if (!isPOS) {
    return <span className="mb-0.5 inline-flex gap-0.5">{literals}</span>;
  }

  const sum: ReactNode[] = [];
  literals.forEach((literal, i) => {
    if (i > 0) {
      sum.push(<span key={`plus-${i}`}> + </span>);
    }
    sum.push(literal);
  });
  return (
    <span className="mb-0.5 whitespace-nowrap">
      {literals.length > 1 ? <>({sum})</> : sum}
    </span>
  );
}

export default function KMap({
  numVars,
  outputs,
  onToggle,
}: {
  numVars: number;
  outputs: CellState[];
  onToggle: (term: number) => void;
}) {
  const [mode, setMode] = useState<Mode>("sop");
  const [view, setView] = useState<View>("flat");
  const [selected, setSelected] = useState(-1);
  const [showExpr, setShowExpr] = useState(false);
  const dims = kmapDims(numVars);
  const { rows, cols, rowBits, colBits } = dims;

  const palette = mode === "pos" ? POS_COLORS : SOP_COLORS;
  const table = new Table(
    outputs.map((_, i) => i),
    outputs,
  );
  const groups = mode === "off" ? [] : computeCover(table, mode === "pos");

  const groupCount = groups.length;
  const active = selected >= 0 && selected < groupCount ? selected : -1;
  const activeColor = palette[active % palette.length];
  const activeTerms =
    active >= 0 ? [...groups[active].covered].sort((a, b) => a - b) : [];
  const activeCells = active >= 0 ? new Set(activeTerms) : null;
  const step = (dir: number) =>
    setSelected((prev) => {
      const current = prev >= 0 && prev < groupCount ? prev : -1;
      const next = current + dir;
      return next < 0 ? groupCount - 1 : next >= groupCount ? -1 : next;
    });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[0.7rem] tracking-widest uppercase">
        <Segmented
          label="Groups"
          value={mode}
          options={["sop", "pos", "off"]}
          onChange={setMode}
        />
        <Segmented
          label="View"
          value={view}
          options={["flat", "3d"]}
          onChange={setView}
        />
      </div>

      {view === "flat" && (
        <div className="w-fit p-3">
          <div
            className="relative"
            style={{
              display: "grid",
              gridTemplateColumns: `${CORNER}px repeat(${cols}, ${CELL}px)`,
              gridTemplateRows: `${HEADER}px repeat(${rows}, ${CELL}px)`,
              gap: GAP,
            }}
          >
            <div
              className="relative text-[0.6rem] leading-none font-semibold text-teal-400"
              style={{
                gridColumn: 1,
                gridRow: 1,
                backgroundImage:
                  "linear-gradient(to top right, transparent calc(50% - 0.5px), rgba(45,212,191,0.4) calc(50% - 0.5px), rgba(45,212,191,0.4) calc(50% + 0.5px), transparent calc(50% + 0.5px))",
              }}
            >
              <span className="absolute top-0 -right-1 whitespace-nowrap">
                <VarLabels hi={colBits} lo={1} />
              </span>
              {rowBits > 0 && (
                <span className="absolute bottom-1 left-0 whitespace-nowrap">
                  <VarLabels hi={numVars} lo={colBits + 1} />
                </span>
              )}
            </div>

            {Array.from({ length: cols }, (_, c) => (
              <div
                key={`col-${c}`}
                className="flex items-end justify-center text-xs font-bold tracking-widest text-amber-300/90"
                style={{ gridColumn: c + 2, gridRow: 1 }}
              >
                {bin(gray(c), colBits)}
              </div>
            ))}

            {Array.from({ length: rows }, (_, r) => (
              <div
                key={`row-${r}`}
                className="flex items-center justify-end pr-1 text-xs font-bold tracking-widest text-amber-300/90"
                style={{ gridColumn: 1, gridRow: r + 2 }}
              >
                {rowBits > 0 ? bin(gray(r), rowBits) : ""}
              </div>
            ))}

            {Array.from({ length: rows }, (_, r) =>
              Array.from({ length: cols }, (_, c) => {
                const term = cellTerm(r, c, dims);
                const ringed = activeCells?.has(term);
                return (
                  <button
                    key={`${r}-${c}`}
                    onClick={() => onToggle(term)}
                    title={`term ${term}`}
                    style={{
                      gridColumn: c + 2,
                      gridRow: r + 2,
                      ...(ringed
                        ? {
                            boxShadow: `0 0 0 3px ${activeColor}, 0 0 12px -2px ${activeColor}`,
                            zIndex: 1,
                          }
                        : {}),
                    }}
                    className={`flex flex-col items-center justify-center rounded-sm text-lg font-bold transition-colors ${cellClasses(outputs[term])}`}
                  >
                    <span className="leading-none">{outputs[term]}</span>
                    <span className="text-[0.6rem] font-normal opacity-55">
                      {term}
                    </span>
                  </button>
                );
              }),
            )}

            <div className="pointer-events-none absolute inset-0">
              {loops(groups, rows, cols, colBits, palette).map((loop) => {
                const isActive = active >= 0 && loop.groupIndex === active;
                const dimmed = active >= 0 && loop.groupIndex !== active;
                return (
                  <div
                    key={loop.key}
                    className="absolute rounded-lg transition-all"
                    style={{
                      left: loop.left,
                      top: loop.top,
                      width: loop.width,
                      height: loop.height,
                      border: `${isActive ? 3.5 : 2.5}px solid ${loop.color}`,
                      backgroundColor: `${loop.color}${isActive ? "33" : "1f"}`,
                      boxShadow: dimmed ? "none" : `0 0 6px -1px ${loop.color}`,
                      opacity: dimmed ? 0.25 : 1,
                    }}
                  />
                );
              })}
            </div>
          </div>
        </div>
      )}

      {view === "3d" && (
        <Suspense
          fallback={
            <div className="text-[0.7rem] tracking-widest text-teal-500">
              loading 3D…
            </div>
          }
        >
          <KmapSurface
            numVars={numVars}
            outputs={outputs}
            onToggle={onToggle}
            groups={groups}
            palette={palette}
            active={active}
          />
        </Suspense>
      )}

      {groupCount > 0 && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[0.7rem] tracking-widest uppercase">
          <div className="flex shrink-0 items-center gap-1">
            <span className="mr-1 text-teal-500">Group</span>
            <StepButton dir="prev" onClick={() => step(-1)} />
            <span className="w-12 text-center font-bold text-amber-200">
              {active < 0 ? "all" : `${active + 1}/${groupCount}`}
            </span>
            <StepButton dir="next" onClick={() => step(1)} />
          </div>
          {active >= 0 && (
            <div className="flex min-w-0 items-center gap-2 tracking-normal text-teal-300 normal-case">
              <span
                className="shrink-0 font-bold"
                style={{ color: activeColor }}
              >
                Group {active + 1}
              </span>
              {showExpr ? (
                <GroupExpression
                  group={groups[active]}
                  numVars={numVars}
                  isPOS={mode === "pos"}
                />
              ) : (
                <TermSet
                  key={active}
                  symbol={mode === "pos" ? "M" : "m"}
                  terms={activeTerms}
                  plain
                />
              )}
              <button
                onClick={() => setShowExpr((v) => !v)}
                title={showExpr ? "show terms" : "show expression"}
                aria-label={showExpr ? "show terms" : "show expression"}
                className="shrink-0 rounded-sm border border-teal-800/60 px-1.5 py-1 text-teal-400 transition-colors hover:bg-teal-400/10"
              >
                <svg viewBox="0 0 16 16" className="h-3 w-3 fill-current">
                  <path d="M2 4H11V1L15 5L11 9V6H2Z M14 12H5V15L1 11L5 7V10H14Z" />
                </svg>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
