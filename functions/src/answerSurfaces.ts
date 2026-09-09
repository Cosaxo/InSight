// answerSurfaces.ts — the world-answer surface list, the server's copy.
//
// WHY A SECOND COPY EXISTS, when this repo's own record of copies is D197
// (one bank parser in three copies; the one with a try/catch reported an
// invented wire size instead of failing). The list is the DEFINITION of a
// world answer — the answer documents a collection-group query over
// `answers` may take as a vote: the four world surfaces plus the two
// composite ones, never a duel's (`group`/`duo`), which is sealed until
// its reveal. The client's copy is `WORLD_ANSWER_SURFACES` in
// src/v2/data/voters.ts and the rules' is the value test in
// firestore.rules' collection-group grant; the two packages do not share
// a build (the reason PATTERNS_SAMPLE_CAP mirrors VOTER_FETCH_CAP), and
// `functions/` cannot import across the boundary.
//
// The nightly voter samples need it since D442: the seed that fills a
// sample on the first night the pass meets a question is the who-voted
// sheet's OWN query — the same filter, the same order, the same cap — so
// a seeded sample is the sheet's list and not a different crowd. The
// admin SDK walks past the rules, which is what makes the copy dangerous
// rather than merely redundant: a value here the rule does not list would
// not be refused, it would seed a crowd the sheet does not show. So the
// copy is HELD, not trusted — answerSurfaces.test.ts reads the client's
// file across the boundary and pins the two arrays equal, and the
// client's own voters.test.ts pins its list against the rules; a change
// to any one of the three fails a test naming the other two.
export const WORLD_ANSWER_SURFACES = ["daily", "feed", "test", "learn", "pulse", "call"] as const;
