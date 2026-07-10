"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type ZoneTarget = "discord-mobile" | "discord-desktop" | "standalone";

export const Z = {
  cards: 5,
  panel: 10,
  topbar: 20,
  menu: 30,
  toast: 40,
  modalScrim: 50,
  modalPanel: 55,
  dock: 60,
  topzone: 70,
  bigwin: 80,
} as const;

export const TOUCH_TARGET_PX = 44;
export const NARROW_BREAKPOINT_PX = 540;

export type ZoneInfo = {
  target: ZoneTarget;
  isDiscord: boolean;
  isIframe: boolean;
  isTouch: boolean;
  isNarrow: boolean;
  width: number;
  height: number;
  ready: boolean;
};

const ZoneContext = createContext<ZoneInfo>({
  target: "standalone",
  isDiscord: false,
  isIframe: false,
  isTouch: false,
  isNarrow: false,
  width: 1280,
  height: 720,
  ready: false,
});

function detectDiscord(): boolean {
  if (typeof document === "undefined") return false;
  const ref = document.referrer || "";
  return /discord\.com|discordapp\.com|discordsrv/i.test(ref);
}

function detectTarget(isDiscord: boolean, isIframe: boolean, width: number): ZoneTarget {
  if (isDiscord && isIframe) {
    return width <= NARROW_BREAKPOINT_PX ? "discord-mobile" : "discord-desktop";
  }
  return "standalone";
}

export function ZoneProvider({ children }: { children: ReactNode }) {
  const [info, setInfo] = useState<ZoneInfo>({
    target: "standalone",
    isDiscord: false,
    isIframe: false,
    isTouch: false,
    isNarrow: false,
    width: 1280,
    height: 720,
    ready: false,
  });

  useEffect(() => {
    const compute = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const isIframe = window.self !== window.top;
      const isDiscord = detectDiscord();
      const isTouch =
        "ontouchstart" in window || (navigator.maxTouchPoints ?? 0) > 0 || window.matchMedia("(pointer: coarse)").matches;
      const isNarrow = width <= NARROW_BREAKPOINT_PX;
      setInfo({
        target: detectTarget(isDiscord, isIframe, width),
        isDiscord,
        isIframe,
        isTouch,
        isNarrow,
        width,
        height,
        ready: true,
      });
    };
    compute();
    window.addEventListener("resize", compute);
    return () => window.removeEventListener("resize", compute);
  }, []);

  return <ZoneContext.Provider value={info}>{children}</ZoneContext.Provider>;
}

export function useZone(): ZoneInfo {
  return useContext(ZoneContext);
}

export function useResponsiveClass(): {
  containerPad: string;
  shellMaxWidth: string;
  fontScale: number;
} {
  const z = useZone();
  return useMemo(() => {
    if (z.target === "discord-mobile") {
      return { containerPad: "px-2 pb-28 pt-2", shellMaxWidth: "max-w-full", fontScale: 0.92 };
    }
    if (z.target === "discord-desktop") {
      return { containerPad: "px-3 pb-24 pt-3", shellMaxWidth: "max-w-5xl", fontScale: 0.96 };
    }
    return { containerPad: "px-4 pb-20 pt-4 sm:px-6", shellMaxWidth: "max-w-6xl", fontScale: 1 };
  }, [z.target]);
}
