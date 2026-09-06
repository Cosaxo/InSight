# Decision index

Generated — `npm run build:doc-index`. Every record in
[`DECISIONS.md`](DECISIONS.md), ordered by number, so the question
"which decision governs this" is 403 lines instead of
40,725. Do not hand-edit; `npm run check:docs` fails when this
drifts from the source.

**Cited later by** is the newest record that mentions this one, and how
many others do. It is a *citation*, not a reversal — but a record with a
much newer citer is one to read from the bottom up. Supersession in this
file is marked three different ways, so the index does not claim to
detect it.

| # | Decision | Cited later by | Line |
| --- | --- | --- | --- |
| **D1** | [Comments and "who voted" are circle-scoped only](DECISIONS.md#d1--comments-and-who-voted-are-circle-scoped-only) | D367 (+47) | 14 |
| **D2** | ["Near" means geohash5 (~5 km), reusing the existing geo system](DECISIONS.md#d2--near-means-geohash5-5-km-reusing-the-existing-geo-system) | D84 (+3) | 29 |
| **D3** | [Anonymous-first auth with account linking](DECISIONS.md#d3--anonymous-first-auth-with-account-linking) | D369 (+26) | 97 |
| **D4** | [The v1 shelf, and the legacy boundary](DECISIONS.md#d4--the-v1-shelf-and-the-legacy-boundary) | D192 (+6) | 342 |
| **D5** | [Sealed answers are owner-only; reveals are materialized server-side](DECISIONS.md#d5--sealed-answers-are-owner-only-reveals-are-materialized-server-side) | D380 (+19) | 393 |
| **D6** | [Android backup off; iPhone-only; no custom crypto](DECISIONS.md#d6--android-backup-off-iphone-only-no-custom-crypto) | D192 (+3) | 296 |
| **D7** | [Backend scale ceilings — recorded, not engineered around](DECISIONS.md#d7--backend-scale-ceilings--recorded-not-engineered-around) | D367 (+30) | 167 |
|  | ↳ *amendment 2026-08-03* — [The retry-logging trigger now has an instrument](DECISIONS.md#d7-amendment-2026-08-03--the-retry-logging-trigger-now-has-an-instrument) | — | 3523 |
| **D8** | [Per-anchor breakdowns are built; collecting the anchors is not](DECISIONS.md#d8--per-anchor-breakdowns-are-built-collecting-the-anchors-is-not) | D356 (+40) | 449 |
| **D9** | [Near is your city — picked from a list, or located on the device](DECISIONS.md#d9--near-is-your-city--picked-from-a-list-or-located-on-the-device) | D192 (+21) | 556 |
| **D10** | [@capacitor-firebase/app-check is installed under an npm alias](DECISIONS.md#d10--capacitor-firebaseapp-check-is-installed-under-an-npm-alias) | D29 | 815 |
| **D11** | [The feed's argument surfaces are demo-only, by structure not by flag](DECISIONS.md#d11--the-feeds-argument-surfaces-are-demo-only-by-structure-not-by-flag) | D280 (+4) | 884 |
| **D12** | [Rank questions are out of the live feed until answers can carry an order](DECISIONS.md#d12--rank-questions-are-out-of-the-live-feed-until-answers-can-carry-an-order) | D233 (+7) | 1053 |
| **D13** | [The v1 compute is deleted, for the reason D4 deleted the v1 rules](DECISIONS.md#d13--the-v1-compute-is-deleted-for-the-reason-d4-deleted-the-v1-rules) | D333 (+6) | 1092 |
| **D14** | [Catalog answers are keys into a shipped catalogue; the reveal is a canon](DECISIONS.md#d14--catalog-answers-are-keys-into-a-shipped-catalogue-the-reveal-is-a-canon) | D347 (+6) | 1217 |
| **D15** | [Films/artists catalogues: QID keys, and generation is an operator step](DECISIONS.md#d15--filmsartists-catalogues-qid-keys-and-generation-is-an-operator-step) | D267 (+4) | 1269 |
| **D16** | [The Facebook SDK is stripped from the iOS build, not declared](DECISIONS.md#d16--the-facebook-sdk-is-stripped-from-the-ios-build-not-declared) | D164 (+2) | 1311 |
| **D17** | [Catalog breakdowns: each segment orders the board, never a board of its own](DECISIONS.md#d17--catalog-breakdowns-each-segment-orders-the-board-never-a-board-of-its-own) | D347 (+2) | 1403 |
| **D18** | [The breakdown floor bounds cohort size, not the split inside a cohort](DECISIONS.md#d18--the-breakdown-floor-bounds-cohort-size-not-the-split-inside-a-cohort) | D106 (+3) | 1448 |
| **D19** | [The reveal scan asks an indexed question; the ops hook still reads everything](DECISIONS.md#d19--the-reveal-scan-asks-an-indexed-question-the-ops-hook-still-reads-everything) | D55 | 1507 |
| **D20** | [Function runtime options are per-function; the global stays the heavy default](DECISIONS.md#d20--function-runtime-options-are-per-function-the-global-stays-the-heavy-default) | — | 1613 |
| **D21** | [The live-mode branches get a mount test; accessibility gets a ratchet](DECISIONS.md#d21--the-live-mode-branches-get-a-mount-test-accessibility-gets-a-ratchet) | D49 (+3) | 1673 |
| **D22** | [Moderation substrate: confinement is structural, and advisory until trusted](DECISIONS.md#d22--moderation-substrate-confinement-is-structural-and-advisory-until-trusted) | D297 (+3) | 1757 |
| **D23** | [The mouse-only spec-layer controls become buttons, ahead of the interaction tests D21 wanted](DECISIONS.md#d23--the-mouse-only-spec-layer-controls-become-buttons-ahead-of-the-interaction-tests-d21-wanted) | D24 | 1896 |
| **D24** | [Every overlay and sheet is a real modal dialog, and this time the interaction test came with it](DECISIONS.md#d24--every-overlay-and-sheet-is-a-real-modal-dialog-and-this-time-the-interaction-test-came-with-it) | D250 (+2) | 1989 |
| **D25** | [The world feed loads after first paint; the rest of the split waits](DECISIONS.md#d25--the-world-feed-loads-after-first-paint-the-rest-of-the-split-waits) | D221 (+8) | 2080 |
| **D26** | [The spec layer's dead render code is deleted; the one toolkit is kept](DECISIONS.md#d26--the-spec-layers-dead-render-code-is-deleted-the-one-toolkit-is-kept) | D43 | 2138 |
| **D27** | [The v15 revision syncs in whole, and the honesty layer stays where it was](DECISIONS.md#d27--the-v15-revision-syncs-in-whole-and-the-honesty-layer-stays-where-it-was) | D38 | 2230 |
| **D28** | [Fake accounts: prevention stays partial, the record becomes correctable](DECISIONS.md#d28--fake-accounts-prevention-stays-partial-the-record-becomes-correctable) | D342 (+14) | 2283 |
|  | ↳ *amendment 2026-08-06* — [Identity verification (passport / driver's licence class) recorded as a possible future requirement](DECISIONS.md#d28-amendment-2026-08-06--identity-verification-passport--drivers-licence-class-recorded-as-a-possible-future-requirement) | — | 5082 |
| **D29** | [Device-bound activation: one counted account per device per month, silently](DECISIONS.md#d29--device-bound-activation-one-counted-account-per-device-per-month-silently) | D343 (+10) | 2396 |
| **D30** | [Farm questions may graduate to the live seed; the deck gets an epoch](DECISIONS.md#d30--farm-questions-may-graduate-to-the-live-seed-the-deck-gets-an-epoch) | D281 (+13) | 2598 |
| **D31** | [The logic test generates its puzzles; nothing ships an answer key](DECISIONS.md#d31--the-logic-test-generates-its-puzzles-nothing-ships-an-answer-key) | D57 (+2) | 2663 |
| **D32** | [Learn's crowd stat is measured — first attempts only, estimates labeled](DECISIONS.md#d32--learns-crowd-stat-is-measured--first-attempts-only-estimates-labeled) | D284 (+18) | 2734 |
| **D33** | [The farm gets eyes and a faster clock: the scorecard, and daily runs](DECISIONS.md#d33--the-farm-gets-eyes-and-a-faster-clock-the-scorecard-and-daily-runs) | D350 (+12) | 2807 |
|  | ↳ *amendment 2026-08-06* — [Ordinal splits are measured on their axis](DECISIONS.md#d33-amendment-2026-08-06--ordinal-splits-are-measured-on-their-axis) | — | 6200 |
| **D34** | [The seed stops rewriting what it already said, and the bank pages in](DECISIONS.md#d34--the-seed-stops-rewriting-what-it-already-said-and-the-bank-pages-in) | D358 (+7) | 2866 |
| **D35** | [Label association becomes explicit, and a static gate replaces the render test that would have proved it](DECISIONS.md#d35--label-association-becomes-explicit-and-a-static-gate-replaces-the-render-test-that-would-have-proved-it) | D290 (+1) | 2938 |
| **D36** | [Five callables cannot attest; the uid allowlists are the control, and a gate holds the list](DECISIONS.md#d36--five-callables-cannot-attest-the-uid-allowlists-are-the-control-and-a-gate-holds-the-list) | D138 (+1) | 3039 |
| **D37** | [The device-bind flip becomes deterministic, then measured — the trigger is two numbers, not a judgement](DECISIONS.md#d37--the-device-bind-flip-becomes-deterministic-then-measured--the-trigger-is-two-numbers-not-a-judgement) | D343 (+3) | 3159 |
| **D38** | [The no-button overlays load after first paint; relmap stays eager because the Mirror reads it](DECISIONS.md#d38--the-no-button-overlays-load-after-first-paint-relmap-stays-eager-because-the-mirror-reads-it) | D354 (+3) | 3275 |
| **D39** | [The spec-layer migration gets a meter, and two figures get a gate](DECISIONS.md#d39--the-spec-layer-migration-gets-a-meter-and-two-figures-get-a-gate) | D369 (+31) | 3438 |
| **D40** | [Duels get a content lane and a question-level signal](DECISIONS.md#d40--duels-get-a-content-lane-and-a-question-level-signal) | D347 (+11) | 3851 |
|  | ↳ *adoption 2026-08-06* — [All four parts shipped, with five deltas](DECISIONS.md#d40-adoption-2026-08-06--all-four-parts-shipped-with-five-deltas) | — | 6240 |
| **D41** | [The two stores' account types are decided separately — Play as an organization, Apple as an individual](DECISIONS.md#d41--the-two-stores-account-types-are-decided-separately--play-as-an-organization-apple-as-an-individual) | D367 (+3) | 3956 |
| **D42** | [InSight launches on iOS alone; Play is deferred, and the path to it gets cheaper while it waits](DECISIONS.md#d42--insight-launches-on-ios-alone-play-is-deferred-and-the-path-to-it-gets-cheaper-while-it-waits) | D367 (+9) | 4047 |
| **D43** | [The v17 sync: what the prototype won, and what this repo kept](DECISIONS.md#d43--the-v17-sync-what-the-prototype-won-and-what-this-repo-kept) | D189 (+2) | 4140 |
| **D44** | [Political items never slice — the split publishes, the cross-tab does not](DECISIONS.md#d44--political-items-never-slice--the-split-publishes-the-cross-tab-does-not) | D234 (+7) | 4240 |
| **D45** | [Erasure follows the reveal, not the membership — and leaving a group is not an erasure request](DECISIONS.md#d45--erasure-follows-the-reveal-not-the-membership--and-leaving-a-group-is-not-an-erasure-request) | D55 | 4310 |
| **D46** | [The release build's JavaScript half gets the proof its native half already had](DECISIONS.md#d46--the-release-builds-javascript-half-gets-the-proof-its-native-half-already-had) | — | 4392 |
| **D47** | [Monitoring grows a decision console — and the refusals become part of it](DECISIONS.md#d47--monitoring-grows-a-decision-console--and-the-refusals-become-part-of-it) | D303 (+9) | 4446 |
| **D48** | [Three limits accepted while closing the reveal-alert, bridge and boot-state gaps](DECISIONS.md#d48--three-limits-accepted-while-closing-the-reveal-alert-bridge-and-boot-state-gaps) | D59 | 4656 |
| **D49** | [The Skip control becomes a button, the alert chain gets a gate, and the feed's split stops at its arithmetic](DECISIONS.md#d49--the-skip-control-becomes-a-button-the-alert-chain-gets-a-gate-and-the-feeds-split-stops-at-its-arithmetic) | — | 4709 |
| **D50** | [A lens question in a live feed is a self-report item, not a poll](DECISIONS.md#d50--a-lens-question-in-a-live-feed-is-a-self-report-item-not-a-poll) | D146 (+6) | 4797 |
| **D51** | [Deleting the keys is only half the wipe: every local store hears the purge](DECISIONS.md#d51--deleting-the-keys-is-only-half-the-wipe-every-local-store-hears-the-purge) | D356 (+8) | 4863 |
| **D52** | [The content review: what got fixed, what got flagged, and the two lines that held](DECISIONS.md#d52--the-content-review-what-got-fixed-what-got-flagged-and-the-two-lines-that-held) | D358 (+10) | 4929 |
| **D53** | [The logic test measured: zero ambiguity in 60,000 items, and the curve gets pinned](DECISIONS.md#d53--the-logic-test-measured-zero-ambiguity-in-60000-items-and-the-curve-gets-pinned) | D61 (+2) | 5019 |
| **D54** | [The ledger gets eyes: a daily velocity scan, feeding manual review](DECISIONS.md#d54--the-ledger-gets-eyes-a-daily-velocity-scan-feeding-manual-review) | D342 (+4) | 5127 |
| **D55** | [Three guarantees were enforced on a value and not on the way it moves](DECISIONS.md#d55--three-guarantees-were-enforced-on-a-value-and-not-on-the-way-it-moves) | D220 (+2) | 5225 |
| **D56** | [The logic test stops telegraphing its rules: banded families, and every puzzle is on the clock](DECISIONS.md#d56--the-logic-test-stops-telegraphing-its-rules-banded-families-and-every-puzzle-is-on-the-clock) | D62 (+1) | 5625 |
| **D57** | [Verified logic attempts: D31's deferral reversed — the server holds the key](DECISIONS.md#d57--verified-logic-attempts-d31s-deferral-reversed--the-server-holds-the-key) | D284 (+11) | 5708 |
| **D58** | [The seed refuses to edit a shipped option set](DECISIONS.md#d58--the-seed-refuses-to-edit-a-shipped-option-set) | D68 | 5835 |
| **D59** | [The deferred chunks stop caching their own failure](DECISIONS.md#d59--the-deferred-chunks-stop-caching-their-own-failure) | — | 5908 |
| **D60** | [The verified percentile becomes a measurement at one hundred players](DECISIONS.md#d60--the-verified-percentile-becomes-a-measurement-at-one-hundred-players) | D62 (+1) | 5958 |
| **D61** | [Twenty-five items, tail-heavy: the form grows before the norms freeze it](DECISIONS.md#d61--twenty-five-items-tail-heavy-the-form-grows-before-the-norms-freeze-it) | D227 (+1) | 6019 |
| **D62** | [The test starts learning its own difficulty: family and slot solve rates](DECISIONS.md#d62--the-test-starts-learning-its-own-difficulty-family-and-slot-solve-rates) | — | 6093 |
| **D63** | [Near-duplicate questions get a measured gate](DECISIONS.md#d63--near-duplicate-questions-get-a-measured-gate) | D123 (+2) | 6143 |
| **D64** | [Five findings from a cost & performance audit, and the two gates that had stopped measuring](DECISIONS.md#d64--five-findings-from-a-cost--performance-audit-and-the-two-gates-that-had-stopped-measuring) | D278 (+8) | 6315 |
| **D65** | [A soft-hide that a query walked straight past: `hidden` becomes a required boolean](DECISIONS.md#d65--a-soft-hide-that-a-query-walked-straight-past-hidden-becomes-a-required-boolean) | D290 (+7) | 6559 |
| **D66** | [The sample persona reached live mode twice more: the Map's anchor ring, and a hydration that wrote to nobody](DECISIONS.md#d66--the-sample-persona-reached-live-mode-twice-more-the-maps-anchor-ring-and-a-hydration-that-wrote-to-nobody) | D280 (+3) | 6698 |
| **D67** | [The cost model was counting one kind of read, and calling it the bill](DECISIONS.md#d67--the-cost-model-was-counting-one-kind-of-read-and-calling-it-the-bill) | D129 (+2) | 6794 |
| **D68** | [The v18 sync: a revision arrives, and the ratchets price it honestly](DECISIONS.md#d68--the-v18-sync-a-revision-arrives-and-the-ratchets-price-it-honestly) | D277 (+2) | 6895 |
| **D69** | [EU trader status: a home address on the listing, in exchange for 27 storefronts](DECISIONS.md#d69--eu-trader-status-a-home-address-on-the-listing-in-exchange-for-27-storefronts) | D165 (+3) | 6959 |
| **D70** | [The two duel indexes were bounded twice and diverged, and a reveal folded votes into a question nobody answered](DECISIONS.md#d70--the-two-duel-indexes-were-bounded-twice-and-diverged-and-a-reveal-folded-votes-into-a-question-nobody-answered) | D156 (+3) | 7010 |
| **D71** | [A reveal now says which question each answer was to, and nothing compares across that line](DECISIONS.md#d71--a-reveal-now-says-which-question-each-answer-was-to-and-nothing-compares-across-that-line) | D156 (+3) | 7103 |
| **D72** | [Two fabrications that outlived the badge: the Map's group stats and the results card's friends](DECISIONS.md#d72--two-fabrications-that-outlived-the-badge-the-maps-group-stats-and-the-results-cards-friends) | D290 (+12) | 7170 |
| **D73** | [The privacy label has no endpoint, so the script prints the form instead](DECISIONS.md#d73--the-privacy-label-has-no-endpoint-so-the-script-prints-the-form-instead) | D367 (+12) | 7287 |
| **D74** | [A tick is a claim, and this one was printed before the write](DECISIONS.md#d74--a-tick-is-a-claim-and-this-one-was-printed-before-the-write) | D208 (+5) | 7355 |
| **D75** | [Apple's eight new age-rating questions, and the half of the form nothing was checking](DECISIONS.md#d75--apples-eight-new-age-rating-questions-and-the-half-of-the-form-nothing-was-checking) | D116 (+3) | 7414 |
| **D76** | [Crash reporting flips to opt-out, and the ErrorBoundary reports what it catches](DECISIONS.md#d76--crash-reporting-flips-to-opt-out-and-the-errorboundary-reports-what-it-catches) | D329 (+3) | 7489 |
| **D77** | [The app knew why it had failed and told a console nobody could reach](DECISIONS.md#d77--the-app-knew-why-it-had-failed-and-told-a-console-nobody-could-reach) | D356 (+2) | 7538 |
| **D78** | [The takes surface goes live circle-first, and world takes get a costed proposal](DECISIONS.md#d78--the-takes-surface-goes-live-circle-first-and-world-takes-get-a-costed-proposal) | D98 (+2) | 7610 |
| **D79** | [`messagingAndChat` was false for one day, and circle scope does not make chat not-chat](DECISIONS.md#d79--messagingandchat-was-false-for-one-day-and-circle-scope-does-not-make-chat-not-chat) | D83 | 7788 |
| **D80** | [Two ways to hang on the same line, and the device found both](DECISIONS.md#d80--two-ways-to-hang-on-the-same-line-and-the-device-found-both) | D167 | 7851 |
| **D81** | [The k-floor is paused at 1 until launch traction](DECISIONS.md#d81--the-k-floor-is-paused-at-1-until-launch-traction) | D327 (+5) | 7925 |
| **D82** | [Near by radius (~500 m) — asked for, priced, and deferred](DECISIONS.md#d82--near-by-radius-500-m--asked-for-priced-and-deferred) | D316 (+2) | 8003 |
| **D83** | [World takes ship — D78 part 2 adopted, anonymous, behind enforcement](DECISIONS.md#d83--world-takes-ship--d78-part-2-adopted-anonymous-behind-enforcement) | D378 (+9) | 8049 |
| **D84** | [Near by radius ships — presence cells, a count and nothing else](DECISIONS.md#d84--near-by-radius-ships--presence-cells-a-count-and-nothing-else) | D370 (+8) | 8171 |
| **D85** | [The personality tests go to 5 items per dimension, and `cognitive` gets a question bank](DECISIONS.md#d85--the-personality-tests-go-to-5-items-per-dimension-and-cognitive-gets-a-question-bank) | D103 | 8248 |
| **D86** | [Answers become editable — D5 amended, not repealed](DECISIONS.md#d86--answers-become-editable--d5-amended-not-repealed) | D380 (+23) | 8349 |
| **D87** | [Production writes require an approval; the `production` environment carries protection rules](DECISIONS.md#d87--production-writes-require-an-approval-the-production-environment-carries-protection-rules) | D303 (+5) | 8439 |
| **D88** | [Seeding chains to the deploy, because the bank it writes is the deployed one](DECISIONS.md#d88--seeding-chains-to-the-deploy-because-the-bank-it-writes-is-the-deployed-one) | — | 8518 |
| **D89** | [The feed's "knows this best" row is demo furniture — live mode refuses it](DECISIONS.md#d89--the-feeds-knows-this-best-row-is-demo-furniture--live-mode-refuses-it) | D133 (+2) | 8582 |
| **D90** | [The picker's blank state starts at home — the clock's country ranks first](DECISIONS.md#d90--the-pickers-blank-state-starts-at-home--the-clocks-country-ranks-first) | D205 | 8617 |
| **D91** | [Lens questions are polls: the items are seeded, and their counts publish](DECISIONS.md#d91--lens-questions-are-polls-the-items-are-seeded-and-their-counts-publish) | D121 (+1) | 8660 |
| **D92** | [A standing location grant fills the city in — "suggested, never applied" narrows to the no-grant state](DECISIONS.md#d92--a-standing-location-grant-fills-the-city-in--suggested-never-applied-narrows-to-the-no-grant-state) | D111 | 8736 |
| **D93** | [The persona's residue is scrubbed from live anchors at boot, by exact signature](DECISIONS.md#d93--the-personas-residue-is-scrubbed-from-live-anchors-at-boot-by-exact-signature) | — | 8778 |
| **D94** | [The demo roster grows to 24 — the prototype's social surfaces get a population](DECISIONS.md#d94--the-demo-roster-grows-to-24--the-prototypes-social-surfaces-get-a-population) | — | 8816 |
| **D95** | [A re-served learn card arrives answerable — the feed's vote mirror no longer outlives the serve](DECISIONS.md#d95--a-re-served-learn-card-arrives-answerable--the-feeds-vote-mirror-no-longer-outlives-the-serve) | D153 | 8881 |
| **D96** | [A live build advertises no demo communities or empty leaves — and every bank subject runs always-on](DECISIONS.md#d96--a-live-build-advertises-no-demo-communities-or-empty-leaves--and-every-bank-subject-runs-always-on) | D322 (+4) | 8948 |
| **D97** | [Question production upscales behind a regulator: computed budgets, a mechanical style gate, and measured vintages](DECISIONS.md#d97--question-production-upscales-behind-a-regulator-computed-budgets-a-mechanical-style-gate-and-measured-vintages) | D328 (+12) | 9015 |
| **D98** | [Answers are public — the privacy model is retired, not paused](DECISIONS.md#d98--answers-are-public--the-privacy-model-is-retired-not-paused) | D379 (+77) | 9129 |
| **D99** | [The Mirror's lens row comes back, on data that was already there](DECISIONS.md#d99--the-mirrors-lens-row-comes-back-on-data-that-was-already-there) | D277 (+9) | 9251 |
| **D100** | [Scores and the Answers lens, on the archive rather than the week](DECISIONS.md#d100--scores-and-the-answers-lens-on-the-archive-rather-than-the-week) | D334 (+5) | 9394 |
| **D101** | [Circle, on a follow graph that needs no handshake](DECISIONS.md#d101--circle-on-a-follow-graph-that-needs-no-handshake) | D347 (+10) | 9495 |
| **D102** | [The D98 surfaces get their bounds, their index, and their bill](DECISIONS.md#d102--the-d98-surfaces-get-their-bounds-their-index-and-their-bill) | D176 (+6) | 9600 |
| **D103** | [Four device readings: a retired test, a rail, the topics D96 left dark, and one notch paid for twice](DECISIONS.md#d103--four-device-readings-a-retired-test-a-rail-the-topics-d96-left-dark-and-one-notch-paid-for-twice) | D156 (+3) | 9717 |
| **D104** | [Test users: a second real account, and what it is allowed to fake](DECISIONS.md#d104--test-users-a-second-real-account-and-what-it-is-allowed-to-fake) | — | 9817 |
| **D105** | [One text field owns the app's scale: every input defers to --field-size](DECISIONS.md#d105--one-text-field-owns-the-apps-scale-every-input-defers-to---field-size) | D113 | 9922 |
| **D106** | [The retired privacy model is swept out of the documentation, starting with the two pages users actually read](DECISIONS.md#d106--the-retired-privacy-model-is-swept-out-of-the-documentation-starting-with-the-two-pages-users-actually-read) | D367 (+9) | 10002 |
| **D107** | [A purpose string for the authorisation this app never asks for](DECISIONS.md#d107--a-purpose-string-for-the-authorisation-this-app-never-asks-for) | D199 | 10106 |
| **D108** | [Two providers leave the bridge, and the mount suite stops being one file](DECISIONS.md#d108--two-providers-leave-the-bridge-and-the-mount-suite-stops-being-one-file) | D354 (+8) | 10234 |
| **D109** | [LEARN leaves the bridge, and takes the load-order bug with it](DECISIONS.md#d109--learn-leaves-the-bridge-and-takes-the-load-order-bug-with-it) | D110 | 10375 |
| **D110** | [The bundle gets the number that decides first paint, and it immediately finds 327 KB](DECISIONS.md#d110--the-bundle-gets-the-number-that-decides-first-paint-and-it-immediately-finds-327-kb) | D355 (+4) | 10527 |
| **D111** | [Near and City are two stops again: presence is not a place](DECISIONS.md#d111--near-and-city-are-two-stops-again-presence-is-not-a-place) | D192 (+5) | 10659 |
| **D112** | [The similarity surfaces: place score profiles, and kindred ranked by scores — live, exact, default-on](DECISIONS.md#d112--the-similarity-surfaces-place-score-profiles-and-kindred-ranked-by-scores--live-exact-default-on) | D334 (+15) | 10697 |
| **D113** | [Two continuum forms in the feed, a lane that writes them, and the compare rose redrawn (a partial v20 sync)](DECISIONS.md#d113--two-continuum-forms-in-the-feed-a-lane-that-writes-them-and-the-compare-rose-redrawn-a-partial-v20-sync) | D277 (+3) | 10804 |
| **D114** | [The continuum forms go live: bucketed answers under the existing fold](DECISIONS.md#d114--the-continuum-forms-go-live-bucketed-answers-under-the-existing-fold) | D358 (+3) | 10934 |
| **D115** | [The learn lane can produce again, and the bank stops testing reading position](DECISIONS.md#d115--the-learn-lane-can-produce-again-and-the-bank-stops-testing-reading-position) | D350 (+4) | 11040 |
| **D116** | [The store listing was still selling the retired privacy model, and the closed vocabulary becomes a gate](DECISIONS.md#d116--the-store-listing-was-still-selling-the-retired-privacy-model-and-the-closed-vocabulary-becomes-a-gate) | D368 (+7) | 11170 |
| **D117** | [Two access controls are loosened to ship build 11, and the only thing holding their reversal is a checkbox](DECISIONS.md#d117--two-access-controls-are-loosened-to-ship-build-11-and-the-only-thing-holding-their-reversal-is-a-checkbox) | D124 | 11315 |
| **D118** | [Two gestures reported from a phone: a dial that stole the tab, and a Near that counted forever](DECISIONS.md#d118--two-gestures-reported-from-a-phone-a-dial-that-stole-the-tab-and-a-near-that-counted-forever) | D130 (+1) | 11389 |
| **D119** | [Answers becomes a tab: the live Mirror stop gets the prototype's nav v2](DECISIONS.md#d119--answers-becomes-a-tab-the-live-mirror-stop-gets-the-prototypes-nav-v2) | D190 (+3) | 11472 |
| **D120** | [The live answer row becomes the prototype's answer row](DECISIONS.md#d120--the-live-answer-row-becomes-the-prototypes-answer-row) | D193 (+1) | 11565 |
| **D121** | [The instruments become passive for real: no sit-down flow, a fold that scores, one hue, and a skip that comes back](DECISIONS.md#d121--the-instruments-become-passive-for-real-no-sit-down-flow-a-fold-that-scores-one-hue-and-a-skip-that-comes-back) | D294 (+5) | 11642 |
| **D122** | [Handles: the app gets an address, and a circle gains members by invitation](DECISIONS.md#d122--handles-the-app-gets-an-address-and-a-circle-gains-members-by-invitation) | D335 (+10) | 11764 |
|  | ↳ *amendment 2026-08-29* — [The registry is a lookup in the rule, not only in the prose](DECISIONS.md#d122-amendment-2026-08-29--the-registry-is-a-lookup-in-the-rule-not-only-in-the-prose) | — | 11935 |
| **D123** | [The dedup gate learns morphology and synonyms, and pre-flights the batch against itself](DECISIONS.md#d123--the-dedup-gate-learns-morphology-and-synonyms-and-pre-flights-the-batch-against-itself) | — | 11965 |
| **D124** | [The bill gets its first ceilings: an idle detach, two unbounded reads closed, and the controls that live in a console](DECISIONS.md#d124--the-bill-gets-its-first-ceilings-an-idle-detach-two-unbounded-reads-closed-and-the-controls-that-live-in-a-console) | D194 (+2) | 12069 |
| **D125** | [The breakdown was pointed at the crowd, and Learn's measured split was unreachable by construction](DECISIONS.md#d125--the-breakdown-was-pointed-at-the-crowd-and-learns-measured-split-was-unreachable-by-construction) | D304 (+5) | 12194 |
| **D126** | [Foresight — the read half, on a truth that now exists](DECISIONS.md#d126--foresight--the-read-half-on-a-truth-that-now-exists) | D196 (+7) | 12329 |
| **D127** | [A machine may propose an outcome, never be the reason one is believed](DECISIONS.md#d127--a-machine-may-propose-an-outcome-never-be-the-reason-one-is-believed) | D281 (+4) | 12452 |
| **D128** | [You can say what you want more of; the app does not guess](DECISIONS.md#d128--you-can-say-what-you-want-more-of-the-app-does-not-guess) | D329 (+4) | 12564 |
| **D129** | [The fan-out is gone: the deck is polled, and the cost curve is flat](DECISIONS.md#d129--the-fan-out-is-gone-the-deck-is-polled-and-the-cost-curve-is-flat) | D332 (+9) | 12635 |
| **D130** | [Build 12's pre-flight: the label was right, the reasoning under it was stale](DECISIONS.md#d130--build-12s-pre-flight-the-label-was-right-the-reasoning-under-it-was-stale) | D257 (+11) | 12766 |
| **D131** | [The Firestore region is a decision with a deadline, and it is written down before it expires](DECISIONS.md#d131--the-firestore-region-is-a-decision-with-a-deadline-and-it-is-written-down-before-it-expires) | D142 | 12894 |
| **D132** | [The profile said "0 of 30 answered" to someone who had answered thirty](DECISIONS.md#d132--the-profile-said-0-of-30-answered-to-someone-who-had-answered-thirty) | D142 | 12998 |
| **D133** | [One card said "our estimate" in the feed and stated a measurement two taps away](DECISIONS.md#d133--one-card-said-our-estimate-in-the-feed-and-stated-a-measurement-two-taps-away) | D142 | 13098 |
| **D134** | [The test track gets a wall; the public build does not](DECISIONS.md#d134--the-test-track-gets-a-wall-the-public-build-does-not) | D344 (+7) | 13184 |
| **D135** | [The field is what a stop opens on, and Near cannot be built as asked](DECISIONS.md#d135--the-field-is-what-a-stop-opens-on-and-near-cannot-be-built-as-asked) | D142 (+1) | 13291 |
| **D136** | [The Mirror stop loses two tabs; Crossroads and a feed window arrive](DECISIONS.md#d136--the-mirror-stop-loses-two-tabs-crossroads-and-a-feed-window-arrive) | D341 (+11) | 13515 |
| **D137** | [The bridge kept the names nobody was crossing on](DECISIONS.md#d137--the-bridge-kept-the-names-nobody-was-crossing-on) | D285 (+5) | 13747 |
| **D138** | [The suggestion board gets a server: a budgeted door, an author-only read, and the same human gate](DECISIONS.md#d138--the-suggestion-board-gets-a-server-a-budgeted-door-an-author-only-read-and-the-same-human-gate) | D288 (+6) | 13926 |
| **D139** | [The daily pulse: one question asked every day, folded per day by the trigger that did not change](DECISIONS.md#d139--the-daily-pulse-one-question-asked-every-day-folded-per-day-by-the-trigger-that-did-not-change) | D220 (+6) | 14007 |
| **D140** | [Height joins the anchors — a band select, never a centimetre field](DECISIONS.md#d140--height-joins-the-anchors--a-band-select-never-a-centimetre-field) | D203 (+3) | 14076 |
| **D141** | [Types leave the profile — tier 1, arithmetic on what is already public](DECISIONS.md#d141--types-leave-the-profile--tier-1-arithmetic-on-what-is-already-public) | D202 (+7) | 14110 |
| **D142** | [Build 13's pre-flight: a build was spent while this file said it was not](DECISIONS.md#d142--build-13s-pre-flight-a-build-was-spent-while-this-file-said-it-was-not) | D198 (+6) | 13390 |
| **D143** | [Build 14's pre-flight: the status line failed a third time, and the bundle gate was already red](DECISIONS.md#d143--build-14s-pre-flight-the-status-line-failed-a-third-time-and-the-bundle-gate-was-already-red) | D381 (+9) | 14150 |
| **D144** | [The bundle gate weighs the bundle that ships, and refuses to weigh any other](DECISIONS.md#d144--the-bundle-gate-weighs-the-bundle-that-ships-and-refuses-to-weigh-any-other) | D365 (+6) | 14273 |
| **D145** | [Four question lanes, two of which had never run: the learn and feed Routines, a feed regulator, and a weekday for catalogues](DECISIONS.md#d145--four-question-lanes-two-of-which-had-never-run-the-learn-and-feed-routines-a-feed-regulator-and-a-weekday-for-catalogues) | D350 (+5) | 14370 |
| **D146** | [The type cut — how each type answered, folded on the client, retroactive by construction](DECISIONS.md#d146--the-type-cut--how-each-type-answered-folded-on-the-client-retroactive-by-construction) | D362 (+9) | 14484 |
| **D147** | [The functions tsconfig moves to `node16`, and the emit format is the part that mattered](DECISIONS.md#d147--the-functions-tsconfig-moves-to-node16-and-the-emit-format-is-the-part-that-mattered) | D153 | 14610 |
| **D148** | [The Routine prompts catch up with their contracts, by the only mechanism that works](DECISIONS.md#d148--the-routine-prompts-catch-up-with-their-contracts-by-the-only-mechanism-that-works) | D359 (+4) | 14660 |
| **D149** | [Sides, friends and real counts: three surfaces stop guessing](DECISIONS.md#d149--sides-friends-and-real-counts-three-surfaces-stop-guessing) | D304 (+4) | 14734 |
| **D150** | [Near is a field again, and nobody in it is named](DECISIONS.md#d150--near-is-a-field-again-and-nobody-in-it-is-named) | D181 (+1) | 14829 |
| **D151** | [The general info is asked at the start, because an answer cannot be re-filed](DECISIONS.md#d151--the-general-info-is-asked-at-the-start-because-an-answer-cannot-be-re-filed) | D331 (+4) | 14869 |
| **D152** | [Explore is the World's; the People lens gets its shape back; Circle and Groups get theirs](DECISIONS.md#d152--explore-is-the-worlds-the-people-lens-gets-its-shape-back-circle-and-groups-get-theirs) | D262 (+4) | 14949 |
| **D153** | [Build 15's pre-flight: the first one where the number was already right](DECISIONS.md#d153--build-15s-pre-flight-the-first-one-where-the-number-was-already-right) | D324 (+5) | 15048 |
| **D154** | [The Map's mainstream boundary is sized by the map, not by a constant](DECISIONS.md#d154--the-maps-mainstream-boundary-is-sized-by-the-map-not-by-a-constant) | D158 | 15161 |
| **D155** | [The tabs sit at the bottom, the four instruments take turns, and the age is the age](DECISIONS.md#d155--the-tabs-sit-at-the-bottom-the-four-instruments-take-turns-and-the-age-is-the-age) | D328 (+7) | 15259 |
| **D156** | [The live 1v1 and Group get the sample's shape — a rail, marks, bars, and a guess that arrives second](DECISIONS.md#d156--the-live-1v1-and-group-get-the-samples-shape--a-rail-marks-bars-and-a-guess-that-arrives-second) | D347 (+4) | 15343 |
| **D157** | [The test surfaces stop describing a crowd they never counted](DECISIONS.md#d157--the-test-surfaces-stop-describing-a-crowd-they-never-counted) | D357 (+7) | 15490 |
| **D158** | [Build 16's pre-flight: the number was already right for the second time running](DECISIONS.md#d158--build-16s-pre-flight-the-number-was-already-right-for-the-second-time-running) | D381 (+7) | 15670 |
| **D159** | [Run 22 delivered build 16, and the comparison gains the commit it is made at](DECISIONS.md#d159--run-22-delivered-build-16-and-the-comparison-gains-the-commit-it-is-made-at) | D381 (+11) | 15785 |
| **D160** | [An empty field is still a field, the row actually snaps, and Near's switch goes in the corner](DECISIONS.md#d160--an-empty-field-is-still-a-field-the-row-actually-snaps-and-nears-switch-goes-in-the-corner) | D190 (+1) | 15857 |
| **D161** | [The feed goes unbounded, and the Mirror gets a corpus of its own](DECISIONS.md#d161--the-feed-goes-unbounded-and-the-mirror-gets-a-corpus-of-its-own) | D382 (+22) | 15951 |
| **D162** | [Review at volume: the AI reads, and the human approves and audits](DECISIONS.md#d162--review-at-volume-the-ai-reads-and-the-human-approves-and-audits) | D367 (+5) | 16089 |
| **D163** | [The app learns what you are into, and the model never leaves the phone](DECISIONS.md#d163--the-app-learns-what-you-are-into-and-the-model-never-leaves-the-phone) | D384 (+13) | 16142 |
| **D164** | [The revenue paths, re-derived against an unbounded feed](DECISIONS.md#d164--the-revenue-paths-re-derived-against-an-unbounded-feed) | D372 (+6) | 16198 |
| **D165** | [The database moves to one EU region, and the old answers are let go](DECISIONS.md#d165--the-database-moves-to-one-eu-region-and-the-old-answers-are-let-go) | D333 (+6) | 16276 |
| **D166** | [The third tab is adopted ON TRIAL, the Arena is dropped, the pulse roster is approved](DECISIONS.md#d166--the-third-tab-is-adopted-on-trial-the-arena-is-dropped-the-pulse-roster-is-approved) | D362 (+14) | 16366 |
| **D167** | [Every v28 surface ships with its backend, or it does not ship](DECISIONS.md#d167--every-v28-surface-ships-with-its-backend-or-it-does-not-ship) | D362 (+8) | 16476 |
| **D168** | [Born or built is refused: the app does not assert facts it cannot recompute](DECISIONS.md#d168--born-or-built-is-refused-the-app-does-not-assert-facts-it-cannot-recompute) | D289 (+1) | 16563 |
| **D169** | [The read path was already careful; the fold path was not](DECISIONS.md#d169--the-read-path-was-already-careful-the-fold-path-was-not) | D180 | 16652 |
| **D170** | [Three Mirror tabs named a population and read a different one](DECISIONS.md#d170--three-mirror-tabs-named-a-population-and-read-a-different-one) | D193 (+8) | 16806 |
| **D171** | [The daily had no breakdown at all, and its own sheet was a hash](DECISIONS.md#d171--the-daily-had-no-breakdown-at-all-and-its-own-sheet-was-a-hash) | — | 16918 |
| **D172** | [The Mirror's stops stop explaining themselves](DECISIONS.md#d172--the-mirrors-stops-stop-explaining-themselves) | D188 (+3) | 16989 |
| **D173** | [The interest levers go; the algorithm owns "how much"](DECISIONS.md#d173--the-interest-levers-go-the-algorithm-owns-how-much) | D282 (+2) | 17126 |
| **D174** | [Near's visibility gets three states, and a position that expires on its own](DECISIONS.md#d174--nears-visibility-gets-three-states-and-a-position-that-expires-on-its-own) | D370 (+6) | 17183 |
| **D175** | [Near asks for a precise fix, so its radius can be honest](DECISIONS.md#d175--near-asks-for-a-precise-fix-so-its-radius-can-be-honest) | D279 (+7) | 17275 |
| **D176** | [Near becomes a room, and the phone says what it is](DECISIONS.md#d176--near-becomes-a-room-and-the-phone-says-what-it-is) | D177 | 17365 |
| **D177** | [Near becomes a room you can read, and asking requires standing in it](DECISIONS.md#d177--near-becomes-a-room-you-can-read-and-asking-requires-standing-in-it) | D202 (+4) | 17495 |
| **D178** | [The app gets a face, and it is reported like anything else somebody says](DECISIONS.md#d178--the-app-gets-a-face-and-it-is-reported-like-anything-else-somebody-says) | D333 (+7) | 17643 |
| **D179** | [The rules deploy on merge and the app does not, so `until` is optional for one release](DECISIONS.md#d179--the-rules-deploy-on-merge-and-the-app-does-not-so-until-is-optional-for-one-release) | D279 (+5) | 17776 |
| **D180** | [Build 18's pre-flight: the record was written and the number was not](DECISIONS.md#d180--build-18s-pre-flight-the-record-was-written-and-the-number-was-not) | D368 (+4) | 17864 |
| **D181** | [Near's field drew the city it is not about](DECISIONS.md#d181--nears-field-drew-the-city-it-is-not-about) | D370 (+3) | 18094 |
| **D182** | [The copy pass: a visual beats a word, a word beats a sentence](DECISIONS.md#d182--the-copy-pass-a-visual-beats-a-word-a-word-beats-a-sentence) | D372 (+4) | 18199 |
| **D183** | [The disclosures leave the app, and get a gate on the way out](DECISIONS.md#d183--the-disclosures-leave-the-app-and-get-a-gate-on-the-way-out) | D352 (+10) | 18297 |
| **D184** | [Build 19's pre-flight: this time neither edit happened](DECISIONS.md#d184--build-19s-pre-flight-this-time-neither-edit-happened) | D339 (+7) | 18456 |
| **D185** | [Crossroads gets a brief, and the gates learn what a story is](DECISIONS.md#d185--crossroads-gets-a-brief-and-the-gates-learn-what-a-story-is) | D341 (+2) | 18607 |
| **D186** | [Build 19 is delivered, and the bump was made from the step list](DECISIONS.md#d186--build-19-is-delivered-and-the-bump-was-made-from-the-step-list) | D381 (+5) | 18781 |
| **D187** | [The place scorecard rates the place](DECISIONS.md#d187--the-place-scorecard-rates-the-place) | D350 (+5) | 18851 |
| **D188** | [The Mirror's tab row sits where a tab bar sits, and stops arguing with the stop about colour](DECISIONS.md#d188--the-mirrors-tab-row-sits-where-a-tab-bar-sits-and-stops-arguing-with-the-stop-about-colour) | D191 (+2) | 19011 |
| **D189** | [The design gate was never looking, and two group hues never met the palette](DECISIONS.md#d189--the-design-gate-was-never-looking-and-two-group-hues-never-met-the-palette) | D191 | 19134 |
| **D190** | [Your name and your handle belong to the account, the topic list opens onto the topics, and Circle and Groups get their row](DECISIONS.md#d190--your-name-and-your-handle-belong-to-the-account-the-topic-list-opens-onto-the-topics-and-circle-and-groups-get-their-row) | D282 (+3) | 19330 |
| **D191** | [Build 20's pre-flight: nothing to bump, and check:bundle's second load-bearing variable](DECISIONS.md#d191--build-20s-pre-flight-nothing-to-bump-and-checkbundles-second-load-bearing-variable) | D324 (+4) | 19511 |
| **D192** | [The docs get a map, and the map gets a gate](DECISIONS.md#d192--the-docs-get-a-map-and-the-map-gets-a-gate) | D199 (+2) | 19622 |
| **D193** | [Compare draws the comparison it was always described as drawing](DECISIONS.md#d193--compare-draws-the-comparison-it-was-always-described-as-drawing) | D202 (+2) | 19746 |
| **D194** | [Predictions ship, and the app only asserts what it can recompute](DECISIONS.md#d194--predictions-ship-and-the-app-only-asserts-what-it-can-recompute) | D258 (+7) | 19908 |
| **D195** | [The paid slot is built, and nobody has bought it yet](DECISIONS.md#d195--the-paid-slot-is-built-and-nobody-has-bought-it-yet) | D377 (+12) | 20081 |
| **D196** | [The reading game is the one that ships, and it waits for a crowd](DECISIONS.md#d196--the-reading-game-is-the-one-that-ships-and-it-waits-for-a-crowd) | D341 (+4) | 20194 |
| **D197** | [The feed gets real ads, and they are not sponsored questions](DECISIONS.md#d197--the-feed-gets-real-ads-and-they-are-not-sponsored-questions) | D382 (+12) | 20302 |
| **D198** | [Build 21's pre-flight: the number run 31 spent, and the bundle gate's artifact claim](DECISIONS.md#d198--build-21s-pre-flight-the-number-run-31-spent-and-the-bundle-gates-artifact-claim) | D381 (+6) | 20451 |
| **D199** | [Build 21 is in TestFlight, and the number moved with it](DECISIONS.md#d199--build-21-is-in-testflight-and-the-number-moved-with-it) | D202 (+1) | 20647 |
| **D200** | [Three things were true and stopped being, and nothing was looking](DECISIONS.md#d200--three-things-were-true-and-stopped-being-and-nothing-was-looking) | D344 (+4) | 20729 |
| **D201** | [The functions follow the database to europe-west1](DECISIONS.md#d201--the-functions-follow-the-database-to-europe-west1) | D301 (+1) | 20878 |
| **D202** | [The type mix reads every instrument, and D157 §4 is reversed](DECISIONS.md#d202--the-type-mix-reads-every-instrument-and-d157-4-is-reversed) | D252 (+3) | 21003 |
| **D203** | [Five pulses, each with its own rhythm](DECISIONS.md#d203--five-pulses-each-with-its-own-rhythm) | D273 (+3) | 21105 |
| **D204** | [Your role is a test result, and the dimension without data is not shipped](DECISIONS.md#d204--your-role-is-a-test-result-and-the-dimension-without-data-is-not-shipped) | D347 (+3) | 21219 |
| **D205** | [An unconfirmed city does not score the place it names](DECISIONS.md#d205--an-unconfirmed-city-does-not-score-the-place-it-names) | D307 (+1) | 21320 |
| **D206** | [A question carries several doors, and demand credit is conserved](DECISIONS.md#d206--a-question-carries-several-doors-and-demand-credit-is-conserved) | D234 (+1) | 21425 |
| **D207** | [The Map goes lazy, and the door §5 was waiting on is open](DECISIONS.md#d207--the-map-goes-lazy-and-the-door-5-was-waiting-on-is-open) | D355 (+1) | 21493 |
| **D208** | [The pen is not an error state, and a gate said it was](DECISIONS.md#d208--the-pen-is-not-an-error-state-and-a-gate-said-it-was) | D212 (+1) | 21606 |
| **D209** | [Three readers walk the archive, and only one of them is a population](DECISIONS.md#d209--three-readers-walk-the-archive-and-only-one-of-them-is-a-population) | — | 21719 |
| **D210** | [Rule 5 could not fire, and 123 dead publications were behind it](DECISIONS.md#d210--rule-5-could-not-fire-and-123-dead-publications-were-behind-it) | D223 (+1) | 21795 |
| **D211** | [The topic door keeps the tab bar, a walk is final, and the account panel stops offering what sign-in settled](DECISIONS.md#d211--the-topic-door-keeps-the-tab-bar-a-walk-is-final-and-the-account-panel-stops-offering-what-sign-in-settled) | D344 (+5) | 21914 |
| **D212** | [Questions ship without waiting for a person](DECISIONS.md#d212--questions-ship-without-waiting-for-a-person) | D367 (+2) | 22067 |
| **D213** | [Every servable type generates, and the feed goes daily](DECISIONS.md#d213--every-servable-type-generates-and-the-feed-goes-daily) | D350 (+1) | 22141 |
| **D214** | [The People lens joins the Patterns trial](DECISIONS.md#d214--the-people-lens-joins-the-patterns-trial) | D287 (+3) | 22193 |
| **D215** | [The Map and the Oracle take the 2026-08-20 standalone's shape](DECISIONS.md#d215--the-map-and-the-oracle-take-the-2026-08-20-standalones-shape) | D216 | 22252 |
| **D216** | [The People lens gets its populations](DECISIONS.md#d216--the-people-lens-gets-its-populations) | D265 (+1) | 22327 |
| **D217** | [Patterns is out of the v1 release, and the trial pauses with the mount](DECISIONS.md#d217--patterns-is-out-of-the-v1-release-and-the-trial-pauses-with-the-mount) | D265 (+3) | 22386 |
| **D218** | [A continuum answer lives in two units, and the bucket arbitrates](DECISIONS.md#d218--a-continuum-answer-lives-in-two-units-and-the-bucket-arbitrates) | D230 (+3) | 22442 |
| **D219** | [The wall comes down for the store build: D134's fork, resolved](DECISIONS.md#d219--the-wall-comes-down-for-the-store-build-d134s-fork-resolved) | D344 (+2) | 22510 |
| **D220** | [A settled report is spent, and the queue stopped ranking ghosts](DECISIONS.md#d220--a-settled-report-is-spent-and-the-queue-stopped-ranking-ghosts) | D223 (+1) | 22551 |
| **D221** | [Four things nothing was standing behind](DECISIONS.md#d221--four-things-nothing-was-standing-behind) | D223 (+1) | 22642 |
| **D222** | [One rounding rule, and it stopped drawing three votes above four](DECISIONS.md#d222--one-rounding-rule-and-it-stopped-drawing-three-votes-above-four) | D223 | 22761 |
| **D223** | [The long tail, and the two things it declined to build](DECISIONS.md#d223--the-long-tail-and-the-two-things-it-declined-to-build) | D362 (+5) | 22850 |
| **D224** | [A pick answer snapshots who it meant, and the reveal carries it](DECISIONS.md#d224--a-pick-answer-snapshots-who-it-meant-and-the-reveal-carries-it) | D347 (+3) | 22939 |
| **D225** | [The no-private-report promise is removed, before anything needed it](DECISIONS.md#d225--the-no-private-report-promise-is-removed-before-anything-needed-it) | D314 (+4) | 23007 |
| **D226** | [The edit-flow matrix — second thoughts become a published number](DECISIONS.md#d226--the-edit-flow-matrix--second-thoughts-become-a-published-number) | D290 (+4) | 23073 |
| **D227** | [The logic cut — the who-voted sheet groups answers by the verified score](DECISIONS.md#d227--the-logic-cut--the-who-voted-sheet-groups-answers-by-the-verified-score) | D304 (+3) | 23143 |
| **D228** | [The buyer model: three dims, nameless if wanted, and the lens waits](DECISIONS.md#d228--the-buyer-model-three-dims-nameless-if-wanted-and-the-lens-waits) | D313 (+3) | 23210 |
| **D229** | [Two releases shipped unrecorded, and the sixth skip is the one that costs](DECISIONS.md#d229--two-releases-shipped-unrecorded-and-the-sixth-skip-is-the-one-that-costs) | D381 (+5) | 23282 |
| **D230** | [An instrument's colour is where you stand now, not where you finished](DECISIONS.md#d230--an-instruments-colour-is-where-you-stand-now-not-where-you-finished) | D251 | 23345 |
| **D231** | [Current events get a lane: a topic that expires, and the questions to fill it](DECISIONS.md#d231--current-events-get-a-lane-a-topic-that-expires-and-the-questions-to-fill-it) | D351 (+5) | 23436 |
| **D232** | [Catalog questions go live: seventeen picks, promoted through one pen](DECISIONS.md#d232--catalog-questions-go-live-seventeen-picks-promoted-through-one-pen) | D347 (+4) | 23663 |
| **D233** | [Rank questions live: an answer carries an order, and the exclusion retires](DECISIONS.md#d233--rank-questions-live-an-answer-carries-an-order-and-the-exclusion-retires) | D290 (+3) | 23773 |
| **D234** | [The seed transports the doc shape the schema promises](DECISIONS.md#d234--the-seed-transports-the-doc-shape-the-schema-promises) | D311 (+2) | 23869 |
| **D235** | [No tragedies: this app does not put suffering to a vote](DECISIONS.md#d235--no-tragedies-this-app-does-not-put-suffering-to-a-vote) | D351 (+2) | 23935 |
| **D236** | [An invitation that notifies: the pick is the delivery](DECISIONS.md#d236--an-invitation-that-notifies-the-pick-is-the-delivery) | D254 (+4) | 24034 |
| **D237** | [Search finds people, by the address they gave you](DECISIONS.md#d237--search-finds-people-by-the-address-they-gave-you) | D239 | 24181 |
| **D238** | [The invite code stops being something a person reads](DECISIONS.md#d238--the-invite-code-stops-being-something-a-person-reads) | D253 (+1) | 24277 |
| **D239** | [Found by name, not only by the address you memorised](DECISIONS.md#d239--found-by-name-not-only-by-the-address-you-memorised) | D254 | 24403 |
| **D240** | [The link asks; the circle answers](DECISIONS.md#d240--the-link-asks-the-circle-answers) | D255 (+2) | 24521 |
| **D241** | [The de-overlap pass did not know the ring closes](DECISIONS.md#d241--the-de-overlap-pass-did-not-know-the-ring-closes) | D251 (+1) | 24629 |
| **D242** | [The owed list reaches zero, and eight defects fall out of it](DECISIONS.md#d242--the-owed-list-reaches-zero-and-eight-defects-fall-out-of-it) | D250 (+3) | 24710 |
| **D243** | [Two data-layer defects D242 found, fixed](DECISIONS.md#d243--two-data-layer-defects-d242-found-fixed) | D253 (+2) | 24828 |
| **D244** | [The three behaviour bugs from D242's list](DECISIONS.md#d244--the-three-behaviour-bugs-from-d242s-list) | D245 | 24951 |
| **D245** | [The three honesty findings from D242's list](DECISIONS.md#d245--the-three-honesty-findings-from-d242s-list) | — | 25026 |
| **D246** | [The coupling ratchet, 392 → 352](DECISIONS.md#d246--the-coupling-ratchet-392--352) | D249 (+2) | 25103 |
| **D247** | [PLACESTATS off the bridge, 352 → 337](DECISIONS.md#d247--placestats-off-the-bridge-352--337) | — | 25191 |
| **D248** | [The shell's cross-links become a registry, 337 → 295](DECISIONS.md#d248--the-shells-cross-links-become-a-registry-337--295) | D249 | 25239 |
| **D249** | [world-feed.jsx, 295 → 267](DECISIONS.md#d249--world-feedjsx-295--267) | D280 | 25331 |
|  | ↳ *amendment 2026-08-23* — [world-feed.jsx meets main's live pick/rank seam](DECISIONS.md#d249-amendment-2026-08-23--world-feedjsx-meets-mains-live-pickrank-seam) | — | 25393 |
| **D250** | [The a11y ratchet: six were right, one was hiding](DECISIONS.md#d250--the-a11y-ratchet-six-were-right-one-was-hiding) | D251 | 25426 |
| **D251** | [The report builder ships, and reads as a signed-in user](DECISIONS.md#d251--the-report-builder-ships-and-reads-as-a-signed-in-user) | D265 (+1) | 25510 |
| **D252** | [The never-grouped promise is removed, and the scope becomes a choice](DECISIONS.md#d252--the-never-grouped-promise-is-removed-and-the-scope-becomes-a-choice) | D314 (+1) | 25602 |
| **D253** | [The archetype module leaves the bridge, and the report gets its type cuts](DECISIONS.md#d253--the-archetype-module-leaves-the-bridge-and-the-report-gets-its-type-cuts) | D254 | 25670 |
| **D254** | [The axis bands ship, in the app's own vocabulary](DECISIONS.md#d254--the-axis-bands-ship-in-the-apps-own-vocabulary) | D331 (+3) | 25734 |
| **D255** | [Both doors at once: accepting an invitation clears the ask](DECISIONS.md#d255--both-doors-at-once-accepting-an-invitation-clears-the-ask) | D265 (+1) | 25782 |
| **D256** | [The surface claim is an equality, and was the same test twice](DECISIONS.md#d256--the-surface-claim-is-an-equality-and-was-the-same-test-twice) | — | 25847 |
| **D257** | [The inventory's reader column, held to the two rules a script may read literally](DECISIONS.md#d257--the-inventorys-reader-column-held-to-the-two-rules-a-script-may-read-literally) | D261 | 25937 |
| **D258** | [Two shipped surfaces the bank never fetched](DECISIONS.md#d258--two-shipped-surfaces-the-bank-never-fetched) | D331 (+3) | 26020 |
| **D259** | [Two numbers that contradicted the picture beside them](DECISIONS.md#d259--two-numbers-that-contradicted-the-picture-beside-them) | — | 26094 |
| **D260** | [The volume ceiling was budgeting a window the scan does not read](DECISIONS.md#d260--the-volume-ceiling-was-budgeting-a-window-the-scan-does-not-read) | — | 26149 |
| **D261** | [Three gates that did not hold, and the queue sweep that took someone else's evidence](DECISIONS.md#d261--three-gates-that-did-not-hold-and-the-queue-sweep-that-took-someone-elses-evidence) | D264 | 26238 |
| **D262** | [Four sentences that stopped being true, and two of them are now counted](DECISIONS.md#d262--four-sentences-that-stopped-being-true-and-two-of-them-are-now-counted) | — | 26344 |
| **D263** | [The room cache is keyed by one cell and folded over nine](DECISIONS.md#d263--the-room-cache-is-keyed-by-one-cell-and-folded-over-nine) | D264 | 26411 |
| **D264** | [Five the skeptics found, and one of them was two hours old](DECISIONS.md#d264--five-the-skeptics-found-and-one-of-them-was-two-hours-old) | D265 | 26469 |
| **D265** | [Patterns comes back on the data, not on a flag](DECISIONS.md#d265--patterns-comes-back-on-the-data-not-on-a-flag) | D362 (+5) | 26568 |
| **D266** | [The films catalogue ships; artists is refused on its content, not on the network](DECISIONS.md#d266--the-films-catalogue-ships-artists-is-refused-on-its-content-not-on-the-network) | D347 (+2) | 26816 |
| **D267** | [The artists catalogue gets a rule and a reviewer, because no rule alone finishes](DECISIONS.md#d267--the-artists-catalogue-gets-a-rule-and-a-reviewer-because-no-rule-alone-finishes) | D308 | 26911 |
| **D268** | [The ledger learns to count people: engagement rung 0](DECISIONS.md#d268--the-ledger-learns-to-count-people-engagement-rung-0) | D332 (+4) | 26998 |
| **D269** | [The ceiling: what stays refused at every engagement rung](DECISIONS.md#d269--the-ceiling-what-stays-refused-at-every-engagement-rung) | D334 (+4) | 27086 |
| **D270** | [The anonymous channel: engagement rung 1 collects, unlinkably](DECISIONS.md#d270--the-anonymous-channel-engagement-rung-1-collects-unlinkably) | D329 (+4) | 27125 |
| **D271** | [Per-question attention, aggregate-only — the R4 gate](DECISIONS.md#d271--per-question-attention-aggregate-only--the-r4-gate) | D329 (+1) | 27217 |
| **D272** | [The person channel: engagement rung 2, scoped to the bone](DECISIONS.md#d272--the-person-channel-engagement-rung-2-scoped-to-the-bone) | D356 (+3) | 27258 |
| **D273** | [A bump has a shelf life of exactly one upload, and 4.4 under-declares by two rows](DECISIONS.md#d273--a-bump-has-a-shelf-life-of-exactly-one-upload-and-44-under-declares-by-two-rows) | D381 (+3) | 27329 |
| **D274** | [Build 25 is delivered, and the bump was the reading of step 17](DECISIONS.md#d274--build-25-is-delivered-and-the-bump-was-the-reading-of-step-17) | D381 (+2) | 27451 |
| **D275** | [The private aggregate mirror collapses into the published one](DECISIONS.md#d275--the-private-aggregate-mirror-collapses-into-the-published-one) | D299 (+3) | 27522 |
| **D276** | [The suite audited itself: what stayed green while being wrong](DECISIONS.md#d276--the-suite-audited-itself-what-stayed-green-while-being-wrong) | D352 (+9) | 27642 |
| **D277** | [The similarity surfaces were ranking on a tier that could not fire](DECISIONS.md#d277--the-similarity-surfaces-were-ranking-on-a-tier-that-could-not-fire) | D299 (+4) | 27787 |
| **D278** | [The City constellation asks for its city, instead of filtering for it](DECISIONS.md#d278--the-city-constellation-asks-for-its-city-instead-of-filtering-for-it) | D332 | 28052 |
| **D279** | [There were always five test runners, and the table said four](DECISIONS.md#d279--there-were-always-five-test-runners-and-the-table-said-four) | D284 | 28161 |
| **D280** | [The feed's test cards came back demo, and the seam was a cast](DECISIONS.md#d280--the-feeds-test-cards-came-back-demo-and-the-seam-was-a-cast) | D354 (+4) | 28264 |
| **D281** | [The `i` had a background slot, and it was empty in every live build](DECISIONS.md#d281--the-i-had-a-background-slot-and-it-was-empty-in-every-live-build) | D351 (+2) | 28412 |
| **D282** | [The topics door stops moving you, when it does not have to](DECISIONS.md#d282--the-topics-door-stops-moving-you-when-it-does-not-have-to) | — | 28527 |
| **D283** | [Every field is followed, and the follow list gets a way out](DECISIONS.md#d283--every-field-is-followed-and-the-follow-list-gets-a-way-out) | D321 (+2) | 28647 |
| **D284** | [The learn bank leaves the JavaScript](DECISIONS.md#d284--the-learn-bank-leaves-the-javascript) | D350 (+2) | 28751 |
| **D285** | [The seed's whitelist, held to the generator — after the third time](DECISIONS.md#d285--the-seeds-whitelist-held-to-the-generator--after-the-third-time) | D328 | 28907 |
| **D286** | [An account switch cannot delete the outgoing account's presence cell](DECISIONS.md#d286--an-account-switch-cannot-delete-the-outgoing-accounts-presence-cell) | D326 | 29002 |
| **D287** | [The 2026-08-24 visual passes ship; the paid door and the two-crowd scorecards wait on their owners](DECISIONS.md#d287--the-2026-08-24-visual-passes-ship-the-paid-door-and-the-two-crowd-scorecards-wait-on-their-owners) | D362 (+2) | 29065 |
| **D288** | [The board retires, the crowds get honest labels, and the paid mechanism builds ahead of demand](DECISIONS.md#d288--the-board-retires-the-crowds-get-honest-labels-and-the-paid-mechanism-builds-ahead-of-demand) | D372 (+3) | 29147 |
| **D289** | [Axes, Axiom Theory, and the program between them](DECISIONS.md#d289--axes-axiom-theory-and-the-program-between-them) | D385 (+7) | 29202 |
| **D290** | [The answers are the log; every aggregate is a projection, and now there is a tool that proves it](DECISIONS.md#d290--the-answers-are-the-log-every-aggregate-is-a-projection-and-now-there-is-a-tool-that-proves-it) | D356 (+5) | 29270 |
|  | ↳ *amendment 2026-08-24* — [The collapse is done for three arms, and refused for the fourth](DECISIONS.md#d290-amendment-2026-08-24--the-collapse-is-done-for-three-arms-and-refused-for-the-fourth) | — | 29487 |
|  | ↳ *amendment 2026-08-25* — [The other two fold arms, so the thesis stops being one third true](DECISIONS.md#d290-amendment-2026-08-25--the-other-two-fold-arms-so-the-thesis-stops-being-one-third-true) | — | 29818 |
| **D291** | [The alerting refusal said less than it was read as saying, and its arithmetic was off by 4×](DECISIONS.md#d291--the-alerting-refusal-said-less-than-it-was-read-as-saying-and-its-arithmetic-was-off-by-4) | D303 (+1) | 29659 |
| **D292** | [A read-only observer, on WIF rather than a second key](DECISIONS.md#d292--a-read-only-observer-on-wif-rather-than-a-second-key) | D303 (+2) | 29733 |
| **D293** | [A moderation verdict's ID is not neutral, and the privacy page says it is](DECISIONS.md#d293--a-moderation-verdicts-id-is-not-neutral-and-the-privacy-page-says-it-is) | D326 (+2) | 29905 |
| **D294** | [A deep clean, priced: what moved, what did not, and the eight rules that hold it](DECISIONS.md#d294--a-deep-clean-priced-what-moved-what-did-not-and-the-eight-rules-that-hold-it) | D299 | 29959 |
| **D295** | [What the first production run of the repair tool cost, and the data-loss path it exposed](DECISIONS.md#d295--what-the-first-production-run-of-the-repair-tool-cost-and-the-data-loss-path-it-exposed) | D299 (+2) | 30122 |
| **D296** | [The scorecard has been reading production through a retired predicate, and every number downstream inherited the zero](DECISIONS.md#d296--the-scorecard-has-been-reading-production-through-a-retired-predicate-and-every-number-downstream-inherited-the-zero) | D331 (+6) | 30255 |
| **D297** | [Doing the things that could be done, and the four latent faults that surfaced on the way](DECISIONS.md#d297--doing-the-things-that-could-be-done-and-the-four-latent-faults-that-surfaced-on-the-way) | D299 (+1) | 30350 |
| **D298** | [The review of D296/D297 found a bug D296 had created, and five things that were true of the stub instead of the server](DECISIONS.md#d298--the-review-of-d296d297-found-a-bug-d296-had-created-and-five-things-that-were-true-of-the-stub-instead-of-the-server) | D299 | 30491 |
| **D299** | [Decision numbers get a gate, because three renumbers in two days is a process and not an accident](DECISIONS.md#d299--decision-numbers-get-a-gate-because-three-renumbers-in-two-days-is-a-process-and-not-an-accident) | D385 (+1) | 30601 |
| **D300** | [The first look at production, and the two things it said that the repo had wrong](DECISIONS.md#d300--the-first-look-at-production-and-the-two-things-it-said-that-the-repo-had-wrong) | D327 (+3) | 30669 |
| **D301** | [Twenty-one strays, three provenances, and one of them runs on every account deletion](DECISIONS.md#d301--twenty-one-strays-three-provenances-and-one-of-them-runs-on-every-account-deletion) | D333 | 30763 |
| **D302** | [The iris mark: the identity stops being a first pass](DECISIONS.md#d302--the-iris-mark-the-identity-stops-being-a-first-pass) | D340 (+1) | 30889 |
| **D303** | [The applier could not apply, for the same reason the observer could not observe](DECISIONS.md#d303--the-applier-could-not-apply-for-the-same-reason-the-observer-could-not-observe) | D333 (+2) | 30967 |
| **D304** | [The breakdown gets its scale back: every canonical bucket, in vocabulary order, on top of the cohort reading](DECISIONS.md#d304--the-breakdown-gets-its-scale-back-every-canonical-bucket-in-vocabulary-order-on-top-of-the-cohort-reading) | D308 (+3) | 31184 |
| **D305** | [A rating is one figure, not ten rows: the scale row, the ridge, and the mean](DECISIONS.md#d305--a-rating-is-one-figure-not-ten-rows-the-scale-row-the-ridge-and-the-mean) | D307 (+1) | 31250 |
| **D306** | [Context reaches the daily's ⓘ, and the banks get their first subject-context pass](DECISIONS.md#d306--context-reaches-the-dailys--and-the-banks-get-their-first-subject-context-pass) | D311 (+2) | 31303 |
| **D307** | [The scorecard learns to ask: unanswered place questions surface on the Scores lens](DECISIONS.md#d307--the-scorecard-learns-to-ask-unanswered-place-questions-surface-on-the-scores-lens) | D309 (+1) | 31358 |
| **D308** | [The athletes catalogue, its review file, and the pick card's browse tiles](DECISIONS.md#d308--the-athletes-catalogue-its-review-file-and-the-pick-cards-browse-tiles) | — | 31402 |
| **D309** | [A lane batch on the budget's own allocation, and why the interleave cadences stand](DECISIONS.md#d309--a-lane-batch-on-the-budgets-own-allocation-and-why-the-interleave-cadences-stand) | D348 | 31469 |
| **D310** | [The 2026-08-26 client passes ship; the two owner decisions and the paid family wait](DECISIONS.md#d310--the-2026-08-26-client-passes-ship-the-two-owner-decisions-and-the-paid-family-wait) | D362 (+2) | 31514 |
| **D311** | [The daily builder dropped `bg`, the seed's own written-count told on it, and the seed-fields gate learns surfaces](DECISIONS.md#d311--the-daily-builder-dropped-bg-the-seeds-own-written-count-told-on-it-and-the-seed-fields-gate-learns-surfaces) | — | 31685 |
| **D312** | [The answer-state caches leave the quota: the instrument, then the IndexedDB rows](DECISIONS.md#d312--the-answer-state-caches-leave-the-quota-the-instrument-then-the-indexeddb-rows) | D357 (+2) | 31728 |
| **D313** | [The paid question sells itself: automated review, Stripe checkout, and a question that goes live with nobody at the desk](DECISIONS.md#d313--the-paid-question-sells-itself-automated-review-stripe-checkout-and-a-question-that-goes-live-with-nobody-at-the-desk) | D375 (+7) | 31857 |
| **D314** | [The no-tracking promise retires; the page describes today and stays ahead of change](DECISIONS.md#d314--the-no-tracking-promise-retires-the-page-describes-today-and-stays-ahead-of-change) | D334 (+2) | 31967 |
| **D315** | [Ads sell themselves too — flat-priced windows through the same loop, and no Google](DECISIONS.md#d315--ads-sell-themselves-too--flat-priced-windows-through-the-same-loop-and-no-google) | D375 (+6) | 32004 |
| **D316** | [Serving becomes selection: pages instead of the whole bank, and the order inherits the caps' job](DECISIONS.md#d316--serving-becomes-selection-pages-instead-of-the-whole-bank-and-the-order-inherits-the-caps-job) | D383 (+8) | 32071 |
| **D317** | [The taste model moves to the server, because selection cannot be personal from inside a page](DECISIONS.md#d317--the-taste-model-moves-to-the-server-because-selection-cannot-be-personal-from-inside-a-page) | D367 (+3) | 32184 |
| **D318** | [The bank cache leaves the small box](DECISIONS.md#d318--the-bank-cache-leaves-the-small-box) | D344 (+1) | 32263 |
|  | ↳ *amendment 2026-08-26* — [The merge converged on D312's store, the same day](DECISIONS.md#d318-amendment-2026-08-26--the-merge-converged-on-d312s-store-the-same-day) | — | 32300 |
| **D319** | [The serving order publishes nightly](DECISIONS.md#d319--the-serving-order-publishes-nightly) | D350 (+2) | 32316 |
| **D320** | [Learn leaves the boot fetch: the first paged surface](DECISIONS.md#d320--learn-leaves-the-boot-fetch-the-first-paged-surface) | D383 (+3) | 32362 |
| **D321** | [The feed tail leaves the boot fetch, and the whole-bank install is over](DECISIONS.md#d321--the-feed-tail-leaves-the-boot-fetch-and-the-whole-bank-install-is-over) | D383 (+2) | 32420 |
| **D322** | [The profile is real: feed answers counted by topic, and pages sized by them](DECISIONS.md#d322--the-profile-is-real-feed-answers-counted-by-topic-and-pages-sized-by-them) | D367 (+1) | 32469 |
| **D323** | [The 2026-08-27 night audit, reviewed — 21 fixes kept, five limits recorded](DECISIONS.md#d323--the-2026-08-27-night-audit-reviewed--21-fixes-kept-five-limits-recorded) | D336 (+3) | 32579 |
| **D324** | [Build 26's pre-flight: run as-is, and the one surface no release gate can see](DECISIONS.md#d324--build-26s-pre-flight-run-as-is-and-the-one-surface-no-release-gate-can-see) | D381 (+1) | 32694 |
| **D325** | [The bridge's first crossing: the fit publishes its own scorecard](DECISIONS.md#d325--the-bridges-first-crossing-the-fit-publishes-its-own-scorecard) | D366 | 32846 |
| **D326** | [The genetic axiom's ambition widens, and the night shift gets a closing hour](DECISIONS.md#d326--the-genetic-axioms-ambition-widens-and-the-night-shift-gets-a-closing-hour) | D347 (+2) | 32922 |
| **D327** | [The console kept selling the floor: twelve captions that outlived the arithmetic](DECISIONS.md#d327--the-console-kept-selling-the-floor-twelve-captions-that-outlived-the-arithmetic) | D367 (+4) | 33003 |
| **D328** | [Profession becomes a dim, through a field — and the reason it was not one had stopped being true](DECISIONS.md#d328--profession-becomes-a-dim-through-a-field--and-the-reason-it-was-not-one-had-stopped-being-true) | D331 | 33103 |
| **D329** | [Three of D269's seven refusals are lifted, and the bundle becomes a list](DECISIONS.md#d329--three-of-d269s-seven-refusals-are-lifted-and-the-bundle-becomes-a-list) | D334 (+1) | 33213 |
| **D330** | [The political consent is asked at the start, on D151's screen, and it is an ask rather than a wall](DECISIONS.md#d330--the-political-consent-is-asked-at-the-start-on-d151s-screen-and-it-is-an-ask-rather-than-a-wall) | D352 (+3) | 33299 |
| **D331** | [The political compass waits for a yes, and the toggle governs whether it is COMPUTED](DECISIONS.md#d331--the-political-compass-waits-for-a-yes-and-the-toggle-governs-whether-it-is-computed) | D352 (+4) | 33417 |
| **D332** | [The read breaker is built, and the pulse guards usage against revenue](DECISIONS.md#d332--the-read-breaker-is-built-and-the-pulse-guards-usage-against-revenue) | D335 | 33528 |
|  | ↳ *amendment 2026-08-29* — [A third guard state, because the pass could be a frozen file](DECISIONS.md#d332-amendment-2026-08-29--a-third-guard-state-because-the-pass-could-be-a-frozen-file) | — | 33693 |
| **D333** | [Phase 5 executed: the strays are gone, the rollback is retired, and two promises got their settings](DECISIONS.md#d333--phase-5-executed-the-strays-are-gone-the-rollback-is-retired-and-two-promises-got-their-settings) | D335 | 33722 |
| **D334** | [The product is the connections, and a privacy constraint is an ask rather than a stop](DECISIONS.md#d334--the-product-is-the-connections-and-a-privacy-constraint-is-an-ask-rather-than-a-stop) | D380 (+8) | 33878 |
| **D335** | [Two night audits, reviewed together — 64 fixes kept, one figure corrected, and the merge that had to be both](DECISIONS.md#d335--two-night-audits-reviewed-together--64-fixes-kept-one-figure-corrected-and-the-merge-that-had-to-be-both) | D336 | 33993 |
| **D336** | [The 2026-08-30 night audit, merged with the two-night review that had been waiting — 104 commits landed as one tree](DECISIONS.md#d336--the-2026-08-30-night-audit-merged-with-the-two-night-review-that-had-been-waiting--104-commits-landed-as-one-tree) | D363 (+3) | 34162 |
| **D337** | [reCAPTCHA stays unprovisioned; the web path is developers and CI, and they carry debug tokens](DECISIONS.md#d337--recaptcha-stays-unprovisioned-the-web-path-is-developers-and-ci-and-they-carry-debug-tokens) | D369 (+3) | 34293 |
| **D338** | [The 2026-08-31 night audit, reviewed and merged — 35 commits kept, two hand-written figures corrected, and one live bias that is the owner's call](DECISIONS.md#d338--the-2026-08-31-night-audit-reviewed-and-merged--35-commits-kept-two-hand-written-figures-corrected-and-one-live-bias-that-is-the-owners-call) | D339 | 34371 |
| **D339** | [Build 27 was delivered and unrecorded; the pre-flight opened on a spent number, and the counts are level](DECISIONS.md#d339--build-27-was-delivered-and-unrecorded-the-pre-flight-opened-on-a-spent-number-and-the-counts-are-level) | D381 | 34498 |
|  | ↳ *amendment 2026-08-31* — [Build 28 is delivered, and the bump held off step 17](DECISIONS.md#d339-amendment-2026-08-31--build-28-is-delivered-and-the-bump-held-off-step-17) | — | 34592 |
| **D340** | [The app icon moves to the paper tile, and the two-palette rule survives the move](DECISIONS.md#d340--the-app-icon-moves-to-the-paper-tile-and-the-two-palette-rule-survives-the-move) | — | 34645 |
| **D341** | [Crossroads is a question TYPE, and its stories ride the feed as members](DECISIONS.md#d341--crossroads-is-a-question-type-and-its-stories-ride-the-feed-as-members) | — | 34727 |
| **D342** | [The fake-account defence was inert, and two records had already spent it](DECISIONS.md#d342--the-fake-account-defence-was-inert-and-two-records-had-already-spent-it) | D343 | 34834 |
| **D343** | [The account requirement becomes a level, so the bar can be raised later](DECISIONS.md#d343--the-account-requirement-becomes-a-level-so-the-bar-can-be-raised-later) | D347 (+1) | 35024 |
| **D344** | [Account & privacy moves behind a gear in the profile's corner](DECISIONS.md#d344--account--privacy-moves-behind-a-gear-in-the-profiles-corner) | — | 35239 |
|  | ↳ *amendment 2026-09-01* — [The identity row stops calling every session anonymous](DECISIONS.md#d344-amendment-2026-09-01--the-identity-row-stops-calling-every-session-anonymous) | — | 35308 |
| **D345** | [Play is un-parked on an ENK, and the two code items that had no owner get built](DECISIONS.md#d345--play-is-un-parked-on-an-enk-and-the-two-code-items-that-had-no-owner-get-built) | D367 | 35347 |
| **D346** | [The review lane: every second night, every axiom lane's work is scored and told how to be more useful](DECISIONS.md#d346--the-review-lane-every-second-night-every-axiom-lanes-work-is-scored-and-told-how-to-be-more-useful) | D347 | 35481 |
| **D347** | [Ties and Interests are chartered: the relational axis gets its row and its lane, and the interests axis gets the lane it never had](DECISIONS.md#d347--ties-and-interests-are-chartered-the-relational-axis-gets-its-row-and-its-lane-and-the-interests-axis-gets-the-lane-it-never-had) | — | 35555 |
| **D348** | [The feed weaves its fresh topics, not its answered ones — the returning device stops opening on tests and learn](DECISIONS.md#d348--the-feed-weaves-its-fresh-topics-not-its-answered-ones--the-returning-device-stops-opening-on-tests-and-learn) | — | 35638 |
| **D349** | [Two night shifts and a night nobody had read, merged as one tree — 81 commits kept, four added, and a standalone suite that could not stand alone](DECISIONS.md#d349--two-night-shifts-and-a-night-nobody-had-read-merged-as-one-tree--81-commits-kept-four-added-and-a-standalone-suite-that-could-not-stand-alone) | D363 (+1) | 35752 |
|  | ↳ *amendment 2026-09-02* — [The figure collision is not about composing branches; it is about two merges thirty seconds apart](DECISIONS.md#d349-amendment-2026-09-02--the-figure-collision-is-not-about-composing-branches-it-is-about-two-merges-thirty-seconds-apart) | — | 35940 |
| **D350** | [The lane regulators lose their ceilings: floors, demand shares, and the holdover inventory](DECISIONS.md#d350--the-lane-regulators-lose-their-ceilings-floors-demand-shares-and-the-holdover-inventory) | — | 35990 |
|  | ↳ *amendment 2026-09-01* — [The bank-size failure was a question limit in everything but name](DECISIONS.md#d350-amendment-2026-09-01--the-bank-size-failure-was-a-question-limit-in-everything-but-name) | — | 36197 |
| **D351** | [Current events get their lane: found by searching, never from memory](DECISIONS.md#d351--current-events-get-their-lane-found-by-searching-never-from-memory) | — | 36227 |
| **D352** | [The program: six lists, the axiom builder, the merge shift and the owner's tick — adopted, and the label rule amended](DECISIONS.md#d352--the-program-six-lists-the-axiom-builder-the-merge-shift-and-the-owners-tick--adopted-and-the-label-rule-amended) | D385 (+5) | 36282 |
| **D353** | [The dispatcher's charter becomes a contract: a standing instruction a session cannot verify is one it should refuse](DECISIONS.md#d353--the-dispatchers-charter-becomes-a-contract-a-standing-instruction-a-session-cannot-verify-is-one-it-should-refuse) | D359 | 36389 |
| **D354** | [The store leaves the bridge, and the sweep behind it takes the coupling ratchet 234 → 32](DECISIONS.md#d354--the-store-leaves-the-bridge-and-the-sweep-behind-it-takes-the-coupling-ratchet-234--32) | D382 (+4) | 36532 |
| **D355** | [The Mirror leaves the eager graph through a same-tick slot: 761 → 619 KB](DECISIONS.md#d355--the-mirror-leaves-the-eager-graph-through-a-same-tick-slot-761--619-kb) | D363 (+1) | 36631 |
| **D356** | [First paint comes off the device: the warm boot, and `ready` splits from `attached`](DECISIONS.md#d356--first-paint-comes-off-the-device-the-warm-boot-and-ready-splits-from-attached) | D383 (+1) | 36710 |
| **D357** | [An answer the server has not acknowledged survives the relaunch](DECISIONS.md#d357--an-answer-the-server-has-not-acknowledged-survives-the-relaunch) | — | 36978 |
| **D358** | [Fourteen dials get the range they should have shipped with, by retirement and replacement](DECISIONS.md#d358--fourteen-dials-get-the-range-they-should-have-shipped-with-by-retirement-and-replacement) | — | 37159 |
| **D359** | [The routine bill is context times turns: four sessions, not thirty-nine firings, were the spend](DECISIONS.md#d359--the-routine-bill-is-context-times-turns-four-sessions-not-thirty-nine-firings-were-the-spend) | — | 37257 |
| **D360** | [Two night shifts merged as one tree — 60 commits kept, and the sweep they both branched before is the whole story](DECISIONS.md#d360--two-night-shifts-merged-as-one-tree--60-commits-kept-and-the-sweep-they-both-branched-before-is-the-whole-story) | D363 | 37402 |
| **D361** | [The owner's own upload moves the vision: the 2026-09-02 standalone is what the tree is built toward](DECISIONS.md#d361--the-owners-own-upload-moves-the-vision-the-2026-09-02-standalone-is-what-the-tree-is-built-toward) | D362 | 37590 |
| **D362** | [The 2026-09-02 design is built: one instrument for the three lenses, a voice for the questions, and the split ballot](DECISIONS.md#d362--the-2026-09-02-design-is-built-one-instrument-for-the-three-lenses-a-voice-for-the-questions-and-the-split-ballot) | — | 37670 |
| **D363** | [The 2026-09-04 night review: two shifts merged as one tree — 45 commits kept, one comment corrected, and the night that had nothing to collide with](DECISIONS.md#d363--the-2026-09-04-night-review-two-shifts-merged-as-one-tree--45-commits-kept-one-comment-corrected-and-the-night-that-had-nothing-to-collide-with) | D365 (+1) | 37759 |
| **D364** | [A component defined inside a render is a remount per render: the profile's result panels, and the loop that shook the rose until the app died](DECISIONS.md#d364--a-component-defined-inside-a-render-is-a-remount-per-render-the-profiles-result-panels-and-the-loop-that-shook-the-rose-until-the-app-died) | D381 (+1) | 37893 |
| **D365** | [The 2026-09-05 night review: two shifts merged as one tree — 50 commits kept, one defect the composition created, and the kilobyte that finally tripped](DECISIONS.md#d365--the-2026-09-05-night-review-two-shifts-merged-as-one-tree--50-commits-kept-one-defect-the-composition-created-and-the-kilobyte-that-finally-tripped) | D382 (+1) | 37975 |
| **D366** | [Nothing the theory lanes wrote is axiom theory, and the ladder is why — the potential half, the salvage, and the gate that holds the line](DECISIONS.md#d366--nothing-the-theory-lanes-wrote-is-axiom-theory-and-the-ladder-is-why--the-potential-half-the-salvage-and-the-gate-that-holds-the-line) | — | 38178 |
| **D367** | [Four launch documents said things that had stopped being true, and the one step that needs no Apple account demanded an Apple key](DECISIONS.md#d367--four-launch-documents-said-things-that-had-stopped-being-true-and-the-one-step-that-needs-no-apple-account-demanded-an-apple-key) | D369 | 38289 |
| **D368** | [Shape A adopted: the paid door leaves the app, and buying moves to the web](DECISIONS.md#d368--shape-a-adopted-the-paid-door-leaves-the-app-and-buying-moves-to-the-web) | D378 (+4) | 38656 |
|  | ↳ *amendment 2026-09-05* — [The legacy free-suggestion rows go with the overlay](DECISIONS.md#d368-amendment-2026-09-05--the-legacy-free-suggestion-rows-go-with-the-overlay) | — | 38744 |
|  | ↳ *amendment 2026-09-05* — [The account is required at the pay tap, and the requirement is an identity rather than Google](DECISIONS.md#d368-amendment-2026-09-05--the-account-is-required-at-the-pay-tap-and-the-requirement-is-an-identity-rather-than-google) | — | 38766 |
|  | ↳ *amendment 2026-09-05* — [The door is out of the binary, and it had five entry points rather than one](DECISIONS.md#d368-amendment-2026-09-05--the-door-is-out-of-the-binary-and-it-had-five-entry-points-rather-than-one) | — | 38812 |
| **D369** | [The web ask door is built: an adapter, a page, and the two things that stood between it and a buyer](DECISIONS.md#d369--the-web-ask-door-is-built-an-adapter-a-page-and-the-two-things-that-stood-between-it-and-a-buyer) | D381 (+4) | 38879 |
| **D370** | [Near is a switch again: off or on, and the timed option retires](DECISIONS.md#d370--near-is-a-switch-again-off-or-on-and-the-timed-option-retires) | D381 (+1) | 39012 |
| **D371** | [The rate card folds itself: the demand index moves on every sale and every night, and the door prints the published card](DECISIONS.md#d371--the-rate-card-folds-itself-the-demand-index-moves-on-every-sale-and-every-night-and-the-door-prints-the-published-card) | D373 (+1) | 39085 |
| **D372** | [The buyer sets the budget, the base is the quiet price, and a served week is a basis — per-answer billing stays](DECISIONS.md#d372--the-buyer-sets-the-budget-the-base-is-the-quiet-price-and-a-served-week-is-a-basis--per-answer-billing-stays) | D376 (+1) | 39252 |
| **D373** | [The index is crowding, with no ceiling, and the quiet price is €0.02](DECISIONS.md#d373--the-index-is-crowding-with-no-ceiling-and-the-quiet-price-is-002) | D377 (+2) | 39360 |
| **D374** | [Ads run from the day after payment and share the rotation, and the ad window follows the cut](DECISIONS.md#d374--ads-run-from-the-day-after-payment-and-share-the-rotation-and-the-ad-window-follows-the-cut) | D375 | 39462 |
| **D375** | [Ads leave the door: the sponsored question is the one paid product](DECISIONS.md#d375--ads-leave-the-door-the-sponsored-question-is-the-one-paid-product) | D380 (+1) | 39545 |
| **D376** | [The menu: the door prints a price per reach, and a row opens the composer at it](DECISIONS.md#d376--the-menu-the-door-prints-a-price-per-reach-and-a-row-opens-the-composer-at-it) | — | 39630 |
| **D377** | [Paid cards get their own places in the feed, and the price counts crowding beyond them](DECISIONS.md#d377--paid-cards-get-their-own-places-in-the-feed-and-the-price-counts-crowding-beyond-them) | — | 39699 |
| **D378** | [A sponsored question may carry one reviewed link, shown after the answer and counted by nobody](DECISIONS.md#d378--a-sponsored-question-may-carry-one-reviewed-link-shown-after-the-answer-and-counted-by-nobody) | D379 | 39786 |
| **D379** | [The shareable results page: a sponsored question's numbers as one public web page](DECISIONS.md#d379--the-shareable-results-page-a-sponsored-questions-numbers-as-one-public-web-page) | D380 | 39870 |
| **D380** | [The 2026-09-06 night review: two shifts merged as one tree — 68 commits kept, two defects the composition created, and a fix whose tests a third PR deleted](DECISIONS.md#d380--the-2026-09-06-night-review-two-shifts-merged-as-one-tree--68-commits-kept-two-defects-the-composition-created-and-a-fix-whose-tests-a-third-pr-deleted) | — | 39948 |
| **D381** | [Build 29 was delivered and unrecorded, the pre-flight opened on a spent number again, and the gate built to stop that has never been switched on](DECISIONS.md#d381--build-29-was-delivered-and-unrecorded-the-pre-flight-opened-on-a-spent-number-again-and-the-gate-built-to-stop-that-has-never-been-switched-on) | D385 | 40193 |
|  | ↳ *amendment 2026-09-06* — [Build 30 is delivered, and the whole release happened in one sitting](DECISIONS.md#d381-amendment-2026-09-06--build-30-is-delivered-and-the-whole-release-happened-in-one-sitting) | — | 40343 |
| **D382** | [Question content is not first-paint bytes, and a gate says so](DECISIONS.md#d382--question-content-is-not-first-paint-bytes-and-a-gate-says-so) | D383 | 40409 |
| **D383** | [The daily pages: a published length, seven documents, and the density it rests on](DECISIONS.md#d383--the-daily-pages-a-published-length-seven-documents-and-the-density-it-rests-on) | D384 | 40488 |
| **D384** | [The Scores pool pages too: ids in the shape document, documents by the page](DECISIONS.md#d384--the-scores-pool-pages-too-ids-in-the-shape-document-documents-by-the-page) | — | 40574 |
| **D385** | [The PR shepherd is retired: pull requests are merged by hand](DECISIONS.md#d385--the-pr-shepherd-is-retired-pull-requests-are-merged-by-hand) | — | 40646 |
