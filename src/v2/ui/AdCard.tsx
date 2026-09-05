// A feed ad (D197) — docs/MONETIZATION.md path 3.
//
// AN AD IS NOT A SPONSORED QUESTION, and keeping the two apart is the
// reason this file exists rather than a flag on the other one. Path 2
// sells a QUESTION: it is answered like any other, folds into the same
// public aggregate everyone reads, and the buyer's return is that split.
// Path 3 sells a CARD: it asks nothing, takes no answer, and produces no
// data at all. They share the disclosure band and the paid places (one
// card in six since D377; a single slot before it); they are otherwise
// different objects, and prose that blurred them made
// the disclosure argument impossible to have (D196).
//
// TEXT ONLY, AND NO TAP-THROUGH. No image, no logo, no brand colour, no
// link — `check:content` refuses each of those BY NAME on the source
// entry, so adding one is a conversation rather than a commit. The
// missing link is not an omission either: with nowhere to send you there
// is no click, and with no click there is nothing to attribute, which is
// what keeps this path clear of the measurement apparatus
// MONETIZATION.md rules out. Billing stays on the answers path 2 already
// publishes.
//
// The card is deliberately QUIETER than a question card: no hero type, no
// hue, no full-bleed. An ad that shouted would be an ad the feed's own
// hierarchy was working for.
import React from "react";
import SponsorMark from "./SponsorMark";
import type { FeedAd } from "../data/sponsored";

export default function AdCard({ ad }: { ad: FeedAd }): React.ReactElement {
  return (
    <div
      className="card"
      data-screen-label="Ad"
      style={{
        display: "flex", flexDirection: "column", gap: 9,
        padding: "13px 14px 14px",
        // The app's own ground, not a surface of its own. A tinted slab
        // would read as a placement rather than as a card in a feed.
        background: "var(--surface-2)",
      }}
    >
      {/* The disclosure is the app's, never the buyer's — the same band a
          sponsored question wears, for the same reason and from the same
          component. An advertiser cannot restyle it, because nothing in
          content/ads.json can carry a style. */}
      <SponsorMark sponsor={{ buyer: ad.advertiser, audience: ad.audience }} until={ad.until} />
      <div style={{
        fontFamily: "var(--sans)", fontWeight: 800, fontSize: 16.5,
        lineHeight: 1.22, letterSpacing: "-0.02em", textWrap: "balance",
      }}>{ad.headline}</div>
      <div style={{
        fontFamily: "var(--sans)", fontWeight: 600, fontSize: 13.5,
        lineHeight: 1.45, color: "var(--ink-2)", textWrap: "pretty",
      }}>{ad.body}</div>
    </div>
  );
}
