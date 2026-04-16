import { useState, useEffect, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

function Picker() {
  const [color, setColor] = useState("#000000");
  const divRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    divRef.current?.focus();

    let unlisten: (() => void) | undefined;
    listen<string>("color-update", (e) => setColor(e.payload))
      .then((fn) => { unlisten = fn; });

    return () => { unlisten?.(); };
  }, []);

  const confirm = useCallback(() => {
    invoke("confirm_color", { color }).catch(() => {});
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
      onMouseDown={confirm}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") confirm(); }}
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
      <span style={{ color: "#fff", fontSize: 13, fontFamily: '"Martian Mono", monospace' }}>
        {color}
      </span>
    </div>
  );
}

export default Picker;
