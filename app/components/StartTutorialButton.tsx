"use client";

export function StartTutorialButton() {
  return (
    <button
      type="button"
      className="glass-soft inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-medium text-white/80 transition hover:bg-white/10"
      onClick={() => {
        try {
          sessionStorage.setItem("lgc.tour.active", "1");
          sessionStorage.setItem("lgc.tour.step", "0");
        } catch {
          // ignore
        }
        window.location.href = "/casino/blackjack";
      }}
    >
      Are you new here? Take the tutorial
    </button>
  );
}

