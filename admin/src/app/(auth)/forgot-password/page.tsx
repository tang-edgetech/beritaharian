"use client";

import { BackButton } from "@/components/page-header";
import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { notify } from "@/lib/notify";
import type { MessageResponse } from "@cendol/api-client";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [login, setLogin] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const result = await api.post<MessageResponse>("auth/password/forgot", { login });
      notify.success(result.message);
      router.push(`/reset-password?login=${encodeURIComponent(login)}`);
    } catch (e) {
      notify.error(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="forgot-password-page flex flex-col gap-6">
      <BackButton href="/login" label="Back to sign in" />
      <div>
        <h1 className="page-title">Reset your password</h1>
        <p className="page-description">We&apos;ll email you a 6-digit code to set a new password.</p>
      </div>
      <form className="forgot-password-form flex flex-col gap-5" onSubmit={submit}>
        <FormField id="forgot-login" label="Email or phone">
          <Input id="forgot-login" autoComplete="username" value={login} onChange={(e) => setLogin(e.target.value)} required />
        </FormField>
        <Button type="submit" size="lg" disabled={busy || !login}>
          {busy ? <Loader2 className="animate-spin" /> : null}
          Send code
        </Button>
      </form>
    </section>
  );
}
