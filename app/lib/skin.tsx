"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type UiSkin = "glass" | "cartoon";

const STORAGE_KEY = "lgc.uiSkin";

type SkinContextValue = {
  skin: UiSkin;
  setSkin: (skin: UiSkin) => void;
};

const SkinContext = createContext<SkinContextValue | null>(null);

function applySkinToDocument(skin: UiSkin) {
  try {
    document.documentElement.dataset.lgcSkin = skin;
  } catch {
    // ignore
  }
}

function readStoredSkin(): UiSkin | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "glass" || v === "cartoon") return v;
    return null;
  } catch {
    return null;
  }
}

export function SkinProvider({ children }: { children: React.ReactNode }) {
  const [skin, setSkinState] = useState<UiSkin>("glass");

  useEffect(() => {
    const stored = readStoredSkin();
    const initial: UiSkin = stored ?? "glass";
    setSkinState(initial);
    applySkinToDocument(initial);
  }, []);

  const setSkin = useCallback((next: UiSkin) => {
    setSkinState(next);
    applySkinToDocument(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore
    }
    try {
      window.dispatchEvent(new CustomEvent("lgc:skin", { detail: { skin: next } }));
    } catch {
      // ignore
    }
  }, []);

  const value = useMemo(() => ({ skin, setSkin }), [skin, setSkin]);

  return <SkinContext.Provider value={value}>{children}</SkinContext.Provider>;
}

export function useSkin() {
  const ctx = useContext(SkinContext);
  if (!ctx) {
    // Fallback for edge cases (e.g. if used outside provider).
    return { skin: "glass" as UiSkin, setSkin: (_: UiSkin) => {} };
  }
  return ctx;
}

