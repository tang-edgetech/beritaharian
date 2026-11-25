"use client";

import { AuthCard, errorMessage, Field, FormMessage, SubmitButton, TextLink } from "@/components/account/auth-ui";
import { nextStepAfter, readerApi, session, type PendingSignIn } from "@/lib/auth";
import type { AuthResult, MessageResponse } from "@cendol/api-client";
import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore, type FormEvent } from "react";

const noop = () => () => {};

export default function VerifyPage() {
  const router = useRouter();
  const pendingRaw = useSyncExternalStore(noop, () => JSON.stringify(session.pending()), () => "loading");
  const pending = pendingRaw === "loading" ? undefined : (JSON.parse(pendingRaw) as PendingSignIn | null);
  const [code, setCode] = useState("");
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [wait, setWait] = useState(0);

  useEffect(() => {
    if (pending === null) router.replace("/login");
  }, [pending, router]);

  useEffect(() => {
    if (wait <= 0) return;
    const timer = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(timer);
  }, [wait]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const result = await readerApi.post<AuthResult>("auth/verification/verify", { code });
      router.push(nextStepAfter(result));
    } catch (error) {
      setMessage({ tone: "error", text: errorMessage(error) });
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    try {
      const result = await readerApi.post<MessageResponse>("auth/verification/send");
      setMessage({ tone: "success", text: result.message });
      setWait(60);
    } catch (error) {
      setMessage({ tone: "error", text: errorMessage(error) });
    }
  }

  return (
    <AuthCard
      title="Check your email"
      lead={
        <>
          We sent a 6-digit code to <strong>{pending?.destination ?? "your email"}</strong>. It works for 10 minutes.
        </>
      }
      footer={
        <>
          Wrong email? <TextLink href="/register">Start again</TextLink>
        </>
      }
    >
      <form className="verify-form flex flex-col gap-4" onSubmit={submit} noValidate>
        {message ? <FormMessage tone={message.tone}>{message.text}</FormMessage> : null}
        <Field
          id="verify-code"
          label="Code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          className="[&_input]:text-center [&_input]:font-display [&_input]:text-2xl [&_input]:tracking-[0.5em]"
        />
        <SubmitButton busy={busy}>Confirm</SubmitButton>
        <button type="button" onClick={resend} disabled={wait > 0} className="text-sm font-semibold text-pandan-700 underline underline-offset-4 disabled:text-santan-400 disabled:no-underline dark:text-pandan-300">
          {wait > 0 ? `You can ask for a new code in ${wait}s` : "Send me a new code"}
        </button>
      </form>
    </AuthCard>
  );
}
