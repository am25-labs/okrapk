import { useState, useEffect, useCallback, useRef } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";

function Picker() {
  const [color, setColor] = useState("#000000");
  const divRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    divRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") getCurrentWindow().close();
    };
    window.addEventListener("keydown", handleKeyDown);

    let unlisten: (() => void) | undefined;
    getCurrentWindow()
      .listen<string>("color-update", (e) => setColor(e.payload))
      .then((fn) => { unlisten = fn; });

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      unlisten?.();
    };
  }, []);

  const handleClick = useCallback(async () => {
    await navigator.clipboard.writeText(color);
    getCurrentWindow().close();
  }, [color]);

  return (
    <div
      ref={divRef}
      tabIndex={-1}
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "0 10px",
        background: "#1a1a1a",
        borderRadius: 6,
        cursor: "pointer",
        outline: "none",
      }}
      onClick={handleClick}
    >
      <div
        style={{
          width: 16,
          height: 16,
          borderRadius: 3,
          background: color,
          border: "1px solid rgba(255,255,255,0.2)",
          flexShrink: 0,
        }}
      />
      <span style={{ color: "#fff", fontSize: 13, fontFamily: "monospace" }}>
        {color}
      </span>
    </div>
  );
}

export default Picker;
