export const dynamic = "force-static";

export default function PrivacyPolicyPage() {
  return (
    <div className="mx-auto w-full max-w-3xl p-6 sm:p-10">
      <div className="glass glass-shine rounded-3xl p-8">
        <h1 className="text-2xl font-semibold text-white">Privacy Policy</h1>
        <p className="mt-3 text-sm leading-6 text-white/70">
          This policy explains what data is collected for the play-money service and how it is used.
        </p>

        <h2 className="mt-8 text-lg font-semibold text-white">What we collect</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-white/70">
          <li>
            Account identifiers used to sign in (e.g. a chosen username, or your Discord user ID/display name when using the
            Discord Activity).
          </li>
          <li>Gameplay state and tables you join (e.g. blackjack table state, bets, and powerups).</li>
          <li>Basic usage/security data such as timestamps for last activity (used for presence and anti-abuse).</li>
        </ul>

        <h2 className="mt-8 text-lg font-semibold text-white">How we use data</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-white/70">
          <li>To operate multiplayer tables and synchronize game state.</li>
          <li>To show names in-game and attribute actions (e.g. chat, powerups).</li>
          <li>To prevent abuse (e.g. limiting duplicate sessions).</li>
        </ul>

        <h2 className="mt-8 text-lg font-semibold text-white">Cookies</h2>
        <p className="mt-3 text-sm leading-6 text-white/70">
          We use a session cookie to keep you signed in. When using Discord sign-in, a session is created after successful
          Discord authorization.
        </p>

        <h2 className="mt-8 text-lg font-semibold text-white">Data retention</h2>
        <p className="mt-3 text-sm leading-6 text-white/70">
          Service data may be reset at any time. Do not rely on this service for long-term storage.
        </p>

        <h2 className="mt-8 text-lg font-semibold text-white">Contact</h2>
        <p className="mt-3 text-sm leading-6 text-white/70">
          If you have questions about this policy, contact the project owner.
        </p>
      </div>
    </div>
  );
}
