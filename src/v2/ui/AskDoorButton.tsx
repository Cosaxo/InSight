// AskDoorButton — the header "+" that leaves the app for the web ask page
// (D-2026-09-12c). A React.lazy chunk: app-shell asks data/askDoor.ts whether to
// draw it at all (Android only) and fetches this only on a yes, so the iOS
// build never loads these bytes and the eager graph carries none of them
// — askDoor.ts's header has the 484-byte arithmetic that split the two,
// and why the Suspense fallback in the shell is null rather than a slot.
//
// Same control class and glyph weight as the Search button beside it: a
// peer, not a promotion. The name is the door's own ("Ask a question",
// D288 §1) and it is what smoke-live and ask-door-platform query for.
import React from "react";
import { SITE_ORIGIN } from "../data/siteOrigin";

/** The web door's address. Absolute, because it leaves the app; local,
 * because an export beside a component trips react-refresh and an eager
 * copy in data/askDoor.ts was 40 of the bytes the gate refused. */
const ASK_URL = `${SITE_ORIGIN}/ask`;

/**
 * Leave the app for the web door. The system browser, the same hop the
 * pre-D368 pay tap made to Stripe (`window.open(url, '_blank')`) — the
 * page signs the buyer in itself, and the app never learns of the
 * purchase from here (the webhook is the truth; Asked by you reads it).
 * Local, not exported: a function beside a component export trips
 * react-refresh/only-export-components (CurSwitch.tsx's note), and the
 * click is the only caller — AskDoorButton.test.tsx drives it through it.
 */
function openAskDoor(): void {
  window.open(ASK_URL, "_blank", "noopener,noreferrer");
}

export default function AskDoorButton(): React.ReactElement {
  return (
    <button className="icon-btn" aria-label="Ask a question" onClick={openAskDoor}>
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M12 5v14M5 12h14"></path></svg>
    </button>
  );
}
