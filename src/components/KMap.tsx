import { lazy, Suspense, useMemo, useState } from "react";
import { CellState, cellClasses } from "../cellState";
import { Table, computeCover, type Implicant } from "../algorithm";
import { bin, cellTerm, gray, kmapDims } from "../kmap";

// three.js / r3f are heavy; only load the 3D surface when it is opened.
const KmapSurface = lazy(() => import("./KmapSurface"));

const CELL = 46; // cell size (px)
const GAP = 6; // gap between cells (px)
const CORNER = 54; // corner / row-header column width (px)
const HEADER = 34; // column-header row height (px)

// Top-left pixel offset of the first cell (after the corner track + gap).
const ORIGIN_X = CORNER + GAP;
const ORIGIN_Y = HEADER + GAP;

// Group loop palettes. SOP groups sit on the light amber minterm cells, so
// they use deeper, saturated hues (no yellow/orange). POS groups sit on the
// dark maxterm cells, where brighter hues read better.
const SOP_COLORS = [
  "#2563eb", // blue
  "#dc2626", // red
  "#9333ea", // violet
  "#db2777", // pink
  "#0891b2", // cyan
  "#15803d", // green
  "#4f46e5", // indigo
  "#e11d48", // rose
];
const POS_COLORS = [
  "#f87171", // red
  "#38bdf8", // sky
  "#34d399", // emerald
  "#c084fc", // purple
  "#fb923c", // orange
  "#f472b6", // pink
  "#a3e635", // lime
  "#22d3ee", // cyan
];

type Mode = "sop" | "pos" | "off";

// Variable labels for a contiguous bit range, most-significant first.
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

// Contiguous runs of consecutive integers in an ascending list.
function runs(idx: number[]): [number, number][] {
  const out: [number, number][] = [];
  for (const i of idx) {
    const last = out[out.length - 1];
    if (last && i === last[1] + 1) last[1] = i;
    else out.push([i, i]);
  }
  return out;
}

interface Loop {
  key: string;
  color: string;
  left: number;
  top: number;
  width: number;
  height: number;
}

// Each prime implicant covers a Cartesian block R x C of grid cells: the row
// gray code fixes the high bits, the column gray code the low bits.
function coveredRC(
  g: Implicant,
  rows: number,
  cols: number,
  colBits: number,
): { R: number[]; C: number[] } {
  const onesLow = g.ones & (cols - 1);
  const dashLow = g.dashes & (cols - 1);
  const onesHigh = g.ones >> colBits;
  const dashHigh = g.dashes >> colBits;

  const R = [];
  for (let r = 0; r < rows; r++)
    if ((gray(r) & ~dashHigh) === onesHigh) R.push(r);
  const C = [];
  for (let c = 0; c < cols; c++)
    if ((gray(c) & ~dashLow) === onesLow) C.push(c);
  return { R, C };
}

// On the flat map a wrapping block is split into several rectangles.
function loopsFor(
  groups: Implicant[],
  rows: number,
  cols: number,
  colBits: number,
  colors: string[],
): Loop[] {
  const loops: Loop[] = [];

  groups.forEach((g, gi) => {
    const { R, C } = coveredRC(g, rows, cols, colBits);
    const pad = 3 + (gi % 3) * 3; // stagger so overlapping groups stay visible
    const color = colors[gi % colors.length];

    for (const [r0, r1] of runs(R)) {
      for (const [c0, c1] of runs(C)) {
        loops.push({
          key: `${gi}-${r0}-${c0}`,
          color,
          left: ORIGIN_X + c0 * (CELL + GAP) + pad,
          top: ORIGIN_Y + r0 * (CELL + GAP) + pad,
          width: (c1 - c0 + 1) * CELL + (c1 - c0) * GAP - 2 * pad,
          height: (r1 - r0 + 1) * CELL + (r1 - r0) * GAP - 2 * pad,
        });
      }
    }
  });

  return loops;
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
  const [torus, setTorus] = useState(false);
  const dims = kmapDims(numVars);
  const { rows, cols, rowBits, colBits } = dims;

  const groups = useMemo(() => {
    if (mode === "off") return [];
    const table = new Table(
      outputs.map((_, i) => i),
      outputs,
    );
    return computeCover(table, mode === "pos");
  }, [mode, outputs]);

  const palette = mode === "pos" ? POS_COLORS : SOP_COLORS;
  const loops = loopsFor(groups, rows, cols, colBits, palette);

  return (
    <div className="flex flex-col gap-3">
      {/* controls */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[0.7rem] uppercase tracking-widest">
        <div className="flex items-center gap-1">
          <span className="mr-1 text-teal-500">Groups</span>
          {(["sop", "pos", "off"] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`rounded-sm border px-2 py-0.5 font-bold transition-colors ${
                mode === m
                  ? "border-amber-400/60 bg-amber-400/20 text-amber-200"
                  : "border-teal-800/60 text-teal-400 hover:bg-teal-400/10"
              }`}
            >
              {m}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <span className="mr-1 text-teal-500">View</span>
          {([false, true] as boolean[]).map((t) => (
            <button
              key={String(t)}
              onClick={() => setTorus(t)}
              className={`rounded-sm border px-2 py-0.5 font-bold transition-colors ${
                torus === t
                  ? "border-amber-400/60 bg-amber-400/20 text-amber-200"
                  : "border-teal-800/60 text-teal-400 hover:bg-teal-400/10"
              }`}
            >
              {t ? "3D" : "flat"}
            </button>
          ))}
        </div>
      </div>

      {!torus && (
        <div
          className="relative"
          style={{
            display: "grid",
            gridTemplateColumns: `${CORNER}px repeat(${cols}, ${CELL}px)`,
            gridTemplateRows: `${HEADER}px repeat(${rows}, ${CELL}px)`,
            gap: GAP,
          }}
        >
          {/* corner: column-variables (top-right) over row-variables (bottom-left),
            split by a diagonal — compact two-line form */}
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

          {/* column gray-code headers */}
          {Array.from({ length: cols }, (_, c) => (
            <div
              key={`ch-${c}`}
              className="flex items-end justify-center text-xs font-bold tracking-widest text-amber-300/90"
              style={{ gridColumn: c + 2, gridRow: 1 }}
            >
              {bin(gray(c), colBits)}
            </div>
          ))}

          {/* row gray-code headers */}
          {Array.from({ length: rows }, (_, r) => (
            <div
              key={`rh-${r}`}
              className="flex items-center justify-end pr-1 text-xs font-bold tracking-widest text-amber-300/90"
              style={{ gridColumn: 1, gridRow: r + 2 }}
            >
              {rowBits > 0 ? bin(gray(r), rowBits) : ""}
            </div>
          ))}

          {Array.from({ length: rows }, (_, r) =>
            Array.from({ length: cols }, (_, c) => {
              const term = cellTerm(r, c, dims);
              const state = outputs[term];
              return (
                <button
                  key={`${r}-${c}`}
                  onClick={() => onToggle(term)}
                  title={`term ${term}`}
                  style={{ gridColumn: c + 2, gridRow: r + 2 }}
                  className={`flex flex-col items-center justify-center rounded-sm text-lg font-bold transition-colors ${cellClasses(state)}`}
                >
                  <span className="leading-none">{state}</span>
                  <span className="text-[0.6rem] font-normal opacity-55">
                    {term}
                  </span>
                </button>
              );
            }),
          )}

          {/* group overlay */}
          <div className="pointer-events-none absolute inset-0">
            {loops.map((l) => (
              <div
                key={l.key}
                className="absolute rounded-lg"
                style={{
                  left: l.left,
                  top: l.top,
                  width: l.width,
                  height: l.height,
                  border: `2.5px solid ${l.color}`,
                  backgroundColor: `${l.color}1f`,
                  boxShadow: `0 0 6px -1px ${l.color}`,
                }}
              />
            ))}
          </div>
        </div>
      )}

      {torus && (
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
          />
        </Suspense>
      )}
    </div>
  );
}
