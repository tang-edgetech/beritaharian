"use client";

import { AuthCard, errorMessage, Field, fieldErrors, FormMessage, SubmitButton, TextLink } from "@/components/account/auth-ui";
import { nextStepAfter, readerApi } from "@/lib/auth";
import type { AuthResult } from "@cendol/api-client";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export default function LoginPage() {
  const router = useRouter();
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    setErrors({});
    try {
      const result = await readerApi.post<AuthResult>("auth/login", { login, password, device_name: "Website" });
      router.push(nextStepAfter(result));
    } catch (error) {
      setErrors(fieldErrors(error));
      setMessage(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthCard
      title="Sign in"
      lead="To report what's happening near you and, soon, review places you've visited."
      footer={
        <>
          New here? <TextLink href="/register">Create an account</TextLink>
        </>
      }
    >
      <form className="login-form flex flex-col gap-4" onSubmit={submit} noValidate>
        {message ? <FormMessage>{message}</FormMessage> : null}
        <Field id="login-identifier" label="Email or phone" autoComplete="username" value={login} onChange={(e) => setLogin(e.target.value)} error={errors.login} required />
        <Field id="login-password" label="Password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} error={errors.password} required />
        <div className="text-right text-sm">
          <TextLink href="/forgot-password">Forgot your password?</TextLink>
        </div>
        <SubmitButton busy={busy}>Sign in</SubmitButton>
      </form>
    </AuthCard>
  );
}
