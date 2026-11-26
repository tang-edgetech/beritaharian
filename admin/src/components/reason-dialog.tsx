"use client";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCallback, useId, useRef, useState, type FormEvent, type ReactNode } from "react";

export interface ReasonOptions {
  title: string;
  description?: ReactNode;
  /** Label above the text box, e.g. "Reason (the reporter will see this)". */
  label: string;
  placeholder?: string;
  /** Pre-filled text. */
  initial?: string;
  /** Shown when the box is left empty. */
  requiredMessage?: string;
  confirmLabel?: string;
  danger?: boolean;
}

type AskFn = (options: ReasonOptions) => Promise<string | null>;

/**
 * A small popup that asks for a short reason or message, for actions that need one.
 *   const [ask, reasonDialog] = useReasonDialog();
 *   const reason = await ask({ title: "Reject 3 reports?", label: "Reason" }); // null when cancelled
 *   return <>{reasonDialog}...</>;
 */
export function useReasonDialog(): [AskFn, ReactNode] {
  const [options, setOptions] = useState<ReasonOptions | null>(null);
  // the words stay while the popup fades out
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const resolver = useRef<((value: string | null) => void) | null>(null);
  const id = useId();

  const ask = useCallback<AskFn>((next) => {
    setOptions(next);
    setOpen(true);
    setText(next.initial ?? "");
    setError(null);
    return new Promise<string | null>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const close = (answer: string | null) => {
    resolver.current?.(answer);
    resolver.current = null;
    setOpen(false);
  };

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!text.trim()) {
      setError(options?.requiredMessage ?? "Please write a few words first.");
      return;
    }
    close(text.trim());
  }

  const element = (
    <AlertDialog open={open} onOpenChange={(isOpen) => !isOpen && close(null)}>
      <AlertDialogContent className="reason-dialog sm:max-w-lg!">
        <form onSubmit={submit} className="reason-dialog-form grid gap-4">
          <AlertDialogHeader>
            <AlertDialogTitle className="reason-dialog-title">{options?.title}</AlertDialogTitle>
            {options?.description ? <AlertDialogDescription className="reason-dialog-description">{options.description}</AlertDialogDescription> : null}
          </AlertDialogHeader>
          <div className="reason-dialog-field flex flex-col gap-1.5">
            <Label htmlFor={`${id}-reason`}>{options?.label}</Label>
            <Textarea
              id={`${id}-reason`}
              rows={4}
              value={text}
              placeholder={options?.placeholder}
              onChange={(e) => {
                setText(e.target.value);
                setError(null);
              }}
              aria-invalid={Boolean(error)}
              autoFocus
            />
            {error ? (
              <p className="field-error" role="alert">
                {error}
              </p>
            ) : null}
          </div>
          <AlertDialogFooter className="reason-dialog-actions">
            <AlertDialogCancel type="button" onClick={() => close(null)}>
              Cancel
            </AlertDialogCancel>
            <Button type="submit" variant={options?.danger ? "destructive" : "default"}>
              {options?.confirmLabel ?? "Send"}
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );

  return [ask, element];
}
