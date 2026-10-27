import type { ComponentProps } from "react";

import { Button } from "./button";
import { Tooltip, TooltipContent, TooltipTrigger } from "./tooltip";
import { cn } from "../../lib/utils";

export function IconButton({
  label,
  className,
  ...props
}: { label: string } & ComponentProps<typeof Button>) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={label}
          className={cn(
            "relative size-7 text-muted-foreground pointer-coarse:after:absolute pointer-coarse:after:-inset-2",
            className,
          )}
          {...props}
        />
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
