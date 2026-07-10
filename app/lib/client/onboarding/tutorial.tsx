"use client";

import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";

export interface TutorialStep {
  id: string;
  title: string;
  content: ReactNode;
  target?: string;
  position?: "top" | "bottom" | "left" | "right" | "center";
  action?: "click" | "hover" | "none";
  beforeEnter?: () => Promise<void> | void;
}

export interface TutorialConfig {
  id: string;
  name: string;
  steps: TutorialStep[];
  skippable?: boolean;
  persistKey?: string;
}

export function useTutorial(config: TutorialConfig) {
  const [active, setActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [completed, setCompleted] = useState(false);
  const startedRef = useRef(false);

  const persistKey = config.persistKey ?? `tutorial_${config.id}_completed`;

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem(persistKey);
    if (stored === "true") {
      setCompleted(true);
    }
  }, [persistKey]);

  const start = useCallback(() => {
    if (completed) return;
    startedRef.current = true;
    setStepIndex(0);
    setActive(true);
  }, [completed]);

  const next = useCallback(async () => {
    const step = config.steps[stepIndex];
    if (step?.beforeEnter) {
      await step.beforeEnter();
    }
    if (stepIndex < config.steps.length - 1) {
      setStepIndex((i) => i + 1);
    } else {
      finish();
    }
  }, [stepIndex, config.steps]);

  const back = useCallback(() => {
    if (stepIndex > 0) {
      setStepIndex((i) => i - 1);
    }
  }, [stepIndex]);

  const skip = useCallback(() => {
    finish();
  }, []);

  const finish = useCallback(() => {
    setActive(false);
    setCompleted(true);
    if (typeof window !== "undefined") {
      localStorage.setItem(persistKey, "true");
    }
  }, [persistKey]);

  const reset = useCallback(() => {
    setCompleted(false);
    setStepIndex(0);
    if (typeof window !== "undefined") {
      localStorage.removeItem(persistKey);
    }
  }, [persistKey]);

  const currentStep = config.steps[stepIndex] ?? null;

  return {
    active,
    stepIndex,
    currentStep,
    completed,
    start,
    next,
    back,
    skip,
    reset,
    progress: stepIndex + 1,
    total: config.steps.length,
    skippable: config.skippable ?? true,
  };
}

export function TutorialOverlay({
  step,
  progress,
  total,
  skippable,
  onNext,
  onBack,
  onSkip,
}: {
  step: TutorialStep;
  progress: number;
  total: number;
  skippable: boolean;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
}) {
  const targetRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (step.target) {
      targetRef.current = document.querySelector(step.target);
    } else {
      targetRef.current = null;
    }
  }, [step.target]);

  const spotlight = useMemo(() => {
    if (!targetRef.current) return null;
    const rect = targetRef.current.getBoundingClientRect();
    return {
      top: rect.top - 8,
      left: rect.left - 8,
      width: rect.width + 16,
      height: rect.height + 16,
    };
  }, [step.target]);

  const tooltipPosition = useMemo(() => {
    if (!targetRef.current || step.position === "center") return null;
    const rect = targetRef.current.getBoundingClientRect();
    switch (step.position) {
      case "top":
        return { top: rect.top - 120, left: rect.left + rect.width / 2 - 150 };
      case "bottom":
        return { top: rect.bottom + 16, left: rect.left + rect.width / 2 - 150 };
      case "left":
        return { top: rect.top, left: rect.left - 320 };
      case "right":
        return { top: rect.top, left: rect.right + 16 };
      default:
        return null;
    }
  }, [step.position, step.target]);

  return (
    <div className="fixed inset-0 z-[var(--z-tutorial)]">
      <div className="absolute inset-0 bg-black/70" onClick={skippable ? onSkip : undefined} />
      {spotlight && (
        <div
          className="absolute rounded-lg ring-2 ring-white/50"
          style={{
            top: spotlight.top,
            left: spotlight.left,
            width: spotlight.width,
            height: spotlight.height,
            boxShadow: "0 0 0 9999px rgba(0,0,0,0.7)",
          }}
        />
      )}
      <div
        className={`absolute w-[300px] glass glass-shine rounded-xl p-4 shadow-2xl ${
          step.position === "center" || !tooltipPosition ? "left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" : ""
        }`}
        style={tooltipPosition ?? undefined}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-bold text-white">{step.title}</h3>
          <span className="text-xs text-white/50">
            {progress}/{total}
          </span>
        </div>
        <div className="text-sm text-white/80">{step.content}</div>
        <div className="mt-4 flex items-center justify-between">
          <div>
            {progress > 1 && (
              <button
                onClick={onBack}
                className="rounded-lg bg-white/10 px-3 py-1 text-sm text-white/70 hover:bg-white/20"
              >
                Back
              </button>
            )}
          </div>
          <div className="flex gap-2">
            {skippable && (
              <button onClick={onSkip} className="text-sm text-white/50 hover:text-white/70">
                Skip
              </button>
            )}
            <button
              onClick={onNext}
              className="rounded-lg bg-emerald-500 px-4 py-1 text-sm font-bold text-white hover:bg-emerald-600"
            >
              {progress < total ? "Next" : "Done"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export const BLACKJACK_TUTORIAL: TutorialConfig = {
  id: "blackjack-basics",
  name: "Blackjack Basics",
  persistKey: "tutorial_blackjack_v1",
  skippable: true,
  steps: [
    {
      id: "welcome",
      title: "Welcome to Blackjack!",
      content: (
        <p>
          This is a multiplayer blackjack table. You'll learn the basics in just a few steps.
        </p>
      ),
      position: "center",
    },
    {
      id: "seating",
      title: "Take a Seat",
      content: (
        <p>
          Click an empty seat to join. Spectators can watch but can't play until seated.
        </p>
      ),
      target: "[data-seat='0']",
      position: "bottom",
    },
    {
      id: "betting",
      title: "Place Your Bet",
      content: (
        <p>
          During the betting phase, use the chips to set your wager. Minimum bet is shown
          at the table.
        </p>
      ),
      target: "[data-zone='bet-controls']",
      position: "top",
    },
    {
      id: "actions",
      title: "Your Turn",
      content: (
        <p>
          When it's your turn, choose Hit to draw a card or Stand to stop. Get closer to 21
          than the dealer without going over!
        </p>
      ),
      target: "[data-zone='dock']",
      position: "top",
    },
    {
      id: "powerups",
      title: "Use Powerups",
      content: (
        <p>
          Open boxes to get powerups like +2 Points or Swap Card. Use them during your turn
          to boost your hand!
        </p>
      ),
      target: "[data-zone='inventory']",
      position: "left",
    },
    {
      id: "done",
      title: "You're Ready!",
      content: (
        <p>
          Good luck at the tables! Remember: Blackjack pays 3x, Triple 7 pays 8x, and 5+
          cards under 21 gets a bonus.
        </p>
      ),
      position: "center",
    },
  ],
};
