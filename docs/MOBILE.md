# Mobile App — Android (PWA + Capacitor)

The product is mobile-ready in two layers, ordered by time-to-ship.

## Layer 1 — Installable PWA (works today)

The app is already a Progressive Web App. On Android Chrome:

1. Visit your Vercel URL (e.g. `https://www.pitchora.ai`).
2. Tap the kebab menu → **Install app** / **Add to Home screen**.
3. The app launches in standalone mode (no browser chrome), with the
   gradient icon, themed status bar, and offline shell caching.

What's included:
- `public/manifest.webmanifest` — name, icons, theme, scope, display: standalone
- `public/sw.js` — network-first nav, cache-first static, API routes excluded
- `<meta name="theme-color">` and Apple touch icon hints in the layout

## Layer 2 — Native Android APK via Capacitor

The `mobile/` folder is a Capacitor wrapper that bundles the live URL
into a real `.apk` you can publish to Play Store.

### Prerequisites

- Node 18+
- Android Studio (with Android SDK + an AVD or device)
- JDK 17

### Build

```bash
cd mobile
npm install
npm run android:init          # adds android/ project (one-time)
npm run android:sync          # copies config + plugins
npm run android:open          # opens Android Studio
# In Android Studio: Build → Build Bundle/APK → Build APK
```

To swap the wrapped URL, edit `mobile/capacitor.config.ts` (`server.url`).
For local dev against a laptop running `npm run dev`, use
`http://10.0.2.2:3000` from the Android emulator.

### Plugins included

- `@capacitor/splash-screen` — branded launch screen
- `@capacitor/status-bar` — themed status bar
- (Add `@capacitor/keyboard` later if building a custom IME, see below.)

## Future: Grammarly-style writing-assistant IME

Grammarly's killer feature on Android is an **input method editor (IME)** —
a custom keyboard that surfaces suggestions inside any app. That's a separate
native Android project (Kotlin) under `mobile/keyboard/`. Path:

1. Implement `InputMethodService` that opens the prompt editor.
2. Call `POST /api/extension/enhance` with the user's text.
3. On Done, write the rebuilt prompt back via `InputConnection.commitText`.
4. Distribute via the same APK (multi-component app + IME).

This is non-trivial (multi-week) and is intentionally **out of scope** for
v0.1. The PWA + Capacitor wrapper covers >90% of the use case in <1 day.
