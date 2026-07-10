"use client";

import { useEffect, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Z, TOUCH_TARGET_PX, useZone } from "./zone";

type Variant = "primary" | "ghost" | "danger" | "success";

const variantClass: Record<Variant, string> = {
  primary: "glass-shine text-white",
  ghost: "glass-soft text-[var(--fg0)]",
  danger: "glass-soft text-rose-300 border-rose-400/30",
  success: "glass-soft text-emerald-300 border-emerald-400/30",
};

export function GlassButton({
  children,
  variant = "primary",
  className = "",
  size = "md",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: "sm" | "md" | "lg";
}) {
  const heights = { sm: TOUCH_TARGET_PX, md: TOUCH_TARGET_PX, lg: 56 };
  const font = { sm: "text-xs", md: "text-sm", lg: "text-base" };
  return (
    <button
      {...rest}
      className={`inline-flex items-center justify-center gap-2 rounded-2xl px-4 font-semibold
        transition active:scale-[0.97] disabled:opacity-50 disabled:active:scale-100
        ${variantClass[variant]} ${font[size]} ${className}`}
      style={{ minHeight: heights[size], touchAction: "manipulation", ...rest.style }}
    >
      {children}
    </button>
  );
}

export function IconButton({
  children,
  className = "",
  label,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      {...rest}
      aria-label={label}
      title={label}
      className={`glass-soft inline-flex items-center justify-center rounded-2xl text-[var(--fg0)]
        transition active:scale-95 ${className}`}
      style={{ minWidth: TOUCH_TARGET_PX, minHeight: TOUCH_TARGET_PX, touchAction: "manipulation", ...rest.style }}
    >
      {children}
    </button>
  );
}

export function GlassCard({
  children,
  className = "",
  shine = false,
}: {
  children: ReactNode;
  className?: string;
  shine?: boolean;
}) {
  return (
    <div className={`glass rounded-3xl ${shine ? "glass-shine" : ""} ${className}`}>{children}</div>
  );
}

export function Spinner({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 text-[var(--fg1)]" role="status" aria-live="polite">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
      <span className="text-sm">{label}…</span>
    </div>
  );
}

export function Modal({
  open,
  onClose,
  children,
  title,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: string;
  wide?: boolean;
}) {
  const z = useZone();
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  const maxWidth = wide ? "max-w-2xl" : z.isNarrow ? "max-w-[92vw]" : "max-w-md";
  return (
    <div className="fixed inset-0" role="dialog" aria-modal="true" aria-label={title}>
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        style={{ zIndex: Z.modalScrim }}
        onClick={onClose}
      />
      <div className="absolute inset-0 flex items-center justify-center p-3" style={{ zIndex: Z.modalPanel }}>
        <div className={`glass glass-shine w-full ${maxWidth} max-h-[85vh] overflow-auto rounded-3xl p-5`}>
          {title && <h2 className="mb-3 text-lg font-bold">{title}</h2>}
          {children}
        </div>
      </div>
    </div>
  );
}

export function BottomSheet({
  open,
  onClose,
  children,
  title,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" style={{ zIndex: Z.modalScrim }} onClick={onClose} />
      <div
        className="glass absolute inset-x-0 bottom-0 max-h-[80vh] overflow-auto rounded-t-3xl p-4 pb-8"
        style={{ zIndex: Z.modalPanel }}
      >
        {title && <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-white/30" />}
        {title && <h2 className="mb-3 text-lg font-bold">{title}</h2>}
        {children}
      </div>
    </div>
  );
}
