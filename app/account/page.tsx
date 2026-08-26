"use client";

import { useEffect, useState } from "react";

type UserView = { id: number; username: string; role_level: number; prestige_level: number; prestige_points: number; name_color: string | null; xp?: number };
type CredType = "password" | "passcode";

export default function AccountPage() {
  const [mode, setMode] = useState<"login" | "register" | "claim" | "email">("login");
  const [credType, setCredType] = useState<CredType>("password");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [passcode, setPasscode] = useState("");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [user, setUser] = useState<UserView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [codeSent, setCodeSent] = useState(false);

  // Show an existing session (and current XP) on load.
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/account", { cache: "no-store" });
        const data = await res.json();
        if (data.user) setUser(data.user);
      } catch {
        // ignore
      }
    })();
  }, []);

  const post = async (url: string, body: unknown) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      return { ok: res.ok, status: res.status, data };
    } catch {
      setError("Network error.");
      return { ok: false, status: 0, data: {} };
    } finally {
      setBusy(false);
    }
  };

  const credentialBody = () => (credType === "passcode" ? { passcode } : { password });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === "register") {
      const r = await post("/api/auth/register", { username, email, ...credentialBody() });
      if (r.ok) {
        setUser(r.data.user);
        setError(null);
      } else {
        setError(r.data.error ?? "Registration failed.");
      }
    } else if (mode === "claim") {
      const r = await post("/api/auth/claim", { username, email, ...credentialBody() });
      if (r.ok) {
        setUser(r.data.user);
        setError(null);
      } else {
        setError(r.data.error ?? "Could not secure account.");
      }
    } else {
      const r = await post("/api/auth/login", { username, ...credentialBody() });
      if (r.ok) {
        setUser(r.data.user);
        setLockedUntil(null);
        setCodeSent(false);
      } else if (r.status === 423 && r.data.needs2fa) {
        setLockedUntil(r.data.lockedUntil ?? Date.now());
        setError(r.data.error ?? "Account locked.");
      } else {
        setError(r.data.error ?? "Login failed.");
      }
    }
  };

  const requestCode = async () => {
    const r = await post("/api/auth/2fa/request", { username });
    if (r.ok) {
      setCodeSent(true);
      setDevCode(r.data.devCode ?? null);
      setError(null);
    } else {
      setError(r.data.error ?? "Could not send code.");
    }
  };

  const verifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const r = await post("/api/auth/2fa/verify", { username, code });
    if (r.ok) {
      setUser(r.data.user);
      setLockedUntil(null);
      setCodeSent(false);
      setCode("");
    } else {
      setError(r.data.error ?? "Incorrect code.");
    }
  };

  const sendEmailCode = async () => {
    const r = await post("/api/auth/email/request", { email });
    if (r.ok) {
      setCodeSent(true);
      setDevCode(r.data.devCode ?? null);
      setError(null);
    } else {
      setError(r.data.error ?? "Could not send code.");
    }
  };

  const verifyEmailCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const r = await post("/api/auth/email/verify", { email, code });
    if (r.ok) {
      setUser(r.data.user);
      setLockedUntil(null);
      setCodeSent(false);
      setCode("");
    } else {
      setError(r.data.error ?? "Incorrect code.");
    }
  };

  const reset = () => {
    setUser(null);
    setUsername("");
    setPassword("");
    setPasscode("");
    setEmail("");
    setCode("");
    setError(null);
    setLockedUntil(null);
    setCodeSent(false);
    setDevCode(null);
    setMode("login");
    setCredType("password");
  };

  const signOut = async () => {
    try {
      await fetch("/api/auth", { method: "DELETE" });
    } catch {
      // ignore
    }
    reset();
  };

  if (user) {
    return (
      <div style={wrap}>
        <div style={card}>
          <div style={logo}>LIQUID GLASS ARCADE</div>
          <h2 style={{ margin: "14px 0 6px" }}>Signed in</h2>
          <p style={muted}>Welcome, <b style={{ color: "#fff" }}>{user.username}</b>.</p>
          <div style={{ display: "flex", gap: 10, margin: "16px 0", flexWrap: "wrap" }}>
            <div style={statChip}>
              <div style={statLabel}>XP</div>
              <div style={statValue}>{Number(user.xp ?? 0).toLocaleString()}</div>
            </div>
            <div style={statChip}>
              <div style={statLabel}>Prestige</div>
              <div style={statValue}>{user.prestige_level}</div>
            </div>
            <div style={statChip}>
              <div style={statLabel}>Prestige Pts</div>
              <div style={statValue}>{user.prestige_points}</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, margin: "16px 0 12px", flexWrap: "wrap" }}>
            <a
              href="/casino/blackjack-v2"
              style={{ ...primary, flex: 1, minWidth: 140, display: "inline-flex", alignItems: "center", justifyContent: "center", textDecoration: "none" }}
            >
              Play games
            </a>
            <a
              href="/arcade/blackjack-roguelike"
              style={{ ...ghost, flex: 1, minWidth: 140, display: "inline-flex", alignItems: "center", justifyContent: "center", textDecoration: "none" }}
            >
              Roguelike Blackjack
            </a>
          </div>
          <button style={{ ...ghost, width: "100%" }} onClick={signOut}>Sign out</button>
        </div>
      </div>
    );
  }

  const locked = lockedUntil != null && lockedUntil > Date.now();
  const showClaim = mode === "claim";

  return (
    <div style={wrap}>
      <div style={card}>
        <div style={logo}>LIQUID GLASS ARCADE</div>
        <p style={muted}>Secure your account with a password or a 6-digit passcode. After 5 failed attempts it locks for 4 hours — unlock with an email code.</p>

        {locked ? (
          <>
            <h3 style={{ margin: "18px 0 8px", color: "#ff5d8f" }}>Account locked</h3>
            <p style={muted}>Too many failed attempts. Unlock with a 6-digit code sent to your email.</p>
            {!codeSent ? (
              <button style={primary} onClick={requestCode} disabled={busy}>Send unlock code</button>
            ) : (
              <form onSubmit={verifyCode}>
                <input style={input} inputMode="numeric" value={code} maxLength={6} placeholder="6-digit code" onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
                {devCode ? <p style={muted}>Dev code: <b style={{ color: "#ffd24a" }}>{devCode}</b></p> : null}
                <button style={primary} type="submit" disabled={busy}>Unlock</button>
              </form>
            )}
            <button style={ghost} onClick={() => setLockedUntil(null)}>Back to login</button>
          </>
        ) : (
          <>
            <div style={{ display: "flex", gap: 8, margin: "16px 0", flexWrap: "wrap" }}>
              <button style={mode === "login" ? primary : ghost} onClick={() => setMode("login")}>Login</button>
              <button style={mode === "register" ? primary : ghost} onClick={() => setMode("register")}>Register</button>
              <button style={mode === "email" ? primary : ghost} onClick={() => setMode("email")}>Email</button>
              <button style={mode === "claim" ? primary : ghost} onClick={() => setMode("claim")}>Claim account</button>
            </div>

            {mode === "email" ? (
              <>
                <p style={muted}>Sign in with a 6-digit code sent to your email — no password needed.</p>
                <label style={label}>Email</label>
                <input style={input} type="email" value={email} placeholder="you@example.com" onChange={(e) => setEmail(e.target.value)} />

                {!codeSent ? (
                  <button style={{ ...primary, width: "100%" }} onClick={sendEmailCode} disabled={busy}>Send sign-in code</button>
                ) : (
                  <form onSubmit={verifyEmailCode}>
                    <label style={label}>6-digit code</label>
                    <input style={{ ...input, letterSpacing: ".4em", fontSize: 20, textAlign: "center" }} inputMode="numeric" maxLength={6} value={code} placeholder="••••••" onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
                    {devCode ? <p style={muted}>Dev code: <b style={{ color: "#ffd24a" }}>{devCode}</b></p> : null}
                    <button style={{ ...primary, width: "100%" }} type="submit" disabled={busy}>Verify & sign in</button>
                  </form>
                )}

                {codeSent ? (
                  <button style={{ ...ghost, width: "100%" }} onClick={() => { setCodeSent(false); setCode(""); }}>Use a different email</button>
                ) : null}
              </>
            ) : (
              <>
                <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                  <button style={credType === "password" ? primary : ghost} onClick={() => setCredType("password")}>Password</button>
                  <button style={credType === "passcode" ? primary : ghost} onClick={() => setCredType("passcode")}>6-digit passcode</button>
                </div>

                <form onSubmit={submit}>
                  <label style={label}>Username</label>
                  <input style={input} value={username} maxLength={24} placeholder="username" onChange={(e) => setUsername(e.target.value)} />

                  {credType === "passcode" ? (
                    <>
                      <label style={label}>Passcode (6 digits)</label>
                      <input style={{ ...input, letterSpacing: ".4em", fontSize: 20, textAlign: "center" }} inputMode="numeric" maxLength={6} value={passcode} placeholder="••••••" onChange={(e) => setPasscode(e.target.value.replace(/\D/g, ""))} />
                    </>
                  ) : (
                    <>
                      <label style={label}>Password</label>
                      <input style={input} type="password" value={password} placeholder="••••••" onChange={(e) => setPassword(e.target.value)} />
                    </>
                  )}

                  {mode !== "login" ? (
                    <>
                      <label style={label}>Email (for account recovery)</label>
                      <input style={input} type="email" value={email} placeholder="you@example.com" onChange={(e) => setEmail(e.target.value)} />
                    </>
                  ) : null}

                  {showClaim ? <p style={muted}>If your account has progress but no credential yet, set one here to secure it.</p> : null}

                  <button style={{ ...primary, width: "100%", marginTop: 16 }} type="submit" disabled={busy}>
                    {mode === "login" ? "Sign in" : mode === "claim" ? "Secure account" : "Create account"}
                  </button>
                </form>
              </>
            )}
          </>
        )}

        {error ? <p style={{ color: "#ff5d8f", marginTop: 12, fontSize: 14 }}>{error}</p> : null}
      </div>
    </div>
  );
}

const wrap: React.CSSProperties = {
  minHeight: "100dvh",
  width: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 24,
  background: "radial-gradient(1200px 700px at 50% -10%, rgba(168,85,247,.22), transparent 60%), linear-gradient(#06060d, #0a0a14)",
  fontFamily: "Inter, system-ui, sans-serif",
};
const card: React.CSSProperties = {
  width: "100%",
  maxWidth: 420,
  border: "1px solid rgba(255,255,255,.12)",
  borderRadius: 22,
  background: "rgba(255,255,255,.04)",
  padding: 28,
  color: "#eaf6ff",
};
const logo: React.CSSProperties = { fontSize: 20, fontWeight: 900, letterSpacing: ".14em", color: "#fff", textShadow: "0 0 18px rgba(168,85,247,.6)" };
const muted: React.CSSProperties = { color: "rgba(255,255,255,.55)", fontSize: 13, lineHeight: 1.6 };
const label: React.CSSProperties = { display: "block", marginTop: 12, marginBottom: 5, fontSize: 12, letterSpacing: ".1em", textTransform: "uppercase", color: "rgba(255,255,255,.6)" };
const input: React.CSSProperties = { width: "100%", padding: "12px 14px", borderRadius: 12, border: "1px solid rgba(255,255,255,.15)", background: "rgba(255,255,255,.05)", color: "#fff", fontSize: 15, boxSizing: "border-box" };
const primary: React.CSSProperties = { border: "none", borderRadius: 12, padding: "12px 18px", fontSize: 14, fontWeight: 700, cursor: "pointer", background: "linear-gradient(90deg,#38bdf8,#a855f7)", color: "#05070f", marginTop: 8 };
const ghost: React.CSSProperties = { border: "1px solid rgba(255,255,255,.15)", borderRadius: 12, padding: "12px 18px", fontSize: 14, fontWeight: 700, cursor: "pointer", background: "transparent", color: "rgba(255,255,255,.8)", marginTop: 8 };
const statChip: React.CSSProperties = { flex: 1, minWidth: 90, background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.1)", borderRadius: 14, padding: "12px", textAlign: "center" };
const statLabel: React.CSSProperties = { fontSize: 10, letterSpacing: ".1em", textTransform: "uppercase", color: "rgba(255,255,255,.5)" };
const statValue: React.CSSProperties = { fontSize: 22, fontWeight: 900, color: "#ffd24a", marginTop: 4 };
