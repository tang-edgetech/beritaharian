"use client";

import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/** The parent route: /users/01HX/profile -> /users/01HX -> /users */
export function parentPath(pathname: string): string {
  const parts = pathname.split("/").filter(Boolean);
  return parts.length > 1 ? `/${parts.slice(0, -1).join("/")}` : "/dashboard";
}

interface BackButtonProps {
  /** Where to go. Defaults to the parent route. */
  href?: string;
  label?: string;
}

export function BackButton({ href, label = "Back" }: BackButtonProps) {
  const pathname = usePathname();

  return (
    <Button variant="ghost" size="sm" asChild className="back-button -ml-2 text-muted-foreground">
      <Link href={href ?? parentPath(pathname)}>
        <ArrowLeft />
        {label}
      </Link>
    </Button>
  );
}

interface PageHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  /** Show a back link to the parent page (or to this href). */
  back?: boolean | string;
  backLabel?: string;
  actions?: ReactNode;
}

export function PageHeader({ title, description, back, backLabel, actions }: PageHeaderProps) {
  return (
    <header className="page-header flex flex-col gap-3">
      {back ? <BackButton href={typeof back === "string" ? back : undefined} label={backLabel} /> : null}
      <div className="page-header-row flex flex-wrap items-end justify-between gap-4">
        <div className="page-header-text min-w-0">
          <h1 className="page-title">{title}</h1>
          {description ? <p className="page-description">{description}</p> : null}
        </div>
        {actions ? <div className="page-header-actions flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}
