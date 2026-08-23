# Decision index

Generated — `npm run build:doc-index`. Every record in
[`DECISIONS.md`](DECISIONS.md), ordered by number, so the question
"which decision governs this" is 237 lines instead of
23,585. Do not hand-edit; `npm run check:docs` fails when this
drifts from the source.

**Cited later by** is the newest record that mentions this one, and how
many others do. It is a *citation*, not a reversal — but a record with a
much newer citer is one to read from the bottom up. Supersession in this
file is marked three different ways, so the index does not claim to
detect it.

| # | Decision | Cited later by | Line |
| --- | --- | --- | --- |
| **D1** | [Comments and "who voted" are circle-scoped only](DECISIONS.md#d1--comments-and-who-voted-are-circle-scoped-only) | D195 (+35) | 14 |
| **D2** | ["Near" means geohash5 (~5 km), reusing the existing geo system](DECISIONS.md#d2--near-means-geohash5-5-km-reusing-the-existing-geo-system) | D84 (+3) | 29 |
| **D3** | [Anonymous-first auth with account linking](DECISIONS.md#d3--anonymous-first-auth-with-account-linking) | D223 (+17) | 97 |
| **D4** | [The v1 shelf, and the legacy boundary](DECISIONS.md#d4--the-v1-shelf-and-the-legacy-boundary) | D192 (+6) | 342 |
| **D5** | [Sealed answers are owner-only; reveals are materialized server-side](DECISIONS.md#d5--sealed-answers-are-owner-only-reveals-are-materialized-server-side) | D224 (+18) | 393 |
| **D6** | [Android backup off; iPhone-only; no custom crypto](DECISIONS.md#d6--android-backup-off-iphone-only-no-custom-crypto) | D192 (+3) | 296 |
| **D7** | [Backend scale ceilings — recorded, not engineered around](DECISIONS.md#d7--backend-scale-ceilings--recorded-not-engineered-around) | D192 (+20) | 167 |
|  | ↳ *amendment 2026-08-03* — [The retry-logging trigger now has an instrument](DECISIONS.md#d7-amendment-2026-08-03--the-retry-logging-trigger-now-has-an-instrument) | — | 3524 |
| **D8** | [Per-anchor breakdowns are built; collecting the anchors is not](DECISIONS.md#d8--per-anchor-breakdowns-are-built-collecting-the-anchors-is-not) | D232 (+31) | 449 |
| **D9** | [Near is your city — picked from a list, or located on the device](DECISIONS.md#d9--near-is-your-city--picked-from-a-list-or-located-on-the-device) | D192 (+21) | 556 |
| **D10** | [@capacitor-firebase/app-check is installed under an npm alias](DECISIONS.md#d10--capacitor-firebaseapp-check-is-installed-under-an-npm-alias) | D29 | 816 |
| **D11** | [The feed's argument surfaces are demo-only, by structure not by flag](DECISIONS.md#d11--the-feeds-argument-surfaces-are-demo-only-by-structure-not-by-flag) | D98 (+3) | 885 |
| **D12** | [Rank questions are out of the live feed until answers can carry an order](DECISIONS.md#d12--rank-questions-are-out-of-the-live-feed-until-answers-can-carry-an-order) | D213 (+6) | 1054 |
| **D13** | [The v1 compute is deleted, for the reason D4 deleted the v1 rules](DECISIONS.md#d13--the-v1-compute-is-deleted-for-the-reason-d4-deleted-the-v1-rules) | D223 (+2) | 1093 |
| **D14** | [Catalog answers are keys into a shipped catalogue; the reveal is a canon](DECISIONS.md#d14--catalog-answers-are-keys-into-a-shipped-catalogue-the-reveal-is-a-canon) | D78 (+3) | 1218 |
| **D15** | [Films/artists catalogues: QID keys, and generation is an operator step](DECISIONS.md#d15--filmsartists-catalogues-qid-keys-and-generation-is-an-operator-step) | D145 (+1) | 1270 |
| **D16** | [The Facebook SDK is stripped from the iOS build, not declared](DECISIONS.md#d16--the-facebook-sdk-is-stripped-from-the-ios-build-not-declared) | D164 (+2) | 1312 |
| **D17** | [Catalog breakdowns: each segment orders the board, never a board of its own](DECISIONS.md#d17--catalog-breakdowns-each-segment-orders-the-board-never-a-board-of-its-own) | — | 1404 |
| **D18** | [The breakdown floor bounds cohort size, not the split inside a cohort](DECISIONS.md#d18--the-breakdown-floor-bounds-cohort-size-not-the-split-inside-a-cohort) | D106 (+3) | 1449 |
| **D19** | [The reveal scan asks an indexed question; the ops hook still reads everything](DECISIONS.md#d19--the-reveal-scan-asks-an-indexed-question-the-ops-hook-still-reads-everything) | D55 | 1508 |
| **D20** | [Function runtime options are per-function; the global stays the heavy default](DECISIONS.md#d20--function-runtime-options-are-per-function-the-global-stays-the-heavy-default) | — | 1614 |
| **D21** | [The live-mode branches get a mount test; accessibility gets a ratchet](DECISIONS.md#d21--the-live-mode-branches-get-a-mount-test-accessibility-gets-a-ratchet) | D49 (+3) | 1674 |
| **D22** | [Moderation substrate: confinement is structural, and advisory until trusted](DECISIONS.md#d22--moderation-substrate-confinement-is-structural-and-advisory-until-trusted) | D78 (+2) | 1758 |
| **D23** | [The mouse-only spec-layer controls become buttons, ahead of the interaction tests D21 wanted](DECISIONS.md#d23--the-mouse-only-spec-layer-controls-become-buttons-ahead-of-the-interaction-tests-d21-wanted) | D24 | 1897 |
| **D24** | [Every overlay and sheet is a real modal dialog, and this time the interaction test came with it](DECISIONS.md#d24--every-overlay-and-sheet-is-a-real-modal-dialog-and-this-time-the-interaction-test-came-with-it) | D221 (+1) | 1990 |
| **D25** | [The world feed loads after first paint; the rest of the split waits](DECISIONS.md#d25--the-world-feed-loads-after-first-paint-the-rest-of-the-split-waits) | D221 (+8) | 2081 |
| **D26** | [The spec layer's dead render code is deleted; the one toolkit is kept](DECISIONS.md#d26--the-spec-layers-dead-render-code-is-deleted-the-one-toolkit-is-kept) | D43 | 2139 |
| **D27** | [The v15 revision syncs in whole, and the honesty layer stays where it was](DECISIONS.md#d27--the-v15-revision-syncs-in-whole-and-the-honesty-layer-stays-where-it-was) | D38 | 2231 |
| **D28** | [Fake accounts: prevention stays partial, the record becomes correctable](DECISIONS.md#d28--fake-accounts-prevention-stays-partial-the-record-becomes-correctable) | D226 (+8) | 2284 |
|  | ↳ *amendment 2026-08-06* — [Identity verification (passport / driver's licence class) recorded as a possible future requirement](DECISIONS.md#d28-amendment-2026-08-06--identity-verification-passport--drivers-licence-class-recorded-as-a-possible-future-requirement) | — | 5083 |
| **D29** | [Device-bound activation: one counted account per device per month, silently](DECISIONS.md#d29--device-bound-activation-one-counted-account-per-device-per-month-silently) | D219 (+8) | 2397 |
| **D30** | [Farm questions may graduate to the live seed; the deck gets an epoch](DECISIONS.md#d30--farm-questions-may-graduate-to-the-live-seed-the-deck-gets-an-epoch) | D212 (+11) | 2599 |
| **D31** | [The logic test generates its puzzles; nothing ships an answer key](DECISIONS.md#d31--the-logic-test-generates-its-puzzles-nothing-ships-an-answer-key) | D57 (+2) | 2664 |
| **D32** | [Learn's crowd stat is measured — first attempts only, estimates labeled](DECISIONS.md#d32--learns-crowd-stat-is-measured--first-attempts-only-estimates-labeled) | D157 (+16) | 2735 |
| **D33** | [The farm gets eyes and a faster clock: the scorecard, and daily runs](DECISIONS.md#d33--the-farm-gets-eyes-and-a-faster-clock-the-scorecard-and-daily-runs) | D212 (+9) | 2808 |
|  | ↳ *amendment 2026-08-06* — [Ordinal splits are measured on their axis](DECISIONS.md#d33-amendment-2026-08-06--ordinal-splits-are-measured-on-their-axis) | — | 6201 |
| **D34** | [The seed stops rewriting what it already said, and the bank pages in](DECISIONS.md#d34--the-seed-stops-rewriting-what-it-already-said-and-the-bank-pages-in) | D161 (+5) | 2867 |
| **D35** | [Label association becomes explicit, and a static gate replaces the render test that would have proved it](DECISIONS.md#d35--label-association-becomes-explicit-and-a-static-gate-replaces-the-render-test-that-would-have-proved-it) | D39 | 2939 |
| **D36** | [Five callables cannot attest; the uid allowlists are the control, and a gate holds the list](DECISIONS.md#d36--five-callables-cannot-attest-the-uid-allowlists-are-the-control-and-a-gate-holds-the-list) | D138 (+1) | 3040 |
| **D37** | [The device-bind flip becomes deterministic, then measured — the trigger is two numbers, not a judgement](DECISIONS.md#d37--the-device-bind-flip-becomes-deterministic-then-measured--the-trigger-is-two-numbers-not-a-judgement) | D219 (+1) | 3160 |
| **D38** | [The no-button overlays load after first paint; relmap stays eager because the Mirror reads it](DECISIONS.md#d38--the-no-button-overlays-load-after-first-paint-relmap-stays-eager-because-the-mirror-reads-it) | D200 (+2) | 3276 |
| **D39** | [The spec-layer migration gets a meter, and two figures get a gate](DECISIONS.md#d39--the-spec-layer-migration-gets-a-meter-and-two-figures-get-a-gate) | D233 (+21) | 3439 |
| **D40** | [Duels get a content lane and a question-level signal](DECISIONS.md#d40--duels-get-a-content-lane-and-a-question-level-signal) | D213 (+9) | 3852 |
|  | ↳ *adoption 2026-08-06* — [All four parts shipped, with five deltas](DECISIONS.md#d40-adoption-2026-08-06--all-four-parts-shipped-with-five-deltas) | — | 6241 |
| **D41** | [The two stores' account types are decided separately — Play as an organization, Apple as an individual](DECISIONS.md#d41--the-two-stores-account-types-are-decided-separately--play-as-an-organization-apple-as-an-individual) | D69 (+1) | 3957 |
| **D42** | [InSight launches on iOS alone; Play is deferred, and the path to it gets cheaper while it waits](DECISIONS.md#d42--insight-launches-on-ios-alone-play-is-deferred-and-the-path-to-it-gets-cheaper-while-it-waits) | D198 (+4) | 4048 |
| **D43** | [The v17 sync: what the prototype won, and what this repo kept](DECISIONS.md#d43--the-v17-sync-what-the-prototype-won-and-what-this-repo-kept) | D189 (+2) | 4141 |
| **D44** | [Political items never slice — the split publishes, the cross-tab does not](DECISIONS.md#d44--political-items-never-slice--the-split-publishes-the-cross-tab-does-not) | D146 (+6) | 4241 |
| **D45** | [Erasure follows the reveal, not the membership — and leaving a group is not an erasure request](DECISIONS.md#d45--erasure-follows-the-reveal-not-the-membership--and-leaving-a-group-is-not-an-erasure-request) | D55 | 4311 |
| **D46** | [The release build's JavaScript half gets the proof its native half already had](DECISIONS.md#d46--the-release-builds-javascript-half-gets-the-proof-its-native-half-already-had) | — | 4393 |
| **D47** | [Monitoring grows a decision console — and the refusals become part of it](DECISIONS.md#d47--monitoring-grows-a-decision-console--and-the-refusals-become-part-of-it) | D208 (+8) | 4447 |
| **D48** | [Three limits accepted while closing the reveal-alert, bridge and boot-state gaps](DECISIONS.md#d48--three-limits-accepted-while-closing-the-reveal-alert-bridge-and-boot-state-gaps) | D59 | 4657 |
| **D49** | [The Skip control becomes a button, the alert chain gets a gate, and the feed's split stops at its arithmetic](DECISIONS.md#d49--the-skip-control-becomes-a-button-the-alert-chain-gets-a-gate-and-the-feeds-split-stops-at-its-arithmetic) | — | 4710 |
| **D50** | [A lens question in a live feed is a self-report item, not a poll](DECISIONS.md#d50--a-lens-question-in-a-live-feed-is-a-self-report-item-not-a-poll) | D146 (+6) | 4798 |
| **D51** | [Deleting the keys is only half the wipe: every local store hears the purge](DECISIONS.md#d51--deleting-the-keys-is-only-half-the-wipe-every-local-store-hears-the-purge) | D203 (+5) | 4864 |
| **D52** | [The content review: what got fixed, what got flagged, and the two lines that held](DECISIONS.md#d52--the-content-review-what-got-fixed-what-got-flagged-and-the-two-lines-that-held) | D203 (+7) | 4930 |
| **D53** | [The logic test measured: zero ambiguity in 60,000 items, and the curve gets pinned](DECISIONS.md#d53--the-logic-test-measured-zero-ambiguity-in-60000-items-and-the-curve-gets-pinned) | D61 (+2) | 5020 |
| **D54** | [The ledger gets eyes: a daily velocity scan, feeding manual review](DECISIONS.md#d54--the-ledger-gets-eyes-a-daily-velocity-scan-feeding-manual-review) | D130 (+2) | 5128 |
| **D55** | [Three guarantees were enforced on a value and not on the way it moves](DECISIONS.md#d55--three-guarantees-were-enforced-on-a-value-and-not-on-the-way-it-moves) | D220 (+2) | 5226 |
| **D56** | [The logic test stops telegraphing its rules: banded families, and every puzzle is on the clock](DECISIONS.md#d56--the-logic-test-stops-telegraphing-its-rules-banded-families-and-every-puzzle-is-on-the-clock) | D62 (+1) | 5626 |
| **D57** | [Verified logic attempts: D31's deferral reversed — the server holds the key](DECISIONS.md#d57--verified-logic-attempts-d31s-deferral-reversed--the-server-holds-the-key) | D227 (+9) | 5709 |
| **D58** | [The seed refuses to edit a shipped option set](DECISIONS.md#d58--the-seed-refuses-to-edit-a-shipped-option-set) | D68 | 5836 |
| **D59** | [The deferred chunks stop caching their own failure](DECISIONS.md#d59--the-deferred-chunks-stop-caching-their-own-failure) | — | 5909 |
| **D60** | [The verified percentile becomes a measurement at one hundred players](DECISIONS.md#d60--the-verified-percentile-becomes-a-measurement-at-one-hundred-players) | D62 (+1) | 5959 |
| **D61** | [Twenty-five items, tail-heavy: the form grows before the norms freeze it](DECISIONS.md#d61--twenty-five-items-tail-heavy-the-form-grows-before-the-norms-freeze-it) | D227 (+1) | 6020 |
| **D62** | [The test starts learning its own difficulty: family and slot solve rates](DECISIONS.md#d62--the-test-starts-learning-its-own-difficulty-family-and-slot-solve-rates) | — | 6094 |
| **D63** | [Near-duplicate questions get a measured gate](DECISIONS.md#d63--near-duplicate-questions-get-a-measured-gate) | D123 (+2) | 6144 |
| **D64** | [Five findings from a cost & performance audit, and the two gates that had stopped measuring](DECISIONS.md#d64--five-findings-from-a-cost--performance-audit-and-the-two-gates-that-had-stopped-measuring) | D198 (+7) | 6316 |
| **D65** | [A soft-hide that a query walked straight past: `hidden` becomes a required boolean](DECISIONS.md#d65--a-soft-hide-that-a-query-walked-straight-past-hidden-becomes-a-required-boolean) | D138 (+5) | 6560 |
| **D66** | [The sample persona reached live mode twice more: the Map's anchor ring, and a hydration that wrote to nobody](DECISIONS.md#d66--the-sample-persona-reached-live-mode-twice-more-the-maps-anchor-ring-and-a-hydration-that-wrote-to-nobody) | D96 (+2) | 6699 |
| **D67** | [The cost model was counting one kind of read, and calling it the bill](DECISIONS.md#d67--the-cost-model-was-counting-one-kind-of-read-and-calling-it-the-bill) | D129 (+2) | 6796 |
| **D68** | [The v18 sync: a revision arrives, and the ratchets price it honestly](DECISIONS.md#d68--the-v18-sync-a-revision-arrives-and-the-ratchets-price-it-honestly) | D113 (+1) | 6897 |
| **D69** | [EU trader status: a home address on the listing, in exchange for 27 storefronts](DECISIONS.md#d69--eu-trader-status-a-home-address-on-the-listing-in-exchange-for-27-storefronts) | D165 (+3) | 6961 |
| **D70** | [The two duel indexes were bounded twice and diverged, and a reveal folded votes into a question nobody answered](DECISIONS.md#d70--the-two-duel-indexes-were-bounded-twice-and-diverged-and-a-reveal-folded-votes-into-a-question-nobody-answered) | D156 (+3) | 7012 |
| **D71** | [A reveal now says which question each answer was to, and nothing compares across that line](DECISIONS.md#d71--a-reveal-now-says-which-question-each-answer-was-to-and-nothing-compares-across-that-line) | D156 (+3) | 7105 |
| **D72** | [Two fabrications that outlived the badge: the Map's group stats and the results card's friends](DECISIONS.md#d72--two-fabrications-that-outlived-the-badge-the-maps-group-stats-and-the-results-cards-friends) | D211 (+11) | 7172 |
| **D73** | [The privacy label has no endpoint, so the script prints the form instead](DECISIONS.md#d73--the-privacy-label-has-no-endpoint-so-the-script-prints-the-form-instead) | D199 (+9) | 7289 |
| **D74** | [A tick is a claim, and this one was printed before the write](DECISIONS.md#d74--a-tick-is-a-claim-and-this-one-was-printed-before-the-write) | D208 (+5) | 7357 |
| **D75** | [Apple's eight new age-rating questions, and the half of the form nothing was checking](DECISIONS.md#d75--apples-eight-new-age-rating-questions-and-the-half-of-the-form-nothing-was-checking) | D116 (+3) | 7416 |
| **D76** | [Crash reporting flips to opt-out, and the ErrorBoundary reports what it catches](DECISIONS.md#d76--crash-reporting-flips-to-opt-out-and-the-errorboundary-reports-what-it-catches) | D211 (+1) | 7491 |
| **D77** | [The app knew why it had failed and told a console nobody could reach](DECISIONS.md#d77--the-app-knew-why-it-had-failed-and-told-a-console-nobody-could-reach) | D134 (+1) | 7540 |
| **D78** | [The takes surface goes live circle-first, and world takes get a costed proposal](DECISIONS.md#d78--the-takes-surface-goes-live-circle-first-and-world-takes-get-a-costed-proposal) | D98 (+2) | 7612 |
| **D79** | [`messagingAndChat` was false for one day, and circle scope does not make chat not-chat](DECISIONS.md#d79--messagingandchat-was-false-for-one-day-and-circle-scope-does-not-make-chat-not-chat) | D83 | 7790 |
| **D80** | [Two ways to hang on the same line, and the device found both](DECISIONS.md#d80--two-ways-to-hang-on-the-same-line-and-the-device-found-both) | D167 | 7853 |
| **D81** | [The k-floor is paused at 1 until launch traction](DECISIONS.md#d81--the-k-floor-is-paused-at-1-until-launch-traction) | D106 (+4) | 7927 |
| **D82** | [Near by radius (~500 m) — asked for, priced, and deferred](DECISIONS.md#d82--near-by-radius-500-m--asked-for-priced-and-deferred) | D84 (+1) | 8005 |
| **D83** | [World takes ship — D78 part 2 adopted, anonymous, behind enforcement](DECISIONS.md#d83--world-takes-ship--d78-part-2-adopted-anonymous-behind-enforcement) | D223 (+7) | 8051 |
| **D84** | [Near by radius ships — presence cells, a count and nothing else](DECISIONS.md#d84--near-by-radius-ships--presence-cells-a-count-and-nothing-else) | D183 (+6) | 8173 |
| **D85** | [The personality tests go to 5 items per dimension, and `cognitive` gets a question bank](DECISIONS.md#d85--the-personality-tests-go-to-5-items-per-dimension-and-cognitive-gets-a-question-bank) | D103 | 8250 |
| **D86** | [Answers become editable — D5 amended, not repealed](DECISIONS.md#d86--answers-become-editable--d5-amended-not-repealed) | D226 (+14) | 8351 |
| **D87** | [Production writes require an approval; the `production` environment carries protection rules](DECISIONS.md#d87--production-writes-require-an-approval-the-production-environment-carries-protection-rules) | D127 (+2) | 8441 |
| **D88** | [Seeding chains to the deploy, because the bank it writes is the deployed one](DECISIONS.md#d88--seeding-chains-to-the-deploy-because-the-bank-it-writes-is-the-deployed-one) | — | 8520 |
| **D89** | [The feed's "knows this best" row is demo furniture — live mode refuses it](DECISIONS.md#d89--the-feeds-knows-this-best-row-is-demo-furniture--live-mode-refuses-it) | D133 (+2) | 8584 |
| **D90** | [The picker's blank state starts at home — the clock's country ranks first](DECISIONS.md#d90--the-pickers-blank-state-starts-at-home--the-clocks-country-ranks-first) | D205 | 8619 |
| **D91** | [Lens questions are polls: the items are seeded, and their counts publish](DECISIONS.md#d91--lens-questions-are-polls-the-items-are-seeded-and-their-counts-publish) | D121 (+1) | 8662 |
| **D92** | [A standing location grant fills the city in — "suggested, never applied" narrows to the no-grant state](DECISIONS.md#d92--a-standing-location-grant-fills-the-city-in--suggested-never-applied-narrows-to-the-no-grant-state) | D111 | 8738 |
| **D93** | [The persona's residue is scrubbed from live anchors at boot, by exact signature](DECISIONS.md#d93--the-personas-residue-is-scrubbed-from-live-anchors-at-boot-by-exact-signature) | — | 8780 |
| **D94** | [The demo roster grows to 24 — the prototype's social surfaces get a population](DECISIONS.md#d94--the-demo-roster-grows-to-24--the-prototypes-social-surfaces-get-a-population) | — | 8818 |
| **D95** | [A re-served learn card arrives answerable — the feed's vote mirror no longer outlives the serve](DECISIONS.md#d95--a-re-served-learn-card-arrives-answerable--the-feeds-vote-mirror-no-longer-outlives-the-serve) | D153 | 8883 |
| **D96** | [A live build advertises no demo communities or empty leaves — and every bank subject runs always-on](DECISIONS.md#d96--a-live-build-advertises-no-demo-communities-or-empty-leaves--and-every-bank-subject-runs-always-on) | D213 (+2) | 8950 |
| **D97** | [Question production upscales behind a regulator: computed budgets, a mechanical style gate, and measured vintages](DECISIONS.md#d97--question-production-upscales-behind-a-regulator-computed-budgets-a-mechanical-style-gate-and-measured-vintages) | D212 (+9) | 9017 |
| **D98** | [Answers are public — the privacy model is retired, not paused](DECISIONS.md#d98--answers-are-public--the-privacy-model-is-retired-not-paused) | D232 (+43) | 9131 |
| **D99** | [The Mirror's lens row comes back, on data that was already there](DECISIONS.md#d99--the-mirrors-lens-row-comes-back-on-data-that-was-already-there) | D193 (+8) | 9253 |
| **D100** | [Scores and the Answers lens, on the archive rather than the week](DECISIONS.md#d100--scores-and-the-answers-lens-on-the-archive-rather-than-the-week) | D187 (+4) | 9396 |
| **D101** | [Circle, on a follow graph that needs no handshake](DECISIONS.md#d101--circle-on-a-follow-graph-that-needs-no-handshake) | D200 (+6) | 9497 |
| **D102** | [The D98 surfaces get their bounds, their index, and their bill](DECISIONS.md#d102--the-d98-surfaces-get-their-bounds-their-index-and-their-bill) | D176 (+6) | 9602 |
| **D103** | [Four device readings: a retired test, a rail, the topics D96 left dark, and one notch paid for twice](DECISIONS.md#d103--four-device-readings-a-retired-test-a-rail-the-topics-d96-left-dark-and-one-notch-paid-for-twice) | D156 (+3) | 9719 |
| **D104** | [Test users: a second real account, and what it is allowed to fake](DECISIONS.md#d104--test-users-a-second-real-account-and-what-it-is-allowed-to-fake) | — | 9819 |
| **D105** | [One text field owns the app's scale: every input defers to --field-size](DECISIONS.md#d105--one-text-field-owns-the-apps-scale-every-input-defers-to---field-size) | D113 | 9924 |
| **D106** | [The retired privacy model is swept out of the documentation, starting with the two pages users actually read](DECISIONS.md#d106--the-retired-privacy-model-is-swept-out-of-the-documentation-starting-with-the-two-pages-users-actually-read) | D183 (+4) | 10004 |
| **D107** | [A purpose string for the authorisation this app never asks for](DECISIONS.md#d107--a-purpose-string-for-the-authorisation-this-app-never-asks-for) | D199 | 10108 |
| **D108** | [Two providers leave the bridge, and the mount suite stops being one file](DECISIONS.md#d108--two-providers-leave-the-bridge-and-the-mount-suite-stops-being-one-file) | D233 (+2) | 10236 |
| **D109** | [LEARN leaves the bridge, and takes the load-order bug with it](DECISIONS.md#d109--learn-leaves-the-bridge-and-takes-the-load-order-bug-with-it) | D110 | 10377 |
| **D110** | [The bundle gets the number that decides first paint, and it immediately finds 327 KB](DECISIONS.md#d110--the-bundle-gets-the-number-that-decides-first-paint-and-it-immediately-finds-327-kb) | D201 (+2) | 10529 |
| **D111** | [Near and City are two stops again: presence is not a place](DECISIONS.md#d111--near-and-city-are-two-stops-again-presence-is-not-a-place) | D192 (+5) | 10661 |
| **D112** | [The similarity surfaces: place score profiles, and kindred ranked by scores — live, exact, default-on](DECISIONS.md#d112--the-similarity-surfaces-place-score-profiles-and-kindred-ranked-by-scores--live-exact-default-on) | D227 (+12) | 10699 |
| **D113** | [Two continuum forms in the feed, a lane that writes them, and the compare rose redrawn (a partial v20 sync)](DECISIONS.md#d113--two-continuum-forms-in-the-feed-a-lane-that-writes-them-and-the-compare-rose-redrawn-a-partial-v20-sync) | D156 (+2) | 10806 |
| **D114** | [The continuum forms go live: bucketed answers under the existing fold](DECISIONS.md#d114--the-continuum-forms-go-live-bucketed-answers-under-the-existing-fold) | D136 (+1) | 10936 |
| **D115** | [The learn lane can produce again, and the bank stops testing reading position](DECISIONS.md#d115--the-learn-lane-can-produce-again-and-the-bank-stops-testing-reading-position) | D145 (+2) | 11042 |
| **D116** | [The store listing was still selling the retired privacy model, and the closed vocabulary becomes a gate](DECISIONS.md#d116--the-store-listing-was-still-selling-the-retired-privacy-model-and-the-closed-vocabulary-becomes-a-gate) | D231 (+6) | 11172 |
| **D117** | [Two access controls are loosened to ship build 11, and the only thing holding their reversal is a checkbox](DECISIONS.md#d117--two-access-controls-are-loosened-to-ship-build-11-and-the-only-thing-holding-their-reversal-is-a-checkbox) | D124 | 11317 |
| **D118** | [Two gestures reported from a phone: a dial that stole the tab, and a Near that counted forever](DECISIONS.md#d118--two-gestures-reported-from-a-phone-a-dial-that-stole-the-tab-and-a-near-that-counted-forever) | D130 (+1) | 11391 |
| **D119** | [Answers becomes a tab: the live Mirror stop gets the prototype's nav v2](DECISIONS.md#d119--answers-becomes-a-tab-the-live-mirror-stop-gets-the-prototypes-nav-v2) | D190 (+3) | 11474 |
| **D120** | [The live answer row becomes the prototype's answer row](DECISIONS.md#d120--the-live-answer-row-becomes-the-prototypes-answer-row) | D193 (+1) | 11567 |
| **D121** | [The instruments become passive for real: no sit-down flow, a fold that scores, one hue, and a skip that comes back](DECISIONS.md#d121--the-instruments-become-passive-for-real-no-sit-down-flow-a-fold-that-scores-one-hue-and-a-skip-that-comes-back) | D230 (+3) | 11644 |
| **D122** | [Handles: the app gets an address, and a circle gains members by invitation](DECISIONS.md#d122--handles-the-app-gets-an-address-and-a-circle-gains-members-by-invitation) | D190 (+4) | 11766 |
| **D123** | [The dedup gate learns morphology and synonyms, and pre-flights the batch against itself](DECISIONS.md#d123--the-dedup-gate-learns-morphology-and-synonyms-and-pre-flights-the-batch-against-itself) | — | 11937 |
| **D124** | [The bill gets its first ceilings: an idle detach, two unbounded reads closed, and the controls that live in a console](DECISIONS.md#d124--the-bill-gets-its-first-ceilings-an-idle-detach-two-unbounded-reads-closed-and-the-controls-that-live-in-a-console) | D194 (+2) | 12041 |
| **D125** | [The breakdown was pointed at the crowd, and Learn's measured split was unreachable by construction](DECISIONS.md#d125--the-breakdown-was-pointed-at-the-crowd-and-learns-measured-split-was-unreachable-by-construction) | D171 (+4) | 12166 |
| **D126** | [Foresight — the read half, on a truth that now exists](DECISIONS.md#d126--foresight--the-read-half-on-a-truth-that-now-exists) | D196 (+7) | 12301 |
| **D127** | [A machine may propose an outcome, never be the reason one is believed](DECISIONS.md#d127--a-machine-may-propose-an-outcome-never-be-the-reason-one-is-believed) | D194 (+2) | 12424 |
| **D128** | [You can say what you want more of; the app does not guess](DECISIONS.md#d128--you-can-say-what-you-want-more-of-the-app-does-not-guess) | D173 (+2) | 12536 |
| **D129** | [The fan-out is gone: the deck is polled, and the cost curve is flat](DECISIONS.md#d129--the-fan-out-is-gone-the-deck-is-polled-and-the-cost-curve-is-flat) | D227 (+6) | 12607 |
| **D130** | [Build 12's pre-flight: the label was right, the reasoning under it was stale](DECISIONS.md#d130--build-12s-pre-flight-the-label-was-right-the-reasoning-under-it-was-stale) | D186 (+9) | 12738 |
| **D131** | [The Firestore region is a decision with a deadline, and it is written down before it expires](DECISIONS.md#d131--the-firestore-region-is-a-decision-with-a-deadline-and-it-is-written-down-before-it-expires) | D142 | 12866 |
| **D132** | [The profile said "0 of 30 answered" to someone who had answered thirty](DECISIONS.md#d132--the-profile-said-0-of-30-answered-to-someone-who-had-answered-thirty) | D142 | 12970 |
| **D133** | [One card said "our estimate" in the feed and stated a measurement two taps away](DECISIONS.md#d133--one-card-said-our-estimate-in-the-feed-and-stated-a-measurement-two-taps-away) | D142 | 13070 |
| **D134** | [The test track gets a wall; the public build does not](DECISIONS.md#d134--the-test-track-gets-a-wall-the-public-build-does-not) | D219 (+4) | 13156 |
| **D135** | [The field is what a stop opens on, and Near cannot be built as asked](DECISIONS.md#d135--the-field-is-what-a-stop-opens-on-and-near-cannot-be-built-as-asked) | D142 (+1) | 13263 |
| **D136** | [The Mirror stop loses two tabs; Crossroads and a feed window arrive](DECISIONS.md#d136--the-mirror-stop-loses-two-tabs-crossroads-and-a-feed-window-arrive) | D213 (+9) | 13487 |
| **D137** | [The bridge kept the names nobody was crossing on](DECISIONS.md#d137--the-bridge-kept-the-names-nobody-was-crossing-on) | D210 (+3) | 13719 |
| **D138** | [The suggestion board gets a server: a budgeted door, an author-only read, and the same human gate](DECISIONS.md#d138--the-suggestion-board-gets-a-server-a-budgeted-door-an-author-only-read-and-the-same-human-gate) | D213 (+5) | 13898 |
| **D139** | [The daily pulse: one question asked every day, folded per day by the trigger that did not change](DECISIONS.md#d139--the-daily-pulse-one-question-asked-every-day-folded-per-day-by-the-trigger-that-did-not-change) | D220 (+6) | 13979 |
| **D140** | [Height joins the anchors — a band select, never a centimetre field](DECISIONS.md#d140--height-joins-the-anchors--a-band-select-never-a-centimetre-field) | D203 (+3) | 14048 |
| **D141** | [Types leave the profile — tier 1, arithmetic on what is already public](DECISIONS.md#d141--types-leave-the-profile--tier-1-arithmetic-on-what-is-already-public) | D202 (+7) | 14082 |
| **D142** | [Build 13's pre-flight: a build was spent while this file said it was not](DECISIONS.md#d142--build-13s-pre-flight-a-build-was-spent-while-this-file-said-it-was-not) | D198 (+6) | 13362 |
| **D143** | [Build 14's pre-flight: the status line failed a third time, and the bundle gate was already red](DECISIONS.md#d143--build-14s-pre-flight-the-status-line-failed-a-third-time-and-the-bundle-gate-was-already-red) | D198 (+7) | 14122 |
| **D144** | [The bundle gate weighs the bundle that ships, and refuses to weigh any other](DECISIONS.md#d144--the-bundle-gate-weighs-the-bundle-that-ships-and-refuses-to-weigh-any-other) | D184 (+3) | 14245 |
| **D145** | [Four question lanes, two of which had never run: the learn and feed Routines, a feed regulator, and a weekday for catalogues](DECISIONS.md#d145--four-question-lanes-two-of-which-had-never-run-the-learn-and-feed-routines-a-feed-regulator-and-a-weekday-for-catalogues) | D159 (+2) | 14342 |
| **D146** | [The type cut — how each type answered, folded on the client, retroactive by construction](DECISIONS.md#d146--the-type-cut--how-each-type-answered-folded-on-the-client-retroactive-by-construction) | D232 (+6) | 14456 |
| **D147** | [The functions tsconfig moves to `node16`, and the emit format is the part that mattered](DECISIONS.md#d147--the-functions-tsconfig-moves-to-node16-and-the-emit-format-is-the-part-that-mattered) | D153 | 14582 |
| **D148** | [The Routine prompts catch up with their contracts, by the only mechanism that works](DECISIONS.md#d148--the-routine-prompts-catch-up-with-their-contracts-by-the-only-mechanism-that-works) | D212 (+1) | 14633 |
| **D149** | [Sides, friends and real counts: three surfaces stop guessing](DECISIONS.md#d149--sides-friends-and-real-counts-three-surfaces-stop-guessing) | D227 (+3) | 14707 |
| **D150** | [Near is a field again, and nobody in it is named](DECISIONS.md#d150--near-is-a-field-again-and-nobody-in-it-is-named) | D181 (+1) | 14802 |
| **D151** | [The general info is asked at the start, because an answer cannot be re-filed](DECISIONS.md#d151--the-general-info-is-asked-at-the-start-because-an-answer-cannot-be-re-filed) | D190 (+2) | 14842 |
| **D152** | [Explore is the World's; the People lens gets its shape back; Circle and Groups get theirs](DECISIONS.md#d152--explore-is-the-worlds-the-people-lens-gets-its-shape-back-circle-and-groups-get-theirs) | D184 (+3) | 14922 |
| **D153** | [Build 15's pre-flight: the first one where the number was already right](DECISIONS.md#d153--build-15s-pre-flight-the-first-one-where-the-number-was-already-right) | D191 (+4) | 15021 |
| **D154** | [The Map's mainstream boundary is sized by the map, not by a constant](DECISIONS.md#d154--the-maps-mainstream-boundary-is-sized-by-the-map-not-by-a-constant) | D158 | 15134 |
| **D155** | [The tabs sit at the bottom, the four instruments take turns, and the age is the age](DECISIONS.md#d155--the-tabs-sit-at-the-bottom-the-four-instruments-take-turns-and-the-age-is-the-age) | D190 (+6) | 15232 |
| **D156** | [The live 1v1 and Group get the sample's shape — a rail, marks, bars, and a guess that arrives second](DECISIONS.md#d156--the-live-1v1-and-group-get-the-samples-shape--a-rail-marks-bars-and-a-guess-that-arrives-second) | D204 (+2) | 15316 |
| **D157** | [The test surfaces stop describing a crowd they never counted](DECISIONS.md#d157--the-test-surfaces-stop-describing-a-crowd-they-never-counted) | D204 (+6) | 15463 |
| **D158** | [Build 16's pre-flight: the number was already right for the second time running](DECISIONS.md#d158--build-16s-pre-flight-the-number-was-already-right-for-the-second-time-running) | D191 (+4) | 15643 |
| **D159** | [Run 22 delivered build 16, and the comparison gains the commit it is made at](DECISIONS.md#d159--run-22-delivered-build-16-and-the-comparison-gains-the-commit-it-is-made-at) | D229 (+6) | 15758 |
| **D160** | [An empty field is still a field, the row actually snaps, and Near's switch goes in the corner](DECISIONS.md#d160--an-empty-field-is-still-a-field-the-row-actually-snaps-and-nears-switch-goes-in-the-corner) | D190 (+1) | 15830 |
| **D161** | [The feed goes unbounded, and the Mirror gets a corpus of its own](DECISIONS.md#d161--the-feed-goes-unbounded-and-the-mirror-gets-a-corpus-of-its-own) | D218 (+9) | 15924 |
| **D162** | [Review at volume: the AI reads, and the human approves and audits](DECISIONS.md#d162--review-at-volume-the-ai-reads-and-the-human-approves-and-audits) | D212 (+1) | 16062 |
| **D163** | [The app learns what you are into, and the model never leaves the phone](DECISIONS.md#d163--the-app-learns-what-you-are-into-and-the-model-never-leaves-the-phone) | D206 (+2) | 16115 |
| **D164** | [The revenue paths, re-derived against an unbounded feed](DECISIONS.md#d164--the-revenue-paths-re-derived-against-an-unbounded-feed) | D227 (+1) | 16171 |
| **D165** | [The database moves to one EU region, and the old answers are let go](DECISIONS.md#d165--the-database-moves-to-one-eu-region-and-the-old-answers-are-let-go) | D218 (+3) | 16249 |
| **D166** | [The third tab is adopted ON TRIAL, the Arena is dropped, the pulse roster is approved](DECISIONS.md#d166--the-third-tab-is-adopted-on-trial-the-arena-is-dropped-the-pulse-roster-is-approved) | D217 (+8) | 16339 |
| **D167** | [Every v28 surface ships with its backend, or it does not ship](DECISIONS.md#d167--every-v28-surface-ships-with-its-backend-or-it-does-not-ship) | D214 (+5) | 16449 |
| **D168** | [Born or built is refused: the app does not assert facts it cannot recompute](DECISIONS.md#d168--born-or-built-is-refused-the-app-does-not-assert-facts-it-cannot-recompute) | D180 | 16536 |
| **D169** | [The read path was already careful; the fold path was not](DECISIONS.md#d169--the-read-path-was-already-careful-the-fold-path-was-not) | D180 | 16625 |
| **D170** | [Three Mirror tabs named a population and read a different one](DECISIONS.md#d170--three-mirror-tabs-named-a-population-and-read-a-different-one) | D193 (+8) | 16779 |
| **D171** | [The daily had no breakdown at all, and its own sheet was a hash](DECISIONS.md#d171--the-daily-had-no-breakdown-at-all-and-its-own-sheet-was-a-hash) | — | 16891 |
| **D172** | [The Mirror's stops stop explaining themselves](DECISIONS.md#d172--the-mirrors-stops-stop-explaining-themselves) | D188 (+3) | 16962 |
| **D173** | [The interest levers go; the algorithm owns "how much"](DECISIONS.md#d173--the-interest-levers-go-the-algorithm-owns-how-much) | D190 (+1) | 17099 |
| **D174** | [Near's visibility gets three states, and a position that expires on its own](DECISIONS.md#d174--nears-visibility-gets-three-states-and-a-position-that-expires-on-its-own) | D202 (+4) | 17156 |
| **D175** | [Near asks for a precise fix, so its radius can be honest](DECISIONS.md#d175--near-asks-for-a-precise-fix-so-its-radius-can-be-honest) | D202 (+6) | 17248 |
| **D176** | [Near becomes a room, and the phone says what it is](DECISIONS.md#d176--near-becomes-a-room-and-the-phone-says-what-it-is) | D177 | 17338 |
| **D177** | [Near becomes a room you can read, and asking requires standing in it](DECISIONS.md#d177--near-becomes-a-room-you-can-read-and-asking-requires-standing-in-it) | D202 (+4) | 17468 |
| **D178** | [The app gets a face, and it is reported like anything else somebody says](DECISIONS.md#d178--the-app-gets-a-face-and-it-is-reported-like-anything-else-somebody-says) | D223 (+4) | 17616 |
| **D179** | [The rules deploy on merge and the app does not, so `until` is optional for one release](DECISIONS.md#d179--the-rules-deploy-on-merge-and-the-app-does-not-so-until-is-optional-for-one-release) | D195 (+3) | 17749 |
| **D180** | [Build 18's pre-flight: the record was written and the number was not](DECISIONS.md#d180--build-18s-pre-flight-the-record-was-written-and-the-number-was-not) | D198 (+2) | 17837 |
| **D181** | [Near's field drew the city it is not about](DECISIONS.md#d181--nears-field-drew-the-city-it-is-not-about) | D184 (+1) | 18067 |
| **D182** | [The copy pass: a visual beats a word, a word beats a sentence](DECISIONS.md#d182--the-copy-pass-a-visual-beats-a-word-a-word-beats-a-sentence) | D211 (+2) | 18154 |
| **D183** | [The disclosures leave the app, and get a gate on the way out](DECISIONS.md#d183--the-disclosures-leave-the-app-and-get-a-gate-on-the-way-out) | D225 (+5) | 18252 |
| **D184** | [Build 19's pre-flight: this time neither edit happened](DECISIONS.md#d184--build-19s-pre-flight-this-time-neither-edit-happened) | D229 (+4) | 18411 |
| **D185** | [Crossroads gets a brief, and the gates learn what a story is](DECISIONS.md#d185--crossroads-gets-a-brief-and-the-gates-learn-what-a-story-is) | D187 (+1) | 18562 |
| **D186** | [Build 19 is delivered, and the bump was made from the step list](DECISIONS.md#d186--build-19-is-delivered-and-the-bump-was-made-from-the-step-list) | D198 (+2) | 18736 |
| **D187** | [The place scorecard rates the place](DECISIONS.md#d187--the-place-scorecard-rates-the-place) | D213 (+1) | 18806 |
| **D188** | [The Mirror's tab row sits where a tab bar sits, and stops arguing with the stop about colour](DECISIONS.md#d188--the-mirrors-tab-row-sits-where-a-tab-bar-sits-and-stops-arguing-with-the-stop-about-colour) | D191 (+2) | 18966 |
| **D189** | [The design gate was never looking, and two group hues never met the palette](DECISIONS.md#d189--the-design-gate-was-never-looking-and-two-group-hues-never-met-the-palette) | D191 | 19089 |
| **D190** | [Your name and your handle belong to the account, the topic list opens onto the topics, and Circle and Groups get their row](DECISIONS.md#d190--your-name-and-your-handle-belong-to-the-account-the-topic-list-opens-onto-the-topics-and-circle-and-groups-get-their-row) | D211 (+1) | 19285 |
| **D191** | [Build 20's pre-flight: nothing to bump, and check:bundle's second load-bearing variable](DECISIONS.md#d191--build-20s-pre-flight-nothing-to-bump-and-checkbundles-second-load-bearing-variable) | D199 (+2) | 19466 |
| **D192** | [The docs get a map, and the map gets a gate](DECISIONS.md#d192--the-docs-get-a-map-and-the-map-gets-a-gate) | D199 (+2) | 19577 |
| **D193** | [Compare draws the comparison it was always described as drawing](DECISIONS.md#d193--compare-draws-the-comparison-it-was-always-described-as-drawing) | D202 (+2) | 19702 |
| **D194** | [Predictions ship, and the app only asserts what it can recompute](DECISIONS.md#d194--predictions-ship-and-the-app-only-asserts-what-it-can-recompute) | D222 (+5) | 19864 |
| **D195** | [The paid slot is built, and nobody has bought it yet](DECISIONS.md#d195--the-paid-slot-is-built-and-nobody-has-bought-it-yet) | D232 (+6) | 20037 |
| **D196** | [The reading game is the one that ships, and it waits for a crowd](DECISIONS.md#d196--the-reading-game-is-the-one-that-ships-and-it-waits-for-a-crowd) | D209 (+2) | 20150 |
| **D197** | [The feed gets real ads, and they are not sponsored questions](DECISIONS.md#d197--the-feed-gets-real-ads-and-they-are-not-sponsored-questions) | D228 (+2) | 20258 |
| **D198** | [Build 21's pre-flight: the number run 31 spent, and the bundle gate's artifact claim](DECISIONS.md#d198--build-21s-pre-flight-the-number-run-31-spent-and-the-bundle-gates-artifact-claim) | D229 (+1) | 20408 |
| **D199** | [Build 21 is in TestFlight, and the number moved with it](DECISIONS.md#d199--build-21-is-in-testflight-and-the-number-moved-with-it) | D202 (+1) | 20604 |
| **D200** | [Three things were true and stopped being, and nothing was looking](DECISIONS.md#d200--three-things-were-true-and-stopped-being-and-nothing-was-looking) | D223 (+2) | 20686 |
| **D201** | [The functions follow the database to europe-west1](DECISIONS.md#d201--the-functions-follow-the-database-to-europe-west1) | — | 20835 |
| **D202** | [The type mix reads every instrument, and D157 §4 is reversed](DECISIONS.md#d202--the-type-mix-reads-every-instrument-and-d157-4-is-reversed) | D232 (+3) | 20960 |
| **D203** | [Five pulses, each with its own rhythm](DECISIONS.md#d203--five-pulses-each-with-its-own-rhythm) | D213 | 21062 |
| **D204** | [Your role is a test result, and the dimension without data is not shipped](DECISIONS.md#d204--your-role-is-a-test-result-and-the-dimension-without-data-is-not-shipped) | D224 | 21176 |
| **D205** | [An unconfirmed city does not score the place it names](DECISIONS.md#d205--an-unconfirmed-city-does-not-score-the-place-it-names) | — | 21277 |
| **D206** | [A question carries several doors, and demand credit is conserved](DECISIONS.md#d206--a-question-carries-several-doors-and-demand-credit-is-conserved) | D212 | 21382 |
| **D207** | [The Map goes lazy, and the door §5 was waiting on is open](DECISIONS.md#d207--the-map-goes-lazy-and-the-door-5-was-waiting-on-is-open) | D210 | 21450 |
| **D208** | [The pen is not an error state, and a gate said it was](DECISIONS.md#d208--the-pen-is-not-an-error-state-and-a-gate-said-it-was) | D212 (+1) | 21563 |
| **D209** | [Three readers walk the archive, and only one of them is a population](DECISIONS.md#d209--three-readers-walk-the-archive-and-only-one-of-them-is-a-population) | — | 21676 |
| **D210** | [Rule 5 could not fire, and 123 dead publications were behind it](DECISIONS.md#d210--rule-5-could-not-fire-and-123-dead-publications-were-behind-it) | D223 (+1) | 21752 |
| **D211** | [The topic door keeps the tab bar, a walk is final, and the account panel stops offering what sign-in settled](DECISIONS.md#d211--the-topic-door-keeps-the-tab-bar-a-walk-is-final-and-the-account-panel-stops-offering-what-sign-in-settled) | — | 21871 |
| **D212** | [Questions ship without waiting for a person](DECISIONS.md#d212--questions-ship-without-waiting-for-a-person) | — | 22000 |
| **D213** | [Every servable type generates, and the feed goes daily](DECISIONS.md#d213--every-servable-type-generates-and-the-feed-goes-daily) | — | 22074 |
| **D214** | [The People lens joins the Patterns trial](DECISIONS.md#d214--the-people-lens-joins-the-patterns-trial) | D217 (+1) | 22126 |
| **D215** | [The Map and the Oracle take the 2026-08-20 standalone's shape](DECISIONS.md#d215--the-map-and-the-oracle-take-the-2026-08-20-standalones-shape) | D216 | 22185 |
| **D216** | [The People lens gets its populations](DECISIONS.md#d216--the-people-lens-gets-its-populations) | D217 | 22260 |
| **D217** | [Patterns is out of the v1 release, and the trial pauses with the mount](DECISIONS.md#d217--patterns-is-out-of-the-v1-release-and-the-trial-pauses-with-the-mount) | D224 (+1) | 22319 |
| **D218** | [A continuum answer lives in two units, and the bucket arbitrates](DECISIONS.md#d218--a-continuum-answer-lives-in-two-units-and-the-bucket-arbitrates) | D231 (+4) | 22375 |
| **D219** | [The wall comes down for the store build: D134's fork, resolved](DECISIONS.md#d219--the-wall-comes-down-for-the-store-build-d134s-fork-resolved) | D229 | 22443 |
| **D220** | [A settled report is spent, and the queue stopped ranking ghosts](DECISIONS.md#d220--a-settled-report-is-spent-and-the-queue-stopped-ranking-ghosts) | D223 (+1) | 22484 |
| **D221** | [Four things nothing was standing behind](DECISIONS.md#d221--four-things-nothing-was-standing-behind) | D223 (+1) | 22575 |
| **D222** | [One rounding rule, and it stopped drawing three votes above four](DECISIONS.md#d222--one-rounding-rule-and-it-stopped-drawing-three-votes-above-four) | D223 | 22694 |
| **D223** | [The long tail, and the two things it declined to build](DECISIONS.md#d223--the-long-tail-and-the-two-things-it-declined-to-build) | D224 | 22783 |
| **D224** | [A pick answer snapshots who it meant, and the reveal carries it](DECISIONS.md#d224--a-pick-answer-snapshots-who-it-meant-and-the-reveal-carries-it) | D231 (+3) | 22872 |
| **D225** | [The no-private-report promise is removed, before anything needed it](DECISIONS.md#d225--the-no-private-report-promise-is-removed-before-anything-needed-it) | D232 (+3) | 22940 |
| **D226** | [The edit-flow matrix — second thoughts become a published number](DECISIONS.md#d226--the-edit-flow-matrix--second-thoughts-become-a-published-number) | D231 (+3) | 23006 |
| **D227** | [The logic cut — the who-voted sheet groups answers by the verified score](DECISIONS.md#d227--the-logic-cut--the-who-voted-sheet-groups-answers-by-the-verified-score) | D232 (+2) | 23076 |
| **D228** | [The buyer model: three dims, nameless if wanted, and the lens waits](DECISIONS.md#d228--the-buyer-model-three-dims-nameless-if-wanted-and-the-lens-waits) | D232 (+1) | 23143 |
| **D229** | [Two releases shipped unrecorded, and the sixth skip is the one that costs](DECISIONS.md#d229--two-releases-shipped-unrecorded-and-the-sixth-skip-is-the-one-that-costs) | D231 (+1) | 23215 |
| **D230** | [An instrument's colour is where you stand now, not where you finished](DECISIONS.md#d230--an-instruments-colour-is-where-you-stand-now-not-where-you-finished) | D231 | 23278 |
| **D231** | [The report builder ships, and reads as a signed-in user](DECISIONS.md#d231--the-report-builder-ships-and-reads-as-a-signed-in-user) | D232 | 23369 |
| **D232** | [The never-grouped promise is removed, and the scope becomes a choice](DECISIONS.md#d232--the-never-grouped-promise-is-removed-and-the-scope-becomes-a-choice) | D233 | 23459 |
| **D233** | [The archetype module leaves the bridge, and the report gets its type cuts](DECISIONS.md#d233--the-archetype-module-leaves-the-bridge-and-the-report-gets-its-type-cuts) | — | 23527 |
