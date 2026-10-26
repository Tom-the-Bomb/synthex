import { ArrowLeftRight, ChevronLeft, ChevronRight } from "lucide-react";
import { Component, lazy, Suspense, useState, type ReactNode } from "react";

import { TermSet } from "./terms";
import { Button } from "./ui/button";
import { IconButton } from "./ui/icon-button";
import { Segmented } from "./ui/segmented";
import type { Implicant } from "../lib/algorithm";
import { CellState, cellClasses } from "../lib/cellState";
import { implicantLiterals } from "../lib/expression";
import {
  groupColor,
  groupInk,
  groupText,
  groupTint,
  type Mode,
} from "../lib/groups";
import { bin, cellTerm, coveredCells, gray, kmapDims } from "../lib/kmap";
import { remScale, useMediaQuery, useWidth } from "../lib/media";
import { cn } from "../lib/utils";

const KMapSurface = lazy(() => import("./KMapSurface"));

// three.js needs WebGL 2 and fails silently without it
let webgl: boolean | undefined;
function hasWebGL(): boolean {
  if (webgl === undefined) {
    const gl = document.createElement("canvas").getContext("webgl2");
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
    webgl = gl !== null;
  }
  return webgl;
}

class LoadBoundary extends Component<
  { fallback: ReactNode; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function Well({ children }: { children: ReactNode }) {
  return (
    <div className="mt-6 grid h-canvas place-content-center justify-items-center gap-3 rounded-lg border border-line bg-surface-2 px-6 text-center text-xs text-fg-2">
      {children}
    </div>
  );
}

const GAP = 6;
const HEADER = 26;
const MIN_CELL = 40;

function cornerWidth(colBits: number, rowBits: number): number {
  if (colBits >= 3) {
    return 76;
  }
  return rowBits >= 2 ? 56 : 48;
}

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

interface Geometry {
  cell: number;
  gap: number;
  corner: number;
  header: number;
  inset: number;
}

function loops(
  groups: Implicant[],
  rowCount: number,
  colCount: number,
  colBits: number,
  isPOS: boolean,
  { cell, gap, corner, header, inset }: Geometry,
): Loop[] {
  const originX = corner + gap;
  const originY = header + gap;
  return groups.flatMap((group, index) => {
    const { rows, cols } = coveredCells(group, rowCount, colCount, colBits);
    const pad = inset + (index % 3) * inset;
    const color = groupColor(isPOS, index);
    return runs(rows).flatMap(([r0, r1]) =>
      runs(cols).map(([c0, c1]) => ({
        key: `${index}-${r0}-${c0}`,
        groupIndex: index,
        color,
        left: originX + c0 * (cell + gap) + pad,
        top: originY + r0 * (cell + gap) + pad,
        width: (c1 - c0 + 1) * cell + (c1 - c0) * gap - 2 * pad,
        height: (r1 - r0 + 1) * cell + (r1 - r0) * gap - 2 * pad,
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

interface MapProps {
  numVars: number;
  outputs: CellState[];
  onToggle: (term: number) => void;
  groups: Implicant[];
  selected: number;
}

function FlatMap({
  numVars,
  outputs,
  onToggle,
  groups,
  selected,
  isPOS,
}: MapProps & { isPOS: boolean }) {
  const { rows, cols, rowBits, colBits } = kmapDims(numVars);
  const wide = useMediaQuery("(min-width: 80rem)");
  const [mapRef, room] = useWidth<HTMLDivElement>(Infinity);
  const unit = remScale();
  const gap = GAP * unit;
  const corner = cornerWidth(colBits, rowBits) * unit;
  // fit the pane unless cells would get too small; then scroll
  const fit = Math.floor((room - corner) / cols - gap);
  const cell = Math.min(
    cellSize(numVars, wide) * unit,
    fit >= MIN_CELL * unit ? fit : Infinity,
  );
  const geometry: Geometry = {
    cell,
    gap,
    corner,
    header: HEADER * unit,
    inset: (cell >= 58 * unit ? 4 : 2) * unit,
  };

  return (
    <div
      ref={mapRef}
      className="scroll-slim flex justify-center-safe overflow-x-auto px-4 pt-3 pb-6"
    >
      <div
        className="relative grid w-fit shrink-0"
        style={{
          gridTemplateColumns: `${corner}px repeat(${cols}, ${cell}px)`,
          gridTemplateRows: `${geometry.header}px repeat(${rows}, ${cell}px)`,
          gap,
        }}
      >
        <div
          className="relative col-start-1 row-start-1 font-mono text-[0.6875rem] leading-none text-fg-2"
          style={{
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
                <span className="text-[0.6875rem] leading-none font-normal opacity-80">
                  {term}
                </span>
              </button>
            );
          }),
        )}

        <div className="pointer-events-none absolute inset-0">
          {loops(groups, rows, cols, colBits, isPOS, geometry).map((loop) => {
            const isSelected = loop.groupIndex === selected;
            const dimmed = selected >= 0 && !isSelected;
            return (
              <div
                key={loop.key}
                className="absolute rounded-[0.6875rem] transition-[opacity,box-shadow,border-width] duration-150 ease-out"
                style={{
                  left: loop.left,
                  top: loop.top,
                  width: loop.width,
                  height: loop.height,
                  border: `${isSelected ? 3.5 : 2.5}px solid ${groupInk(loop.color)}`,
                  boxShadow: isSelected
                    ? `0 0 0 3px ${groupTint(loop.color, 22)}`
                    : undefined,
                  opacity: dimmed ? 0.4 : 1,
                }}
              />
            );
          })}
        </div>
      </div>
      {/* mirrors the row labels so small maps centre */}
      {numVars <= 2 && (
        <div
          aria-hidden="true"
          className="min-w-0 shrink"
          style={{ width: corner + gap }}
        />
      )}
    </div>
  );
}

export default function KMap({
  numVars,
  outputs,
  onToggle,
  mode,
  onModeChange,
  groups,
  selected,
  onSelect,
}: MapProps & {
  mode: Mode;
  onModeChange: (mode: Mode) => void;
  onSelect: (index: number) => void;
}) {
  const [view, setView] = useState<View>("flat");
  const [showExpr, setShowExpr] = useState(false);
  const isPOS = mode === "pos";

  const groupCount = groups.length;
  // -1 is "all"; wraps both ways
  const step = (dir: number) => {
    const count = groupCount + 1;
    onSelect(((selected + 1 + dir + count) % count) - 1);
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
        <FlatMap
          numVars={numVars}
          outputs={outputs}
          onToggle={onToggle}
          groups={groups}
          selected={selected}
          isPOS={isPOS}
        />
      )}

      {view === "3d" && (
        <div className="px-4 pt-1 pb-4">
          {hasWebGL() ? (
            <LoadBoundary
              fallback={
                <Well>
                  The 3D view couldn&rsquo;t load. Check your connection, then
                  reload the page.
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => location.reload()}
                  >
                    Reload
                  </Button>
                </Well>
              }
            >
              <Suspense fallback={<Well>loading 3D…</Well>}>
                <KMapSurface
                  numVars={numVars}
                  outputs={outputs}
                  onToggle={onToggle}
                  groups={groups}
                  isPOS={isPOS}
                  selected={selected}
                />
              </Suspense>
            </LoadBoundary>
          ) : (
            <Well>
              The 3D view needs WebGL 2, which this browser doesn&rsquo;t
              provide. The flat map shows the same groups.
            </Well>
          )}
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
                {selected < 0 ? "all" : `${selected + 1}/${groupCount}`}
              </span>
              <IconButton label="Next group" onClick={() => step(1)}>
                <ChevronRight />
              </IconButton>
            </div>
          </div>
          {selected >= 0 && (
            <div className="flex min-w-0 items-center gap-2 text-sm">
              <span
                className="shrink-0 font-medium"
                style={{ color: groupText(groupColor(isPOS, selected)) }}
              >
                Group {selected + 1}
              </span>
              <span className="min-w-0 font-mono text-fg">
                {showExpr ? (
                  <GroupExpression
                    group={groups[selected]}
                    numVars={numVars}
                    isPOS={isPOS}
                  />
                ) : (
                  <TermSet
                    key={selected}
                    symbol={isPOS ? "M" : "m"}
                    terms={[...groups[selected].covered].sort((a, b) => a - b)}
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
