"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type UiLayoutMode = "standard" | "horizontal";

const STORAGE_KEY = "lgc.uiLayout";

type UiLayoutContextValue = {
  layout: UiLayoutMode;
  setLayout: (layout: UiLayoutMode) => void;
};

const UiLayoutContext = createContext<UiLayoutContextValue | null>(null);

function applyLayoutToDocument(layout: UiLayoutMode) {
  try {
    document.documentElement.dataset.lgcLayout = layout;
  } catch {
    // ignore
  }
}

function readStoredLayout(): UiLayoutMode | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "standard" || v === "horizontal") return v;
    return null;
  } catch {
    return null;
  }
}

export function UiLayoutProvider({ children }: { children: React.ReactNode }) {
  const [layout, setLayoutState] = useState<UiLayoutMode>("standard");

  useEffect(() => {
    const stored = readStoredLayout();
    const initial: UiLayoutMode = stored ?? "standard";
    setLayoutState(initial);
    applyLayoutToDocument(initial);
  }, []);

  const setLayout = useCallback((next: UiLayoutMode) => {
    setLayoutState(next);
    applyLayoutToDocument(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore
    }
    try {
      window.dispatchEvent(new CustomEvent("lgc:uiLayout", { detail: { layout: next } }));
    } catch {
      // ignore
    }
  }, []);

  const value = useMemo(() => ({ layout, setLayout }), [layout, setLayout]);

  return <UiLayoutContext.Provider value={value}>{children}</UiLayoutContext.Provider>;
}

export function useUiLayout() {
  const ctx = useContext(UiLayoutContext);
  if (!ctx) return { layout: "standard" as UiLayoutMode, setLayout: (_: UiLayoutMode) => {} };
  return ctx;
}

