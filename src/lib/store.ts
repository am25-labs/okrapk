import { load } from "@tauri-apps/plugin-store";

async function getStore() {
  return load("auth.dat", { autoSave: false, defaults: {} });
}

export async function loadTokens() {
  const store = await getStore();
  const accessToken = await store.get<string>("accessToken");
  const refreshToken = await store.get<string>("refreshToken");
  return {
    accessToken: accessToken ?? null,
    refreshToken: refreshToken ?? null,
  };
}

export async function saveTokens(accessToken: string, refreshToken: string) {
  const store = await getStore();
  await store.set("accessToken", accessToken);
  await store.set("refreshToken", refreshToken);
  await store.save();
}

export async function clearTokens() {
  const store = await getStore();
  await store.delete("accessToken");
  await store.delete("refreshToken");
  await store.save();
}
