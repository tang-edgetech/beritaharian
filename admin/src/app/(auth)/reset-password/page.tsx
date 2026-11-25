"use client";

import { BackButton } from "@/components/page-header";
import { CodeInput } from "@/components/code-input";
import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { notify } from "@/lib/notify";
import { ApiError, type MessageResponse } from "@cendol/api-client";
import { Loader2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";

function ResetPasswordForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [login, setLogin] = useState(params.get("login") ?? "");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setErrors({});
    try {
      const result = await api.post<MessageResponse>("auth/password/reset", {
        login,
        code,
        password,
        password_confirmation: confirmation,
      });
      notify.success(result.message);
      router.replace("/login");
    } catch (e) {
      if (e instanceof ApiError && e.code === "VALIDATION_FAILED") {
        setErrors({ password: e.fieldError("password") ?? "", code: e.fieldError("code") ?? "", login: e.fieldError("login") ?? "" });
      } else if (e instanceof ApiError && e.code.startsWith("OTP")) {
        setErrors({ code: e.message });
      } else notify.error(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="reset-password-form flex flex-col gap-5" onSubmit={submit}>
      <FormField id="reset-login" label="Email or phone" error={errors.login}>
        <Input id="reset-login" autoComplete="username" value={login} onChange={(e) => setLogin(e.target.value)} required />
      </FormField>
      <FormField id="reset-code" label="Code from the email" error={errors.code}>
        <CodeInput id="reset-code" value={code} onChange={setCode} invalid={Boolean(errors.code)} />
      </FormField>
      <FormField id="reset-password" label="New password" error={errors.password} hint="At least 10 characters.">
        <Input id="reset-password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      </FormField>
      <FormField id="reset-password-confirmation" label="Type it again">
        <Input
          id="reset-password-confirmation"
          type="password"
          autoComplete="new-password"
          value={confirmation}
          onChange={(e) => setConfirmation(e.target.value)}
          required
        />
      </FormField>
      <Button type="submit" size="lg" disabled={busy || code.length !== 6 || !password || password !== confirmation}>
        {busy ? <Loader2 className="animate-spin" /> : null}
        Set new password
      </Button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <section className="reset-password-page flex flex-col gap-6">
      <BackButton href="/forgot-password" />
      <div>
        <h1 className="page-title">Set a new password</h1>
        <p className="page-description">Signing in with the new password signs you out everywhere else.</p>
      </div>
      <Suspense>
        <ResetPasswordForm />
      </Suspense>
    </section>
  );
}
