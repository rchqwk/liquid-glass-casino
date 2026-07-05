import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
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
      <head>
        {/*
          Inline READY capture — runs during HTML parsing, before any JS bundles
          download. Discord sends the READY postMessage exactly once during initial
          iframe load. If the SDK isn't listening, the handshake hangs forever.

          This interceptor buffers the READY payload. When the SDK eventually
          loads and registers its own listener, __discordReadyFlush() re-dispatches
          the captured READY so the SDK receives it even if it loaded late.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{(function(){var b=[],r=!1;function l(e){try{e.data&&e.data.type==="READY"&&(b.push({data:e.data,origin:e.origin,source:e.source,ports:e.ports}),r=!0)}catch(t){}}window.addEventListener("message",l);window.__discordReadyFlush=function(){window.removeEventListener("message",l);if(!r||!b.length)return!1;var a=b.splice(0);r=!1;a.forEach(function(e){try{window.dispatchEvent(new MessageEvent("message",{data:e.data,origin:e.origin,source:e.source,ports:e.ports}))}catch(t){}});return!0}})()}catch(e){}})();`,
          }}
        />
      </head>
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
      </body>
    </html>
  );
}
