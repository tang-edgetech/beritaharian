"use client";

import { AuthCard, errorMessage, Field, FormMessage, SubmitButton, TextLink } from "@/components/account/auth-ui";
import { readerApi } from "@/lib/auth";
import type { MessageResponse } from "@cendol/api-client";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [login, setLogin] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      await readerApi.post<MessageResponse>("auth/password/forgot", { login });
      router.push(`/reset-password?login=${encodeURIComponent(login)}`);
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthCard
      title="Forgot your password?"
      lead="Type your email or phone. If you have an account, we'll email you a code to set a new password."
      footer={
        <>
          Remembered it? <TextLink href="/login">Sign in</TextLink>
        </>
      }
    >
      <form className="forgot-form flex flex-col gap-4" onSubmit={submit} noValidate>
        {message ? <FormMessage>{message}</FormMessage> : null}
        <Field id="forgot-login" label="Email or phone" autoComplete="username" value={login} onChange={(e) => setLogin(e.target.value)} />
        <SubmitButton busy={busy}>Send me a code</SubmitButton>
      </form>
    </AuthCard>
  );
}
