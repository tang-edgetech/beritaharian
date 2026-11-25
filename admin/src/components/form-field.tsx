import { Label } from "@/components/ui/label";
import type { ReactNode } from "react";

interface FormFieldProps {
  id: string;
  label: ReactNode;
  error?: string;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}

/** Label + control + hint/error, laid out the same way on every form. */
export function FormField({ id, label, error, hint, children, className }: FormFieldProps) {
  return (
    <div className={["form-field flex flex-col gap-1.5", className].filter(Boolean).join(" ")}>
      <Label htmlFor={id} className="form-field-label">
        {label}
      </Label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="field-error" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="field-hint">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
