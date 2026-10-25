import type { ComponentProps } from "react";

import { Button } from "./button";
import { Tooltip, TooltipContent, TooltipTrigger } from "./tooltip";
import { cn } from "../../lib/utils";

// An icon-only button, named by its tooltip.
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
          className={cn("size-7 text-muted-foreground", className)}
          {...props}
        />
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
