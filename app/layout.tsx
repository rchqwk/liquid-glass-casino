import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import Script from "next/script";
import "./globals.css";
import { Providers } from "./providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://rchqwk.com"),
  title: {
    default: "Liquid Glass Arcade — Free Skill Games & Card Games Online",
    template: "%s | Liquid Glass Arcade",
  },
  description:
    "Liquid Glass Arcade is a free online arcade of skill-based card games and puzzles. Play Roguelike Blackjack and more for free — no real money, no download.",
  applicationName: "Liquid Glass Arcade",
  keywords: [
    "roguelike blackjack",
    "blackjack roguelike",
    "free card games",
    "deckbuilding card game",
    "online blackjack game",
    "free blackjack",
    "skill games",
    "arcade games",
  ],
  openGraph: {
    title: "Liquid Glass Arcade — Free Skill Games & Card Games Online",
    description:
      "A free online arcade of skill-based card games. Play Roguelike Blackjack and more for free — no real money, no download.",
    url: "https://rchqwk.com",
    siteName: "Liquid Glass Arcade",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Liquid Glass Arcade — Free Skill Games & Card Games Online",
    description:
      "Free online card games. Play Roguelike Blackjack and more — no real money, no download.",
  },
  robots: {
    index: true,
    follow: true,
  },
  verification: {
    google: "NXQQxe2zGtmyUbM2NdN9_MwjJrIxG9gPEAtblPuiywo",
  },
};

// Keep mobile zoom available for readable cards and accessible controls.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
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
      <head>
        {/* Keep ownership verification in server HTML; load the ad runtime after hydration. */}
        <meta name="google-adsense-account" content="ca-pub-3256641731859297" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebSite",
              name: "Liquid Glass Arcade",
              url: "https://rchqwk.com",
              description:
                "A free online arcade of skill-based card games. Play Roguelike Blackjack and more for free — no real money, no download.",
            }),
          }}
        />
        <style>{`
          html, body, button, a, input, [role="button"] {
            touch-action: manipulation;
            -webkit-tap-highlight-color: transparent;
          }
        `}</style>
      </head>
      <body className="min-h-full flex flex-col">
        <Script id="adsense-runtime" strategy="afterInteractive" src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-3256641731859297" crossOrigin="anonymous" />
        <div className="flex-1">
          <Providers>{children}</Providers>
        </div>
        <footer className="border-t border-white/5 bg-black/30 px-4 py-4 text-xs text-white/50">
          <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-3">
            <div>© {new Date().getFullYear()} Liquid Glass Arcade</div>
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
      </body>
    </html>
  );
}
