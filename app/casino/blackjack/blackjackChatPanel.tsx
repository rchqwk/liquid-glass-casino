"use client";

import { getBlackjackChatNameClass } from "./blackjackSeatViews";

type RoomChatMessage = {
  id: string;
  userId: number;
  username: string;
  text: string;
  at: number;
  prestigeLevel?: number;
  nameColor?: string | null;
};

type GlobalChatMessage = {
  id: string;
  ts: number;
  userId: number;
  username: string;
  text: string;
  prestigeLevel?: number;
  nameColor?: string | null;
};

export function BlackjackChatPanel({
  open,
  scope,
  setScope,
  roomMessages,
  globalMessages,
  globalOnline,
  globalActive1h,
  chatText,
  setChatText,
  experience = "classic",
  onClose,
  onRefreshGlobal,
  onSendRoomMessage,
  onSendGlobalMessage,
}: {
  open: boolean;
  scope: "room" | "global";
  setScope: (scope: "room" | "global") => void;
  roomMessages: RoomChatMessage[];
  globalMessages: GlobalChatMessage[];
  globalOnline: number;
  globalActive1h: number;
  chatText: string;
  setChatText: (value: string) => void;
  experience?: "classic" | "v2";
  onClose: () => void;
  onRefreshGlobal: () => Promise<void>;
  onSendRoomMessage: (text: string) => Promise<void>;
  onSendGlobalMessage: (text: string) => Promise<void>;
}) {
  if (!open) return null;

  const sendCurrentMessage = async () => {
    const text = chatText.trim();
    if (!text) return;
    setChatText("");
    if (scope === "global") {
      await onSendGlobalMessage(text);
      await onRefreshGlobal();
    } else {
      await onSendRoomMessage(text);
    }
  };

  return (
    <div className="fixed inset-0 z-[85] flex items-center justify-center bg-black/80 p-4">
      <div className="glass glass-shine w-full max-w-[720px] rounded-3xl border border-white/10 p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-white">{experience === "v2" ? "Live chat" : "Chat"}</div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button
                type="button"
                className={`rounded-2xl px-3 py-1.5 text-xs font-medium transition ${
                  scope === "room" ? "bg-white/10 text-white" : "bg-white/5 text-white/70 hover:bg-white/10"
                }`}
                onClick={() => setScope("room")}
              >
                {experience === "v2" ? "Table" : "Room"}
              </button>
              <button
                type="button"
                className={`rounded-2xl px-3 py-1.5 text-xs font-medium transition ${
                  scope === "global" ? "bg-white/10 text-white" : "bg-white/5 text-white/70 hover:bg-white/10"
                }`}
                onClick={() => setScope("global")}
              >
                Global
              </button>
              {scope === "global" ? (
                <span className="ml-1 text-[11px] text-white/60">
                  Online: <span className="font-mono text-white/80">{globalOnline}</span> • Active 1h:{" "}
                  <span className="font-mono text-white/80">{globalActive1h}</span>
                </span>
              ) : (
                <span className="ml-1 text-[11px] text-white/60">{experience === "v2" ? "Messages from this live table" : "Room messages"}</span>
              )}
            </div>
          </div>
          <button type="button" className="rounded-2xl px-3 py-2 text-xs text-white/70 hover:text-white" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="mt-4 h-[360px] overflow-auto rounded-3xl border border-white/10 bg-white/5 p-4">
          {scope === "global" ? (
            globalMessages.length ? (
              <div className="flex flex-col gap-2">
                {globalMessages.map((m) => (
                  <div key={m.id} className="rounded-2xl border border-white/10 bg-black/10 px-3 py-2">
                    <div className="flex items-center justify-between gap-3 text-[11px] text-white/60">
                      <span className={`font-semibold ${getBlackjackChatNameClass(m.nameColor ?? null)}`}>
                        {m.username}
                        {(Number(m.prestigeLevel ?? 0) || 0) >= 1 ? (
                          <span className="ml-1 text-yellow-300">★{Number(m.prestigeLevel ?? 0)}</span>
                        ) : null}
                      </span>
                      <span className="font-mono">{new Date(m.ts).toLocaleTimeString()}</span>
                    </div>
                    <div className="mt-1 whitespace-pre-wrap text-sm text-white/85">{m.text}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-white/60">{experience === "v2" ? "No live chat yet." : "No messages yet."}</div>
            )
          ) : roomMessages.length ? (
            <div className="flex flex-col gap-2">
              {roomMessages.map((m) => (
                <div key={m.id} className="rounded-2xl border border-white/10 bg-black/10 px-3 py-2">
                  <div className="flex items-center justify-between gap-3 text-[11px] text-white/60">
                    <span className={`font-semibold ${getBlackjackChatNameClass(m.nameColor ?? null)}`}>
                      {m.username}
                      {(Number(m.prestigeLevel ?? 0) || 0) >= 1 ? (
                        <span className="ml-1 text-yellow-300">★{Number(m.prestigeLevel ?? 0)}</span>
                      ) : null}
                    </span>
                    <span className="font-mono">{new Date(m.at).toLocaleTimeString()}</span>
                  </div>
                  <div className="mt-1 whitespace-pre-wrap text-sm text-white/85">{m.text}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-white/60">{experience === "v2" ? "No live chat yet." : "No messages yet."}</div>
          )}
        </div>

        <div className="mt-4 flex gap-2">
          <input
            type="text"
            value={chatText}
            onChange={(e) => setChatText(e.target.value)}
            placeholder={experience === "v2" ? "Send a live table message…" : "Type a message…"}
            className="w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/20"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                (e.currentTarget as any).blur?.();
                void sendCurrentMessage();
              }
            }}
          />
          <button
            type="button"
            className="glass-soft rounded-2xl px-4 py-2 text-sm font-medium text-white/90 hover:bg-white/10 disabled:opacity-40"
            disabled={!chatText.trim()}
            onClick={() => void sendCurrentMessage()}
          >
            {experience === "v2" ? "Send note" : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}
