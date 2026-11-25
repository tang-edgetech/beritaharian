import { Newspaper, Siren, Store } from "lucide-react";
import Image from "next/image";

const PILLARS = [
  {
    icon: Newspaper,
    title: "Daily news",
    text: "What's happening in Melaka today, checked by our verifiers before it goes out.",
    tone: "pillar-news bg-pandan-700 text-coconut",
  },
  {
    icon: Store,
    title: "Places to go",
    text: "From hawker stalls in Jonker Street to hotels in Ayer Keroh, with reviews from real visits.",
    tone: "pillar-places bg-marigold-400 text-gula-900",
  },
  {
    icon: Siren,
    title: "Community reports",
    text: "Share what you saw. We check it, and verified reports help keep everyone informed.",
    tone: "pillar-reports bg-gula-800 text-santan-100",
  },
];

/** Holding page until the news and directory pages launch (Phases 1–2). */
export default function HomePage() {
  return (
    <main className="holding-page flex flex-1 flex-col">
      <section className="holding-hero site-container flex flex-col items-start gap-6 py-14 sm:py-20">
        <Image
          src="/brand/cendol-satay-pin-transparent.png"
          alt="Cendol Satay"
          width={160}
          height={160}
          priority
          className="holding-logo"
        />
        <h1 className="holding-title max-w-2xl text-4xl font-black leading-tight text-gula-900 sm:text-6xl dark:text-coconut">
          Apa cerita, Melaka?
        </h1>
        <p className="holding-lead max-w-xl text-lg text-santan-600 dark:text-santan-300">
          Cendol Satay is coming soon: Melaka news you can trust, places worth the trip, and a way to tell us what&apos;s happening
          on your street.
        </p>
      </section>

      <section className="holding-pillars site-container grid gap-4 pb-16 sm:grid-cols-3" aria-label="What Cendol Satay will do">
        {PILLARS.map((pillar) => (
          <article key={pillar.title} className={`holding-pillar flex flex-col gap-3 rounded-card p-6 ${pillar.tone}`}>
            <pillar.icon className="size-7" aria-hidden />
            <h2 className="text-xl font-extrabold">{pillar.title}</h2>
            <p className="text-sm leading-relaxed opacity-90">{pillar.text}</p>
          </article>
        ))}
      </section>

      <footer className="holding-footer mt-auto border-t border-santan-200 py-6 text-sm text-santan-500 dark:border-santan-800">
        <p className="site-container">Bandar Hilir · Klebang · Ayer Keroh · Jasin · Alor Gajah</p>
      </footer>
    </main>
  );
}
