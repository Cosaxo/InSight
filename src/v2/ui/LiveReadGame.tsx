// The reading game, in the feed (D196).
//
// THE GAME, and what it is not: you are shown a question the crowd has
// ALREADY settled and asked which side one slice of it picked. You are
// scored the instant you answer, against the published cell — the same
// cell the Explore lens draws and the same numbers the who-voted sheet
// lists by name. Nothing is being predicted. This is the half of Foresight
// whose truth already exists (D126), and after D196 it is the only half
// the app offers.
//
// WHY IT IS HERE AND NOT ON THE MIRROR. D126 put it on the Mirror's lens
// row and D136 took it off, and both were right about their own question:
// the lens row is where a POPULATION gets read, and this is a game. The
// prototype has always put it in the feed. `LiveForesightLens.tsx`'s own
// header already anticipated the move — *"the feed placement stays open as
// a follow-on; nothing here would have to change for it, since the engine
// takes questions and returns reads"* — and nothing did. That file is
// mounted here verbatim; this wrapper is the three things the feed
// placement needs and the lens row supplied for free.
//
//   1. THE SOURCES. On the Mirror the lens was handed its questions. Here
//      it builds them from what the store already holds — zero new reads.
//   2. THE SCOPE, said once. On the Mirror the ruler above the lens said
//      which population you were reading. In the feed nothing does, so the
//      card says it: these slices are of EVERYONE. That was the one real
//      objection in the lens file's header, and one line answers it —
//      because the source is the daily bank, which is one shared question
//      per day and therefore one shared population.
//   3. THE GATE. `data/gamesReady.ts` — the game does not appear at all
//      until there are enough fair reads to produce a record worth
//      believing. That is the whole of what "hidden until enough data"
//      means, and it is a number rather than a flag so it can be argued
//      with.
//
// It renders NOTHING before the gate opens — no teaser, no "coming soon",
// no empty frame. A game that announces itself and cannot be played is
// worse than one that is simply not there yet.
import React from "react";
import LIVE from "../data/live";
import { COHORT_DIMS } from "../data/cohort";
import { readSourcesFrom, readsReady } from "../data/gamesReady";
import LiveForesightLens from "./LiveForesightLens";

export default function LiveReadGame(): React.ReactElement | null {
  const [, bump] = React.useReducer((n: number) => n + 1, 0);
  React.useEffect(() => LIVE.subscribe?.(bump), []);

  if (!LIVE.enabled || !LIVE.aggregated) return null;
  const sources = readSourcesFrom(LIVE.aggregated(), (qid) => LIVE.aggFor(qid));
  const { ready } = readsReady(sources, COHORT_DIMS);
  // The gate. Nothing at all until the corpus can carry a record.
  if (!ready) return null;

  return (
    <div className="card" data-screen-label="Reading game" style={{ display: "flex", flexDirection: "column", gap: 11, padding: "13px 14px 14px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
        <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--accent)" }}></span>
        <span className="kicker" style={{ marginBottom: 0 }}>read the room</span>
      </div>
      {/* The scope, once. Not per card — that was the lens header's
          objection to this placement, and stating it here rather than on
          every read is what answers it. */}
      <div style={{ fontFamily: "var(--sans)", fontSize: 12.5, fontWeight: 600, color: "var(--ink-3)", lineHeight: 1.5 }}>
        Slices of everyone who answered.
      </div>
      <LiveForesightLens qs={sources} />
    </div>
  );
}
