import { Store } from "@tauri-apps/plugin-store";

const store = new Store("auth.dat");

export async function loadTokens() {
  const accessToken = await store.get<string>("accessToken");
  const refreshToken = await store.get<string>("refreshToken");
  return {
    accessToken: accessToken ?? null,
    refreshToken: refreshToken ?? null,
  };
}

export async function saveTokens(accessToken: string, refreshToken: string) {
  await store.set("accessToken", accessToken);
  await store.set("refreshToken", refreshToken);
  await store.save();
}

export async function clearTokens() {
  await store.delete("accessToken");
  await store.delete("refreshToken");
  await store.save();
}
