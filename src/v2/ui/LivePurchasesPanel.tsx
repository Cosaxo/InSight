// LivePurchasesPanel — "Asked by you" (D230), the buyer's room.
//
// The card a buyer finds their questions in: what they bought, whether it
// is still running, and the same live public count everyone else reads.
// It renders NOTHING for an account with no orders — which is every
// account until a contract exists — so the panel costs the profile sheet
// one owner-only query and zero pixels for everyone who is not a buyer.
// That is also why it needs no empty state: "you have bought nothing" is
// not a message anyone opened their profile to read.
//
// What is deliberately NOT here:
//   · No checkout. Commerce stays on the web/contract side
//     (NEXT-FUNCTIONALITY §6; the app displays disclosed content, it
//     does not run a payment).
//   · No report download. Where a report goes is a per-contract term
//     (D225) and the artifact is built off-app (D229) — the room says so
//     plainly instead of growing a delivery pipeline before a buyer
//     exists.
//   · No privileged numbers. The count on each row is `LIVE.aggFor` —
//     the same public aggregate every card reads, which is the whole
//     pitch (MONETIZATION.md: packaging, never access).
//
// Mounted by LivePrivacyPanel via a real ESM import — a new panel does
// not join the global bridge (check:globals rule 4 only moves down).
import React from "react";
import LIVE from "../data/live";

const PU_LINE = "1px solid color-mix(in oklch, var(--rule), transparent 25%)";

function LivePurchasesPanel() {
  const [, tick] = React.useState(0);
  React.useEffect(() => LIVE.subscribe(() => tick((t) => t + 1)), []);
  React.useEffect(() => { void LIVE.loadPurchases(); }, []);
  if (!LIVE.enabled) return null;

  const rows = LIVE.purchases();
  // Null (unfetched or failed) and [] (a non-buyer) both render nothing:
  // the room exists for people with orders, and a loading skeleton for a
  // card almost nobody will ever have would be noise on every profile.
  if (!rows || !rows.length) return null;

  return (
    <div className="card" style={{ marginBottom: 14, padding: "14px 16px" }}>
      <div className="kicker" style={{ marginBottom: 4 }}>Asked by you</div>
      {rows.map((r) => {
        const total = LIVE.aggFor(r.qid)?.total ?? 0;
        const kind = r.kind === "subscription" ? "Score subscription" : "Paid question";
        const state = r.status === "ended"
          ? "ended"
          : r.until ? `runs until ${r.until}` : "running";
        return (
          <div key={r.id} style={{ padding: "11px 0", borderBottom: PU_LINE }}>
            <div style={{ fontWeight: 800, fontSize: 14, lineHeight: 1.35 }}>
              {r.prompt || r.qid}
            </div>
            <div style={{ fontFamily: "var(--sans)", fontSize: 12.5, fontWeight: 600, color: "var(--ink-2)", marginTop: 3 }}>
              {kind} · {state} · {total.toLocaleString()} {total === 1 ? "answer" : "answers"} so far
            </div>
          </div>
        );
      })}
      {/* The room's one promise, stated where the buyer reads their own
          numbers: the count above is the public one, and the report is a
          packaging of it — never a private cut (D225/D229). */}
      <div style={{ fontFamily: "var(--sans)", fontSize: 12, fontWeight: 500, color: "var(--ink-3)", lineHeight: 1.55, paddingTop: 10 }}>
        Counts are the same public numbers everyone sees in the app.
        Reports are built from them and delivered per your contract.
      </div>
    </div>
  );
}

export default LivePurchasesPanel;
