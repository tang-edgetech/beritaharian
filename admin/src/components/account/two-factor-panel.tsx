"use client";

import { CodeInput } from "@/components/code-input";
import { useConfirm } from "@/components/confirm-dialog";
import { FormField } from "@/components/form-field";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { notify } from "@/lib/notify";
import { ApiError, type TwoFactorSetup } from "@cendol/api-client";
import { Copy, KeyRound, Loader2, ShieldCheck } from "lucide-react";
import { useState } from "react";

function RecoveryCodes({ codes, onDone }: { codes: string[]; onDone: () => void }) {
  async function copy() {
    try {
      await navigator.clipboard.writeText(codes.join("\n"));
      notify.success("Recovery codes copied.");
    } catch {
      notify.info("Select the codes and copy them by hand.");
    }
  }

  return (
    <div className="recovery-codes flex flex-col gap-4 rounded-lg border border-marigold-300 bg-marigold-50 p-4 dark:border-marigold-800 dark:bg-marigold-900/30">
      <div>
        <p className="font-medium">Save these recovery codes now</p>
        <p className="text-sm text-muted-foreground">
          If you lose your phone, each code lets you sign in once. We won&apos;t show them again. Keep them in a password manager or print them.
        </p>
      </div>
      <ul className="recovery-codes-list grid grid-cols-2 gap-2 font-mono text-sm sm:grid-cols-4">
        {codes.map((code) => (
          <li key={code} className="rounded bg-card px-2 py-1 text-center select-all">
            {code}
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={copy}>
          <Copy /> Copy codes
        </Button>
        <Button type="button" onClick={onDone}>
          I&apos;ve saved them
        </Button>
      </div>
    </div>
  );
}

/** Turn on, manage and (where allowed) turn off two-step sign-in for your own account. */
export function TwoFactorPanel({ required }: { required: boolean }) {
  const { user, refresh } = useAuth();
  const confirm = useConfirm();
  const [setup, setSetup] = useState<TwoFactorSetup | null>(null);
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const enabled = user?.two_factor_enabled ?? false;

  async function begin() {
    setBusy("begin");
    try {
      setSetup(await api.post<TwoFactorSetup>("account/two-factor"));
    } catch (error) {
      notify.error(error);
    } finally {
      setBusy(null);
    }
  }

  async function confirmSetup(value = code) {
    setBusy("confirm");
    setCodeError("");
    try {
      const result = await api.post<{ message: string; recovery_codes: string[] }>("account/two-factor/confirm", { code: value });
      notify.success(result.message);
      setRecoveryCodes(result.recovery_codes);
      setSetup(null);
      setCode("");
      await refresh();
    } catch (error) {
      if (error instanceof ApiError && error.code === "TWO_FACTOR_INVALID") setCodeError(error.message);
      else notify.error(error);
      setCode("");
    } finally {
      setBusy(null);
    }
  }

  async function withPassword(action: "regenerate" | "disable") {
    if (action === "disable") {
      const ok = await confirm({
        title: "Turn off two-step sign-in?",
        description: "Anyone with your password could then sign in as you.",
        confirmLabel: "Turn off",
        danger: true,
      });
      if (!ok) return;
    }
    setBusy(action);
    setPasswordError("");
    try {
      if (action === "regenerate") {
        const result = await api.post<{ message: string; recovery_codes: string[] }>("account/two-factor/recovery-codes", { password });
        notify.success(result.message);
        setRecoveryCodes(result.recovery_codes);
      } else {
        const result = await api.delete<{ message: string }>("account/two-factor", { password });
        notify.success(result.message);
        await refresh();
      }
      setPassword("");
    } catch (error) {
      if (error instanceof ApiError && error.code === "VALIDATION_FAILED") setPasswordError(error.fieldError("password") ?? error.message);
      else notify.error(error);
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="two-factor-panel panel-card flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="panel-card-title">Two-step sign-in</h2>
          <p className="panel-card-description">After your password, you&apos;ll also enter a code from an app such as Google Authenticator or Microsoft Authenticator.</p>
        </div>
        {enabled ? <StatusBadge tone="good">On</StatusBadge> : <StatusBadge tone={required ? "warning" : "neutral"}>{required ? "Required for your role" : "Off"}</StatusBadge>}
      </div>

      {recoveryCodes ? <RecoveryCodes codes={recoveryCodes} onDone={() => setRecoveryCodes(null)} /> : null}

      {!enabled && !setup ? (
        <div>
          <Button onClick={begin} disabled={busy !== null}>
            {busy === "begin" ? <Loader2 className="animate-spin" /> : <ShieldCheck />}
            Set up two-step sign-in
          </Button>
        </div>
      ) : null}

      {setup ? (
        <ol className="two-factor-steps grid gap-6 md:grid-cols-[auto_1fr]">
          <li className="two-factor-step-scan flex flex-col items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element -- QR code generated by our server as SVG */}
            <img
              src={`data:image/svg+xml;utf8,${encodeURIComponent(setup.qr_svg)}`}
              alt="QR code to scan with your authenticator app"
              width={180}
              height={180}
              className="two-factor-qr rounded-lg border bg-white p-2"
            />
            <p className="max-w-48 text-center text-xs text-muted-foreground">
              Can&apos;t scan? Enter this key: <span className="font-mono break-all select-all">{setup.secret}</span>
            </p>
          </li>
          <li className="two-factor-step-confirm flex flex-col gap-4">
            <p className="text-sm">
              <strong>1.</strong> Scan the QR code with your authenticator app.
              <br />
              <strong>2.</strong> Enter the 6-digit code it shows.
            </p>
            <FormField id="two-factor-setup-code" label="Code from the app" error={codeError}>
              <CodeInput id="two-factor-setup-code" value={code} onChange={setCode} onComplete={confirmSetup} disabled={busy === "confirm"} invalid={Boolean(codeError)} />
            </FormField>
            <div className="flex gap-2">
              <Button onClick={() => confirmSetup()} disabled={code.length !== 6 || busy !== null}>
                {busy === "confirm" ? <Loader2 className="animate-spin" /> : null}
                Turn on
              </Button>
              <Button variant="ghost" onClick={() => setSetup(null)}>
                Cancel
              </Button>
            </div>
          </li>
        </ol>
      ) : null}

      {enabled ? (
        <div className="two-factor-manage flex flex-col gap-3 border-t pt-5">
          <FormField id="two-factor-password" label="Your password" error={passwordError} hint="Needed to see new recovery codes or turn this off." className="max-w-sm">
            <Input id="two-factor-password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </FormField>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" disabled={!password || busy !== null} onClick={() => withPassword("regenerate")}>
              {busy === "regenerate" ? <Loader2 className="animate-spin" /> : <KeyRound />}
              New recovery codes
            </Button>
            {!required ? (
              <Button variant="destructive" disabled={!password || busy !== null} onClick={() => withPassword("disable")}>
                {busy === "disable" ? <Loader2 className="animate-spin" /> : null}
                Turn off
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
