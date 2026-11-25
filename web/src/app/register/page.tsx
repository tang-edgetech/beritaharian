"use client";

import { AuthCard, errorMessage, Field, fieldErrors, FormMessage, SubmitButton, TextLink } from "@/components/account/auth-ui";
import { nextStepAfter, readerApi } from "@/lib/auth";
import type { AuthResult } from "@cendol/api-client";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export default function RegisterPage() {
  const router = useRouter();
  const [values, setValues] = useState({ name: "", email: "", phone: "", user_type: "local", password: "", password_confirmation: "", accept_terms: false });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (key: keyof typeof values, value: string | boolean) => setValues((v) => ({ ...v, [key]: value }));

  async function submit(event: FormEvent) {
    event.preventDefault();
    const local: Record<string, string> = {};
    if (values.password !== values.password_confirmation) local.password_confirmation = "The two passwords don't match.";
    if (!values.accept_terms) local.accept_terms = "Please agree before creating your account.";
    if (Object.keys(local).length) {
      setErrors(local);
      return;
    }
    setBusy(true);
    setMessage(null);
    setErrors({});
    try {
      const result = await readerApi.post<AuthResult>("auth/register", { ...values, phone: values.phone || null, device_name: "Website" });
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
      title="Create your account"
      lead="We send a 6-digit code to your email to confirm it's really you."
      footer={
        <>
          Already have an account? <TextLink href="/login">Sign in</TextLink>
        </>
      }
    >
      <form className="register-form flex flex-col gap-4" onSubmit={submit} noValidate>
        {message ? <FormMessage>{message}</FormMessage> : null}
        <Field id="register-name" label="Your name" autoComplete="name" value={values.name} onChange={(e) => set("name", e.target.value)} error={errors.name} />
        <Field id="register-email" label="Email" type="email" autoComplete="email" value={values.email} onChange={(e) => set("email", e.target.value)} error={errors.email} />
        <Field
          id="register-phone"
          label="Phone (optional)"
          type="tel"
          autoComplete="tel"
          value={values.phone}
          onChange={(e) => set("phone", e.target.value)}
          error={errors.phone}
          hint="Malaysian numbers like 012-345 6789."
        />
        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-semibold text-gula-900 dark:text-coconut">Do you live in Melaka?</legend>
          <div className="grid grid-cols-2 gap-2">
            {[
              { value: "local", label: "Yes, I live here" },
              { value: "tourist", label: "No, I'm visiting" },
            ].map((option) => (
              <label
                key={option.value}
                className="user-type-option flex cursor-pointer items-center gap-2 rounded-xl border border-santan-300 px-3 py-2.5 text-sm has-checked:border-pandan-500 has-checked:bg-pandan-50 dark:border-santan-700 dark:has-checked:bg-pandan-950"
              >
                <input type="radio" name="user_type" value={option.value} checked={values.user_type === option.value} onChange={() => set("user_type", option.value)} className="accent-pandan-600" />
                {option.label}
              </label>
            ))}
          </div>
        </fieldset>
        <Field
          id="register-password"
          label="Password"
          type="password"
          autoComplete="new-password"
          value={values.password}
          onChange={(e) => set("password", e.target.value)}
          error={errors.password}
          hint="At least 10 characters. A short sentence is easy to remember."
        />
        <Field
          id="register-password-confirm"
          label="Type the password again"
          type="password"
          autoComplete="new-password"
          value={values.password_confirmation}
          onChange={(e) => set("password_confirmation", e.target.value)}
          error={errors.password_confirmation}
        />
        <div className="flex flex-col gap-1">
          <label htmlFor="register-terms" className="flex items-start gap-2.5 text-sm">
            <input id="register-terms" type="checkbox" checked={values.accept_terms} onChange={(e) => set("accept_terms", e.target.checked)} className="mt-1 size-4 accent-pandan-600" />
            <span>
              I agree to how Cendol Satay uses my details, as explained in the <TextLink href="/privacy">privacy notice</TextLink>.
            </span>
          </label>
          {errors.accept_terms ? <p className="text-sm text-red-700 dark:text-red-400">{errors.accept_terms}</p> : null}
        </div>
        <SubmitButton busy={busy}>Create account</SubmitButton>
      </form>
    </AuthCard>
  );
}
