import { Check, Copy } from "lucide-react";
import { useEffect, useState } from "react";

import { IconButton } from "./icon-button";

export function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) {
      return;
    }
    const timer = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(timer);
  }, [copied]);

  return (
    <>
      <IconButton
        label={copied ? "Copied" : label}
        onClick={() =>
          navigator.clipboard?.writeText(text).then(() => setCopied(true))
        }
      >
        {copied ? <Check /> : <Copy />}
      </IconButton>
      <span aria-live="polite" className="sr-only">
        {copied ? "Copied" : ""}
      </span>
    </>
  );
}
