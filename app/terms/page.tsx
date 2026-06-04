export const dynamic = "force-static";

export default function TermsOfServicePage() {
  return (
    <div className="mx-auto w-full max-w-3xl p-6 sm:p-10">
      <div className="glass glass-shine rounded-3xl p-8">
        <h1 className="text-2xl font-semibold text-white">Terms of Service</h1>
        <p className="mt-3 text-sm leading-6 text-white/70">
          This is a play‑money prototype for testing and entertainment. By using the site, you agree to these terms.
        </p>

        <h2 className="mt-8 text-lg font-semibold text-white">No real money</h2>
        <p className="mt-3 text-sm leading-6 text-white/70">
          The app does not support real-money gambling. Any balances, chips, or “credits” are simulated and have no cash value.
        </p>

        <h2 className="mt-8 text-lg font-semibold text-white">Discord Activity</h2>
        <p className="mt-3 text-sm leading-6 text-white/70">
          If you use the Discord Activity version, your Discord account identity may be used to create an in-app profile and to
          display your username to other players in the same call/table.
        </p>

        <h2 className="mt-8 text-lg font-semibold text-white">Acceptable use</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-white/70">
          <li>No harassment, hate speech, or disruptive behavior.</li>
          <li>No attempts to exploit, reverse engineer, or abuse the service.</li>
          <li>We may remove users or reset data at any time to keep the prototype stable.</li>
        </ul>

        <h2 className="mt-8 text-lg font-semibold text-white">Availability</h2>
        <p className="mt-3 text-sm leading-6 text-white/70">
          The service is provided “as is” without warranties. Features may change or break, and data may be wiped without notice.
        </p>
      </div>
    </div>
  );
}

