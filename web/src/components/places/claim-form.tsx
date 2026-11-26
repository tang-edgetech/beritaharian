"use client";

import { errorMessage, Field, fieldErrors, FormMessage, SubmitButton } from "@/components/account/auth-ui";
import { readerApi, useRequireReader } from "@/lib/auth";
import { refreshPlaceStatus } from "@/lib/place-status";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { setFlash } from "../site/flash-message";
import { CheckField, FormPage, SelectField, TextAreaField } from "./form-bits";
import { FilePick } from "./write-review-form";

export function ClaimForm({ slug, name, base }: { slug: string; name: string; base: string }) {
  const router = useRouter();
  const ready = useRequireReader(`${base}/claim`);
  const [role, setRole] = useState("owner");
  const [ssm, setSsm] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [doc, setDoc] = useState<File | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);


  async function submit(event: FormEvent) {
    event.preventDefault();
    const local: Record<string, string> = {};
    if (!phone.trim()) local.phone = "Please give a phone number we can call to check.";
    if (!ssm.trim() && !doc) local.ssm_number = "Please give the SSM registration number, or upload a document.";
    if (!confirm) local.confirm = "Please confirm that you are allowed to manage this place.";
    setErrors(local);
    if (Object.keys(local).length) return;
    setBusy(true);
    setMessage(null);
    try {
      const result = await readerApi.upload<{ message: string }>(`me/places/${encodeURIComponent(slug)}/claims`, {
        role,
        ssm_number: ssm.trim() || null,
        phone: phone.trim(),
        note: note.trim() || null,
        document: doc,
        confirm: true,
      });
      refreshPlaceStatus(slug);
      setFlash(result.message);
      router.push(base);
    } catch (error) {
      setErrors(fieldErrors(error));
      setMessage(errorMessage(error));
      setBusy(false);
    }
  }

  if (!ready) return <div className="site-container h-96 animate-pulse py-6" aria-busy />;

  return (
    <FormPage
      back={base}
      backLabel={`Back to ${name}`}
      title={`Claim ${name}`}
      lead="Once we confirm you run this place, you can update its details, hours and photos, and reply to reviews. It's free."
    >
      <form className="claim-form flex flex-col gap-5" onSubmit={submit} noValidate>
        {message ? <FormMessage>{message}</FormMessage> : null}
        <SelectField id="claim-role" label="You are the" value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="owner">Owner</option>
          <option value="manager">Manager</option>
        </SelectField>
        <Field id="claim-ssm" label="SSM registration number" value={ssm} onChange={(e) => setSsm(e.target.value)} maxLength={40} placeholder="e.g. 202403123456 (MA0123456-X)" error={errors.ssm_number} hint="Or upload a document below if you don't have one." />
        <FilePick
          id="claim-document"
          label="Document that shows you run this place (optional if you gave the SSM number)"
          accept="image/*,application/pdf"
          files={doc ? [doc] : []}
          onChange={(f) => setDoc(f[0] ?? null)}
          error={errors.document}
          hint="SSM certificate, business licence or a utility bill for the premises. Only our team sees it; it is deleted if the claim is turned down."
        />
        <Field id="claim-phone" label="Phone number" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={30} autoComplete="tel" error={errors.phone} hint="We may call to check. It isn't shown on the site." />
        <TextAreaField id="claim-note" label="Anything we should know? (optional)" value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} rows={3} />
        <CheckField id="claim-confirm" label="I own or manage this place and am allowed to speak for it." checked={confirm} onChange={setConfirm} error={errors.confirm} />
        <SubmitButton busy={busy}>Send claim</SubmitButton>
      </form>
    </FormPage>
  );
}
