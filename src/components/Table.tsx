import type { Implicant } from "../lib/algorithm";
import { type CellState, chipClasses } from "../lib/cellState";
import { groupColor, groupInk, rowGroups } from "../lib/groups";
import { cn } from "../lib/utils";

export interface RowsProps {
  numVars: number;
  outputs: CellState[];
  onToggle: (term: number) => void;
  groups: Implicant[];
  isPOS: boolean;
  selected: number;
}

export function GroupDots({
  covering,
  isPOS,
  className,
}: {
  covering: number[];
  isPOS: boolean;
  className?: string;
}) {
  return (
    <span className={cn("flex gap-1", className)} aria-hidden="true">
      {covering.map((i) => (
        <span
          key={i}
          className="size-1.5 rounded-full"
          style={{ backgroundColor: groupInk(groupColor(isPOS, i)) }}
        />
      ))}
    </span>
  );
}

export default function Table({
  numVars,
  outputs,
  onToggle,
  groups,
  isPOS,
  selected,
}: RowsProps) {
  const vars = Array.from({ length: numVars }, (_, i) => numVars - i);
  const groupsOf = rowGroups(groups, isPOS, selected);

  return (
    <div className="scroll-slim max-h-144 min-h-0 flex-1 overflow-auto lg:max-h-none">
      {/* header overlaps the edge by 2px, or rows peek above it at fractional zoom */}
      <table className="-mt-0.5 w-full border-separate border-spacing-0 text-center font-mono text-[0.8125rem]">
        <thead className="sticky -top-0.5 z-10 bg-surface text-2xs text-fg-2">
          <tr>
            <th className="border-b border-line pt-2.5 pb-2 pl-4 text-left font-medium">
              #
            </th>
            {vars.map((v) => (
              <th
                key={v}
                className="border-b border-line px-1.5 pt-2.5 pb-2 font-medium"
              >
                x<sub>{v}</sub>
              </th>
            ))}
            <th className="border-b border-line pt-2.5 pr-4 pb-2 text-right font-medium">
              Out
            </th>
          </tr>
        </thead>
        <tbody>
          {outputs.map((state, term) => {
            const { covering, shade } = groupsOf(term);
            return (
              <tr
                key={term}
                className="transition-colors duration-150 hover:bg-surface-2"
                style={shade}
              >
                <td className="py-1 pl-4 text-left text-fg-3">{term}</td>
                {vars.map((v) => {
                  const bit = (term >> (v - 1)) & 1;
                  return (
                    <td
                      key={v}
                      className={cn(
                        "px-1.5 py-1",
                        bit ? "text-fg" : "text-fg-3",
                      )}
                    >
                      {bit}
                    </td>
                  );
                })}
                <td className="py-1 pr-4">
                  <span className="flex items-center justify-end gap-2.5">
                    <GroupDots covering={covering} isPOS={isPOS} />
                    <button
                      type="button"
                      onClick={() => onToggle(term)}
                      title={`term ${term}`}
                      aria-label={`term ${term}, ${state}`}
                      className={cn(
                        "relative h-5.5 w-8 rounded-md border text-xs font-semibold transition-colors duration-150 pointer-coarse:after:absolute pointer-coarse:after:-inset-x-1.5 pointer-coarse:after:-inset-y-1",
                        chipClasses(state),
                      )}
                    >
                      {state}
                    </button>
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
