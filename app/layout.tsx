import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { Providers } from "./providers";
import { Analytics } from "@vercel/analytics/next";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Liquid Glass Casino",
  description:
    "A play-money casino with a Liquid Glass UI and provably-fair style RNG.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <div className="flex-1">
          <Providers>{children}</Providers>
        </div>
        <footer className="border-t border-white/5 bg-black/30 px-4 py-4 text-xs text-white/50">
          <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-3">
            <div>© {new Date().getFullYear()} Liquid Glass Casino</div>
            <div className="flex items-center gap-4">
              <Link className="hover:text-white/80" href="/privacy">
                Privacy Policy
              </Link>
              <Link className="hover:text-white/80" href="/terms">
                Terms of Service
              </Link>
            </div>
          </div>
        </footer>
        <Analytics />
      </body>
    </html>
  );
}
