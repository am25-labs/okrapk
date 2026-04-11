import { useState, useEffect, useCallback } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { CopyIcon, CheckIcon, PipetteIcon } from "lucide-react";
import Logo from "./assets/Logo";

function hexToRgb(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return { r, g, b };
}

function rgbToHsl(r: number, g: number, b: number) {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l: Math.round(l * 100) };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
  else if (max === gn) h = ((bn - rn) / d + 2) / 6;
  else h = ((rn - gn) / d + 4) / 6;
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

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

  useEffect(() => {
    invoke<string | null>("get_last_color").then((c) => { if (c) setColor(c); });
    let unlisten: (() => void) | undefined;
    listen<string>("color-picked", (e) => setColor(e.payload))
      .then((fn) => { unlisten = fn; });
    return () => { unlisten?.(); };
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

  if (!color) {
    return (
      <div style={{ position: "fixed", inset: 0, background: "#111" }}>
        <div style={{ position: "absolute", top: 12, left: 14 }}>
          <Logo color="rgba(255,255,255,0.2)" />
        </div>
        <div style={{ position: "absolute", top: 8, right: 10, display: "flex", gap: 2 }}>
          <button style={{ ...btnStyle, color: "rgba(255,255,255,0.2)" }} onClick={handlePicker}>
            <PipetteIcon size={16} />
          </button>
        </div>
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
        <button style={{ ...btnStyle, color: label }} onClick={handleCopy}>
          {copied ? <CheckIcon size={16} /> : <CopyIcon size={16} />}
        </button>
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
              fontFamily: "monospace",
              color: "rgba(255,255,255,0.45)",
              flexShrink: 0,
            }}>
              {format}
            </span>
            <span style={{
              fontSize: 14,
              fontFamily: "monospace",
              color: "#fff",
            }}>
              {value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;
