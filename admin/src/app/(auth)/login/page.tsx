"use client";

import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { notify } from "@/lib/notify";
import { ApiError, type AuthResult } from "@cendol/api-client";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState, type FormEvent } from "react";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { handleAuthResult, user } = useAuth();
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  // true once this form has signed someone in; the form then decides where to go next
  const submitted = useRef(false);

  // already signed in (e.g. opened /login in a new tab): go straight in
  useEffect(() => {
    if (user && !submitted.current) router.replace("/dashboard");
  }, [user, router]);

  useEffect(() => {
    if (params.get("expired")) notify.info("Your session ended. Please sign in again.");
  }, [params]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setErrors({});
    try {
      const result = await api.post<AuthResult>("auth/login", { login, password, device_name: "Admin panel" });
      submitted.current = true;
      const next = handleAuthResult(result, login);
      if (result.status === "authenticated") notify.success(result.message);
      const target = params.get("next");
      router.replace(result.status === "authenticated" && target?.startsWith("/") && next === "/dashboard" ? target : next);
    } catch (error) {
      if (error instanceof ApiError && error.code === "VALIDATION_FAILED") {
        setErrors({ login: error.fieldError("login") ?? "", password: error.fieldError("password") ?? "" });
      } else if (error instanceof ApiError && error.code === "INVALID_CREDENTIALS") {
        setErrors({ password: error.message });
      } else {
        notify.error(error);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="login-form flex flex-col gap-5" onSubmit={submit} noValidate>
      <FormField id="login-email" label="Email or phone" error={errors.login}>
        <Input
          id="login-email"
          name="login"
          autoComplete="username"
          inputMode="email"
          value={login}
          onChange={(e) => setLogin(e.target.value)}
          aria-invalid={Boolean(errors.login)}
          required
        />
      </FormField>
      <FormField id="login-password" label="Password" error={errors.password}>
        <Input
          id="login-password"
          name="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          aria-invalid={Boolean(errors.password)}
          required
        />
      </FormField>
      <div className="login-form-actions flex flex-col gap-3">
        <Button type="submit" size="lg" disabled={busy || !login || !password}>
          {busy ? <Loader2 className="animate-spin" /> : null}
          Sign in
        </Button>
        <Link href="/forgot-password" className="text-center text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
          Forgot your password?
        </Link>
      </div>
    </form>
  );
}

export default function LoginPage() {
  return (
    <section className="login-page flex flex-col gap-6">
      <div className="login-page-heading">
        <h1 className="page-title">Sign in</h1>
        <p className="page-description">Use the email or phone number on your staff account.</p>
      </div>
      <Suspense>
        <LoginForm />
      </Suspense>
    </section>
  );
}
