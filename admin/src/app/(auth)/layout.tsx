import Image from "next/image";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="auth-layout grid min-h-dvh lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <aside className="auth-brand-panel relative hidden flex-col justify-between overflow-hidden bg-gula-900 p-10 text-santan-100 lg:flex">
        <div className="auth-brand-mark flex items-center gap-3">
          <Image src="/brand/cendol-satay-pin-icon-transparent.png" alt="" width={44} height={44} priority />
          <span className="font-display text-xl font-black lowercase">cendol satay</span>
        </div>
        <div className="auth-brand-message flex max-w-sm flex-col gap-3">
          <p className="font-display text-3xl font-extrabold leading-tight text-coconut">
            Melaka news &amp; places, checked before they go out.
          </p>
          <p className="text-sm text-santan-300">Admin panel. Every change you make here is recorded in the audit log.</p>
        </div>
        <p className="auth-brand-footer text-xs text-santan-400">Bandar Hilir · Klebang · Ayer Keroh · Jasin · Alor Gajah</p>
      </aside>
      <main className="auth-form-panel flex items-center justify-center px-4 py-12 sm:px-8">
        <div className="auth-form-column flex w-full max-w-sm flex-col gap-8">
          <div className="auth-mobile-mark flex items-center gap-2 lg:hidden">
            <Image src="/brand/cendol-satay-pin-icon-transparent.png" alt="" width={36} height={36} priority />
            <span className="font-display text-lg font-black lowercase">cendol satay</span>
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}
