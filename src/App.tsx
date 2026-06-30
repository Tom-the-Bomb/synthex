import { useState, type ReactNode } from "react";
import Table from "./components/Table";
import KMap from "./components/KMap";
import Output from "./components/Output";
import { CellState, toggleCellState } from "./cellState";
import { MAX_KMAP_VARS } from "./kmap";

const MIN_VARS = 1;
const MAX_VARS = 8;
const DEFAULT_VARS = 4;

function makeOutputs(numVars: number): CellState[] {
  return Array.from({ length: 1 << numVars }, () => CellState.False);
}

// A framed "instrument" panel with a labelled title bar.
function Panel({
  title,
  tag,
  children,
  className = "",
}: {
  title: string;
  tag?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel ${className}`}>
      <div className="flex items-center justify-between border-b border-teal-800/50 px-4 py-2">
        <h2 className="text-xs font-bold uppercase tracking-[0.25em] text-teal-300">
          {title}
        </h2>
        {tag && (
          <span className="text-[0.65rem] font-bold tracking-widest text-amber-300/70">
            {tag}
          </span>
        )}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

// A single field in the drawing title block.
function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col border-l border-teal-800/50 px-3 py-1 first:border-l-0">
      <span className="text-[0.6rem] uppercase tracking-widest text-teal-500">
        {label}
      </span>
      <span className="font-bold tracking-wider text-amber-200">{value}</span>
    </div>
  );
}

function Swatch({ box, label }: { box: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-teal-300/80">
      <span className={`inline-block h-3 w-3 rounded-xs ${box}`} />
      {label}
    </span>
  );
}

function App() {
  const [numVars, setNumVars] = useState(DEFAULT_VARS);
  const [outputs, setOutputs] = useState<CellState[]>(() =>
    makeOutputs(DEFAULT_VARS),
  );

  // Resize the outputs array, keeping existing values and prefilling new rows.
  function changeVars(next: number) {
    next = Math.min(MAX_VARS, Math.max(MIN_VARS, next));
    if (next === numVars) return;
    setOutputs((prev) =>
      Array.from({ length: 1 << next }, (_, i) => prev[i] ?? CellState.False),
    );
    setNumVars(next);
  }

  function toggle(term: number) {
    setOutputs((prev) =>
      prev.map((s, i) => (i === term ? toggleCellState(s) : s)),
    );
  }

  const hasKMap = numVars <= MAX_KMAP_VARS;

  return (
    <div className="blueprint-bg min-h-screen px-4 py-8 text-teal-100 sm:px-8">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        {/* Title block */}
        <header className="titleblock flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-black tracking-[0.3em] text-teal-50">
              SYNTHEX
            </h1>
            <p className="mt-1 text-[0.7rem] uppercase tracking-[0.2em] text-teal-400">
              Karnaugh map · boolean minimizer
            </p>
          </div>
          <div className="flex border border-teal-800/60 bg-[#0b1c28]/70">
            <Field label="Vars" value={String(numVars)} />
            <Field label="Rows" value={String(1 << numVars)} />
          </div>
        </header>

        {/* Control strip */}
        <div className="flex flex-wrap items-center justify-between gap-4 border border-dashed border-teal-800/60 bg-[#0c1f2c]/60 px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="text-[0.7rem] uppercase tracking-widest text-teal-400">
              Variables
            </span>
            <div className="flex items-center border border-teal-700/70 bg-[#0a1722]">
              <button
                onClick={() => changeVars(numVars - 1)}
                disabled={numVars <= MIN_VARS}
                className="h-8 w-9 text-lg font-bold text-teal-200 transition-colors hover:bg-teal-400/10 disabled:opacity-30"
              >
                −
              </button>
              <span className="w-10 text-center text-lg font-bold tabular-nums text-amber-300">
                {numVars}
              </span>
              <button
                onClick={() => changeVars(numVars + 1)}
                disabled={numVars >= MAX_VARS}
                className="h-8 w-9 text-lg font-bold text-teal-200 transition-colors hover:bg-teal-400/10 disabled:opacity-30"
              >
                +
              </button>
            </div>
            <button
              onClick={() => setOutputs(makeOutputs(numVars))}
              className="border border-teal-700/70 px-3 py-1.5 text-[0.7rem] font-bold uppercase tracking-widest text-teal-300 transition-colors hover:bg-teal-400/10"
            >
              Clear
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.7rem] uppercase tracking-wider">
            <Swatch box="bg-amber-400" label="1 · min" />
            <Swatch box="bg-sky-950 border border-sky-700" label="0 · max" />
            <Swatch
              box="border border-dashed border-teal-500 bg-transparent"
              label="x · dc"
            />
          </div>
        </div>

        {/* Workspace */}
        <div className="grid items-start gap-6 lg:grid-cols-[auto_1fr]">
          {hasKMap ? (
            <Panel title="K-Map" tag={`${1 << numVars} CELLS`}>
              <div className="overflow-x-auto">
                <KMap numVars={numVars} outputs={outputs} onToggle={toggle} />
              </div>
            </Panel>
          ) : (
            <Panel title="K-Map" tag="N/A">
              <p className="max-w-xs text-sm leading-relaxed text-teal-500/80">
                The map supports up to {MAX_KMAP_VARS} variables. Use the truth
                table to edit larger functions.
              </p>
            </Panel>
          )}

          <Panel title="Truth Table" tag={`${1 << numVars} ROWS`}>
            <Table numVars={numVars} outputs={outputs} onToggle={toggle} />
          </Panel>
        </div>

        <Panel title="Minimal Expression" tag="QUINE–McCLUSKEY">
          <Output outputs={outputs} />
        </Panel>
      </div>
    </div>
  );
}

export default App;
