"use client";

import { useMemo } from "react";
import { colorOf, EUROPEAN_ORDER } from "./rouletteMath";

function pocketColor(n: number) {
  const c = colorOf(n);
  if (c === "green") return "rgba(16,185,129,.9)";
  if (c === "red") return "rgba(244,63,94,.9)";
  return "rgba(24,24,27,.9)";
}

function degToRad(d: number) {
  return (d * Math.PI) / 180;
}

function round3(n: number) {
  return Number(n.toFixed(3));
}

export function RouletteWheel(props: {
  spinning: boolean;
  wheelRotationDeg: number; // absolute rotation
  landedNumber: number | null;
}) {
  const { spinning, wheelRotationDeg, landedNumber } = props;

  const pockets = useMemo(() => EUROPEAN_ORDER, []);
  const size = 320;
  const cx = size / 2;
  const cy = size / 2;
  const rOuter = 150;
  const rInner = 108;
  const rLabel = 126;

  const pocketAngle = 360 / pockets.length;

  // Ball: fixed in viewport and we "drop" it after spin.
  const ballAngle = useMemo(() => {
    if (landedNumber == null) return -90;
    const idx = pockets.indexOf(landedNumber);
    const centerAngle = -90 + idx * pocketAngle + pocketAngle / 2;
    return centerAngle;
  }, [landedNumber, pockets, pocketAngle]);

  return (
    <div className="glass glass-shine rounded-3xl p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-white">Wheel</p>
        <p className="text-xs text-white/55">
          {spinning ? "Spinning…" : landedNumber != null ? `Landed: ${landedNumber}` : "—"}
        </p>
      </div>

      <div className="mt-3 flex items-center justify-center">
        <div className="relative">
          {/* Ball */}
          <div
            className={`absolute left-1/2 top-1/2 z-20 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0_10px_30px_rgba(0,0,0,.6)] ${
              spinning ? "opacity-70" : "opacity-100"
            } ${spinning ? "animate-[ballOrbit_0.9s_linear_infinite]" : "animate-[ballDrop_.28s_ease-out]"}`}
            style={
              spinning
                ? {}
                : {
                    transform: `translate(-50%, -50%) rotate(${ballAngle}deg) translateY(-${rLabel + 18}px)`,
                  }
            }
          />

          <svg
            width={size}
            height={size}
            viewBox={`0 0 ${size} ${size}`}
            className="drop-shadow-[0_20px_60px_rgba(0,0,0,.55)]"
          >
            <defs>
              <radialGradient id="rim" cx="50%" cy="50%" r="60%">
                <stop offset="0%" stopColor="rgba(255,255,255,.12)" />
                <stop offset="65%" stopColor="rgba(255,255,255,.04)" />
                <stop offset="100%" stopColor="rgba(0,0,0,.45)" />
              </radialGradient>
            </defs>

            <g
              style={{
                transformOrigin: `${cx}px ${cy}px`,
                transform: `rotate(${wheelRotationDeg}deg)`,
                transition: spinning ? "transform 2.8s cubic-bezier(.12,.86,.2,1)" : "transform 400ms ease-out",
              }}
            >
              {/* Rim */}
              <circle cx={cx} cy={cy} r={rOuter + 10} fill="url(#rim)" />

              {/* Pockets */}
              {pockets.map((n, idx) => {
                const start = -90 + idx * pocketAngle;
                const end = start + pocketAngle;
                const a0 = degToRad(start);
                const a1 = degToRad(end);
                const x0 = round3(cx + rOuter * Math.cos(a0));
                const y0 = round3(cy + rOuter * Math.sin(a0));
                const x1 = round3(cx + rOuter * Math.cos(a1));
                const y1 = round3(cy + rOuter * Math.sin(a1));
                const x2 = round3(cx + rInner * Math.cos(a1));
                const y2 = round3(cy + rInner * Math.sin(a1));
                const x3 = round3(cx + rInner * Math.cos(a0));
                const y3 = round3(cy + rInner * Math.sin(a0));
                const largeArc = pocketAngle > 180 ? 1 : 0;
                const d = [
                  `M ${x0} ${y0}`,
                  `A ${rOuter} ${rOuter} 0 ${largeArc} 1 ${x1} ${y1}`,
                  `L ${x2} ${y2}`,
                  `A ${rInner} ${rInner} 0 ${largeArc} 0 ${x3} ${y3}`,
                  "Z",
                ].join(" ");

                const mid = start + pocketAngle / 2;
                const am = degToRad(mid);
                const lx = round3(cx + rLabel * Math.cos(am));
                const ly = round3(cy + rLabel * Math.sin(am));
                const rot = round3(mid + 90);

                return (
                  <g key={n}>
                    <path d={d} fill={pocketColor(n)} stroke="rgba(255,255,255,.08)" />
                    <text
                      x={lx}
                      y={ly}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fontSize="12"
                      fill="rgba(255,255,255,.92)"
                      style={{
                        transformOrigin: `${lx}px ${ly}px`,
                        transform: `rotate(${rot}deg)`,
                        fontWeight: 700,
                      }}
                    >
                      {n}
                    </text>
                  </g>
                );
              })}

              {/* Hub */}
              <circle cx={cx} cy={cy} r={58} fill="rgba(255,255,255,.08)" stroke="rgba(255,255,255,.12)" />
              <circle cx={cx} cy={cy} r={34} fill="rgba(0,0,0,.35)" stroke="rgba(255,255,255,.10)" />
            </g>
          </svg>
        </div>
      </div>
    </div>
  );
}
