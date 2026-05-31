"use client";

import { useEffect, useState } from "react";

export type GameConfig = {
  diceHouseEdge: number;
  slotsPayoutScale: number;
};

const DEFAULT: GameConfig = {
  diceHouseEdge: 0.01,
  slotsPayoutScale: 1.0,
};

export function useGameConfig() {
  const [config, setConfig] = useState<GameConfig>(DEFAULT);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/config", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { config: GameConfig };
        if (data?.config) setConfig({ ...DEFAULT, ...data.config });
      } catch {
        // ignore
      }
    })();
  }, []);

  return config;
}

