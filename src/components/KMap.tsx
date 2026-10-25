import { ArrowLeftRight, ChevronLeft, ChevronRight } from "lucide-react";
import { lazy, Suspense, useState, type ReactNode } from "react";

import { TermSet } from "./terms";
import { IconButton } from "./ui/icon-button";
import { Segmented } from "./ui/segmented";
import type { Implicant } from "../lib/algorithm";
import { CellState, cellClasses } from "../lib/cellState";
import { implicantLiterals } from "../lib/expression";
import { groupColor, groupInk, groupTint, type Mode } from "../lib/groups";
import { bin, cellTerm, coveredCells, gray, kmapDims } from "../lib/kmap";
import { useMediaQuery } from "../lib/media";
import { cn } from "../lib/utils";

const KMapSurface = lazy(() => import("./KMapSurface"));

const GAP = 6;
const HEADER = 26;
const ORIGIN_Y = HEADER + GAP;

// The corner holds the column variables above its diagonal and the row
// variables below; it widens until both clear the diagonal.
function cornerWidth(colBits: number, rowBits: number): number {
  if (colBits >= 3) {
    return 76;
  }
  return rowBits >= 2 ? 56 : 48;
}

// Cells grow when the map has its own column, and shrink for the twice-as-wide
// five-variable map.
function cellSize(numVars: number, wide: boolean): number {
  if (numVars >= 5) {
    return wide ? 50 : 46;
  }
  return wide ? 70 : 58;
}

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

function VarLabels({ hi, lo }: { hi: number; lo: number }) {
  return (
    <span className="inline-flex gap-0.5">
      {Array.from({ length: hi - lo + 1 }, (_, i) => hi - i).map((v) => (
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

function loops(
  groups: Implicant[],
  rowCount: number,
  colCount: number,
  colBits: number,
  isPOS: boolean,
  cell: number,
  corner: number,
): Loop[] {
  const originX = corner + GAP;
  // staggered insets, so overlapping groups nest instead of tracing each other
  const step = cell >= 58 ? 4 : 2;
  return groups.flatMap((group, index) => {
    const { rows, cols } = coveredCells(group, rowCount, colCount, colBits);
    const pad = step + (index % 3) * step;
    const color = groupColor(isPOS, index);
    return runs(rows).flatMap(([r0, r1]) =>
      runs(cols).map(([c0, c1]) => ({
        key: `${index}-${r0}-${c0}`,
        groupIndex: index,
        color,
        left: originX + c0 * (cell + GAP) + pad,
        top: ORIGIN_Y + r0 * (cell + GAP) + pad,
        width: (c1 - c0 + 1) * cell + (c1 - c0) * GAP - 2 * pad,
        height: (r1 - r0 + 1) * cell + (r1 - r0) * GAP - 2 * pad,
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
  const literals: ReactNode[] = implicantLiterals(group, numVars, isPOS).map(
    ({ bit, complemented }) => (
      <span key={bit} className="whitespace-nowrap">
        {complemented ? <span className="overline">x</span> : "x"}
        <sub>{bit + 1}</sub>
      </span>
    ),
  );

  if (literals.length === 0) {
    return <span>{isPOS ? "0" : "1"}</span>;
  }

  if (!isPOS) {
    return <span className="inline-flex gap-0.5">{literals}</span>;
  }

  const sum = literals.flatMap((literal, i) =>
    i === 0 ? [literal] : [<span key={`plus-${i}`}> + </span>, literal],
  );
  return (
    <span className="whitespace-nowrap">
      {literals.length > 1 ? <>({sum})</> : sum}
    </span>
  );
}

export default function KMap({
  numVars,
  outputs,
  onToggle,
  mode,
  onModeChange,
  groups,
  selected: active,
  onSelect,
}: {
  numVars: number;
  outputs: CellState[];
  onToggle: (term: number) => void;
  mode: Mode;
  onModeChange: (mode: Mode) => void;
  groups: Implicant[];
  selected: number;
  onSelect: (index: number) => void;
}) {
  const [view, setView] = useState<View>("flat");
  const [showExpr, setShowExpr] = useState(false);
  const { rows, cols, rowBits, colBits } = kmapDims(numVars);
  const wide = useMediaQuery("(min-width: 80rem)");
  const cell = cellSize(numVars, wide);
  const corner = cornerWidth(colBits, rowBits);
  const isPOS = mode === "pos";

  const groupCount = groups.length;
  // cycles through "all" (-1) and each group, wrapping both ways
  const step = (dir: number) => {
    const count = groupCount + 1;
    onSelect(((active + 1 + dir + count) % count) - 1);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
        <Segmented
          label="Groups"
          value={mode}
          options={["sop", "pos", "off"]}
          onChange={onModeChange}
        />
        <Segmented
          label="View"
          value={view}
          options={["flat", "3d"]}
          onChange={setView}
        />
      </div>

      {view === "flat" && (
        <div className="scroll-slim flex justify-center-safe overflow-x-auto px-4 pt-3 pb-6">
          <div
            className="relative w-fit shrink-0"
            style={{
              display: "grid",
              gridTemplateColumns: `${corner}px repeat(${cols}, ${cell}px)`,
              gridTemplateRows: `${HEADER}px repeat(${rows}, ${cell}px)`,
              gap: GAP,
            }}
          >
            <div
              className="relative font-mono text-[11px] leading-none text-fg-2"
              style={{
                gridColumn: 1,
                gridRow: 1,
                backgroundImage:
                  "linear-gradient(to top right, transparent calc(50% - 0.5px), var(--line-2) calc(50% - 0.5px), var(--line-2) calc(50% + 0.5px), transparent calc(50% + 0.5px))",
              }}
            >
              <span className="absolute top-0 -right-1 whitespace-nowrap">
                <VarLabels hi={colBits} lo={1} />
              </span>
              {rowBits > 0 && (
                <span className="absolute bottom-0.5 left-0 whitespace-nowrap">
                  <VarLabels hi={numVars} lo={colBits + 1} />
                </span>
              )}
            </div>

            {Array.from({ length: cols }, (_, c) => (
              <div
                key={`col-${c}`}
                className="flex items-end justify-center font-mono text-xs text-fg-2"
                style={{ gridColumn: c + 2, gridRow: 1 }}
              >
                {bin(gray(c), colBits)}
              </div>
            ))}

            {Array.from({ length: rows }, (_, r) => (
              <div
                key={`row-${r}`}
                className="flex items-center justify-end pr-2 font-mono text-xs text-fg-2"
                style={{ gridColumn: 1, gridRow: r + 2 }}
              >
                {rowBits > 0 ? bin(gray(r), rowBits) : ""}
              </div>
            ))}

            {Array.from({ length: rows }, (_, r) =>
              Array.from({ length: cols }, (_, c) => {
                const term = cellTerm(r, c, cols);
                const state = outputs[term];
                return (
                  <button
                    key={`${r}-${c}`}
                    type="button"
                    onClick={() => onToggle(term)}
                    title={`term ${term}`}
                    aria-label={`term ${term}, ${state}`}
                    style={{ gridColumn: c + 2, gridRow: r + 2 }}
                    className={cn(
                      "flex flex-col items-center justify-center gap-1 rounded-lg border font-mono font-medium transition-colors duration-150",
                      numVars >= 5 ? "text-lg" : "text-xl",
                      cellClasses(state),
                    )}
                  >
                    <span className="leading-none">{state}</span>
                    <span className="text-[11px] leading-none font-normal opacity-80">
                      {term}
                    </span>
                  </button>
                );
              }),
            )}

            <div className="pointer-events-none absolute inset-0">
              {loops(groups, rows, cols, colBits, isPOS, cell, corner).map(
                (loop) => {
                  const isActive = loop.groupIndex === active;
                  const dimmed = active >= 0 && !isActive;
                  return (
                    <div
                      key={loop.key}
                      className="absolute rounded-[11px] transition-[opacity,box-shadow,border-width] duration-150 ease-out"
                      style={{
                        left: loop.left,
                        top: loop.top,
                        width: loop.width,
                        height: loop.height,
                        border: `${isActive ? 3.5 : 2.5}px solid ${groupInk(loop.color)}`,
                        // the ring carries selection; no fill, so 1-cells stay amber
                        boxShadow: isActive
                          ? `0 0 0 3px ${groupTint(loop.color, 22)}`
                          : undefined,
                        opacity: dimmed ? 0.4 : 1,
                      }}
                    />
                  );
                },
              )}
            </div>
          </div>
          {/* balances the row-label column so a narrow map's cells sit centred */}
          {numVars <= 2 && (
            <div
              aria-hidden="true"
              className="min-w-0 shrink"
              style={{ width: corner + GAP }}
            />
          )}
        </div>
      )}

      {view === "3d" && (
        <div className="px-4 pt-1 pb-4">
          <Suspense
            fallback={
              <div className="mt-6 grid h-110 place-items-center rounded-lg border border-line bg-surface-2 text-xs text-fg-2">
                loading 3D…
              </div>
            }
          >
            <KMapSurface
              numVars={numVars}
              outputs={outputs}
              onToggle={onToggle}
              groups={groups}
              isPOS={isPOS}
              active={active}
            />
          </Suspense>
        </div>
      )}

      {groupCount > 0 && (
        <div className="mt-auto flex min-h-13 flex-wrap items-center gap-x-3 gap-y-2 border-t border-line px-4 py-2.5">
          <div className="flex shrink-0 items-center gap-1.5">
            <span className="mr-1 text-xs text-fg-2">Group</span>
            <div className="flex items-center rounded-lg border border-line bg-surface-2 p-0.5">
              <IconButton label="Previous group" onClick={() => step(-1)}>
                <ChevronLeft />
              </IconButton>
              <span className="w-11 text-center font-mono text-xs text-fg">
                {active < 0 ? "all" : `${active + 1}/${groupCount}`}
              </span>
              <IconButton label="Next group" onClick={() => step(1)}>
                <ChevronRight />
              </IconButton>
            </div>
          </div>
          {active >= 0 && (
            <div className="flex min-w-0 items-center gap-2 text-sm">
              <span
                className="shrink-0 font-medium"
                style={{ color: groupInk(groupColor(isPOS, active)) }}
              >
                Group {active + 1}
              </span>
              <span className="min-w-0 font-mono text-fg">
                {showExpr ? (
                  <GroupExpression
                    group={groups[active]}
                    numVars={numVars}
                    isPOS={isPOS}
                  />
                ) : (
                  <TermSet
                    key={active}
                    symbol={isPOS ? "M" : "m"}
                    terms={[...groups[active].covered].sort((a, b) => a - b)}
                    plain
                  />
                )}
              </span>
              <IconButton
                label={showExpr ? "Show terms" : "Show expression"}
                onClick={() => setShowExpr((v) => !v)}
              >
                <ArrowLeftRight />
              </IconButton>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
