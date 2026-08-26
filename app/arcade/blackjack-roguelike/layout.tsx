import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Roguelike Blackjack — Free Deckbuilding Card Game",
  description:
    "Roguelike Blackjack is a free single-player deckbuilding card game. Beat round targets with blackjack hands, unlock jokers, powerups and deck edits, and climb as far as you can. Play online free — no real money, no download.",
  alternates: { canonical: "/arcade/blackjack-roguelike" },
  openGraph: {
    title: "Roguelike Blackjack — Free Deckbuilding Card Game",
    description:
      "A free single-player deckbuilding card game. Beat round targets with blackjack hands, unlock jokers and powerups, and climb the ladder. No real money.",
    url: "/arcade/blackjack-roguelike",
    type: "website",
    siteName: "Liquid Glass Arcade",
  },
  twitter: {
    card: "summary",
    title: "Roguelike Blackjack — Free Deckbuilding Card Game",
    description:
      "A free single-player deckbuilding card game. Beat round targets, unlock jokers and powerups, and climb. No real money.",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "VideoGame",
  name: "Roguelike Blackjack",
  description:
    "A free single-player deckbuilding roguelike where you play blackjack hands to beat round targets, and unlock jokers, powerups and deck edits.",
  applicationCategory: "Game",
  operatingSystem: "Any (web browser)",
  genre: ["Card game", "Roguelike", "Deckbuilding"],
  playMode: "SinglePlayer",
  isAccessibleForFree: true,
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
};

export default function RoguelikeBlackjackLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {children}
    </>
  );
}
