import { BottomTabBar } from "@/components/site/site-client";
import { SiteFooter, SiteHeader } from "@/components/site/site-chrome";
import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: {
    default: "Cendol Satay · Melaka news & places",
    template: "%s · Cendol Satay",
  },
  description: "Checked news, places to go and community reports for Melaka.",
  icons: { icon: "/brand/cendol-satay-pin-icon.png", apple: "/brand/cendol-satay-pin-icon.png" },
  openGraph: { siteName: "Cendol Satay", locale: "en_MY", type: "website" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#faf8f5" },
    { media: "(prefers-color-scheme: dark)", color: "#171411" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="site-body flex min-h-dvh flex-col">
        <a href="#main" className="skip-link sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-full focus:bg-gula-900 focus:px-4 focus:py-2 focus:text-coconut">
          Skip to the news
        </a>
        <SiteHeader />
        <main id="main" className="site-main flex flex-1 flex-col">
          {children}
        </main>
        <SiteFooter />
        <Suspense fallback={null}>
          <BottomTabBar />
        </Suspense>
      </body>
    </html>
  );
}
