export default function BlackjackSpecialRulesPage() {
  return (
    <div className="glass glass-shine rounded-3xl p-6 text-white/80">
      <h1 className="text-2xl font-semibold text-white">Special rules (Arcade Blackjack)</h1>
      <p className="mt-3 text-sm leading-6 text-white/70">
        This version adds arcade mechanics on top of normal blackjack: powerups, mystery boxes, collectibles, and a
        multiplayer round timer.
      </p>

      <h2 className="mt-6 text-lg font-semibold text-white">Round flow</h2>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-white/70">
        <li>Betting phase (timer): place your bet (and optional side bets), or skip.</li>
        <li>Player turns: players act in order.</li>
        <li>Dealer window: short window where certain dealer-interaction powerups can be used (when available).</li>
      </ul>

      <h2 className="mt-6 text-lg font-semibold text-white">Powerups</h2>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-white/70">
        <li>Boosts: help you improve your hand (add points/cards).</li>
        <li>Saves: help you recover after a bust or a bad draw.</li>
        <li>Utility: information/control tools (peek, swap, etc.).</li>
        <li>Magic/Mythic/Dealer: rarer effects with stronger impact or special timing rules.</li>
      </ul>

      <h2 className="mt-6 text-lg font-semibold text-white">Mystery boxes</h2>
      <p className="mt-2 text-sm leading-6 text-white/70">
        Mystery boxes give you random specials. Open them from the Mystery Boxes bubble in-game.
      </p>

      <h2 className="mt-6 text-lg font-semibold text-white">Collectibles</h2>
      <p className="mt-2 text-sm leading-6 text-white/70">
        Collectibles are cosmetic items you can place on the felt in Table Edit Mode. They persist across tables.
      </p>
    </div>
  );
}
