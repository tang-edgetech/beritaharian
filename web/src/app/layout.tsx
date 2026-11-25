import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Cendol Satay · Melaka news & places",
    template: "%s · Cendol Satay",
  },
  description: "Checked news, places to go and community reports for Melaka.",
  icons: { icon: "/brand/cendol-satay-pin-icon.png", apple: "/brand/cendol-satay-pin-icon.png" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f0b443" },
    { media: "(prefers-color-scheme: dark)", color: "#171411" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="site-body flex min-h-dvh flex-col">{children}</body>
    </html>
  );
}
