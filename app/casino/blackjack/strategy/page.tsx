export default function BlackjackStrategyGuidePage() {
  return (
    <div className="glass glass-shine rounded-3xl p-6 text-white/80">
      <h1 className="text-2xl font-semibold text-white">Blackjack strategy guide</h1>
      <p className="mt-3 text-sm leading-6 text-white/70">
        This is a quick, beginner-friendly guide for the play-money tables. Use the in-game tour for powerups and special mechanics.
      </p>

      <h2 className="mt-6 text-lg font-semibold text-white">Core ideas</h2>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-white/70">
        <li>Aim for strong totals (17–21) but avoid busting.</li>
        <li>Dealer shows a visible up-card; play more aggressively when the dealer looks strong.</li>
        <li>Splitting and doubling can improve long-term results, but increases variance.</li>
      </ul>

      <h2 className="mt-6 text-lg font-semibold text-white">Simple rules of thumb</h2>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-white/70">
        <li>Stand on 17+ most of the time.</li>
        <li>Hit on 11 or less.</li>
        <li>Be cautious around 12–16 (these hands bust easily).</li>
      </ul>

      <h2 className="mt-6 text-lg font-semibold text-white">Using powerups</h2>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-white/70">
        <li>Boosts: turn “almost good” hands into wins.</li>
        <li>Saves: strongest when you would otherwise bust or lose badly.</li>
        <li>Utility: use for information (peek) or to fix a specific problem (swap/remove).</li>
      </ul>
    </div>
  );
}
