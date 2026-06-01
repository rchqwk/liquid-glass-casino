"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "../lib/authClient";

type Msg = { id: string; ts: number; userId: number; username: string; text: string };

export function GlobalChatBubble() {
  const { user, loading } = useAuth();
  const pathname = usePathname();

  // Hide on the blackjack table page because it has its own room UI (and would overlap).
  const hide = useMemo(() => {
    const p = String(pathname ?? "");
    const parts = p.split("/").filter(Boolean);
    return parts.length >= 3 && parts[0] === "casino" && parts[1] === "blackjack" && parts[2] !== "games";
  }, [pathname]);
  if (hide) return null;

  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [online, setOnline] = useState(0);
  const [active1h, setActive1h] = useState(0);
  const [text, setText] = useState("");
  const [lastReadAt, setLastReadAt] = useState(0);

  const unread = useMemo(() => {
    if (open) return 0;
    return messages.filter((m) => (Number(m.ts) || 0) > lastReadAt).length;
  }, [messages, lastReadAt, open]);

  const refresh = async () => {
    if (!user) return;
    try {
      const res = await fetch("/api/chat/global", { cache: "no-store" });
      const data = (await res.json().catch(() => ({}))) as any;
      if (!res.ok) return;
      setMessages(Array.isArray(data.messages) ? data.messages : []);
      setOnline(Number(data.online ?? 0) || 0);
      setActive1h(Number(data.active1h ?? 0) || 0);
    } catch {
      // ignore
    }
  };

  // Presence ping
  useEffect(() => {
    if (loading || !user) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const res = await fetch("/api/presence/ping", { method: "POST" });
        const data = (await res.json().catch(() => ({}))) as any;
        if (cancelled || !res.ok) return;
        setOnline(Number(data.online ?? 0) || 0);
        setActive1h(Number(data.active1h ?? 0) || 0);
      } catch {
        // ignore
      }
    };
    const id = window.setInterval(tick, 30_000);
    void tick();
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [user, loading]);

  // Chat refresh
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const tick = async () => {
      if (cancelled) return;
      await refresh();
    };
    const id = window.setInterval(tick, 5000);
    void tick();
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    if (!open) return;
    const latest = messages.reduce((a, b) => Math.max(a, Number(b.ts) || 0), 0);
    if (latest > lastReadAt) setLastReadAt(latest);
  }, [open, messages, lastReadAt]);

  const send = async () => {
    if (!user) return;
    const t = text.trim();
    if (!t) return;
    setText("");
    try {
      const res = await fetch("/api/chat/global", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: t }),
      });
      const data = (await res.json().catch(() => ({}))) as any;
      if (!res.ok) return;
      setMessages(Array.isArray(data.messages) ? data.messages : []);
      setOnline(Number(data.online ?? 0) || 0);
      setActive1h(Number(data.active1h ?? 0) || 0);
    } catch {
      // ignore
    }
  };

  return (
    <>
      <div className="pointer-events-none fixed bottom-24 left-4 z-[65]">
        <button
          type="button"
          className="pointer-events-auto glass glass-shine relative rounded-3xl border border-white/10 px-4 py-3 text-left text-xs text-white/85 hover:bg-white/10"
          onClick={() => setOpen(true)}
          disabled={!user}
          title={!user ? "Sign in to use chat" : "Global chat"}
        >
          <div className="font-semibold">Chat</div>
          <div className="mt-1 text-[11px] text-white/60">Global room</div>
          {unread > 0 ? (
            <div className="absolute -right-2 -top-2 flex h-6 min-w-6 items-center justify-center rounded-full bg-fuchsia-500 px-2 text-[11px] font-semibold text-white shadow-[0_10px_20px_rgba(0,0,0,.35)]">
              {Math.min(99, unread)}
            </div>
          ) : null}
          <div className="absolute -bottom-2 -right-2 rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] text-white/70">
            {online} online
          </div>
        </button>
      </div>

      {open ? (
        <div className="fixed inset-0 z-[85] flex items-center justify-center bg-black/80 p-4">
          <div className="glass glass-shine w-full max-w-[720px] rounded-3xl border border-white/10 p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-white">Global chat</div>
                <div className="mt-1 text-xs text-white/60">
                  Online: <span className="font-mono text-white/80">{online}</span> • Active 1h:{" "}
                  <span className="font-mono text-white/80">{active1h}</span>
                </div>
              </div>
              <button
                type="button"
                className="rounded-2xl px-3 py-2 text-xs text-white/70 hover:text-white"
                onClick={() => setOpen(false)}
              >
                Close
              </button>
            </div>

            <div className="mt-4 h-[360px] overflow-auto rounded-3xl border border-white/10 bg-white/5 p-4">
              {messages.length ? (
                <div className="flex flex-col gap-2">
                  {messages.map((m) => (
                    <div key={m.id} className="rounded-2xl border border-white/10 bg-black/10 px-3 py-2">
                      <div className="flex items-center justify-between gap-3 text-[11px] text-white/60">
                        <span className="font-semibold text-white/80">{m.username}</span>
                        <span className="font-mono">{new Date(m.ts).toLocaleTimeString()}</span>
                      </div>
                      <div className="mt-1 whitespace-pre-wrap text-sm text-white/85">{m.text}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-white/60">No messages yet.</div>
              )}
            </div>

            <div className="mt-4 flex gap-2">
              <input
                type="text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Type a message…"
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/20"
                onKeyDown={(e) => {
                  if (e.key === "Enter") void send();
                }}
              />
              <button
                type="button"
                className="glass-soft rounded-2xl px-4 py-2 text-sm font-medium text-white/90 hover:bg-white/10 disabled:opacity-40"
                disabled={!text.trim()}
                onClick={() => void send()}
              >
                Send
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

