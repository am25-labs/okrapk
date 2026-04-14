const BASE_URL = `${import.meta.env.VITE_API_URL as string}/v1`;
const DESKTOP_KEY = import.meta.env.VITE_DESKTOP_KEY as string;

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: string;
  plan: string;
  createdAt: string;
}

export interface ColorPayload {
  hex: string;
  rgb: string;
  hsl: string;
}

async function apiFetch(path: string, options: RequestInit, token?: string) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const err = Object.assign(new Error(body.error ?? res.statusText), { status: res.status });
    throw err;
  }

  if (res.status === 204) return null;
  return res.json();
}

export async function desktopLogin(email: string, password: string): Promise<AuthTokens & { user: AuthUser }> {
  return apiFetch("/auth/desktop/login", {
    method: "POST",
    headers: { "x-desktop-key": DESKTOP_KEY },
    body: JSON.stringify({ email, password }),
  });
}

export async function refreshAccessToken(refreshToken: string): Promise<{ accessToken: string }> {
  return apiFetch("/auth/refresh", {
    method: "POST",
    body: JSON.stringify({ refreshToken }),
  });
}

export async function apiLogout(refreshToken: string): Promise<void> {
  await apiFetch("/auth/logout", {
    method: "POST",
    body: JSON.stringify({ refreshToken }),
  });
}

export async function syncColor(payload: ColorPayload, accessToken: string) {
  return apiFetch("/colors", {
    method: "POST",
    body: JSON.stringify({ ...payload, source: "PICKER" }),
  }, accessToken);
}
