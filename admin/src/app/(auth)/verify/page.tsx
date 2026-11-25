"use client";

import { BackButton } from "@/components/page-header";
import { CodeInput } from "@/components/code-input";
import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { api, useHydrated, usePendingSignIn } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { notify } from "@/lib/notify";
import { ApiError, type AuthResult, type MessageResponse } from "@cendol/api-client";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export default function VerifyAccountPage() {
  const router = useRouter();
  const { handleAuthResult } = useAuth();
  const hydrated = useHydrated();
  const pending = usePendingSignIn();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState(false);
  // set once the code is accepted, so clearing the pending sign-in does not bounce back to /login
  const finished = useRef(false);

  useEffect(() => {
    if (hydrated && !finished.current && pending?.status !== "verification_required") router.replace("/login");
  }, [hydrated, pending, router]);

  async function verify(value = code) {
    setBusy(true);
    setError("");
    try {
      const result = await api.post<AuthResult>("auth/verification/verify", { code: value });
      notify.success(result.message);
      finished.current = true;
      router.replace(handleAuthResult(result));
    } catch (e) {
      if (e instanceof ApiError && e.code.startsWith("OTP")) setError(e.message);
      else notify.error(e);
      setCode("");
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    setSending(true);
    try {
      const result = await api.post<MessageResponse>("auth/verification/send", { channel: "email" });
      notify.success(result.message);
    } catch (e) {
      notify.error(e);
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="verify-page flex flex-col gap-6">
      <BackButton href="/login" label="Back to sign in" />
      <div className="verify-page-heading">
        <h1 className="page-title">Confirm your account</h1>
        <p className="page-description">
          Enter the 6-digit code we emailed{pending?.destination ? <> to <strong className="text-foreground">{pending.destination}</strong></> : null}. It expires in 10 minutes.
        </p>
      </div>
      <form
        className="verify-form flex flex-col gap-5"
        onSubmit={(e) => {
          e.preventDefault();
          void verify();
        }}
      >
        <FormField id="verify-code" label="Code" error={error}>
          <CodeInput id="verify-code" value={code} onChange={setCode} onComplete={verify} disabled={busy} invalid={Boolean(error)} />
        </FormField>
        <div className="verify-form-actions flex flex-col gap-2">
          <Button type="submit" size="lg" disabled={busy || code.length !== 6}>
            {busy ? <Loader2 className="animate-spin" /> : null}
            Confirm
          </Button>
          <Button type="button" variant="ghost" onClick={resend} disabled={sending}>
            {sending ? <Loader2 className="animate-spin" /> : null}
            Send a new code
          </Button>
        </div>
      </form>
    </section>
  );
}
