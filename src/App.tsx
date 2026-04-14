import { useState, useEffect, useCallback } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { getVersion } from "@tauri-apps/api/app";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { CopyIcon, CheckIcon, PipetteIcon, ArrowUpCircleIcon } from "lucide-react";
import Logo from "./assets/Logo";
import { hexToRgb, rgbToHsl } from "./lib/color";
import { useAuth } from "./hooks/useAuth";
import { useSync } from "./hooks/useSync";
import SyncIcon from "./components/SyncIcon";
import SaveButton from "./components/SaveButton";
import AuthPanel from "./components/AuthPanel";

function contrastColor(r: number, g: number, b: number) {
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.5
    ? "rgba(0,0,0,0.6)"
    : "rgba(255,255,255,0.6)";
}

const btnStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  padding: 4,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

function App() {
  const [color, setColor] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [updateVersion, setUpdateVersion] = useState<string | null>(null);
  const [showAuth, setShowAuth] = useState(false);

  const auth = useAuth();
  const { syncStatus, saveColor } = useSync(auth);

  useEffect(() => {
    invoke<string | null>("get_last_color").then((c) => { if (c) setColor(c); });
    getVersion().then((v) => {
      getCurrentWindow().setTitle(`OKRA - ${v}`);
    });
    let unlistenColor: (() => void) | undefined;
    let unlistenUpdate: (() => void) | undefined;
    listen<string>("color-picked", (e) => setColor(e.payload))
      .then((fn) => { unlistenColor = fn; });
    listen<string>("update-available", (e) => setUpdateVersion(e.payload))
      .then((fn) => { unlistenUpdate = fn; });
    return () => { unlistenColor?.(); unlistenUpdate?.(); };
  }, []);

  const handleCopy = useCallback(() => {
    if (!color) return;
    navigator.clipboard.writeText(color.replace("#", ""));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [color]);

  const handlePicker = useCallback(() => {
    invoke("open_picker").catch(console.error);
  }, []);

  const handleUpdate = useCallback(() => {
    invoke("install_update").catch(console.error);
  }, []);

  if (!color) {
    return (
      <div style={{ position: "fixed", inset: 0, background: "#111" }}>
        <div style={{ position: "absolute", top: 12, left: 14 }}>
          <Logo color="rgba(255,255,255,0.2)" />
        </div>
        <div style={{ position: "absolute", top: 8, right: 10, display: "flex", gap: 2 }}>
          {updateVersion && (
            <button style={{ ...btnStyle, color: "#e9f52f" }} onClick={handleUpdate} title={`Update to ${updateVersion}`}>
              <ArrowUpCircleIcon size={16} />
            </button>
          )}
          <SyncIcon auth={auth} labelColor="rgba(255,255,255,0.2)" onClick={() => setShowAuth((v) => !v)} />
          <button style={{ ...btnStyle, color: "rgba(255,255,255,0.2)" }} onClick={handlePicker}>
            <PipetteIcon size={16} />
          </button>
        </div>
        {showAuth && <AuthPanel auth={auth} onClose={() => setShowAuth(false)} />}
      </div>
    );
  }

  const { r, g, b } = hexToRgb(color);
  const { h, s, l } = rgbToHsl(r, g, b);
  const label = contrastColor(r, g, b);

  const rows = [
    { format: "HEX", value: color },
    { format: "RGB", value: `${r}, ${g}, ${b}` },
    { format: "HSL", value: `${h}°, ${s}%, ${l}%` },
    { format: "CSS", value: `rgb(${r}, ${g}, ${b})` },
  ];

  return (
    <div style={{ position: "fixed", inset: 0, background: color, display: "flex", flexDirection: "column" }}>
      <div style={{ position: "absolute", top: 12, left: 14 }}>
        <Logo color={label} />
      </div>

      <div style={{ position: "absolute", top: 8, right: 10, display: "flex", gap: 2 }}>
        {updateVersion && (
          <button style={{ ...btnStyle, color: "#e9f52f" }} onClick={handleUpdate} title={`Update to ${updateVersion}`}>
            <ArrowUpCircleIcon size={16} />
          </button>
        )}
        {auth.isLoggedIn && (
          <SaveButton syncStatus={syncStatus} labelColor={label} onSave={() => saveColor(color)} />
        )}
        <button style={{ ...btnStyle, color: label }} onClick={handleCopy}>
          {copied ? <CheckIcon size={16} /> : <CopyIcon size={16} />}
        </button>
        <SyncIcon auth={auth} labelColor={label} onClick={() => setShowAuth((v) => !v)} />
        <button style={{ ...btnStyle, color: label }} onClick={handlePicker}>
          <PipetteIcon size={16} />
        </button>
      </div>

      <div style={{ flex: 1 }} />

      <div style={{
        height: "33%",
        background: `rgb(${Math.round(r*0.65)}, ${Math.round(g*0.65)}, ${Math.round(b*0.65)})`,
        padding: "0 20px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        gap: 10,
      }}>
        {rows.map(({ format, value }) => (
          <div key={format} style={{ display: "flex", alignItems: "center" }}>
            <span style={{
              width: 40,
              fontSize: 12,
              fontWeight: 700,
              color: "rgba(255,255,255,0.45)",
              flexShrink: 0,
            }}>
              {format}
            </span>
            <span style={{
              fontSize: 14,
              fontFamily: '"JetBrains Mono", monospace',
              color: "#fff",
            }}>
              {value}
            </span>
          </div>
        ))}
      </div>

      {showAuth && <AuthPanel auth={auth} onClose={() => setShowAuth(false)} />}
    </div>
  );
}

export default App;
