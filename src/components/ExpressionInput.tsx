import { CornerDownLeft } from "lucide-react";
import { useId, useState, type FormEvent } from "react";

import { Button } from "./ui/button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "./ui/input-group";
import { Kbd } from "./ui/kbd";
import type { CellState } from "../lib/cellState";
import { parseExpression } from "../lib/parser";
import { cn } from "../lib/utils";

export default function ExpressionInput({
  numVars,
  onApply,
  className,
}: {
  numVars: number;
  onApply: (numVars: number, outputs: CellState[]) => void;
  className?: string;
}) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const id = useId();

  const submit = (e: FormEvent) => {
    e.preventDefault();
    try {
      const parsed = parseExpression(text, numVars);
      onApply(parsed.numVars, parsed.outputs);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "invalid expression");
    }
  };

  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <form onSubmit={submit} className="flex gap-2">
        <InputGroup className="bg-surface">
          <InputGroupAddon className="font-normal max-sm:sr-only">
            <label htmlFor={id}>Expression</label>
          </InputGroupAddon>
          <InputGroupInput
            id={id}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="e.g. x1'x2' + x3"
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            aria-invalid={error !== null}
            aria-describedby={error ? `${id}-error` : undefined}
            className="font-mono"
          />
          <InputGroupAddon align="inline-end" className="max-sm:hidden">
            <Kbd aria-hidden="true" title="Enter loads the expression">
              <CornerDownLeft />
            </Kbd>
          </InputGroupAddon>
        </InputGroup>
        <Button type="submit">Load</Button>
      </form>
      {error && (
        <span
          id={`${id}-error`}
          role="alert"
          className="px-1 font-mono text-xs text-danger"
        >
          {error}
        </span>
      )}
    </div>
  );
}
