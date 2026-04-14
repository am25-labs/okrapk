import { useState, useRef, useCallback, useEffect } from "react";
import { syncColor, type ColorPayload } from "../lib/api";
import { formatForApi } from "../lib/color";
import { getCurrentWindow } from "@tauri-apps/api/window";
import type { AuthState } from "./useAuth";

export type SyncStatus = "idle" | "syncing" | "error" | "saved";

export interface SyncState {
  syncStatus: SyncStatus;
  saveColor: (hex: string) => Promise<void>;
  flushQueue: () => Promise<void>;
}

export function useSync(auth: AuthState): SyncState {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle");
  const pendingQueue = useRef<ColorPayload[]>([]);

  const flushQueue = useCallback(async () => {
    if (!auth.isLoggedIn || pendingQueue.current.length === 0) return;

    const queue = [...pendingQueue.current];
    pendingQueue.current = [];

    for (const payload of queue) {
      try {
        const token = await auth.getValidAccessToken();
        await syncColor(payload, token);
      } catch {
        pendingQueue.current.push(payload);
      }
    }
  }, [auth]);

  const saveColor = useCallback(async (hex: string) => {
    const payload = formatForApi(hex);
    setSyncStatus("syncing");

    // Flush any pending items first
    await flushQueue();

    try {
      const token = await auth.getValidAccessToken();
      await syncColor(payload, token);
      setSyncStatus("saved");
      setTimeout(() => setSyncStatus("idle"), 1500);
    } catch (err: any) {
      if (err?.status === 401) {
        // getValidAccessToken already attempted refresh — if we're here, session is gone
        setSyncStatus("error");
        return;
      }
      pendingQueue.current.push(payload);
      setSyncStatus("error");
    }
  }, [auth, flushQueue]);

  // Flush queue on window focus
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    getCurrentWindow().onFocusChanged(({ payload: focused }) => {
      if (focused) flushQueue();
    }).then((fn) => { unlisten = fn; });
    return () => { unlisten?.(); };
  }, [flushQueue]);

  // Flush queue after login
  useEffect(() => {
    if (auth.isLoggedIn) flushQueue();
  }, [auth.isLoggedIn, flushQueue]);

  return { syncStatus, saveColor, flushQueue };
}
