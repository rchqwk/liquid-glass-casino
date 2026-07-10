"use client";

type Suit = "♠" | "♥" | "♦" | "♣";
type Card = { rank: string; suit: Suit; value: number };

const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

export function cardFromIndex(i: number): Card {
  const r = i % 13;
  const suitIdx = Math.floor(i / 13) % 4;
  const suit = (["♠", "♥", "♦", "♣"] as const)[suitIdx]!;
  const rank = RANKS[r]!;
  if (rank === "A") return { rank, suit, value: 1 };
  if (rank === "J" || rank === "Q" || rank === "K") return { rank, suit, value: 10 };
  return { rank, suit, value: Number(rank) };
}

export function handValue(cards: number[], bonusPoints = 0) {
  let total = 0;
  let aces = 0;
  for (const idx of cards) {
    const c = cardFromIndex(idx);
    if (c.rank === "A") aces += 1;
    else total += c.value;
  }
  total += aces;
  let soft = false;
  if (aces > 0 && total + 10 <= 21) {
    total += 10;
    soft = true;
  }
  total += bonusPoints;
  return { total, soft };
}

export function PowerupStickerIcon({ id, className }: { id: string; className?: string }) {
  const base = `lgc-powerup-icon inline-block h-[14px] w-[14px] ${className ?? ""}`;

  const common = {
    className: base,
    viewBox: "0 0 24 24",
    fill: "none" as const,
    stroke: "currentColor",
    strokeWidth: 2.25,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  if (id === "PEEK_NEXT") {
    return (
      <svg {...common}>
        <path d="M2.5 12s3.7-6.8 9.5-6.8S21.5 12 21.5 12s-3.7 6.8-9.5 6.8S2.5 12 2.5 12Z" />
        <path d="M14.7 12a2.7 2.7 0 1 1-5.4 0 2.7 2.7 0 0 1 5.4 0Z" />
        <path d="M18 6.8 21.5 3.3" />
      </svg>
    );
  }

  if (id === "BJ_PROTECTOR") {
    return (
      <svg {...common}>
        <path d="M12 2.8 19.2 6v6.2c0 4.6-3.2 7.7-7.2 9-4-1.3-7.2-4.4-7.2-9V6L12 2.8Z" />
        <path d="M9.3 12.2 11.4 14.3 15.9 9.7" />
      </svg>
    );
  }

  if (id === "SWAP_ONE") {
    return (
      <svg {...common}>
        <path d="M7 7h10" />
        <path d="M15 4l2.8 3L15 10" />
        <path d="M17 17H7" />
        <path d="M9 20l-2.8-3L9 14" />
      </svg>
    );
  }

  if (id === "FREE_SPLIT") {
    return (
      <svg {...common}>
        <path d="M6.2 6.2h5.4v5.4H6.2z" />
        <path d="M12.4 12.4h5.4v5.4h-5.4z" />
        <path d="M11.6 11.6 15 8.2" />
      </svg>
    );
  }

  if (id === "DOUBLE_PAYOUT") {
    return (
      <svg {...common}>
        <path d="M6.5 9.5c1.2-1.8 3-2.7 5.5-2.7 2.7 0 4.7 1.1 5.7 3.2" />
        <path d="M6 15.6c1.3 1.2 3.1 1.8 5.4 1.8 2.6 0 4.6-.9 6-2.8" />
        <path d="M7.2 12h9.6" />
      </svg>
    );
  }

  if (id === "REMOVE_RANDOM_SELF") {
    return (
      <svg {...common}>
        <path d="M4.2 12.2 12 3.8l7.8 8.4-7.8 8.4-7.8-8.4Z" />
        <path d="M9.3 9.6h.01" />
        <path d="M14.7 9.6h.01" />
        <path d="M12 14.4h.01" />
      </svg>
    );
  }

  if (id === "REMOVE_CARD_SELF") {
    return (
      <svg {...common}>
        <path d="M7.2 6.2h9.6v11.6H7.2z" />
        <path d="M9 10.2h.01" />
        <path d="M11.9 10.2h.01" />
        <path d="M14.8 10.2h.01" />
        <path d="M18.8 5.2l2 2" />
      </svg>
    );
  }

  if (id === "DEALER_SECOND_CHANCE") {
    return (
      <svg {...common}>
        <path d="M6.2 9.2a6.8 6.8 0 0 1 11.8 2.8" />
        <path d="M17.8 14.8a6.8 6.8 0 0 1-11.8-2.8" />
        <path d="M6 5.8v3.8h3.8" />
        <path d="M18 18.2v-3.8h-3.8" />
      </svg>
    );
  }

  if (id.startsWith("SUB")) {
    return (
      <svg {...common}>
        <path d="M6 12h12" />
      </svg>
    );
  }

  if (id.startsWith("ADD")) {
    return (
      <svg {...common}>
        <path d="M12 6v12" />
        <path d="M6 12h12" />
      </svg>
    );
  }

  if (id.startsWith("MAGIC_") || id.includes("_MAGIC")) {
    return (
      <svg {...common}>
        <path d="M12 3.4 13.8 8.7 19.4 8.7 14.8 12 16.6 17.4 12 14.2 7.4 17.4 9.2 12 4.6 8.7 10.2 8.7 12 3.4Z" />
      </svg>
    );
  }

  if (id.startsWith("MYTHIC_")) {
    return (
      <svg {...common}>
        <path d="M8 8h9v9H8z" />
        <path d="M6.5 6.5h9v9" />
      </svg>
    );
  }

  return null;
}

export function CardView({ idx, hidden, dealing, winning }: { idx: number; hidden?: boolean; dealing?: boolean; winning?: boolean }) {
  if (idx < 0 || hidden) {
    return (
      <div
        className={`nn-card-playing nn-card-back ${dealing ? "nn-card-dealing" : ""}`}
        style={{ boxShadow: "0 8px 24px rgba(0,0,0,0.4)" }}
      />
    );
  }
  const c = cardFromIndex(idx);
  const isRed = c.suit === "♥" || c.suit === "♦";
  const colorClass = isRed ? "nn-card-red" : "nn-card-black";
  return (
    <div
      className={`nn-card-playing ${colorClass} ${dealing ? "nn-card-dealing" : ""} ${winning ? "nn-card-winning" : ""}`}
    >
      <div className="nn-card-rank-top">
        {c.rank}
        <div className="nn-card-suit-top">{c.suit}</div>
      </div>
      <div className="nn-card-suit-center">{c.suit}</div>
      <div className="nn-card-rank-bottom">
        {c.rank}
        <div className="nn-card-suit-bottom">{c.suit}</div>
      </div>
    </div>
  );
}

const MAGNITUDES = [
  { suffix: "", name: "", threshold: 1e3 },
  { suffix: "K", name: "Thousand", threshold: 1e6 },
  { suffix: "M", name: "Million", threshold: 1e9 },
  { suffix: "B", name: "Billion", threshold: 1e12 },
  { suffix: "T", name: "Trillion", threshold: 1e15 },
  { suffix: "Qa", name: "Quadrillion", threshold: 1e18 },
  { suffix: "Qi", name: "Quintillion", threshold: 1e21 },
  { suffix: "Sx", name: "Sextillion", threshold: 1e24 },
  { suffix: "Sp", name: "Septillion", threshold: 1e27 },
  { suffix: "Oc", name: "Octillion", threshold: 1e30 },
  { suffix: "No", name: "Nonillion", threshold: 1e33 },
  { suffix: "Dc", name: "Decillion", threshold: 1e36 },
  { suffix: "UDc", name: "Undecillion", threshold: 1e39 },
  { suffix: "DDc", name: "Duodecillion", threshold: 1e42 },
  { suffix: "TDc", name: "Tredecillion", threshold: 1e45 },
  { suffix: "QaDc", name: "Quattuordecillion", threshold: 1e48 },
  { suffix: "QiDc", name: "Quindecillion", threshold: 1e51 },
  { suffix: "SxDc", name: "Sexdecillion", threshold: 1e54 },
  { suffix: "SpDc", name: "Septendecillion", threshold: 1e57 },
  { suffix: "OcDc", name: "Octodecillion", threshold: 1e60 },
  { suffix: "NoDc", name: "Novemdecillion", threshold: 1e63 },
  { suffix: "Vg", name: "Vigintillion", threshold: Infinity },
];

function abbreviateValue(value: number): { display: string; suffix: string; magnitude: string; percentage: number; exact: string } {
  if (value < 1000) {
    return {
      display: value.toFixed(value % 1 === 0 ? 0 : 2),
      suffix: "",
      magnitude: "",
      percentage: Math.min(100, value),
      exact: value.toLocaleString(),
    };
  }
  
  let mag = MAGNITUDES[0]!;
  for (const m of MAGNITUDES) {
    if (value < m.threshold) break;
    mag = m;
  }
  
  const divisor = mag.threshold / 1000;
  const normalized = value / divisor;
  const displayValue = normalized.toFixed(2);
  const prefixNum = parseFloat(displayValue);
  const percentage = Math.min(100, (prefixNum / 100) * 100);
  
  return {
    display: displayValue,
    suffix: mag.suffix,
    magnitude: mag.name,
    percentage,
    exact: value.toLocaleString(),
  };
}

function getMagnitudeClass(suffix: string): string {
  const map: Record<string, string> = {
    "": "nn-chip-1",
    K: "nn-chip-k",
    M: "nn-chip-m",
    B: "nn-chip-b",
    T: "nn-chip-t",
    Qa: "nn-chip-qa",
    Qi: "nn-chip-qi",
    Sx: "nn-chip-sx",
    Sp: "nn-chip-sp",
    Oc: "nn-chip-oc",
    No: "nn-chip-no",
    Dc: "nn-chip-dc",
    UDc: "nn-chip-udc",
    DDc: "nn-chip-ddc",
    TDc: "nn-chip-tdc",
    QaDc: "nn-chip-qadc",
    QiDc: "nn-chip-qidc",
    SxDc: "nn-chip-sxdc",
    SpDc: "nn-chip-spdc",
    OcDc: "nn-chip-ocdc",
    NoDc: "nn-chip-nodc",
    Vg: "nn-chip-vg",
  };
  return map[suffix] ?? "nn-chip-1";
}

export function ChipView({ amount, size = "md" }: { amount: number; size?: "sm" | "md" | "lg" }) {
  const getDenomination = (amt: number): string => {
    if (amt >= 500) return "500";
    if (amt >= 100) return "100";
    if (amt >= 50) return "50";
    if (amt >= 25) return "25";
    if (amt >= 10) return "10";
    if (amt >= 5) return "5";
    return "1";
  };
  const getChipClass = (denom: string): string => {
    const map: Record<string, string> = {
      "1": "nn-chip-1",
      "5": "nn-chip-5",
      "10": "nn-chip-10",
      "25": "nn-chip-25",
      "50": "nn-chip-50",
      "100": "nn-chip-100",
      "500": "nn-chip-500",
    };
    return map[denom] ?? "nn-chip-1";
  };
  const denom = getDenomination(amount);
  const sizeClass = size === "sm" ? "nn-chip-sm" : size === "lg" ? "nn-chip-lg" : "";
  return (
    <div
      className={`nn-chip ${getChipClass(denom)} ${sizeClass}`}
      title={`${amount} chips`}
    >
      {denom}
    </div>
  );
}

export function StackedChipView({ 
  value, 
  showExact = false, 
  size = "md",
  className = ""
}: { 
  value: number; 
  showExact?: boolean; 
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const { display, suffix, magnitude, percentage, exact } = abbreviateValue(value);
  const magnitudeClass = getMagnitudeClass(suffix);
  const sizeMultiplier = size === "sm" ? 0.75 : size === "lg" ? 1.25 : 1;
  const chipSize = Math.round(52 * sizeMultiplier);
  const stackHeight = Math.round(percentage * 0.6);
  
  const parts = display.split(".");
  const whole = parts[0]!;
  const decimal = parts[1] ?? "00";
  
  return (
    <div 
      className={`nn-chip-container ${className}`}
      title={`${exact} chips${magnitude ? ` (${magnitude})` : ""}`}
    >
      <div 
        className="nn-chip-stack"
        style={{ 
          width: chipSize,
          minHeight: chipSize + stackHeight,
        }}
      >
        <div 
          className="nn-chip-stack-base"
          style={{
            width: chipSize,
            height: chipSize,
          }}
        />
        
        <div
          className="nn-chip-stack-fill"
          style={{
            height: `${percentage}%`,
            maxHeight: chipSize - 8,
          }}
        />
        
        <div 
          className={`nn-chip-stack-chip ${magnitudeClass}`}
          style={{
            width: chipSize,
            height: chipSize,
            marginTop: -stackHeight,
          }}
        >
          <div 
            className="nn-chip-stack-value"
            style={{ fontSize: Math.round(15 * sizeMultiplier) }}
          >
            {whole}
            {suffix && <span className="nn-chip-stack-magnitude">{suffix}</span>}
          </div>
          {Number(decimal) > 0 && (
            <div 
              className="nn-chip-stack-decimal"
              style={{ fontSize: Math.round(9 * sizeMultiplier) }}
            >
              .{decimal}
            </div>
          )}
        </div>
      </div>
      
      {showExact && (
        <div className="nn-chip-exact" style={{ fontSize: Math.round(10 * sizeMultiplier) }}>
          {exact}
        </div>
      )}
    </div>
  );
}
