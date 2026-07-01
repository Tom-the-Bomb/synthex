import { useState, type ReactNode } from "react";

import { CellState, toggleCellState } from "./cellState";
import ExpressionInput from "./components/ExpressionInput";
import KMap from "./components/KMap";
import Output from "./components/Output";
import Table from "./components/Table";
import { MAX_KMAP_VARS } from "./kmap";

const MIN_VARS = 1;
const MAX_VARS = 8;
const DEFAULT_VARS = 4;

function makeOutputs(numVars: number): CellState[] {
  return Array.from({ length: 1 << numVars }, () => CellState.False);
}

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
        <h2 className="text-xs font-bold tracking-[0.25em] text-teal-300 uppercase">
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

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col border-l border-teal-800/50 px-3 py-1 first:border-l-0">
      <span className="text-[0.6rem] tracking-widest text-teal-500 uppercase">
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
  const [clearNonce, setClearNonce] = useState(0);

  function changeVars(next: number) {
    next = Math.min(MAX_VARS, Math.max(MIN_VARS, next));
    if (next === numVars) {
      return;
    }
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

  function applyExpression(nextVars: number, nextOutputs: CellState[]) {
    setNumVars(nextVars);
    setOutputs(nextOutputs);
  }

  const hasKMap = numVars <= MAX_KMAP_VARS;

  return (
    <div className="blueprint-bg min-h-screen px-4 py-8 text-teal-100 sm:px-8">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <header className="titleblock flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-black tracking-[0.3em] text-teal-50">
              SYNTHEX
            </h1>
            <p className="mt-1 text-[0.7rem] tracking-[0.2em] text-teal-400 uppercase">
              Karnaugh map · boolean minimizer
            </p>
          </div>
          <div className="flex border border-teal-800/60 bg-[#0b1c28]/70">
            <Field label="Vars" value={String(numVars)} />
            <Field label="Rows" value={String(1 << numVars)} />
          </div>
        </header>

        <div className="flex flex-wrap items-center justify-between gap-4 border border-dashed border-teal-800/60 bg-[#0c1f2c]/60 px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="text-[0.7rem] tracking-widest text-teal-400 uppercase">
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
              <span className="w-10 text-center text-lg font-bold text-amber-300 tabular-nums">
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
              onClick={() => {
                setOutputs(makeOutputs(numVars));
                setClearNonce((n) => n + 1);
              }}
              className="border border-teal-700/70 px-3 py-1.5 text-[0.7rem] font-bold tracking-widest text-teal-300 uppercase transition-colors hover:bg-teal-400/10"
            >
              Clear
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.7rem] tracking-wider uppercase">
            <Swatch box="bg-amber-400" label="1 · min" />
            <Swatch box="bg-sky-950 border border-sky-700" label="0 · max" />
            <Swatch
              box="border border-dashed border-teal-500 bg-transparent"
              label="x · dc"
            />
          </div>
        </div>

        <div className="grid items-start gap-6 lg:grid-cols-[auto_1fr]">
          <div className="flex flex-col gap-6">
            {hasKMap ? (
              <Panel title="K-Map" tag={`${1 << numVars} CELLS`}>
                <div className="overflow-x-auto">
                  <KMap numVars={numVars} outputs={outputs} onToggle={toggle} />
                </div>
              </Panel>
            ) : (
              <Panel title="K-Map" tag="N/A">
                <p className="max-w-xs text-sm leading-relaxed text-teal-500/80">
                  The map supports up to {MAX_KMAP_VARS} variables. Use the
                  truth table to edit larger functions.
                </p>
              </Panel>
            )}

            <ExpressionInput
              key={clearNonce}
              numVars={numVars}
              onApply={applyExpression}
            />
          </div>

          <Panel title="Truth Table" tag={`${1 << numVars} ROWS`}>
            <Table numVars={numVars} outputs={outputs} onToggle={toggle} />
          </Panel>
        </div>

        <Panel title="Minimal Expression" tag="QUINE–McCLUSKEY">
          <Output outputs={outputs} />
        </Panel>

        <footer className="mt-2 flex flex-col items-center gap-3 border-t border-dashed border-teal-800/60 pt-5">
          <a
            href="https://github.com/tom-the-bomb/synthex"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 border border-teal-800/60 bg-[#0c1f2c]/60 px-3 py-1.5 text-[0.7rem] font-bold tracking-widest text-teal-300 uppercase transition-colors hover:border-amber-400/50 hover:text-amber-300"
          >
            <svg
              viewBox="0 0 16 16"
              aria-hidden="true"
              className="h-3.5 w-3.5 fill-current"
            >
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
            </svg>
            Tom-the-Bomb 2026
          </a>
        </footer>
      </div>
    </div>
  );
}

export default App;
