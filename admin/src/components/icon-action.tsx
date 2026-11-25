"use client";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";

interface IconActionProps {
  icon: LucideIcon;
  /** Shown in the tooltip and read by screen readers. */
  label: string;
  href?: string;
  onClick?: () => void;
  danger?: boolean;
  disabled?: boolean;
  className?: string;
}

/** An icon-only button with a hover tooltip that says what it does. */
export function IconAction({ icon: Icon, label, href, onClick, danger, disabled, className }: IconActionProps) {
  const button = (
    <Button
      variant={danger ? "destructive" : "ghost"}
      size="icon-sm"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      asChild={Boolean(href) && !disabled}
      className={["icon-action", className].filter(Boolean).join(" ")}
    >
      {href && !disabled ? (
        <Link href={href}>
          <Icon />
        </Link>
      ) : (
        <Icon />
      )}
    </Button>
  );

  return (
    <Tooltip>
      <TooltipTrigger asChild>{disabled ? <span className="icon-action-wrapper inline-flex">{button}</span> : button}</TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
