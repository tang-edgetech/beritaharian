"use client";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { notify } from "@/lib/notify";
import { Copy } from "lucide-react";

/** A long value (SHA-256 fingerprint) shortened on screen, full in the tooltip, with a copy button. */
export function CopyHash({ value, label = "fingerprint" }: { value: string; label?: string }) {
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      notify.success("Copied.");
    } catch {
      notify.info("Your browser blocked copying. Select the text in the tooltip instead.");
    }
  }

  return (
    <span className="copy-hash inline-flex items-center gap-1">
      <Tooltip>
        <TooltipTrigger asChild>
          <code className="copy-hash-value cursor-help rounded bg-muted px-1.5 py-0.5 font-mono text-xs" tabIndex={0}>
            {value.slice(0, 10)}…{value.slice(-6)}
          </code>
        </TooltipTrigger>
        <TooltipContent className="copy-hash-full max-w-none font-mono text-xs break-all">{value}</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button type="button" variant="ghost" size="icon-xs" className="copy-hash-button" aria-label={`Copy the full ${label}`} onClick={copy}>
            <Copy />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Copy the full {label}</TooltipContent>
      </Tooltip>
    </span>
  );
}
