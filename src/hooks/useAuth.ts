import { useState, useEffect, useRef, useCallback } from "react";
import { desktopLogin, refreshAccessToken, apiLogout, type AuthUser } from "../lib/api";
import { loadTokens, saveTokens, clearTokens } from "../lib/store";

export interface AuthState {
  isLoggedIn: boolean;
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  getValidAccessToken: () => Promise<string>;
}

function jwtExp(token: string): number {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.exp as number;
  } catch {
    return 0;
  }
}

function isExpired(token: string): boolean {
  // Refresh 30s before actual expiry
  return jwtExp(token) - 30 < Date.now() / 1000;
}

export function useAuth(): AuthState {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Keep a ref so getValidAccessToken always sees the latest tokens
  const tokensRef = useRef({ accessToken, refreshToken });
  useEffect(() => {
    tokensRef.current = { accessToken, refreshToken };
  }, [accessToken, refreshToken]);

  const getValidAccessToken = useCallback(async (): Promise<string> => {
    const { accessToken: at, refreshToken: rt } = tokensRef.current;

    if (!at || !rt) throw new Error("Not authenticated");

    if (!isExpired(at)) return at;

    const { accessToken: newAt } = await refreshAccessToken(rt).catch(() => {
      throw new Error("Session expired");
    });

    setAccessToken(newAt);
    await saveTokens(newAt, rt);
    tokensRef.current = { accessToken: newAt, refreshToken: rt };
    return newAt;
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setError(null);
    const { accessToken: at, refreshToken: rt, user: u } = await desktopLogin(email, password);
    await saveTokens(at, rt);
    setAccessToken(at);
    setRefreshToken(rt);
    setUser(u);
    setIsLoggedIn(true);
    tokensRef.current = { accessToken: at, refreshToken: rt };
  }, []);

  const logout = useCallback(async () => {
    const { refreshToken: rt } = tokensRef.current;
    if (rt) await apiLogout(rt).catch(() => {});
    await clearTokens();
    setAccessToken(null);
    setRefreshToken(null);
    setUser(null);
    setIsLoggedIn(false);
    tokensRef.current = { accessToken: null, refreshToken: null };
  }, []);

  // Restore session on mount
  useEffect(() => {
    (async () => {
      try {
        const { accessToken: at, refreshToken: rt } = await loadTokens();
        if (!at || !rt) return;

        tokensRef.current = { accessToken: at, refreshToken: rt };
        setAccessToken(at);
        setRefreshToken(rt);

        // Validate / refresh silently
        const validAt = isExpired(at)
          ? await refreshAccessToken(rt).then((r) => r.accessToken)
          : at;

        if (validAt !== at) {
          await saveTokens(validAt, rt);
          setAccessToken(validAt);
          tokensRef.current = { accessToken: validAt, refreshToken: rt };
        }

        setIsLoggedIn(true);
      } catch {
        await clearTokens();
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  return { isLoggedIn, user, accessToken, refreshToken, isLoading, error, login, logout, getValidAccessToken };
}
