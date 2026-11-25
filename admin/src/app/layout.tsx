import { Providers } from "@/components/providers";
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Cendol Satay Admin",
    template: "%s · Cendol Satay Admin",
  },
  description: "Admin panel for Cendol Satay, Melaka news and places.",
  icons: { icon: "/brand/cendol-satay-pin-icon.png" },
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="admin-app min-h-dvh">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
