import { ToggleGroup } from "radix-ui";
import { useId } from "react";

import { segmentItem, segmentTrack } from "./styles";

export function Segmented<T extends string>({
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
  const id = useId();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span id={id} className="text-xs text-fg-2">
        {label}
      </span>
      <ToggleGroup.Root
        type="single"
        aria-labelledby={id}
        value={value}
        // re-clicking the chosen option sends "", which would clear it
        onValueChange={(next) => next && onChange(next as T)}
        className={segmentTrack}
      >
        {options.map((option) => (
          <ToggleGroup.Item key={option} value={option} className={segmentItem}>
            {option}
          </ToggleGroup.Item>
        ))}
      </ToggleGroup.Root>
    </div>
  );
}
