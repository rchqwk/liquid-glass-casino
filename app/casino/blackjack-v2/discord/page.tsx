"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Stage = "init" | "sdk_init" | "authorizing" | "logging_in" | "joining" | "redirecting" | "done" | "error";

export default function DiscordV2EntryPage() {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("init");
  const [error, setError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<Record<string, string>>({});
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (msg: string) => {
    const timestamp = new Date().toISOString().split("T")[1].split(".")[0];
    setLogs(prev => [...prev.slice(-20), `${timestamp} ${msg}`]);
    console.log(`[Discord V2] ${msg}`);
  };

  const clientId = process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID ?? "1512024820194349157";
  const redirectUri = process.env.NEXT_PUBLIC_DISCORD_REDIRECT_URI ?? "https://rchqwk.com/casino/blackjack-v2/discord";

  const params = useMemo(() => {
    if (typeof window === "undefined") return null;
    const url = new URL(window.location.href);
    return {
      frameId: url.searchParams.get("frame_id"),
      channelId: url.searchParams.get("channel_id"),
      guildId: url.searchParams.get("guild_id"),
      code: url.searchParams.get("code"),
    };
  }, []);

  useEffect(() => {
    if (!params) return;
    
    addLog("Page mounted");
    setDebugInfo({
      frameId: params.frameId ?? "null",
      channelId: params.channelId ?? "null",
      guildId: params.guildId ?? "null",
      hasCode: params.code ? "yes" : "no",
      clientId: clientId,
      redirectUri: redirectUri,
      href: typeof window !== "undefined" ? window.location.href : "n/a",
    });

    if (params.code) {
      addLog("Detected OAuth code callback");
      handleOAuthCallback(params.code);
      return;
    }

    if (params.frameId) {
      addLog("Detected Discord frame_id, initializing SDK");
      initSDK();
    } else {
      addLog("No frame_id, showing manual sign-in");
      setStage("init");
    }
  }, [params]);

  const initSDK = async () => {
    try {
      setStage("sdk_init");
      addLog("Importing Discord SDK...");
      
      const { DiscordSDK } = await import("@discord/embedded-app-sdk").catch(err => {
        addLog(`SDK import failed: ${err}`);
        throw new Error("SDK import failed");
      });
      
      addLog("SDK imported, creating instance...");
      const sdk = new DiscordSDK(clientId);
      
      addLog("Waiting for SDK ready...");
      setStage("authorizing");
      
      await Promise.race([
        sdk.ready(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error("SDK timeout after 10s")), 10000)
        ),
      ]);
      
      addLog("SDK ready, authorizing...");
      const authResult = await (sdk as any).commands.authorize({
        client_id: clientId,
        response_type: "code",
        prompt: "none",
        scope: ["identify", "rpc.activities.write"],
      });
      
      if (!authResult?.code) {
        throw new Error("No auth code from SDK");
      }
      
      addLog(`Got auth code: ${authResult.code.substring(0, 8)}...`);
      await loginWithCode(authResult.code);
      
    } catch (err: any) {
      addLog(`SDK init failed: ${err.message}`);
      setError(err.message);
      setStage("error");
    }
  };

  const handleOAuthCallback = async (code: string) => {
    addLog(`Processing OAuth code: ${code.substring(0, 8)}...`);
    await loginWithCode(code);
  };

  const loginWithCode = async (code: string) => {
    try {
      setStage("logging_in");
      addLog("Calling /api/discord/login...");
      
      const res = await fetch("/api/discord/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code, redirectUri }),
      });
      
      const data = await res.json().catch(() => ({}));
      
      if (!res.ok) {
        throw new Error(data?.error || `Login failed: ${res.status}`);
      }
      
      addLog("Login successful!");
      
      const effectiveChannelId = params?.channelId;
      if (effectiveChannelId) {
        await joinTable(effectiveChannelId);
      } else {
        addLog("No channel ID, redirecting to lobby");
        setStage("redirecting");
        router.push("/casino/blackjack-v2");
      }
      
    } catch (err: any) {
      addLog(`Login failed: ${err.message}`);
      setError(err.message);
      setStage("error");
    }
  };

  const joinTable = async (tableId: string) => {
    try {
      setStage("joining");
      addLog(`Ensuring table ${tableId}...`);
      
      await fetch(`/api/blackjack/tables/${encodeURIComponent(tableId)}/ensure`, {
        method: "POST",
      });
      
      addLog("Joining table...");
      await fetch(`/api/blackjack/tables/${encodeURIComponent(tableId)}/join`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ spectate: false }),
      });
      
      addLog("Redirecting to table...");
      setStage("redirecting");
      router.push(`/casino/blackjack-v2/${tableId}`);
      
    } catch (err: any) {
      addLog(`Join failed: ${err.message}`);
      setError(err.message);
      setStage("error");
    }
  };

  const handleManualSignIn = () => {
    const authUrl = `https://discord.com/oauth2/authorize?client_id=${clientId}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&scope=identify&prompt=none`;
    addLog("Redirecting to Discord OAuth...");
    window.location.href = authUrl;
  };

  const stageLabels: Record<Stage, string> = {
    init: "Ready",
    sdk_init: "Initializing Discord SDK...",
    authorizing: "Authorizing...",
    logging_in: "Signing in...",
    joining: "Joining table...",
    redirecting: "Redirecting...",
    done: "Done!",
    error: "Error",
  };

  const boxStyle: React.CSSProperties = {
    position: "absolute",
    inset: 0,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#050508",
    color: "#ffffff",
    fontFamily: "system-ui, -apple-system, sans-serif",
    padding: "20px",
  };

  const cardStyle: React.CSSProperties = {
    backgroundColor: "#101018",
    borderRadius: "16px",
    padding: "32px",
    maxWidth: "500px",
    width: "100%",
    border: "1px solid rgba(255,255,255,0.1)",
  };

  const buttonStyle: React.CSSProperties = {
    backgroundColor: "#00f5ff",
    color: "#050508",
    border: "none",
    borderRadius: "10px",
    padding: "14px 28px",
    fontSize: "16px",
    fontWeight: 600,
    cursor: "pointer",
    marginTop: "20px",
  };

  const errorBoxStyle: React.CSSProperties = {
    backgroundColor: "rgba(255,51,102,0.15)",
    border: "1px solid rgba(255,51,102,0.3)",
    borderRadius: "10px",
    padding: "16px",
    marginTop: "16px",
    color: "#ff6688",
  };

  const debugBoxStyle: React.CSSProperties = {
    backgroundColor: "#08080c",
    borderRadius: "10px",
    padding: "12px",
    marginTop: "16px",
    fontSize: "11px",
    fontFamily: "monospace",
    color: "#888",
    maxHeight: "150px",
    overflow: "auto",
    whiteSpace: "pre-wrap",
    wordBreak: "break-all",
  };

  const logBoxStyle: React.CSSProperties = {
    backgroundColor: "#08080c",
    borderRadius: "10px",
    padding: "12px",
    marginTop: "12px",
    fontSize: "10px",
    fontFamily: "monospace",
    color: "#6a6a7a",
    maxHeight: "120px",
    overflow: "auto",
  };

  return (
    <div style={boxStyle}>
      <div style={cardStyle}>
        <h1 style={{ margin: 0, marginBottom: "8px", fontSize: "24px", fontWeight: 700 }}>
          Discord Blackjack V2
        </h1>
        <p style={{ margin: 0, color: "#aaa", fontSize: "14px" }}>
          {stageLabels[stage]}
        </p>

        {error && (
          <div style={errorBoxStyle}>
            <strong>Error:</strong> {error}
          </div>
        )}

        {stage === "init" && !params?.frameId && !params?.code && (
          <button style={buttonStyle} onClick={handleManualSignIn}>
            Sign in with Discord
          </button>
        )}

        {stage === "error" && (
          <button style={buttonStyle} onClick={handleManualSignIn}>
            Try Again
          </button>
        )}

        <div style={debugBoxStyle}>
          <div style={{ color: "#00f5ff", marginBottom: "8px" }}>Debug Info:</div>
          {Object.entries(debugInfo).map(([k, v]) => (
            <div key={k}>
              <span style={{ color: "#666" }}>{k}:</span> {v}
            </div>
          ))}
        </div>

        <div style={logBoxStyle}>
          <div style={{ color: "#4a4a5a", marginBottom: "8px" }}>Log:</div>
          {logs.map((log, i) => (
            <div key={i}>{log}</div>
          ))}
        </div>
      </div>
    </div>
  );
}
