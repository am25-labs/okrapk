import { useState, useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";

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

function App() {
  const [color, setColor] = useState<string | null>(null);

  useEffect(() => {
    // Pedir el color almacenado por si el evento llegó antes de montar
    invoke<string | null>("get_last_color").then((c) => { if (c) setColor(c); });

    let unlisten: (() => void) | undefined;
    listen<string>("color-picked", (e) => setColor(e.payload))
      .then((fn) => { unlisten = fn; });
    return () => { unlisten?.(); };
  }, []);

  if (!color) {
    return (
      <div style={{ position: "fixed", inset: 0, background: "#111" }}>
        <span style={{
          position: "absolute", top: 12, left: 14,
          fontWeight: 700, fontSize: 11, letterSpacing: 2,
          color: "rgba(255,255,255,0.2)",
        }}>
          OKRA
        </span>
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
      <span style={{
        position: "absolute", top: 12, left: 14,
        fontWeight: 700, fontSize: 11, letterSpacing: 2,
        color: label,
      }}>
        OKRA
      </span>

      <div style={{ flex: 1 }} />

      <div style={{
        height: "33%",
        background: "rgba(0,0,0,0.35)",
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
