"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";
import { Z, useZone, TOUCH_TARGET_PX, type ZoneTarget } from "./zone";
import { GlassButton, GlassCard, IconButton, Modal, Spinner } from "./primitives";

function formatTimer(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  if (s >= 60) {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  }
  return `${s}s`;
}

function formatBalance(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toFixed(0);
}

export type TableAction = "hit" | "stand" | "double_down" | "split" | "surrender" | "extend" | "skip" | "clear";

export interface TableActionConfig {
  action: TableAction;
  label: string;
  disabled?: boolean;
  variant?: "primary" | "ghost" | "danger" | "success";
  icon?: ReactNode;
}

export interface BlackjackTableShellProps {
  children: ReactNode;
  timerEndAt?: number | null;
  balance?: number;
  username?: string;
  prestigeLevel?: number;
  tableActions?: TableActionConfig[];
  onAction?: (action: TableAction) => void;
  showChat?: boolean;
  chatContent?: ReactNode;
  showMenu?: boolean;
  onMenuToggle?: () => void;
  showInventory?: boolean;
  onInventoryToggle?: () => void;
  showHostTools?: boolean;
  onHostToolsToggle?: () => void;
  bigWinContent?: ReactNode;
  toastContent?: ReactNode;
  modalContent?: ReactNode;
  modalTitle?: string;
  modalOpen?: boolean;
  onModalClose?: () => void;
  loading?: boolean;
  errorMessage?: string | null;
}

export function BlackjackTableShell({
  children,
  timerEndAt,
  balance,
  username,
  prestigeLevel = 0,
  tableActions = [],
  onAction,
  showChat = false,
  chatContent,
  showMenu = false,
  onMenuToggle,
  showInventory = false,
  onInventoryToggle,
  showHostTools = false,
  onHostToolsToggle,
  bigWinContent,
  toastContent,
  modalContent,
  modalTitle,
  modalOpen = false,
  onModalClose,
  loading = false,
  errorMessage,
}: BlackjackTableShellProps) {
  const zone = useZone();
  const [timerDisplay, setTimerDisplay] = useState<string | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (timerEndAt == null) {
      setTimerDisplay(null);
      if (timerRef.current != null) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }
    const update = () => {
      const remaining = Math.max(0, timerEndAt - Date.now());
      setTimerDisplay(formatTimer(remaining));
      if (remaining <= 0 && timerRef.current != null) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
    update();
    timerRef.current = window.setInterval(update, 250);
    return () => {
      if (timerRef.current != null) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [timerEndAt]);

  const isNarrow = zone.isNarrow;
  const showDock = zone.isTouch || isNarrow;

  return (
    <div className="relative flex h-full min-h-screen w-full flex-col overflow-hidden">
      {/* Top Zone: Timer + Balance */}
      <div
        className="pointer-events-none absolute left-0 right-0 top-0 z-[var(--z-topzone)] flex items-start justify-between p-2"
        style={{ "--z-topzone": Z.topzone } as React.CSSProperties}
      >
        <div className="pointer-events-auto flex items-center gap-2">
          {timerDisplay != null && (
            <GlassCard shine className="px-3 py-1.5 text-sm font-mono font-bold text-amber-300">
              {timerDisplay}
            </GlassCard>
          )}
        </div>
        <div className="pointer-events-auto flex items-center gap-2">
          {balance != null && (
            <GlassCard shine className="px-3 py-1.5 text-sm font-bold text-emerald-300">
              💰 {formatBalance(balance)}
            </GlassCard>
          )}
          {username != null && (
            <GlassCard className="px-3 py-1.5 text-xs text-white/80">
              {username}
              {prestigeLevel > 0 && <span className="ml-1 text-amber-400">P{prestigeLevel}</span>}
            </GlassCard>
          )}
        </div>
      </div>

      {/* Main Content: Table Area */}
      <main
        className={`flex-1 overflow-auto ${zone.isNarrow ? "pb-32 pt-14" : "pb-20 pt-16"}`}
        style={{ zIndex: Z.cards }}
      >
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <Spinner label="Loading table" />
          </div>
        ) : errorMessage ? (
          <div className="flex h-full items-center justify-center p-4">
            <GlassCard className="max-w-md p-6 text-center">
              <p className="mb-4 text-rose-300">{errorMessage}</p>
              <GlassButton variant="ghost" onClick={() => window.location.reload()}>
                Retry
              </GlassButton>
            </GlassCard>
          </div>
        ) : (
          children
        )}
      </main>

      {/* Bottom Zone: Table Controls */}
      {tableActions.length > 0 && !loading && (
        <div
          className="pointer-events-none absolute bottom-0 left-0 right-0 z-[var(--z-dock)] flex justify-center pb-3 pt-2"
          style={{ "--z-dock": Z.dock } as React.CSSProperties}
        >
          <div className="pointer-events-auto glass glass-shine inline-flex gap-2 rounded-2xl p-2">
            {tableActions.map((cfg) => (
              <GlassButton
                key={cfg.action}
                variant={cfg.disabled ? "ghost" : cfg.variant ?? "primary"}
                disabled={cfg.disabled}
                onClick={() => onAction?.(cfg.action)}
                className="min-w-[72px]"
              >
                {cfg.icon}
                <span>{cfg.label}</span>
              </GlassButton>
            ))}
          </div>
        </div>
      )}

      {/* Mobile Horizontal Dock (Menu, Inventory, Host Tools, Chat) */}
      {showDock && (
        <div
          className="pointer-events-none absolute bottom-0 left-0 right-0 z-[var(--z-dock)] flex items-end justify-center pb-1 pt-1"
          style={{ "--z-dock": Z.dock } as React.CSSProperties}
        >
          <div className="pointer-events-auto glass inline-flex gap-1 rounded-2xl p-1">
            {onMenuToggle && (
              <IconButton label="Menu" onClick={onMenuToggle}>
                ☰
              </IconButton>
            )}
            {onInventoryToggle && (
              <IconButton label="Inventory" onClick={onInventoryToggle}>
                📦
              </IconButton>
            )}
            {onHostToolsToggle && (
              <IconButton label="Host Tools" onClick={onHostToolsToggle}>
                🛠️
              </IconButton>
            )}
            {showChat && chatContent && (
              <IconButton label="Chat" onClick={() => {}}>
                💬
              </IconButton>
            )}
          </div>
        </div>
      )}

      {/* Toast Layer */}
      {toastContent && (
        <div
          className="pointer-events-none absolute bottom-24 left-0 right-0 z-[var(--z-toast)] flex justify-center px-4"
          style={{ "--z-toast": Z.toast } as React.CSSProperties}
        >
          {toastContent}
        </div>
      )}

      {/* Modal Layer */}
      <Modal open={modalOpen} onClose={onModalClose ?? (() => {})} title={modalTitle}>
        {modalContent}
      </Modal>

      {/* Big Win Overlay */}
      {bigWinContent && (
        <div
          className="pointer-events-none fixed inset-0 z-[var(--z-bigwin)] flex items-center justify-center"
          style={{ "--z-bigwin": Z.bigwin } as React.CSSProperties}
        >
          {bigWinContent}
        </div>
      )}
    </div>
  );
}

export function TableZoneLayout({
  children,
  sidebar,
  bottomActions,
  topInfo,
}: {
  children: ReactNode;
  sidebar?: ReactNode;
  bottomActions?: ReactNode;
  topInfo?: ReactNode;
}) {
  const zone = useZone();
  if (zone.isNarrow) {
    return (
      <>
        {topInfo && (
          <div className="sticky top-0 z-[var(--z-topzone)]">{topInfo}</div>
        )}
        <div className="flex-1">{children}</div>
        {bottomActions && (
          <div className="sticky bottom-0 z-[var(--z-dock)]">{bottomActions}</div>
        )}
      </>
    );
  }
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-1 min-h-0">
        <main className="flex-1 min-w-0 overflow-auto">{children}</main>
        {sidebar && (
          <aside className="w-64 min-w-[220px] max-w-xs border-l border-white/10 bg-black/20">{sidebar}</aside>
        )}
      </div>
      {bottomActions && <div className="sticky bottom-0">{bottomActions}</div>}
    </div>
  );
}

export function TopBar({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <header
      className={`glass sticky top-0 z-[var(--z-topbar)] flex items-center justify-between gap-2 px-3 py-2 ${className}`}
      style={{ "--z-topbar": Z.topbar } as React.CSSProperties}
    >
      {children}
    </header>
  );
}

export function BottomDock({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  const zone = useZone();
  const paddingBottom = zone.isNarrow ? "pb-28" : "pb-4";
  return (
    <nav
      className={`glass fixed bottom-0 left-0 right-0 z-[var(--z-dock)] flex items-center justify-center gap-2 px-3 py-2 ${paddingBottom} ${className}`}
      style={{ "--z-dock": Z.dock } as React.CSSProperties}
    >
      {children}
    </nav>
  );
}

export function Toast({
  children,
  onDismiss,
}: {
  children: ReactNode;
  onDismiss?: () => void;
}) {
  return (
    <div
      className="glass pointer-events-auto inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-sm shadow-lg"
      role="alert"
    >
      {children}
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="ml-2 text-white/50 hover:text-white"
          aria-label="Dismiss"
        >
          ✕
        </button>
      )}
    </div>
  );
}
