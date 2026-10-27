import { Minus, Plus } from "lucide-react";
import { Tabs } from "radix-ui";
import { useId, useState, type ReactNode } from "react";

import ExpressionInput from "./components/ExpressionInput";
import KMap from "./components/KMap";
import Output from "./components/Output";
import Table from "./components/Table";
import Timing from "./components/Timing";
import { Button } from "./components/ui/button";
import { IconButton } from "./components/ui/icon-button";
import { segmentItem, segmentTrack } from "./components/ui/styles";
import { TooltipProvider } from "./components/ui/tooltip";
import { computeCover, Table as TermTable } from "./lib/algorithm";
import { CellState, toggleCellState } from "./lib/cellState";
import type { Mode, ViewProps } from "./lib/groups";
import { MAX_KMAP_VARS, MAX_VARS } from "./lib/kmap";
import { cn } from "./lib/utils";

const MIN_VARS = 1;
const DEFAULT_VARS = 4;

type TableView = "table" | "timing";
const tabPanel = "flex min-h-0 flex-1 flex-col focus-visible:-outline-offset-2";

function makeOutputs(numVars: number): CellState[] {
  return Array.from({ length: 1 << numVars }, () => CellState.False);
}

function Pane({
  title,
  meta,
  className,
  children,
}: {
  title: string;
  meta?: string;
  className?: string;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <section
      aria-labelledby={id}
      className={cn(
        "flex min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border border-line bg-surface",
        className,
      )}
    >
      <div className="flex items-baseline justify-between gap-3 border-b border-line px-4 py-3">
        <h2 id={id} className="text-sm font-semibold">
          {title}
        </h2>
        {meta && <span className="font-mono text-xs text-fg-2">{meta}</span>}
      </div>
      {children}
    </section>
  );
}

function Readout({ label, value }: { label: string; value: number }) {
  return (
    <span className="flex h-7 items-center gap-1.5 rounded-md border border-line px-2 text-xs text-fg-2">
      {label} <span className="font-mono text-fg">{value}</span>
    </span>
  );
}

function Swatch({ box, label }: { box: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={cn("size-3 rounded-[3px] border", box)} />
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
  const [mode, setMode] = useState<Mode>("sop");
  const [selected, setSelected] = useState(-1);
  const [tableView, setTableView] = useState<TableView>("table");

  function changeVars(next: number) {
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

  // a selection indexes the current cover, so replacing the cover clears it
  function replaceFunction(nextVars: number, nextOutputs: CellState[]) {
    setNumVars(nextVars);
    setOutputs(nextOutputs);
    setSelected(-1);
  }

  function clear() {
    replaceFunction(numVars, makeOutputs(numVars));
    setClearNonce((n) => n + 1);
  }

  function changeMode(next: Mode) {
    setMode(next);
    setSelected(-1);
  }

  function selectGroup(isPOS: boolean, index: number) {
    const target: Mode = isPOS ? "pos" : "sop";
    if (mode === target && selected === index) {
      setSelected(-1);
      return;
    }
    setMode(target);
    setSelected(index);
  }

  const table = new TermTable(outputs);
  const sopCover = computeCover(table, false);
  const posCover = computeCover(table, true);
  const groups = mode === "pos" ? posCover : mode === "sop" ? sopCover : [];
  const active = selected < groups.length ? selected : -1;
  const hasKMap = numVars <= MAX_KMAP_VARS;
  const view: ViewProps = {
    numVars,
    outputs,
    onToggle: toggle,
    groups,
    isPOS: mode === "pos",
    selected: active,
  };
  const layout = hasKMap
    ? {
        main: "xl:grid-cols-[19rem_minmax(25rem,auto)_minmax(0,1fr)]",
        table: "xl:row-span-1",
        answer: "xl:col-start-3 xl:row-start-1",
      }
    : {
        main: "xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] xl:grid-rows-[auto_minmax(0,1fr)]",
        table: "xl:row-span-2",
        answer: "xl:col-start-2 xl:row-start-2",
      };

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex min-h-dvh flex-col xl:h-dvh xl:min-h-184">
        <header className="flex min-h-13 shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-line px-4 py-2 sm:px-5">
          <div className="flex min-w-0 items-center gap-2.5">
            <img src="/favicon.svg" alt="" className="size-6 shrink-0" />
            <h1 className="text-[0.9375rem] font-semibold tracking-[-0.01em]">
              Synthex
            </h1>
            <span aria-hidden="true" className="text-line-2 max-sm:hidden">
              /
            </span>
            <p className="truncate text-sm text-fg-2 max-sm:hidden">
              Karnaugh map boolean minimizer
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Readout label="Vars" value={numVars} />
            <Readout label="Rows" value={outputs.length} />
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="ml-1 font-normal text-muted-foreground"
            >
              <a
                href="https://github.com/tom-the-bomb/synthex"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Tom-the-Bomb 2026, source on GitHub"
              >
                <svg
                  viewBox="0 0 16 16"
                  aria-hidden="true"
                  className="fill-current"
                >
                  <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
                </svg>
                <span className="max-md:hidden">Tom-the-Bomb 2026</span>
              </a>
            </Button>
          </div>
        </header>

        <main className="flex flex-1 flex-col xl:min-h-0">
          <div className="flex shrink-0 flex-wrap items-start gap-x-3 gap-y-2.5 px-4 py-3 sm:px-5">
            <ExpressionInput
              key={clearNonce}
              numVars={numVars}
              onApply={replaceFunction}
              className="w-full lg:w-auto lg:flex-1"
            />
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-fg-2">Variables</span>
              <div
                role="group"
                aria-label="Variables"
                className="flex h-9 items-center rounded-md border border-input bg-surface shadow-xs dark:bg-input/30"
              >
                <IconButton
                  label="Fewer variables"
                  onClick={() => changeVars(numVars - 1)}
                  disabled={numVars <= MIN_VARS}
                  className="h-full w-8 rounded-r-none hover:bg-surface-2"
                >
                  <Minus />
                </IconButton>
                <span
                  aria-live="polite"
                  className="w-7 text-center font-mono text-sm text-fg"
                >
                  {numVars}
                </span>
                <IconButton
                  label="More variables"
                  onClick={() => changeVars(numVars + 1)}
                  disabled={numVars >= MAX_VARS}
                  className="h-full w-8 rounded-l-none hover:bg-surface-2"
                >
                  <Plus />
                </IconButton>
              </div>
              <Button variant="outline" onClick={clear}>
                Clear
              </Button>
            </div>
            <div className="flex h-9 flex-wrap items-center gap-x-4 text-xs text-fg-2">
              <Swatch box="border-one-edge bg-one-soft" label="1 · min" />
              <Swatch box="border-line-2 bg-surface-2" label="0 · max" />
              <Swatch
                box="border-dashed border-fg-3 bg-surface"
                label="x · dc"
              />
            </div>
          </div>

          <div
            className={cn(
              "grid flex-1 gap-3 px-4 pb-4 sm:px-5 sm:pb-5 lg:grid-cols-[minmax(0,1fr)_20rem] xl:min-h-0",
              layout.main,
            )}
          >
            <Pane
              title="K-Map"
              meta={hasKMap ? `${outputs.length} cells` : "N/A"}
              className="lg:col-start-1 lg:row-start-1 xl:col-start-2 xl:row-start-1"
            >
              {hasKMap ? (
                <KMap
                  {...view}
                  mode={mode}
                  onModeChange={changeMode}
                  onSelect={setSelected}
                />
              ) : (
                <p className="max-w-xs px-4 py-4 text-sm leading-relaxed text-fg-2">
                  The map supports up to {MAX_KMAP_VARS} variables. Use the
                  truth table to edit larger functions.
                </p>
              )}
            </Pane>

            <Pane
              title="Minimal Expression"
              meta="Quine–McCluskey"
              className={cn("lg:col-start-1 lg:row-start-2", layout.answer)}
            >
              <div className="scroll-slim min-h-0 flex-1 overflow-y-auto">
                <Output
                  table={table}
                  sopCover={sopCover}
                  posCover={posCover}
                  groups={groups}
                  mode={mode}
                  selected={active}
                  onSelect={selectGroup}
                />
              </div>
            </Pane>

            <Pane
              title="Truth Table"
              meta={`${outputs.length} rows`}
              className={cn(
                "lg:sticky lg:top-3 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:max-h-[calc(100dvh-1.5rem)] lg:self-start xl:static xl:col-start-1 xl:max-h-none xl:self-stretch",
                layout.table,
              )}
            >
              <Tabs.Root
                value={tableView}
                onValueChange={(view) => setTableView(view as TableView)}
                className="flex min-h-0 flex-1 flex-col"
              >
                {/* own layer, or rows bleed over this border at fractional zoom */}
                <div className="relative z-20 flex transform-gpu items-center gap-2 border-b border-line bg-surface px-4 py-2.5">
                  <span className="text-xs text-fg-2">View</span>
                  <Tabs.List
                    aria-label="Truth table view"
                    className={segmentTrack}
                  >
                    <Tabs.Trigger value="table" className={segmentItem}>
                      table
                    </Tabs.Trigger>
                    <Tabs.Trigger value="timing" className={segmentItem}>
                      timing
                    </Tabs.Trigger>
                  </Tabs.List>
                </div>
                <Tabs.Content value="table" className={tabPanel}>
                  <Table {...view} />
                </Tabs.Content>
                <Tabs.Content value="timing" className={tabPanel}>
                  <Timing {...view} />
                </Tabs.Content>
              </Tabs.Root>
            </Pane>
          </div>
        </main>
      </div>
    </TooltipProvider>
  );
}

export default App;
