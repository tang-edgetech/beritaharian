"use client";

import { AuthCard, errorMessage, Field, FormMessage, SubmitButton } from "@/components/account/auth-ui";
import { nextStepAfter, readerApi } from "@/lib/auth";
import type { AuthResult } from "@cendol/api-client";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export default function TwoFactorPage() {
  const router = useRouter();
  const [useRecovery, setUseRecovery] = useState(false);
  const [code, setCode] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const result = await readerApi.post<AuthResult>("auth/two-factor/challenge", useRecovery ? { recovery_code: code } : { code });
      router.push(nextStepAfter(result));
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthCard title="Two-step sign-in" lead={useRecovery ? "Type one of the recovery codes you saved." : "Open your authenticator app and type the 6-digit code."}>
      <form className="two-factor-form flex flex-col gap-4" onSubmit={submit} noValidate>
        {message ? <FormMessage>{message}</FormMessage> : null}
        <Field id="two-factor-code" label={useRecovery ? "Recovery code" : "Code"} autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value.trim())} />
        <SubmitButton busy={busy}>Continue</SubmitButton>
        <button
          type="button"
          className="text-sm font-semibold text-pandan-700 underline underline-offset-4 dark:text-pandan-300"
          onClick={() => {
            setUseRecovery((v) => !v);
            setCode("");
          }}
        >
          {useRecovery ? "Use the app code instead" : "Lost your phone? Use a recovery code"}
        </button>
      </form>
    </AuthCard>
  );
}
