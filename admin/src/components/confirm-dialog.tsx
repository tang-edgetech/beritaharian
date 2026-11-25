"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";

export interface ConfirmOptions {
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Red confirm button for things that delete or block. */
  danger?: boolean;
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

/**
 * One shared confirmation popup for the whole admin.
 *   const confirm = useConfirm();
 *   if (await confirm({ title: "Delete 3 people?", danger: true })) { ... }
 */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>((next) => {
    setOptions(next);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const close = (answer: boolean) => {
    resolver.current?.(answer);
    resolver.current = null;
    setOptions(null);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <AlertDialog open={options !== null} onOpenChange={(open) => !open && close(false)}>
        <AlertDialogContent className="confirm-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle className="confirm-dialog-title">{options?.title}</AlertDialogTitle>
            {options?.description ? (
              <AlertDialogDescription className="confirm-dialog-description">{options.description}</AlertDialogDescription>
            ) : null}
          </AlertDialogHeader>
          <AlertDialogFooter className="confirm-dialog-actions">
            <AlertDialogCancel onClick={() => close(false)}>{options?.cancelLabel ?? "Cancel"}</AlertDialogCancel>
            <AlertDialogAction
              variant={options?.danger ? "destructive" : "default"}
              onClick={() => close(true)}
            >
              {options?.confirmLabel ?? "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmFn {
  const confirm = useContext(ConfirmContext);
  if (!confirm) throw new Error("useConfirm must be used inside <ConfirmProvider>");
  return confirm;
}
