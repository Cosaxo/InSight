import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.cosaxo.insight",
  appName: "InSight",
  // Vite outputs to ./dist; Capacitor copies from here into the native
  // shells on `cap sync`.
  webDir: "dist",
  plugins: {
    SplashScreen: {
      // The splash covers the live-hydration window: main.jsx hides it
      // explicitly right after the first React render, so a cold boot
      // never shows a blank WebView between the default auto-hide and
      // first paint. launchShowDuration is the safety ceiling.
      //
      // autoHide is TRUE and that is what makes the sentence above true.
      // launchShowDuration is documented — and implemented, in both
      // SplashScreen.java and SplashScreen.swift — as "how long to show the
      // launch splash screen WHEN AUTOHIDE IS ENABLED": the timer is
      // scheduled only inside that branch. Paired with `false` it was dead
      // config, so there was no ceiling at all, and anything throwing
      // between initLive().finally and main.jsx's hide() left the native
      // splash up forever with #boot stranded behind it. The explicit
      // hide() still wins in the ordinary case — it fires long before 5 s —
      // so this changes nothing about a healthy boot and bounds a sick one.
      launchShowDuration: 5000,
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
      // The v2 app has few text inputs — a display name, a group name, an
      // invite code — but each one sits in a sheet near the bottom of the
      // screen, which is exactly where overlay-mode hides it.
      resize: "body",
      // `resize` is iOS-ONLY (the plugin's own README says so on that row),
      // so the paragraph above described half a fix: on Android nothing
      // resized and every one of those fields sat under the keyboard.
      //
      // This is the Android half, and the plugin documents it against this
      // exact app: "There is an Android bug that prevents the keyboard from
      // resizing the WebView when the app is in full screen (i.e. if
      // StatusBar plugin is used to overlay the status bar)." StatusBar
      // below sets overlaysWebView: true, so the app is precisely the case
      // the workaround exists for — and nothing scrolls to compensate,
      // because the shell is position: fixed; overflow: hidden (spec/iOS.jsx).
      resizeOnFullScreen: true,
    },
    PushNotifications: {
      // Show the reveal notification even when the app is foregrounded.
      presentationOptions: ["badge", "sound", "alert"],
    },
    FirebaseAuthentication: {
      // The plugin loads no providers by default, so the native Google
      // sheet never opens without this list — the account-upgrade path
      // (D3) is dead on both platforms until it is set.
      providers: ["google.com"],
      // The JS SDK owns the session: googleSignIn/linkGoogle take the
      // native idToken and hand it to signInWithCredential /
      // linkWithCredential so Firestore keeps using the same auth
      // instance and the same uid. Without this the native layer signs
      // in separately and the two disagree about who the user is —
      // and uid *is* the identity that owns every answer document.
      skipNativeAuth: true,
    },
    StatusBar: {
      // Tell Capacitor to honour overlay drawing so safe-area-inset CSS
      // keeps working.
      overlaysWebView: true,
      // LIGHT is the plugin's name for DARK CONTENT ("Dark text for light
      // backgrounds", definitions.d.ts) — which is what this app needs,
      // because it is light-only and its chrome is #FAF9F2 at every hour.
      //
      // It was DEFAULT, under a comment saying the app handles its own
      // status-bar styling via the `.dark` class. Nothing has set that
      // class since the v15 revision removed the dark-mode switch outright
      // (DECISIONS.md:2265, app-shell.jsx:34) — the `.dark` rules survive
      // in styles.css with no writer. So the claim was carrying the
      // configuration, and DEFAULT means "based on the device appearance:
      // if the device is using Dark mode, the statusbar text will be
      // light". Every dark-mode phone therefore drew WHITE glyphs straight
      // onto paper-white, for the whole session, because overlaysWebView
      // puts them on the app's own ground rather than a bar of their own.
      //
      // This is a site dark mode has to move: when prefers-color-scheme is
      // wired (still its own piece of work, D-record above), the style
      // becomes a runtime call rather than a constant.
      style: "LIGHT",
      backgroundColor: "#FAF9F2",
    },
  },
};

export default config;
