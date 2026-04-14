import { useState } from "react";
import type { AuthState } from "../hooks/useAuth";

interface Props {
  auth: AuthState;
  onClose: () => void;
}

export default function AuthPanel({ auth, onClose }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const panelStyle: React.CSSProperties = {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: "33%",
    background: "#1a1a1a",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    padding: "0 20px",
    gap: 10,
  };

  const inputStyle: React.CSSProperties = {
    background: "#2a2a2a",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 4,
    color: "#fff",
    fontSize: 13,
    padding: "5px 8px",
    outline: "none",
    width: "100%",
    boxSizing: "border-box",
  };

  const btnPrimary: React.CSSProperties = {
    background: "rgba(255,255,255,0.1)",
    border: "none",
    borderRadius: 4,
    color: "#fff",
    fontSize: 13,
    padding: "5px 0",
    cursor: "pointer",
    width: "100%",
  };

  const btnGhost: React.CSSProperties = {
    background: "none",
    border: "none",
    color: "rgba(255,255,255,0.3)",
    fontSize: 12,
    cursor: "pointer",
    padding: 0,
  };

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await auth.login(email, password);
      onClose();
    } catch (err: any) {
      setError(err?.message ?? "Sign in failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    await auth.logout();
    onClose();
  }

  if (auth.isLoggedIn) {
    return (
      <div style={panelStyle}>
        <span style={{ color: "#fff", fontSize: 13 }}>
          {auth.user?.firstName ?? auth.user?.email}
        </span>
        <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 12 }}>
          {auth.user?.email}
        </span>
        <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
          <button style={btnPrimary} onClick={handleLogout}>Sign out</button>
          <button style={btnGhost} onClick={onClose}>Cancel</button>
        </div>
      </div>
    );
  }

  return (
    <div style={panelStyle}>
      <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <input
          style={inputStyle}
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
        />
        <input
          style={inputStyle}
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
        />
        {error && (
          <span style={{ color: "rgba(251,191,36,0.8)", fontSize: 12 }}>{error}</span>
        )}
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button style={btnPrimary} type="submit" disabled={loading}>
            {loading ? "Signing in…" : "Sign in"}
          </button>
          <button style={btnGhost} type="button" onClick={onClose}>Cancel</button>
        </div>
      </form>
    </div>
  );
}
