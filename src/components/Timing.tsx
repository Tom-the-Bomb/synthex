import { useId, useLayoutEffect, useRef, useState } from "react";

import { GroupDots, type RowsProps } from "./Table";
import { CellState } from "../lib/cellState";
import { rowGroups } from "../lib/groups";
import { cn } from "../lib/utils";

const ROW = 30; // px, matches the table's row pitch
const PAD = 5; // inset of the low/high rails inside a lane
const OUT = 52; // width of the Out lane

// The truth table as a timing diagram: time runs down the rows, each input is a
// square wave, and Out (filled amber while high, hatched for don't-care) cycles
// on click like the table's output chip.
export default function Timing({
  numVars,
  outputs,
  onToggle,
  groups,
  isPOS,
  selected,
}: RowsProps) {
  const hatch = useId();
  const columns = `2.75rem minmax(${numVars * 20}px, 1fr) ${OUT}px 2.75rem`;
  const minWidth = `calc(5.5rem + ${numVars * 20 + OUT}px)`;

  // Waves are drawn in real pixels at the lanes' measured width, each rail on a
  // pixel centre with crispEdges: scaling a fixed viewBox by a fractional factor
  // made identical strokes render at different weights.
  const lanesRef = useRef<HTMLSpanElement>(null);
  const [lanesWidth, setLanesWidth] = useState(numVars * 32);
  useLayoutEffect(() => {
    const el = lanesRef.current;
    if (!el) {
      return;
    }
    const observer = new ResizeObserver(([entry]) =>
      setLanesWidth(Math.floor(entry.contentRect.width)),
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const lane = lanesWidth / numVars;
  const vars = Array.from({ length: numVars }, (_, i) => numVars - i);
  const groupsOf = rowGroups(groups, isPOS, selected);

  const rail = (i: number, high: boolean) =>
    high
      ? Math.round((i + 1) * lane - PAD) - 0.5
      : Math.round(i * lane + PAD) + 0.5;
  const outX = (state: CellState) =>
    state === CellState.True
      ? OUT - PAD
      : state === CellState.Any
        ? OUT / 2
        : PAD;

  // The header sits outside the row scroller (a sticky one let a slice of rows
  // show above it); both reserve the same scrollbar gutter to stay aligned.
  return (
    <div className="scroll-slim flex max-h-144 min-h-0 flex-1 flex-col overflow-x-auto lg:max-h-none">
      <svg width="0" height="0" className="absolute" aria-hidden="true">
        <defs>
          <pattern
            id={hatch}
            width="5"
            height="5"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <line
              x1="0"
              y1="0"
              x2="0"
              y2="5"
              className="stroke-fg-3"
              strokeWidth="1.5"
            />
          </pattern>
        </defs>
      </svg>

      <div
        className="grid shrink-0 [scrollbar-gutter:stable] overflow-hidden border-b border-line py-2 font-mono text-[11px] font-medium text-fg-2"
        style={{ gridTemplateColumns: columns, minWidth }}
      >
        <span className="pl-4">#</span>
        <span ref={lanesRef} className="flex">
          {vars.map((v) => (
            <span key={v} className="flex-1 text-center">
              x<sub>{v}</sub>
            </span>
          ))}
        </span>
        <span className="text-center">Out</span>
        <span />
      </div>

      <div
        className="scroll-slim min-h-0 flex-1 [scrollbar-gutter:stable] overflow-y-auto"
        style={{ minWidth }}
      >
        {outputs.map((state, term) => {
          const { covering, tint } = groupsOf(term);
          const prevState = term > 0 ? outputs[term - 1] : state;
          const fx = outX(state);
          const px = outX(prevState);
          return (
            <div
              key={term}
              className="grid shadow-[inset_0_-1px_0_var(--line)] transition-colors duration-150 hover:bg-surface-2"
              style={{
                gridTemplateColumns: columns,
                height: ROW,
                backgroundColor: tint,
              }}
            >
              <span className="self-center pl-4 font-mono text-[13px] text-fg-3">
                {term}
              </span>

              <svg
                width={lanesWidth}
                height={ROW}
                aria-hidden="true"
                className="fill-none stroke-fg-2"
                strokeWidth="1"
                shapeRendering="crispEdges"
                strokeLinecap="square"
              >
                {vars.map((_, i) => {
                  const bit = numVars - 1 - i;
                  const high = ((term >> bit) & 1) === 1;
                  const wasHigh = term > 0 && (((term - 1) >> bit) & 1) === 1;
                  const x = rail(i, high);
                  const xp = term > 0 ? rail(i, wasHigh) : x;
                  return <path key={bit} d={`M${xp} 0.5H${x}M${x} 0V${ROW}`} />;
                })}
              </svg>

              <button
                type="button"
                onClick={() => onToggle(term)}
                title={`term ${term}`}
                aria-label={`term ${term}, ${state}`}
                className="rounded-sm transition-colors duration-150 hover:bg-surface-3"
              >
                <svg
                  width={OUT}
                  height={ROW}
                  aria-hidden="true"
                  className="fill-none stroke-fg"
                  shapeRendering="crispEdges"
                  strokeWidth="2"
                  strokeLinecap="square"
                >
                  {state !== CellState.False && (
                    <rect
                      x={PAD}
                      y="0"
                      width={OUT - 2 * PAD}
                      height={ROW}
                      fill={
                        state === CellState.Any ? `url(#${hatch})` : undefined
                      }
                      className={cn(
                        "stroke-none",
                        state === CellState.True && "fill-one",
                      )}
                    />
                  )}
                  <path d={`M${px} 1H${fx}M${fx} 0V${ROW}`} />
                </svg>
              </button>

              <GroupDots
                covering={covering}
                isPOS={isPOS}
                className="items-center justify-end pr-4"
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
