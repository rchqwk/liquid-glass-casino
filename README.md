# Liquid Glass Crypto Casino (Prototype)

Play-money **casino prototype** with an Apple-like “liquid glass” UI, plus a
simple “provably fair” style RNG (commit → reveal) implementation.

**Included games**
- Dice
- Roulette (European 0–36)
- Slots (simple 3-reel)
- Blackjack (one-click auto-play)
- Poker (placeholder)

**Important**
- This project does **not** handle real money or crypto deposits/payouts.
- If you want a licensed real-money casino, you’ll need legal/compliance work
  (jurisdiction, licensing, KYC/AML, responsible gambling, etc.) before any
  production build.

## Getting Started

Install dependencies (already installed if you generated this project here):

```bash
npm install
```

Run the development server:

```bash
npm run dev
```

Open http://localhost:3000 with your browser.

## How the RNG works (demo)

- The app generates a **server seed**, then shows its SHA-256 hash (“commit”).
- Outcomes are derived from:

```
SHA256(serverSeed:clientSeed:nonce:index)
```

This is a **prototype**: the server seed is stored locally in the browser, so it
does not provide real trust guarantees. To make it meaningful in production you
need a real backend that commits to the seed, uses it privately, and reveals it
later.

## Key routes

- `/` landing
- `/casino` lobby
- `/casino/settings` client seed + server seed commit/reveal
- `/casino/dice`, `/casino/roulette`, `/casino/slots`, `/casino/blackjack`

---

Built with Next.js + Tailwind CSS.
