import Link from "next/link";
import type { ReactNode } from "react";

/** Honest placeholder for sections built in later phases, so the tab bar never leads nowhere. */
export function ComingSoon({ title, children, icon }: { title: string; children: ReactNode; icon: ReactNode }) {
  return (
    <div className="coming-soon site-container flex max-w-2xl flex-col items-start gap-5 py-14">
      <span className="inline-flex size-14 items-center justify-center rounded-2xl bg-marigold-100 text-gula-900 dark:bg-gula-800 dark:text-marigold-200">{icon}</span>
      <h1 className="page-heading">{title}</h1>
      <div className="page-lead flex flex-col gap-3">{children}</div>
      <Link href="/" className="inline-flex h-11 items-center rounded-full bg-gula-900 px-5 font-bold text-coconut hover:bg-gula-800 dark:bg-marigold-400 dark:text-gula-900">
        Back to today&apos;s news
      </Link>
    </div>
  );
}
