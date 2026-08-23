import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Capacitor configuration for the ZAIan Studio · زيان ستوديو native shells.
 *
 * Both Android and iOS wrap the live web app — when the host is reachable
 * we serve from there (instant updates, no app-store review needed for
 * content changes). When offline, the bundled web assets in `webDir` take
 * over via the service worker, so the app keeps working in local mode.
 *
 * Build:
 *   Android  →  npm run android:init   (first time)
 *               npm run android:sync   (after each web build)
 *               npm run android:open   (Android Studio)
 *   iOS      →  npm run ios:init       (first time, needs macOS + Xcode)
 *               npm run ios:sync       (after each web build)
 *               npm run ios:open       (Xcode)
 */

const PRODUCTION_URL = "https://www.pitchora.ai";

const config: CapacitorConfig = {
  appId: "com.zaian.studio",
  appName: "ZAIan Studio",
  webDir: "../public",
  server: {
    url: PRODUCTION_URL,
    cleartext: false,
    androidScheme: "https",
    iosScheme: "https"
  },
  android: {
    backgroundColor: "#0b1120"
  },
  ios: {
    backgroundColor: "#0b1120",
    contentInset: "always",
    // Lets the in-app web view request microphone permission for the voice
    // input. Pair with NSMicrophoneUsageDescription in Info.plist.
    limitsNavigationsToAppBoundDomains: false
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 800,
      backgroundColor: "#0b1120",
      androidScaleType: "CENTER_CROP",
      showSpinner: false
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#0b1120"
    }
  }
};

export default config;
