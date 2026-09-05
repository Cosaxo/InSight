// The share control of a sponsored question's results page (D374).
//
// Its own module rather than a second export of SponsorMark.tsx, and the
// reason is the entry chunk: the buyer's room (AskedByYouOverlay) is in
// the eager graph and the band, the sponsor module and the cohort labels
// behind it are not — one button must not drag all three in
// (check:bundle holds the eager graph to the kilobyte, and it did).
import React from "react";
import { resultsLinkFor } from "../data/links";

/**
 * Copies the public address of this question's results — the same
 * numbers everyone reads, as one web page anyone can open. On the
 * answered face of every sponsored card and in the buyer's room, because
 * the page is the payoff a buyer points at and a reader can post. The
 * clipboard, like the invite link (LdCopyLink): a copied address is a
 * share on every platform without a share sheet.
 */
export function SponsorShare({ qid }: { qid: string }): React.ReactElement {
  const [copied, setCopied] = React.useState(false);
  const copy = (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      void navigator.clipboard.writeText(resultsLinkFor(qid));
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch { /* clipboard unavailable */ }
  };
  return (
    <button className="press" type="button" onClick={copy}
      aria-label="Copy the link to this question's results page" title="Copy the results link"
      style={{
        flexShrink: 0, border: "0.5px solid var(--rule)", background: "var(--surface-2)", borderRadius: 999,
        padding: "5px 12px", cursor: "pointer", fontFamily: "var(--sans)", fontSize: 11.5, fontWeight: 700,
        color: "var(--ink-2)", WebkitAppearance: "none",
      }}>
      {copied ? "link copied ✓" : "share results"}
    </button>
  );
}
