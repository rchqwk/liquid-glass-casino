"use client";

// Inline sprite for iOS Safari compatibility.
// Safari can fail to render external <use href="/file.svg#id"> references.
// By inlining the symbols, we can reference them as <use href="#id" /> reliably.

export function Slots5x5Sprite() {
  return (
    <svg
      aria-hidden="true"
      width="0"
      height="0"
      style={{ position: "absolute", width: 0, height: 0, overflow: "hidden" }}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
    >
      <defs>
        <linearGradient id="g-red" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#ff6b6b" />
          <stop offset="1" stopColor="#c81d25" />
        </linearGradient>
        <linearGradient id="g-yellow" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#ffe66d" />
          <stop offset="1" stopColor="#f0b429" />
        </linearGradient>
        <linearGradient id="g-blue" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#b8f2ff" />
          <stop offset="1" stopColor="#3aa6ff" />
        </linearGradient>
        <linearGradient id="g-gold" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#ffe7a3" />
          <stop offset="1" stopColor="#d9a441" />
        </linearGradient>
        <filter id="softShadow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#000" floodOpacity="0.35" />
        </filter>
      </defs>

      <symbol id="cherry" viewBox="0 0 64 64">
        <g filter="url(#softShadow)">
          <path d="M33 12c9 3 14 10 15 18" fill="none" stroke="#2e7d32" strokeWidth="5" strokeLinecap="round" />
          <path d="M33 12c-6 4-10 10-12 18" fill="none" stroke="#2e7d32" strokeWidth="5" strokeLinecap="round" />
          <circle cx="22" cy="38" r="12" fill="url(#g-red)" stroke="#ffffff" strokeOpacity=".18" strokeWidth="2" />
          <circle cx="42" cy="38" r="12" fill="url(#g-red)" stroke="#ffffff" strokeOpacity=".18" strokeWidth="2" />
          <path d="M24 24c-3-5-2-9 1-12" fill="none" stroke="#2e7d32" strokeWidth="5" strokeLinecap="round" />
          <path d="M40 24c3-5 2-9-1-12" fill="none" stroke="#2e7d32" strokeWidth="5" strokeLinecap="round" />
          <path d="M30 16c6-6 12-6 18-2" fill="none" stroke="#43a047" strokeWidth="5" strokeLinecap="round" />
          <circle cx="18" cy="34" r="3" fill="#fff" opacity=".25" />
          <circle cx="38" cy="34" r="3" fill="#fff" opacity=".25" />
        </g>
      </symbol>

      <symbol id="lemon" viewBox="0 0 64 64">
        <g filter="url(#softShadow)">
          <path d="M18 30c0-10 8-18 18-18h3c5 0 9 4 9 9v3c0 10-8 18-18 18h-3c-5 0-9-4-9-9v-3z" fill="url(#g-yellow)" stroke="#ffffff" strokeOpacity=".18" strokeWidth="2" />
          <path d="M22 30c0-8 6-14 14-14h2c4 0 7 3 7 7v2c0 8-6 14-14 14h-2c-4 0-7-3-7-7v-2z" fill="none" stroke="#fff" opacity=".14" strokeWidth="2" />
          <path d="M44 14c6 1 10 5 12 10" fill="none" stroke="#2e7d32" strokeWidth="4" strokeLinecap="round" />
          <path d="M52 10c3 2 5 4 6 7" fill="none" stroke="#43a047" strokeWidth="4" strokeLinecap="round" />
        </g>
      </symbol>

      <symbol id="bell" viewBox="0 0 64 64">
        <g filter="url(#softShadow)">
          <path d="M20 28c0-10 6-16 12-16s12 6 12 16v10c0 4 2 6 4 8H16c2-2 4-4 4-8V28z" fill="url(#g-gold)" stroke="#ffffff" strokeOpacity=".18" strokeWidth="2" />
          <path d="M26 48c1 5 4 8 6 8s5-3 6-8" fill="#c27b00" opacity=".35" />
          <rect x="24" y="10" width="16" height="8" rx="4" fill="#f7c948" />
          <circle cx="32" cy="48" r="4" fill="#f0b429" />
        </g>
      </symbol>

      <symbol id="star" viewBox="0 0 64 64">
        <g filter="url(#softShadow)">
          <path d="M32 10l6.8 14.2 15.2 2.2-11 10.7 2.6 15.1L32 44.6 18.4 52.2 21 37.1 10 26.4l15.2-2.2L32 10z" fill="url(#g-blue)" stroke="#ffffff" strokeOpacity=".18" strokeWidth="2" />
          <path d="M32 16l4.7 9.8 10.5 1.5-7.6 7.4 1.8 10.5L32 40l-9.4 5.2 1.8-10.5-7.6-7.4 10.5-1.5L32 16z" fill="#fff" opacity=".12" />
        </g>
      </symbol>

      <symbol id="seven" viewBox="0 0 64 64">
        <g filter="url(#softShadow)">
          <rect x="10" y="10" width="44" height="44" rx="10" fill="#111827" stroke="#ffffff" strokeOpacity=".15" strokeWidth="2" />
          <path d="M20 18h24v8L30 50h-9l15-24H20v-8z" fill="#ff4d4d" />
          <path d="M20 18h24v8H28" fill="none" stroke="#fff" opacity=".2" strokeWidth="2" />
        </g>
      </symbol>

      <symbol id="diamond" viewBox="0 0 64 64">
        <g filter="url(#softShadow)">
          <path d="M32 8l18 20-18 28L14 28 32 8z" fill="#7c3aed" stroke="#ffffff" strokeOpacity=".18" strokeWidth="2" />
          <path d="M32 8l10 20-10 28-10-28L32 8z" fill="#fff" opacity=".10" />
          <path d="M32 8l18 20H14L32 8z" fill="#fff" opacity=".12" />
        </g>
      </symbol>

      <symbol id="coin" viewBox="0 0 64 64">
        <g filter="url(#softShadow)">
          <circle cx="32" cy="32" r="20" fill="url(#g-gold)" stroke="#ffffff" strokeOpacity=".18" strokeWidth="2" />
          <circle cx="32" cy="32" r="14" fill="none" stroke="#ffffff" opacity=".18" strokeWidth="2" />
          <path d="M32 20v24" stroke="#fff" opacity=".16" strokeWidth="3" strokeLinecap="round" />
          <path d="M24 26c4-4 12-4 16 0" stroke="#fff" opacity=".16" strokeWidth="3" strokeLinecap="round" />
        </g>
      </symbol>

      <symbol id="bar" viewBox="0 0 64 64">
        <g filter="url(#softShadow)">
          <rect x="10" y="20" width="44" height="24" rx="8" fill="#0f172a" stroke="#ffffff" strokeOpacity=".15" strokeWidth="2" />
          <rect x="16" y="26" width="32" height="12" rx="6" fill="#e2e8f0" opacity=".2" />
          <path d="M18 36h28" stroke="#fff" opacity=".18" strokeWidth="3" strokeLinecap="round" />
        </g>
      </symbol>
    </svg>
  );
}

