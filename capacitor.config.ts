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
      // The splash covers the live-hydration window: main.jsx hides it
      // explicitly right after the first React render, so a cold boot
      // never shows a blank WebView between the 1.2 s auto-hide and
      // first paint. launchShowDuration is the safety ceiling.
      launchShowDuration: 5000,
      launchAutoHide: false,
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
    PushNotifications: {
      // Show the reveal notification even when the app is foregrounded.
      presentationOptions: ["badge", "sound", "alert"],
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
