export default function BlackjackRulesPage() {
  return (
    <div className="glass glass-shine rounded-3xl p-6 text-white/80">
      <h1 className="text-2xl font-semibold text-white">Blackjack rules</h1>
      <p className="mt-3 text-sm leading-6 text-white/70">
        Goal: get as close to 21 as possible without going over, and beat the dealer’s final total.
      </p>

      <h2 className="mt-6 text-lg font-semibold text-white">Hand values</h2>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-white/70">
        <li>2–10 are worth their face value.</li>
        <li>J/Q/K are worth 10.</li>
        <li>Ace is worth 1 or 11 (whichever is best for the hand).</li>
      </ul>

      <h2 className="mt-6 text-lg font-semibold text-white">What you can do</h2>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-white/70">
        <li>Hit: take another card.</li>
        <li>Stand: stop taking cards.</li>
        <li>Double down: double your bet and take exactly one more card.</li>
        <li>Split: if your first two cards match, split into two hands (each with its own bet).</li>
      </ul>

      <h2 className="mt-6 text-lg font-semibold text-white">Dealer</h2>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-white/70">
        <li>Dealer hits until at least 17.</li>
        <li>If you bust (over 21), you lose that hand automatically.</li>
      </ul>
    </div>
  );
}

