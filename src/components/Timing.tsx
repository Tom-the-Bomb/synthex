import { useId } from "react";

import { GroupDots, type RowsProps } from "./Table";
import { CellState } from "../lib/cellState";
import { rowGroups } from "../lib/groups";
import { remScale, useWidth } from "../lib/media";
import { cn } from "../lib/utils";

// px at the default text size; they scale with the user's text size
const ROW = 30; // matches the table's row pitch
const LANE = 20; // narrowest an input lane gets
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
  const unit = remScale();
  const row = ROW * unit;
  const pad = Math.round(PAD * unit);
  const out = Math.round(OUT * unit);
  const hatch = useId();
  const columns = `2.75rem minmax(${numVars * LANE * unit}px, 1fr) ${out}px 2.75rem`;
  const minWidth = `calc(5.5rem + ${(numVars * LANE + OUT) * unit}px)`;

  // Waves are drawn in real pixels at the lanes' measured width, each rail on a
  // pixel centre with crispEdges: scaling a fixed viewBox by a fractional factor
  // made identical strokes render at different weights.
  const [lanesRef, lanesWidth] = useWidth<HTMLSpanElement>(numVars * 32);
  const lane = lanesWidth / numVars;
  const vars = Array.from({ length: numVars }, (_, i) => numVars - i);
  const groupsOf = rowGroups(groups, isPOS, selected);

  const rail = (i: number, high: boolean) =>
    high
      ? Math.round((i + 1) * lane - pad) - 0.5
      : Math.round(i * lane + pad) + 0.5;
  const outX = (state: CellState) =>
    state === CellState.True
      ? out - pad
      : state === CellState.Any
        ? out / 2
        : pad;

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
        className="grid shrink-0 scrollbar-gutter-stable overflow-hidden border-b border-line py-2 font-mono text-[0.6875rem] font-medium text-fg-2"
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
        className="scroll-slim min-h-0 flex-1 scrollbar-gutter-stable overflow-y-auto"
        style={{ minWidth }}
      >
        {outputs.map((state, term) => {
          const { covering, shade } = groupsOf(term);
          const prevState = term > 0 ? outputs[term - 1] : state;
          const fx = outX(state);
          const px = outX(prevState);
          return (
            <div
              key={term}
              className="grid shadow-[inset_0_-1px_0_var(--line)] transition-colors duration-150 hover:bg-surface-2"
              style={{
                gridTemplateColumns: columns,
                height: row,
                ...shade,
              }}
            >
              <span className="self-center pl-4 font-mono text-[0.8125rem] text-fg-3">
                {term}
              </span>

              <svg
                width={lanesWidth}
                height={row}
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
                  return <path key={bit} d={`M${xp} 0.5H${x}M${x} 0V${row}`} />;
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
                  width={out}
                  height={row}
                  aria-hidden="true"
                  className="fill-none stroke-fg"
                  shapeRendering="crispEdges"
                  strokeWidth="2"
                  strokeLinecap="square"
                >
                  {state !== CellState.False && (
                    <rect
                      x={pad}
                      y="0"
                      width={out - 2 * pad}
                      height={row}
                      fill={
                        state === CellState.Any ? `url(#${hatch})` : undefined
                      }
                      className={cn(
                        "stroke-none",
                        state === CellState.True && "fill-one",
                      )}
                    />
                  )}
                  <path d={`M${px} 1H${fx}M${fx} 0V${row}`} />
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
