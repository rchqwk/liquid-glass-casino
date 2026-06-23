"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type UiScale = 100 | 125 | 150 | 175;

const STORAGE_KEY = "lgc.uiScale";

type UiScaleContextValue = {
  uiScale: UiScale;
  setUiScale: (scale: UiScale) => void;
};

const UiScaleContext = createContext<UiScaleContextValue | null>(null);

function applyScaleToDocument(scale: UiScale) {
  try {
    document.documentElement.dataset.lgcUiScale = String(scale);
    document.documentElement.style.setProperty("--lgc-ui-scale", String(scale / 100));
  } catch {
    // ignore
  }
}

function readStoredScale(): UiScale | null {
  try {
    const raw = Number(localStorage.getItem(STORAGE_KEY) ?? "");
    if (raw === 100 || raw === 125 || raw === 150 || raw === 175) return raw as UiScale;
    return null;
  } catch {
    return null;
  }
}

export function UiScaleProvider({ children }: { children: React.ReactNode }) {
  const [uiScale, setUiScaleState] = useState<UiScale>(150);

  useEffect(() => {
    const stored = readStoredScale();
    const initial: UiScale = stored ?? 150;
    setUiScaleState(initial);
    applyScaleToDocument(initial);
  }, []);

  const setUiScale = useCallback((next: UiScale) => {
    setUiScaleState(next);
    applyScaleToDocument(next);
    try {
      localStorage.setItem(STORAGE_KEY, String(next));
    } catch {
      // ignore
    }
  }, []);

  const value = useMemo(() => ({ uiScale, setUiScale }), [uiScale, setUiScale]);

  return <UiScaleContext.Provider value={value}>{children}</UiScaleContext.Provider>;
}

export function useUiScale() {
  const ctx = useContext(UiScaleContext);
  if (!ctx) return { uiScale: 150 as UiScale, setUiScale: (_: UiScale) => {} };
  return ctx;
}

