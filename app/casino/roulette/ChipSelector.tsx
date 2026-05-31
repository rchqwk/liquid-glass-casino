"use client";

const CHIPS = [1, 5, 10, 25, 100, 250] as const;

function chipColor(v: number) {
  if (v <= 1) return "from-white/70 to-white/20 text-zinc-900";
  if (v <= 5) return "from-emerald-300/80 to-emerald-600/50 text-emerald-950";
  if (v <= 10) return "from-sky-300/80 to-sky-600/55 text-sky-950";
  if (v <= 25) return "from-violet-300/80 to-violet-700/55 text-violet-950";
  if (v <= 100) return "from-amber-300/80 to-amber-700/55 text-amber-950";
  return "from-rose-300/80 to-rose-700/55 text-rose-950";
}

export function ChipSelector(props: {
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="glass-soft glass-shine rounded-3xl p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-white">Chips</p>
        <p className="text-xs text-white/55">Pick a chip, then tap the board</p>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {CHIPS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => props.onChange(c)}
            className={`relative h-12 w-12 rounded-full border border-white/15 bg-gradient-to-br ${chipColor(
              c,
            )} shadow-[0_10px_30px_rgba(0,0,0,.35)] transition ${
              props.value === c
                ? "ring-2 ring-white/50 scale-[1.02]"
                : "hover:scale-[1.02]"
            }`}
            title={`${c}`}
          >
            <span className="text-xs font-extrabold">{c}</span>
            <span className="absolute inset-1 rounded-full border border-dashed border-black/10" />
          </button>
        ))}
      </div>
    </div>
  );
}

