import { lazy, Suspense, useState } from "react";
import { CellState, cellClasses } from "../cellState";
import { Table, computeCover, type Implicant } from "../algorithm";
import { bin, cellTerm, gray, kmapDims } from "../kmap";

const KmapSurface = lazy(() => import("./KmapSurface"));

const CELL = 46;
const GAP = 6;
const CORNER = 54;
const HEADER = 34;
const ORIGIN_X = CORNER + GAP;
const ORIGIN_Y = HEADER + GAP;

const SOP_COLORS = ["#2563eb", "#dc2626", "#9333ea", "#db2777", "#0891b2", "#15803d", "#4f46e5", "#e11d48"];
const POS_COLORS = ["#f87171", "#38bdf8", "#34d399", "#c084fc", "#fb923c", "#f472b6", "#a3e635", "#22d3ee"];

type Mode = "sop" | "pos" | "off";
type View = "flat" | "3d";

interface Loop {
  key: string;
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

function coveredCells(group: Implicant, rowCount: number, colCount: number, colBits: number) {
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
        color,
        left: ORIGIN_X + c0 * (CELL + GAP) + pad,
        top: ORIGIN_Y + r0 * (CELL + GAP) + pad,
        width: (c1 - c0 + 1) * CELL + (c1 - c0) * GAP - 2 * pad,
        height: (r1 - r0 + 1) * CELL + (r1 - r0) * GAP - 2 * pad,
      })),
    );
  });
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
  const dims = kmapDims(numVars);
  const { rows, cols, rowBits, colBits } = dims;

  const palette = mode === "pos" ? POS_COLORS : SOP_COLORS;
  const table = new Table(
    outputs.map((_, i) => i),
    outputs,
  );
  const groups = mode === "off" ? [] : computeCover(table, mode === "pos");

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[0.7rem] uppercase tracking-widest">
        <Segmented label="Groups" value={mode} options={["sop", "pos", "off"]} onChange={setMode} />
        <Segmented label="View" value={view} options={["flat", "3d"]} onChange={setView} />
      </div>

      {view === "flat" && (
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
              return (
                <button
                  key={`${r}-${c}`}
                  onClick={() => onToggle(term)}
                  title={`term ${term}`}
                  style={{ gridColumn: c + 2, gridRow: r + 2 }}
                  className={`flex flex-col items-center justify-center rounded-sm text-lg font-bold transition-colors ${cellClasses(outputs[term])}`}
                >
                  <span className="leading-none">{outputs[term]}</span>
                  <span className="text-[0.6rem] font-normal opacity-55">{term}</span>
                </button>
              );
            }),
          )}

          <div className="pointer-events-none absolute inset-0">
            {loops(groups, rows, cols, colBits, palette).map((loop) => (
              <div
                key={loop.key}
                className="absolute rounded-lg"
                style={{
                  left: loop.left,
                  top: loop.top,
                  width: loop.width,
                  height: loop.height,
                  border: `2.5px solid ${loop.color}`,
                  backgroundColor: `${loop.color}1f`,
                  boxShadow: `0 0 6px -1px ${loop.color}`,
                }}
              />
            ))}
          </div>
        </div>
      )}

      {view === "3d" && (
        <Suspense
          fallback={
            <div className="text-[0.7rem] tracking-widest text-teal-500">loading 3D…</div>
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
