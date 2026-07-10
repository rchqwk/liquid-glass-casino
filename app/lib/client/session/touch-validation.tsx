"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export const TOUCH_TARGET_MIN_PX = 44;

export function useTouchTargetValidation() {
  const [violations, setViolations] = useState<Array<{ selector: string; rect: DOMRect }>>([]);
  const checkedRef = useRef(new Set<string>());

  const validate = useCallback(() => {
    const interactive = document.querySelectorAll(
      'button, a,[role="button"], input[type="checkbox"], input[type="radio"], [tabindex]'
    );
    const found: Array<{ selector: string; rect: DOMRect }> = [];
    const checked = new Set<string>();

    interactive.forEach((el) => {
      const selector = el.id
        ? `#${el.id}`
        : el.className
          ? `.${el.className.split(/\s+/).join(".")}`
          : el.tagName.toLowerCase();
      const key = `${selector}-${Array.from(el.parentElement?.children ?? []).indexOf(el)}`;
      checked.add(key);

      const rect = el.getBoundingClientRect();
      if (rect.width < TOUCH_TARGET_MIN_PX || rect.height < TOUCH_TARGET_MIN_PX) {
        found.push({ selector, rect });
      }
    });

    checkedRef.current = checked;
    setViolations(found);
  }, []);

  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      const timer = setTimeout(validate, 1000);
      return () => clearTimeout(timer);
    }
  }, [validate]);

  return { violations, validate };
}

export function TouchTargetWarning({
  violations,
}: {
  violations: Array<{ selector: string; rect: DOMRect }>;
}) {
  if (!violations.length) return null;
  if (process.env.NODE_ENV !== "development") return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-[9999] rounded-2xl bg-rose-500/90 p-3 text-xs text-white shadow-lg">
      <p className="font-bold">Touch target warnings:</p>
      <ul className="mt-1 max-h-32 overflow-auto">
        {violations.slice(0, 5).map((v, i) => (
          <li key={i}>
            {v.selector}: {Math.round(v.rect.width)}×{Math.round(v.rect.height)}px
          </li>
        ))}
      </ul>
    </div>
  );
}
