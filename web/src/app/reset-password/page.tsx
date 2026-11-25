"use client";

import { AuthCard, errorMessage, Field, fieldErrors, FormMessage, SubmitButton, TextLink } from "@/components/account/auth-ui";
import { readerApi } from "@/lib/auth";
import type { MessageResponse } from "@cendol/api-client";
import { useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";

function ResetForm() {
  const params = useSearchParams();
  const [values, setValues] = useState({ login: params.get("login") ?? "", code: "", password: "", password_confirmation: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (key: keyof typeof values, value: string) => setValues((v) => ({ ...v, [key]: value }));

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (values.password !== values.password_confirmation) {
      setErrors({ password_confirmation: "The two passwords don't match." });
      return;
    }
    setBusy(true);
    setMessage(null);
    setErrors({});
    try {
      const result = await readerApi.post<MessageResponse>("auth/password/reset", values);
      setMessage({ tone: "success", text: result.message });
    } catch (error) {
      setErrors(fieldErrors(error));
      setMessage({ tone: "error", text: errorMessage(error) });
    } finally {
      setBusy(false);
    }
  }

  if (message?.tone === "success") {
    return (
      <div className="flex flex-col gap-4">
        <FormMessage tone="success">{message.text}</FormMessage>
        <TextLink href="/login">Go to sign in</TextLink>
      </div>
    );
  }

  return (
    <form className="reset-form flex flex-col gap-4" onSubmit={submit} noValidate>
      {message ? <FormMessage>{message.text}</FormMessage> : null}
      <Field id="reset-login" label="Email or phone" value={values.login} onChange={(e) => set("login", e.target.value)} error={errors.login} />
      <Field id="reset-code" label="Code from the email" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={values.code} onChange={(e) => set("code", e.target.value.replace(/\D/g, ""))} error={errors.code} />
      <Field id="reset-password" label="New password" type="password" autoComplete="new-password" value={values.password} onChange={(e) => set("password", e.target.value)} error={errors.password} hint="At least 10 characters." />
      <Field id="reset-password-confirm" label="Type it again" type="password" autoComplete="new-password" value={values.password_confirmation} onChange={(e) => set("password_confirmation", e.target.value)} error={errors.password_confirmation} />
      <SubmitButton busy={busy}>Set new password</SubmitButton>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <AuthCard title="Set a new password" lead="Type the code we emailed you and choose a new password.">
      <Suspense fallback={null}>
        <ResetForm />
      </Suspense>
    </AuthCard>
  );
}
