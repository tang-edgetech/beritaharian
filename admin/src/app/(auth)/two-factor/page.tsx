"use client";

import { BackButton } from "@/components/page-header";
import { CodeInput } from "@/components/code-input";
import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, pendingStore } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { notify } from "@/lib/notify";
import { ApiError, type AuthResult } from "@cendol/api-client";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function TwoFactorChallengePage() {
  const router = useRouter();
  const { handleAuthResult } = useAuth();
  const [useRecovery, setUseRecovery] = useState(false);
  const [code, setCode] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (pendingStore.get()?.status !== "two_factor_required") router.replace("/login");
  }, [router]);

  async function submit(value = code) {
    setBusy(true);
    setError("");
    try {
      const result = await api.post<AuthResult>(
        "auth/two-factor/challenge",
        useRecovery ? { recovery_code: recoveryCode } : { code: value },
      );
      notify.success(result.message);
      router.replace(handleAuthResult(result));
    } catch (e) {
      if (e instanceof ApiError && e.code === "TWO_FACTOR_INVALID") setError(e.message);
      else if (e instanceof ApiError && e.status === 401) {
        pendingStore.set(null);
        notify.info("That took too long. Please sign in again.");
        router.replace("/login");
      } else notify.error(e);
      setCode("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="two-factor-page flex flex-col gap-6">
      <BackButton href="/login" label="Back to sign in" />
      <div className="two-factor-page-heading">
        <h1 className="page-title">Two-step sign-in</h1>
        <p className="page-description">
          {useRecovery
            ? "Enter one of the recovery codes you saved when you turned on two-step sign-in. Each code works once."
            : "Open your authenticator app and enter the 6-digit code for Cendol Satay."}
        </p>
      </div>
      <form
        className="two-factor-form flex flex-col gap-5"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        {useRecovery ? (
          <FormField id="two-factor-recovery" label="Recovery code" error={error}>
            <Input
              id="two-factor-recovery"
              value={recoveryCode}
              onChange={(e) => setRecoveryCode(e.target.value)}
              placeholder="ABCDE-12345"
              autoComplete="off"
              aria-invalid={Boolean(error)}
            />
          </FormField>
        ) : (
          <FormField id="two-factor-code" label="Code" error={error}>
            <CodeInput id="two-factor-code" value={code} onChange={setCode} onComplete={submit} disabled={busy} invalid={Boolean(error)} />
          </FormField>
        )}
        <div className="two-factor-form-actions flex flex-col gap-2">
          <Button type="submit" size="lg" disabled={busy || (useRecovery ? recoveryCode.length < 5 : code.length !== 6)}>
            {busy ? <Loader2 className="animate-spin" /> : null}
            Continue
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setUseRecovery(!useRecovery);
              setError("");
            }}
          >
            {useRecovery ? "Use my authenticator app instead" : "I can't use my phone"}
          </Button>
        </div>
      </form>
    </section>
  );
}
