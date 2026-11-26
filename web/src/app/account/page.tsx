"use client";

import { AuthCard, errorMessage, Field, FormMessage, SubmitButton } from "@/components/account/auth-ui";
import { readerApi, session, useReader } from "@/lib/auth";
import type { MeResponse, User } from "@cendol/api-client";
import { ChevronRight, LogOut, Star, Store } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

function ProfileForm({ user }: { user: User }) {
  const [name, setName] = useState(user.name);
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const result = await readerApi.put<{ message: string; user: User }>("account/profile", { name });
      session.signIn(session.token() ?? "", result.user);
      setMessage({ tone: "success", text: result.message });
    } catch (error) {
      setMessage({ tone: "error", text: errorMessage(error) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="profile-form flex flex-col gap-4" onSubmit={save} noValidate>
      {message ? <FormMessage tone={message.tone}>{message.text}</FormMessage> : null}
      <Field id="account-name" label="Your name" value={name} onChange={(e) => setName(e.target.value)} />
      <Field id="account-email" label="Email" value={user.email ?? ""} disabled hint="Ask us if you need to change it." />
      <SubmitButton busy={busy}>Save</SubmitButton>
    </form>
  );
}

export default function AccountPage() {
  const router = useRouter();
  const reader = useReader();
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmSignOut, setConfirmSignOut] = useState(false);

  useEffect(() => {
    if (!session.token()) {
      router.replace("/login");
      return;
    }
    readerApi
      .get<MeResponse>("auth/me")
      .then((r) => setUser(r.user))
      .catch((e) => {
        setError(errorMessage(e));
        if (!session.token()) router.replace("/login");
      });
  }, [router]);

  async function signOut() {
    try {
      await readerApi.post("auth/logout");
    } catch {
      /* signed out on this device either way */
    }
    session.clear();
    router.push("/");
  }

  return (
    <AuthCard title={reader ? `Hi, ${reader.name.split(" ")[0]}` : "Your account"} lead="Your details, your reviews and the places you manage.">
      {error ? <FormMessage>{error}</FormMessage> : null}
      {user ? <ProfileForm user={user} /> : !error ? <div className="h-40 animate-pulse rounded-xl bg-santan-100 dark:bg-santan-800" aria-hidden /> : null}
      <nav className="account-links flex flex-col gap-2 border-t border-santan-200 pt-4 dark:border-santan-800" aria-label="More in your account">
        <Link href="/account/reviews" className="account-link-row inline-flex h-11 items-center justify-between rounded-xl bg-santan-100 px-4 font-semibold hover:bg-santan-200 dark:bg-santan-800 dark:hover:bg-santan-700">
          <span className="inline-flex items-center gap-2"><Star className="size-4" aria-hidden />Your reviews</span>
          <ChevronRight className="size-4" aria-hidden />
        </Link>
        <Link href="/business" className="account-link-row inline-flex h-11 items-center justify-between rounded-xl bg-santan-100 px-4 font-semibold hover:bg-santan-200 dark:bg-santan-800 dark:hover:bg-santan-700">
          <span className="inline-flex items-center gap-2"><Store className="size-4" aria-hidden />Places you manage</span>
          <ChevronRight className="size-4" aria-hidden />
        </Link>
      </nav>
      <div className="account-sign-out flex flex-col gap-2 border-t border-santan-200 pt-4 dark:border-santan-800">
        {confirmSignOut ? (
          <div className="flex flex-col gap-3 rounded-xl bg-santan-100 p-4 dark:bg-santan-800" role="alertdialog" aria-labelledby="sign-out-question">
            <p id="sign-out-question" className="font-semibold">
              Sign out on this device?
            </p>
            <div className="flex gap-2">
              <button type="button" onClick={signOut} className="h-10 rounded-full bg-gula-900 px-4 text-sm font-bold text-coconut dark:bg-marigold-400 dark:text-gula-900">
                Yes, sign out
              </button>
              <button type="button" onClick={() => setConfirmSignOut(false)} className="h-10 rounded-full border border-santan-300 px-4 text-sm font-semibold dark:border-santan-600">
                Stay signed in
              </button>
            </div>
          </div>
        ) : (
          <button type="button" onClick={() => setConfirmSignOut(true)} className="inline-flex items-center gap-2 self-start text-sm font-semibold text-red-700 hover:underline dark:text-red-400">
            <LogOut className="size-4" aria-hidden />
            Sign out
          </button>
        )}
      </div>
    </AuthCard>
  );
}
