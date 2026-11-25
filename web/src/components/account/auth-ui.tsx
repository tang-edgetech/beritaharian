"use client";

import { ApiError } from "@cendol/api-client";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import type { InputHTMLAttributes, ReactNode } from "react";

/** The card every sign-in screen sits in. */
export function AuthCard({ title, lead, children, footer }: { title: string; lead?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="auth-page site-container flex justify-center py-10 sm:py-16">
      <div className="auth-card flex w-full max-w-md flex-col gap-6 rounded-card border border-santan-200 bg-white p-6 shadow-sm sm:p-8 dark:border-santan-800 dark:bg-santan-900">
        <div className="flex flex-col gap-1.5">
          <h1 className="font-display text-2xl font-black text-gula-900 dark:text-coconut">{title}</h1>
          {lead ? <p className="text-sm text-santan-600 dark:text-santan-300">{lead}</p> : null}
        </div>
        {children}
        {footer ? <div className="auth-card-footer border-t border-santan-200 pt-4 text-sm text-santan-600 dark:border-santan-800 dark:text-santan-300">{footer}</div> : null}
      </div>
    </div>
  );
}

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  id: string;
  label: string;
  error?: string;
  hint?: ReactNode;
}

export function Field({ id, label, error, hint, className, ...input }: FieldProps) {
  return (
    <div className={`auth-field flex flex-col gap-1.5 ${className ?? ""}`}>
      <label htmlFor={id} className="text-sm font-semibold text-gula-900 dark:text-coconut">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        className="h-11 rounded-xl border border-santan-300 bg-white px-3.5 outline-none focus:border-pandan-500 focus:ring-2 focus:ring-pandan-200 aria-invalid:border-red-500 dark:border-santan-700 dark:bg-santan-950 dark:focus:ring-pandan-900"
        {...input}
      />
      {error ? (
        <p id={`${id}-error`} className="text-sm text-red-700 dark:text-red-400" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs text-santan-500">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function SubmitButton({ busy, children }: { busy: boolean; children: ReactNode }) {
  return (
    <button
      type="submit"
      disabled={busy}
      className="auth-submit inline-flex h-12 items-center justify-center gap-2 rounded-full bg-gula-900 px-6 font-bold text-coconut hover:bg-gula-800 disabled:opacity-60 dark:bg-marigold-400 dark:text-gula-900 dark:hover:bg-marigold-300"
    >
      {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
      {children}
    </button>
  );
}

/** A message box for the whole form, in plain words. */
export function FormMessage({ tone = "error", children }: { tone?: "error" | "success"; children: ReactNode }) {
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={[
        "form-message rounded-xl px-4 py-3 text-sm",
        tone === "error" ? "bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-200" : "bg-pandan-50 text-pandan-800 dark:bg-pandan-950 dark:text-pandan-100",
      ].join(" ")}
    >
      {children}
    </p>
  );
}

export function TextLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="font-semibold text-pandan-700 underline underline-offset-4 hover:text-pandan-800 dark:text-pandan-300">
      {children}
    </Link>
  );
}

/** Field errors from the API, first message per field. */
export function fieldErrors(error: unknown): Record<string, string> {
  return error instanceof ApiError ? Object.fromEntries(Object.entries(error.errors).map(([k, m]) => [k, m[0]])) : {};
}

export function errorMessage(error: unknown): string {
  return error instanceof ApiError ? error.message : "That didn't work. Please try again.";
}
