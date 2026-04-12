# OKRA

A minimal color picker for Windows. Pick any color from your screen with a global hotkey, get the value in HEX, RGB, HSL, and CSS formats instantly.

## Features

- **Alt+C** — opens a floating picker that follows your cursor
- Click to confirm — copies the hex value to your clipboard
- Main window shows the picked color with all format variants
- Runs in the system tray, always available

## Download

Grab the latest installer from the [Releases](../../releases) page.

## Development

**Prerequisites:** Rust, Node.js 18+, pnpm

```bash
pnpm install
pnpm tauri dev
```

**Build:**

```bash
pnpm tauri build
```

## Tech

- [Tauri v2](https://tauri.app) — native Windows shell (WebView2 + Rust)
- React + TypeScript — UI
- Win32 API — pixel color sampling via `GetDC` / `GetPixel`
