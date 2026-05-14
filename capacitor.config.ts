import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.cosaxo.insight",
  appName: "InSight",
  // Vite outputs to ./dist; Capacitor copies from here into the native
  // shells on `cap sync`.
  webDir: "dist",
  // Use the in-app keyboard to keep the WebView's viewport stable when
  // it opens — the journal screens have plenty of text inputs.
  plugins: {
    SplashScreen: {
      // Show the splash for at most 1.2 s so we hide the WebView's
      // first-paint flash but don't add perceived latency.
      launchShowDuration: 1200,
      launchAutoHide: true,
      // Match the paper background so the transition is invisible.
      backgroundColor: "#FAF9F2",
      androidSplashResourceName: "splash",
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
    },
    Keyboard: {
      // Resize the WebView frame when the keyboard opens (instead of
      // overlay-mode, which leaves content hidden behind the keyboard).
      resize: "body",
    },
    StatusBar: {
      // The app handles its own status-bar styling via the .dark class;
      // tell Capacitor to honour overlay drawing so safe-area-inset
      // CSS keeps working.
      overlaysWebView: true,
      style: "DEFAULT",
      backgroundColor: "#FAF9F2",
    },
  },
};

export default config;
