import { useState } from "react";
import { C, FONT_STACK } from "../../theme";
import { googleSignIn } from "../../lib/firebase";

interface LoginScreenProps {
  error?: string | null;
}

export function LoginScreen({ error }: LoginScreenProps) {
  const [loading, setLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  async function onClick() {
    setLoading(true);
    setLocalError(null);
    try {
      await googleSignIn();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Sign-in failed";
      setLocalError(msg);
    } finally {
      setLoading(false);
    }
  }

  const shown = localError ?? error ?? null;

  return (
    <div
      style={{
        maxWidth: 430,
        margin: "0 auto",
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: C.bg,
        padding: "0 32px",
        fontFamily: FONT_STACK,
      }}
    >
      <div
        style={{
          width: 80,
          height: 80,
          borderRadius: 24,
          background: `conic-gradient(from 0deg, ${C.teal}, ${C.blue}, ${C.purple}, ${C.pink}, ${C.coral}, ${C.amber}, ${C.teal})`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
          marginBottom: 24,
        }}
      >
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" fill="rgba(255,255,255,0.2)" />
          <path
            d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"
            fill="none"
            stroke="white"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <circle cx="12" cy="12" r="3" fill="white" />
        </svg>
      </div>

      <div
        style={{
          fontSize: 28,
          fontWeight: 800,
          color: C.navy,
          marginBottom: 8,
          letterSpacing: "-0.5px",
        }}
      >
        InSight
      </div>
      <div
        style={{
          fontSize: 15,
          color: C.muted,
          textAlign: "center",
          lineHeight: 1.6,
          marginBottom: 40,
        }}
      >
        Understand yourself and the people around you
      </div>

      <div style={{ display: "flex", gap: 20, marginBottom: 48 }}>
        {[
          { icon: "🧠", label: "Personality", sub: "Big Five" },
          { icon: "⚖️", label: "Political", sub: "Compass" },
          { icon: "🧭", label: "Core Values", sub: "Compass" },
        ].map((s, i) => (
          <div key={i} style={{ textAlign: "center" }}>
            <div style={{ fontSize: 22, marginBottom: 4 }}>{s.icon}</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: C.navy }}>
              {s.label}
            </div>
            <div style={{ fontSize: 10, color: C.muted }}>{s.sub}</div>
          </div>
        ))}
      </div>

      <button
        onClick={onClick}
        disabled={loading}
        style={{
          width: "100%",
          padding: "16px",
          borderRadius: 16,
          border: "none",
          background: loading ? C.dim : C.navy,
          color: loading ? C.muted : "#fff",
          fontFamily: "inherit",
          fontSize: 16,
          fontWeight: 700,
          cursor: loading ? "default" : "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 12,
          boxShadow: loading ? "none" : "0 4px 20px rgba(15,23,42,0.25)",
          transition: "all 0.2s",
        }}
      >
        {!loading && (
          <svg width="20" height="20" viewBox="0 0 24 24">
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              fill="#EA4335"
            />
          </svg>
        )}
        {loading ? "Signing in…" : "Continue with Google"}
      </button>

      {shown && (
        <div
          style={{
            marginTop: 16,
            padding: "10px 14px",
            borderRadius: 12,
            background: `${C.red}12`,
            border: `1px solid ${C.red}33`,
            color: C.red,
            fontSize: 12,
            textAlign: "center",
            lineHeight: 1.5,
            width: "100%",
          }}
        >
          {shown}
        </div>
      )}

      <div
        style={{
          fontSize: 11,
          color: C.muted,
          marginTop: 20,
          textAlign: "center",
          lineHeight: 1.7,
        }}
      >
        Your data is stored privately in your Google account's Firestore subtree.
        <br />
        See firestore.rules in the repo.
      </div>
    </div>
  );
}

export function LoadingScreen() {
  return (
    <div
      style={{
        maxWidth: 430,
        margin: "0 auto",
        height: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: C.bg,
        fontFamily: FONT_STACK,
      }}
    >
      <div style={{ textAlign: "center" }}>
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 14,
            background: `${C.teal}20`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 16px",
          }}
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke={C.teal}
            strokeWidth="2"
            strokeLinecap="round"
          >
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        </div>
        <div style={{ fontSize: 14, color: C.muted }}>Loading…</div>
      </div>
    </div>
  );
}
