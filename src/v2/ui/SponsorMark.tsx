// The disclosure on a sponsored question (D195).
//
// THE HOUSE RULE, recorded before the first paid deal and built here:
// **the disclosure is the app's, never the buyer's.** So this band carries
// no brand colour, no logo, no link and no creative — it is the app's own
// ink, the word PAID, the buyer's name, and the window it was bought for.
// It replaces the topic chip rather than sitting beside it, because a paid
// card wearing a topic hue reads as house content with a note attached.
//
// Everything a bought question could hide, it says instead:
//
//   WHO paid            → the band
//   WHEN it runs        → the window, composed from `until` (one value, so
//                         the label and the serving filter cannot drift)
//   WHY you got it      → the coarse tag it was bought against, matched on
//                         THIS DEVICE (data/sponsored.ts), named in your
//                         own vocabulary — or "shown to everyone", which is
//                         information too and is not omitted
//   WHAT they receive   → the same public numbers you see
//
// That last line is the one the prototype got wrong and it is worth the
// comment. `design/standalone-v24/paid-data.js` promises the buyer gets
// "the counts and the standard cuts — never names, never your profile".
// Since D98 that is FALSE: answers are public and attributed, the
// who-voted sheet is named, and a buyer reading their own question's
// aggregate sees exactly what any signed-in user sees. The honest version
// is not a smaller promise, it is a different one — the sold number is the
// same number everyone reads for free, and there is no private cut. Saying
// the old sentence would be the `check:public-copy` failure class (D116)
// with money behind it.
import React from "react";
import { whyMatched, windowLabel, type Sponsor } from "../data/sponsored";

export default function SponsorMark(
  { sponsor, until }: { sponsor: Sponsor; until?: string },
): React.ReactElement {
  const [open, setOpen] = React.useState(false);
  const why = whyMatched(sponsor);
  const win = windowLabel(until);

  return (
    <span style={{ display: "inline-flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
      <button className="press" onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
        aria-expanded={open}
        aria-label={`Paid, by ${sponsor.buyer}. Why you are seeing this.`}
        style={{
          display: "inline-flex", alignItems: "center", gap: 8, minWidth: 0,
          // The app's ink, deliberately. Nothing here takes a hue from the
          // topic taxonomy or from a buyer.
          background: "var(--ink)", color: "var(--surface)",
          border: "none", borderRadius: 999, padding: "4px 11px",
          cursor: "pointer", WebkitAppearance: "none",
          fontFamily: "var(--sans)",
        }}>
        <span style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: "0.16em" }}>PAID</span>
        <span style={{
          fontSize: 12.5, fontWeight: 700, minWidth: 0,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>{sponsor.buyer}</span>
        {win && <span style={{ fontSize: 11.5, fontWeight: 600, opacity: 0.72, whiteSpace: "nowrap" }}>· {win}</span>}
      </button>
      {open && (
        <span style={{
          display: "flex", flexDirection: "column", gap: 3,
          fontFamily: "var(--sans)", fontSize: 12, fontWeight: 600, color: "var(--ink-3)",
          padding: "2px 2px 4px",
        }}>
          <span>
            {why.length
              ? `${sponsor.buyer} asked for ${why.join(" · ")}, and your profile says that.`
              : `${sponsor.buyer} asked everyone — nothing about you decided this.`}
          </span>
          <span>They get the same public numbers you do. There is no private cut.</span>
        </span>
      )}
    </span>
  );
}
