"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

/* Form pieces for the place pages, matching the sign-in forms (auth-ui). */

const control =
  "rounded-xl border border-santan-300 bg-white px-3.5 outline-none focus:border-pandan-500 focus:ring-2 focus:ring-pandan-200 aria-invalid:border-red-500 dark:border-santan-700 dark:bg-santan-950 dark:focus:ring-pandan-900";

function Help({ id, error, hint }: { id: string; error?: string; hint?: ReactNode }) {
  if (error)
    return (
      <p id={`${id}-error`} className="text-sm text-red-700 dark:text-red-400" role="alert">
        {error}
      </p>
    );
  if (hint)
    return (
      <p id={`${id}-hint`} className="text-xs text-santan-500">
        {hint}
      </p>
    );
  return null;
}

export function TextAreaField({ id, label, error, hint, className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement> & { id: string; label: string; error?: string; hint?: ReactNode }) {
  return (
    <div className={`form-field flex flex-col gap-1.5 ${className ?? ""}`}>
      <label htmlFor={id} className="text-sm font-semibold text-gula-900 dark:text-coconut">
        {label}
      </label>
      <textarea id={id} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined} className={`${control} min-h-28 py-3`} {...rest} />
      <Help id={id} error={error} hint={hint} />
    </div>
  );
}

export function SelectField({ id, label, error, hint, className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement> & { id: string; label: string; error?: string; hint?: ReactNode }) {
  return (
    <div className={`form-field flex flex-col gap-1.5 ${className ?? ""}`}>
      <label htmlFor={id} className="text-sm font-semibold text-gula-900 dark:text-coconut">
        {label}
      </label>
      <select id={id} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined} className={`${control} h-11`} {...rest}>
        {children}
      </select>
      <Help id={id} error={error} hint={hint} />
    </div>
  );
}

export function CheckField({ id, label, checked, onChange, hint, error }: { id: string; label: ReactNode; checked: boolean; onChange: (v: boolean) => void; hint?: ReactNode; error?: string }) {
  return (
    <div className="form-check flex flex-col gap-1">
      <label className="flex cursor-pointer items-start gap-2.5 text-sm font-semibold">
        <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 size-4 shrink-0 accent-pandan-600" aria-invalid={Boolean(error)} />
        <span>{label}</span>
      </label>
      <Help id={id} error={error} hint={hint} />
    </div>
  );
}

/** A full-page form shell with a back link to the parent page. */
export function FormPage({ back, backLabel, title, lead, children }: { back: string; backLabel: string; title: string; lead?: ReactNode; children: ReactNode }) {
  return (
    <div className="form-page site-container flex max-w-2xl flex-col gap-5 py-6">
      <Link href={back} className="back-link inline-flex items-center gap-1 self-start text-sm font-semibold text-santan-600 hover:underline dark:text-santan-300">
        <ArrowLeft className="size-4" aria-hidden />
        {backLabel}
      </Link>
      <header className="flex flex-col gap-1.5">
        <h1 className="page-heading">{title}</h1>
        {lead ? <div className="page-lead">{lead}</div> : null}
      </header>
      <div className="form-page-card flex flex-col gap-6 rounded-card border border-santan-200 bg-white p-5 sm:p-7 dark:border-santan-800 dark:bg-santan-900">{children}</div>
    </div>
  );
}

/** A choice of 1 to 5 stars, as radio buttons so it works with the keyboard. */
export function StarPicker({ name, label, value, onChange, error, small = false }: { name: string; label: string; value: number; onChange: (n: number) => void; error?: string; small?: boolean }) {
  const words = ["", "Poor", "Not great", "OK", "Good", "Excellent"];
  return (
    <fieldset className="star-picker flex flex-col gap-1.5" aria-invalid={Boolean(error)}>
      <legend className={`mb-1 font-semibold text-gula-900 dark:text-coconut ${small ? "text-sm" : ""}`}>{label}</legend>
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <label key={n} className="cursor-pointer" title={words[n]}>
            <input type="radio" name={name} value={n} checked={value === n} onChange={() => onChange(n)} className="peer sr-only" />
            <span
              className={[
                "star-picker-star inline-flex items-center justify-center rounded-lg peer-focus-visible:ring-2 peer-focus-visible:ring-pandan-400",
                small ? "size-8 text-xl" : "size-11 text-3xl",
                n <= value ? "text-marigold-500" : "text-santan-300 dark:text-santan-700",
              ].join(" ")}
              aria-hidden
            >
              ★
            </span>
            <span className="sr-only">
              {n} {n === 1 ? "star" : "stars"}, {words[n]}
            </span>
          </label>
        ))}
        {value ? <span className="ml-2 text-sm font-semibold text-santan-600 dark:text-santan-300">{words[value]}</span> : null}
      </div>
      {error ? (
        <p className="text-sm text-red-700 dark:text-red-400" role="alert">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
