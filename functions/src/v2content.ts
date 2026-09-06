// GENERATED from /content/*.json by scripts/gen-v2content.mjs — do not
// hand-edit. Regenerate with `npm run build:content`; `npm run
// check:content` compares this file byte-for-byte against what /content
// generates, on the deploy path, so a hand edit here (or a /content
// change without a regen) fails the gate.
// Canonical launch question bank for the v2 seed callable.
// `active`/`political` are optional and emitted only when set: absent means
// active (deck.ts filters `active !== false`) and sliceable (v2.ts's D44
// predicate checks `political === true` alongside `test === "political"`).
// `core` is feed-only (docs/SCALE-PLAN.md §1) and absent means TAIL — a
// question is in the Mirror's corpus only if it says so. Other surfaces do
// not carry the key because they are core by construction.
// `branch`/`sub` are the daily bank's [branch, sub-branch] subject path
// (D100) and are absent on every other surface, which carries no path.
// `tag` is the daily bank's short label for a question — the Mirror's
// Scores card is a column of nouns, not of sentences (D187).
// `rates` is daily-only and names the Mirror stop whose scorecard may fold
// a question (D187): city|country|world. Absent means the question rates
// no place, which is every other question in the bank.
// `lo`/`hi`/`unit`/`ends` (dial) and `ax`/`ay` (field) are the continuum
// forms' range/plane copy (D114), absent everywhere else; their options
// are synthesized bucket/cell labels, so the D52 option freeze freezes
// the range with them.
// `domain` is non-null only on `type: "catalog"` (pick) entries — the
// catalogue key space their `entity` answers validate against (D14/D15).
// Pick entries carry no options: the shipped catalogue is the answer
// space, and they are never `core` — an entity answer has no option
// share for a cohort fold to read.
// `also` is feed/pick-only (docs/TAGS-PLAN.md, D206): the topics a
// question ALSO belongs to beside its `topic` home. Reach, never
// placement — the client's filter/stock/search read topic ∪ also, the
// Map and grouping stay on `topic`. Emit-when-set; never on sponsored.
// `sponsor` is feed-only (D195): `{ buyer, audience?, link? }` on a question
// somebody paid to ask. The WINDOW is `until`, not a field here, so the
// label the card prints and the filter that stops serving it are one
// value. A sponsored question is never `core` — paid questions inside
// the Mirror's corpus would make the honest aggregate a paid-for sample.
// `tier`/`resolvesAt`/`rubric` are the CALL surface's only (D194): the
// admitted grading path, the earliest UTC day it may be graded, and the
// expression the resolver RUNS. The outcome is not here — it lives in
// v2_call_outcomes, so a reseed and the resolver never fight.
// `invert` is test-surface-only and COMPILE-TIME ONLY — the seed never
// transports it (check:seed-fields NOT_TRANSPORTED has the reason). It
// marks a reverse-scored instrument item so the nightly axes fold
// (AXES-PLAN §2) can score answers server-side; the client keeps joining
// scoring metadata from IS_TESTS by prompt and never reads it.
export interface V2SeedQuestion { id: string; surface: string; seq: number; type: string; domain: string | null; prompt: string; options: string[]; topic: string | null; also?: string[]; branch?: string; sub?: string; tag?: string; rates?: string; axis: string | null; test: string | null; invert?: boolean; mode?: string; active?: boolean; political?: boolean; core?: boolean; from?: string; until?: string; bg?: string; c?: number; t?: number; p?: number; k?: string; w?: string; lo?: number; hi?: number; unit?: string; ends?: string[]; ax?: string[]; ay?: string[]; title?: string; intro?: string; hue?: number; nodes?: Record<string, { q: string; a: Array<{ t: string }> }>; endings?: Record<string, { name: string; line: string }>; sponsor?: { buyer: string; audience?: Record<string, string>; link?: string }; tier?: string; resolvesAt?: string; rubric?: { kind: string; qid: string; test: string; threshold?: number; dim?: string; buckets?: string[] }; }
export const V2_QUESTIONS: V2SeedQuestion[] = [
 {
  "id": "daily-000",
  "surface": "daily",
  "seq": 0,
  "type": "binary",
  "domain": null,
  "prompt": "Messi or Ronaldo?",
  "options": [
   "Messi",
   "Ronaldo"
  ],
  "topic": "light",
  "branch": "Sport",
  "sub": "Football",
  "tag": "The GOAT",
  "bg": "Lionel Messi and Cristiano Ronaldo defined two decades of football between them: eight and five Ballons d'Or, over 800 career goals each, a World Cup for Messi in 2022 and five Champions League titles for Ronaldo.",
  "axis": null,
  "test": null
 },
 {
  "id": "daily-001",
  "surface": "daily",
  "seq": 1,
  "type": "binary",
  "domain": null,
  "prompt": "Tarantino or Wes Anderson?",
  "options": [
   "Tarantino",
   "Wes Anderson"
  ],
  "topic": "light",
  "branch": "Film",
  "sub": "Directors",
  "tag": "Director duel",
  "bg": "Quentin Tarantino writes talk-heavy, violent genre films — Pulp Fiction, Kill Bill, Once Upon a Time in Hollywood. Wes Anderson builds symmetrical pastel worlds with deadpan ensembles — The Grand Budapest Hotel, Moonrise Kingdom.",
  "axis": null,
  "test": null
 },
 {
  "id": "daily-002",
  "surface": "daily",
  "seq": 2,
  "type": "binary",
  "domain": null,
  "prompt": "Pineapple on pizza?",
  "options": [
   "Yes",
   "Never"
  ],
  "topic": "light",
  "branch": "Food",
  "sub": "Debates",
  "tag": "Pineapple",
  "bg": "Hawaiian pizza — ham and pineapple — was invented in 1962 by Sam Panopoulos, a Greek-born cook in Chatham, Ontario, Canada, and named after the brand of canned pineapple he used.",
  "axis": null,
  "test": null
 },
 {
  "id": "daily-003",
  "surface": "daily",
  "seq": 3,
  "type": "choice",
  "domain": null,
  "prompt": "What do you want more of this year?",
  "options": [
   "Time",
   "Quiet",
   "Adventure",
   "Closeness"
  ],
  "topic": "deep",
  "branch": "Values",
  "sub": "Longing",
  "tag": "Want more",
  "axis": null,
  "test": null
 },
 {
  "id": "daily-004",
  "surface": "daily",
  "seq": 4,
  "type": "scale",
  "domain": null,
  "prompt": "It's okay to do nothing sometimes.",
  "options": [
   "Strongly disagree",
   "Disagree",
   "Neutral",
   "Agree",
   "Strongly agree"
  ],
  "topic": "light",
  "branch": "Mind",
  "sub": "Rest",
  "tag": "Doing nothing",
  "axis": "at ease",
  "test": null
 },
 {
  "id": "daily-005",
  "surface": "daily",
  "seq": 5,
  "type": "binary",
  "domain": null,
  "prompt": "Are people getting kinder, or meaner?",
  "options": [
   "Kinder",
   "Meaner"
  ],
  "topic": "deep",
  "branch": "Morals",
  "sub": "Direction",
  "tag": "People today",
  "axis": null,
  "test": null
 },
 {
  "id": "daily-006",
  "surface": "daily",
  "seq": 6,
  "type": "dilemma",
  "domain": null,
  "prompt": "You find a week's pay in cash on an empty street. What do you do?",
  "options": [
   "Keep it",
   "Hand it in",
   "Leave it"
  ],
  "topic": "deep",
  "branch": "Morals",
  "sub": "Honesty",
  "tag": "Found €500",
  "axis": null,
  "test": null
 },
 {
  "id": "daily-007",
  "surface": "daily",
  "seq": 7,
  "type": "rating",
  "domain": null,
  "prompt": "How optimistic are you about the next ten years?",
  "options": [
   "1",
   "2",
   "3",
   "4",
   "5",
   "6",
   "7",
   "8",
   "9",
   "10"
  ],
  "topic": "deep",
  "branch": "Mind",
  "sub": "Outlook",
  "tag": "Next 10 years",
  "axis": "optimistic",
  "test": null
 },
 {
  "id": "daily-008",
  "surface": "daily",
  "seq": 8,
  "type": "scale",
  "domain": null,
  "prompt": "People are basically trustworthy.",
  "options": [
   "Strongly disagree",
   "Disagree",
   "Neutral",
   "Agree",
   "Strongly agree"
  ],
  "topic": "deep",
  "branch": "Values",
  "sub": "Trust",
  "tag": "Trust in people",
  "axis": "trusting",
  "test": null
 },
 {
  "id": "daily-009",
  "surface": "daily",
  "seq": 9,
  "type": "binary",
  "domain": null,
  "prompt": "A pill that ends your need for sleep. Take it?",
  "options": [
   "Take it",
   "Never"
  ],
  "topic": "deep",
  "branch": "Mind",
  "sub": "Human limits",
  "tag": "Sleep pill",
  "axis": null,
  "test": null
 },
 {
  "id": "daily-010",
  "surface": "daily",
  "seq": 10,
  "type": "choice",
  "domain": null,
  "prompt": "What should schools teach more of?",
  "options": [
   "Money",
   "Emotions",
   "Making things",
   "History"
  ],
  "topic": "deep",
  "branch": "Values",
  "sub": "Education",
  "tag": "Schools",
  "axis": null,
  "test": null
 },
 {
  "id": "daily-011",
  "surface": "daily",
  "seq": 11,
  "type": "dilemma",
  "domain": null,
  "prompt": "A job you would love means moving somewhere the person closest to you would hate. Do you take it?",
  "options": [
   "Take it",
   "Stay",
   "Find a third way"
  ],
  "topic": "deep",
  "branch": "Morals",
  "sub": "Loyalty",
  "tag": "Job or partner",
  "axis": null,
  "test": null
 },
 {
  "id": "daily-012",
  "surface": "daily",
  "seq": 12,
  "type": "binary",
  "domain": null,
  "prompt": "Would you rather watch sport, or play it?",
  "options": [
   "Watch",
   "Play"
  ],
  "topic": "light",
  "branch": "Sport",
  "sub": "How you engage",
  "tag": "Watch or play",
  "axis": null,
  "test": null
 },
 {
  "id": "daily-013",
  "surface": "daily",
  "seq": 13,
  "type": "scale",
  "domain": null,
  "prompt": "Suffering can give life meaning.",
  "options": [
   "Strongly disagree",
   "Disagree",
   "Neutral",
   "Agree",
   "Strongly agree"
  ],
  "topic": "deep",
  "branch": "Values",
  "sub": "Meaning",
  "tag": "Suffering",
  "axis": "searching",
  "test": null
 },
 {
  "id": "daily-014",
  "surface": "daily",
  "seq": 14,
  "type": "rating",
  "domain": null,
  "prompt": "How much do you trust the news you read?",
  "options": [
   "1",
   "2",
   "3",
   "4",
   "5",
   "6",
   "7",
   "8",
   "9",
   "10"
  ],
  "topic": "deep",
  "branch": "Mind",
  "sub": "Media",
  "tag": "The news",
  "axis": "trusting",
  "test": null,
  "political": true
 },
 {
  "id": "daily-015",
  "surface": "daily",
  "seq": 15,
  "type": "binary",
  "domain": null,
  "prompt": "Will AI make everyday life better, or worse?",
  "options": [
   "Better",
   "Worse"
  ],
  "topic": "deep",
  "branch": "Mind",
  "sub": "Technology",
  "tag": "AI",
  "bg": "Artificial intelligence covers systems that learn patterns from data rather than following hand-written rules — the approach behind today's chatbots, translators and image generators.",
  "axis": null,
  "test": null
 },
 {
  "id": "daily-016",
  "surface": "daily",
  "seq": 16,
  "type": "choice",
  "domain": null,
  "prompt": "Humanity's best invention?",
  "options": [
   "Writing",
   "Medicine",
   "The internet",
   "Music"
  ],
  "topic": "blend",
  "branch": "Mind",
  "sub": "Civilisation",
  "tag": "Best invention",
  "bg": "Writing first appeared in Mesopotamia around 5,000 years ago. Vaccination, anaesthesia and antibiotics each cut death rates within a generation. The internet connected most of humanity inside thirty years.",
  "axis": null,
  "test": null
 },
 {
  "id": "daily-017",
  "surface": "daily",
  "seq": 17,
  "type": "scale",
  "domain": null,
  "prompt": "Technology is making us lonelier.",
  "options": [
   "Strongly disagree",
   "Disagree",
   "Neutral",
   "Agree",
   "Strongly agree"
  ],
  "topic": "deep",
  "branch": "Mind",
  "sub": "Technology",
  "tag": "Loneliness",
  "axis": "wary",
  "test": null
 },
 {
  "id": "daily-018",
  "surface": "daily",
  "seq": 18,
  "type": "choice",
  "domain": null,
  "prompt": "What matters most in a life well lived?",
  "options": [
   "Connection",
   "Freedom",
   "Creation",
   "Peace"
  ],
  "topic": "deep",
  "branch": "Values",
  "sub": "What matters",
  "tag": "A good life",
  "axis": null,
  "test": null
 },
 {
  "id": "daily-019",
  "surface": "daily",
  "seq": 19,
  "type": "dilemma",
  "domain": null,
  "prompt": "Would you rather know the exact date of your death?",
  "options": [
   "Know",
   "Never know"
  ],
  "topic": "deep",
  "branch": "Mind",
  "sub": "Mortality",
  "tag": "Date of death",
  "axis": null,
  "test": null
 },
 {
  "id": "daily-020",
  "surface": "daily",
  "seq": 20,
  "type": "rating",
  "domain": null,
  "prompt": "How much of your life so far is luck?",
  "options": [
   "1",
   "2",
   "3",
   "4",
   "5",
   "6",
   "7",
   "8",
   "9",
   "10"
  ],
  "topic": "deep",
  "branch": "Mind",
  "sub": "Fate",
  "tag": "Luck",
  "axis": "shaped by luck",
  "test": null
 },
 {
  "id": "daily-021",
  "surface": "daily",
  "seq": 21,
  "type": "scale",
  "domain": null,
  "prompt": "I'd rather have a few deep friendships than many.",
  "options": [
   "Strongly disagree",
   "Disagree",
   "Neutral",
   "Agree",
   "Strongly agree"
  ],
  "topic": "blend",
  "branch": "Values",
  "sub": "Friendship",
  "tag": "Deep or many",
  "axis": "inward",
  "test": null
 },
 {
  "id": "daily-022",
  "surface": "daily",
  "seq": 22,
  "type": "dilemma",
  "domain": null,
  "prompt": "A lie that spares someone real pain. Tell it?",
  "options": [
   "Tell it",
   "Truth anyway"
  ],
  "topic": "deep",
  "branch": "Morals",
  "sub": "Kindness",
  "tag": "The kind lie",
  "axis": null,
  "test": null
 },
 {
  "id": "daily-023",
  "surface": "daily",
  "seq": 23,
  "type": "scale",
  "domain": null,
  "prompt": "It's better to be honest than kind.",
  "options": [
   "Strongly disagree",
   "Disagree",
   "Neutral",
   "Agree",
   "Strongly agree"
  ],
  "topic": "deep",
  "branch": "Morals",
  "sub": "Honesty",
  "tag": "Honest or kind",
  "axis": "frank",
  "test": null
 },
 {
  "id": "daily-024",
  "surface": "daily",
  "seq": 24,
  "type": "scale",
  "domain": null,
  "prompt": "Money buys happiness.",
  "options": [
   "Strongly disagree",
   "Disagree",
   "Neutral",
   "Agree",
   "Strongly agree"
  ],
  "topic": "blend",
  "branch": "Values",
  "sub": "Money",
  "tag": "Money",
  "axis": "materialist",
  "test": null
 },
 {
  "id": "daily-025",
  "surface": "daily",
  "seq": 25,
  "type": "rating",
  "domain": null,
  "prompt": "How much control do you feel over your life?",
  "options": [
   "1",
   "2",
   "3",
   "4",
   "5",
   "6",
   "7",
   "8",
   "9",
   "10"
  ],
  "topic": "deep",
  "branch": "Mind",
  "sub": "Agency",
  "tag": "Control",
  "axis": "in control",
  "test": null
 },
 {
  "id": "daily-026",
  "surface": "daily",
  "seq": 26,
  "type": "choice",
  "domain": null,
  "prompt": "Where does your sense of self come from?",
  "options": [
   "What I do",
   "Who I love",
   "What I believe",
   "What I make"
  ],
  "topic": "deep",
  "branch": "Values",
  "sub": "Identity",
  "tag": "Sense of self",
  "axis": null,
  "test": null
 },
 {
  "id": "daily-027",
  "surface": "daily",
  "seq": 27,
  "type": "binary",
  "domain": null,
  "prompt": "Relive your best day, or live a new one?",
  "options": [
   "Relive it",
   "A new one"
  ],
  "topic": "blend",
  "branch": "Mind",
  "sub": "Time",
  "tag": "Best day",
  "axis": null,
  "test": null
 },
 {
  "id": "daily-028",
  "surface": "daily",
  "seq": 28,
  "type": "choice",
  "domain": null,
  "prompt": "Pick a season for the soul.",
  "options": [
   "Spring",
   "Summer",
   "Autumn",
   "Winter"
  ],
  "topic": "light",
  "branch": "Travel",
  "sub": "Seasons",
  "tag": "Season",
  "axis": null,
  "test": null
 },
 {
  "id": "daily-029",
  "surface": "daily",
  "seq": 29,
  "type": "scale",
  "domain": null,
  "prompt": "Most people would help a stranger in need.",
  "options": [
   "Strongly disagree",
   "Disagree",
   "Neutral",
   "Agree",
   "Strongly agree"
  ],
  "topic": "deep",
  "branch": "Morals",
  "sub": "Faith in others",
  "tag": "Helping hands",
  "axis": "hopeful",
  "test": null
 },
 {
  "id": "daily-030",
  "surface": "daily",
  "seq": 30,
  "type": "binary",
  "domain": null,
  "prompt": "Team sports or solo sports?",
  "options": [
   "Team",
   "Solo"
  ],
  "topic": "light",
  "branch": "Sport",
  "sub": "How you play",
  "tag": "Team or solo",
  "axis": null,
  "test": null
 },
 {
  "id": "daily-031",
  "surface": "daily",
  "seq": 31,
  "type": "choice",
  "domain": null,
  "prompt": "Best way to watch a final?",
  "options": [
   "Stadium",
   "Pub",
   "Sofa"
  ],
  "topic": "light",
  "branch": "Sport",
  "sub": "Watching",
  "tag": "The final",
  "axis": null,
  "test": null
 },
 {
  "id": "daily-032",
  "surface": "daily",
  "seq": 32,
  "type": "binary",
  "domain": null,
  "prompt": "Subtitles or dubbing?",
  "options": [
   "Subtitles",
   "Dubbing"
  ],
  "topic": "light",
  "branch": "Film",
  "sub": "How you watch",
  "tag": "Subtitles",
  "axis": null,
  "test": null
 },
 {
  "id": "daily-033",
  "surface": "daily",
  "seq": 33,
  "type": "choice",
  "domain": null,
  "prompt": "A great film should leave you…",
  "options": [
   "Moved",
   "Thinking",
   "Entertained"
  ],
  "topic": "blend",
  "branch": "Film",
  "sub": "What it’s for",
  "tag": "What film is for",
  "axis": null,
  "test": null
 },
 {
  "id": "daily-034",
  "surface": "daily",
  "seq": 34,
  "type": "binary",
  "domain": null,
  "prompt": "Cinema or sofa?",
  "options": [
   "Cinema",
   "Sofa"
  ],
  "topic": "light",
  "branch": "Film",
  "sub": "Where you watch",
  "tag": "Cinema night",
  "axis": null,
  "test": null
 },
 {
  "id": "daily-035",
  "surface": "daily",
  "seq": 35,
  "type": "binary",
  "domain": null,
  "prompt": "Cook at home or eat out?",
  "options": [
   "Cook",
   "Eat out"
  ],
  "topic": "light",
  "branch": "Food",
  "sub": "Habits",
  "tag": "Kitchen or table",
  "axis": null,
  "test": null
 },
 {
  "id": "daily-036",
  "surface": "daily",
  "seq": 36,
  "type": "choice",
  "domain": null,
  "prompt": "One cuisine, forever?",
  "options": [
   "Italian",
   "Japanese",
   "Mexican",
   "Indian"
  ],
  "topic": "light",
  "branch": "Food",
  "sub": "Taste",
  "tag": "One cuisine",
  "axis": null,
  "test": null
 },
 {
  "id": "daily-037",
  "surface": "daily",
  "seq": 37,
  "type": "scale",
  "domain": null,
  "prompt": "Breakfast is the best meal of the day.",
  "options": [
   "Strongly disagree",
   "Disagree",
   "Neutral",
   "Agree",
   "Strongly agree"
  ],
  "topic": "light",
  "branch": "Food",
  "sub": "Meals",
  "tag": "Breakfast",
  "axis": "breakfast-loyal",
  "test": null
 },
 {
  "id": "daily-038",
  "surface": "daily",
  "seq": 38,
  "type": "binary",
  "domain": null,
  "prompt": "Mountains or sea?",
  "options": [
   "Mountains",
   "Sea"
  ],
  "topic": "light",
  "branch": "Travel",
  "sub": "Landscapes",
  "tag": "Mountains or sea",
  "axis": null,
  "test": null
 },
 {
  "id": "daily-039",
  "surface": "daily",
  "seq": 39,
  "type": "choice",
  "domain": null,
  "prompt": "The best part of a trip?",
  "options": [
   "Planning it",
   "Being there",
   "Coming home"
  ],
  "topic": "blend",
  "branch": "Travel",
  "sub": "The arc",
  "tag": "The trip",
  "axis": null,
  "test": null
 },
 {
  "id": "daily-040",
  "surface": "daily",
  "seq": 40,
  "type": "binary",
  "domain": null,
  "prompt": "One trip in a time machine: past or future?",
  "options": [
   "The past",
   "The future"
  ],
  "topic": "blend",
  "branch": "Travel",
  "sub": "Time travel",
  "tag": "Time machine",
  "axis": null,
  "test": null
 },
 {
  "id": "daily-041",
  "surface": "daily",
  "seq": 41,
  "type": "binary",
  "domain": null,
  "prompt": "A live gig or the perfect recording?",
  "options": [
   "Live",
   "The recording"
  ],
  "topic": "light",
  "branch": "Music",
  "sub": "How you listen",
  "tag": "Live or studio",
  "axis": null,
  "test": null
 },
 {
  "id": "daily-042",
  "surface": "daily",
  "seq": 42,
  "type": "choice",
  "domain": null,
  "prompt": "Music is mostly for…",
  "options": [
   "Dancing",
   "Feeling",
   "Focus",
   "Memory"
  ],
  "topic": "blend",
  "branch": "Music",
  "sub": "What it does",
  "tag": "What music does",
  "axis": null,
  "test": null
 },
 {
  "id": "daily-043",
  "surface": "daily",
  "seq": 43,
  "type": "binary",
  "domain": null,
  "prompt": "Lyrics or melody?",
  "options": [
   "Lyrics",
   "Melody"
  ],
  "topic": "light",
  "branch": "Music",
  "sub": "What hooks you",
  "tag": "Lyrics or melody",
  "axis": null,
  "test": null
 },
 {
  "id": "daily-044",
  "surface": "daily",
  "seq": 44,
  "type": "binary",
  "domain": null,
  "prompt": "Morning person or night owl?",
  "options": [
   "Morning",
   "Night owl"
  ],
  "topic": "light",
  "branch": "Body",
  "sub": "Clock",
  "tag": "Your clock",
  "axis": null,
  "test": null
 },
 {
  "id": "daily-045",
  "surface": "daily",
  "seq": 45,
  "type": "scale",
  "domain": null,
  "prompt": "I feel better after moving — every time.",
  "options": [
   "Strongly disagree",
   "Disagree",
   "Neutral",
   "Agree",
   "Strongly agree"
  ],
  "topic": "blend",
  "branch": "Body",
  "sub": "Movement",
  "tag": "Moving helps",
  "axis": "movement-powered",
  "test": null
 },
 {
  "id": "daily-046",
  "surface": "daily",
  "seq": 46,
  "type": "choice",
  "domain": null,
  "prompt": "Your childhood self would think you’re…",
  "options": [
   "Doing great",
   "Too serious",
   "Surprising",
   "A stranger"
  ],
  "topic": "deep",
  "branch": "Story",
  "sub": "Then and now",
  "tag": "Then and now",
  "axis": null,
  "test": null
 },
 {
  "id": "daily-047",
  "surface": "daily",
  "seq": 47,
  "type": "binary",
  "domain": null,
  "prompt": "Would you read a diary you kept at 15?",
  "options": [
   "Read it",
   "Burn it"
  ],
  "topic": "blend",
  "branch": "Story",
  "sub": "The archive",
  "tag": "The diary",
  "axis": null,
  "test": null
 },
 {
  "id": "daily-048",
  "surface": "daily",
  "seq": 48,
  "type": "choice",
  "domain": null,
  "prompt": "This decade is mostly for…",
  "options": [
   "Building",
   "Exploring",
   "Settling",
   "Healing"
  ],
  "topic": "deep",
  "branch": "Goals",
  "sub": "The decade",
  "tag": "The decade",
  "axis": null,
  "test": null
 },
 {
  "id": "daily-049",
  "surface": "daily",
  "seq": 49,
  "type": "scale",
  "domain": null,
  "prompt": "I know what I want from the next five years.",
  "options": [
   "Strongly disagree",
   "Disagree",
   "Neutral",
   "Agree",
   "Strongly agree"
  ],
  "topic": "deep",
  "branch": "Goals",
  "sub": "Clarity",
  "tag": "Five years",
  "axis": "clear-eyed",
  "test": null
 },
 {
  "id": "daily-050",
  "surface": "daily",
  "seq": 50,
  "type": "choice",
  "domain": null,
  "prompt": "Home is mostly…",
  "options": [
   "A base",
   "A nest",
   "A project",
   "A stopover"
  ],
  "topic": "blend",
  "branch": "Home",
  "sub": "What it is",
  "tag": "What home is",
  "axis": null,
  "test": null
 },
 {
  "id": "daily-051",
  "surface": "daily",
  "seq": 51,
  "type": "binary",
  "domain": null,
  "prompt": "Master one thing, or dabble in many?",
  "options": [
   "Master one",
   "Dabble"
  ],
  "topic": "blend",
  "branch": "Skills",
  "sub": "Depth",
  "tag": "Depth or range",
  "axis": null,
  "test": null
 },
 {
  "id": "daily-052",
  "surface": "daily",
  "seq": 52,
  "type": "binary",
  "domain": null,
  "prompt": "New hobby: learn alone or join a club?",
  "options": [
   "Alone",
   "Join a club"
  ],
  "topic": "light",
  "branch": "Interests",
  "sub": "How you start",
  "tag": "How you start",
  "axis": null,
  "test": null
 },
 {
  "id": "daily-053",
  "surface": "daily",
  "seq": 53,
  "type": "binary",
  "domain": null,
  "prompt": "A tidy home or a lived-in one?",
  "options": [
   "Tidy",
   "Lived-in"
  ],
  "topic": "light",
  "branch": "Home",
  "sub": "How it looks",
  "tag": "Tidy or lived-in",
  "axis": null,
  "test": null
 },
 {
  "id": "daily-054",
  "surface": "daily",
  "seq": 54,
  "type": "choice",
  "domain": null,
  "prompt": "What makes a place feel like home first?",
  "options": [
   "The people",
   "The things",
   "The routines",
   "Time"
  ],
  "topic": "deep",
  "branch": "Home",
  "sub": "What makes it",
  "tag": "What makes it home",
  "axis": null,
  "test": null
 },
 {
  "id": "daily-055",
  "surface": "daily",
  "seq": 55,
  "type": "binary",
  "domain": null,
  "prompt": "A full house or a quiet one?",
  "options": [
   "Full house",
   "Quiet"
  ],
  "topic": "blend",
  "branch": "Home",
  "sub": "Guests",
  "tag": "Full or quiet",
  "axis": null,
  "test": null
 },
 {
  "id": "daily-056",
  "surface": "daily",
  "seq": 56,
  "type": "choice",
  "domain": null,
  "prompt": "Your home’s one non-negotiable?",
  "options": [
   "Light",
   "Quiet",
   "Space",
   "The view"
  ],
  "topic": "blend",
  "branch": "Home",
  "sub": "Non-negotiables",
  "tag": "Non-negotiable",
  "axis": null,
  "test": null
 },
 {
  "id": "daily-057",
  "surface": "daily",
  "seq": 57,
  "type": "binary",
  "domain": null,
  "prompt": "Read the manual, or wing it?",
  "options": [
   "The manual",
   "Wing it"
  ],
  "topic": "light",
  "branch": "Skills",
  "sub": "How you learn",
  "tag": "Manual or wing it",
  "axis": null,
  "test": null
 },
 {
  "id": "daily-058",
  "surface": "daily",
  "seq": 58,
  "type": "choice",
  "domain": null,
  "prompt": "Which would you master overnight, if you could?",
  "options": [
   "A language",
   "An instrument",
   "Cooking",
   "Carpentry"
  ],
  "topic": "blend",
  "branch": "Skills",
  "sub": "Wishlist",
  "tag": "Overnight mastery",
  "axis": null,
  "test": null
 },
 {
  "id": "daily-059",
  "surface": "daily",
  "seq": 59,
  "type": "choice",
  "domain": null,
  "prompt": "The hardest thing to learn?",
  "options": [
   "Patience",
   "Listening",
   "Asking for help",
   "Letting go"
  ],
  "topic": "deep",
  "branch": "Skills",
  "sub": "The hard ones",
  "tag": "Hardest to learn",
  "axis": null,
  "test": null
 },
 {
  "id": "daily-060",
  "surface": "daily",
  "seq": 60,
  "type": "scale",
  "domain": null,
  "prompt": "Being bad at something new is half the fun.",
  "options": [
   "Strongly disagree",
   "Disagree",
   "Neutral",
   "Agree",
   "Strongly agree"
  ],
  "topic": "blend",
  "branch": "Skills",
  "sub": "Beginnings",
  "tag": "Half the fun",
  "axis": "beginner-hearted",
  "test": null
 },
 {
  "id": "daily-061",
  "surface": "daily",
  "seq": 61,
  "type": "binary",
  "domain": null,
  "prompt": "Collect things, or experiences?",
  "options": [
   "Things",
   "Experiences"
  ],
  "topic": "blend",
  "branch": "Interests",
  "sub": "Collecting",
  "tag": "What you collect",
  "axis": null,
  "test": null
 },
 {
  "id": "daily-062",
  "surface": "daily",
  "seq": 62,
  "type": "choice",
  "domain": null,
  "prompt": "A free Saturday, no plans. What pulls you?",
  "options": [
   "Outdoors",
   "A project",
   "People",
   "The sofa"
  ],
  "topic": "light",
  "branch": "Interests",
  "sub": "Free time",
  "tag": "Free Saturday",
  "axis": null,
  "test": null
 },
 {
  "id": "daily-063",
  "surface": "daily",
  "seq": 63,
  "type": "scale",
  "domain": null,
  "prompt": "Everyone needs at least one useless hobby.",
  "options": [
   "Strongly disagree",
   "Disagree",
   "Neutral",
   "Agree",
   "Strongly agree"
  ],
  "topic": "blend",
  "branch": "Interests",
  "sub": "Why we bother",
  "tag": "Useless hobbies",
  "axis": "play-minded",
  "test": null
 },
 {
  "id": "daily-064",
  "surface": "daily",
  "seq": 64,
  "type": "binary",
  "domain": null,
  "prompt": "Would you rather be interesting, or interested?",
  "options": [
   "Interesting",
   "Interested"
  ],
  "topic": "deep",
  "branch": "Interests",
  "sub": "The point",
  "tag": "Interesting or interested",
  "axis": null,
  "test": null
 },
 {
  "id": "daily-065",
  "surface": "daily",
  "seq": 65,
  "type": "choice",
  "domain": null,
  "prompt": "Which chapter are you in?",
  "options": [
   "Early pages",
   "The thick of it",
   "A turning point",
   "A quiet chapter"
  ],
  "topic": "deep",
  "branch": "Story",
  "sub": "Chapters",
  "tag": "The chapter",
  "axis": null,
  "test": null
 },
 {
  "id": "daily-066",
  "surface": "daily",
  "seq": 66,
  "type": "choice",
  "domain": null,
  "prompt": "The story you tell most often is about…",
  "options": [
   "A triumph",
   "A disaster",
   "A coincidence",
   "A person"
  ],
  "topic": "blend",
  "branch": "Story",
  "sub": "Retellings",
  "tag": "Retellings",
  "axis": null,
  "test": null
 },
 {
  "id": "daily-067",
  "surface": "daily",
  "seq": 67,
  "type": "binary",
  "domain": null,
  "prompt": "Do you remember your past in pictures, or in stories?",
  "options": [
   "Pictures",
   "Stories"
  ],
  "topic": "blend",
  "branch": "Story",
  "sub": "Memory",
  "tag": "How you remember",
  "axis": null,
  "test": null
 },
 {
  "id": "daily-068",
  "surface": "daily",
  "seq": 68,
  "type": "choice",
  "domain": null,
  "prompt": "If someone wrote your biography, the title would mention…",
  "options": [
   "A place",
   "A person",
   "A struggle",
   "A joke"
  ],
  "topic": "blend",
  "branch": "Story",
  "sub": "The book of you",
  "tag": "The biography",
  "axis": null,
  "test": null
 },
 {
  "id": "daily-069",
  "surface": "daily",
  "seq": 69,
  "type": "binary",
  "domain": null,
  "prompt": "Big goals: write them down, or keep them quiet?",
  "options": [
   "Write them down",
   "Keep them quiet"
  ],
  "topic": "blend",
  "branch": "Goals",
  "sub": "Method",
  "tag": "Goal keeping",
  "axis": null,
  "test": null
 },
 {
  "id": "daily-070",
  "surface": "daily",
  "seq": 70,
  "type": "scale",
  "domain": null,
  "prompt": "I'd rather aim high and miss than aim safe and hit.",
  "options": [
   "Strongly disagree",
   "Disagree",
   "Neutral",
   "Agree",
   "Strongly agree"
  ],
  "topic": "deep",
  "branch": "Goals",
  "sub": "Ambition",
  "tag": "Aim high",
  "axis": "high-aiming",
  "test": null
 },
 {
  "id": "daily-071",
  "surface": "daily",
  "seq": 71,
  "type": "choice",
  "domain": null,
  "prompt": "What usually stops you?",
  "options": [
   "Starting",
   "Sticking with it",
   "Finishing",
   "Knowing what I want"
  ],
  "topic": "deep",
  "branch": "Goals",
  "sub": "The obstacle",
  "tag": "The obstacle",
  "axis": null,
  "test": null
 },
 {
  "id": "daily-072",
  "surface": "daily",
  "seq": 72,
  "type": "binary",
  "domain": null,
  "prompt": "Retire early, or never fully retire?",
  "options": [
   "Early",
   "Never fully"
  ],
  "topic": "blend",
  "branch": "Goals",
  "sub": "The long game",
  "tag": "The long game",
  "axis": null,
  "test": null
 },
 {
  "id": "daily-073",
  "surface": "daily",
  "seq": 73,
  "type": "choice",
  "domain": null,
  "prompt": "Your body mostly asks for…",
  "options": [
   "Sleep",
   "Food",
   "Movement",
   "Quiet"
  ],
  "topic": "light",
  "branch": "Body",
  "sub": "Signals",
  "tag": "Body signals",
  "axis": null,
  "test": null
 },
 {
  "id": "daily-074",
  "surface": "daily",
  "seq": 74,
  "type": "binary",
  "domain": null,
  "prompt": "Sauna or ice bath?",
  "options": [
   "Sauna",
   "Ice bath"
  ],
  "topic": "light",
  "branch": "Body",
  "sub": "Heat or cold",
  "tag": "Heat or cold",
  "bg": "Sauna heat and cold-water immersion both trigger short, sharp stress responses the body adapts to. Finland counts about three million saunas for 5.6 million people; ice swimming is its winter twin.",
  "axis": null,
  "test": null
 },
 {
  "id": "daily-075",
  "surface": "daily",
  "seq": 75,
  "type": "scale",
  "domain": null,
  "prompt": "Eight hours of sleep is non-negotiable.",
  "options": [
   "Strongly disagree",
   "Disagree",
   "Neutral",
   "Agree",
   "Strongly agree"
  ],
  "topic": "blend",
  "branch": "Body",
  "sub": "Sleep",
  "tag": "Sleep rules",
  "axis": "sleep-strict",
  "test": null
 },
 {
  "id": "daily-076",
  "surface": "daily",
  "seq": 76,
  "type": "binary",
  "domain": null,
  "prompt": "Stairs or escalator?",
  "options": [
   "Stairs",
   "Escalator"
  ],
  "topic": "light",
  "branch": "Body",
  "sub": "Everyday movement",
  "tag": "Small choices",
  "axis": null,
  "test": null
 },
 {
  "id": "daily-077",
  "surface": "daily",
  "seq": 77,
  "type": "binary",
  "domain": null,
  "prompt": "Music while you work?",
  "options": [
   "Always",
   "Never"
  ],
  "topic": "light",
  "branch": "Music",
  "sub": "When you listen",
  "tag": "Work soundtrack",
  "axis": null,
  "test": null
 },
 {
  "id": "daily-078",
  "surface": "daily",
  "seq": 78,
  "type": "choice",
  "domain": null,
  "prompt": "The music that made you was from your…",
  "options": [
   "Teens",
   "Twenties",
   "Childhood",
   "Last year"
  ],
  "topic": "blend",
  "branch": "Music",
  "sub": "Formative years",
  "tag": "Formative years",
  "axis": null,
  "test": null
 },
 {
  "id": "daily-079",
  "surface": "daily",
  "seq": 79,
  "type": "binary",
  "domain": null,
  "prompt": "One album forever, or shuffle forever?",
  "options": [
   "One album",
   "Shuffle"
  ],
  "topic": "light",
  "branch": "Music",
  "sub": "How you listen",
  "tag": "One album",
  "axis": null,
  "test": null
 },
 {
  "id": "daily-080",
  "surface": "daily",
  "seq": 80,
  "type": "binary",
  "domain": null,
  "prompt": "Same place every year, or somewhere new every time?",
  "options": [
   "Same place",
   "Somewhere new"
  ],
  "topic": "blend",
  "branch": "Travel",
  "sub": "Repeat or explore",
  "tag": "Repeat or explore",
  "axis": null,
  "test": null
 },
 {
  "id": "daily-081",
  "surface": "daily",
  "seq": 81,
  "type": "binary",
  "domain": null,
  "prompt": "Underdog stories or dynasties?",
  "options": [
   "Underdogs",
   "Dynasties"
  ],
  "topic": "blend",
  "branch": "Sport",
  "sub": "Rooting",
  "tag": "Who you root for",
  "axis": null,
  "test": null
 },
 {
  "id": "daily-082",
  "surface": "daily",
  "seq": 82,
  "type": "binary",
  "domain": null,
  "prompt": "Sweet or salty?",
  "options": [
   "Sweet",
   "Salty"
  ],
  "topic": "light",
  "branch": "Food",
  "sub": "Cravings",
  "tag": "Cravings",
  "axis": null,
  "test": null
 },
 {
  "id": "daily-083",
  "surface": "daily",
  "seq": 83,
  "type": "binary",
  "domain": null,
  "prompt": "Spoilers: ruin everything, or don't matter?",
  "options": [
   "Ruin everything",
   "Don't matter"
  ],
  "topic": "light",
  "branch": "Film",
  "sub": "Spoilers",
  "tag": "Spoilers",
  "axis": null,
  "test": null
 },
 {
  "id": "daily-084",
  "surface": "daily",
  "seq": 84,
  "type": "dilemma",
  "domain": null,
  "prompt": "You can know one true thing about how someone sees you. Ask, or not?",
  "options": [
   "Ask",
   "Never ask"
  ],
  "topic": "deep",
  "branch": "Values",
  "sub": "Truth",
  "tag": "The one truth",
  "axis": null,
  "test": null
 },
 {
  "id": "daily-085",
  "surface": "daily",
  "seq": 85,
  "type": "scale",
  "domain": null,
  "prompt": "An apology can fix almost anything.",
  "options": [
   "Strongly disagree",
   "Disagree",
   "Neutral",
   "Agree",
   "Strongly agree"
  ],
  "topic": "deep",
  "branch": "Values",
  "sub": "Repair",
  "tag": "Repair",
  "axis": "forgiving",
  "test": null
 },
 {
  "id": "daily-086",
  "surface": "daily",
  "seq": 86,
  "type": "choice",
  "domain": null,
  "prompt": "Who do you owe most?",
  "options": [
   "Family",
   "Friends",
   "Strangers in need",
   "Yourself"
  ],
  "topic": "deep",
  "branch": "Morals",
  "sub": "Debts",
  "tag": "Debts",
  "axis": null,
  "test": null
 },
 {
  "id": "daily-087",
  "surface": "daily",
  "seq": 87,
  "type": "dilemma",
  "domain": null,
  "prompt": "A favourite artist turns out to have done something awful. Keep listening?",
  "options": [
   "Keep listening",
   "Can't anymore"
  ],
  "topic": "deep",
  "branch": "Morals",
  "sub": "Art and artist",
  "tag": "Art and artist",
  "axis": null,
  "test": null
 },
 {
  "id": "daily-088",
  "surface": "daily",
  "seq": 88,
  "type": "choice",
  "domain": null,
  "prompt": "The best seat in your home is…",
  "options": [
   "The sofa",
   "The kitchen table",
   "The bed",
   "By the window"
  ],
  "topic": "light",
  "branch": "Home",
  "sub": "The good spot",
  "tag": "The good spot",
  "axis": null,
  "test": null
 },
 {
  "id": "daily-089",
  "surface": "daily",
  "seq": 89,
  "type": "rating",
  "domain": null,
  "prompt": "How alive is your curiosity these days?",
  "options": [
   "1",
   "2",
   "3",
   "4",
   "5",
   "6",
   "7",
   "8",
   "9",
   "10"
  ],
  "topic": "blend",
  "branch": "Interests",
  "sub": "Curiosity",
  "tag": "Curiosity",
  "axis": "curious",
  "test": null
 },
 {
  "id": "daily-090",
  "surface": "daily",
  "seq": 90,
  "type": "rating",
  "domain": null,
  "prompt": "How easy is it to get into nature from where you live?",
  "options": [
   "1",
   "2",
   "3",
   "4",
   "5",
   "6",
   "7",
   "8",
   "9",
   "10"
  ],
  "topic": "blend",
  "branch": "Home",
  "sub": "Nature nearby",
  "tag": "Nature access",
  "rates": "city",
  "axis": "nature-close",
  "test": null
 },
 {
  "id": "daily-091",
  "surface": "daily",
  "seq": 91,
  "type": "rating",
  "domain": null,
  "prompt": "How well does your city move you around?",
  "options": [
   "1",
   "2",
   "3",
   "4",
   "5",
   "6",
   "7",
   "8",
   "9",
   "10"
  ],
  "topic": "blend",
  "branch": "Home",
  "sub": "Getting around",
  "tag": "Getting around",
  "rates": "city",
  "axis": "well-connected",
  "test": null
 },
 {
  "id": "daily-092",
  "surface": "daily",
  "seq": 92,
  "type": "rating",
  "domain": null,
  "prompt": "How safe do you feel walking home at night?",
  "options": [
   "1",
   "2",
   "3",
   "4",
   "5",
   "6",
   "7",
   "8",
   "9",
   "10"
  ],
  "topic": "deep",
  "branch": "Home",
  "sub": "Safety",
  "tag": "Safety",
  "rates": "city",
  "axis": "safe",
  "test": null
 },
 {
  "id": "daily-093",
  "surface": "daily",
  "seq": 93,
  "type": "rating",
  "domain": null,
  "prompt": "Rate the food where you live.",
  "options": [
   "1",
   "2",
   "3",
   "4",
   "5",
   "6",
   "7",
   "8",
   "9",
   "10"
  ],
  "topic": "light",
  "branch": "Food",
  "sub": "Where you live",
  "tag": "Food scene",
  "rates": "city",
  "axis": "well-fed",
  "test": null
 },
 {
  "id": "daily-094",
  "surface": "daily",
  "seq": 94,
  "type": "rating",
  "domain": null,
  "prompt": "Your city after dark — rate the nightlife.",
  "options": [
   "1",
   "2",
   "3",
   "4",
   "5",
   "6",
   "7",
   "8",
   "9",
   "10"
  ],
  "topic": "light",
  "branch": "Home",
  "sub": "After dark",
  "tag": "Nightlife",
  "rates": "city",
  "axis": "night-loving",
  "test": null
 },
 {
  "id": "daily-095",
  "surface": "daily",
  "seq": 95,
  "type": "rating",
  "domain": null,
  "prompt": "How easy is it to talk to a stranger here?",
  "options": [
   "1",
   "2",
   "3",
   "4",
   "5",
   "6",
   "7",
   "8",
   "9",
   "10"
  ],
  "topic": "blend",
  "branch": "Home",
  "sub": "Neighbours",
  "tag": "Friendliness",
  "rates": "city",
  "axis": "warm",
  "test": null
 },
 {
  "id": "daily-096",
  "surface": "daily",
  "seq": 96,
  "type": "rating",
  "domain": null,
  "prompt": "How is dating where you live?",
  "options": [
   "1",
   "2",
   "3",
   "4",
   "5",
   "6",
   "7",
   "8",
   "9",
   "10"
  ],
  "topic": "blend",
  "branch": "Home",
  "sub": "Dating",
  "tag": "Dating",
  "rates": "city",
  "axis": "lucky in love",
  "test": null
 },
 {
  "id": "daily-097",
  "surface": "daily",
  "seq": 97,
  "type": "rating",
  "domain": null,
  "prompt": "How affordable is your city on a normal wage?",
  "options": [
   "1",
   "2",
   "3",
   "4",
   "5",
   "6",
   "7",
   "8",
   "9",
   "10"
  ],
  "topic": "deep",
  "branch": "Home",
  "sub": "Cost of living",
  "tag": "Affordability",
  "rates": "city",
  "axis": "comfortable",
  "test": null
 },
 {
  "id": "daily-098",
  "surface": "daily",
  "seq": 98,
  "type": "rating",
  "domain": null,
  "prompt": "Your country's landscapes — how good are they?",
  "options": [
   "1",
   "2",
   "3",
   "4",
   "5",
   "6",
   "7",
   "8",
   "9",
   "10"
  ],
  "topic": "light",
  "branch": "Travel",
  "sub": "Landscapes",
  "tag": "Nature",
  "rates": "country",
  "axis": "landscape-blessed",
  "test": null
 },
 {
  "id": "daily-099",
  "surface": "daily",
  "seq": 99,
  "type": "rating",
  "domain": null,
  "prompt": "How safe a country is yours to live in?",
  "options": [
   "1",
   "2",
   "3",
   "4",
   "5",
   "6",
   "7",
   "8",
   "9",
   "10"
  ],
  "topic": "deep",
  "branch": "Home",
  "sub": "Your country",
  "tag": "Safety",
  "rates": "country",
  "axis": "unworried",
  "test": null
 },
 {
  "id": "daily-100",
  "surface": "daily",
  "seq": 100,
  "type": "rating",
  "domain": null,
  "prompt": "Work and rest in your country — how well do they balance?",
  "options": [
   "1",
   "2",
   "3",
   "4",
   "5",
   "6",
   "7",
   "8",
   "9",
   "10"
  ],
  "topic": "deep",
  "branch": "Goals",
  "sub": "Work and life",
  "tag": "Work–life balance",
  "rates": "country",
  "axis": "balanced",
  "test": null
 },
 {
  "id": "daily-101",
  "surface": "daily",
  "seq": 101,
  "type": "rating",
  "domain": null,
  "prompt": "If you got sick tomorrow, how good would the care be?",
  "options": [
   "1",
   "2",
   "3",
   "4",
   "5",
   "6",
   "7",
   "8",
   "9",
   "10"
  ],
  "topic": "deep",
  "branch": "Body",
  "sub": "Care",
  "tag": "Healthcare",
  "rates": "country",
  "axis": "well cared for",
  "test": null
 },
 {
  "id": "daily-102",
  "surface": "daily",
  "seq": 102,
  "type": "rating",
  "domain": null,
  "prompt": "Do everyday services work where you are?",
  "options": [
   "1",
   "2",
   "3",
   "4",
   "5",
   "6",
   "7",
   "8",
   "9",
   "10"
  ],
  "topic": "blend",
  "branch": "Home",
  "sub": "Your country",
  "tag": "Public services",
  "rates": "country",
  "axis": "well-run",
  "test": null
 },
 {
  "id": "daily-103",
  "surface": "daily",
  "seq": 103,
  "type": "rating",
  "domain": null,
  "prompt": "How welcoming is your country to people who move there?",
  "options": [
   "1",
   "2",
   "3",
   "4",
   "5",
   "6",
   "7",
   "8",
   "9",
   "10"
  ],
  "topic": "deep",
  "branch": "Values",
  "sub": "Openness",
  "tag": "Openness",
  "rates": "country",
  "axis": "welcoming",
  "test": null,
  "political": true
 },
 {
  "id": "daily-104",
  "surface": "daily",
  "seq": 104,
  "type": "rating",
  "domain": null,
  "prompt": "The weather you live with. Be honest.",
  "options": [
   "1",
   "2",
   "3",
   "4",
   "5",
   "6",
   "7",
   "8",
   "9",
   "10"
  ],
  "topic": "light",
  "branch": "Home",
  "sub": "Weather",
  "tag": "Weather",
  "rates": "country",
  "axis": "weather-blessed",
  "test": null
 },
 {
  "id": "daily-105",
  "surface": "daily",
  "seq": 105,
  "type": "rating",
  "domain": null,
  "prompt": "Can an ordinary wage carry an ordinary life here?",
  "options": [
   "1",
   "2",
   "3",
   "4",
   "5",
   "6",
   "7",
   "8",
   "9",
   "10"
  ],
  "topic": "deep",
  "branch": "Goals",
  "sub": "Money",
  "tag": "Affordability",
  "rates": "country",
  "axis": "well-off",
  "test": null
 },
 {
  "id": "daily-106",
  "surface": "daily",
  "seq": 106,
  "type": "rating",
  "domain": null,
  "prompt": "How good is what the world eats these days?",
  "options": [
   "1",
   "2",
   "3",
   "4",
   "5",
   "6",
   "7",
   "8",
   "9",
   "10"
  ],
  "topic": "light",
  "branch": "Food",
  "sub": "The world",
  "tag": "What we eat",
  "rates": "world",
  "axis": "food-glad",
  "test": null
 },
 {
  "id": "daily-107",
  "surface": "daily",
  "seq": 107,
  "type": "rating",
  "domain": null,
  "prompt": "Music right now, worldwide — rate it.",
  "options": [
   "1",
   "2",
   "3",
   "4",
   "5",
   "6",
   "7",
   "8",
   "9",
   "10"
  ],
  "topic": "light",
  "branch": "Music",
  "sub": "Right now",
  "tag": "Music right now",
  "rates": "world",
  "axis": "music-glad",
  "test": null
 },
 {
  "id": "daily-108",
  "surface": "daily",
  "seq": 108,
  "type": "rating",
  "domain": null,
  "prompt": "How kind are strangers these days?",
  "options": [
   "1",
   "2",
   "3",
   "4",
   "5",
   "6",
   "7",
   "8",
   "9",
   "10"
  ],
  "topic": "deep",
  "branch": "Morals",
  "sub": "Kindness",
  "tag": "Kindness of strangers",
  "rates": "world",
  "axis": "faith in strangers",
  "test": null
 },
 {
  "id": "daily-109",
  "surface": "daily",
  "seq": 109,
  "type": "rating",
  "domain": null,
  "prompt": "Where the world is heading — rate it.",
  "options": [
   "1",
   "2",
   "3",
   "4",
   "5",
   "6",
   "7",
   "8",
   "9",
   "10"
  ],
  "topic": "deep",
  "branch": "Story",
  "sub": "The future",
  "tag": "Where it’s heading",
  "rates": "world",
  "axis": "world-hopeful",
  "test": null
 },
 {
  "id": "daily-110",
  "surface": "daily",
  "seq": 110,
  "type": "rating",
  "domain": null,
  "prompt": "The state of nature worldwide — rate it.",
  "options": [
   "1",
   "2",
   "3",
   "4",
   "5",
   "6",
   "7",
   "8",
   "9",
   "10"
  ],
  "topic": "deep",
  "branch": "Travel",
  "sub": "The planet",
  "tag": "State of nature",
  "rates": "world",
  "axis": "unalarmed",
  "test": null
 },
 {
  "id": "daily-111",
  "surface": "daily",
  "seq": 111,
  "type": "rating",
  "domain": null,
  "prompt": "How honest is public life these days?",
  "options": [
   "1",
   "2",
   "3",
   "4",
   "5",
   "6",
   "7",
   "8",
   "9",
   "10"
  ],
  "topic": "deep",
  "branch": "Morals",
  "sub": "Honesty",
  "tag": "Public honesty",
  "rates": "world",
  "axis": "unjaded",
  "test": null,
  "political": true
 },
 {
  "id": "daily-112",
  "surface": "daily",
  "seq": 112,
  "type": "rating",
  "domain": null,
  "prompt": "How fair is the world right now?",
  "options": [
   "1",
   "2",
   "3",
   "4",
   "5",
   "6",
   "7",
   "8",
   "9",
   "10"
  ],
  "topic": "deep",
  "branch": "Morals",
  "sub": "Fairness",
  "tag": "Fairness",
  "rates": "world",
  "axis": "fair-minded",
  "test": null
 },
 {
  "id": "daily-113",
  "surface": "daily",
  "seq": 113,
  "type": "rating",
  "domain": null,
  "prompt": "How well is the world being led?",
  "options": [
   "1",
   "2",
   "3",
   "4",
   "5",
   "6",
   "7",
   "8",
   "9",
   "10"
  ],
  "topic": "deep",
  "branch": "Values",
  "sub": "Leadership",
  "tag": "Leadership",
  "rates": "world",
  "axis": "leader-trusting",
  "test": null,
  "political": true
 },
 {
  "id": "daily-114",
  "surface": "daily",
  "seq": 114,
  "type": "binary",
  "domain": null,
  "prompt": "Win ugly, or lose beautifully?",
  "options": [
   "Win ugly",
   "Lose beautifully"
  ],
  "topic": "blend",
  "branch": "Sport",
  "sub": "Style",
  "tag": "Ugly win",
  "axis": null,
  "test": null
 },
 {
  "id": "daily-115",
  "surface": "daily",
  "seq": 115,
  "type": "binary",
  "domain": null,
  "prompt": "Black and white films: timeless, or homework?",
  "options": [
   "Timeless",
   "Homework"
  ],
  "topic": "light",
  "branch": "Film",
  "sub": "The classics",
  "tag": "Black and white",
  "bg": "The first films were black and white by necessity — colour arrived commercially in the 1930s and became standard only in the 1960s. Directors still choose monochrome deliberately, from Schindler's List to Roma.",
  "axis": null,
  "test": null
 },
 {
  "id": "daily-116",
  "surface": "daily",
  "seq": 116,
  "type": "scale",
  "domain": null,
  "prompt": "A skill isn't yours until you've taught it to someone.",
  "options": [
   "Strongly disagree",
   "Disagree",
   "Neutral",
   "Agree",
   "Strongly agree"
  ],
  "topic": "blend",
  "branch": "Skills",
  "sub": "Mastery",
  "tag": "Teach it",
  "axis": "teaching-minded",
  "test": null
 },
 {
  "id": "daily-117",
  "surface": "daily",
  "seq": 117,
  "type": "choice",
  "domain": null,
  "prompt": "What pulls you down a rabbit hole at 1 a.m.?",
  "options": [
   "History",
   "How things work",
   "Other people's lives",
   "Maps"
  ],
  "topic": "light",
  "branch": "Interests",
  "sub": "Rabbit holes",
  "tag": "Rabbit holes",
  "axis": null,
  "test": null
 },
 {
  "id": "daily-118",
  "surface": "daily",
  "seq": 118,
  "type": "binary",
  "domain": null,
  "prompt": "The last slice: take it, or offer it?",
  "options": [
   "Take it",
   "Offer it"
  ],
  "topic": "light",
  "branch": "Food",
  "sub": "Table manners",
  "tag": "Last slice",
  "axis": null,
  "test": null
 },
 {
  "id": "daily-119",
  "surface": "daily",
  "seq": 119,
  "type": "binary",
  "domain": null,
  "prompt": "Window seat or aisle?",
  "options": [
   "Window",
   "Aisle"
  ],
  "topic": "light",
  "branch": "Travel",
  "sub": "In transit",
  "tag": "The seat",
  "axis": null,
  "test": null
 },
 {
  "id": "daily-120",
  "surface": "daily",
  "seq": 120,
  "type": "choice",
  "domain": null,
  "prompt": "Where does music hit you hardest?",
  "options": [
   "Alone in headphones",
   "Live in a crowd",
   "In the car",
   "On the dance floor"
  ],
  "topic": "blend",
  "branch": "Music",
  "sub": "Where it hits",
  "tag": "Where it hits",
  "axis": null,
  "test": null
 },
 {
  "id": "daily-121",
  "surface": "daily",
  "seq": 121,
  "type": "scale",
  "domain": null,
  "prompt": "Your body runs your mood more than your mind does.",
  "options": [
   "Strongly disagree",
   "Disagree",
   "Neutral",
   "Agree",
   "Strongly agree"
  ],
  "topic": "deep",
  "branch": "Body",
  "sub": "Mind and body",
  "tag": "Body first",
  "axis": "body-led",
  "test": null
 },
 {
  "id": "daily-122",
  "surface": "daily",
  "seq": 122,
  "type": "binary",
  "domain": null,
  "prompt": "The team you support: inherited, or chosen?",
  "options": [
   "Inherited",
   "Chosen"
  ],
  "topic": "blend",
  "branch": "Sport",
  "sub": "Rooting",
  "tag": "How you got them",
  "axis": null,
  "test": null
 },
 {
  "id": "daily-123",
  "surface": "daily",
  "seq": 123,
  "type": "binary",
  "domain": null,
  "prompt": "Rewatch a favourite, or risk something new?",
  "options": [
   "Rewatch",
   "Risk it"
  ],
  "topic": "light",
  "branch": "Film",
  "sub": "How you watch",
  "tag": "Rewatch or risk",
  "axis": null,
  "test": null
 },
 {
  "id": "daily-124",
  "surface": "daily",
  "seq": 124,
  "type": "choice",
  "domain": null,
  "prompt": "Which could you do perfectly, starting right now?",
  "options": [
   "Play an instrument",
   "Speak a language",
   "Draw anything",
   "Fix anything"
  ],
  "topic": "blend",
  "branch": "Skills",
  "sub": "Wishlist",
  "tag": "The instant skill",
  "axis": null,
  "test": null
 },
 {
  "id": "daily-125",
  "surface": "daily",
  "seq": 125,
  "type": "choice",
  "domain": null,
  "prompt": "Your life so far reads most like…",
  "options": [
   "A straight line",
   "A few sharp turns",
   "A slow drift",
   "Still chapter one"
  ],
  "topic": "deep",
  "branch": "Story",
  "sub": "Chapters",
  "tag": "The shape of it",
  "axis": null,
  "test": null
 },
 {
  "id": "daily-126",
  "surface": "daily",
  "seq": 126,
  "type": "scale",
  "domain": null,
  "prompt": "The best hobbies have nothing to show for them.",
  "options": [
   "Strongly disagree",
   "Disagree",
   "Neutral",
   "Agree",
   "Strongly agree"
  ],
  "topic": "deep",
  "branch": "Interests",
  "sub": "The point",
  "tag": "Nothing to show",
  "axis": "unproductive",
  "test": null
 },
 {
  "id": "daily-127",
  "surface": "daily",
  "seq": 127,
  "type": "binary",
  "domain": null,
  "prompt": "Respected at work, or free to walk away from it?",
  "options": [
   "Respected",
   "Free to walk"
  ],
  "topic": "deep",
  "branch": "Goals",
  "sub": "Work and life",
  "tag": "Respect or freedom",
  "axis": null,
  "test": null
 },
 {
  "id": "daily-128",
  "surface": "daily",
  "seq": 128,
  "type": "choice",
  "domain": null,
  "prompt": "First thing you want in the morning?",
  "options": [
   "Quiet",
   "Coffee",
   "Movement",
   "Ten more minutes"
  ],
  "topic": "light",
  "branch": "Body",
  "sub": "Mornings",
  "tag": "First thing",
  "axis": null,
  "test": null
 },
 {
  "id": "daily-129",
  "surface": "daily",
  "seq": 129,
  "type": "binary",
  "domain": null,
  "prompt": "At a concert: front row, or back with space?",
  "options": [
   "Front row",
   "Back with space"
  ],
  "topic": "light",
  "branch": "Music",
  "sub": "Going out",
  "tag": "Where you stand",
  "axis": null,
  "test": null
 },
 {
  "id": "daily-130",
  "surface": "daily",
  "seq": 130,
  "type": "binary",
  "domain": null,
  "prompt": "The book or the film first?",
  "options": [
   "Book first",
   "Film first"
  ],
  "topic": "light",
  "branch": "Film",
  "sub": "Adaptations",
  "tag": "Which first",
  "axis": null,
  "test": null
 },
 {
  "id": "daily-131",
  "surface": "daily",
  "seq": 131,
  "type": "choice",
  "domain": null,
  "prompt": "What makes a villain great?",
  "options": [
   "Menace",
   "Charm",
   "Being half right",
   "Mystery"
  ],
  "topic": "light",
  "branch": "Film",
  "sub": "Villains",
  "tag": "Villains",
  "axis": null,
  "test": null
 },
 {
  "id": "daily-132",
  "surface": "daily",
  "seq": 132,
  "type": "binary",
  "domain": null,
  "prompt": "Practise in private, or learn in public?",
  "options": [
   "In private",
   "In public"
  ],
  "topic": "deep",
  "branch": "Skills",
  "sub": "How you learn",
  "tag": "Learning out loud",
  "axis": null,
  "test": null
 },
 {
  "id": "daily-133",
  "surface": "daily",
  "seq": 133,
  "type": "scale",
  "domain": null,
  "prompt": "Talent is mostly patience.",
  "options": [
   "Strongly disagree",
   "Disagree",
   "Neutral",
   "Agree",
   "Strongly agree"
  ],
  "topic": "deep",
  "branch": "Skills",
  "sub": "Mastery",
  "tag": "Talent",
  "axis": "patience",
  "test": null
 },
 {
  "id": "feed-f01",
  "surface": "feed",
  "seq": 0,
  "type": "duel",
  "domain": null,
  "prompt": "The better night in front of the TV?",
  "options": [
   "Champions League final",
   "Super Bowl"
  ],
  "topic": "sport",
  "axis": null,
  "test": null,
  "bg": "The Super Bowl has crowned American football's champion since 1967, one winner-take-all night; the Champions League final has crowned Europe's top club side in a lineage running back to 1956.",
  "core": true
 },
 {
  "id": "feed-f02",
  "surface": "feed",
  "seq": 1,
  "type": "vote",
  "domain": null,
  "prompt": "Would you rather win…",
  "options": [
   "Olympic gold",
   "The World Cup"
  ],
  "topic": "sport",
  "axis": null,
  "test": null,
  "bg": "Olympic gold arrives once every four years across dozens of sports; football's World Cup, also quadrennial, draws the largest audience of any single sporting event on earth.",
  "core": true
 },
 {
  "id": "feed-f03",
  "surface": "feed",
  "seq": 2,
  "type": "rank",
  "domain": null,
  "prompt": "Pure athleticism — rank them",
  "options": [
   "Gymnasts",
   "Sprinters",
   "Swimmers",
   "Climbers"
  ],
  "topic": "sport",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-f04",
  "surface": "feed",
  "seq": 3,
  "type": "vote",
  "domain": null,
  "prompt": "VAR made football better.",
  "options": [
   "Better",
   "Worse"
  ],
  "topic": "sport",
  "axis": null,
  "test": null,
  "bg": "Video assistant referees review four things only: goals, penalties, red cards and mistaken identity. Introduced at the 2018 World Cup and in the Premier League from 2019.",
  "core": true
 },
 {
  "id": "feed-f05",
  "surface": "feed",
  "seq": 4,
  "type": "vote",
  "domain": null,
  "prompt": "Best sport to watch live in a stadium",
  "options": [
   "Football",
   "Basketball",
   "Tennis"
  ],
  "topic": "sport",
  "axis": null,
  "test": null,
  "core": true
 },
 {
  "id": "feed-f06",
  "surface": "feed",
  "seq": 5,
  "type": "vote",
  "domain": null,
  "prompt": "E-sports are real sports.",
  "options": [
   "They are",
   "They’re not"
  ],
  "topic": "sport",
  "axis": null,
  "test": null,
  "also": [
   "tech"
  ],
  "bg": "E-sports were a medal event at the 2022 Asian Games, and the IOC has run separate Olympic Esports events since 2021 without adding them to the Olympic programme.",
  "core": true
 },
 {
  "id": "feed-f07",
  "surface": "feed",
  "seq": 6,
  "type": "vote",
  "domain": null,
  "prompt": "Your team wins it all — but you can never watch them again. Deal?",
  "options": [
   "Take it",
   "Never"
  ],
  "topic": "sport",
  "axis": null,
  "test": null,
  "also": [
   "dilemma"
  ],
  "core": true
 },
 {
  "id": "feed-f08",
  "surface": "feed",
  "seq": 7,
  "type": "duel",
  "domain": null,
  "prompt": "One cuisine forever",
  "options": [
   "Italian",
   "Japanese"
  ],
  "topic": "food",
  "axis": null,
  "test": null,
  "core": true,
  "active": false
 },
 {
  "id": "feed-f09",
  "surface": "feed",
  "seq": 8,
  "type": "vote",
  "domain": null,
  "prompt": "Milk before cereal is a crime.",
  "options": [
   "A crime",
   "It’s fine"
  ],
  "topic": "food",
  "axis": null,
  "test": null,
  "core": true
 },
 {
  "id": "feed-f10",
  "surface": "feed",
  "seq": 9,
  "type": "rank",
  "domain": null,
  "prompt": "Rank the potato formats",
  "options": [
   "Fries",
   "Roasted",
   "Mashed",
   "Crisps"
  ],
  "topic": "food",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-f11",
  "surface": "feed",
  "seq": 10,
  "type": "vote",
  "domain": null,
  "prompt": "Would you eat lab-grown meat?",
  "options": [
   "Sure",
   "Never"
  ],
  "topic": "food",
  "axis": null,
  "test": null,
  "also": [
   "tech"
  ],
  "bg": "Cultivated meat is grown from animal cells in a tank, with no slaughter. Singapore approved sale in 2020 and the US in 2023; volumes are tiny and costs still far above farmed meat.",
  "core": true
 },
 {
  "id": "feed-f12",
  "surface": "feed",
  "seq": 11,
  "type": "vote",
  "domain": null,
  "prompt": "A free pill replaces all meals. Food becomes hobby-only. Take it?",
  "options": [
   "Take it",
   "Keep meals"
  ],
  "topic": "food",
  "axis": null,
  "test": null,
  "also": [
   "dilemma"
  ],
  "core": true
 },
 {
  "id": "feed-f13",
  "surface": "feed",
  "seq": 12,
  "type": "duel",
  "domain": null,
  "prompt": "Final dessert on earth",
  "options": [
   "Tiramisu",
   "Cheesecake"
  ],
  "topic": "food",
  "axis": null,
  "test": null,
  "core": true
 },
 {
  "id": "feed-f14",
  "surface": "feed",
  "seq": 13,
  "type": "vote",
  "domain": null,
  "prompt": "Spicy food: worth the pain?",
  "options": [
   "Always",
   "No pain please"
  ],
  "topic": "food",
  "axis": null,
  "test": null,
  "core": true
 },
 {
  "id": "feed-f15",
  "surface": "feed",
  "seq": 14,
  "type": "vote",
  "domain": null,
  "prompt": "The book is always better.",
  "options": [
   "Always",
   "Not always"
  ],
  "topic": "movies",
  "axis": null,
  "test": null,
  "core": true
 },
 {
  "id": "feed-f16",
  "surface": "feed",
  "seq": 15,
  "type": "rank",
  "domain": null,
  "prompt": "Rank by rewatchability",
  "options": [
   "Comedies",
   "Thrillers",
   "Sci-fi",
   "Documentaries"
  ],
  "topic": "movies",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-f17",
  "surface": "feed",
  "seq": 16,
  "type": "duel",
  "domain": null,
  "prompt": "One world to live in",
  "options": [
   "Space opera",
   "Cozy fantasy"
  ],
  "topic": "movies",
  "axis": null,
  "test": null,
  "core": true
 },
 {
  "id": "feed-f18",
  "surface": "feed",
  "seq": 17,
  "type": "vote",
  "domain": null,
  "prompt": "Watching at 1.5× speed is disrespectful.",
  "options": [
   "Disrespectful",
   "Efficient"
  ],
  "topic": "movies",
  "axis": null,
  "test": null,
  "also": [
   "culture"
  ],
  "core": true
 },
 {
  "id": "feed-f19",
  "surface": "feed",
  "seq": 18,
  "type": "vote",
  "domain": null,
  "prompt": "The ideal movie length",
  "options": [
   "90 minutes",
   "Two hours",
   "Three-hour epic"
  ],
  "topic": "movies",
  "axis": null,
  "test": null,
  "core": true
 },
 {
  "id": "feed-f20",
  "surface": "feed",
  "seq": 19,
  "type": "vote",
  "domain": null,
  "prompt": "Spoilers ruin nothing for a good story.",
  "options": [
   "True",
   "Heresy"
  ],
  "topic": "movies",
  "axis": null,
  "test": null,
  "bg": "A 2011 University of California study had people read short stories with and without the ending revealed first — the 'spoiled' readers rated the stories slightly higher on average.",
  "core": true,
  "active": false
 },
 {
  "id": "feed-f21",
  "surface": "feed",
  "seq": 20,
  "type": "vote",
  "domain": null,
  "prompt": "Great lyrics or great melody?",
  "options": [
   "Lyrics",
   "Melody"
  ],
  "topic": "music",
  "axis": null,
  "test": null,
  "core": true,
  "active": false
 },
 {
  "id": "feed-f22",
  "surface": "feed",
  "seq": 21,
  "type": "rank",
  "domain": null,
  "prompt": "Rank the live music",
  "options": [
   "Stadium show",
   "Festival",
   "Small club",
   "Living-room gig"
  ],
  "topic": "music",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-f23",
  "surface": "feed",
  "seq": 22,
  "type": "vote",
  "domain": null,
  "prompt": "Vinyl actually sounds better.",
  "options": [
   "It does",
   "It’s the ritual"
  ],
  "topic": "music",
  "axis": null,
  "test": null,
  "also": [
   "tech"
  ],
  "bg": "Vinyl is analogue: a continuous groove, with surface noise and less dynamic range than digital. Most records since the 1990s are cut from digital masters, so differences owe as much to mastering as to format.",
  "core": true
 },
 {
  "id": "feed-f24",
  "surface": "feed",
  "seq": 23,
  "type": "vote",
  "domain": null,
  "prompt": "Music while working?",
  "options": [
   "Always",
   "Instrumental only",
   "Silence"
  ],
  "topic": "music",
  "axis": null,
  "test": null,
  "core": true,
  "active": false
 },
 {
  "id": "feed-f25",
  "surface": "feed",
  "seq": 24,
  "type": "duel",
  "domain": null,
  "prompt": "One decade of music forever",
  "options": [
   "The 70s",
   "The 2000s"
  ],
  "topic": "music",
  "axis": null,
  "test": null,
  "core": true
 },
 {
  "id": "feed-f26",
  "surface": "feed",
  "seq": 25,
  "type": "vote",
  "domain": null,
  "prompt": "Brain-computer interface, once it’s proven safe?",
  "options": [
   "Plug me in",
   "Absolutely not"
  ],
  "topic": "tech",
  "axis": null,
  "test": null,
  "bg": "Brain-computer interfaces read neural signals through implanted electrodes. Trial participants with paralysis have moved cursors and robotic arms and produced speech. The implants require brain surgery and remain research, not products.",
  "core": true
 },
 {
  "id": "feed-f27",
  "surface": "feed",
  "seq": 26,
  "type": "vote",
  "domain": null,
  "prompt": "Phones should be banned in schools.",
  "options": [
   "Ban them",
   "Teach with them"
  ],
  "topic": "tech",
  "axis": null,
  "test": null,
  "also": [
   "event"
  ],
  "bg": "Several countries have restricted phones in schools nationally, others leave it to each school. Studies point both ways: less distraction, but also fewer chances to teach digital habits.",
  "core": true
 },
 {
  "id": "feed-f28",
  "surface": "feed",
  "seq": 27,
  "type": "rank",
  "domain": null,
  "prompt": "Which would you give up last?",
  "options": [
   "Messaging",
   "Maps",
   "Music streaming",
   "Social feeds"
  ],
  "topic": "tech",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-f29",
  "surface": "feed",
  "seq": 28,
  "type": "vote",
  "domain": null,
  "prompt": "Delete all your data and start clean, or keep everything forever?",
  "options": [
   "Clean slate",
   "Keep it all"
  ],
  "topic": "tech",
  "axis": null,
  "test": null,
  "also": [
   "dilemma"
  ],
  "core": true
 },
 {
  "id": "feed-f30",
  "surface": "feed",
  "seq": 29,
  "type": "vote",
  "domain": null,
  "prompt": "A robot does your chores but records everything. Deal?",
  "options": [
   "Deal",
   "No deal"
  ],
  "topic": "tech",
  "axis": null,
  "test": null,
  "also": [
   "dilemma"
  ],
  "core": true
 },
 {
  "id": "feed-f31",
  "surface": "feed",
  "seq": 30,
  "type": "vote",
  "domain": null,
  "prompt": "Would you ride a driverless taxi tonight?",
  "options": [
   "Get in",
   "Not yet"
  ],
  "topic": "tech",
  "axis": null,
  "test": null,
  "bg": "Driverless taxis carry paying passengers in a handful of cities, with remote operators on standby. They are cleared only inside mapped service areas, and are pulled after incidents.",
  "core": true
 },
 {
  "id": "feed-f32",
  "surface": "feed",
  "seq": 31,
  "type": "vote",
  "domain": null,
  "prompt": "Tipping should be abolished.",
  "options": [
   "Abolish it",
   "Keep it"
  ],
  "topic": "culture",
  "axis": null,
  "test": null,
  "also": [
   "event"
  ],
  "bg": "US federal law lets employers pay tipped staff as little as $2.13 an hour if tips make up the rest. In much of Europe and Japan, service is included in the listed price.",
  "core": true
 },
 {
  "id": "feed-f33",
  "surface": "feed",
  "seq": 32,
  "type": "vote",
  "domain": null,
  "prompt": "Ten minutes early or exactly on time?",
  "options": [
   "Early",
   "On the dot"
  ],
  "topic": "culture",
  "axis": null,
  "test": null,
  "core": true
 },
 {
  "id": "feed-f34",
  "surface": "feed",
  "seq": 33,
  "type": "rank",
  "domain": null,
  "prompt": "Rank the perfect weekend",
  "options": [
   "Slow morning",
   "Big night out",
   "Day trip",
   "Full-reset clean"
  ],
  "topic": "culture",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-f35",
  "surface": "feed",
  "seq": 34,
  "type": "vote",
  "domain": null,
  "prompt": "The best age to be",
  "options": [
   "18",
   "30",
   "50",
   "75"
  ],
  "topic": "culture",
  "axis": null,
  "test": null,
  "core": true
 },
 {
  "id": "feed-f36",
  "surface": "feed",
  "seq": 35,
  "type": "duel",
  "domain": null,
  "prompt": "The view from your window, forever",
  "options": [
   "Ocean",
   "Mountains"
  ],
  "topic": "culture",
  "axis": null,
  "test": null,
  "core": true
 },
 {
  "id": "feed-f37",
  "surface": "feed",
  "seq": 36,
  "type": "vote",
  "domain": null,
  "prompt": "Small talk is a skill, not a chore.",
  "options": [
   "A skill",
   "A chore"
  ],
  "topic": "culture",
  "axis": null,
  "test": null,
  "core": true
 },
 {
  "id": "feed-f38",
  "surface": "feed",
  "seq": 37,
  "type": "vote",
  "domain": null,
  "prompt": "Read minds — but everyone knows you can. Take it?",
  "options": [
   "Take it",
   "Pass"
  ],
  "topic": "dilemma",
  "axis": null,
  "test": null,
  "core": true
 },
 {
  "id": "feed-f39",
  "surface": "feed",
  "seq": 38,
  "type": "vote",
  "domain": null,
  "prompt": "A million now, but a stranger somewhere loses everything. Press the button?",
  "options": [
   "Press",
   "Never"
  ],
  "topic": "dilemma",
  "axis": null,
  "test": null,
  "core": true
 },
 {
  "id": "feed-f40",
  "surface": "feed",
  "seq": 39,
  "type": "vote",
  "domain": null,
  "prompt": "Would you want to know the date of your death?",
  "options": [
   "Tell me",
   "Never"
  ],
  "topic": "dilemma",
  "axis": null,
  "test": null,
  "core": true,
  "active": false
 },
 {
  "id": "feed-f41",
  "surface": "feed",
  "seq": 40,
  "type": "vote",
  "domain": null,
  "prompt": "Five years in a job you hate, then never work again?",
  "options": [
   "Take the deal",
   "Keep working"
  ],
  "topic": "dilemma",
  "axis": null,
  "test": null,
  "core": true
 },
 {
  "id": "feed-f42",
  "surface": "feed",
  "seq": 41,
  "type": "vote",
  "domain": null,
  "prompt": "Restart life at 10, everything you know intact?",
  "options": [
   "Restart",
   "Stay here"
  ],
  "topic": "dilemma",
  "axis": null,
  "test": null,
  "core": true
 },
 {
  "id": "feed-f43",
  "surface": "feed",
  "seq": 42,
  "type": "vote",
  "domain": null,
  "prompt": "Perfect memory — but you can never forget anything. Take it?",
  "options": [
   "Take it",
   "Keep forgetting"
  ],
  "topic": "dilemma",
  "axis": null,
  "test": null,
  "core": true
 },
 {
  "id": "feed-f44",
  "surface": "feed",
  "seq": 43,
  "type": "vote",
  "domain": null,
  "prompt": "Your dog talks for one day, or understands you forever?",
  "options": [
   "Talks one day",
   "Understands forever"
  ],
  "topic": "dilemma",
  "axis": null,
  "test": null,
  "core": true
 },
 {
  "id": "feed-f45",
  "surface": "feed",
  "seq": 44,
  "type": "vote",
  "domain": null,
  "prompt": "Should voting be mandatory?",
  "options": [
   "Mandatory",
   "A right, not a duty"
  ],
  "topic": "event",
  "axis": null,
  "test": null,
  "bg": "About two dozen countries require voting, and roughly half of those enforce it — Australia and Belgium fine non-voters. Turnout in those countries runs far above comparable voluntary systems.",
  "core": true,
  "political": true
 },
 {
  "id": "feed-f46",
  "surface": "feed",
  "seq": 45,
  "type": "vote",
  "domain": null,
  "prompt": "Four-day work week: inevitable or fantasy?",
  "options": [
   "Inevitable",
   "Fantasy"
  ],
  "topic": "event",
  "axis": null,
  "test": null,
  "bg": "Trials in Iceland, the UK and elsewhere cut hours with no cut in pay. Most reported steady output and lower burnout; the trials were small, and mostly office work.",
  "core": true,
  "political": true
 },
 {
  "id": "feed-f47",
  "surface": "feed",
  "seq": 46,
  "type": "vote",
  "domain": null,
  "prompt": "City centers should be car-free.",
  "options": [
   "Car-free",
   "Keep cars"
  ],
  "topic": "event",
  "axis": null,
  "test": null,
  "bg": "Pontevedra, Ghent and Oslo among others have closed their centres to most cars, with permits for residents and deliveries. Measured effects: less traffic and cleaner air, and disputes over shop takings.",
  "core": true,
  "political": true
 },
 {
  "id": "feed-f48",
  "surface": "feed",
  "seq": 47,
  "type": "vote",
  "domain": null,
  "prompt": "Would you move to another country for good?",
  "options": [
   "I’d go",
   "Home is home"
  ],
  "topic": "event",
  "axis": null,
  "test": null,
  "core": true
 },
 {
  "id": "feed-f49",
  "surface": "feed",
  "seq": 48,
  "type": "vote",
  "domain": null,
  "prompt": "Judge the art apart from the artist?",
  "options": [
   "Separate them",
   "Can’t separate"
  ],
  "topic": "people",
  "axis": null,
  "test": null,
  "core": true
 },
 {
  "id": "feed-f50",
  "surface": "feed",
  "seq": 49,
  "type": "vote",
  "domain": null,
  "prompt": "Celebrities should stay out of politics.",
  "options": [
   "Stay out",
   "Speak up"
  ],
  "topic": "people",
  "axis": null,
  "test": null,
  "core": true
 },
 {
  "id": "feed-f51",
  "surface": "feed",
  "seq": 50,
  "type": "vote",
  "domain": null,
  "prompt": "Dinner with one",
  "options": [
   "A scientist you admire",
   "A musician you love",
   "A leader you’d grill"
  ],
  "topic": "people",
  "axis": null,
  "test": null,
  "core": true
 },
 {
  "id": "feed-f52",
  "surface": "feed",
  "seq": 51,
  "type": "vote",
  "domain": null,
  "prompt": "Free will is an illusion.",
  "options": [
   "An illusion",
   "It’s real"
  ],
  "topic": "bigq",
  "axis": null,
  "test": null,
  "bg": "Determinism holds that every choice follows from prior causes; compatibilism holds that free will can still be real in such a world. Brain studies find activity preceding a reported decision, which both camps read differently.",
  "core": true
 },
 {
  "id": "feed-f53",
  "surface": "feed",
  "seq": 52,
  "type": "vote",
  "domain": null,
  "prompt": "We’re not alone in the universe.",
  "options": [
   "Not alone",
   "Just us"
  ],
  "topic": "bigq",
  "axis": null,
  "test": null,
  "bg": "Astronomers have confirmed nearly 6,000 planets around other stars, several of them potentially temperate. No evidence of life beyond Earth has been found, and no candidate signal has survived follow-up checks.",
  "core": true
 },
 {
  "id": "feed-f54",
  "surface": "feed",
  "seq": 53,
  "type": "vote",
  "domain": null,
  "prompt": "Money can buy happiness.",
  "options": [
   "It can",
   "It can’t"
  ],
  "topic": "bigq",
  "axis": null,
  "test": null,
  "bg": "Studies track income against self-reported wellbeing. A 2010 study found happiness flattening above a middle income; a 2021 one found it still rising slowly at high incomes. Both rest on people rating their own lives.",
  "core": true,
  "active": false
 },
 {
  "id": "feed-f55",
  "surface": "feed",
  "seq": 54,
  "type": "vote",
  "domain": null,
  "prompt": "Humanity’s best days are ahead.",
  "options": [
   "Ahead",
   "Behind"
  ],
  "topic": "bigq",
  "axis": null,
  "test": null,
  "core": true
 },
 {
  "id": "feed-f56",
  "surface": "feed",
  "seq": 55,
  "type": "rank",
  "domain": null,
  "prompt": "What matters most — rank them",
  "options": [
   "People",
   "Meaning",
   "Pleasure",
   "Legacy"
  ],
  "topic": "bigq",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-s01",
  "surface": "feed",
  "seq": 56,
  "type": "vote",
  "domain": null,
  "prompt": "Doubles or singles?",
  "options": [
   "Doubles",
   "Singles"
  ],
  "topic": "sport",
  "axis": null,
  "test": null,
  "core": true
 },
 {
  "id": "feed-s02",
  "surface": "feed",
  "seq": 57,
  "type": "vote",
  "domain": null,
  "prompt": "Pick your surface",
  "options": [
   "Clay",
   "Grass",
   "Hard court"
  ],
  "topic": "sport",
  "axis": null,
  "test": null,
  "core": true
 },
 {
  "id": "feed-s03",
  "surface": "feed",
  "seq": 58,
  "type": "vote",
  "domain": null,
  "prompt": "Line judges or full electronic calls?",
  "options": [
   "Keep humans",
   "All electronic"
  ],
  "topic": "sport",
  "axis": null,
  "test": null,
  "bg": "Electronic line calling uses ball-tracking cameras and a recorded voice instead of line judges. The tour has moved towards it since 2020; some events now have no line judges at all.",
  "core": true
 },
 {
  "id": "feed-s04",
  "surface": "feed",
  "seq": 59,
  "type": "vote",
  "domain": null,
  "prompt": "Cold water: wetsuit or skin?",
  "options": [
   "Wetsuit",
   "Skin"
  ],
  "topic": "sport",
  "axis": null,
  "test": null,
  "bg": "Open-water rules commonly mandate wetsuits in cold water and forbid them in warm — World Triathlon draws its lines around 16°C and the low twenties. Ice swimmers race skin in water near freezing.",
  "core": true
 },
 {
  "id": "feed-s05",
  "surface": "feed",
  "seq": 60,
  "type": "rank",
  "domain": null,
  "prompt": "Rank the strokes",
  "options": [
   "Freestyle",
   "Breaststroke",
   "Backstroke",
   "Butterfly"
  ],
  "topic": "sport",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-s06",
  "surface": "feed",
  "seq": 61,
  "type": "vote",
  "domain": null,
  "prompt": "Pool or open water?",
  "options": [
   "Pool",
   "Open water"
  ],
  "topic": "sport",
  "axis": null,
  "test": null,
  "core": true
 },
 {
  "id": "feed-s07",
  "surface": "feed",
  "seq": 62,
  "type": "vote",
  "domain": null,
  "prompt": "First drafts: longhand or keyboard?",
  "options": [
   "Longhand",
   "Keyboard"
  ],
  "topic": "culture",
  "axis": null,
  "test": null,
  "core": true
 },
 {
  "id": "feed-s08",
  "surface": "feed",
  "seq": 63,
  "type": "vote",
  "domain": null,
  "prompt": "Plot it all, or find it as you write?",
  "options": [
   "Plot it",
   "Find it"
  ],
  "topic": "culture",
  "axis": null,
  "test": null,
  "core": true
 },
 {
  "id": "feed-s09",
  "surface": "feed",
  "seq": 64,
  "type": "vote",
  "domain": null,
  "prompt": "Can great writing be taught?",
  "options": [
   "Taught",
   "Only sharpened"
  ],
  "topic": "culture",
  "axis": null,
  "test": null,
  "core": true
 },
 {
  "id": "feed-s10",
  "surface": "feed",
  "seq": 65,
  "type": "vote",
  "domain": null,
  "prompt": "The Ship of Theseus, fully replaced — same ship?",
  "options": [
   "Same ship",
   "A new ship"
  ],
  "topic": "bigq",
  "axis": null,
  "test": null,
  "bg": "A ship has every plank replaced, one at a time. The puzzle is attributed to Plutarch, writing on the ship of Theseus kept in Athens; it tests what makes a thing the same thing over time.",
  "core": true
 },
 {
  "id": "feed-s11",
  "surface": "feed",
  "seq": 66,
  "type": "vote",
  "domain": null,
  "prompt": "Is morality discovered or invented?",
  "options": [
   "Discovered",
   "Invented"
  ],
  "topic": "bigq",
  "axis": null,
  "test": null,
  "bg": "Philosophers call the two positions moral realism — moral facts exist and are found — and anti-realism, where morality is something humans construct. Both have serious defenders; neither is settled.",
  "core": true
 },
 {
  "id": "feed-s12",
  "surface": "feed",
  "seq": 67,
  "type": "vote",
  "domain": null,
  "prompt": "A perfectly happy simulated life — plug in?",
  "options": [
   "Plug in",
   "Stay real"
  ],
  "topic": "bigq",
  "axis": null,
  "test": null,
  "core": true
 },
 {
  "id": "feed-s13",
  "surface": "feed",
  "seq": 68,
  "type": "vote",
  "domain": null,
  "prompt": "Blitz or classical?",
  "options": [
   "Blitz",
   "Classical"
  ],
  "topic": "culture",
  "axis": null,
  "test": null,
  "bg": "Chess time controls: blitz gives each player 3–5 minutes for the whole game, rapid 10–60, classical 90 minutes or more plus added time. Ratings are kept separately for each.",
  "core": true
 },
 {
  "id": "feed-s14",
  "surface": "feed",
  "seq": 69,
  "type": "vote",
  "domain": null,
  "prompt": "Best first move",
  "options": [
   "e4",
   "d4",
   "Something weird"
  ],
  "topic": "culture",
  "axis": null,
  "test": null,
  "core": true
 },
 {
  "id": "feed-s15",
  "surface": "feed",
  "seq": 70,
  "type": "vote",
  "domain": null,
  "prompt": "A draw offer from a stronger player — take it?",
  "options": [
   "Take it",
   "Play on"
  ],
  "topic": "culture",
  "axis": null,
  "test": null,
  "core": true
 },
 {
  "id": "feed-s16",
  "surface": "feed",
  "seq": 71,
  "type": "vote",
  "domain": null,
  "prompt": "Your sourdough starter deserves a name.",
  "options": [
   "Named, obviously",
   "It’s yeast"
  ],
  "topic": "food",
  "axis": null,
  "test": null,
  "core": true
 },
 {
  "id": "feed-s17",
  "surface": "feed",
  "seq": 72,
  "type": "vote",
  "domain": null,
  "prompt": "Kombucha or kefir?",
  "options": [
   "Kombucha",
   "Kefir"
  ],
  "topic": "food",
  "axis": null,
  "test": null,
  "bg": "Both are fermented drinks: kombucha is sweetened tea fermented by a bacteria-and-yeast culture; kefir is milk or water fermented by kefir grains. Kefir carries more microbial strains, kombucha more acid.",
  "core": true
 },
 {
  "id": "feed-dl1",
  "surface": "feed",
  "seq": 73,
  "type": "dial",
  "domain": null,
  "prompt": "When does old age begin?",
  "options": [
   "40–44 yrs",
   "44–48 yrs",
   "48–53 yrs",
   "53–57 yrs",
   "57–61 yrs",
   "61–65 yrs",
   "65–69 yrs",
   "69–73 yrs",
   "73–78 yrs",
   "78–82 yrs",
   "82–86 yrs",
   "86–90 yrs"
  ],
  "topic": "bigq",
  "axis": null,
  "test": null,
  "lo": 40,
  "hi": 90,
  "unit": "yrs",
  "bg": "Global life expectancy at birth was around 31 in 1900 and is past 73 today. The UN's statistics count 'older persons' from 65; gerontologists increasingly split young-old from old-old at 75.",
  "core": true
 },
 {
  "id": "feed-dl2",
  "surface": "feed",
  "seq": 74,
  "type": "dial",
  "domain": null,
  "prompt": "The right tip",
  "options": [
   "0–3%",
   "3–5%",
   "5–8%",
   "8–10%",
   "10–13%",
   "13–15%",
   "15–18%",
   "18–20%",
   "20–23%",
   "23–25%",
   "25–28%",
   "28–30%"
  ],
  "topic": "dilemma",
  "axis": null,
  "test": null,
  "also": [
   "culture"
  ],
  "lo": 0,
  "hi": 30,
  "unit": "%",
  "core": true
 },
 {
  "id": "feed-dl3",
  "surface": "feed",
  "seq": 75,
  "type": "dial",
  "domain": null,
  "prompt": "Daily screen time — where does “too much” start?",
  "options": [
   "1–2 h",
   "2–3 h",
   "3–4 h",
   "4–5 h",
   "5–6 h",
   "6–7 h",
   "7–7 h",
   "7–8 h",
   "8–9 h",
   "9–10 h",
   "10–11 h",
   "11–12 h"
  ],
  "topic": "dilemma",
  "axis": null,
  "test": null,
  "also": [
   "tech"
  ],
  "lo": 1,
  "hi": 12,
  "unit": "h",
  "bg": "Surveys put worldwide daily screen time near seven hours, work included. Formal guidance exists mainly for children — the WHO advises essentially none before age two.",
  "core": true,
  "active": false
 },
 {
  "id": "feed-dl4",
  "surface": "feed",
  "seq": 76,
  "type": "dial",
  "domain": null,
  "prompt": "How much of your life is actually in your control?",
  "options": [
   "0–8%",
   "8–17%",
   "17–25%",
   "25–33%",
   "33–42%",
   "42–50%",
   "50–58%",
   "58–67%",
   "67–75%",
   "75–83%",
   "83–92%",
   "92–100%"
  ],
  "topic": "bigq",
  "axis": null,
  "test": null,
  "lo": 0,
  "hi": 100,
  "unit": "%",
  "core": true
 },
 {
  "id": "feed-fd1",
  "surface": "feed",
  "seq": 77,
  "type": "field",
  "domain": null,
  "prompt": "Pineapple on pizza — place it",
  "options": [
   "tastes bad · high art",
   "lean tastes bad · high art",
   "lean tastes good · high art",
   "tastes good · high art",
   "tastes bad · middle",
   "lean tastes bad · middle",
   "lean tastes good · middle",
   "tastes good · middle",
   "tastes bad · a crime",
   "lean tastes bad · a crime",
   "lean tastes good · a crime",
   "tastes good · a crime"
  ],
  "topic": "dilemma",
  "axis": null,
  "test": null,
  "also": [
   "food"
  ],
  "ax": [
   "tastes bad",
   "tastes good"
  ],
  "ay": [
   "a crime",
   "high art"
  ],
  "core": true
 },
 {
  "id": "feed-fd2",
  "surface": "feed",
  "seq": 78,
  "type": "field",
  "domain": null,
  "prompt": "Small talk — place it",
  "options": [
   "painful · essential",
   "lean painful · essential",
   "lean pleasant · essential",
   "pleasant · essential",
   "painful · middle",
   "lean painful · middle",
   "lean pleasant · middle",
   "pleasant · middle",
   "painful · pointless",
   "lean painful · pointless",
   "lean pleasant · pointless",
   "pleasant · pointless"
  ],
  "topic": "bigq",
  "axis": null,
  "test": null,
  "also": [
   "culture"
  ],
  "ax": [
   "painful",
   "pleasant"
  ],
  "ay": [
   "pointless",
   "essential"
  ],
  "core": true
 },
 {
  "id": "feed-fd3",
  "surface": "feed",
  "seq": 79,
  "type": "field",
  "domain": null,
  "prompt": "AI assistants, today — place them",
  "options": [
   "overhyped · exciting",
   "lean overhyped · exciting",
   "lean underrated · exciting",
   "underrated · exciting",
   "overhyped · middle",
   "lean overhyped · middle",
   "lean underrated · middle",
   "underrated · middle",
   "overhyped · scary",
   "lean overhyped · scary",
   "lean underrated · scary",
   "underrated · scary"
  ],
  "topic": "bigq",
  "axis": null,
  "test": null,
  "also": [
   "tech"
  ],
  "ax": [
   "overhyped",
   "underrated"
  ],
  "ay": [
   "scary",
   "exciting"
  ],
  "core": true
 },
 {
  "id": "feed-pt1",
  "surface": "feed",
  "seq": 80,
  "type": "path",
  "domain": null,
  "prompt": "The Wallet — a wallet, a bus, and nobody watching",
  "options": [
   "The Quiet Good",
   "The Honest Trade",
   "The Long Way Round",
   "Finders, Keepers",
   "The Doorstep",
   "By the Book",
   "The Second Chance",
   "Not My Story"
  ],
  "topic": "dilemma",
  "axis": null,
  "test": null,
  "core": true,
  "title": "The Wallet",
  "intro": "The last bus home. On the seat beside you: a wallet, fat with cash. No cameras. No one else aboard.",
  "hue": 20,
  "nodes": {
   "_": {
    "q": "It sits there, heavier than it should be.",
    "a": [
     {
      "t": "Open it"
     },
     {
      "t": "Hand it to the driver, unopened"
     }
    ]
   },
   "A": {
    "q": "A student ID. 4,000 in cash. A clinic appointment slip for Thursday.",
    "a": [
     {
      "t": "Track them down yourself"
     },
     {
      "t": "Keep the cash, mail the rest back"
     }
    ]
   },
   "B": {
    "q": "The driver shrugs without looking. \"Lost box is broken. Your call, friend.\"",
    "a": [
     {
      "t": "Take it back — handle it yourself"
     },
     {
      "t": "Leave it on the seat"
     }
    ]
   },
   "AA": {
    "q": "You find them in an hour online. They answer, voice shaking with relief — and offer a reward.",
    "a": [
     {
      "t": "Refuse the reward"
     },
     {
      "t": "Take it — fair is fair"
     }
    ]
   },
   "AB": {
    "q": "A week passes. The clinic slip keeps surfacing in your mind like a splinter.",
    "a": [
     {
      "t": "Mail the cash after all"
     },
     {
      "t": "Spend it"
     }
    ]
   },
   "BA": {
    "q": "The ID shows an address two streets from yours. Thursday is tomorrow.",
    "a": [
     {
      "t": "The doorstep, in person"
     },
     {
      "t": "The police station drop-box"
     }
    ]
   },
   "BB": {
    "q": "The doors hiss shut. Through the window you watch the wallet ride away.",
    "a": [
     {
      "t": "Chase the bus to the next stop"
     },
     {
      "t": "Walk home"
     }
    ]
   }
  },
  "endings": {
   "AAA": {
    "name": "The Quiet Good",
    "line": "No reward, no witness. You did it for the version of you that was watching."
   },
   "AAB": {
    "name": "The Honest Trade",
    "line": "Everyone leaves whole. Virtue doesn’t have to be free."
   },
   "ABA": {
    "name": "The Long Way Round",
    "line": "The splinter won. Later than right, but right."
   },
   "ABB": {
    "name": "Finders, Keepers",
    "line": "The money spent easily. Thursday came and went somewhere else."
   },
   "BAA": {
    "name": "The Doorstep",
    "line": "A stranger’s face, changing as they understand. Worth the walk."
   },
   "BAB": {
    "name": "By the Book",
    "line": "Clean hands, proper channels. The story ends without your name in it."
   },
   "BBA": {
    "name": "The Second Chance",
    "line": "Lungs burning at the next stop. Some choices allow one revision."
   },
   "BBB": {
    "name": "Not My Story",
    "line": "You never found out. That was the choice, too."
   }
  }
 },
 {
  "id": "feed-pt2",
  "surface": "feed",
  "seq": 81,
  "type": "path",
  "domain": null,
  "prompt": "The Wrong Text — a message that was not meant for you",
  "options": [
   "The Renegotiator",
   "The Clean Exit",
   "The Whistle",
   "The Quiet Departure",
   "Cards on the Table",
   "The Poker Face",
   "The Better Door",
   "The Long Game"
  ],
  "topic": "dilemma",
  "axis": null,
  "test": null,
  "core": true,
  "title": "The Wrong Text",
  "intro": "Your boss texts you at 23:40: \"Offer the role to the other one. Don’t tell K yet.\" You are K.",
  "hue": 255,
  "nodes": {
   "_": {
    "q": "The message glows in the dark. Typing dots appear, then vanish.",
    "a": [
     {
      "t": "\"I think this wasn’t meant for me.\""
     },
     {
      "t": "Say nothing. Screenshot it."
     }
    ]
   },
   "A": {
    "q": "Your phone rings ten seconds later. A flustered voice offers \"a proper chat tomorrow.\"",
    "a": [
     {
      "t": "Take the chat, ask it straight"
     },
     {
      "t": "Decline — start job-hunting tonight"
     }
    ]
   },
   "B": {
    "q": "Next morning they greet you like nothing happened. The role posting closes Friday.",
    "a": [
     {
      "t": "Confront them before Friday"
     },
     {
      "t": "Quietly interview elsewhere"
     }
    ]
   },
   "AA": {
    "q": "Across the desk they don’t deny it. \"The decision wasn’t final,\" they say. It sounds final.",
    "a": [
     {
      "t": "Negotiate to stay — on new terms"
     },
     {
      "t": "Resign in the meeting"
     }
    ]
   },
   "AB": {
    "q": "Three interviews in a week. One offer arrives — smaller title, better people.",
    "a": [
     {
      "t": "Tell your team why you’re going"
     },
     {
      "t": "Ghost gracefully"
     }
    ]
   },
   "BA": {
    "q": "Thursday, empty meeting room. You have the screenshot. They have a story ready.",
    "a": [
     {
      "t": "Show the screenshot"
     },
     {
      "t": "Bluff — \"I’ve heard rumours\""
     }
    ]
   },
   "BB": {
    "q": "The rival offer lands Friday morning — same pay, a team that actually wanted you.",
    "a": [
     {
      "t": "Accept it"
     },
     {
      "t": "Stay anyway"
     }
    ]
   }
  },
  "endings": {
   "AAA": {
    "name": "The Renegotiator",
    "line": "You stayed — but the terms are yours now, and everyone knows it."
   },
   "AAB": {
    "name": "The Clean Exit",
    "line": "Shortest resignation letter in company history. No regrets by Tuesday."
   },
   "ABA": {
    "name": "The Whistle",
    "line": "The team heard the truth. Some doors close loudly and that’s fine."
   },
   "ABB": {
    "name": "The Quiet Departure",
    "line": "No scene, no speech. Your absence said it."
   },
   "BAA": {
    "name": "Cards on the Table",
    "line": "The screenshot did the talking. Their face did the confessing."
   },
   "BAB": {
    "name": "The Poker Face",
    "line": "You never showed your hand. They folded anyway."
   },
   "BBA": {
    "name": "The Better Door",
    "line": "Monday, new desk. The old boss still doesn’t know you knew."
   },
   "BBB": {
    "name": "The Long Game",
    "line": "You stayed with the receipts. Leverage keeps better than anger."
   }
  }
 },
 {
  "id": "feed-f57",
  "surface": "feed",
  "seq": 82,
  "type": "vote",
  "domain": null,
  "prompt": "ABBA or Queen?",
  "options": [
   "ABBA",
   "Queen"
  ],
  "topic": "music",
  "axis": null,
  "test": null,
  "bg": "ABBA: Swedish pop quartet, Eurovision winners in 1974, ten years together and a 2021 reunion album. Queen: British rock band fronted by Freddie Mercury, from Bohemian Rhapsody to the 1985 Live Aid set.",
  "core": true
 },
 {
  "id": "feed-f58",
  "surface": "feed",
  "seq": 83,
  "type": "vote",
  "domain": null,
  "prompt": "Who left the bigger mark: Einstein or Shakespeare?",
  "options": [
   "Einstein",
   "Shakespeare"
  ],
  "topic": "people",
  "axis": null,
  "test": null,
  "bg": "Albert Einstein rewrote physics with special and general relativity (1905, 1915) and won the 1921 Nobel Prize. William Shakespeare wrote some 37 plays and 154 sonnets that four centuries of theatre keep staging.",
  "core": true
 },
 {
  "id": "feed-dl5",
  "surface": "feed",
  "seq": 84,
  "type": "dial",
  "domain": null,
  "prompt": "How many years until a human walks on Mars?",
  "options": [
   "0–8 yrs",
   "8–17 yrs",
   "17–25 yrs",
   "25–33 yrs",
   "33–42 yrs",
   "42–50 yrs",
   "50–58 yrs",
   "58–67 yrs",
   "67–75 yrs",
   "75–83 yrs",
   "83–92 yrs",
   "92–100 yrs"
  ],
  "topic": "event",
  "axis": null,
  "test": null,
  "lo": 0,
  "hi": 100,
  "unit": "yrs",
  "bg": "Twelve people have walked on the Moon, the last in 1972, and nobody has travelled farther since. A Mars crew would spend six to nine months in transit each way; official ambitions name the 2030s at the earliest.",
  "core": true
 },
 {
  "id": "feed-f60",
  "surface": "feed",
  "seq": 85,
  "type": "vote",
  "domain": null,
  "prompt": "The right way to see a film?",
  "options": [
   "A cinema seat",
   "Your own couch"
  ],
  "topic": "movies",
  "axis": null,
  "test": null,
  "core": true
 },
 {
  "id": "feed-f61",
  "surface": "feed",
  "seq": 86,
  "type": "vote",
  "domain": null,
  "prompt": "Let AI write your texts for you?",
  "options": [
   "Sure — it saves time",
   "Never. It’s my voice"
  ],
  "topic": "tech",
  "axis": null,
  "test": null,
  "core": true
 },
 {
  "id": "feed-f62",
  "surface": "feed",
  "seq": 87,
  "type": "vote",
  "domain": null,
  "prompt": "Is a hot dog a sandwich?",
  "options": [
   "Obviously",
   "Obviously not"
  ],
  "topic": "food",
  "axis": null,
  "test": null,
  "bg": "Merriam-Webster's dictionary reckons a hot dog fits its sandwich definition — a filling between bread. The US National Hot Dog and Sausage Council formally disagrees, calling it a category of its own.",
  "core": true
 },
 {
  "id": "feed-f63",
  "surface": "feed",
  "seq": 88,
  "type": "vote",
  "domain": null,
  "prompt": "The music you loved at 15 — still good, or evidence?",
  "options": [
   "Still good",
   "Evidence"
  ],
  "topic": "music",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-f64",
  "surface": "feed",
  "seq": 89,
  "type": "vote",
  "domain": null,
  "prompt": "Marie Curie or Ada Lovelace — whose name should more kids know?",
  "options": [
   "Marie Curie",
   "Ada Lovelace"
  ],
  "topic": "people",
  "axis": null,
  "test": null,
  "bg": "Marie Curie won Nobel Prizes in two different sciences for her work on radioactivity — still the only person to have done so. Ada Lovelace's 1843 notes on Babbage's Analytical Engine contain what is widely counted the first published computer program."
 },
 {
  "id": "feed-f65",
  "surface": "feed",
  "seq": 90,
  "type": "vote",
  "domain": null,
  "prompt": "Subtitles on, even in your own language?",
  "options": [
   "Always on",
   "Only when I need them"
  ],
  "topic": "movies",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-f66",
  "surface": "feed",
  "seq": 91,
  "type": "vote",
  "domain": null,
  "prompt": "Should social media have a minimum age of 16?",
  "options": [
   "Yes, 16",
   "Parents decide"
  ],
  "topic": "event",
  "axis": null,
  "test": null,
  "bg": "Australia legislated a minimum age of 16 for social media accounts in 2024, the first country to do so. The usual platform minimum of 13 traces to a 1998 US children's-privacy law.",
  "political": true
 },
 {
  "id": "feed-f67",
  "surface": "feed",
  "seq": 92,
  "type": "vote",
  "domain": null,
  "prompt": "Breakfast: the same thing every day, or never the same?",
  "options": [
   "Same every day",
   "Never the same"
  ],
  "topic": "food",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-dl6",
  "surface": "feed",
  "seq": 93,
  "type": "dial",
  "domain": null,
  "prompt": "At what age is an athlete past their peak?",
  "options": [
   "25–27 yrs",
   "27–28 yrs",
   "28–30 yrs",
   "30–32 yrs",
   "32–33 yrs",
   "33–35 yrs",
   "35–37 yrs",
   "37–38 yrs",
   "38–40 yrs",
   "40–42 yrs",
   "42–43 yrs",
   "43–45 yrs"
  ],
  "topic": "sport",
  "axis": null,
  "test": null,
  "lo": 25,
  "hi": 45,
  "unit": "yrs",
  "bg": "Sports science places most athletic peaks between 25 and 30 — sprinters earlier, endurance athletes and goalkeepers later. Tom Brady won a Super Bowl at 43; gymnasts have won world titles at 16.",
  "active": false
 },
 {
  "id": "feed-f68",
  "surface": "feed",
  "seq": 94,
  "type": "vote",
  "domain": null,
  "prompt": "Mozart or Beethoven?",
  "options": [
   "Mozart",
   "Beethoven"
  ],
  "topic": "music",
  "axis": null,
  "test": null,
  "bg": "Mozart (1756–1791) wrote more than 600 works — operas, symphonies, the unfinished Requiem — in a 35-year life. Beethoven (1770–1827) bridged the classical and romantic eras and composed his late masterpieces, the Ninth Symphony among them, after going deaf."
 },
 {
  "id": "feed-f69",
  "surface": "feed",
  "seq": 95,
  "type": "vote",
  "domain": null,
  "prompt": "Would you take fame, if it were offered?",
  "options": [
   "Take it",
   "No thanks"
  ],
  "topic": "people",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-f70",
  "surface": "feed",
  "seq": 96,
  "type": "vote",
  "domain": null,
  "prompt": "The best seat in the cinema?",
  "options": [
   "Front row",
   "Middle of the middle",
   "Back corner",
   "On the aisle"
  ],
  "topic": "movies",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-f71",
  "surface": "feed",
  "seq": 97,
  "type": "vote",
  "domain": null,
  "prompt": "Should the Olympics settle in one permanent home?",
  "options": [
   "One home",
   "Keep it moving"
  ],
  "topic": "event",
  "axis": null,
  "test": null,
  "bg": "The modern Games have rotated hosts since 1896. Recent editions have run billions over budget, and a fixed site — Athens is the perennial candidate — gets proposed after nearly every expensive Games."
 },
 {
  "id": "feed-dl7",
  "surface": "feed",
  "seq": 98,
  "type": "dial",
  "domain": null,
  "prompt": "How many coffees a day is too many?",
  "options": [
   "1–2 cups",
   "2–3 cups",
   "3–3 cups",
   "3–4 cups",
   "4–5 cups",
   "5–6 cups",
   "6–6 cups",
   "6–7 cups",
   "7–8 cups",
   "8–9 cups",
   "9–9 cups",
   "9–10 cups"
  ],
  "topic": "food",
  "axis": null,
  "test": null,
  "lo": 1,
  "hi": 10,
  "unit": "cups",
  "bg": "Europe's food-safety authority puts routine caffeine intake up to 400 mg a day — roughly four to five cups of coffee — within safe limits for healthy adults, and half that in pregnancy.",
  "active": false
 },
 {
  "id": "feed-f72",
  "surface": "feed",
  "seq": 99,
  "type": "vote",
  "domain": null,
  "prompt": "Would you live forever, if you could?",
  "options": [
   "Forever, yes",
   "One life is right"
  ],
  "topic": "bigq",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-dl8",
  "surface": "feed",
  "seq": 100,
  "type": "dial",
  "domain": null,
  "prompt": "How long should a concert be?",
  "options": [
   "1–1 hrs",
   "1–2 hrs",
   "2–2 hrs",
   "2–2 hrs",
   "2–2 hrs",
   "2–3 hrs",
   "3–3 hrs",
   "3–3 hrs",
   "3–3 hrs",
   "3–4 hrs",
   "4–4 hrs",
   "4–4 hrs"
  ],
  "topic": "music",
  "axis": null,
  "test": null,
  "lo": 1,
  "hi": 4,
  "unit": "hrs",
  "active": false
 },
 {
  "id": "feed-f73",
  "surface": "feed",
  "seq": 101,
  "type": "vote",
  "domain": null,
  "prompt": "Dinner with Napoleon, or with Cleopatra?",
  "options": [
   "Napoleon",
   "Cleopatra"
  ],
  "topic": "people",
  "axis": null,
  "test": null,
  "bg": "Napoleon Bonaparte crowned himself Emperor of the French in 1804, redrew Europe's map and laws, and fell at Waterloo. Cleopatra VII ruled Egypt for two decades as its last pharaoh, allied by turns with Caesar and Mark Antony."
 },
 {
  "id": "feed-f74",
  "surface": "feed",
  "seq": 102,
  "type": "vote",
  "domain": null,
  "prompt": "Watch the trailer first, or go in blind?",
  "options": [
   "Trailer first",
   "Go in blind"
  ],
  "topic": "movies",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-f75",
  "surface": "feed",
  "seq": 103,
  "type": "vote",
  "domain": null,
  "prompt": "Election night: up late for the count, or read it in the morning?",
  "options": [
   "Up all night",
   "Morning headline"
  ],
  "topic": "event",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-f76",
  "surface": "feed",
  "seq": 104,
  "type": "vote",
  "domain": null,
  "prompt": "Cake or pie?",
  "options": [
   "Cake",
   "Pie"
  ],
  "topic": "food",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-f77",
  "surface": "feed",
  "seq": 105,
  "type": "vote",
  "domain": null,
  "prompt": "Penalty shootouts: great drama, or a cruel coin flip?",
  "options": [
   "Great drama",
   "A cruel coin flip"
  ],
  "topic": "sport",
  "axis": null,
  "test": null,
  "bg": "The World Cup's first shootout came in 1982, and the 1994 final between Brazil and Italy was the first settled by one. Antonín Panenka won Euro 1976 with the chipped penalty that still bears his name."
 },
 {
  "id": "feed-f78",
  "surface": "feed",
  "seq": 106,
  "type": "vote",
  "domain": null,
  "prompt": "One instrument, mastered overnight — which?",
  "options": [
   "Piano",
   "Guitar",
   "Violin",
   "Drums"
  ],
  "topic": "music",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-f79",
  "surface": "feed",
  "seq": 107,
  "type": "vote",
  "domain": null,
  "prompt": "Meet your hero — or keep the myth?",
  "options": [
   "Meet them",
   "Keep the myth"
  ],
  "topic": "people",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-dl9",
  "surface": "feed",
  "seq": 108,
  "type": "dial",
  "domain": null,
  "prompt": "Trailers before the film — how many minutes is right?",
  "options": [
   "0–3 min",
   "3–5 min",
   "5–8 min",
   "8–10 min",
   "10–13 min",
   "13–15 min",
   "15–18 min",
   "18–20 min",
   "20–23 min",
   "23–25 min",
   "25–28 min",
   "28–30 min"
  ],
  "topic": "movies",
  "axis": null,
  "test": null,
  "lo": 0,
  "hi": 30,
  "unit": "min"
 },
 {
  "id": "feed-f80",
  "surface": "feed",
  "seq": 109,
  "type": "vote",
  "domain": null,
  "prompt": "A total eclipse nearby — travel to stand in it?",
  "options": [
   "Chase it",
   "Watch the photos"
  ],
  "topic": "event",
  "axis": null,
  "test": null,
  "bg": "In a total eclipse the Moon covers the Sun completely for a few minutes and day drops to twilight. For any single spot on Earth, totality passes overhead roughly once in 375 years."
 },
 {
  "id": "feed-f81",
  "surface": "feed",
  "seq": 110,
  "type": "vote",
  "domain": null,
  "prompt": "Cold leftovers the next morning: better, or sad?",
  "options": [
   "Better",
   "Sad"
  ],
  "topic": "food",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-f82",
  "surface": "feed",
  "seq": 111,
  "type": "vote",
  "domain": null,
  "prompt": "Paper books or an e-reader?",
  "options": [
   "Paper",
   "E-reader"
  ],
  "topic": "tech",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-f83",
  "surface": "feed",
  "seq": 112,
  "type": "vote",
  "domain": null,
  "prompt": "The saddest instrument?",
  "options": [
   "Cello",
   "Violin",
   "Piano",
   "Trumpet"
  ],
  "topic": "music",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-f84",
  "surface": "feed",
  "seq": 113,
  "type": "vote",
  "domain": null,
  "prompt": "One painting for your wall: Frida Kahlo, or Picasso?",
  "options": [
   "Frida Kahlo",
   "Picasso"
  ],
  "topic": "people",
  "axis": null,
  "test": null,
  "bg": "Frida Kahlo painted unsparing self-portraits threaded with Mexican folk imagery, much of it from bed after a bus crash at eighteen. Pablo Picasso co-invented Cubism and left tens of thousands of works, Guernica among them."
 },
 {
  "id": "feed-f85",
  "surface": "feed",
  "seq": 114,
  "type": "vote",
  "domain": null,
  "prompt": "End credits: sit through them, or straight out?",
  "options": [
   "Sit through",
   "Straight out"
  ],
  "topic": "movies",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-f86",
  "surface": "feed",
  "seq": 115,
  "type": "vote",
  "domain": null,
  "prompt": "New Year's Eve: the big night, or asleep by eleven?",
  "options": [
   "The big night",
   "Asleep by eleven"
  ],
  "topic": "event",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-dl10",
  "surface": "feed",
  "seq": 116,
  "type": "dial",
  "domain": null,
  "prompt": "How many close friends does a person need?",
  "options": [
   "0–1 friends",
   "1–2 friends",
   "2–3 friends",
   "3–3 friends",
   "3–4 friends",
   "4–5 friends",
   "5–6 friends",
   "6–7 friends",
   "7–8 friends",
   "8–8 friends",
   "8–9 friends",
   "9–10 friends"
  ],
  "topic": "bigq",
  "axis": null,
  "test": null,
  "lo": 0,
  "hi": 10,
  "unit": "friends",
  "active": false
 },
 {
  "id": "feed-f87",
  "surface": "feed",
  "seq": 117,
  "type": "vote",
  "domain": null,
  "prompt": "Soup: a meal, or a starter?",
  "options": [
   "A meal",
   "A starter"
  ],
  "topic": "food",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-n01",
  "surface": "feed",
  "seq": 118,
  "type": "vote",
  "domain": null,
  "prompt": "Trump has labelled the Strait of Hormuz new US territory. Your read?",
  "options": [
   "A power grab",
   "Keeping trade open"
  ],
  "topic": "now",
  "axis": null,
  "test": null,
  "from": "2026-08-23",
  "until": "2026-08-28",
  "bg": "The Strait of Hormuz is the 33-kilometre channel between Iran and Oman that every tanker leaving the Gulf has to pass through. Roughly a fifth of the world's oil moves across it. The water is Iran's and Oman's; ships cross under the transit-passage right in the Law of the Sea.",
  "political": true
 },
 {
  "id": "feed-n02",
  "surface": "feed",
  "seq": 119,
  "type": "vote",
  "domain": null,
  "prompt": "Crude is near $94. Has the pump changed how you get around?",
  "options": [
   "Driving less already",
   "No change yet"
  ],
  "topic": "now",
  "axis": null,
  "test": null,
  "from": "2026-08-23",
  "until": "2026-08-31",
  "bg": "Crude is the raw barrel, not the pump price. In much of Europe more than half of what you pay at the forecourt is tax and duty, with refining and retail margin on top, so a move in the crude price arrives diluted and several weeks late."
 },
 {
  "id": "feed-n03",
  "surface": "feed",
  "seq": 120,
  "type": "vote",
  "domain": null,
  "prompt": "Evergrande's founder got life for fraud and bribery. That sentence is…",
  "options": [
   "About right",
   "Too far"
  ],
  "topic": "now",
  "axis": null,
  "test": null,
  "from": "2026-08-23",
  "until": "2026-08-27",
  "bg": "Evergrande was China's largest property developer by sales, financed by pre-selling flats that were not yet built. It defaulted on its offshore debt in 2021 owing more than $300bn, and a Hong Kong court ordered it liquidated in January 2024, leaving unfinished towers across the country."
 },
 {
  "id": "feed-n04",
  "surface": "feed",
  "seq": 121,
  "type": "vote",
  "domain": null,
  "prompt": "Harry and Meghan move back to Britain, but keep no royal duties. Workable?",
  "options": [
   "It can work",
   "Pick a side"
  ],
  "topic": "now",
  "axis": null,
  "test": null,
  "from": "2026-08-23",
  "until": "2026-09-03",
  "bg": "The Duke and Duchess of Sussex stepped back from working royal duties in January 2020 and moved to California. They kept their titles and gave up what came with the roles: the public engagements, the Sovereign Grant funding, and publicly funded security in the UK."
 },
 {
  "id": "feed-n05",
  "surface": "feed",
  "seq": 122,
  "type": "vote",
  "domain": null,
  "prompt": "A model published proofs for ten open problems in maths. Is that doing maths?",
  "options": [
   "It counts",
   "Not until a human gets it"
  ],
  "topic": "now",
  "axis": null,
  "test": null,
  "from": "2026-08-23",
  "until": "2026-08-29",
  "bg": "An open problem is one nobody has solved. A proof counts only once others can check it — by refereeing, or by writing it in a proof assistant like Lean that verifies each step mechanically. Computers have settled proofs before: the four-colour theorem went that way in 1976."
 },
 {
  "id": "feed-n06",
  "surface": "feed",
  "seq": 123,
  "type": "vote",
  "domain": null,
  "prompt": "Italy's fourth heatwave this summer, red alerts in 25 cities. Just summer now?",
  "options": [
   "This is normal now",
   "Still an emergency"
  ],
  "topic": "now",
  "axis": null,
  "test": null,
  "from": "2026-08-23",
  "until": "2026-08-26",
  "bg": "Italy's health ministry grades heat city by city on a three-level scale, and red is the top one: the heat is rated a risk to everyone, not only to the old and the ill. Attribution studies find warming has made heatwaves of a given severity both more frequent and more intense."
 },
 {
  "id": "feed-f88",
  "surface": "feed",
  "seq": 124,
  "type": "vote",
  "domain": null,
  "prompt": "One more work from a lost genius: Mozart, or Van Gogh?",
  "options": [
   "Mozart",
   "Van Gogh"
  ],
  "topic": "people",
  "axis": null,
  "test": null,
  "bg": "Mozart died at 35 with his Requiem unfinished on the desk. Van Gogh died at 37, having painted nearly 900 canvases in a single decade and sold almost none of them in his lifetime."
 },
 {
  "id": "feed-f89",
  "surface": "feed",
  "seq": 125,
  "type": "vote",
  "domain": null,
  "prompt": "Karaoke: joy, or ordeal?",
  "options": [
   "Joy",
   "Ordeal"
  ],
  "topic": "music",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-f90",
  "surface": "feed",
  "seq": 126,
  "type": "vote",
  "domain": null,
  "prompt": "A film you love gets a remake — excited, or bracing?",
  "options": [
   "Excited",
   "Bracing for it"
  ],
  "topic": "movies",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-f91",
  "surface": "feed",
  "seq": 127,
  "type": "vote",
  "domain": null,
  "prompt": "Daylight saving time: keep it, or scrap it?",
  "options": [
   "Keep it",
   "Scrap it"
  ],
  "topic": "event",
  "axis": null,
  "test": null,
  "bg": "Daylight saving began as a coal-saving measure in the First World War. The European Parliament voted in 2019 to end the twice-yearly change, but member states never settled which time to keep, so the clocks still move.",
  "political": true
 },
 {
  "id": "feed-dl11",
  "surface": "feed",
  "seq": 128,
  "type": "dial",
  "domain": null,
  "prompt": "How many hours a day on a phone is too many?",
  "options": [
   "0–1 h",
   "1–2 h",
   "2–3 h",
   "3–4 h",
   "4–5 h",
   "5–6 h",
   "6–7 h",
   "7–8 h",
   "8–9 h",
   "9–10 h",
   "10–11 h",
   "11–12 h"
  ],
  "topic": "tech",
  "axis": null,
  "test": null,
  "lo": 0,
  "hi": 12,
  "unit": "h",
  "active": false
 },
 {
  "id": "feed-f92",
  "surface": "feed",
  "seq": 129,
  "type": "vote",
  "domain": null,
  "prompt": "Know exactly what people think of you — would you?",
  "options": [
   "Yes, all of it",
   "Spare me"
  ],
  "topic": "bigq",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-f93",
  "surface": "feed",
  "seq": 130,
  "type": "vote",
  "domain": null,
  "prompt": "Whose biography tonight: Churchill, Bowie, Serena Williams, or Marie Curie?",
  "options": [
   "Churchill",
   "David Bowie",
   "Serena Williams",
   "Marie Curie"
  ],
  "topic": "people",
  "axis": null,
  "test": null,
  "bg": "Churchill led Britain through the Second World War and won a Nobel Prize in Literature. Bowie reinvented pop across five decades. Serena Williams took 23 Grand Slam singles titles. Curie won Nobels in two different sciences."
 },
 {
  "id": "feed-f94",
  "surface": "feed",
  "seq": 131,
  "type": "vote",
  "domain": null,
  "prompt": "The song stuck in your head: fight it, or play it?",
  "options": [
   "Fight it",
   "Play it"
  ],
  "topic": "music",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-f95",
  "surface": "feed",
  "seq": 132,
  "type": "vote",
  "domain": null,
  "prompt": "Tonight's film: a favourite again, or a gamble on something new?",
  "options": [
   "The favourite, again",
   "Something new"
  ],
  "topic": "movies",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-f96",
  "surface": "feed",
  "seq": 133,
  "type": "vote",
  "domain": null,
  "prompt": "World Cup final: in the stadium, at home with friends, or the big screen in a pub?",
  "options": [
   "In the stadium",
   "Home with friends",
   "Big screen in a pub"
  ],
  "topic": "event",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-dl12",
  "surface": "feed",
  "seq": 134,
  "type": "dial",
  "domain": null,
  "prompt": "Books finished last year — how many?",
  "options": [
   "0–3 books",
   "3–5 books",
   "5–8 books",
   "8–10 books",
   "10–13 books",
   "13–15 books",
   "15–18 books",
   "18–20 books",
   "20–23 books",
   "23–25 books",
   "25–28 books",
   "28–30 books"
  ],
  "topic": "culture",
  "axis": null,
  "test": null,
  "lo": 0,
  "hi": 30,
  "unit": "books",
  "active": false
 },
 {
  "id": "feed-f97",
  "surface": "feed",
  "seq": 135,
  "type": "vote",
  "domain": null,
  "prompt": "Pineapple on pizza?",
  "options": [
   "Obviously yes",
   "Never"
  ],
  "topic": "food",
  "axis": null,
  "test": null,
  "bg": "Hawaiian pizza — ham and pineapple — was invented in 1962 by Sam Panopoulos, a Greek-born cook in Chatham, Ontario, Canada, and named after the brand of canned pineapple he used."
 },
 {
  "id": "feed-f98",
  "surface": "feed",
  "seq": 136,
  "type": "vote",
  "domain": null,
  "prompt": "The narrator of your life's documentary: David Attenborough, or Morgan Freeman?",
  "options": [
   "David Attenborough",
   "Morgan Freeman"
  ],
  "topic": "people",
  "axis": null,
  "test": null,
  "bg": "David Attenborough has narrated British natural history broadcasting since the 1950s, from Life on Earth to Planet Earth. Morgan Freeman's narration runs from The Shawshank Redemption to March of the Penguins."
 },
 {
  "id": "feed-f99",
  "surface": "feed",
  "seq": 137,
  "type": "vote",
  "domain": null,
  "prompt": "Your funeral song: make them cry, or make them dance?",
  "options": [
   "Make them cry",
   "Make them dance"
  ],
  "topic": "music",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-f100",
  "surface": "feed",
  "seq": 138,
  "type": "vote",
  "domain": null,
  "prompt": "Laugh-track sitcoms: cosy, or unbearable?",
  "options": [
   "Cosy",
   "Unbearable"
  ],
  "topic": "movies",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-f101",
  "surface": "feed",
  "seq": 139,
  "type": "vote",
  "domain": null,
  "prompt": "A single world holiday, everyone off on the same day: dream, or nightmare?",
  "options": [
   "Dream",
   "Nightmare"
  ],
  "topic": "event",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-dl13",
  "surface": "feed",
  "seq": 140,
  "type": "dial",
  "domain": null,
  "prompt": "Hours of live sport in a good week?",
  "options": [
   "0–2 h",
   "2–3 h",
   "3–5 h",
   "5–7 h",
   "7–8 h",
   "8–10 h",
   "10–12 h",
   "12–13 h",
   "13–15 h",
   "15–17 h",
   "17–18 h",
   "18–20 h"
  ],
  "topic": "sport",
  "axis": null,
  "test": null,
  "lo": 0,
  "hi": 20,
  "unit": "h",
  "active": false
 },
 {
  "id": "feed-f102",
  "surface": "feed",
  "seq": 141,
  "type": "vote",
  "domain": null,
  "prompt": "Your life's photos: in the cloud, or on a drive you can hold?",
  "options": [
   "The cloud",
   "A drive I can hold"
  ],
  "topic": "tech",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-f103",
  "surface": "feed",
  "seq": 142,
  "type": "vote",
  "domain": null,
  "prompt": "Whose diary would you rather read?",
  "options": [
   "Someone famous",
   "A stranger your age"
  ],
  "topic": "people",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-dl14",
  "surface": "feed",
  "seq": 143,
  "type": "dial",
  "domain": null,
  "prompt": "How old were you when your taste in music settled?",
  "options": [
   "10–13 yrs",
   "13–15 yrs",
   "15–18 yrs",
   "18–20 yrs",
   "20–23 yrs",
   "23–25 yrs",
   "25–28 yrs",
   "28–30 yrs",
   "30–33 yrs",
   "33–35 yrs",
   "35–38 yrs",
   "38–40 yrs"
  ],
  "topic": "music",
  "axis": null,
  "test": null,
  "lo": 10,
  "hi": 40,
  "unit": "yrs",
  "active": false
 },
 {
  "id": "feed-f104",
  "surface": "feed",
  "seq": 144,
  "type": "vote",
  "domain": null,
  "prompt": "Watching a film in pieces over a week?",
  "options": [
   "Fine",
   "One sitting or nothing"
  ],
  "topic": "movies",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-fd4",
  "surface": "feed",
  "seq": 145,
  "type": "field",
  "domain": null,
  "prompt": "Human nature — place it",
  "options": [
   "selfish · changeable",
   "lean selfish · changeable",
   "lean kind · changeable",
   "kind · changeable",
   "selfish · middle",
   "lean selfish · middle",
   "lean kind · middle",
   "kind · middle",
   "selfish · fixed",
   "lean selfish · fixed",
   "lean kind · fixed",
   "kind · fixed"
  ],
  "topic": "bigq",
  "axis": null,
  "test": null,
  "also": [
   "dilemma"
  ],
  "ax": [
   "selfish",
   "kind"
  ],
  "ay": [
   "fixed",
   "changeable"
  ]
 },
 {
  "id": "feed-f105",
  "surface": "feed",
  "seq": 146,
  "type": "vote",
  "domain": null,
  "prompt": "Lending a favourite book?",
  "options": [
   "Gladly",
   "Never the good ones"
  ],
  "topic": "culture",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-f106",
  "surface": "feed",
  "seq": 147,
  "type": "vote",
  "domain": null,
  "prompt": "Artefacts taken long ago, sitting in faraway museums?",
  "options": [
   "Return them",
   "Keep them on show"
  ],
  "topic": "event",
  "axis": null,
  "test": null,
  "bg": "Museums have begun returning contested holdings — Germany sent Benin Bronzes back to Nigeria in 2022, and talks over the Parthenon Marbles continue. The universal-museum position holds that one collection shows objects to more of the world."
 },
 {
  "id": "feed-f107",
  "surface": "feed",
  "seq": 148,
  "type": "vote",
  "domain": null,
  "prompt": "A new statue for your town square: an artist, a scientist, an athlete, or nobody?",
  "options": [
   "An artist",
   "A scientist",
   "An athlete",
   "Nobody — no more statues"
  ],
  "topic": "people",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-f108",
  "surface": "feed",
  "seq": 149,
  "type": "vote",
  "domain": null,
  "prompt": "Live album, or studio album?",
  "options": [
   "Live",
   "Studio"
  ],
  "topic": "music",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-dl15",
  "surface": "feed",
  "seq": 150,
  "type": "dial",
  "domain": null,
  "prompt": "Meals cooked from scratch in a week?",
  "options": [
   "0–1 meals",
   "1–2 meals",
   "2–4 meals",
   "4–5 meals",
   "5–6 meals",
   "6–7 meals",
   "7–8 meals",
   "8–9 meals",
   "9–11 meals",
   "11–12 meals",
   "12–13 meals",
   "13–14 meals"
  ],
  "topic": "food",
  "axis": null,
  "test": null,
  "lo": 0,
  "hi": 14,
  "unit": "meals",
  "active": false
 },
 {
  "id": "feed-f109",
  "surface": "feed",
  "seq": 151,
  "type": "vote",
  "domain": null,
  "prompt": "Cinema snacks: essential, or a racket?",
  "options": [
   "Essential",
   "A racket"
  ],
  "topic": "movies",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-f110",
  "surface": "feed",
  "seq": 152,
  "type": "vote",
  "domain": null,
  "prompt": "Your team is losing badly. Stay to the end, or beat the traffic?",
  "options": [
   "Stay to the end",
   "Beat the traffic"
  ],
  "topic": "sport",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-f111",
  "surface": "feed",
  "seq": 153,
  "type": "vote",
  "domain": null,
  "prompt": "Voice messages: a gift, or a burden?",
  "options": [
   "A gift",
   "A burden"
  ],
  "topic": "tech",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-f112",
  "surface": "feed",
  "seq": 154,
  "type": "vote",
  "domain": null,
  "prompt": "Which expedition would you have joined?",
  "options": [
   "Shackleton's ice",
   "Earhart's sky",
   "Cousteau's sea",
   "Armstrong's moon"
  ],
  "topic": "people",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-f113",
  "surface": "feed",
  "seq": 155,
  "type": "vote",
  "domain": null,
  "prompt": "A song you love turns up in an ad: ruined, or fair play?",
  "options": [
   "Ruined",
   "Fair play"
  ],
  "topic": "music",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-f114",
  "surface": "feed",
  "seq": 156,
  "type": "vote",
  "domain": null,
  "prompt": "If no one would ever know what you did, would you act differently?",
  "options": [
   "Honestly, yes",
   "No — same me"
  ],
  "topic": "bigq",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-f115",
  "surface": "feed",
  "seq": 157,
  "type": "vote",
  "domain": null,
  "prompt": "Handwritten letters: bring them back, or let them go?",
  "options": [
   "Bring them back",
   "Let them go"
  ],
  "topic": "culture",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-f116",
  "surface": "feed",
  "seq": 158,
  "type": "vote",
  "domain": null,
  "prompt": "Voting at 16: about time, or too young?",
  "options": [
   "About time",
   "Too young"
  ],
  "topic": "event",
  "axis": null,
  "test": null,
  "political": true
 },
 {
  "id": "feed-dl16",
  "surface": "feed",
  "seq": 159,
  "type": "dial",
  "domain": null,
  "prompt": "The ideal dinner hour?",
  "options": [
   "17–18 h",
   "18–18 h",
   "18–19 h",
   "19–19 h",
   "19–20 h",
   "20–20 h",
   "20–21 h",
   "21–21 h",
   "21–22 h",
   "22–22 h",
   "22–23 h",
   "23–23 h"
  ],
  "topic": "food",
  "axis": null,
  "test": null,
  "lo": 17,
  "hi": 23,
  "unit": "h",
  "active": false
 },
 {
  "id": "feed-f117",
  "surface": "feed",
  "seq": 160,
  "type": "vote",
  "domain": null,
  "prompt": "A stranger's kindness you still remember: tell them, or leave it?",
  "options": [
   "Track them down",
   "Leave it be"
  ],
  "topic": "people",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-f118",
  "surface": "feed",
  "seq": 161,
  "type": "vote",
  "domain": null,
  "prompt": "The villain everyone secretly roots for: fine, or a problem?",
  "options": [
   "Perfectly fine",
   "A bit of a problem"
  ],
  "topic": "movies",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-f119",
  "surface": "feed",
  "seq": 162,
  "type": "vote",
  "domain": null,
  "prompt": "Learning an instrument at 40: worth starting, or too late?",
  "options": [
   "Start anyway",
   "Too late"
  ],
  "topic": "music",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-f120",
  "surface": "feed",
  "seq": 163,
  "type": "vote",
  "domain": null,
  "prompt": "Watching sport alone, or in a crowd?",
  "options": [
   "Alone",
   "In a crowd"
  ],
  "topic": "sport",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-f121",
  "surface": "feed",
  "seq": 164,
  "type": "vote",
  "domain": null,
  "prompt": "Your search history, visible to one person you trust: fine, or absolutely not?",
  "options": [
   "Fine",
   "Absolutely not"
  ],
  "topic": "tech",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-dl17",
  "surface": "feed",
  "seq": 165,
  "type": "dial",
  "domain": null,
  "prompt": "How many years ahead do you actually plan?",
  "options": [
   "0–2 years",
   "2–3 years",
   "3–5 years",
   "5–7 years",
   "7–8 years",
   "8–10 years",
   "10–12 years",
   "12–13 years",
   "13–15 years",
   "15–17 years",
   "17–18 years",
   "18–20 years"
  ],
  "topic": "bigq",
  "axis": null,
  "test": null,
  "lo": 0,
  "hi": 20,
  "unit": "years",
  "active": false
 },
 {
  "id": "feed-f122",
  "surface": "feed",
  "seq": 166,
  "type": "vote",
  "domain": null,
  "prompt": "The famous person you'd trust to babysit: Dolly Parton, Keanu Reeves, David Attenborough, or Michelle Obama?",
  "options": [
   "Dolly Parton",
   "Keanu Reeves",
   "David Attenborough",
   "Michelle Obama"
  ],
  "topic": "people",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-dl18",
  "surface": "feed",
  "seq": 167,
  "type": "dial",
  "domain": null,
  "prompt": "Minutes late before it counts as late?",
  "options": [
   "0–3 min",
   "3–5 min",
   "5–8 min",
   "8–10 min",
   "10–13 min",
   "13–15 min",
   "15–18 min",
   "18–20 min",
   "20–23 min",
   "23–25 min",
   "25–28 min",
   "28–30 min"
  ],
  "topic": "culture",
  "axis": null,
  "test": null,
  "lo": 0,
  "hi": 30,
  "unit": "min",
  "active": false
 },
 {
  "id": "feed-f123",
  "surface": "feed",
  "seq": 168,
  "type": "vote",
  "domain": null,
  "prompt": "Never lie again — and never be lied to. Take the deal?",
  "options": [
   "Take it",
   "Too much truth"
  ],
  "topic": "dilemma",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-f124",
  "surface": "feed",
  "seq": 169,
  "type": "vote",
  "domain": null,
  "prompt": "A referendum on every big question: more democracy, or chaos?",
  "options": [
   "More democracy",
   "Chaos"
  ],
  "topic": "event",
  "axis": null,
  "test": null,
  "political": true
 },
 {
  "id": "feed-f125",
  "surface": "feed",
  "seq": 170,
  "type": "vote",
  "domain": null,
  "prompt": "Breakfast: sweet, or savoury?",
  "options": [
   "Sweet",
   "Savoury"
  ],
  "topic": "food",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-f126",
  "surface": "feed",
  "seq": 171,
  "type": "vote",
  "domain": null,
  "prompt": "Black-and-white films: a treat, or a chore?",
  "options": [
   "A treat",
   "A chore"
  ],
  "topic": "movies",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-f127",
  "surface": "feed",
  "seq": 172,
  "type": "vote",
  "domain": null,
  "prompt": "The band re-forms without its singer: still the band, or a tribute act?",
  "options": [
   "Still the band",
   "A tribute act"
  ],
  "topic": "music",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-f128",
  "surface": "feed",
  "seq": 173,
  "type": "vote",
  "domain": null,
  "prompt": "The teacher you'd want for one term: Aristotle, Leonardo da Vinci, Charles Darwin, or Maya Angelou?",
  "options": [
   "Aristotle",
   "Leonardo da Vinci",
   "Charles Darwin",
   "Maya Angelou"
  ],
  "topic": "people",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-f129",
  "surface": "feed",
  "seq": 174,
  "type": "vote",
  "domain": null,
  "prompt": "The Olympics: summer, or winter?",
  "options": [
   "Summer",
   "Winter"
  ],
  "topic": "sport",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-f130",
  "surface": "feed",
  "seq": 175,
  "type": "vote",
  "domain": null,
  "prompt": "Video calls: camera on, or camera off?",
  "options": [
   "Camera on",
   "Camera off"
  ],
  "topic": "tech",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-f131",
  "surface": "feed",
  "seq": 176,
  "type": "vote",
  "domain": null,
  "prompt": "What writes more of a life: luck, or effort?",
  "options": [
   "Luck",
   "Effort"
  ],
  "topic": "bigq",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-pt3",
  "surface": "feed",
  "seq": 177,
  "type": "path",
  "domain": null,
  "prompt": "The Reunion — twenty years, one evening",
  "options": [
   "The One Who Books It",
   "The Warm Maybe",
   "The Late Arrival",
   "The Observer",
   "The Two-Chair Table",
   "The Door Ajar",
   "The Midnight Scroller",
   "The Clean Break"
  ],
  "topic": "culture",
  "axis": null,
  "test": null,
  "core": true,
  "title": "The Reunion",
  "intro": "Twenty years since the last day of school. The invitation has sat in your inbox for a week; the RSVP closes at midnight.",
  "hue": 200,
  "nodes": {
   "_": {
    "q": "Midnight is an hour away. The form wants one click.",
    "a": [
     {
      "t": "Reply yes"
     },
     {
      "t": "Let it close"
     }
    ]
   },
   "A": {
    "q": "You arrive early. Across the room: your old best friend, mid-laugh, twenty years older.",
    "a": [
     {
      "t": "Walk straight over"
     },
     {
      "t": "Get a drink, read the room first"
     }
    ]
   },
   "B": {
    "q": "Next morning the group chat fills with photos. Someone writes: \"Where were you?\"",
    "a": [
     {
      "t": "The truth — crowds aren't your thing"
     },
     {
      "t": "Say work got in the way"
     }
    ]
   },
   "AA": {
    "q": "An hour in, no time has passed at all. They mention they're moving back next month.",
    "a": [
     {
      "t": "Set a date and a place, tonight"
     },
     {
      "t": "\"We should catch up sometime\""
     }
    ]
   },
   "AB": {
    "q": "From your corner the room sorts itself into its old tables. Your old friend spots you and waves.",
    "a": [
     {
      "t": "Go over: \"I almost didn't come\""
     },
     {
      "t": "Wave back, keep the corner"
     }
    ]
   },
   "BA": {
    "q": "A private reply: \"Fair. I only went hoping you'd be there.\"",
    "a": [
     {
      "t": "Offer a coffee, just you two"
     },
     {
      "t": "Leave it warm and unanswered"
     }
    ]
   },
   "BB": {
    "q": "The chat moves on. One tagged photo shows your old table — someone new in your old seat.",
    "a": [
     {
      "t": "Open the whole album"
     },
     {
      "t": "Mute the chat"
     }
    ]
   }
  },
  "endings": {
   "AAA": {
    "name": "The One Who Books It",
    "line": "A date, a place, no 'sometime'. Twenty years turned out to be a scheduling problem."
   },
   "AAB": {
    "name": "The Warm Maybe",
    "line": "The hug was real. The 'sometime' stayed a sometime."
   },
   "ABA": {
    "name": "The Late Arrival",
    "line": "'Almost didn't come' — said out loud, it became the best story of the night."
   },
   "ABB": {
    "name": "The Observer",
    "line": "You saw the whole evening clearly. It never quite saw you."
   },
   "BAA": {
    "name": "The Two-Chair Table",
    "line": "No name tags, no speeches. The reunion that actually reunited."
   },
   "BAB": {
    "name": "The Door Ajar",
    "line": "Warm, unanswered. Some doors you like exactly this open."
   },
   "BBA": {
    "name": "The Midnight Scroller",
    "line": "Every photo, twice. You attended after all — from here."
   },
   "BBB": {
    "name": "The Clean Break",
    "line": "The chat went quiet because you asked it to. So did the decade."
   }
  }
 },
 {
  "id": "feed-f132",
  "surface": "feed",
  "seq": 178,
  "type": "vote",
  "domain": null,
  "prompt": "Teleport anywhere instantly — but you can never travel slowly again. Take it?",
  "options": [
   "Take it",
   "Keep the journey"
  ],
  "topic": "dilemma",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-f133",
  "surface": "feed",
  "seq": 179,
  "type": "vote",
  "domain": null,
  "prompt": "A cashless world: convenient future, or something lost?",
  "options": [
   "Convenient future",
   "Something lost"
  ],
  "topic": "event",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-f134",
  "surface": "feed",
  "seq": 180,
  "type": "vote",
  "domain": null,
  "prompt": "Ketchup: fridge, or cupboard?",
  "options": [
   "Fridge",
   "Cupboard"
  ],
  "topic": "food",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-f135",
  "surface": "feed",
  "seq": 181,
  "type": "vote",
  "domain": null,
  "prompt": "One genre forever: comedy, thriller, drama, or documentary?",
  "options": [
   "Comedy",
   "Thriller",
   "Drama",
   "Documentary"
  ],
  "topic": "movies",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-dl19",
  "surface": "feed",
  "seq": 182,
  "type": "dial",
  "domain": null,
  "prompt": "How many songs on a perfect album?",
  "options": [
   "6–7 songs",
   "7–8 songs",
   "8–10 songs",
   "10–11 songs",
   "11–12 songs",
   "12–13 songs",
   "13–14 songs",
   "14–15 songs",
   "15–17 songs",
   "17–18 songs",
   "18–19 songs",
   "19–20 songs"
  ],
  "topic": "music",
  "axis": null,
  "test": null,
  "lo": 6,
  "hi": 20,
  "unit": "songs",
  "active": false
 },
 {
  "id": "feed-f136",
  "surface": "feed",
  "seq": 183,
  "type": "vote",
  "domain": null,
  "prompt": "One selfie with: Beyoncé, the Pope, Lionel Messi, or Taylor Swift?",
  "options": [
   "Beyoncé",
   "The Pope",
   "Lionel Messi",
   "Taylor Swift"
  ],
  "topic": "people",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-n07",
  "surface": "feed",
  "seq": 184,
  "type": "vote",
  "domain": null,
  "prompt": "Nine-figure transfer fees: the market working, or football losing the plot?",
  "options": [
   "The market working",
   "Losing the plot",
   "Fine — until my club pays"
  ],
  "topic": "now",
  "axis": null,
  "test": null,
  "from": "2026-09-02",
  "until": "2026-09-04",
  "bg": "Europe's summer transfer window closed on 1 September. Deadline day brought a rush of deals across the big leagues, several at nine-figure fees, before squads lock until the winter window opens in January."
 },
 {
  "id": "feed-n08",
  "surface": "feed",
  "seq": 185,
  "type": "vote",
  "domain": null,
  "prompt": "A $4bn telescope just left to hunt dark energy. Money well spent?",
  "options": [
   "Every cent",
   "Fix Earth first",
   "Ask me when it finds something"
  ],
  "topic": "now",
  "axis": null,
  "test": null,
  "from": "2026-09-02",
  "until": "2026-09-05",
  "bg": "NASA's Nancy Grace Roman Space Telescope launched on a SpaceX Falcon Heavy on 30 August, bound for the L2 point 1.5 million kilometres out. Its wide-field camera will hunt exoplanets and map dark energy; the mission cost about $4.3 billion."
 },
 {
  "id": "feed-n09",
  "surface": "feed",
  "seq": 186,
  "type": "vote",
  "domain": null,
  "prompt": "A Grand Slam without the world No. 1: wide open, or missing something?",
  "options": [
   "Wide open",
   "Missing something"
  ],
  "topic": "now",
  "axis": null,
  "test": null,
  "from": "2026-09-02",
  "until": "2026-09-06",
  "bg": "The 2026 US Open runs 30 August to 13 September in New York. Top-ranked Jannik Sinner withdrew before play began with a knee injury; Carlos Alcaraz and Aryna Sabalenka arrived as the defending singles champions."
 },
 {
  "id": "feed-n10",
  "surface": "feed",
  "seq": 187,
  "type": "vote",
  "domain": null,
  "prompt": "Awards season opens at Venice. Do festival prizes change what you watch?",
  "options": [
   "I seek winners out",
   "They reach me eventually",
   "Industry theatre"
  ],
  "topic": "now",
  "axis": null,
  "test": null,
  "from": "2026-09-02",
  "until": "2026-09-07",
  "bg": "The 83rd Venice International Film Festival runs 2 to 12 September and opens the autumn awards season. Maggie Gyllenhaal chairs the main-competition jury; 21 world premieres compete for the Golden Lion."
 },
 {
  "id": "feed-f137",
  "surface": "feed",
  "seq": 188,
  "type": "vote",
  "domain": null,
  "prompt": "A win by a bad call: still sweet, or spoiled?",
  "options": [
   "Still sweet",
   "Spoiled"
  ],
  "topic": "sport",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-f138",
  "surface": "feed",
  "seq": 189,
  "type": "vote",
  "domain": null,
  "prompt": "Would you rather coach, or commentate?",
  "options": [
   "Coach",
   "Commentate"
  ],
  "topic": "sport",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-f139",
  "surface": "feed",
  "seq": 190,
  "type": "vote",
  "domain": null,
  "prompt": "Home advantage: a real force, or an excuse?",
  "options": [
   "A real force",
   "An excuse"
  ],
  "topic": "sport",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-f140",
  "surface": "feed",
  "seq": 191,
  "type": "vote",
  "domain": null,
  "prompt": "Anthems before the game: goosebumps, or get on with it?",
  "options": [
   "Goosebumps",
   "Get on with it"
  ],
  "topic": "sport",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-f141",
  "surface": "feed",
  "seq": 192,
  "type": "vote",
  "domain": null,
  "prompt": "Your phone dies for a day: freedom, or panic?",
  "options": [
   "Freedom",
   "Panic"
  ],
  "topic": "tech",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-f142",
  "surface": "feed",
  "seq": 193,
  "type": "vote",
  "domain": null,
  "prompt": "A smart home: convenient, or creepy?",
  "options": [
   "Convenient",
   "Creepy"
  ],
  "topic": "tech",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-f143",
  "surface": "feed",
  "seq": 194,
  "type": "vote",
  "domain": null,
  "prompt": "Typing, or talking to your devices?",
  "options": [
   "Typing",
   "Talking"
  ],
  "topic": "tech",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-f144",
  "surface": "feed",
  "seq": 195,
  "type": "vote",
  "domain": null,
  "prompt": "The terms and conditions: ever read them, or never once?",
  "options": [
   "Sometimes, honestly",
   "Never once"
  ],
  "topic": "tech",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-f145",
  "surface": "feed",
  "seq": 196,
  "type": "vote",
  "domain": null,
  "prompt": "A life with no regrets: achievable, or not even desirable?",
  "options": [
   "Achievable",
   "Not even desirable"
  ],
  "topic": "bigq",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-f146",
  "surface": "feed",
  "seq": 197,
  "type": "vote",
  "domain": null,
  "prompt": "A guaranteed ordinary life, or a risky remarkable one?",
  "options": [
   "Guaranteed ordinary",
   "Risky remarkable"
  ],
  "topic": "bigq",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-f147",
  "surface": "feed",
  "seq": 198,
  "type": "vote",
  "domain": null,
  "prompt": "Are you the same person at 18 and 80?",
  "options": [
   "Same person",
   "Someone new"
  ],
  "topic": "bigq",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-f148",
  "surface": "feed",
  "seq": 199,
  "type": "vote",
  "domain": null,
  "prompt": "Do animals have it figured out better than we do?",
  "options": [
   "They do",
   "We do"
  ],
  "topic": "bigq",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-f149",
  "surface": "feed",
  "seq": 200,
  "type": "vote",
  "domain": null,
  "prompt": "History will judge our era…",
  "options": [
   "Kindly",
   "Harshly"
  ],
  "topic": "bigq",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-f150",
  "surface": "feed",
  "seq": 201,
  "type": "vote",
  "domain": null,
  "prompt": "Queue-jumpers: say something, or seethe in silence?",
  "options": [
   "Say something",
   "Seethe in silence"
  ],
  "topic": "culture",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-f151",
  "surface": "feed",
  "seq": 202,
  "type": "vote",
  "domain": null,
  "prompt": "Adult birthdays: celebrate big, or let them pass?",
  "options": [
   "Celebrate big",
   "Let them pass"
  ],
  "topic": "culture",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-f152",
  "surface": "feed",
  "seq": 203,
  "type": "vote",
  "domain": null,
  "prompt": "Re-reading old favourites: deepening, or time stolen from the new?",
  "options": [
   "Deepening",
   "Stolen time"
  ],
  "topic": "culture",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-f153",
  "surface": "feed",
  "seq": 204,
  "type": "vote",
  "domain": null,
  "prompt": "Weddings: small and close, or big and once?",
  "options": [
   "Small and close",
   "Big and once"
  ],
  "topic": "culture",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-f154",
  "surface": "feed",
  "seq": 205,
  "type": "vote",
  "domain": null,
  "prompt": "Swap lives with a stranger for a week — you don't choose who. Go?",
  "options": [
   "Go",
   "Stay me"
  ],
  "topic": "dilemma",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-f155",
  "surface": "feed",
  "seq": 206,
  "type": "vote",
  "domain": null,
  "prompt": "A pill that removes all fear. Take it?",
  "options": [
   "Take it",
   "Fear is doing a job"
  ],
  "topic": "dilemma",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-f156",
  "surface": "feed",
  "seq": 207,
  "type": "vote",
  "domain": null,
  "prompt": "Double your money, or double your free time?",
  "options": [
   "Double the money",
   "Double the time"
  ],
  "topic": "dilemma",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-f157",
  "surface": "feed",
  "seq": 208,
  "type": "vote",
  "domain": null,
  "prompt": "Invisible for a day, or pause time for an hour?",
  "options": [
   "Invisible",
   "Pause time"
  ],
  "topic": "dilemma",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-f158",
  "surface": "feed",
  "seq": 209,
  "type": "vote",
  "domain": null,
  "prompt": "Your biography: warts and all, or flattering and false?",
  "options": [
   "Warts and all",
   "Flattering and false"
  ],
  "topic": "dilemma",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-f159",
  "surface": "feed",
  "seq": 210,
  "type": "vote",
  "domain": null,
  "prompt": "Adverts in the night sky: just business, or vandalism?",
  "options": [
   "Just business",
   "Vandalism"
  ],
  "topic": "event",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-f160",
  "surface": "feed",
  "seq": 211,
  "type": "vote",
  "domain": null,
  "prompt": "Should museums be free?",
  "options": [
   "Free, always",
   "Tickets are fine"
  ],
  "topic": "event",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-f161",
  "surface": "feed",
  "seq": 212,
  "type": "vote",
  "domain": null,
  "prompt": "New Olympic sports: keep experimenting, or protect the classics?",
  "options": [
   "Keep experimenting",
   "Protect the classics"
  ],
  "topic": "event",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-f162",
  "surface": "feed",
  "seq": 213,
  "type": "vote",
  "domain": null,
  "prompt": "An upper age limit for national leaders: sensible, or ageist?",
  "options": [
   "Sensible",
   "Ageist"
  ],
  "topic": "event",
  "axis": null,
  "test": null,
  "political": true
 },
 {
  "id": "feed-f163",
  "surface": "feed",
  "seq": 214,
  "type": "vote",
  "domain": null,
  "prompt": "Drone shows replacing fireworks: an upgrade, or not the same?",
  "options": [
   "An upgrade",
   "Not the same"
  ],
  "topic": "event",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-f164",
  "surface": "feed",
  "seq": 215,
  "type": "vote",
  "domain": null,
  "prompt": "Too much garlic: impossible, or very possible?",
  "options": [
   "Impossible",
   "Very possible"
  ],
  "topic": "food",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-f165",
  "surface": "feed",
  "seq": 216,
  "type": "vote",
  "domain": null,
  "prompt": "Eating alone at a restaurant: a treat, or a trial?",
  "options": [
   "A treat",
   "A trial"
  ],
  "topic": "food",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-f166",
  "surface": "feed",
  "seq": 217,
  "type": "vote",
  "domain": null,
  "prompt": "The end slice of the loaf: the best bit, or the bird's?",
  "options": [
   "The best bit",
   "The bird's"
  ],
  "topic": "food",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-f167",
  "surface": "feed",
  "seq": 218,
  "type": "vote",
  "domain": null,
  "prompt": "Cheese course, or dessert course?",
  "options": [
   "Cheese",
   "Dessert"
  ],
  "topic": "food",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-f168",
  "surface": "feed",
  "seq": 219,
  "type": "vote",
  "domain": null,
  "prompt": "A mid-film phone check: unforgivable, or human?",
  "options": [
   "Unforgivable",
   "Human"
  ],
  "topic": "movies",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-f169",
  "surface": "feed",
  "seq": 220,
  "type": "vote",
  "domain": null,
  "prompt": "So bad it's good: a real category, or cope?",
  "options": [
   "A real category",
   "Cope"
  ],
  "topic": "movies",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-f170",
  "surface": "feed",
  "seq": 221,
  "type": "vote",
  "domain": null,
  "prompt": "Musicals: joy, or endurance?",
  "options": [
   "Joy",
   "Endurance"
  ],
  "topic": "movies",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-f171",
  "surface": "feed",
  "seq": 222,
  "type": "vote",
  "domain": null,
  "prompt": "The adaptation you dread most: a beloved book, a favourite game, or your childhood cartoon?",
  "options": [
   "The beloved book",
   "The favourite game",
   "The childhood cartoon"
  ],
  "topic": "movies",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-f172",
  "surface": "feed",
  "seq": 223,
  "type": "vote",
  "domain": null,
  "prompt": "Music in restaurants: atmosphere, or noise?",
  "options": [
   "Atmosphere",
   "Noise"
  ],
  "topic": "music",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-f173",
  "surface": "feed",
  "seq": 224,
  "type": "vote",
  "domain": null,
  "prompt": "The opening act: get there early, or time your arrival?",
  "options": [
   "Get there early",
   "Time your arrival"
  ],
  "topic": "music",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-f174",
  "surface": "feed",
  "seq": 225,
  "type": "vote",
  "domain": null,
  "prompt": "One artist for life: The Beatles, Beyoncé, Bach, or Bob Marley?",
  "options": [
   "The Beatles",
   "Beyoncé",
   "Bach",
   "Bob Marley"
  ],
  "topic": "music",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-f175",
  "surface": "feed",
  "seq": 226,
  "type": "vote",
  "domain": null,
  "prompt": "Singing in the shower: everyone does it, or not you?",
  "options": [
   "Everyone does it",
   "Not me"
  ],
  "topic": "music",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-f176",
  "surface": "feed",
  "seq": 227,
  "type": "vote",
  "domain": null,
  "prompt": "Explicit lyrics with kids in the car: relax, or radio edit?",
  "options": [
   "Relax",
   "Radio edit"
  ],
  "topic": "music",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-f177",
  "surface": "feed",
  "seq": 228,
  "type": "vote",
  "domain": null,
  "prompt": "Your bodyguard for one risky day: Serena Williams, The Rock, Zlatan, or Jackie Chan?",
  "options": [
   "Serena Williams",
   "The Rock",
   "Zlatan",
   "Jackie Chan"
  ],
  "topic": "people",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-f178",
  "surface": "feed",
  "seq": 229,
  "type": "vote",
  "domain": null,
  "prompt": "Your life story, written by: Jane Austen, Ernest Hemingway, or Agatha Christie?",
  "options": [
   "Jane Austen",
   "Ernest Hemingway",
   "Agatha Christie"
  ],
  "topic": "people",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-f179",
  "surface": "feed",
  "seq": 230,
  "type": "vote",
  "domain": null,
  "prompt": "Marooned with one: Bear Grylls, Marie Kondo, Gordon Ramsay, or David Attenborough?",
  "options": [
   "Bear Grylls",
   "Marie Kondo",
   "Gordon Ramsay",
   "David Attenborough"
  ],
  "topic": "people",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-f180",
  "surface": "feed",
  "seq": 231,
  "type": "vote",
  "domain": null,
  "prompt": "Who'd win at chess: Napoleon, or Einstein?",
  "options": [
   "Napoleon",
   "Einstein"
  ],
  "topic": "people",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-f181",
  "surface": "feed",
  "seq": 232,
  "type": "vote",
  "domain": null,
  "prompt": "Your fictional neighbour: Sherlock Holmes, Mary Poppins, Gandalf, or Homer Simpson?",
  "options": [
   "Sherlock Holmes",
   "Mary Poppins",
   "Gandalf",
   "Homer Simpson"
  ],
  "topic": "people",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-dl20",
  "surface": "feed",
  "seq": 233,
  "type": "dial",
  "domain": null,
  "prompt": "Minutes of stoppage time that feel honest?",
  "options": [
   "0–1 min",
   "1–3 min",
   "3–4 min",
   "4–5 min",
   "5–6 min",
   "6–8 min",
   "8–9 min",
   "9–10 min",
   "10–11 min",
   "11–13 min",
   "13–14 min",
   "14–15 min"
  ],
  "topic": "sport",
  "axis": null,
  "test": null,
  "lo": 0,
  "hi": 15,
  "unit": "min"
 },
 {
  "id": "feed-dl21",
  "surface": "feed",
  "seq": 234,
  "type": "dial",
  "domain": null,
  "prompt": "Browser tabs open right now?",
  "options": [
   "0–4 tabs",
   "4–8 tabs",
   "8–13 tabs",
   "13–17 tabs",
   "17–21 tabs",
   "21–25 tabs",
   "25–29 tabs",
   "29–33 tabs",
   "33–38 tabs",
   "38–42 tabs",
   "42–46 tabs",
   "46–50 tabs"
  ],
  "topic": "tech",
  "axis": null,
  "test": null,
  "lo": 0,
  "hi": 50,
  "unit": "tabs"
 },
 {
  "id": "feed-dl22",
  "surface": "feed",
  "seq": 235,
  "type": "dial",
  "domain": null,
  "prompt": "Seconds a silence can sit comfortably?",
  "options": [
   "0–5 s",
   "5–10 s",
   "10–15 s",
   "15–20 s",
   "20–25 s",
   "25–30 s",
   "30–35 s",
   "35–40 s",
   "40–45 s",
   "45–50 s",
   "50–55 s",
   "55–60 s"
  ],
  "topic": "culture",
  "axis": null,
  "test": null,
  "lo": 0,
  "hi": 60,
  "unit": "s"
 },
 {
  "id": "feed-dl23",
  "surface": "feed",
  "seq": 236,
  "type": "dial",
  "domain": null,
  "prompt": "Too late for coffee — from what hour?",
  "options": [
   "10–11 h",
   "11–12 h",
   "12–13 h",
   "13–14 h",
   "14–15 h",
   "15–16 h",
   "16–17 h",
   "17–18 h",
   "18–19 h",
   "19–20 h",
   "20–21 h",
   "21–22 h"
  ],
  "topic": "food",
  "axis": null,
  "test": null,
  "lo": 10,
  "hi": 22,
  "unit": "h"
 },
 {
  "id": "feed-dl24",
  "surface": "feed",
  "seq": 237,
  "type": "dial",
  "domain": null,
  "prompt": "Cinema trips in a year?",
  "options": [
   "0–4 trips",
   "4–8 trips",
   "8–13 trips",
   "13–17 trips",
   "17–21 trips",
   "21–25 trips",
   "25–29 trips",
   "29–33 trips",
   "33–38 trips",
   "38–42 trips",
   "42–46 trips",
   "46–50 trips"
  ],
  "topic": "movies",
  "axis": null,
  "test": null,
  "lo": 0,
  "hi": 50,
  "unit": "trips"
 },
 {
  "id": "feed-dl25",
  "surface": "feed",
  "seq": 238,
  "type": "dial",
  "domain": null,
  "prompt": "How many big decisions does a life turn on?",
  "options": [
   "0–2 decisions",
   "2–3 decisions",
   "3–5 decisions",
   "5–7 decisions",
   "7–8 decisions",
   "8–10 decisions",
   "10–12 decisions",
   "12–13 decisions",
   "13–15 decisions",
   "15–17 decisions",
   "17–18 decisions",
   "18–20 decisions"
  ],
  "topic": "bigq",
  "axis": null,
  "test": null,
  "lo": 0,
  "hi": 20,
  "unit": "decisions"
 },
 {
  "id": "feed-dl26",
  "surface": "feed",
  "seq": 239,
  "type": "dial",
  "domain": null,
  "prompt": "A fair finder's fee, in percent?",
  "options": [
   "0–4%",
   "4–8%",
   "8–13%",
   "13–17%",
   "17–21%",
   "21–25%",
   "25–29%",
   "29–33%",
   "33–38%",
   "38–42%",
   "42–46%",
   "46–50%"
  ],
  "topic": "dilemma",
  "axis": null,
  "test": null,
  "lo": 0,
  "hi": 50,
  "unit": "%"
 },
 {
  "id": "feed-dl27",
  "surface": "feed",
  "seq": 240,
  "type": "dial",
  "domain": null,
  "prompt": "Hours of news in your week?",
  "options": [
   "0–2 h",
   "2–3 h",
   "3–5 h",
   "5–7 h",
   "7–8 h",
   "8–10 h",
   "10–12 h",
   "12–13 h",
   "13–15 h",
   "15–17 h",
   "17–18 h",
   "18–20 h"
  ],
  "topic": "event",
  "axis": null,
  "test": null,
  "lo": 0,
  "hi": 20,
  "unit": "h"
 },
 {
  "id": "feed-dl28",
  "surface": "feed",
  "seq": 241,
  "type": "dial",
  "domain": null,
  "prompt": "Your favourite song comes on — volume, in percent?",
  "options": [
   "0–8%",
   "8–17%",
   "17–25%",
   "25–33%",
   "33–42%",
   "42–50%",
   "50–58%",
   "58–67%",
   "67–75%",
   "75–83%",
   "83–92%",
   "92–100%"
  ],
  "topic": "music",
  "axis": null,
  "test": null,
  "lo": 0,
  "hi": 100,
  "unit": "%"
 },
 {
  "id": "feed-dl29",
  "surface": "feed",
  "seq": 242,
  "type": "dial",
  "domain": null,
  "prompt": "Autographs you've asked for, ever?",
  "options": [
   "0–2 autographs",
   "2–3 autographs",
   "3–5 autographs",
   "5–7 autographs",
   "7–8 autographs",
   "8–10 autographs",
   "10–12 autographs",
   "12–13 autographs",
   "13–15 autographs",
   "15–17 autographs",
   "17–18 autographs",
   "18–20 autographs"
  ],
  "topic": "people",
  "axis": null,
  "test": null,
  "lo": 0,
  "hi": 20,
  "unit": "autographs"
 },
 {
  "id": "feed-fd5",
  "surface": "feed",
  "seq": 243,
  "type": "field",
  "domain": null,
  "prompt": "Losing — place it",
  "options": [
   "shrug it off · personal",
   "lean shrug it off · personal",
   "lean carry it · personal",
   "carry it · personal",
   "shrug it off · middle",
   "lean shrug it off · middle",
   "lean carry it · middle",
   "carry it · middle",
   "shrug it off · just a game",
   "lean shrug it off · just a game",
   "lean carry it · just a game",
   "carry it · just a game"
  ],
  "topic": "sport",
  "axis": null,
  "test": null,
  "ax": [
   "shrug it off",
   "carry it"
  ],
  "ay": [
   "just a game",
   "personal"
  ]
 },
 {
  "id": "feed-fd6",
  "surface": "feed",
  "seq": 244,
  "type": "field",
  "domain": null,
  "prompt": "Your phone — place it",
  "options": [
   "a tool · runs you",
   "lean a tool · runs you",
   "lean a limb · runs you",
   "a limb · runs you",
   "a tool · middle",
   "lean a tool · middle",
   "lean a limb · middle",
   "a limb · middle",
   "a tool · serves you",
   "lean a tool · serves you",
   "lean a limb · serves you",
   "a limb · serves you"
  ],
  "topic": "tech",
  "axis": null,
  "test": null,
  "ax": [
   "a tool",
   "a limb"
  ],
  "ay": [
   "serves you",
   "runs you"
  ]
 },
 {
  "id": "feed-fd7",
  "surface": "feed",
  "seq": 245,
  "type": "field",
  "domain": null,
  "prompt": "Hosting — place it",
  "options": [
   "full house · a duty",
   "lean full house · a duty",
   "lean quiet house · a duty",
   "quiet house · a duty",
   "full house · middle",
   "lean full house · middle",
   "lean quiet house · middle",
   "quiet house · middle",
   "full house · a joy",
   "lean full house · a joy",
   "lean quiet house · a joy",
   "quiet house · a joy"
  ],
  "topic": "culture",
  "axis": null,
  "test": null,
  "ax": [
   "full house",
   "quiet house"
  ],
  "ay": [
   "a joy",
   "a duty"
  ]
 },
 {
  "id": "feed-fd8",
  "surface": "feed",
  "seq": 246,
  "type": "field",
  "domain": null,
  "prompt": "Cooking — place it",
  "options": [
   "a chore · improvised",
   "lean a chore · improvised",
   "lean therapy · improvised",
   "therapy · improvised",
   "a chore · middle",
   "lean a chore · middle",
   "lean therapy · middle",
   "therapy · middle",
   "a chore · by the book",
   "lean a chore · by the book",
   "lean therapy · by the book",
   "therapy · by the book"
  ],
  "topic": "food",
  "axis": null,
  "test": null,
  "ax": [
   "a chore",
   "therapy"
  ],
  "ay": [
   "by the book",
   "improvised"
  ]
 },
 {
  "id": "feed-fd9",
  "surface": "feed",
  "seq": 247,
  "type": "field",
  "domain": null,
  "prompt": "Horror films — place it",
  "options": [
   "can’t watch · art",
   "lean can’t watch · art",
   "lean can’t stop · art",
   "can’t stop · art",
   "can’t watch · middle",
   "lean can’t watch · middle",
   "lean can’t stop · middle",
   "can’t stop · middle",
   "can’t watch · silly",
   "lean can’t watch · silly",
   "lean can’t stop · silly",
   "can’t stop · silly"
  ],
  "topic": "movies",
  "axis": null,
  "test": null,
  "ax": [
   "can’t watch",
   "can’t stop"
  ],
  "ay": [
   "silly",
   "art"
  ]
 },
 {
  "id": "feed-n11",
  "surface": "feed",
  "seq": 248,
  "type": "vote",
  "domain": null,
  "prompt": "Eight years in transit, and a probe finally arrives at Mercury. Slow space travel: the grandeur, or the problem?",
  "options": [
   "The grandeur",
   "The problem",
   "Wait — eight years?"
  ],
  "topic": "now",
  "axis": null,
  "test": null,
  "from": "2026-09-03",
  "until": "2026-09-08",
  "bg": "ESA and JAXA's BepiColombo launched in October 2018 and began its Mercury arrival on 3 September 2026 — the transfer module separating before the two orbiters enter orbit in November. Science operations start in spring 2027."
 },
 {
  "id": "feed-n12",
  "surface": "feed",
  "seq": 249,
  "type": "vote",
  "domain": null,
  "prompt": "Vinyl is closing in on the CD again. Which do you actually play: the record, the disc, or the stream?",
  "options": [
   "The record",
   "The disc",
   "The stream"
  ],
  "topic": "now",
  "axis": null,
  "test": null,
  "from": "2026-09-03",
  "until": "2026-09-09",
  "bg": "US recorded-music revenue neared $6 billion in the first half of 2026 on paid-streaming growth, with vinyl closing in on CDs by units sold — even at an average LP price more than double a CD's."
 },
 {
  "id": "feed-n13",
  "surface": "feed",
  "seq": 250,
  "type": "vote",
  "domain": null,
  "prompt": "Fashion month begins, Manhattan to Milan. Does the runway ever reach your wardrobe?",
  "options": [
   "Eventually, diluted",
   "Straight away",
   "Never — and proudly"
  ],
  "topic": "now",
  "axis": null,
  "test": null,
  "from": "2026-09-03",
  "until": "2026-09-10",
  "bg": "September is fashion's busiest stretch: the spring shows run from New York through London and Milan to Paris, setting what stores carry next year. London's week overlaps the city's Design Festival."
 },
 {
  "id": "feed-dl30",
  "surface": "feed",
  "seq": 251,
  "type": "dial",
  "domain": null,
  "prompt": "Daily screen time — where does “too much” start?",
  "options": [
   "0–2 h",
   "2–4 h",
   "4–6 h",
   "6–8 h",
   "8–10 h",
   "10–12 h",
   "12–14 h",
   "14–16 h",
   "16–18 h",
   "18–20 h",
   "20–22 h",
   "22–24 h"
  ],
  "topic": "dilemma",
  "axis": null,
  "test": null,
  "also": [
   "tech"
  ],
  "lo": 0,
  "hi": 24,
  "unit": "h",
  "bg": "Surveys put worldwide daily screen time near seven hours, work included. Formal guidance exists mainly for children — the WHO advises essentially none before age two.",
  "core": true
 },
 {
  "id": "feed-dl31",
  "surface": "feed",
  "seq": 252,
  "type": "dial",
  "domain": null,
  "prompt": "At what age is an athlete past their peak?",
  "options": [
   "20–23 yrs",
   "23–25 yrs",
   "25–28 yrs",
   "28–30 yrs",
   "30–33 yrs",
   "33–35 yrs",
   "35–38 yrs",
   "38–40 yrs",
   "40–43 yrs",
   "43–45 yrs",
   "45–48 yrs",
   "48–50 yrs"
  ],
  "topic": "sport",
  "axis": null,
  "test": null,
  "lo": 20,
  "hi": 50,
  "unit": "yrs",
  "bg": "Sports science places most athletic peaks between 25 and 30 — sprinters earlier, endurance athletes and goalkeepers later. Tom Brady won a Super Bowl at 43; gymnasts have won world titles at 16."
 },
 {
  "id": "feed-dl32",
  "surface": "feed",
  "seq": 253,
  "type": "dial",
  "domain": null,
  "prompt": "How many coffees a day is too many?",
  "options": [
   "0–1 cups",
   "1–2 cups",
   "2–3 cups",
   "3–4 cups",
   "4–5 cups",
   "5–6 cups",
   "6–7 cups",
   "7–8 cups",
   "8–9 cups",
   "9–10 cups",
   "10–11 cups",
   "11–12 cups"
  ],
  "topic": "food",
  "axis": null,
  "test": null,
  "lo": 0,
  "hi": 12,
  "unit": "cups",
  "bg": "Europe's food-safety authority puts routine caffeine intake up to 400 mg a day — roughly four to five cups of coffee — within safe limits for healthy adults, and half that in pregnancy."
 },
 {
  "id": "feed-dl33",
  "surface": "feed",
  "seq": 254,
  "type": "dial",
  "domain": null,
  "prompt": "How long should a concert be?",
  "options": [
   "30–50 min",
   "50–70 min",
   "70–90 min",
   "90–110 min",
   "110–130 min",
   "130–150 min",
   "150–170 min",
   "170–190 min",
   "190–210 min",
   "210–230 min",
   "230–250 min",
   "250–270 min"
  ],
  "topic": "music",
  "axis": null,
  "test": null,
  "lo": 30,
  "hi": 270,
  "unit": "min"
 },
 {
  "id": "feed-dl34",
  "surface": "feed",
  "seq": 255,
  "type": "dial",
  "domain": null,
  "prompt": "How many close friends does a person need?",
  "options": [
   "0–1 friends",
   "1–2 friends",
   "2–3 friends",
   "3–4 friends",
   "4–5 friends",
   "5–6 friends",
   "6–7 friends",
   "7–8 friends",
   "8–9 friends",
   "9–10 friends",
   "10–11 friends",
   "11–12 friends"
  ],
  "topic": "bigq",
  "axis": null,
  "test": null,
  "lo": 0,
  "hi": 12,
  "unit": "friends"
 },
 {
  "id": "feed-dl35",
  "surface": "feed",
  "seq": 256,
  "type": "dial",
  "domain": null,
  "prompt": "How many hours a day on a phone is too many?",
  "options": [
   "0–2 h",
   "2–4 h",
   "4–6 h",
   "6–8 h",
   "8–10 h",
   "10–12 h",
   "12–14 h",
   "14–16 h",
   "16–18 h",
   "18–20 h",
   "20–22 h",
   "22–24 h"
  ],
  "topic": "tech",
  "axis": null,
  "test": null,
  "lo": 0,
  "hi": 24,
  "unit": "h"
 },
 {
  "id": "feed-dl36",
  "surface": "feed",
  "seq": 257,
  "type": "dial",
  "domain": null,
  "prompt": "Books finished last year — how many?",
  "options": [
   "0–5 books",
   "5–10 books",
   "10–15 books",
   "15–20 books",
   "20–25 books",
   "25–30 books",
   "30–35 books",
   "35–40 books",
   "40–45 books",
   "45–50 books",
   "50–55 books",
   "55–60 books"
  ],
  "topic": "culture",
  "axis": null,
  "test": null,
  "lo": 0,
  "hi": 60,
  "unit": "books"
 },
 {
  "id": "feed-dl37",
  "surface": "feed",
  "seq": 258,
  "type": "dial",
  "domain": null,
  "prompt": "Hours of live sport in a good week?",
  "options": [
   "0–2 h",
   "2–4 h",
   "4–6 h",
   "6–8 h",
   "8–10 h",
   "10–12 h",
   "12–14 h",
   "14–16 h",
   "16–18 h",
   "18–20 h",
   "20–22 h",
   "22–24 h"
  ],
  "topic": "sport",
  "axis": null,
  "test": null,
  "lo": 0,
  "hi": 24,
  "unit": "h"
 },
 {
  "id": "feed-dl38",
  "surface": "feed",
  "seq": 259,
  "type": "dial",
  "domain": null,
  "prompt": "How old were you when your taste in music settled?",
  "options": [
   "5–9 yrs",
   "9–13 yrs",
   "13–16 yrs",
   "16–20 yrs",
   "20–24 yrs",
   "24–28 yrs",
   "28–31 yrs",
   "31–35 yrs",
   "35–39 yrs",
   "39–43 yrs",
   "43–46 yrs",
   "46–50 yrs"
  ],
  "topic": "music",
  "axis": null,
  "test": null,
  "lo": 5,
  "hi": 50,
  "unit": "yrs"
 },
 {
  "id": "feed-dl39",
  "surface": "feed",
  "seq": 260,
  "type": "dial",
  "domain": null,
  "prompt": "Meals cooked from scratch in a week?",
  "options": [
   "0–2 meals",
   "2–4 meals",
   "4–5 meals",
   "5–7 meals",
   "7–9 meals",
   "9–11 meals",
   "11–12 meals",
   "12–14 meals",
   "14–16 meals",
   "16–18 meals",
   "18–19 meals",
   "19–21 meals"
  ],
  "topic": "food",
  "axis": null,
  "test": null,
  "lo": 0,
  "hi": 21,
  "unit": "meals"
 },
 {
  "id": "feed-dl40",
  "surface": "feed",
  "seq": 261,
  "type": "dial",
  "domain": null,
  "prompt": "The ideal dinner hour?",
  "options": [
   "12–13 h",
   "13–14 h",
   "14–15 h",
   "15–16 h",
   "16–17 h",
   "17–18 h",
   "18–19 h",
   "19–20 h",
   "20–21 h",
   "21–22 h",
   "22–23 h",
   "23–24 h"
  ],
  "topic": "food",
  "axis": null,
  "test": null,
  "lo": 12,
  "hi": 24,
  "unit": "h"
 },
 {
  "id": "feed-dl41",
  "surface": "feed",
  "seq": 262,
  "type": "dial",
  "domain": null,
  "prompt": "How many years ahead do you actually plan?",
  "options": [
   "0–3 years",
   "3–5 years",
   "5–8 years",
   "8–10 years",
   "10–13 years",
   "13–15 years",
   "15–18 years",
   "18–20 years",
   "20–23 years",
   "23–25 years",
   "25–28 years",
   "28–30 years"
  ],
  "topic": "bigq",
  "axis": null,
  "test": null,
  "lo": 0,
  "hi": 30,
  "unit": "years"
 },
 {
  "id": "feed-dl42",
  "surface": "feed",
  "seq": 263,
  "type": "dial",
  "domain": null,
  "prompt": "Minutes late before it counts as late?",
  "options": [
   "0–5 min",
   "5–10 min",
   "10–15 min",
   "15–20 min",
   "20–25 min",
   "25–30 min",
   "30–35 min",
   "35–40 min",
   "40–45 min",
   "45–50 min",
   "50–55 min",
   "55–60 min"
  ],
  "topic": "culture",
  "axis": null,
  "test": null,
  "lo": 0,
  "hi": 60,
  "unit": "min"
 },
 {
  "id": "feed-dl43",
  "surface": "feed",
  "seq": 264,
  "type": "dial",
  "domain": null,
  "prompt": "How many songs on a perfect album?",
  "options": [
   "6–8 songs",
   "8–10 songs",
   "10–12 songs",
   "12–14 songs",
   "14–16 songs",
   "16–18 songs",
   "18–20 songs",
   "20–22 songs",
   "22–24 songs",
   "24–26 songs",
   "26–28 songs",
   "28–30 songs"
  ],
  "topic": "music",
  "axis": null,
  "test": null,
  "lo": 6,
  "hi": 30,
  "unit": "songs"
 },
 {
  "id": "feed-n14",
  "surface": "feed",
  "seq": 265,
  "type": "vote",
  "domain": null,
  "prompt": "Flying cars land at the tech fair again. A dream worth keeping, or a bit that got old?",
  "options": [
   "Keep the dream",
   "It got old",
   "Just build trains"
  ],
  "topic": "now",
  "axis": null,
  "test": null,
  "from": "2026-09-05",
  "until": "2026-09-11",
  "bg": "IFA Berlin, Europe's biggest consumer-tech fair, opened on 4 September — 1,900 brands across 190,000 square metres, AI in everything from fridges to laptops, and, once again, flying-car concepts on the floor. It runs to 8 September."
 },
 {
  "id": "feed-n15",
  "surface": "feed",
  "seq": 266,
  "type": "vote",
  "domain": null,
  "prompt": "A season opening on a Wednesday for the first time in a decade: fine, or leave the rituals alone?",
  "options": [
   "Fine — a game's a game",
   "Leave the rituals alone"
  ],
  "topic": "now",
  "axis": null,
  "test": null,
  "from": "2026-09-05",
  "until": "2026-09-12",
  "bg": "The NFL's 2026 season opens on Wednesday 9 September in Seattle — a Super Bowl rematch against New England, and the league's first Wednesday opener in well over a decade. Season openers traditionally hold Thursday night."
 },
 {
  "id": "feed-f182",
  "surface": "feed",
  "seq": 267,
  "type": "vote",
  "domain": null,
  "prompt": "A one-club career: nobler, or just rarer?",
  "options": [
   "Nobler",
   "Just rarer"
  ],
  "topic": "sport",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-f183",
  "surface": "feed",
  "seq": 268,
  "type": "vote",
  "domain": null,
  "prompt": "Sports films: better than the real thing, or never close?",
  "options": [
   "Sometimes better",
   "Never close"
  ],
  "topic": "sport",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-f184",
  "surface": "feed",
  "seq": 269,
  "type": "vote",
  "domain": null,
  "prompt": "Commentary: essential company, or mute and watch?",
  "options": [
   "Essential company",
   "Mute and watch"
  ],
  "topic": "sport",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-f185",
  "surface": "feed",
  "seq": 270,
  "type": "vote",
  "domain": null,
  "prompt": "Warming up: sacred, or skipped?",
  "options": [
   "Sacred",
   "Skipped"
  ],
  "topic": "sport",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-f186",
  "surface": "feed",
  "seq": 271,
  "type": "vote",
  "domain": null,
  "prompt": "A watch tracking your sleep: insight, or anxiety?",
  "options": [
   "Insight",
   "Anxiety"
  ],
  "topic": "tech",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-f187",
  "surface": "feed",
  "seq": 272,
  "type": "vote",
  "domain": null,
  "prompt": "Old phones in the drawer: an archive, or a hoard?",
  "options": [
   "An archive",
   "A hoard"
  ],
  "topic": "tech",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-f188",
  "surface": "feed",
  "seq": 273,
  "type": "vote",
  "domain": null,
  "prompt": "Passwords: a manager, or your own good system?",
  "options": [
   "A manager",
   "My own system"
  ],
  "topic": "tech",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-f189",
  "surface": "feed",
  "seq": 274,
  "type": "vote",
  "domain": null,
  "prompt": "QR-code menus: fine now, or bring back paper?",
  "options": [
   "Fine now",
   "Bring back paper"
  ],
  "topic": "tech",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-f190",
  "surface": "feed",
  "seq": 275,
  "type": "vote",
  "domain": null,
  "prompt": "Is nostalgia a friend, or a liar?",
  "options": [
   "A friend",
   "A liar"
  ],
  "topic": "bigq",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-f191",
  "surface": "feed",
  "seq": 276,
  "type": "vote",
  "domain": null,
  "prompt": "Would you rather be right, or be kind?",
  "options": [
   "Right",
   "Kind"
  ],
  "topic": "bigq",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-f192",
  "surface": "feed",
  "seq": 277,
  "type": "vote",
  "domain": null,
  "prompt": "Does everything happen for a reason?",
  "options": [
   "It does",
   "It doesn’t"
  ],
  "topic": "bigq",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-f193",
  "surface": "feed",
  "seq": 278,
  "type": "vote",
  "domain": null,
  "prompt": "The unexamined life: actually fine?",
  "options": [
   "Actually fine",
   "Socrates was right"
  ],
  "topic": "bigq",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-f194",
  "surface": "feed",
  "seq": 279,
  "type": "vote",
  "domain": null,
  "prompt": "Big fish in a small pond, or small fish in a big one?",
  "options": [
   "Big fish, small pond",
   "Small fish, big pond"
  ],
  "topic": "bigq",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-f195",
  "surface": "feed",
  "seq": 280,
  "type": "vote",
  "domain": null,
  "prompt": "Talking to strangers on a train: welcome, or headphones in?",
  "options": [
   "Welcome",
   "Headphones in"
  ],
  "topic": "culture",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-f196",
  "surface": "feed",
  "seq": 281,
  "type": "vote",
  "domain": null,
  "prompt": "Gift cards: thoughtful enough, or an apology?",
  "options": [
   "Thoughtful enough",
   "An apology"
  ],
  "topic": "culture",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-f197",
  "surface": "feed",
  "seq": 282,
  "type": "vote",
  "domain": null,
  "prompt": "House shoes for guests: offer them, or never?",
  "options": [
   "Offer them",
   "Never"
  ],
  "topic": "culture",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-f198",
  "surface": "feed",
  "seq": 283,
  "type": "vote",
  "domain": null,
  "prompt": "The group photo: the organiser, or the edge-lurker?",
  "options": [
   "The organiser",
   "The edge-lurker"
  ],
  "topic": "culture",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-f199",
  "surface": "feed",
  "seq": 284,
  "type": "vote",
  "domain": null,
  "prompt": "Speak every language, or play every instrument?",
  "options": [
   "Every language",
   "Every instrument"
  ],
  "topic": "dilemma",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-f200",
  "surface": "feed",
  "seq": 285,
  "type": "vote",
  "domain": null,
  "prompt": "Always know the truth, or always be happy?",
  "options": [
   "The truth",
   "Happy"
  ],
  "topic": "dilemma",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-f201",
  "surface": "feed",
  "seq": 286,
  "type": "vote",
  "domain": null,
  "prompt": "Your memories of a trip, or the photos of it — keep only one?",
  "options": [
   "The memories",
   "The photos"
  ],
  "topic": "dilemma",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-f202",
  "surface": "feed",
  "seq": 287,
  "type": "vote",
  "domain": null,
  "prompt": "Free flights forever, or free food forever?",
  "options": [
   "Free flights",
   "Free food"
  ],
  "topic": "dilemma",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-f203",
  "surface": "feed",
  "seq": 288,
  "type": "vote",
  "domain": null,
  "prompt": "Perfect sleep every night, or perfect meals every day?",
  "options": [
   "Perfect sleep",
   "Perfect meals"
  ],
  "topic": "dilemma",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-f204",
  "surface": "feed",
  "seq": 289,
  "type": "vote",
  "domain": null,
  "prompt": "Ticket resale above face value: the market, or scalping?",
  "options": [
   "The market",
   "Scalping"
  ],
  "topic": "event",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-f205",
  "surface": "feed",
  "seq": 290,
  "type": "vote",
  "domain": null,
  "prompt": "Election day as a public holiday: overdue, or unnecessary?",
  "options": [
   "Overdue",
   "Unnecessary"
  ],
  "topic": "event",
  "axis": null,
  "test": null,
  "political": true
 },
 {
  "id": "feed-f206",
  "surface": "feed",
  "seq": 291,
  "type": "vote",
  "domain": null,
  "prompt": "Space junk: whoever launched it cleans it, or everyone together?",
  "options": [
   "The launchers",
   "Everyone together"
  ],
  "topic": "event",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-f207",
  "surface": "feed",
  "seq": 292,
  "type": "vote",
  "domain": null,
  "prompt": "Museums lending famous works abroad: generous, or risky?",
  "options": [
   "Generous",
   "Risky"
  ],
  "topic": "event",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-f208",
  "surface": "feed",
  "seq": 293,
  "type": "vote",
  "domain": null,
  "prompt": "A four-day festival, or four one-day concerts?",
  "options": [
   "The festival",
   "Four concerts"
  ],
  "topic": "event",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-f209",
  "surface": "feed",
  "seq": 294,
  "type": "vote",
  "domain": null,
  "prompt": "Salad as a main: a meal, or a side that got ambitious?",
  "options": [
   "A meal",
   "An ambitious side"
  ],
  "topic": "food",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-f210",
  "surface": "feed",
  "seq": 295,
  "type": "vote",
  "domain": null,
  "prompt": "Tea: milk first, or tea first?",
  "options": [
   "Milk first",
   "Tea first"
  ],
  "topic": "food",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-f211",
  "surface": "feed",
  "seq": 296,
  "type": "vote",
  "domain": null,
  "prompt": "The bread basket: restraint, or ruin your appetite happily?",
  "options": [
   "Restraint",
   "Ruin it happily"
  ],
  "topic": "food",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-f212",
  "surface": "feed",
  "seq": 297,
  "type": "vote",
  "domain": null,
  "prompt": "Fruit: on the counter, or in the fridge?",
  "options": [
   "On the counter",
   "In the fridge"
  ],
  "topic": "food",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-f213",
  "surface": "feed",
  "seq": 298,
  "type": "vote",
  "domain": null,
  "prompt": "The cinema alone: a pleasure, or a last resort?",
  "options": [
   "A pleasure",
   "A last resort"
  ],
  "topic": "movies",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-f214",
  "surface": "feed",
  "seq": 299,
  "type": "vote",
  "domain": null,
  "prompt": "Film scores: half the film, or background?",
  "options": [
   "Half the film",
   "Background"
  ],
  "topic": "movies",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-f215",
  "surface": "feed",
  "seq": 300,
  "type": "vote",
  "domain": null,
  "prompt": "Opening weekend, or wait for the verdict?",
  "options": [
   "Opening weekend",
   "Wait for the verdict"
  ],
  "topic": "movies",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-f216",
  "surface": "feed",
  "seq": 301,
  "type": "vote",
  "domain": null,
  "prompt": "Actors doing accents: commit, or don’t bother?",
  "options": [
   "Commit",
   "Don’t bother"
  ],
  "topic": "movies",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-f217",
  "surface": "feed",
  "seq": 302,
  "type": "vote",
  "domain": null,
  "prompt": "Live music: outdoors under the sky, or in a room built for it?",
  "options": [
   "Under the sky",
   "A room built for it"
  ],
  "topic": "music",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-f218",
  "surface": "feed",
  "seq": 303,
  "type": "vote",
  "domain": null,
  "prompt": "Lyrics you’ve misheard for years: correct them, or keep yours?",
  "options": [
   "Correct them",
   "Keep mine"
  ],
  "topic": "music",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-f219",
  "surface": "feed",
  "seq": 304,
  "type": "vote",
  "domain": null,
  "prompt": "An album on shuffle: harmless, or heresy?",
  "options": [
   "Harmless",
   "Heresy"
  ],
  "topic": "music",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-f220",
  "surface": "feed",
  "seq": 305,
  "type": "vote",
  "domain": null,
  "prompt": "The perfect concert companion: the superfan, or the first-timer?",
  "options": [
   "The superfan",
   "The first-timer"
  ],
  "topic": "music",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-f221",
  "surface": "feed",
  "seq": 306,
  "type": "vote",
  "domain": null,
  "prompt": "Wedding band, or wedding DJ?",
  "options": [
   "Band",
   "DJ"
  ],
  "topic": "music",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-f222",
  "surface": "feed",
  "seq": 307,
  "type": "vote",
  "domain": null,
  "prompt": "Your driving instructor: Lewis Hamilton, or your mum?",
  "options": [
   "Lewis Hamilton",
   "My mum"
  ],
  "topic": "people",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-f223",
  "surface": "feed",
  "seq": 308,
  "type": "vote",
  "domain": null,
  "prompt": "A duet with: Freddie Mercury, Aretha Franklin, or Frank Sinatra?",
  "options": [
   "Freddie Mercury",
   "Aretha Franklin",
   "Frank Sinatra"
  ],
  "topic": "people",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-f224",
  "surface": "feed",
  "seq": 309,
  "type": "vote",
  "domain": null,
  "prompt": "Whose wardrobe: David Bowie’s, Audrey Hepburn’s, or Pharrell’s?",
  "options": [
   "David Bowie’s",
   "Audrey Hepburn’s",
   "Pharrell’s"
  ],
  "topic": "people",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-f225",
  "surface": "feed",
  "seq": 310,
  "type": "vote",
  "domain": null,
  "prompt": "The group project partner: Hermione Granger, or Tony Stark?",
  "options": [
   "Hermione Granger",
   "Tony Stark"
  ],
  "topic": "people",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-f226",
  "surface": "feed",
  "seq": 311,
  "type": "vote",
  "domain": null,
  "prompt": "Who’d survive a week in your job: Gordon Ramsay, Oprah, or The Rock?",
  "options": [
   "Gordon Ramsay",
   "Oprah",
   "The Rock"
  ],
  "topic": "people",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-dl44",
  "surface": "feed",
  "seq": 312,
  "type": "dial",
  "domain": null,
  "prompt": "Push-ups you could do right now?",
  "options": [
   "0–5 push-ups",
   "5–10 push-ups",
   "10–15 push-ups",
   "15–20 push-ups",
   "20–25 push-ups",
   "25–30 push-ups",
   "30–35 push-ups",
   "35–40 push-ups",
   "40–45 push-ups",
   "45–50 push-ups",
   "50–55 push-ups",
   "55–60 push-ups"
  ],
  "topic": "sport",
  "axis": null,
  "test": null,
  "lo": 0,
  "hi": 60,
  "unit": "push-ups"
 },
 {
  "id": "feed-dl45",
  "surface": "feed",
  "seq": 313,
  "type": "dial",
  "domain": null,
  "prompt": "Unread notifications right now?",
  "options": [
   "0–10 notifications",
   "10–20 notifications",
   "20–30 notifications",
   "30–40 notifications",
   "40–50 notifications",
   "50–60 notifications",
   "60–70 notifications",
   "70–80 notifications",
   "80–90 notifications",
   "90–100 notifications",
   "100–110 notifications",
   "110–120 notifications"
  ],
  "topic": "tech",
  "axis": null,
  "test": null,
  "lo": 0,
  "hi": 120,
  "unit": "notifications"
 },
 {
  "id": "feed-dl46",
  "surface": "feed",
  "seq": 314,
  "type": "dial",
  "domain": null,
  "prompt": "How many lives would you want to live, if you could?",
  "options": [
   "0–1 lives",
   "1–2 lives",
   "2–3 lives",
   "3–4 lives",
   "4–5 lives",
   "5–6 lives",
   "6–7 lives",
   "7–8 lives",
   "8–9 lives",
   "9–10 lives",
   "10–11 lives",
   "11–12 lives"
  ],
  "topic": "bigq",
  "axis": null,
  "test": null,
  "lo": 0,
  "hi": 12,
  "unit": "lives"
 },
 {
  "id": "feed-dl47",
  "surface": "feed",
  "seq": 315,
  "type": "dial",
  "domain": null,
  "prompt": "Decorations up — from which week of the year?",
  "options": [
   "0–4 weeks",
   "4–9 weeks",
   "9–13 weeks",
   "13–17 weeks",
   "17–22 weeks",
   "22–26 weeks",
   "26–30 weeks",
   "30–35 weeks",
   "35–39 weeks",
   "39–43 weeks",
   "43–48 weeks",
   "48–52 weeks"
  ],
  "topic": "culture",
  "axis": null,
  "test": null,
  "lo": 0,
  "hi": 52,
  "unit": "weeks"
 },
 {
  "id": "feed-dl48",
  "surface": "feed",
  "seq": 316,
  "type": "dial",
  "domain": null,
  "prompt": "The most you’d queue for anything, in minutes?",
  "options": [
   "0–10 min",
   "10–20 min",
   "20–30 min",
   "30–40 min",
   "40–50 min",
   "50–60 min",
   "60–70 min",
   "70–80 min",
   "80–90 min",
   "90–100 min",
   "100–110 min",
   "110–120 min"
  ],
  "topic": "dilemma",
  "axis": null,
  "test": null,
  "lo": 0,
  "hi": 120,
  "unit": "min"
 },
 {
  "id": "feed-dl49",
  "surface": "feed",
  "seq": 317,
  "type": "dial",
  "domain": null,
  "prompt": "Fireworks on New Year’s: how many minutes is right?",
  "options": [
   "0–2 min",
   "2–4 min",
   "4–6 min",
   "6–8 min",
   "8–10 min",
   "10–12 min",
   "12–14 min",
   "14–16 min",
   "16–18 min",
   "18–20 min",
   "20–22 min",
   "22–24 min"
  ],
  "topic": "event",
  "axis": null,
  "test": null,
  "lo": 0,
  "hi": 24,
  "unit": "min"
 },
 {
  "id": "feed-dl50",
  "surface": "feed",
  "seq": 318,
  "type": "dial",
  "domain": null,
  "prompt": "Spice jars in your kitchen?",
  "options": [
   "0–4 jars",
   "4–8 jars",
   "8–12 jars",
   "12–16 jars",
   "16–20 jars",
   "20–24 jars",
   "24–28 jars",
   "28–32 jars",
   "32–36 jars",
   "36–40 jars",
   "40–44 jars",
   "44–48 jars"
  ],
  "topic": "food",
  "axis": null,
  "test": null,
  "lo": 0,
  "hi": 48,
  "unit": "jars"
 },
 {
  "id": "feed-dl51",
  "surface": "feed",
  "seq": 319,
  "type": "dial",
  "domain": null,
  "prompt": "Times you’ve seen your most-watched film?",
  "options": [
   "0–2 times",
   "2–4 times",
   "4–6 times",
   "6–8 times",
   "8–10 times",
   "10–12 times",
   "12–14 times",
   "14–16 times",
   "16–18 times",
   "18–20 times",
   "20–22 times",
   "22–24 times"
  ],
  "topic": "movies",
  "axis": null,
  "test": null,
  "lo": 0,
  "hi": 24,
  "unit": "times"
 },
 {
  "id": "feed-dl52",
  "surface": "feed",
  "seq": 320,
  "type": "dial",
  "domain": null,
  "prompt": "Songs on your on-repeat playlist right now?",
  "options": [
   "0–3 songs",
   "3–6 songs",
   "6–9 songs",
   "9–12 songs",
   "12–15 songs",
   "15–18 songs",
   "18–21 songs",
   "21–24 songs",
   "24–27 songs",
   "27–30 songs",
   "30–33 songs",
   "33–36 songs"
  ],
  "topic": "music",
  "axis": null,
  "test": null,
  "lo": 0,
  "hi": 36,
  "unit": "songs"
 },
 {
  "id": "feed-dl53",
  "surface": "feed",
  "seq": 321,
  "type": "dial",
  "domain": null,
  "prompt": "Posters on your teenage bedroom wall — how many?",
  "options": [
   "0–1 posters",
   "1–2 posters",
   "2–3 posters",
   "3–4 posters",
   "4–5 posters",
   "5–6 posters",
   "6–7 posters",
   "7–8 posters",
   "8–9 posters",
   "9–10 posters",
   "10–11 posters",
   "11–12 posters"
  ],
  "topic": "people",
  "axis": null,
  "test": null,
  "lo": 0,
  "hi": 12,
  "unit": "posters"
 },
 {
  "id": "feed-fd10",
  "surface": "feed",
  "seq": 322,
  "type": "field",
  "domain": null,
  "prompt": "Team loyalty — place it",
  "options": [
   "born into it · transferable",
   "lean born into it · transferable",
   "lean chosen · transferable",
   "chosen · transferable",
   "born into it · middle",
   "lean born into it · middle",
   "lean chosen · middle",
   "chosen · middle",
   "born into it · for life",
   "lean born into it · for life",
   "lean chosen · for life",
   "chosen · for life"
  ],
  "topic": "sport",
  "axis": null,
  "test": null,
  "ax": [
   "born into it",
   "chosen"
  ],
  "ay": [
   "for life",
   "transferable"
  ]
 },
 {
  "id": "feed-fd11",
  "surface": "feed",
  "seq": 323,
  "type": "field",
  "domain": null,
  "prompt": "Social media — place it",
  "options": [
   "drains me · here to stay",
   "lean drains me · here to stay",
   "lean feeds me · here to stay",
   "feeds me · here to stay",
   "drains me · middle",
   "lean drains me · middle",
   "lean feeds me · middle",
   "feeds me · middle",
   "drains me · quitting soon",
   "lean drains me · quitting soon",
   "lean feeds me · quitting soon",
   "feeds me · quitting soon"
  ],
  "topic": "tech",
  "axis": null,
  "test": null,
  "ax": [
   "drains me",
   "feeds me"
  ],
  "ay": [
   "quitting soon",
   "here to stay"
  ]
 },
 {
  "id": "feed-fd12",
  "surface": "feed",
  "seq": 324,
  "type": "field",
  "domain": null,
  "prompt": "Traditions — place it",
  "options": [
   "keep them all · confining",
   "lean keep them all · confining",
   "lean invent new · confining",
   "invent new · confining",
   "keep them all · middle",
   "lean keep them all · middle",
   "lean invent new · middle",
   "invent new · middle",
   "keep them all · comforting",
   "lean keep them all · comforting",
   "lean invent new · comforting",
   "invent new · comforting"
  ],
  "topic": "culture",
  "axis": null,
  "test": null,
  "ax": [
   "keep them all",
   "invent new"
  ],
  "ay": [
   "comforting",
   "confining"
  ]
 },
 {
  "id": "feed-fd13",
  "surface": "feed",
  "seq": 325,
  "type": "field",
  "domain": null,
  "prompt": "Snacking — place it",
  "options": [
   "a grazer · guilty",
   "lean a grazer · guilty",
   "lean three meals · guilty",
   "three meals · guilty",
   "a grazer · middle",
   "lean a grazer · middle",
   "lean three meals · middle",
   "three meals · middle",
   "a grazer · proud",
   "lean a grazer · proud",
   "lean three meals · proud",
   "three meals · proud"
  ],
  "topic": "food",
  "axis": null,
  "test": null,
  "ax": [
   "a grazer",
   "three meals"
  ],
  "ay": [
   "proud",
   "guilty"
  ]
 },
 {
  "id": "feed-fd14",
  "surface": "feed",
  "seq": 326,
  "type": "field",
  "domain": null,
  "prompt": "Sequels — place it",
  "options": [
   "never needed · real stories",
   "lean never needed · real stories",
   "lean keep them · real stories",
   "keep them · real stories",
   "never needed · middle",
   "lean never needed · middle",
   "lean keep them · middle",
   "keep them · middle",
   "never needed · cash grabs",
   "lean never needed · cash grabs",
   "lean keep them · cash grabs",
   "keep them · cash grabs"
  ],
  "topic": "movies",
  "axis": null,
  "test": null,
  "ax": [
   "never needed",
   "keep them"
  ],
  "ay": [
   "cash grabs",
   "real stories"
  ]
 },
 {
  "id": "feed-n16",
  "surface": "feed",
  "seq": 327,
  "type": "vote",
  "domain": null,
  "prompt": "Eleven districts of London fill with design installations. Public art on your daily route: a gift, or in the way?",
  "options": [
   "A gift",
   "In the way",
   "I stop noticing by Tuesday"
  ],
  "topic": "now",
  "axis": null,
  "test": null,
  "from": "2026-09-06",
  "until": "2026-09-13",
  "bg": "The 24th London Design Festival runs 12–20 September 2026: nine days of landmark installations, museum commissions and open studios across eleven design districts, from the V&A and the Barbican to a new Soho district."
 },
 {
  "id": "feed-n17",
  "surface": "feed",
  "seq": 328,
  "type": "vote",
  "domain": null,
  "prompt": "TV’s big night returns. Award shows: still appointment viewing, or a highlights reel the morning after?",
  "options": [
   "Appointment viewing",
   "The highlights after",
   "Neither, honestly"
  ],
  "topic": "now",
  "axis": null,
  "test": null,
  "from": "2026-09-06",
  "until": "2026-09-14",
  "bg": "The 78th Primetime Emmy Awards air live from the Peacock Theater in Los Angeles on 14 September 2026, hosted by Mariska Hargitay, with the Creative Arts ceremonies held the weekend before."
 },
 {
  "id": "pick-pk04",
  "surface": "feed",
  "seq": 1000,
  "type": "catalog",
  "domain": "emoji",
  "prompt": "Your most-used emoji?",
  "options": [],
  "topic": "fav",
  "axis": null,
  "test": null
 },
 {
  "id": "pick-pk05",
  "surface": "feed",
  "seq": 1001,
  "type": "catalog",
  "domain": "emoji",
  "prompt": "The most annoying emoji?",
  "options": [],
  "topic": "fav",
  "axis": null,
  "test": null
 },
 {
  "id": "pick-pk08",
  "surface": "feed",
  "seq": 1002,
  "type": "catalog",
  "domain": "emoji",
  "prompt": "The emoji you’d tattoo?",
  "options": [],
  "topic": "fav",
  "axis": null,
  "test": null
 },
 {
  "id": "pick-pk10",
  "surface": "feed",
  "seq": 1003,
  "type": "catalog",
  "domain": "emoji",
  "prompt": "The scariest emoji?",
  "options": [],
  "topic": "fav",
  "axis": null,
  "test": null
 },
 {
  "id": "pick-pk11",
  "surface": "feed",
  "seq": 1004,
  "type": "catalog",
  "domain": "elements",
  "prompt": "Your favourite element?",
  "options": [],
  "topic": "fav",
  "axis": null,
  "test": null
 },
 {
  "id": "pick-pk12",
  "surface": "feed",
  "seq": 1005,
  "type": "catalog",
  "domain": "elements",
  "prompt": "The element you’d be?",
  "options": [],
  "topic": "fav",
  "axis": null,
  "test": null
 },
 {
  "id": "pick-pk13",
  "surface": "feed",
  "seq": 1006,
  "type": "catalog",
  "domain": "elements",
  "prompt": "The best-named element?",
  "options": [],
  "topic": "fav",
  "axis": null,
  "test": null
 },
 {
  "id": "pick-pk14",
  "surface": "feed",
  "seq": 1007,
  "type": "catalog",
  "domain": "elements",
  "prompt": "The most dangerous element?",
  "options": [],
  "topic": "fav",
  "axis": null,
  "test": null
 },
 {
  "id": "pick-pk15",
  "surface": "feed",
  "seq": 1008,
  "type": "catalog",
  "domain": "emoji",
  "prompt": "The most misunderstood emoji?",
  "options": [],
  "topic": "fav",
  "axis": null,
  "test": null
 },
 {
  "id": "pick-pk16",
  "surface": "feed",
  "seq": 1009,
  "type": "catalog",
  "domain": "countries",
  "prompt": "The country you’d move to?",
  "options": [],
  "topic": "fav",
  "axis": null,
  "test": null
 },
 {
  "id": "pick-pk17",
  "surface": "feed",
  "seq": 1010,
  "type": "catalog",
  "domain": "dogs",
  "prompt": "The dog you’d get?",
  "options": [],
  "topic": "fav",
  "axis": null,
  "test": null
 },
 {
  "id": "pick-pk18",
  "surface": "feed",
  "seq": 1011,
  "type": "catalog",
  "domain": "countries",
  "prompt": "The country with the best food?",
  "options": [],
  "topic": "fav",
  "axis": null,
  "test": null
 },
 {
  "id": "pick-pk19",
  "surface": "feed",
  "seq": 1012,
  "type": "catalog",
  "domain": "dogs",
  "prompt": "The most beautiful dog?",
  "options": [],
  "topic": "fav",
  "axis": null,
  "test": null
 },
 {
  "id": "pick-pk20",
  "surface": "feed",
  "seq": 1013,
  "type": "catalog",
  "domain": "countries",
  "prompt": "The best flag in the world?",
  "options": [],
  "topic": "fav",
  "axis": null,
  "test": null
 },
 {
  "id": "pick-pk21",
  "surface": "feed",
  "seq": 1014,
  "type": "catalog",
  "domain": "dogs",
  "prompt": "The smartest dog?",
  "options": [],
  "topic": "fav",
  "axis": null,
  "test": null
 },
 {
  "id": "pick-pk22",
  "surface": "feed",
  "seq": 1015,
  "type": "catalog",
  "domain": "countries",
  "prompt": "The most beautiful country?",
  "options": [],
  "topic": "fav",
  "axis": null,
  "test": null
 },
 {
  "id": "pick-pk23",
  "surface": "feed",
  "seq": 1016,
  "type": "catalog",
  "domain": "dogs",
  "prompt": "The most fun breed to say out loud?",
  "options": [],
  "topic": "fav",
  "axis": null,
  "test": null
 },
 {
  "id": "pick-pk01",
  "surface": "feed",
  "seq": 1017,
  "type": "catalog",
  "domain": "pokemon",
  "prompt": "Favourite Pokémon?",
  "options": [],
  "topic": "fav",
  "axis": null,
  "test": null
 },
 {
  "id": "pick-pk02",
  "surface": "feed",
  "seq": 1018,
  "type": "catalog",
  "domain": "pokemon",
  "prompt": "The scariest Pokémon?",
  "options": [],
  "topic": "fav",
  "axis": null,
  "test": null
 },
 {
  "id": "pick-pk03",
  "surface": "feed",
  "seq": 1019,
  "type": "catalog",
  "domain": "pokemon",
  "prompt": "The cutest Pokémon?",
  "options": [],
  "topic": "fav",
  "axis": null,
  "test": null
 },
 {
  "id": "pick-pk06",
  "surface": "feed",
  "seq": 1020,
  "type": "catalog",
  "domain": "pokemon",
  "prompt": "The strongest Pokémon?",
  "options": [],
  "topic": "fav",
  "axis": null,
  "test": null
 },
 {
  "id": "pick-pk07",
  "surface": "feed",
  "seq": 1021,
  "type": "catalog",
  "domain": "pokemon",
  "prompt": "The Pokémon you’d be?",
  "options": [],
  "topic": "fav",
  "axis": null,
  "test": null
 },
 {
  "id": "pick-pk09",
  "surface": "feed",
  "seq": 1022,
  "type": "catalog",
  "domain": "pokemon",
  "prompt": "The best Pokémon name?",
  "options": [],
  "topic": "fav",
  "axis": null,
  "test": null
 },
 {
  "id": "pick-pk28",
  "surface": "feed",
  "seq": 1023,
  "type": "catalog",
  "domain": "athletes",
  "prompt": "The greatest athlete who ever lived?",
  "options": [],
  "topic": "fav",
  "axis": null,
  "test": null
 },
 {
  "id": "group-gu0",
  "surface": "group",
  "seq": 0,
  "type": "choice",
  "domain": null,
  "prompt": "What actually holds this group together?",
  "options": [
   "Food",
   "Banter",
   "Showing up",
   "History"
  ],
  "topic": "us",
  "axis": null,
  "test": null
 },
 {
  "id": "group-gp0",
  "surface": "group",
  "seq": 1,
  "type": "choice",
  "domain": null,
  "prompt": "Who'd survive longest in the wild?",
  "options": [],
  "topic": "pick",
  "axis": null,
  "test": null
 },
 {
  "id": "group-gu1",
  "surface": "group",
  "seq": 2,
  "type": "choice",
  "domain": null,
  "prompt": "This group's superpower?",
  "options": [
   "Honesty",
   "Loyalty",
   "Chaos",
   "Calm"
  ],
  "topic": "us",
  "axis": null,
  "test": null
 },
 {
  "id": "group-gd3",
  "surface": "group",
  "seq": 3,
  "type": "choice",
  "domain": null,
  "prompt": "Best dinner together: cook, or book a table?",
  "options": [
   "Cook together",
   "Book a table"
  ],
  "topic": "classic",
  "axis": null,
  "test": null
 },
 {
  "id": "group-gu3",
  "surface": "group",
  "seq": 4,
  "type": "choice",
  "domain": null,
  "prompt": "When we disagree, we…",
  "options": [
   "Talk it out",
   "Vote",
   "Let it slide",
   "Loudest wins"
  ],
  "topic": "us",
  "axis": null,
  "test": null
 },
 {
  "id": "group-gp1",
  "surface": "group",
  "seq": 5,
  "type": "choice",
  "domain": null,
  "prompt": "Who replies to the group chat within a minute?",
  "options": [],
  "topic": "pick",
  "axis": null,
  "test": null
 },
 {
  "id": "group-gu4",
  "surface": "group",
  "seq": 6,
  "type": "choice",
  "domain": null,
  "prompt": "A stranger joins us for an evening. They leave thinking…",
  "options": [
   "So loud",
   "So close",
   "So weird",
   "So fun"
  ],
  "topic": "us",
  "axis": null,
  "test": null
 },
 {
  "id": "group-gd0",
  "surface": "group",
  "seq": 7,
  "type": "choice",
  "domain": null,
  "prompt": "A winter cabin with no wifi. How long do you last?",
  "options": [
   "One night",
   "A weekend",
   "A week",
   "Move me in"
  ],
  "topic": "classic",
  "axis": null,
  "test": null
 },
 {
  "id": "group-gu5",
  "surface": "group",
  "seq": 8,
  "type": "choice",
  "domain": null,
  "prompt": "What are we most likely to be late for?",
  "options": [
   "Nothing",
   "Everything",
   "Dinner",
   "The airport"
  ],
  "topic": "us",
  "axis": null,
  "test": null
 },
 {
  "id": "group-gp2",
  "surface": "group",
  "seq": 9,
  "type": "choice",
  "domain": null,
  "prompt": "Who gives the best advice?",
  "options": [],
  "topic": "pick",
  "axis": null,
  "test": null
 },
 {
  "id": "group-gu2",
  "surface": "group",
  "seq": 10,
  "type": "choice",
  "domain": null,
  "prompt": "Our default plan on a free Friday?",
  "options": [
   "Big dinner",
   "Out out",
   "Sofa + film",
   "Spontaneous"
  ],
  "topic": "us",
  "axis": null,
  "test": null
 },
 {
  "id": "group-gd4",
  "surface": "group",
  "seq": 11,
  "type": "choice",
  "domain": null,
  "prompt": "A surprise party for you — love it or dread it?",
  "options": [
   "Love it",
   "Dread it"
  ],
  "topic": "classic",
  "axis": null,
  "test": null
 },
 {
  "id": "group-gu6",
  "surface": "group",
  "seq": 12,
  "type": "choice",
  "domain": null,
  "prompt": "The thing we never say out loud?",
  "options": [
   "I miss you",
   "You were right",
   "I need help",
   "We say everything"
  ],
  "topic": "us",
  "axis": null,
  "test": null
 },
 {
  "id": "group-gp3",
  "surface": "group",
  "seq": 13,
  "type": "choice",
  "domain": null,
  "prompt": "Who would you call from jail at 3am?",
  "options": [],
  "topic": "pick",
  "axis": null,
  "test": null
 },
 {
  "id": "group-gu7",
  "surface": "group",
  "seq": 14,
  "type": "choice",
  "domain": null,
  "prompt": "In ten years, this group is…",
  "options": [
   "Same but older",
   "Scattered, still close",
   "Neighbours",
   "A yearly reunion"
  ],
  "topic": "us",
  "axis": null,
  "test": null
 },
 {
  "id": "group-gd6",
  "surface": "group",
  "seq": 15,
  "type": "choice",
  "domain": null,
  "prompt": "On the road trip, you are the…",
  "options": [
   "Driver",
   "DJ",
   "Navigator",
   "Snacks"
  ],
  "topic": "classic",
  "axis": null,
  "test": null
 },
 {
  "id": "group-gu8",
  "surface": "group",
  "seq": 16,
  "type": "choice",
  "domain": null,
  "prompt": "Our group chat is mostly…",
  "options": [
   "Plans",
   "Memes",
   "Life updates",
   "Silence"
  ],
  "topic": "us",
  "axis": null,
  "test": null
 },
 {
  "id": "group-gp4",
  "surface": "group",
  "seq": 17,
  "type": "choice",
  "domain": null,
  "prompt": "Who changes the plan at the last minute?",
  "options": [],
  "topic": "pick",
  "axis": null,
  "test": null
 },
 {
  "id": "group-gu9",
  "surface": "group",
  "seq": 18,
  "type": "choice",
  "domain": null,
  "prompt": "What would break this group?",
  "options": [
   "Nothing",
   "Distance",
   "Money",
   "A secret"
  ],
  "topic": "us",
  "axis": null,
  "test": null
 },
 {
  "id": "group-gd7",
  "surface": "group",
  "seq": 19,
  "type": "choice",
  "domain": null,
  "prompt": "Group holiday: one house together, or rooms apart?",
  "options": [
   "One house",
   "Rooms apart"
  ],
  "topic": "classic",
  "axis": null,
  "test": null
 },
 {
  "id": "group-gp5",
  "surface": "group",
  "seq": 20,
  "type": "choice",
  "domain": null,
  "prompt": "Who secretly runs this group?",
  "options": [],
  "topic": "pick",
  "axis": null,
  "test": null
 },
 {
  "id": "group-gu10",
  "surface": "group",
  "seq": 21,
  "type": "choice",
  "domain": null,
  "prompt": "Our best time together is usually…",
  "options": [
   "Late night",
   "Long dinner",
   "Outdoors",
   "Doing nothing"
  ],
  "topic": "us",
  "axis": null,
  "test": null
 },
 {
  "id": "group-gp6",
  "surface": "group",
  "seq": 22,
  "type": "choice",
  "domain": null,
  "prompt": "Who would win a group argument on a technicality?",
  "options": [],
  "topic": "pick",
  "axis": null,
  "test": null
 },
 {
  "id": "group-gu11",
  "surface": "group",
  "seq": 23,
  "type": "choice",
  "domain": null,
  "prompt": "New person wants in. We are…",
  "options": [
   "Open door",
   "Slow to warm",
   "Full — sorry",
   "Depends who"
  ],
  "topic": "us",
  "axis": null,
  "test": null
 },
 {
  "id": "group-gd8",
  "surface": "group",
  "seq": 24,
  "type": "choice",
  "domain": null,
  "prompt": "The bill arrives. Split it even, or pay what you had?",
  "options": [
   "Even split",
   "What you had"
  ],
  "topic": "classic",
  "axis": null,
  "test": null
 },
 {
  "id": "group-gp7",
  "surface": "group",
  "seq": 25,
  "type": "choice",
  "domain": null,
  "prompt": "Who tells the same story every time, and it still lands?",
  "options": [],
  "topic": "pick",
  "axis": null,
  "test": null
 },
 {
  "id": "duo-000",
  "surface": "duo",
  "seq": 0,
  "type": "binary",
  "domain": null,
  "prompt": "Plans get cancelled last minute. First feeling?",
  "options": [
   "Relief",
   "Annoyed"
  ],
  "topic": "day",
  "axis": null,
  "test": null
 },
 {
  "id": "duo-001",
  "surface": "duo",
  "seq": 1,
  "type": "binary",
  "domain": null,
  "prompt": "Phone rings, unknown number.",
  "options": [
   "Answer",
   "Ignore",
   "Text back later"
  ],
  "topic": "day",
  "axis": null,
  "test": null
 },
 {
  "id": "duo-002",
  "surface": "duo",
  "seq": 2,
  "type": "binary",
  "domain": null,
  "prompt": "A compliment in front of everyone — love it or squirm?",
  "options": [
   "Love it",
   "Squirm"
  ],
  "topic": "day",
  "axis": null,
  "test": null
 },
 {
  "id": "duo-040",
  "surface": "duo",
  "seq": 3,
  "type": "binary",
  "domain": null,
  "prompt": "The word that fits them best?",
  "options": [
   "Warm",
   "Sharp",
   "Steady",
   "Restless"
  ],
  "topic": "mirror",
  "axis": null,
  "test": null
 },
 {
  "id": "duo-003",
  "surface": "duo",
  "seq": 4,
  "type": "binary",
  "domain": null,
  "prompt": "Running late. The text says…",
  "options": [
   "\"5 min\" (it’s 20)",
   "The honest ETA",
   "Nothing — just arrives"
  ],
  "topic": "day",
  "axis": null,
  "test": null
 },
 {
  "id": "duo-004",
  "surface": "duo",
  "seq": 5,
  "type": "binary",
  "domain": null,
  "prompt": "The food arrives wrong. Say something?",
  "options": [
   "Say something",
   "Eat it anyway"
  ],
  "topic": "heat",
  "axis": null,
  "test": null
 },
 {
  "id": "duo-041",
  "surface": "duo",
  "seq": 6,
  "type": "binary",
  "domain": null,
  "prompt": "Their best quality, in one word?",
  "options": [
   "Loyalty",
   "Humour",
   "Honesty",
   "Nerve"
  ],
  "topic": "mirror",
  "axis": null,
  "test": null
 },
 {
  "id": "duo-005",
  "surface": "duo",
  "seq": 7,
  "type": "binary",
  "domain": null,
  "prompt": "Lost in a new city. They…",
  "options": [
   "Ask someone",
   "Map it out",
   "Just wander"
  ],
  "topic": "day",
  "axis": null,
  "test": null
 },
 {
  "id": "duo-006",
  "surface": "duo",
  "seq": 8,
  "type": "binary",
  "domain": null,
  "prompt": "A free Saturday, zero plans. Bliss or restless?",
  "options": [
   "Bliss",
   "Restless"
  ],
  "topic": "day",
  "axis": null,
  "test": null
 },
 {
  "id": "duo-007",
  "surface": "duo",
  "seq": 9,
  "type": "binary",
  "domain": null,
  "prompt": "Karaoke machine appears.",
  "options": [
   "Grabs the mic",
   "One duet, then done",
   "Vanishes"
  ],
  "topic": "day",
  "axis": null,
  "test": null
 },
 {
  "id": "duo-042",
  "surface": "duo",
  "seq": 10,
  "type": "binary",
  "domain": null,
  "prompt": "In a room of strangers, they are…",
  "options": [
   "Working the room",
   "Talking to one person",
   "Near the door"
  ],
  "topic": "mirror",
  "axis": null,
  "test": null
 },
 {
  "id": "duo-008",
  "surface": "duo",
  "seq": 11,
  "type": "binary",
  "domain": null,
  "prompt": "Someone's joke goes too far. Laugh it off, or say so?",
  "options": [
   "Laugh it off",
   "Say so"
  ],
  "topic": "heat",
  "axis": null,
  "test": null
 },
 {
  "id": "duo-009",
  "surface": "duo",
  "seq": 12,
  "type": "binary",
  "domain": null,
  "prompt": "A big decision lands. How do you call it?",
  "options": [
   "Gut",
   "A list",
   "Ask everyone",
   "Sleep on it"
  ],
  "topic": "heat",
  "axis": null,
  "test": null
 },
 {
  "id": "duo-010",
  "surface": "duo",
  "seq": 13,
  "type": "binary",
  "domain": null,
  "prompt": "Cry in a film — freely, or fight it?",
  "options": [
   "Freely",
   "Fight it"
  ],
  "topic": "heat",
  "axis": null,
  "test": null
 },
 {
  "id": "duo-043",
  "surface": "duo",
  "seq": 14,
  "type": "binary",
  "domain": null,
  "prompt": "You would call them first for…",
  "options": [
   "A crisis",
   "A laugh",
   "Advice",
   "A favour"
  ],
  "topic": "mirror",
  "axis": null,
  "test": null
 },
 {
  "id": "duo-011",
  "surface": "duo",
  "seq": 15,
  "type": "binary",
  "domain": null,
  "prompt": "Ideal holiday day?",
  "options": [
   "Packed itinerary",
   "One plan, then drift",
   "Pool. Book. Done."
  ],
  "topic": "day",
  "axis": null,
  "test": null
 },
 {
  "id": "duo-044",
  "surface": "duo",
  "seq": 16,
  "type": "binary",
  "domain": null,
  "prompt": "What about them would surprise a stranger?",
  "options": [
   "How soft",
   "How stubborn",
   "How funny",
   "How serious"
  ],
  "topic": "mirror",
  "axis": null,
  "test": null
 },
 {
  "id": "duo-012",
  "surface": "duo",
  "seq": 17,
  "type": "binary",
  "domain": null,
  "prompt": "A surprise windfall lands. First move?",
  "options": [
   "Save it",
   "Book a trip that night",
   "Treat someone else",
   "Spend a little now"
  ],
  "topic": "day",
  "axis": null,
  "test": null
 },
 {
  "id": "duo-013",
  "surface": "duo",
  "seq": 18,
  "type": "binary",
  "domain": null,
  "prompt": "An old friend owes an apology. Bring it up, or let it go?",
  "options": [
   "Bring it up",
   "Let it go"
  ],
  "topic": "heat",
  "axis": null,
  "test": null
 },
 {
  "id": "duo-014",
  "surface": "duo",
  "seq": 19,
  "type": "binary",
  "domain": null,
  "prompt": "Deep talk at 2am, or a proper night of sleep?",
  "options": [
   "The talk",
   "The sleep"
  ],
  "topic": "day",
  "axis": null,
  "test": null
 },
 {
  "id": "duo-045",
  "surface": "duo",
  "seq": 20,
  "type": "binary",
  "domain": null,
  "prompt": "Are they easy to know?",
  "options": [
   "Yes",
   "Takes a while",
   "No"
  ],
  "topic": "mirror",
  "axis": null,
  "test": null
 },
 {
  "id": "duo-015",
  "surface": "duo",
  "seq": 21,
  "type": "binary",
  "domain": null,
  "prompt": "When hurt, you go…",
  "options": [
   "Quiet",
   "Loud",
   "Busy"
  ],
  "topic": "heat",
  "axis": null,
  "test": null
 },
 {
  "id": "duo-016",
  "surface": "duo",
  "seq": 22,
  "type": "binary",
  "domain": null,
  "prompt": "Hear the hard truth, or keep the comfortable silence?",
  "options": [
   "Hard truth",
   "Silence"
  ],
  "topic": "heat",
  "axis": null,
  "test": null
 },
 {
  "id": "duo-046",
  "surface": "duo",
  "seq": 23,
  "type": "binary",
  "domain": null,
  "prompt": "Their most underrated trait?",
  "options": [
   "Patience",
   "Taste",
   "Generosity",
   "Judgement"
  ],
  "topic": "mirror",
  "axis": null,
  "test": null
 },
 {
  "id": "duo-017",
  "surface": "duo",
  "seq": 24,
  "type": "binary",
  "domain": null,
  "prompt": "After a brutal week, what refills you?",
  "options": [
   "People",
   "Solitude",
   "Movement",
   "Sleep"
  ],
  "topic": "heat",
  "axis": null,
  "test": null
 },
 {
  "id": "duo-047",
  "surface": "duo",
  "seq": 25,
  "type": "binary",
  "domain": null,
  "prompt": "Better at giving advice, or taking it?",
  "options": [
   "Giving",
   "Taking"
  ],
  "topic": "mirror",
  "axis": null,
  "test": null
 },
 {
  "id": "duo-018",
  "surface": "duo",
  "seq": 26,
  "type": "binary",
  "domain": null,
  "prompt": "A week alone in a cabin. Gift or sentence?",
  "options": [
   "Gift",
   "Sentence"
  ],
  "topic": "day",
  "axis": null,
  "test": null
 },
 {
  "id": "duo-048",
  "surface": "duo",
  "seq": 27,
  "type": "binary",
  "domain": null,
  "prompt": "The role they play between you two?",
  "options": [
   "The steady one",
   "The instigator",
   "The listener",
   "The truth-teller"
  ],
  "topic": "mirror",
  "axis": null,
  "test": null
 },
 {
  "id": "duo-019",
  "surface": "duo",
  "seq": 28,
  "type": "binary",
  "domain": null,
  "prompt": "Old age: surrounded, or independent?",
  "options": [
   "Surrounded",
   "Independent"
  ],
  "topic": "day",
  "axis": null,
  "test": null
 },
 {
  "id": "duo-049",
  "surface": "duo",
  "seq": 29,
  "type": "binary",
  "domain": null,
  "prompt": "What would they want to be remembered for?",
  "options": [
   "Kindness",
   "Their work",
   "Being fun",
   "Being right"
  ],
  "topic": "mirror",
  "axis": null,
  "test": null
 },
 {
  "id": "duo-050",
  "surface": "duo",
  "seq": 30,
  "type": "binary",
  "domain": null,
  "prompt": "What slows them down most?",
  "options": [
   "Doubt",
   "Perfectionism",
   "People-pleasing",
   "Distraction"
  ],
  "topic": "mirror",
  "axis": null,
  "test": null
 },
 {
  "id": "duo-053",
  "surface": "duo",
  "seq": 31,
  "type": "binary",
  "domain": null,
  "prompt": "Realising you're wrong mid-argument: concede on the spot, or land the plane quietly?",
  "options": [
   "Concede on the spot",
   "Quietly change course"
  ],
  "topic": "heat",
  "axis": null,
  "test": null
 },
 {
  "id": "duo-020",
  "surface": "duo",
  "seq": 32,
  "type": "binary",
  "domain": null,
  "prompt": "A free evening, both home. Ideal version?",
  "options": [
   "Out somewhere",
   "Sofa, one film",
   "Cooking together"
  ],
  "topic": "day",
  "axis": null,
  "test": null,
  "mode": "romantic",
  "active": false
 },
 {
  "id": "duo-021",
  "surface": "duo",
  "seq": 33,
  "type": "binary",
  "domain": null,
  "prompt": "How do they like being woken?",
  "options": [
   "Slowly, with coffee",
   "Left alone",
   "Talked at immediately"
  ],
  "topic": "day",
  "axis": null,
  "test": null,
  "mode": "romantic",
  "active": false
 },
 {
  "id": "duo-022",
  "surface": "duo",
  "seq": 34,
  "type": "binary",
  "domain": null,
  "prompt": "A good apology from them looks like…",
  "options": [
   "Words",
   "A gesture",
   "Time, then normal"
  ],
  "topic": "heat",
  "axis": null,
  "test": null,
  "mode": "romantic",
  "active": false
 },
 {
  "id": "duo-023",
  "surface": "duo",
  "seq": 35,
  "type": "binary",
  "domain": null,
  "prompt": "You are 20 minutes late to dinner. Their read?",
  "options": [
   "Fine, orders a drink",
   "Says nothing, remembers it"
  ],
  "topic": "heat",
  "axis": null,
  "test": null,
  "mode": "romantic",
  "active": false
 },
 {
  "id": "duo-024",
  "surface": "duo",
  "seq": 36,
  "type": "binary",
  "domain": null,
  "prompt": "Love lands hardest as…",
  "options": [
   "Being told",
   "Being helped",
   "Being touched",
   "Being chosen"
  ],
  "topic": "day",
  "axis": null,
  "test": null,
  "mode": "romantic",
  "active": false
 },
 {
  "id": "duo-025",
  "surface": "duo",
  "seq": 37,
  "type": "binary",
  "domain": null,
  "prompt": "Mid-argument, they want…",
  "options": [
   "To finish it now",
   "A pause",
   "Space, then dinner"
  ],
  "topic": "heat",
  "axis": null,
  "test": null,
  "mode": "romantic",
  "active": false
 },
 {
  "id": "duo-026",
  "surface": "duo",
  "seq": 38,
  "type": "binary",
  "domain": null,
  "prompt": "The better anniversary?",
  "options": [
   "A plan they made",
   "A day with nothing in it"
  ],
  "topic": "day",
  "axis": null,
  "test": null,
  "mode": "romantic",
  "active": false
 },
 {
  "id": "duo-027",
  "surface": "duo",
  "seq": 39,
  "type": "binary",
  "domain": null,
  "prompt": "Money in this relationship should be…",
  "options": [
   "Fully shared",
   "Mostly shared",
   "Separate, split bills"
  ],
  "topic": "ahead",
  "axis": null,
  "test": null,
  "mode": "romantic",
  "active": false
 },
 {
  "id": "duo-028",
  "surface": "duo",
  "seq": 40,
  "type": "binary",
  "domain": null,
  "prompt": "Their idea of being taken care of?",
  "options": [
   "Food made",
   "Admin handled",
   "Left in peace",
   "Asked about"
  ],
  "topic": "day",
  "axis": null,
  "test": null,
  "mode": "romantic",
  "active": false
 },
 {
  "id": "duo-029",
  "surface": "duo",
  "seq": 41,
  "type": "binary",
  "domain": null,
  "prompt": "A whole weekend together, no phones. Bliss or too much?",
  "options": [
   "Bliss",
   "Too much"
  ],
  "topic": "day",
  "axis": null,
  "test": null,
  "mode": "romantic",
  "active": false
 },
 {
  "id": "duo-030",
  "surface": "duo",
  "seq": 42,
  "type": "binary",
  "domain": null,
  "prompt": "They had a hard day and did not say so. The tell?",
  "options": [
   "Goes quiet",
   "Cleans something",
   "Talks about nothing else"
  ],
  "topic": "heat",
  "axis": null,
  "test": null,
  "mode": "romantic",
  "active": false
 },
 {
  "id": "duo-031",
  "surface": "duo",
  "seq": 43,
  "type": "binary",
  "domain": null,
  "prompt": "Five years out, they picture…",
  "options": [
   "Same city, more room",
   "Somewhere new",
   "Somewhere quiet"
  ],
  "topic": "ahead",
  "axis": null,
  "test": null,
  "mode": "romantic",
  "active": false
 },
 {
  "id": "duo-032",
  "surface": "duo",
  "seq": 44,
  "type": "binary",
  "domain": null,
  "prompt": "A big decision that affects you both. They…",
  "options": [
   "Decide together, slowly",
   "Want you to choose",
   "Already decided"
  ],
  "topic": "ahead",
  "axis": null,
  "test": null,
  "mode": "romantic",
  "active": false
 },
 {
  "id": "duo-033",
  "surface": "duo",
  "seq": 45,
  "type": "binary",
  "domain": null,
  "prompt": "Would they tell you a truth that would hurt for a week?",
  "options": [
   "Yes",
   "Only if asked",
   "No"
  ],
  "topic": "heat",
  "axis": null,
  "test": null,
  "mode": "romantic",
  "active": false
 },
 {
  "id": "duo-034",
  "surface": "duo",
  "seq": 46,
  "type": "binary",
  "domain": null,
  "prompt": "Jealousy shows up in them as…",
  "options": [
   "A question",
   "A joke",
   "Silence",
   "It doesn't"
  ],
  "topic": "heat",
  "axis": null,
  "test": null,
  "mode": "romantic",
  "active": false
 },
 {
  "id": "duo-035",
  "surface": "duo",
  "seq": 47,
  "type": "binary",
  "domain": null,
  "prompt": "Kids, someday?",
  "options": [
   "Yes",
   "Open to it",
   "No"
  ],
  "topic": "ahead",
  "axis": null,
  "test": null,
  "mode": "romantic",
  "active": false
 },
 {
  "id": "duo-036",
  "surface": "duo",
  "seq": 48,
  "type": "binary",
  "domain": null,
  "prompt": "The thing they would never compromise on?",
  "options": [
   "Where they live",
   "Their work",
   "Their people",
   "Their solitude"
  ],
  "topic": "ahead",
  "axis": null,
  "test": null,
  "mode": "romantic",
  "active": false
 },
 {
  "id": "duo-037",
  "surface": "duo",
  "seq": 49,
  "type": "binary",
  "domain": null,
  "prompt": "If you needed a year somewhere else, they would…",
  "options": [
   "Come",
   "Wait",
   "Ask you not to go"
  ],
  "topic": "ahead",
  "axis": null,
  "test": null,
  "mode": "romantic",
  "active": false
 },
 {
  "id": "duo-038",
  "surface": "duo",
  "seq": 50,
  "type": "binary",
  "domain": null,
  "prompt": "What would make them feel most loved this year?",
  "options": [
   "More time",
   "More plans",
   "More calm",
   "More honesty"
  ],
  "topic": "ahead",
  "axis": null,
  "test": null,
  "mode": "romantic",
  "active": false
 },
 {
  "id": "duo-039",
  "surface": "duo",
  "seq": 51,
  "type": "binary",
  "domain": null,
  "prompt": "Old age, the two of you: side by side, or side by side and busy?",
  "options": [
   "Side by side",
   "Busy, together"
  ],
  "topic": "ahead",
  "axis": null,
  "test": null,
  "mode": "romantic",
  "active": false
 },
 {
  "id": "duo-051",
  "surface": "duo",
  "seq": 52,
  "type": "binary",
  "domain": null,
  "prompt": "After a fight, the first move back is usually…",
  "options": [
   "A joke",
   "A touch",
   "Talking it out",
   "Acting normal"
  ],
  "topic": "heat",
  "axis": null,
  "test": null,
  "mode": "romantic",
  "active": false
 },
 {
  "id": "duo-052",
  "surface": "duo",
  "seq": 53,
  "type": "binary",
  "domain": null,
  "prompt": "The retirement dream: settled deep somewhere, or still moving?",
  "options": [
   "Settled deep",
   "Still moving"
  ],
  "topic": "ahead",
  "axis": null,
  "test": null,
  "mode": "romantic",
  "active": false
 },
 {
  "id": "duo-054",
  "surface": "duo",
  "seq": 54,
  "type": "binary",
  "domain": null,
  "prompt": "When they need help, they…",
  "options": [
   "Ask straight out",
   "Hint and hope",
   "Soldier on alone"
  ],
  "topic": "heat",
  "axis": null,
  "test": null,
  "mode": "romantic",
  "active": false
 },
 {
  "id": "duo-055",
  "surface": "duo",
  "seq": 55,
  "type": "binary",
  "domain": null,
  "prompt": "Ten years on, the two of you are known for…",
  "options": [
   "The open house",
   "The adventures",
   "The quiet steadiness",
   "The double act"
  ],
  "topic": "ahead",
  "axis": null,
  "test": null,
  "mode": "romantic",
  "active": false
 },
 {
  "id": "test-big5-00",
  "surface": "test",
  "seq": 0,
  "type": "scale",
  "domain": null,
  "prompt": "I find new ideas more interesting than familiar ones.",
  "options": [
   "Strongly disagree",
   "Disagree",
   "Neutral",
   "Agree",
   "Strongly agree"
  ],
  "topic": "test",
  "axis": "O",
  "test": "big5"
 },
 {
  "id": "test-big5-01",
  "surface": "test",
  "seq": 1,
  "type": "scale",
  "domain": null,
  "prompt": "I enjoy thinking about abstract concepts.",
  "options": [
   "Strongly disagree",
   "Disagree",
   "Neutral",
   "Agree",
   "Strongly agree"
  ],
  "topic": "test",
  "axis": "O",
  "test": "big5"
 },
 {
  "id": "test-big5-02",
  "surface": "test",
  "seq": 2,
  "type": "scale",
  "domain": null,
  "prompt": "I keep appointments and rarely run late.",
  "options": [
   "Strongly disagree",
   "Disagree",
   "Neutral",
   "Agree",
   "Strongly agree"
  ],
  "topic": "test",
  "axis": "C",
  "test": "big5"
 },
 {
  "id": "test-big5-03",
  "surface": "test",
  "seq": 3,
  "type": "scale",
  "domain": null,
  "prompt": "I finish what I start, even when it gets dull.",
  "options": [
   "Strongly disagree",
   "Disagree",
   "Neutral",
   "Agree",
   "Strongly agree"
  ],
  "topic": "test",
  "axis": "C",
  "test": "big5"
 },
 {
  "id": "test-big5-04",
  "surface": "test",
  "seq": 4,
  "type": "scale",
  "domain": null,
  "prompt": "I feel energised by spending time with strangers.",
  "options": [
   "Strongly disagree",
   "Disagree",
   "Neutral",
   "Agree",
   "Strongly agree"
  ],
  "topic": "test",
  "axis": "E",
  "test": "big5"
 },
 {
  "id": "test-big5-05",
  "surface": "test",
  "seq": 5,
  "type": "scale",
  "domain": null,
  "prompt": "I prefer a loud party to a quiet evening.",
  "options": [
   "Strongly disagree",
   "Disagree",
   "Neutral",
   "Agree",
   "Strongly agree"
  ],
  "topic": "test",
  "axis": "E",
  "test": "big5"
 },
 {
  "id": "test-big5-06",
  "surface": "test",
  "seq": 6,
  "type": "scale",
  "domain": null,
  "prompt": "I try to keep the peace, even at some cost.",
  "options": [
   "Strongly disagree",
   "Disagree",
   "Neutral",
   "Agree",
   "Strongly agree"
  ],
  "topic": "test",
  "axis": "A",
  "test": "big5"
 },
 {
  "id": "test-big5-07",
  "surface": "test",
  "seq": 7,
  "type": "scale",
  "domain": null,
  "prompt": "I trust people until they give me reason not to.",
  "options": [
   "Strongly disagree",
   "Disagree",
   "Neutral",
   "Agree",
   "Strongly agree"
  ],
  "topic": "test",
  "axis": "A",
  "test": "big5"
 },
 {
  "id": "test-big5-08",
  "surface": "test",
  "seq": 8,
  "type": "scale",
  "domain": null,
  "prompt": "I worry about things I can't control.",
  "options": [
   "Strongly disagree",
   "Disagree",
   "Neutral",
   "Agree",
   "Strongly agree"
  ],
  "topic": "test",
  "axis": "N",
  "test": "big5"
 },
 {
  "id": "test-big5-09",
  "surface": "test",
  "seq": 9,
  "type": "scale",
  "domain": null,
  "prompt": "Small setbacks throw off my whole day.",
  "options": [
   "Strongly disagree",
   "Disagree",
   "Neutral",
   "Agree",
   "Strongly agree"
  ],
  "topic": "test",
  "axis": "N",
  "test": "big5"
 },
 {
  "id": "test-big5-10",
  "surface": "test",
  "seq": 10,
  "type": "scale",
  "domain": null,
  "prompt": "I stick with what I know works rather than experiment.",
  "options": [
   "Strongly disagree",
   "Disagree",
   "Neutral",
   "Agree",
   "Strongly agree"
  ],
  "topic": "test",
  "axis": "O",
  "test": "big5",
  "invert": true
 },
 {
  "id": "test-big5-11",
  "surface": "test",
  "seq": 11,
  "type": "scale",
  "domain": null,
  "prompt": "I leave things to the last minute more often than not.",
  "options": [
   "Strongly disagree",
   "Disagree",
   "Neutral",
   "Agree",
   "Strongly agree"
  ],
  "topic": "test",
  "axis": "C",
  "test": "big5",
  "invert": true
 },
 {
  "id": "test-big5-12",
  "surface": "test",
  "seq": 12,
  "type": "scale",
  "domain": null,
  "prompt": "A full day alone recharges me more than a night out.",
  "options": [
   "Strongly disagree",
   "Disagree",
   "Neutral",
   "Agree",
   "Strongly agree"
  ],
  "topic": "test",
  "axis": "E",
  "test": "big5",
  "invert": true
 },
 {
  "id": "test-big5-13",
  "surface": "test",
  "seq": 13,
  "type": "scale",
  "domain": null,
  "prompt": "I'd rather win the argument than smooth things over.",
  "options": [
   "Strongly disagree",
   "Disagree",
   "Neutral",
   "Agree",
   "Strongly agree"
  ],
  "topic": "test",
  "axis": "A",
  "test": "big5",
  "invert": true
 },
 {
  "id": "test-big5-14",
  "surface": "test",
  "seq": 14,
  "type": "scale",
  "domain": null,
  "prompt": "It takes a lot to rattle me.",
  "options": [
   "Strongly disagree",
   "Disagree",
   "Neutral",
   "Agree",
   "Strongly agree"
  ],
  "topic": "test",
  "axis": "N",
  "test": "big5",
  "invert": true
 },
 {
  "id": "test-big5-15",
  "surface": "test",
  "seq": 15,
  "type": "scale",
  "domain": null,
  "prompt": "I go looking for music, films or books I know nothing about.",
  "options": [
   "Strongly disagree",
   "Disagree",
   "Neutral",
   "Agree",
   "Strongly agree"
  ],
  "topic": "test",
  "axis": "O",
  "test": "big5"
 },
 {
  "id": "test-big5-16",
  "surface": "test",
  "seq": 16,
  "type": "scale",
  "domain": null,
  "prompt": "I have little patience for questions with no practical use.",
  "options": [
   "Strongly disagree",
   "Disagree",
   "Neutral",
   "Agree",
   "Strongly agree"
  ],
  "topic": "test",
  "axis": "O",
  "test": "big5",
  "invert": true
 },
 {
  "id": "test-big5-17",
  "surface": "test",
  "seq": 17,
  "type": "scale",
  "domain": null,
  "prompt": "I keep my things in order without having to think about it.",
  "options": [
   "Strongly disagree",
   "Disagree",
   "Neutral",
   "Agree",
   "Strongly agree"
  ],
  "topic": "test",
  "axis": "C",
  "test": "big5"
 },
 {
  "id": "test-big5-18",
  "surface": "test",
  "seq": 18,
  "type": "scale",
  "domain": null,
  "prompt": "My plans tend to fall apart in the details.",
  "options": [
   "Strongly disagree",
   "Disagree",
   "Neutral",
   "Agree",
   "Strongly agree"
  ],
  "topic": "test",
  "axis": "C",
  "test": "big5",
  "invert": true
 },
 {
  "id": "test-big5-19",
  "surface": "test",
  "seq": 19,
  "type": "scale",
  "domain": null,
  "prompt": "I start conversations with people I have just met.",
  "options": [
   "Strongly disagree",
   "Disagree",
   "Neutral",
   "Agree",
   "Strongly agree"
  ],
  "topic": "test",
  "axis": "E",
  "test": "big5"
 },
 {
  "id": "test-big5-20",
  "surface": "test",
  "seq": 20,
  "type": "scale",
  "domain": null,
  "prompt": "In a group I say less than most people there.",
  "options": [
   "Strongly disagree",
   "Disagree",
   "Neutral",
   "Agree",
   "Strongly agree"
  ],
  "topic": "test",
  "axis": "E",
  "test": "big5",
  "invert": true
 },
 {
  "id": "test-big5-21",
  "surface": "test",
  "seq": 21,
  "type": "scale",
  "domain": null,
  "prompt": "I give people the benefit of the doubt when a story doesn't add up.",
  "options": [
   "Strongly disagree",
   "Disagree",
   "Neutral",
   "Agree",
   "Strongly agree"
  ],
  "topic": "test",
  "axis": "A",
  "test": "big5"
 },
 {
  "id": "test-big5-22",
  "surface": "test",
  "seq": 22,
  "type": "scale",
  "domain": null,
  "prompt": "I decide quickly whether someone is worth my time.",
  "options": [
   "Strongly disagree",
   "Disagree",
   "Neutral",
   "Agree",
   "Strongly agree"
  ],
  "topic": "test",
  "axis": "A",
  "test": "big5",
  "invert": true
 },
 {
  "id": "test-big5-23",
  "surface": "test",
  "seq": 23,
  "type": "scale",
  "domain": null,
  "prompt": "I replay conversations afterwards, looking for what I got wrong.",
  "options": [
   "Strongly disagree",
   "Disagree",
   "Neutral",
   "Agree",
   "Strongly agree"
  ],
  "topic": "test",
  "axis": "N",
  "test": "big5"
 },
 {
  "id": "test-big5-24",
  "surface": "test",
  "seq": 24,
  "type": "scale",
  "domain": null,
  "prompt": "I sleep fine the night before something big.",
  "options": [
   "Strongly disagree",
   "Disagree",
   "Neutral",
   "Agree",
   "Strongly agree"
  ],
  "topic": "test",
  "axis": "N",
  "test": "big5",
  "invert": true
 },
 {
  "id": "test-political-00",
  "surface": "test",
  "seq": 25,
  "type": "scale",
  "domain": null,
  "prompt": "Markets, left to themselves, distribute fairly.",
  "options": [
   "Strongly disagree",
   "Disagree",
   "Neutral",
   "Agree",
   "Strongly agree"
  ],
  "topic": "test",
  "axis": "econ",
  "test": "political"
 },
 {
  "id": "test-political-01",
  "surface": "test",
  "seq": 26,
  "type": "scale",
  "domain": null,
  "prompt": "Essential services belong in public hands, not markets.",
  "options": [
   "Strongly disagree",
   "Disagree",
   "Neutral",
   "Agree",
   "Strongly agree"
  ],
  "topic": "test",
  "axis": "econ",
  "test": "political",
  "invert": true
 },
 {
  "id": "test-political-02",
  "surface": "test",
  "seq": 27,
  "type": "scale",
  "domain": null,
  "prompt": "Some speech is harmful enough to restrict.",
  "options": [
   "Strongly disagree",
   "Disagree",
   "Neutral",
   "Agree",
   "Strongly agree"
  ],
  "topic": "test",
  "axis": "auth",
  "test": "political"
 },
 {
  "id": "test-political-03",
  "surface": "test",
  "seq": 28,
  "type": "scale",
  "domain": null,
  "prompt": "The state should keep out of private life.",
  "options": [
   "Strongly disagree",
   "Disagree",
   "Neutral",
   "Agree",
   "Strongly agree"
  ],
  "topic": "test",
  "axis": "auth",
  "test": "political",
  "invert": true
 },
 {
  "id": "test-political-04",
  "surface": "test",
  "seq": 29,
  "type": "scale",
  "domain": null,
  "prompt": "My country should help others before its own poor.",
  "options": [
   "Strongly disagree",
   "Disagree",
   "Neutral",
   "Agree",
   "Strongly agree"
  ],
  "topic": "test",
  "axis": "foreign",
  "test": "political"
 },
 {
  "id": "test-political-05",
  "surface": "test",
  "seq": 30,
  "type": "scale",
  "domain": null,
  "prompt": "Borders should be more open than they are now.",
  "options": [
   "Strongly disagree",
   "Disagree",
   "Neutral",
   "Agree",
   "Strongly agree"
  ],
  "topic": "test",
  "axis": "foreign",
  "test": "political"
 },
 {
  "id": "test-political-06",
  "surface": "test",
  "seq": 31,
  "type": "scale",
  "domain": null,
  "prompt": "Climate action is worth real economic cost.",
  "options": [
   "Strongly disagree",
   "Disagree",
   "Neutral",
   "Agree",
   "Strongly agree"
  ],
  "topic": "test",
  "axis": "env",
  "test": "political"
 },
 {
  "id": "test-political-07",
  "surface": "test",
  "seq": 32,
  "type": "scale",
  "domain": null,
  "prompt": "Green rules should hold even when jobs are on the line.",
  "options": [
   "Strongly disagree",
   "Disagree",
   "Neutral",
   "Agree",
   "Strongly agree"
  ],
  "topic": "test",
  "axis": "env",
  "test": "political"
 },
 {
  "id": "test-political-08",
  "surface": "test",
  "seq": 33,
  "type": "scale",
  "domain": null,
  "prompt": "New technology, on balance, makes life better.",
  "options": [
   "Strongly disagree",
   "Disagree",
   "Neutral",
   "Agree",
   "Strongly agree"
  ],
  "topic": "test",
  "axis": "tech",
  "test": "political"
 },
 {
  "id": "test-political-09",
  "surface": "test",
  "seq": 34,
  "type": "scale",
  "domain": null,
  "prompt": "Some technologies should be slowed down on purpose.",
  "options": [
   "Strongly disagree",
   "Disagree",
   "Neutral",
   "Agree",
   "Strongly agree"
  ],
  "topic": "test",
  "axis": "tech",
  "test": "political",
  "invert": true
 },
 {
  "id": "test-political-10",
  "surface": "test",
  "seq": 35,
  "type": "scale",
  "domain": null,
  "prompt": "Strong leaders matter more than strong institutions.",
  "options": [
   "Strongly disagree",
   "Disagree",
   "Neutral",
   "Agree",
   "Strongly agree"
  ],
  "topic": "test",
  "axis": "estab",
  "test": "political"
 },
 {
  "id": "test-political-11",
  "surface": "test",
  "seq": 36,
  "type": "scale",
  "domain": null,
  "prompt": "The system is rigged against ordinary people.",
  "options": [
   "Strongly disagree",
   "Disagree",
   "Neutral",
   "Agree",
   "Strongly agree"
  ],
  "topic": "test",
  "axis": "estab",
  "test": "political"
 },
 {
  "id": "test-political-12",
  "surface": "test",
  "seq": 37,
  "type": "scale",
  "domain": null,
  "prompt": "Lower taxes matter more than more public services.",
  "options": [
   "Strongly disagree",
   "Disagree",
   "Neutral",
   "Agree",
   "Strongly agree"
  ],
  "topic": "test",
  "axis": "econ",
  "test": "political"
 },
 {
  "id": "test-political-13",
  "surface": "test",
  "seq": 38,
  "type": "scale",
  "domain": null,
  "prompt": "More surveillance is a fair price for more safety.",
  "options": [
   "Strongly disagree",
   "Disagree",
   "Neutral",
   "Agree",
   "Strongly agree"
  ],
  "topic": "test",
  "axis": "auth",
  "test": "political"
 },
 {
  "id": "test-political-14",
  "surface": "test",
  "seq": 39,
  "type": "scale",
  "domain": null,
  "prompt": "My country should put its own people first.",
  "options": [
   "Strongly disagree",
   "Disagree",
   "Neutral",
   "Agree",
   "Strongly agree"
  ],
  "topic": "test",
  "axis": "foreign",
  "test": "political",
  "invert": true
 },
 {
  "id": "test-political-15",
  "surface": "test",
  "seq": 40,
  "type": "scale",
  "domain": null,
  "prompt": "The dangers of climate change are exaggerated.",
  "options": [
   "Strongly disagree",
   "Disagree",
   "Neutral",
   "Agree",
   "Strongly agree"
  ],
  "topic": "test",
  "axis": "env",
  "test": "political",
  "invert": true
 },
 {
  "id": "test-political-16",
  "surface": "test",
  "seq": 41,
  "type": "scale",
  "domain": null,
  "prompt": "Progress means building first and fixing problems as they come.",
  "options": [
   "Strongly disagree",
   "Disagree",
   "Neutral",
   "Agree",
   "Strongly agree"
  ],
  "topic": "test",
  "axis": "tech",
  "test": "political"
 },
 {
  "id": "test-political-17",
  "surface": "test",
  "seq": 42,
  "type": "scale",
  "domain": null,
  "prompt": "Experts and institutions usually get it right.",
  "options": [
   "Strongly disagree",
   "Disagree",
   "Neutral",
   "Agree",
   "Strongly agree"
  ],
  "topic": "test",
  "axis": "estab",
  "test": "political",
  "invert": true
 },
 {
  "id": "test-political-18",
  "surface": "test",
  "seq": 43,
  "type": "scale",
  "domain": null,
  "prompt": "People mostly end up where their own effort puts them.",
  "options": [
   "Strongly disagree",
   "Disagree",
   "Neutral",
   "Agree",
   "Strongly agree"
  ],
  "topic": "test",
  "axis": "econ",
  "test": "political"
 },
 {
  "id": "test-political-19",
  "surface": "test",
  "seq": 44,
  "type": "scale",
  "domain": null,
  "prompt": "The gap between rich and poor is the biggest problem we have.",
  "options": [
   "Strongly disagree",
   "Disagree",
   "Neutral",
   "Agree",
   "Strongly agree"
  ],
  "topic": "test",
  "axis": "econ",
  "test": "political",
  "invert": true
 },
 {
  "id": "test-political-20",
  "surface": "test",
  "seq": 45,
  "type": "scale",
  "domain": null,
  "prompt": "Order in the streets matters more than the right to protest.",
  "options": [
   "Strongly disagree",
   "Disagree",
   "Neutral",
   "Agree",
   "Strongly agree"
  ],
  "topic": "test",
  "axis": "auth",
  "test": "political"
 },
 {
  "id": "test-political-21",
  "surface": "test",
  "seq": 46,
  "type": "scale",
  "domain": null,
  "prompt": "Adults should be free to harm themselves if they choose.",
  "options": [
   "Strongly disagree",
   "Disagree",
   "Neutral",
   "Agree",
   "Strongly agree"
  ],
  "topic": "test",
  "axis": "auth",
  "test": "political",
  "invert": true
 },
 {
  "id": "test-political-22",
  "surface": "test",
  "seq": 47,
  "type": "scale",
  "domain": null,
  "prompt": "Immigration has made my country better.",
  "options": [
   "Strongly disagree",
   "Disagree",
   "Neutral",
   "Agree",
   "Strongly agree"
  ],
  "topic": "test",
  "axis": "foreign",
  "test": "political"
 },
 {
  "id": "test-political-23",
  "surface": "test",
  "seq": 48,
  "type": "scale",
  "domain": null,
  "prompt": "We should fix problems at home before problems abroad.",
  "options": [
   "Strongly disagree",
   "Disagree",
   "Neutral",
   "Agree",
   "Strongly agree"
  ],
  "topic": "test",
  "axis": "foreign",
  "test": "political",
  "invert": true
 },
 {
  "id": "test-political-24",
  "surface": "test",
  "seq": 49,
  "type": "scale",
  "domain": null,
  "prompt": "I would pay noticeably more for energy to cut emissions faster.",
  "options": [
   "Strongly disagree",
   "Disagree",
   "Neutral",
   "Agree",
   "Strongly agree"
  ],
  "topic": "test",
  "axis": "env",
  "test": "political"
 },
 {
  "id": "test-political-25",
  "surface": "test",
  "seq": 50,
  "type": "scale",
  "domain": null,
  "prompt": "Environmental rules are already strict enough.",
  "options": [
   "Strongly disagree",
   "Disagree",
   "Neutral",
   "Agree",
   "Strongly agree"
  ],
  "topic": "test",
  "axis": "env",
  "test": "political",
  "invert": true
 },
 {
  "id": "test-political-26",
  "surface": "test",
  "seq": 51,
  "type": "scale",
  "domain": null,
  "prompt": "I would rather live with the risks of new technology than miss what it brings.",
  "options": [
   "Strongly disagree",
   "Disagree",
   "Neutral",
   "Agree",
   "Strongly agree"
  ],
  "topic": "test",
  "axis": "tech",
  "test": "political"
 },
 {
  "id": "test-political-27",
  "surface": "test",
  "seq": 52,
  "type": "scale",
  "domain": null,
  "prompt": "New tools should prove they are safe before anyone can use them.",
  "options": [
   "Strongly disagree",
   "Disagree",
   "Neutral",
   "Agree",
   "Strongly agree"
  ],
  "topic": "test",
  "axis": "tech",
  "test": "political",
  "invert": true
 },
 {
  "id": "test-political-28",
  "surface": "test",
  "seq": 53,
  "type": "scale",
  "domain": null,
  "prompt": "Most politicians are in it for themselves.",
  "options": [
   "Strongly disagree",
   "Disagree",
   "Neutral",
   "Agree",
   "Strongly agree"
  ],
  "topic": "test",
  "axis": "estab",
  "test": "political"
 },
 {
  "id": "test-political-29",
  "surface": "test",
  "seq": 54,
  "type": "scale",
  "domain": null,
  "prompt": "The people running things mostly know what they are doing.",
  "options": [
   "Strongly disagree",
   "Disagree",
   "Neutral",
   "Agree",
   "Strongly agree"
  ],
  "topic": "test",
  "axis": "estab",
  "test": "political",
  "invert": true
 },
 {
  "id": "test-values-00",
  "surface": "test",
  "seq": 55,
  "type": "scale",
  "domain": null,
  "prompt": "Future generations will live better than ours.",
  "options": [
   "Strongly disagree",
   "Disagree",
   "Neutral",
   "Agree",
   "Strongly agree"
  ],
  "topic": "test",
  "axis": "future",
  "test": "values"
 },
 {
  "id": "test-values-01",
  "surface": "test",
  "seq": 56,
  "type": "scale",
  "domain": null,
  "prompt": "Most of what's changing right now is change for the better.",
  "options": [
   "Strongly disagree",
   "Disagree",
   "Neutral",
   "Agree",
   "Strongly agree"
  ],
  "topic": "test",
  "axis": "future",
  "test": "values"
 },
 {
  "id": "test-values-02",
  "surface": "test",
  "seq": 57,
  "type": "scale",
  "domain": null,
  "prompt": "What I owe my family weighs more than what I owe strangers.",
  "options": [
   "Strongly disagree",
   "Disagree",
   "Neutral",
   "Agree",
   "Strongly agree"
  ],
  "topic": "test",
  "axis": "circle",
  "test": "values",
  "invert": true
 },
 {
  "id": "test-values-03",
  "surface": "test",
  "seq": 58,
  "type": "scale",
  "domain": null,
  "prompt": "I'd give up real comfort to help a stranger.",
  "options": [
   "Strongly disagree",
   "Disagree",
   "Neutral",
   "Agree",
   "Strongly agree"
  ],
  "topic": "test",
  "axis": "circle",
  "test": "values"
 },
 {
  "id": "test-values-04",
  "surface": "test",
  "seq": 59,
  "type": "scale",
  "domain": null,
  "prompt": "Pleasure needs no justification.",
  "options": [
   "Strongly disagree",
   "Disagree",
   "Neutral",
   "Agree",
   "Strongly agree"
  ],
  "topic": "test",
  "axis": "hedonism",
  "test": "values"
 },
 {
  "id": "test-values-05",
  "surface": "test",
  "seq": 60,
  "type": "scale",
  "domain": null,
  "prompt": "Obligations come before enjoyment.",
  "options": [
   "Strongly disagree",
   "Disagree",
   "Neutral",
   "Agree",
   "Strongly agree"
  ],
  "topic": "test",
  "axis": "hedonism",
  "test": "values",
  "invert": true
 },
 {
  "id": "test-values-06",
  "surface": "test",
  "seq": 61,
  "type": "scale",
  "domain": null,
  "prompt": "Suffering can give life meaning, not just pain.",
  "options": [
   "Strongly disagree",
   "Disagree",
   "Neutral",
   "Agree",
   "Strongly agree"
  ],
  "topic": "test",
  "axis": "meaning",
  "test": "values"
 },
 {
  "id": "test-values-07",
  "surface": "test",
  "seq": 62,
  "type": "scale",
  "domain": null,
  "prompt": "A hard life spent on something big beats an easy one.",
  "options": [
   "Strongly disagree",
   "Disagree",
   "Neutral",
   "Agree",
   "Strongly agree"
  ],
  "topic": "test",
  "axis": "meaning",
  "test": "values"
 },
 {
  "id": "test-values-08",
  "surface": "test",
  "seq": 63,
  "type": "scale",
  "domain": null,
  "prompt": "There are objective right answers in ethics.",
  "options": [
   "Strongly disagree",
   "Disagree",
   "Neutral",
   "Agree",
   "Strongly agree"
  ],
  "topic": "test",
  "axis": "moral",
  "test": "values"
 },
 {
  "id": "test-values-09",
  "surface": "test",
  "seq": 64,
  "type": "scale",
  "domain": null,
  "prompt": "Some things are wrong in every era and every culture.",
  "options": [
   "Strongly disagree",
   "Disagree",
   "Neutral",
   "Agree",
   "Strongly agree"
  ],
  "topic": "test",
  "axis": "moral",
  "test": "values"
 },
 {
  "id": "test-values-10",
  "surface": "test",
  "seq": 65,
  "type": "scale",
  "domain": null,
  "prompt": "Beauty matters as much as truth.",
  "options": [
   "Strongly disagree",
   "Disagree",
   "Neutral",
   "Agree",
   "Strongly agree"
  ],
  "topic": "test",
  "axis": "beauty",
  "test": "values"
 },
 {
  "id": "test-values-11",
  "surface": "test",
  "seq": 66,
  "type": "scale",
  "domain": null,
  "prompt": "A beautiful thing needs no other use.",
  "options": [
   "Strongly disagree",
   "Disagree",
   "Neutral",
   "Agree",
   "Strongly agree"
  ],
  "topic": "test",
  "axis": "beauty",
  "test": "values"
 },
 {
  "id": "test-values-12",
  "surface": "test",
  "seq": 67,
  "type": "scale",
  "domain": null,
  "prompt": "The world is mostly getting worse.",
  "options": [
   "Strongly disagree",
   "Disagree",
   "Neutral",
   "Agree",
   "Strongly agree"
  ],
  "topic": "test",
  "axis": "future",
  "test": "values",
  "invert": true
 },
 {
  "id": "test-values-13",
  "surface": "test",
  "seq": 68,
  "type": "scale",
  "domain": null,
  "prompt": "A stranger's suffering moves me as much as a neighbour's.",
  "options": [
   "Strongly disagree",
   "Disagree",
   "Neutral",
   "Agree",
   "Strongly agree"
  ],
  "topic": "test",
  "axis": "circle",
  "test": "values"
 },
 {
  "id": "test-values-14",
  "surface": "test",
  "seq": 69,
  "type": "scale",
  "domain": null,
  "prompt": "Enjoying myself is a good enough reason to do something.",
  "options": [
   "Strongly disagree",
   "Disagree",
   "Neutral",
   "Agree",
   "Strongly agree"
  ],
  "topic": "test",
  "axis": "hedonism",
  "test": "values"
 },
 {
  "id": "test-values-15",
  "surface": "test",
  "seq": 70,
  "type": "scale",
  "domain": null,
  "prompt": "A calm, happy life beats a hard, important one.",
  "options": [
   "Strongly disagree",
   "Disagree",
   "Neutral",
   "Agree",
   "Strongly agree"
  ],
  "topic": "test",
  "axis": "meaning",
  "test": "values",
  "invert": true
 },
 {
  "id": "test-values-16",
  "surface": "test",
  "seq": 71,
  "type": "scale",
  "domain": null,
  "prompt": "Right and wrong depend on the culture you're standing in.",
  "options": [
   "Strongly disagree",
   "Disagree",
   "Neutral",
   "Agree",
   "Strongly agree"
  ],
  "topic": "test",
  "axis": "moral",
  "test": "values",
  "invert": true
 },
 {
  "id": "test-values-17",
  "surface": "test",
  "seq": 72,
  "type": "scale",
  "domain": null,
  "prompt": "Whether something works matters more than how it looks.",
  "options": [
   "Strongly disagree",
   "Disagree",
   "Neutral",
   "Agree",
   "Strongly agree"
  ],
  "topic": "test",
  "axis": "beauty",
  "test": "values",
  "invert": true
 },
 {
  "id": "test-values-18",
  "surface": "test",
  "seq": 73,
  "type": "scale",
  "domain": null,
  "prompt": "I expect my own life ten years from now to be better than it is today.",
  "options": [
   "Strongly disagree",
   "Disagree",
   "Neutral",
   "Agree",
   "Strongly agree"
  ],
  "topic": "test",
  "axis": "future",
  "test": "values"
 },
 {
  "id": "test-values-19",
  "surface": "test",
  "seq": 74,
  "type": "scale",
  "domain": null,
  "prompt": "The problems ahead of us are bigger than anything we have solved.",
  "options": [
   "Strongly disagree",
   "Disagree",
   "Neutral",
   "Agree",
   "Strongly agree"
  ],
  "topic": "test",
  "axis": "future",
  "test": "values",
  "invert": true
 },
 {
  "id": "test-values-20",
  "surface": "test",
  "seq": 75,
  "type": "scale",
  "domain": null,
  "prompt": "A life saved far away counts the same as one saved here.",
  "options": [
   "Strongly disagree",
   "Disagree",
   "Neutral",
   "Agree",
   "Strongly agree"
  ],
  "topic": "test",
  "axis": "circle",
  "test": "values"
 },
 {
  "id": "test-values-21",
  "surface": "test",
  "seq": 76,
  "type": "scale",
  "domain": null,
  "prompt": "Charity should start with the people around you.",
  "options": [
   "Strongly disagree",
   "Disagree",
   "Neutral",
   "Agree",
   "Strongly agree"
  ],
  "topic": "test",
  "axis": "circle",
  "test": "values",
  "invert": true
 },
 {
  "id": "test-values-22",
  "surface": "test",
  "seq": 77,
  "type": "scale",
  "domain": null,
  "prompt": "I plan my week around things I will enjoy.",
  "options": [
   "Strongly disagree",
   "Disagree",
   "Neutral",
   "Agree",
   "Strongly agree"
  ],
  "topic": "test",
  "axis": "hedonism",
  "test": "values"
 },
 {
  "id": "test-values-23",
  "surface": "test",
  "seq": 78,
  "type": "scale",
  "domain": null,
  "prompt": "I feel uneasy resting while work is unfinished.",
  "options": [
   "Strongly disagree",
   "Disagree",
   "Neutral",
   "Agree",
   "Strongly agree"
  ],
  "topic": "test",
  "axis": "hedonism",
  "test": "values",
  "invert": true
 },
 {
  "id": "test-values-24",
  "surface": "test",
  "seq": 79,
  "type": "scale",
  "domain": null,
  "prompt": "The best parts of my life came out of something difficult.",
  "options": [
   "Strongly disagree",
   "Disagree",
   "Neutral",
   "Agree",
   "Strongly agree"
  ],
  "topic": "test",
  "axis": "meaning",
  "test": "values"
 },
 {
  "id": "test-values-25",
  "surface": "test",
  "seq": 80,
  "type": "scale",
  "domain": null,
  "prompt": "I would trade a smaller life for a more peaceful one.",
  "options": [
   "Strongly disagree",
   "Disagree",
   "Neutral",
   "Agree",
   "Strongly agree"
  ],
  "topic": "test",
  "axis": "meaning",
  "test": "values",
  "invert": true
 },
 {
  "id": "test-values-26",
  "surface": "test",
  "seq": 81,
  "type": "scale",
  "domain": null,
  "prompt": "Some acts would be wrong even if everyone approved of them.",
  "options": [
   "Strongly disagree",
   "Disagree",
   "Neutral",
   "Agree",
   "Strongly agree"
  ],
  "topic": "test",
  "axis": "moral",
  "test": "values"
 },
 {
  "id": "test-values-27",
  "surface": "test",
  "seq": 82,
  "type": "scale",
  "domain": null,
  "prompt": "Morality is something people invented, like money.",
  "options": [
   "Strongly disagree",
   "Disagree",
   "Neutral",
   "Agree",
   "Strongly agree"
  ],
  "topic": "test",
  "axis": "moral",
  "test": "values",
  "invert": true
 },
 {
  "id": "test-values-28",
  "surface": "test",
  "seq": 83,
  "type": "scale",
  "domain": null,
  "prompt": "I will pay more for something well made when a plain one would do.",
  "options": [
   "Strongly disagree",
   "Disagree",
   "Neutral",
   "Agree",
   "Strongly agree"
  ],
  "topic": "test",
  "axis": "beauty",
  "test": "values"
 },
 {
  "id": "test-values-29",
  "surface": "test",
  "seq": 84,
  "type": "scale",
  "domain": null,
  "prompt": "Decoration is the first thing I would cut.",
  "options": [
   "Strongly disagree",
   "Disagree",
   "Neutral",
   "Agree",
   "Strongly agree"
  ],
  "topic": "test",
  "axis": "beauty",
  "test": "values",
  "invert": true
 },
 {
  "id": "test-attachment-00",
  "surface": "test",
  "seq": 85,
  "type": "scale",
  "domain": null,
  "prompt": "I show people I care without being asked.",
  "options": [
   "Strongly disagree",
   "Disagree",
   "Neutral",
   "Agree",
   "Strongly agree"
  ],
  "topic": "test",
  "axis": "warm",
  "test": "attachment"
 },
 {
  "id": "test-attachment-01",
  "surface": "test",
  "seq": 86,
  "type": "scale",
  "domain": null,
  "prompt": "I'm quick with a hug or a kind word.",
  "options": [
   "Strongly disagree",
   "Disagree",
   "Neutral",
   "Agree",
   "Strongly agree"
  ],
  "topic": "test",
  "axis": "warm",
  "test": "attachment"
 },
 {
  "id": "test-attachment-02",
  "surface": "test",
  "seq": 87,
  "type": "scale",
  "domain": null,
  "prompt": "Friends know I'll show up when it matters.",
  "options": [
   "Strongly disagree",
   "Disagree",
   "Neutral",
   "Agree",
   "Strongly agree"
  ],
  "topic": "test",
  "axis": "loyal",
  "test": "attachment"
 },
 {
  "id": "test-attachment-03",
  "surface": "test",
  "seq": 88,
  "type": "scale",
  "domain": null,
  "prompt": "Once you're my friend, you're my friend for years.",
  "options": [
   "Strongly disagree",
   "Disagree",
   "Neutral",
   "Agree",
   "Strongly agree"
  ],
  "topic": "test",
  "axis": "loyal",
  "test": "attachment"
 },
 {
  "id": "test-attachment-04",
  "surface": "test",
  "seq": 89,
  "type": "scale",
  "domain": null,
  "prompt": "I say what I'm feeling rather than keeping it in.",
  "options": [
   "Strongly disagree",
   "Disagree",
   "Neutral",
   "Agree",
   "Strongly agree"
  ],
  "topic": "test",
  "axis": "open",
  "test": "attachment"
 },
 {
  "id": "test-attachment-05",
  "surface": "test",
  "seq": 90,
  "type": "scale",
  "domain": null,
  "prompt": "I let people see the messy parts of me.",
  "options": [
   "Strongly disagree",
   "Disagree",
   "Neutral",
   "Agree",
   "Strongly agree"
  ],
  "topic": "test",
  "axis": "open",
  "test": "attachment"
 },
 {
  "id": "test-attachment-06",
  "surface": "test",
  "seq": 91,
  "type": "scale",
  "domain": null,
  "prompt": "I'm usually the one keeping things light and fun.",
  "options": [
   "Strongly disagree",
   "Disagree",
   "Neutral",
   "Agree",
   "Strongly agree"
  ],
  "topic": "test",
  "axis": "play",
  "test": "attachment"
 },
 {
  "id": "test-attachment-07",
  "surface": "test",
  "seq": 92,
  "type": "scale",
  "domain": null,
  "prompt": "I'd rather joke around than be too serious.",
  "options": [
   "Strongly disagree",
   "Disagree",
   "Neutral",
   "Agree",
   "Strongly agree"
  ],
  "topic": "test",
  "axis": "play",
  "test": "attachment"
 },
 {
  "id": "test-attachment-08",
  "surface": "test",
  "seq": 93,
  "type": "scale",
  "domain": null,
  "prompt": "Little gets under my skin in a friendship.",
  "options": [
   "Strongly disagree",
   "Disagree",
   "Neutral",
   "Agree",
   "Strongly agree"
  ],
  "topic": "test",
  "axis": "easy",
  "test": "attachment"
 },
 {
  "id": "test-attachment-09",
  "surface": "test",
  "seq": 94,
  "type": "scale",
  "domain": null,
  "prompt": "I give people room and don't keep score.",
  "options": [
   "Strongly disagree",
   "Disagree",
   "Neutral",
   "Agree",
   "Strongly agree"
  ],
  "topic": "test",
  "axis": "easy",
  "test": "attachment"
 },
 {
  "id": "test-attachment-10",
  "surface": "test",
  "seq": 95,
  "type": "scale",
  "domain": null,
  "prompt": "Showing affection doesn't come naturally to me.",
  "options": [
   "Strongly disagree",
   "Disagree",
   "Neutral",
   "Agree",
   "Strongly agree"
  ],
  "topic": "test",
  "axis": "warm",
  "test": "attachment",
  "invert": true
 },
 {
  "id": "test-attachment-11",
  "surface": "test",
  "seq": 96,
  "type": "scale",
  "domain": null,
  "prompt": "My friendships tend to fade when life gets busy.",
  "options": [
   "Strongly disagree",
   "Disagree",
   "Neutral",
   "Agree",
   "Strongly agree"
  ],
  "topic": "test",
  "axis": "loyal",
  "test": "attachment",
  "invert": true
 },
 {
  "id": "test-attachment-12",
  "surface": "test",
  "seq": 97,
  "type": "scale",
  "domain": null,
  "prompt": "I keep my problems to myself.",
  "options": [
   "Strongly disagree",
   "Disagree",
   "Neutral",
   "Agree",
   "Strongly agree"
  ],
  "topic": "test",
  "axis": "open",
  "test": "attachment",
  "invert": true
 },
 {
  "id": "test-attachment-13",
  "surface": "test",
  "seq": 98,
  "type": "scale",
  "domain": null,
  "prompt": "I take most things seriously, even the small stuff.",
  "options": [
   "Strongly disagree",
   "Disagree",
   "Neutral",
   "Agree",
   "Strongly agree"
  ],
  "topic": "test",
  "axis": "play",
  "test": "attachment",
  "invert": true
 },
 {
  "id": "test-attachment-14",
  "surface": "test",
  "seq": 99,
  "type": "scale",
  "domain": null,
  "prompt": "I keep track of who reached out last.",
  "options": [
   "Strongly disagree",
   "Disagree",
   "Neutral",
   "Agree",
   "Strongly agree"
  ],
  "topic": "test",
  "axis": "easy",
  "test": "attachment",
  "invert": true
 },
 {
  "id": "test-attachment-15",
  "surface": "test",
  "seq": 100,
  "type": "scale",
  "domain": null,
  "prompt": "I tell my friends what they mean to me.",
  "options": [
   "Strongly disagree",
   "Disagree",
   "Neutral",
   "Agree",
   "Strongly agree"
  ],
  "topic": "test",
  "axis": "warm",
  "test": "attachment"
 },
 {
  "id": "test-attachment-16",
  "surface": "test",
  "seq": 101,
  "type": "scale",
  "domain": null,
  "prompt": "Compliments feel awkward coming out of my mouth.",
  "options": [
   "Strongly disagree",
   "Disagree",
   "Neutral",
   "Agree",
   "Strongly agree"
  ],
  "topic": "test",
  "axis": "warm",
  "test": "attachment",
  "invert": true
 },
 {
  "id": "test-attachment-17",
  "surface": "test",
  "seq": 102,
  "type": "scale",
  "domain": null,
  "prompt": "I still keep up with people I met years ago.",
  "options": [
   "Strongly disagree",
   "Disagree",
   "Neutral",
   "Agree",
   "Strongly agree"
  ],
  "topic": "test",
  "axis": "loyal",
  "test": "attachment"
 },
 {
  "id": "test-attachment-18",
  "surface": "test",
  "seq": 103,
  "type": "scale",
  "domain": null,
  "prompt": "When someone moves away, we usually lose touch.",
  "options": [
   "Strongly disagree",
   "Disagree",
   "Neutral",
   "Agree",
   "Strongly agree"
  ],
  "topic": "test",
  "axis": "loyal",
  "test": "attachment",
  "invert": true
 },
 {
  "id": "test-attachment-19",
  "surface": "test",
  "seq": 104,
  "type": "scale",
  "domain": null,
  "prompt": "I will admit it when I am struggling.",
  "options": [
   "Strongly disagree",
   "Disagree",
   "Neutral",
   "Agree",
   "Strongly agree"
  ],
  "topic": "test",
  "axis": "open",
  "test": "attachment"
 },
 {
  "id": "test-attachment-20",
  "surface": "test",
  "seq": 105,
  "type": "scale",
  "domain": null,
  "prompt": "There are things about me nobody in my life knows.",
  "options": [
   "Strongly disagree",
   "Disagree",
   "Neutral",
   "Agree",
   "Strongly agree"
  ],
  "topic": "test",
  "axis": "open",
  "test": "attachment",
  "invert": true
 },
 {
  "id": "test-attachment-21",
  "surface": "test",
  "seq": 106,
  "type": "scale",
  "domain": null,
  "prompt": "I am the one who suggests something daft.",
  "options": [
   "Strongly disagree",
   "Disagree",
   "Neutral",
   "Agree",
   "Strongly agree"
  ],
  "topic": "test",
  "axis": "play",
  "test": "attachment"
 },
 {
  "id": "test-attachment-22",
  "surface": "test",
  "seq": 107,
  "type": "scale",
  "domain": null,
  "prompt": "I find it hard to switch off and mess about.",
  "options": [
   "Strongly disagree",
   "Disagree",
   "Neutral",
   "Agree",
   "Strongly agree"
  ],
  "topic": "test",
  "axis": "play",
  "test": "attachment",
  "invert": true
 },
 {
  "id": "test-attachment-23",
  "surface": "test",
  "seq": 108,
  "type": "scale",
  "domain": null,
  "prompt": "A friend cancelling on me barely registers.",
  "options": [
   "Strongly disagree",
   "Disagree",
   "Neutral",
   "Agree",
   "Strongly agree"
  ],
  "topic": "test",
  "axis": "easy",
  "test": "attachment"
 },
 {
  "id": "test-attachment-24",
  "surface": "test",
  "seq": 109,
  "type": "scale",
  "domain": null,
  "prompt": "It bothers me when a friend doesn't reply for days.",
  "options": [
   "Strongly disagree",
   "Disagree",
   "Neutral",
   "Agree",
   "Strongly agree"
  ],
  "topic": "test",
  "axis": "easy",
  "test": "attachment",
  "invert": true
 },
 {
  "id": "lq-moral-0",
  "surface": "test",
  "seq": 110,
  "type": "scale",
  "domain": null,
  "prompt": "Someone suffering matters more than someone being wronged.",
  "options": [
   "Strongly agree",
   "Agree",
   "Neutral",
   "Disagree",
   "Strongly disagree"
  ],
  "topic": "lens",
  "axis": "care",
  "test": null
 },
 {
  "id": "lq-moral-1",
  "surface": "test",
  "seq": 111,
  "type": "scale",
  "domain": null,
  "prompt": "Cruelty is the worst thing a person can be.",
  "options": [
   "Strongly agree",
   "Agree",
   "Neutral",
   "Disagree",
   "Strongly disagree"
  ],
  "topic": "lens",
  "axis": "care",
  "test": null
 },
 {
  "id": "lq-moral-2",
  "surface": "test",
  "seq": 112,
  "type": "scale",
  "domain": null,
  "prompt": "People should get out what they put in — no more, no less.",
  "options": [
   "Strongly agree",
   "Agree",
   "Neutral",
   "Disagree",
   "Strongly disagree"
  ],
  "topic": "lens",
  "axis": "fair",
  "test": null
 },
 {
  "id": "lq-moral-3",
  "surface": "test",
  "seq": 113,
  "type": "scale",
  "domain": null,
  "prompt": "Standing by your own people counts, even when they are wrong.",
  "options": [
   "Strongly agree",
   "Agree",
   "Neutral",
   "Disagree",
   "Strongly disagree"
  ],
  "topic": "lens",
  "axis": "loyal",
  "test": null
 },
 {
  "id": "lq-moral-4",
  "surface": "test",
  "seq": 114,
  "type": "scale",
  "domain": null,
  "prompt": "Respect for those in charge holds a society together.",
  "options": [
   "Strongly agree",
   "Agree",
   "Neutral",
   "Disagree",
   "Strongly disagree"
  ],
  "topic": "lens",
  "axis": "authority",
  "test": null
 },
 {
  "id": "lq-moral-5",
  "surface": "test",
  "seq": 115,
  "type": "scale",
  "domain": null,
  "prompt": "Some things are degrading even when nobody is harmed.",
  "options": [
   "Strongly agree",
   "Agree",
   "Neutral",
   "Disagree",
   "Strongly disagree"
  ],
  "topic": "lens",
  "axis": "sanctity",
  "test": null
 },
 {
  "id": "lq-moral-6",
  "surface": "test",
  "seq": 116,
  "type": "scale",
  "domain": null,
  "prompt": "Being told what to do is a harm in itself.",
  "options": [
   "Strongly agree",
   "Agree",
   "Neutral",
   "Disagree",
   "Strongly disagree"
  ],
  "topic": "lens",
  "axis": "liberty",
  "test": null
 },
 {
  "id": "lq-moral-7",
  "surface": "test",
  "seq": 117,
  "type": "scale",
  "domain": null,
  "prompt": "Rules I never agreed to have no hold on me.",
  "options": [
   "Strongly agree",
   "Agree",
   "Neutral",
   "Disagree",
   "Strongly disagree"
  ],
  "topic": "lens",
  "axis": "liberty",
  "test": null
 },
 {
  "id": "lq-moral-8",
  "surface": "test",
  "seq": 118,
  "type": "scale",
  "domain": null,
  "prompt": "Toughness does more good than tenderness.",
  "options": [
   "Strongly agree",
   "Agree",
   "Neutral",
   "Disagree",
   "Strongly disagree"
  ],
  "topic": "lens",
  "axis": "care",
  "test": null
 },
 {
  "id": "lq-risk-0",
  "surface": "test",
  "seq": 119,
  "type": "scale",
  "domain": null,
  "prompt": "I would put a month of savings into something volatile.",
  "options": [
   "Strongly agree",
   "Agree",
   "Neutral",
   "Disagree",
   "Strongly disagree"
  ],
  "topic": "lens",
  "axis": "financial",
  "test": null
 },
 {
  "id": "lq-risk-1",
  "surface": "test",
  "seq": 120,
  "type": "scale",
  "domain": null,
  "prompt": "I read the fine print before signing anything with money in it.",
  "options": [
   "Strongly agree",
   "Agree",
   "Neutral",
   "Disagree",
   "Strongly disagree"
  ],
  "topic": "lens",
  "axis": "financial",
  "test": null
 },
 {
  "id": "lq-risk-2",
  "surface": "test",
  "seq": 121,
  "type": "scale",
  "domain": null,
  "prompt": "I skip the check-up and assume it is nothing.",
  "options": [
   "Strongly agree",
   "Agree",
   "Neutral",
   "Disagree",
   "Strongly disagree"
  ],
  "topic": "lens",
  "axis": "health",
  "test": null
 },
 {
  "id": "lq-risk-3",
  "surface": "test",
  "seq": 122,
  "type": "scale",
  "domain": null,
  "prompt": "I will say the unpopular thing in a room that disagrees.",
  "options": [
   "Strongly agree",
   "Agree",
   "Neutral",
   "Disagree",
   "Strongly disagree"
  ],
  "topic": "lens",
  "axis": "social",
  "test": null
 },
 {
  "id": "lq-risk-4",
  "surface": "test",
  "seq": 123,
  "type": "scale",
  "domain": null,
  "prompt": "Steep, fast and slightly out of control is my idea of fun.",
  "options": [
   "Strongly agree",
   "Agree",
   "Neutral",
   "Disagree",
   "Strongly disagree"
  ],
  "topic": "lens",
  "axis": "recreational",
  "test": null
 },
 {
  "id": "lq-risk-5",
  "surface": "test",
  "seq": 124,
  "type": "scale",
  "domain": null,
  "prompt": "I would bend a rule if the outcome were clearly better.",
  "options": [
   "Strongly agree",
   "Agree",
   "Neutral",
   "Disagree",
   "Strongly disagree"
  ],
  "topic": "lens",
  "axis": "ethical",
  "test": null
 },
 {
  "id": "lq-trust-0",
  "surface": "test",
  "seq": 125,
  "type": "scale",
  "domain": null,
  "prompt": "Most people would give back a wallet they found.",
  "options": [
   "Strongly agree",
   "Agree",
   "Neutral",
   "Disagree",
   "Strongly disagree"
  ],
  "topic": "lens",
  "axis": "trust",
  "test": null
 },
 {
  "id": "lq-trust-1",
  "surface": "test",
  "seq": 126,
  "type": "scale",
  "domain": null,
  "prompt": "You have to be careful — people take advantage.",
  "options": [
   "Strongly agree",
   "Agree",
   "Neutral",
   "Disagree",
   "Strongly disagree"
  ],
  "topic": "lens",
  "axis": "trust",
  "test": null
 },
 {
  "id": "lq-trust-2",
  "surface": "test",
  "seq": 127,
  "type": "scale",
  "domain": null,
  "prompt": "For one group to gain, another has to lose.",
  "options": [
   "Strongly agree",
   "Agree",
   "Neutral",
   "Disagree",
   "Strongly disagree"
  ],
  "topic": "lens",
  "axis": "zerosum",
  "test": null,
  "political": true
 },
 {
  "id": "lq-trust-3",
  "surface": "test",
  "seq": 128,
  "type": "scale",
  "domain": null,
  "prompt": "Trade between countries leaves both better off.",
  "options": [
   "Strongly agree",
   "Agree",
   "Neutral",
   "Disagree",
   "Strongly disagree"
  ],
  "topic": "lens",
  "axis": "zerosum",
  "test": null,
  "political": true
 },
 {
  "id": "lq-trust-4",
  "surface": "test",
  "seq": 129,
  "type": "scale",
  "domain": null,
  "prompt": "In the long run, people get roughly what they deserve.",
  "options": [
   "Strongly agree",
   "Agree",
   "Neutral",
   "Disagree",
   "Strongly disagree"
  ],
  "topic": "lens",
  "axis": "justworld",
  "test": null
 },
 {
  "id": "lq-trust-5",
  "surface": "test",
  "seq": 130,
  "type": "scale",
  "domain": null,
  "prompt": "Where you end up is mostly where you started.",
  "options": [
   "Strongly agree",
   "Agree",
   "Neutral",
   "Disagree",
   "Strongly disagree"
  ],
  "topic": "lens",
  "axis": "justworld",
  "test": null
 },
 {
  "id": "lq-time-0",
  "surface": "test",
  "seq": 131,
  "type": "scale",
  "domain": null,
  "prompt": "€100 today beats €160 in a year.",
  "options": [
   "Strongly agree",
   "Agree",
   "Neutral",
   "Disagree",
   "Strongly disagree"
  ],
  "topic": "lens",
  "axis": "horizon",
  "test": null
 },
 {
  "id": "lq-time-1",
  "surface": "test",
  "seq": 132,
  "type": "scale",
  "domain": null,
  "prompt": "I plan further ahead than most people I know.",
  "options": [
   "Strongly agree",
   "Agree",
   "Neutral",
   "Disagree",
   "Strongly disagree"
  ],
  "topic": "lens",
  "axis": "horizon",
  "test": null
 },
 {
  "id": "lq-time-2",
  "surface": "test",
  "seq": 133,
  "type": "scale",
  "domain": null,
  "prompt": "I finish the boring part first and enjoy the rest after.",
  "options": [
   "Strongly agree",
   "Agree",
   "Neutral",
   "Disagree",
   "Strongly disagree"
  ],
  "topic": "lens",
  "axis": "patience",
  "test": null
 },
 {
  "id": "lq-time-3",
  "surface": "test",
  "seq": 134,
  "type": "scale",
  "domain": null,
  "prompt": "If I want it, I buy it — I sort the rest out later.",
  "options": [
   "Strongly agree",
   "Agree",
   "Neutral",
   "Disagree",
   "Strongly disagree"
  ],
  "topic": "lens",
  "axis": "patience",
  "test": null
 },
 {
  "id": "lq-time-4",
  "surface": "test",
  "seq": 135,
  "type": "scale",
  "domain": null,
  "prompt": "A decade from now feels real enough to save for.",
  "options": [
   "Strongly agree",
   "Agree",
   "Neutral",
   "Disagree",
   "Strongly disagree"
  ],
  "topic": "lens",
  "axis": "horizon",
  "test": null
 },
 {
  "id": "lq-time-5",
  "surface": "test",
  "seq": 136,
  "type": "scale",
  "domain": null,
  "prompt": "Waiting is easy when I know what is coming.",
  "options": [
   "Strongly agree",
   "Agree",
   "Neutral",
   "Disagree",
   "Strongly disagree"
  ],
  "topic": "lens",
  "axis": "patience",
  "test": null
 },
 {
  "id": "lq-taste-0",
  "surface": "test",
  "seq": 137,
  "type": "scale",
  "domain": null,
  "prompt": "I would rather try an unknown dish than order the one I love.",
  "options": [
   "Strongly agree",
   "Agree",
   "Neutral",
   "Disagree",
   "Strongly disagree"
  ],
  "topic": "lens",
  "axis": "novelty",
  "test": null
 },
 {
  "id": "lq-taste-1",
  "surface": "test",
  "seq": 138,
  "type": "scale",
  "domain": null,
  "prompt": "I rewatch and relisten to the same things for years.",
  "options": [
   "Strongly agree",
   "Agree",
   "Neutral",
   "Disagree",
   "Strongly disagree"
  ],
  "topic": "lens",
  "axis": "novelty",
  "test": null
 },
 {
  "id": "lq-taste-2",
  "surface": "test",
  "seq": 139,
  "type": "scale",
  "domain": null,
  "prompt": "A film that needs a second viewing is a better film.",
  "options": [
   "Strongly agree",
   "Agree",
   "Neutral",
   "Disagree",
   "Strongly disagree"
  ],
  "topic": "lens",
  "axis": "complexity",
  "test": null
 },
 {
  "id": "lq-taste-3",
  "surface": "test",
  "seq": 140,
  "type": "scale",
  "domain": null,
  "prompt": "Earnest beats clever.",
  "options": [
   "Strongly agree",
   "Agree",
   "Neutral",
   "Disagree",
   "Strongly disagree"
  ],
  "topic": "lens",
  "axis": "sincerity",
  "test": null
 },
 {
  "id": "lq-taste-4",
  "surface": "test",
  "seq": 141,
  "type": "scale",
  "domain": null,
  "prompt": "If everyone likes it, it has usually been sanded down.",
  "options": [
   "Strongly agree",
   "Agree",
   "Neutral",
   "Disagree",
   "Strongly disagree"
  ],
  "topic": "lens",
  "axis": "scene",
  "test": null
 },
 {
  "id": "lq-taste-5",
  "surface": "test",
  "seq": 142,
  "type": "scale",
  "domain": null,
  "prompt": "I keep up with what most people are watching.",
  "options": [
   "Strongly agree",
   "Agree",
   "Neutral",
   "Disagree",
   "Strongly disagree"
  ],
  "topic": "lens",
  "axis": "scene",
  "test": null
 },
 {
  "id": "lq-conflict-0",
  "surface": "test",
  "seq": 143,
  "type": "scale",
  "domain": null,
  "prompt": "I say it in the room rather than after.",
  "options": [
   "Strongly agree",
   "Agree",
   "Neutral",
   "Disagree",
   "Strongly disagree"
  ],
  "topic": "lens",
  "axis": "engage",
  "test": null
 },
 {
  "id": "lq-conflict-1",
  "surface": "test",
  "seq": 144,
  "type": "scale",
  "domain": null,
  "prompt": "I let small things go to keep the peace.",
  "options": [
   "Strongly agree",
   "Agree",
   "Neutral",
   "Disagree",
   "Strongly disagree"
  ],
  "topic": "lens",
  "axis": "assert",
  "test": null
 },
 {
  "id": "lq-conflict-2",
  "surface": "test",
  "seq": 145,
  "type": "scale",
  "domain": null,
  "prompt": "I would rather win the argument than end it.",
  "options": [
   "Strongly agree",
   "Agree",
   "Neutral",
   "Disagree",
   "Strongly disagree"
  ],
  "topic": "lens",
  "axis": "assert",
  "test": null
 },
 {
  "id": "lq-conflict-3",
  "surface": "test",
  "seq": 146,
  "type": "scale",
  "domain": null,
  "prompt": "When it heats up I go quiet and leave.",
  "options": [
   "Strongly agree",
   "Agree",
   "Neutral",
   "Disagree",
   "Strongly disagree"
  ],
  "topic": "lens",
  "axis": "engage",
  "test": null
 },
 {
  "id": "lq-humor-0",
  "surface": "test",
  "seq": 147,
  "type": "scale",
  "domain": null,
  "prompt": "I joke to make a room easier to be in.",
  "options": [
   "Strongly agree",
   "Agree",
   "Neutral",
   "Disagree",
   "Strongly disagree"
  ],
  "topic": "lens",
  "axis": "affiliative",
  "test": null
 },
 {
  "id": "lq-humor-1",
  "surface": "test",
  "seq": 148,
  "type": "scale",
  "domain": null,
  "prompt": "When things go badly I can usually find it funny.",
  "options": [
   "Strongly agree",
   "Agree",
   "Neutral",
   "Disagree",
   "Strongly disagree"
  ],
  "topic": "lens",
  "axis": "selfenh",
  "test": null
 },
 {
  "id": "lq-humor-2",
  "surface": "test",
  "seq": 149,
  "type": "scale",
  "domain": null,
  "prompt": "A good joke is worth someone being stung by it.",
  "options": [
   "Strongly agree",
   "Agree",
   "Neutral",
   "Disagree",
   "Strongly disagree"
  ],
  "topic": "lens",
  "axis": "aggressive",
  "test": null
 },
 {
  "id": "lq-humor-3",
  "surface": "test",
  "seq": 150,
  "type": "scale",
  "domain": null,
  "prompt": "I get laughs by putting myself down.",
  "options": [
   "Strongly agree",
   "Agree",
   "Neutral",
   "Disagree",
   "Strongly disagree"
  ],
  "topic": "lens",
  "axis": "selfdef",
  "test": null
 },
 {
  "id": "lq-humor-4",
  "surface": "test",
  "seq": 151,
  "type": "scale",
  "domain": null,
  "prompt": "A joke that needs a target isn’t worth telling.",
  "options": [
   "Strongly agree",
   "Agree",
   "Neutral",
   "Disagree",
   "Strongly disagree"
  ],
  "topic": "lens",
  "axis": "aggressive",
  "test": null
 },
 {
  "id": "lq-thinking-0",
  "surface": "test",
  "seq": 152,
  "type": "scale",
  "domain": null,
  "prompt": "My first instinct is usually right.",
  "options": [
   "Strongly agree",
   "Agree",
   "Neutral",
   "Disagree",
   "Strongly disagree"
  ],
  "topic": "lens",
  "axis": "mode",
  "test": null
 },
 {
  "id": "lq-thinking-1",
  "surface": "test",
  "seq": 153,
  "type": "scale",
  "domain": null,
  "prompt": "I want the numbers before I decide.",
  "options": [
   "Strongly agree",
   "Agree",
   "Neutral",
   "Disagree",
   "Strongly disagree"
  ],
  "topic": "lens",
  "axis": "mode",
  "test": null
 },
 {
  "id": "lq-thinking-2",
  "surface": "test",
  "seq": 154,
  "type": "scale",
  "domain": null,
  "prompt": "I change my mind when the evidence changes.",
  "options": [
   "Strongly agree",
   "Agree",
   "Neutral",
   "Disagree",
   "Strongly disagree"
  ],
  "topic": "lens",
  "axis": "update",
  "test": null
 },
 {
  "id": "lq-thinking-3",
  "surface": "test",
  "seq": 155,
  "type": "scale",
  "domain": null,
  "prompt": "Sitting with not knowing is uncomfortable.",
  "options": [
   "Strongly agree",
   "Agree",
   "Neutral",
   "Disagree",
   "Strongly disagree"
  ],
  "topic": "lens",
  "axis": "update",
  "test": null
 },
 {
  "id": "lq-culture-0",
  "surface": "test",
  "seq": 156,
  "type": "scale",
  "domain": null,
  "prompt": "My choices are mine before they are my family’s.",
  "options": [
   "Strongly agree",
   "Agree",
   "Neutral",
   "Disagree",
   "Strongly disagree"
  ],
  "topic": "lens",
  "axis": "self",
  "test": null
 },
 {
  "id": "lq-culture-1",
  "surface": "test",
  "seq": 157,
  "type": "scale",
  "domain": null,
  "prompt": "What my community expects shapes what I do.",
  "options": [
   "Strongly agree",
   "Agree",
   "Neutral",
   "Disagree",
   "Strongly disagree"
  ],
  "topic": "lens",
  "axis": "self",
  "test": null
 },
 {
  "id": "lq-culture-2",
  "surface": "test",
  "seq": 158,
  "type": "scale",
  "domain": null,
  "prompt": "Breaking a social rule should have consequences.",
  "options": [
   "Strongly agree",
   "Agree",
   "Neutral",
   "Disagree",
   "Strongly disagree"
  ],
  "topic": "lens",
  "axis": "norms",
  "test": null
 },
 {
  "id": "lq-culture-3",
  "surface": "test",
  "seq": 159,
  "type": "scale",
  "domain": null,
  "prompt": "Places work better when people are left to improvise.",
  "options": [
   "Strongly agree",
   "Agree",
   "Neutral",
   "Disagree",
   "Strongly disagree"
  ],
  "topic": "lens",
  "axis": "norms",
  "test": null
 },
 {
  "id": "learn-cell1",
  "surface": "learn",
  "seq": 0,
  "type": "choice",
  "domain": null,
  "prompt": "What do ribosomes build?",
  "options": [
   "Proteins",
   "Lipids",
   "DNA",
   "Sugars"
  ],
  "topic": "cell",
  "axis": null,
  "test": null,
  "c": 0,
  "t": 2,
  "p": 71,
  "k": "Ribosomes build proteins"
 },
 {
  "id": "learn-cell2",
  "surface": "learn",
  "seq": 1,
  "type": "choice",
  "domain": null,
  "prompt": "Which organelle releases most of a cell’s energy?",
  "options": [
   "Mitochondrion",
   "Nucleus",
   "Ribosome",
   "Lysosome"
  ],
  "topic": "cell",
  "axis": null,
  "test": null,
  "c": 0,
  "t": 1,
  "p": 84,
  "k": "Mitochondria make energy"
 },
 {
  "id": "learn-cell3",
  "surface": "learn",
  "seq": 2,
  "type": "choice",
  "domain": null,
  "prompt": "A plant cell wall is made mostly of…",
  "options": [
   "Cellulose",
   "Chitin",
   "Keratin",
   "Starch"
  ],
  "topic": "cell",
  "axis": null,
  "test": null,
  "c": 0,
  "t": 3,
  "p": 52,
  "k": "Cell walls are cellulose"
 },
 {
  "id": "learn-cell4",
  "surface": "learn",
  "seq": 3,
  "type": "choice",
  "domain": null,
  "prompt": "Where does an animal cell keep its DNA?",
  "options": [
   "The nucleus",
   "The cytoplasm",
   "The membrane",
   "A vacuole"
  ],
  "topic": "cell",
  "axis": null,
  "test": null,
  "c": 0,
  "t": 1,
  "p": 88,
  "k": "DNA lives in the nucleus"
 },
 {
  "id": "learn-cell5",
  "surface": "learn",
  "seq": 4,
  "type": "choice",
  "domain": null,
  "prompt": "What does a lysosome do?",
  "options": [
   "Breaks down waste",
   "Stores water",
   "Builds proteins",
   "Splits the cell"
  ],
  "topic": "cell",
  "axis": null,
  "test": null,
  "c": 0,
  "t": 3,
  "p": 44,
  "k": "Lysosomes break down waste"
 },
 {
  "id": "learn-cell6",
  "surface": "learn",
  "seq": 5,
  "type": "choice",
  "domain": null,
  "prompt": "Which of these cells has no nucleus?",
  "options": [
   "A bacterium",
   "A plant cell",
   "A fungal cell",
   "They all have one"
  ],
  "topic": "cell",
  "axis": null,
  "test": null,
  "c": 0,
  "t": 3,
  "p": 61,
  "k": "Bacteria have no nucleus"
 },
 {
  "id": "learn-cell7",
  "surface": "learn",
  "seq": 6,
  "type": "choice",
  "domain": null,
  "prompt": "Photosynthesis happens in the…",
  "options": [
   "Chloroplast",
   "Mitochondrion",
   "Nucleus",
   "Ribosome"
  ],
  "topic": "cell",
  "axis": null,
  "test": null,
  "c": 0,
  "t": 1,
  "p": 77,
  "k": "Chloroplasts do photosynthesis"
 },
 {
  "id": "learn-cell8",
  "surface": "learn",
  "seq": 7,
  "type": "choice",
  "domain": null,
  "prompt": "Division that makes two identical cells is…",
  "options": [
   "Mitosis",
   "Meiosis",
   "Osmosis",
   "Mutation"
  ],
  "topic": "cell",
  "axis": null,
  "test": null,
  "c": 0,
  "t": 1,
  "p": 58,
  "k": "Mitosis copies a cell",
  "w": "Meiosis is the other one — it halves the chromosomes to make egg and sperm cells."
 },
 {
  "id": "learn-gene1",
  "surface": "learn",
  "seq": 8,
  "type": "choice",
  "domain": null,
  "prompt": "DNA’s four bases are A, C, G and…",
  "options": [
   "T",
   "U",
   "P",
   "M"
  ],
  "topic": "gene",
  "axis": null,
  "test": null,
  "c": 0,
  "t": 1,
  "p": 69,
  "k": "DNA: A, C, G, T"
 },
 {
  "id": "learn-gene2",
  "surface": "learn",
  "seq": 9,
  "type": "choice",
  "domain": null,
  "prompt": "How many chromosomes are in a human body cell?",
  "options": [
   "46",
   "23",
   "92",
   "64"
  ],
  "topic": "gene",
  "axis": null,
  "test": null,
  "c": 0,
  "t": 1,
  "p": 63,
  "k": "46 chromosomes",
  "w": "23 pairs — one of each pair from each parent. 23 is the count in an egg or sperm cell."
 },
 {
  "id": "learn-gene3",
  "surface": "learn",
  "seq": 10,
  "type": "choice",
  "domain": null,
  "prompt": "A variant that shows only when inherited from both parents is…",
  "options": [
   "Recessive",
   "Dominant",
   "Mutant",
   "Linked"
  ],
  "topic": "gene",
  "axis": null,
  "test": null,
  "c": 0,
  "t": 1,
  "p": 72,
  "k": "Recessive needs both parents"
 },
 {
  "id": "learn-gene4",
  "surface": "learn",
  "seq": 11,
  "type": "choice",
  "domain": null,
  "prompt": "RNA uses which base in place of thymine?",
  "options": [
   "Uracil",
   "Guanine",
   "Adenine",
   "Cytosine"
  ],
  "topic": "gene",
  "axis": null,
  "test": null,
  "c": 0,
  "t": 2,
  "p": 41,
  "k": "RNA swaps T for uracil"
 },
 {
  "id": "learn-gene5",
  "surface": "learn",
  "seq": 12,
  "type": "choice",
  "domain": null,
  "prompt": "Who published DNA’s double helix in 1953?",
  "options": [
   "Watson & Crick",
   "Mendel",
   "Darwin",
   "Pasteur"
  ],
  "topic": "gene",
  "axis": null,
  "test": null,
  "c": 0,
  "t": 1,
  "p": 66,
  "k": "Double helix, 1953",
  "w": "Built on Rosalind Franklin’s X-ray images, used without her knowledge."
 },
 {
  "id": "learn-gene6",
  "surface": "learn",
  "seq": 13,
  "type": "choice",
  "domain": null,
  "prompt": "Mendel worked out inheritance by breeding…",
  "options": [
   "Pea plants",
   "Fruit flies",
   "Mice",
   "Roses"
  ],
  "topic": "gene",
  "axis": null,
  "test": null,
  "c": 0,
  "t": 1,
  "p": 57,
  "k": "Mendel bred peas"
 },
 {
  "id": "learn-gene7",
  "surface": "learn",
  "seq": 14,
  "type": "choice",
  "domain": null,
  "prompt": "Identical twins share…",
  "options": [
   "All their DNA",
   "Half their DNA",
   "A quarter of it",
   "None of it"
  ],
  "topic": "gene",
  "axis": null,
  "test": null,
  "c": 0,
  "t": 1,
  "p": 81,
  "k": "Identical twins: all DNA"
 },
 {
  "id": "learn-gene8",
  "surface": "learn",
  "seq": 15,
  "type": "choice",
  "domain": null,
  "prompt": "A change in a DNA sequence is a…",
  "options": [
   "Mutation",
   "Mitosis",
   "Meiosis",
   "Marker"
  ],
  "topic": "gene",
  "axis": null,
  "test": null,
  "c": 0,
  "t": 2,
  "p": 86,
  "k": "DNA change = mutation"
 },
 {
  "id": "learn-body1",
  "surface": "learn",
  "seq": 16,
  "type": "choice",
  "domain": null,
  "prompt": "Which vessels carry blood away from the heart?",
  "options": [
   "Arteries",
   "Veins",
   "Capillaries",
   "Ventricles"
  ],
  "topic": "body",
  "axis": null,
  "test": null,
  "c": 0,
  "t": 1,
  "p": 74,
  "k": "Arteries carry blood out"
 },
 {
  "id": "learn-body2",
  "surface": "learn",
  "seq": 17,
  "type": "choice",
  "domain": null,
  "prompt": "How many chambers does the heart have?",
  "options": [
   "Four",
   "Two",
   "Three",
   "Six"
  ],
  "topic": "body",
  "axis": null,
  "test": null,
  "c": 0,
  "t": 1,
  "p": 79,
  "k": "Four heart chambers"
 },
 {
  "id": "learn-body3",
  "surface": "learn",
  "seq": 18,
  "type": "choice",
  "domain": null,
  "prompt": "The largest organ in the body is the…",
  "options": [
   "Skin",
   "Liver",
   "Lung",
   "Brain"
  ],
  "topic": "body",
  "axis": null,
  "test": null,
  "c": 0,
  "t": 1,
  "p": 64,
  "k": "Skin is the largest organ"
 },
 {
  "id": "learn-body4",
  "surface": "learn",
  "seq": 19,
  "type": "choice",
  "domain": null,
  "prompt": "Which organ makes insulin?",
  "options": [
   "The pancreas",
   "The liver",
   "A kidney",
   "The spleen"
  ],
  "topic": "body",
  "axis": null,
  "test": null,
  "c": 0,
  "t": 1,
  "p": 55,
  "k": "The pancreas makes insulin"
 },
 {
  "id": "learn-body5",
  "surface": "learn",
  "seq": 20,
  "type": "choice",
  "domain": null,
  "prompt": "Where does most nutrient absorption happen?",
  "options": [
   "Small intestine",
   "Stomach",
   "Large intestine",
   "Liver"
  ],
  "topic": "body",
  "axis": null,
  "test": null,
  "c": 0,
  "t": 1,
  "p": 48,
  "k": "Small intestine absorbs"
 },
 {
  "id": "learn-body6",
  "surface": "learn",
  "seq": 21,
  "type": "choice",
  "domain": null,
  "prompt": "How many bones does an adult have?",
  "options": [
   "206",
   "About 300",
   "About 150",
   "412"
  ],
  "topic": "body",
  "axis": null,
  "test": null,
  "c": 0,
  "t": 1,
  "p": 52,
  "k": "206 adult bones",
  "w": "Babies start with about 300; many fuse together as they grow."
 },
 {
  "id": "learn-body7",
  "surface": "learn",
  "seq": 22,
  "type": "choice",
  "domain": null,
  "prompt": "Which part of the brain handles balance?",
  "options": [
   "Cerebellum",
   "Cerebrum",
   "Brain stem",
   "Hippocampus"
  ],
  "topic": "body",
  "axis": null,
  "test": null,
  "c": 0,
  "t": 1,
  "p": 43,
  "k": "Cerebellum: balance"
 },
 {
  "id": "learn-body8",
  "surface": "learn",
  "seq": 23,
  "type": "choice",
  "domain": null,
  "prompt": "Red blood cells carry oxygen using…",
  "options": [
   "Haemoglobin",
   "Insulin",
   "Collagen",
   "Keratin"
  ],
  "topic": "body",
  "axis": null,
  "test": null,
  "c": 0,
  "t": 2,
  "p": 76,
  "k": "Haemoglobin carries oxygen"
 },
 {
  "id": "learn-evo1",
  "surface": "learn",
  "seq": 24,
  "type": "choice",
  "domain": null,
  "prompt": "Natural selection acts on…",
  "options": [
   "Inherited variation",
   "Individual effort",
   "Learned habits",
   "Random wishes"
  ],
  "topic": "evo",
  "axis": null,
  "test": null,
  "c": 0,
  "t": 2,
  "p": 59,
  "k": "Selection needs inherited variation"
 },
 {
  "id": "learn-evo2",
  "surface": "learn",
  "seq": 25,
  "type": "choice",
  "domain": null,
  "prompt": "Darwin’s finches came from the…",
  "options": [
   "Galápagos",
   "Canaries",
   "Azores",
   "Falklands"
  ],
  "topic": "evo",
  "axis": null,
  "test": null,
  "c": 0,
  "t": 1,
  "p": 72,
  "k": "Darwin: the Galápagos"
 },
 {
  "id": "learn-evo3",
  "surface": "learn",
  "seq": 26,
  "type": "choice",
  "domain": null,
  "prompt": "Humans and chimpanzees have…",
  "options": [
   "A common ancestor",
   "Direct descent",
   "No relation",
   "An identical genome"
  ],
  "topic": "evo",
  "axis": null,
  "test": null,
  "c": 0,
  "t": 1,
  "p": 67,
  "k": "Chimps: a shared ancestor",
  "w": "We did not descend from chimps — both lines split from one older species."
 },
 {
  "id": "learn-evo4",
  "surface": "learn",
  "seq": 27,
  "type": "choice",
  "domain": null,
  "prompt": "Whales evolved from…",
  "options": [
   "Land mammals",
   "Fish",
   "Reptiles",
   "Sharks"
  ],
  "topic": "evo",
  "axis": null,
  "test": null,
  "c": 0,
  "t": 1,
  "p": 51,
  "k": "Whales came from land"
 },
 {
  "id": "learn-evo5",
  "surface": "learn",
  "seq": 28,
  "type": "choice",
  "domain": null,
  "prompt": "Same origin, different use — those structures are…",
  "options": [
   "Homologous",
   "Analogous",
   "Vestigial",
   "Convergent"
  ],
  "topic": "evo",
  "axis": null,
  "test": null,
  "c": 0,
  "t": 1,
  "p": 37,
  "k": "Homologous: shared origin"
 },
 {
  "id": "learn-evo6",
  "surface": "learn",
  "seq": 29,
  "type": "choice",
  "domain": null,
  "prompt": "Roughly how old is the Earth?",
  "options": [
   "4.5 billion years",
   "4.5 million years",
   "450 million years",
   "45 billion years"
  ],
  "topic": "evo",
  "axis": null,
  "test": null,
  "c": 0,
  "t": 1,
  "p": 69,
  "k": "Earth: 4.5 billion years"
 },
 {
  "id": "learn-evo7",
  "surface": "learn",
  "seq": 30,
  "type": "choice",
  "domain": null,
  "prompt": "Birds are the living descendants of…",
  "options": [
   "Dinosaurs",
   "Pterosaurs",
   "Crocodiles",
   "Early mammals"
  ],
  "topic": "evo",
  "axis": null,
  "test": null,
  "c": 0,
  "t": 1,
  "p": 62,
  "k": "Birds are dinosaurs"
 },
 {
  "id": "learn-evo8",
  "surface": "learn",
  "seq": 31,
  "type": "choice",
  "domain": null,
  "prompt": "Antibiotic resistance is an example of…",
  "options": [
   "Evolution in action",
   "A lab error",
   "A virus",
   "Natural immunity"
  ],
  "topic": "evo",
  "axis": null,
  "test": null,
  "c": 0,
  "t": 3,
  "p": 73,
  "k": "Resistance is evolution"
 },
 {
  "id": "learn-sol1",
  "surface": "learn",
  "seq": 32,
  "type": "choice",
  "domain": null,
  "prompt": "Which planet is closest to the Sun?",
  "options": [
   "Mercury",
   "Venus",
   "Mars",
   "Earth"
  ],
  "topic": "solar",
  "axis": null,
  "test": null,
  "c": 0,
  "t": 1,
  "p": 83,
  "k": "Mercury is closest"
 },
 {
  "id": "learn-sol2",
  "surface": "learn",
  "seq": 33,
  "type": "choice",
  "domain": null,
  "prompt": "Which planet is hottest?",
  "options": [
   "Venus",
   "Mercury",
   "Mars",
   "Jupiter"
  ],
  "topic": "solar",
  "axis": null,
  "test": null,
  "c": 0,
  "t": 1,
  "p": 47,
  "k": "Venus is hottest",
  "w": "Mercury sits closer, but Venus’s thick CO₂ blanket traps far more heat."
 },
 {
  "id": "learn-sol3",
  "surface": "learn",
  "seq": 34,
  "type": "choice",
  "domain": null,
  "prompt": "How many moons does Mars have?",
  "options": [
   "Two",
   "One",
   "None",
   "Four"
  ],
  "topic": "solar",
  "axis": null,
  "test": null,
  "c": 0,
  "t": 1,
  "p": 44,
  "k": "Mars has two moons"
 },
 {
  "id": "learn-sol4",
  "surface": "learn",
  "seq": 35,
  "type": "choice",
  "domain": null,
  "prompt": "Which planet has the fastest winds?",
  "options": [
   "Neptune",
   "Jupiter",
   "Saturn",
   "Earth"
  ],
  "topic": "solar",
  "axis": null,
  "test": null,
  "c": 0,
  "t": 1,
  "p": 33,
  "k": "Neptune: fastest winds"
 },
 {
  "id": "learn-sol5",
  "surface": "learn",
  "seq": 36,
  "type": "choice",
  "domain": null,
  "prompt": "The largest planet is…",
  "options": [
   "Jupiter",
   "Saturn",
   "Neptune",
   "Uranus"
  ],
  "topic": "solar",
  "axis": null,
  "test": null,
  "c": 0,
  "t": 1,
  "p": 88,
  "k": "Jupiter is largest"
 },
 {
  "id": "learn-sol6",
  "surface": "learn",
  "seq": 37,
  "type": "choice",
  "domain": null,
  "prompt": "Demoted from planet to dwarf planet in 2006:",
  "options": [
   "Pluto",
   "Ceres",
   "Eris",
   "Charon"
  ],
  "topic": "solar",
  "axis": null,
  "test": null,
  "c": 0,
  "t": 1,
  "p": 86,
  "k": "Pluto demoted, 2006"
 },
 {
  "id": "learn-sol7",
  "surface": "learn",
  "seq": 38,
  "type": "choice",
  "domain": null,
  "prompt": "A year on Venus is shorter than…",
  "options": [
   "Its own day",
   "An Earth month",
   "An Earth day",
   "Nothing"
  ],
  "topic": "solar",
  "axis": null,
  "test": null,
  "c": 0,
  "t": 2,
  "p": 29,
  "k": "Venus: year < day",
  "w": "Venus turns so slowly that one rotation takes longer than one trip round the Sun."
 },
 {
  "id": "learn-sol8",
  "surface": "learn",
  "seq": 39,
  "type": "choice",
  "domain": null,
  "prompt": "The asteroid belt sits between…",
  "options": [
   "Mars and Jupiter",
   "Earth and Mars",
   "Jupiter and Saturn",
   "Venus and Earth"
  ],
  "topic": "solar",
  "axis": null,
  "test": null,
  "c": 0,
  "t": 1,
  "p": 64,
  "k": "Belt: Mars–Jupiter"
 },
 {
  "id": "learn-str1",
  "surface": "learn",
  "seq": 40,
  "type": "choice",
  "domain": null,
  "prompt": "Our galaxy is the…",
  "options": [
   "Milky Way",
   "Andromeda",
   "Triangulum",
   "Sombrero"
  ],
  "topic": "stars",
  "axis": null,
  "test": null,
  "c": 0,
  "t": 1,
  "p": 87,
  "k": "We live in the Milky Way"
 },
 {
  "id": "learn-str2",
  "surface": "learn",
  "seq": 41,
  "type": "choice",
  "domain": null,
  "prompt": "The Sun is a…",
  "options": [
   "Yellow dwarf",
   "Red giant",
   "White dwarf",
   "Supergiant"
  ],
  "topic": "stars",
  "axis": null,
  "test": null,
  "c": 0,
  "t": 1,
  "p": 58,
  "k": "The Sun: a yellow dwarf"
 },
 {
  "id": "learn-str3",
  "surface": "learn",
  "seq": 42,
  "type": "choice",
  "domain": null,
  "prompt": "A light year measures…",
  "options": [
   "Distance",
   "Time",
   "Brightness",
   "Mass"
  ],
  "topic": "stars",
  "axis": null,
  "test": null,
  "c": 0,
  "t": 1,
  "p": 71,
  "k": "Light year = distance"
 },
 {
  "id": "learn-str4",
  "surface": "learn",
  "seq": 43,
  "type": "choice",
  "domain": null,
  "prompt": "A massive star’s collapse can leave…",
  "options": [
   "A black hole",
   "A nebula",
   "A comet",
   "A planet"
  ],
  "topic": "stars",
  "axis": null,
  "test": null,
  "c": 0,
  "t": 1,
  "p": 61,
  "k": "Collapse → black hole"
 },
 {
  "id": "learn-str5",
  "surface": "learn",
  "seq": 44,
  "type": "choice",
  "domain": null,
  "prompt": "The nearest star to the Sun is…",
  "options": [
   "Proxima Centauri",
   "Sirius",
   "Alpha Centauri A",
   "Polaris"
  ],
  "topic": "stars",
  "axis": null,
  "test": null,
  "c": 0,
  "t": 2,
  "p": 39,
  "k": "Nearest: Proxima Centauri"
 },
 {
  "id": "learn-str6",
  "surface": "learn",
  "seq": 45,
  "type": "choice",
  "domain": null,
  "prompt": "Most of a galaxy’s visible mass sits in its…",
  "options": [
   "Stars",
   "Central black hole",
   "Dust clouds",
   "Planets"
  ],
  "topic": "stars",
  "axis": null,
  "test": null,
  "c": 0,
  "t": 1,
  "p": 46,
  "k": "Galaxies are mostly stars"
 },
 {
  "id": "learn-str7",
  "surface": "learn",
  "seq": 46,
  "type": "choice",
  "domain": null,
  "prompt": "The universe is about…",
  "options": [
   "13.8 billion years old",
   "4.5 billion years old",
   "100 billion years old",
   "A trillion years old"
  ],
  "topic": "stars",
  "axis": null,
  "test": null,
  "c": 0,
  "t": 1,
  "p": 66,
  "k": "Universe: 13.8 billion years"
 },
 {
  "id": "learn-str8",
  "surface": "learn",
  "seq": 47,
  "type": "choice",
  "domain": null,
  "prompt": "Which colour of star burns hottest?",
  "options": [
   "Blue",
   "Red",
   "Yellow",
   "Orange"
  ],
  "topic": "stars",
  "axis": null,
  "test": null,
  "c": 0,
  "t": 1,
  "p": 41,
  "k": "Blue stars are hottest",
  "w": "Backwards from taps and maps: on stars, blue is hot and red is cool."
 },
 {
  "id": "learn-anc1",
  "surface": "learn",
  "seq": 48,
  "type": "choice",
  "domain": null,
  "prompt": "The Great Pyramid at Giza was built for…",
  "options": [
   "Khufu",
   "Tutankhamun",
   "Ramesses II",
   "Cleopatra"
  ],
  "topic": "ancient",
  "axis": null,
  "test": null,
  "c": 0,
  "t": 1,
  "p": 48,
  "k": "Great Pyramid: Khufu"
 },
 {
  "id": "learn-anc2",
  "surface": "learn",
  "seq": 49,
  "type": "choice",
  "domain": null,
  "prompt": "Hieroglyphs were deciphered thanks to the…",
  "options": [
   "Rosetta Stone",
   "Dead Sea Scrolls",
   "Code of Hammurabi",
   "Parthenon friezes"
  ],
  "topic": "ancient",
  "axis": null,
  "test": null,
  "c": 0,
  "t": 2,
  "p": 74,
  "k": "Rosetta Stone cracked it"
 },
 {
  "id": "learn-anc3",
  "surface": "learn",
  "seq": 50,
  "type": "choice",
  "domain": null,
  "prompt": "The first known written law code comes from…",
  "options": [
   "Mesopotamia",
   "Egypt",
   "Greece",
   "China"
  ],
  "topic": "ancient",
  "axis": null,
  "test": null,
  "c": 0,
  "t": 1,
  "p": 52,
  "k": "First laws: Mesopotamia"
 },
 {
  "id": "learn-anc4",
  "surface": "learn",
  "seq": 51,
  "type": "choice",
  "domain": null,
  "prompt": "Which empire built Machu Picchu?",
  "options": [
   "Inca",
   "Maya",
   "Aztec",
   "Olmec"
  ],
  "topic": "ancient",
  "axis": null,
  "test": null,
  "c": 0,
  "t": 1,
  "p": 63,
  "k": "Machu Picchu: Inca"
 },
 {
  "id": "learn-anc5",
  "surface": "learn",
  "seq": 52,
  "type": "choice",
  "domain": null,
  "prompt": "Athens is credited with the first…",
  "options": [
   "Democracy",
   "Republic",
   "Monarchy",
   "Empire"
  ],
  "topic": "ancient",
  "axis": null,
  "test": null,
  "c": 0,
  "t": 1,
  "p": 78,
  "k": "Athens: first democracy"
 },
 {
  "id": "learn-anc6",
  "surface": "learn",
  "seq": 53,
  "type": "choice",
  "domain": null,
  "prompt": "Alexander the Great was tutored by…",
  "options": [
   "Aristotle",
   "Plato",
   "Socrates",
   "Homer"
  ],
  "topic": "ancient",
  "axis": null,
  "test": null,
  "c": 0,
  "t": 1,
  "p": 56,
  "k": "Aristotle taught Alexander"
 },
 {
  "id": "learn-anc7",
  "surface": "learn",
  "seq": 54,
  "type": "choice",
  "domain": null,
  "prompt": "The Colosseum held roughly…",
  "options": [
   "50,000 people",
   "5,000 people",
   "200,000 people",
   "12,000 people"
  ],
  "topic": "ancient",
  "axis": null,
  "test": null,
  "c": 0,
  "t": 1,
  "p": 44,
  "k": "Colosseum: ~50,000"
 },
 {
  "id": "learn-anc8",
  "surface": "learn",
  "seq": 55,
  "type": "choice",
  "domain": null,
  "prompt": "Rome’s republic gave way to empire under…",
  "options": [
   "Augustus",
   "Julius Caesar",
   "Nero",
   "Hadrian"
  ],
  "topic": "ancient",
  "axis": null,
  "test": null,
  "c": 0,
  "t": 1,
  "p": 41,
  "k": "Augustus: first emperor",
  "w": "Caesar was never emperor — his heir Augustus took that step."
 },
 {
  "id": "learn-c201",
  "surface": "learn",
  "seq": 56,
  "type": "choice",
  "domain": null,
  "prompt": "The Berlin Wall fell in…",
  "options": [
   "1989",
   "1991",
   "1985",
   "1979"
  ],
  "topic": "c20",
  "axis": null,
  "test": null,
  "c": 0,
  "t": 1,
  "p": 71,
  "k": "Wall fell in 1989"
 },
 {
  "id": "learn-c202",
  "surface": "learn",
  "seq": 57,
  "type": "choice",
  "domain": null,
  "prompt": "The first person in space was…",
  "options": [
   "Yuri Gagarin",
   "Neil Armstrong",
   "Alan Shepard",
   "Valentina Tereshkova"
  ],
  "topic": "c20",
  "axis": null,
  "test": null,
  "c": 0,
  "t": 1,
  "p": 64,
  "k": "Gagarin went first"
 },
 {
  "id": "learn-c203",
  "surface": "learn",
  "seq": 58,
  "type": "choice",
  "domain": null,
  "prompt": "The Second World War ended in…",
  "options": [
   "1945",
   "1944",
   "1946",
   "1939"
  ],
  "topic": "c20",
  "axis": null,
  "test": null,
  "c": 0,
  "t": 1,
  "p": 89,
  "k": "WWII ended 1945"
 },
 {
  "id": "learn-c204",
  "surface": "learn",
  "seq": 59,
  "type": "choice",
  "domain": null,
  "prompt": "Apollo 11 landed on the Moon in…",
  "options": [
   "1969",
   "1968",
   "1972",
   "1965"
  ],
  "topic": "c20",
  "axis": null,
  "test": null,
  "c": 0,
  "t": 1,
  "p": 81,
  "k": "Moon landing: 1969"
 },
 {
  "id": "learn-c205",
  "surface": "learn",
  "seq": 60,
  "type": "choice",
  "domain": null,
  "prompt": "Penicillin was discovered by…",
  "options": [
   "Alexander Fleming",
   "Louis Pasteur",
   "Marie Curie",
   "Jonas Salk"
  ],
  "topic": "c20",
  "axis": null,
  "test": null,
  "c": 0,
  "t": 1,
  "p": 59,
  "k": "Fleming found penicillin"
 },
 {
  "id": "learn-c206",
  "surface": "learn",
  "seq": 61,
  "type": "choice",
  "domain": null,
  "prompt": "The United Nations was founded in…",
  "options": [
   "1945",
   "1919",
   "1950",
   "1930"
  ],
  "topic": "c20",
  "axis": null,
  "test": null,
  "c": 0,
  "t": 1,
  "p": 57,
  "k": "UN founded 1945",
  "w": "1919 was the League of Nations — the attempt that came before."
 },
 {
  "id": "learn-c207",
  "surface": "learn",
  "seq": 62,
  "type": "choice",
  "domain": null,
  "prompt": "Which country launched the first satellite?",
  "options": [
   "The Soviet Union",
   "The USA",
   "Germany",
   "Japan"
  ],
  "topic": "c20",
  "axis": null,
  "test": null,
  "c": 0,
  "t": 1,
  "p": 76,
  "k": "Sputnik was Soviet"
 },
 {
  "id": "learn-c208",
  "surface": "learn",
  "seq": 63,
  "type": "choice",
  "domain": null,
  "prompt": "Apartheid in South Africa formally ended in the…",
  "options": [
   "Early 1990s",
   "Late 1970s",
   "Early 1980s",
   "Late 1990s"
  ],
  "topic": "c20",
  "axis": null,
  "test": null,
  "c": 0,
  "t": 2,
  "p": 53,
  "k": "Apartheid ended, early 90s"
 },
 {
  "id": "learn-ear1",
  "surface": "learn",
  "seq": 64,
  "type": "choice",
  "domain": null,
  "prompt": "The longest river in the world is the…",
  "options": [
   "Nile",
   "Amazon",
   "Yangtze",
   "Mississippi"
  ],
  "topic": "earth",
  "axis": null,
  "test": null,
  "c": 0,
  "t": 1,
  "p": 56,
  "k": "Nile: longest river",
  "w": "Contested — by length the Nile leads, but the Amazon carries far more water."
 },
 {
  "id": "learn-ear2",
  "surface": "learn",
  "seq": 65,
  "type": "choice",
  "domain": null,
  "prompt": "Everest sits on the border of Nepal and…",
  "options": [
   "China",
   "India",
   "Bhutan",
   "Pakistan"
  ],
  "topic": "earth",
  "axis": null,
  "test": null,
  "c": 0,
  "t": 1,
  "p": 51,
  "k": "Everest: Nepal–China"
 },
 {
  "id": "learn-ear3",
  "surface": "learn",
  "seq": 66,
  "type": "choice",
  "domain": null,
  "prompt": "The deepest ocean trench is the…",
  "options": [
   "Mariana Trench",
   "Puerto Rico Trench",
   "Java Trench",
   "Tonga Trench"
  ],
  "topic": "earth",
  "axis": null,
  "test": null,
  "c": 0,
  "t": 3,
  "p": 73,
  "k": "Deepest: the Mariana"
 },
 {
  "id": "learn-ear4",
  "surface": "learn",
  "seq": 67,
  "type": "choice",
  "domain": null,
  "prompt": "Which river flows through Paris?",
  "options": [
   "The Seine",
   "The Loire",
   "The Rhône",
   "The Rhine"
  ],
  "topic": "earth",
  "axis": null,
  "test": null,
  "c": 0,
  "t": 1,
  "p": 77,
  "k": "Paris: the Seine"
 },
 {
  "id": "learn-ear5",
  "surface": "learn",
  "seq": 68,
  "type": "choice",
  "domain": null,
  "prompt": "The largest freshwater lake by volume is…",
  "options": [
   "Lake Baikal",
   "Lake Superior",
   "Lake Victoria",
   "The Caspian Sea"
  ],
  "topic": "earth",
  "axis": null,
  "test": null,
  "c": 0,
  "t": 1,
  "p": 38,
  "k": "Baikal holds the most"
 },
 {
  "id": "learn-ear6",
  "surface": "learn",
  "seq": 69,
  "type": "choice",
  "domain": null,
  "prompt": "Which continent has no rivers to speak of?",
  "options": [
   "Antarctica",
   "Australia",
   "Africa",
   "Europe"
  ],
  "topic": "earth",
  "axis": null,
  "test": null,
  "c": 0,
  "t": 1,
  "p": 57,
  "k": "Antarctica: no rivers"
 },
 {
  "id": "learn-ear7",
  "surface": "learn",
  "seq": 70,
  "type": "choice",
  "domain": null,
  "prompt": "The Andes run along which coast?",
  "options": [
   "Western South America",
   "Eastern South America",
   "Western Africa",
   "Southern Asia"
  ],
  "topic": "earth",
  "axis": null,
  "test": null,
  "c": 0,
  "t": 1,
  "p": 79,
  "k": "Andes: western coast"
 },
 {
  "id": "learn-ear8",
  "surface": "learn",
  "seq": 71,
  "type": "choice",
  "domain": null,
  "prompt": "The Sahara is roughly the size of…",
  "options": [
   "The USA",
   "Spain",
   "India",
   "Australia’s outback"
  ],
  "topic": "earth",
  "axis": null,
  "test": null,
  "c": 0,
  "t": 2,
  "p": 35,
  "k": "Sahara ≈ the USA"
 },
 {
  "id": "learn-cap1",
  "surface": "learn",
  "seq": 72,
  "type": "choice",
  "domain": null,
  "prompt": "The capital of Australia is…",
  "options": [
   "Canberra",
   "Sydney",
   "Melbourne",
   "Perth"
  ],
  "topic": "capitals",
  "axis": null,
  "test": null,
  "c": 0,
  "t": 1,
  "p": 61,
  "k": "Australia: Canberra"
 },
 {
  "id": "learn-cap2",
  "surface": "learn",
  "seq": 73,
  "type": "choice",
  "domain": null,
  "prompt": "The capital of Turkey is…",
  "options": [
   "Ankara",
   "Istanbul",
   "Izmir",
   "Bursa"
  ],
  "topic": "capitals",
  "axis": null,
  "test": null,
  "c": 0,
  "t": 1,
  "p": 54,
  "k": "Turkey: Ankara"
 },
 {
  "id": "learn-cap3",
  "surface": "learn",
  "seq": 74,
  "type": "choice",
  "domain": null,
  "prompt": "The capital of Canada is…",
  "options": [
   "Ottawa",
   "Toronto",
   "Vancouver",
   "Montreal"
  ],
  "topic": "capitals",
  "axis": null,
  "test": null,
  "c": 0,
  "t": 1,
  "p": 58,
  "k": "Canada: Ottawa"
 },
 {
  "id": "learn-cap4",
  "surface": "learn",
  "seq": 75,
  "type": "choice",
  "domain": null,
  "prompt": "The capital of Brazil is…",
  "options": [
   "Brasília",
   "Rio de Janeiro",
   "São Paulo",
   "Salvador"
  ],
  "topic": "capitals",
  "axis": null,
  "test": null,
  "c": 0,
  "t": 1,
  "p": 63,
  "k": "Brazil: Brasília"
 },
 {
  "id": "learn-cap5",
  "surface": "learn",
  "seq": 76,
  "type": "choice",
  "domain": null,
  "prompt": "The capital of Switzerland is…",
  "options": [
   "Bern",
   "Zurich",
   "Geneva",
   "Basel"
  ],
  "topic": "capitals",
  "axis": null,
  "test": null,
  "c": 0,
  "t": 1,
  "p": 42,
  "k": "Switzerland: Bern"
 },
 {
  "id": "learn-cap6",
  "surface": "learn",
  "seq": 77,
  "type": "choice",
  "domain": null,
  "prompt": "The capital of New Zealand is…",
  "options": [
   "Wellington",
   "Auckland",
   "Christchurch",
   "Dunedin"
  ],
  "topic": "capitals",
  "axis": null,
  "test": null,
  "c": 0,
  "t": 1,
  "p": 49,
  "k": "New Zealand: Wellington"
 },
 {
  "id": "learn-cap7",
  "surface": "learn",
  "seq": 78,
  "type": "choice",
  "domain": null,
  "prompt": "The capital of Morocco is…",
  "options": [
   "Rabat",
   "Casablanca",
   "Marrakesh",
   "Fez"
  ],
  "topic": "capitals",
  "axis": null,
  "test": null,
  "c": 0,
  "t": 1,
  "p": 39,
  "k": "Morocco: Rabat"
 },
 {
  "id": "learn-cap8",
  "surface": "learn",
  "seq": 79,
  "type": "choice",
  "domain": null,
  "prompt": "The capital of Myanmar is…",
  "options": [
   "Naypyidaw",
   "Yangon",
   "Mandalay",
   "Bago"
  ],
  "topic": "capitals",
  "axis": null,
  "test": null,
  "c": 0,
  "t": 1,
  "p": 31,
  "k": "Myanmar: Naypyidaw",
  "w": "Built from scratch and made capital in 2006; Yangon is still much larger."
 },
 {
  "id": "learn-org1",
  "surface": "learn",
  "seq": 80,
  "type": "choice",
  "domain": null,
  "prompt": "“Salary” comes from the Latin for…",
  "options": [
   "Salt",
   "Silver",
   "Service",
   "Sale"
  ],
  "topic": "origins",
  "axis": null,
  "test": null,
  "c": 0,
  "t": 1,
  "p": 47,
  "k": "Salary from salt"
 },
 {
  "id": "learn-org2",
  "surface": "learn",
  "seq": 81,
  "type": "choice",
  "domain": null,
  "prompt": "“Quarantine” comes from the Italian for…",
  "options": [
   "Forty",
   "Quiet",
   "Border",
   "Clean"
  ],
  "topic": "origins",
  "axis": null,
  "test": null,
  "c": 0,
  "t": 1,
  "p": 36,
  "k": "Quarantine = forty days"
 },
 {
  "id": "learn-org3",
  "surface": "learn",
  "seq": 82,
  "type": "choice",
  "domain": null,
  "prompt": "“Sandwich” is named after…",
  "options": [
   "An English earl",
   "A Dutch town",
   "A baker",
   "A ship"
  ],
  "topic": "origins",
  "axis": null,
  "test": null,
  "c": 0,
  "t": 1,
  "p": 58,
  "k": "Sandwich: an earl"
 },
 {
  "id": "learn-org4",
  "surface": "learn",
  "seq": 83,
  "type": "choice",
  "domain": null,
  "prompt": "“Muscle” comes from the Latin for…",
  "options": [
   "Little mouse",
   "Strong rope",
   "Living thread",
   "Warm flesh"
  ],
  "topic": "origins",
  "axis": null,
  "test": null,
  "c": 0,
  "t": 1,
  "p": 29,
  "k": "Muscle = little mouse",
  "w": "A flexing bicep looked, to Roman eyes, like a mouse moving under the skin."
 },
 {
  "id": "learn-org5",
  "surface": "learn",
  "seq": 84,
  "type": "choice",
  "domain": null,
  "prompt": "“Alcohol” entered English from…",
  "options": [
   "Arabic",
   "Latin",
   "Greek",
   "German"
  ],
  "topic": "origins",
  "axis": null,
  "test": null,
  "c": 0,
  "t": 1,
  "p": 44,
  "k": "Alcohol from Arabic"
 },
 {
  "id": "learn-org6",
  "surface": "learn",
  "seq": 85,
  "type": "choice",
  "domain": null,
  "prompt": "“Robot” was coined in a…",
  "options": [
   "Czech play",
   "German novel",
   "Russian film",
   "British essay"
  ],
  "topic": "origins",
  "axis": null,
  "test": null,
  "c": 0,
  "t": 1,
  "p": 38,
  "k": "Robot: a Czech play"
 },
 {
  "id": "learn-org7",
  "surface": "learn",
  "seq": 86,
  "type": "choice",
  "domain": null,
  "prompt": "“Avocado” traces back to…",
  "options": [
   "Nahuatl",
   "Spanish",
   "Portuguese",
   "Quechua"
  ],
  "topic": "origins",
  "axis": null,
  "test": null,
  "c": 0,
  "t": 1,
  "p": 33,
  "k": "Avocado from Nahuatl"
 },
 {
  "id": "learn-org8",
  "surface": "learn",
  "seq": 87,
  "type": "choice",
  "domain": null,
  "prompt": "“Nightmare” originally meant a…",
  "options": [
   "Crushing spirit",
   "Bad dream",
   "Dark horse",
   "Night fever"
  ],
  "topic": "origins",
  "axis": null,
  "test": null,
  "c": 0,
  "t": 1,
  "p": 26,
  "k": "Nightmare: a spirit",
  "w": "The “mare” is an old word for a demon that sat on a sleeper’s chest — no horse involved."
 },
 {
  "id": "learn-con1",
  "surface": "learn",
  "seq": 88,
  "type": "choice",
  "domain": null,
  "prompt": "Turning on its own axis is…",
  "options": [
   "Rotation",
   "Orbit",
   "Revolution",
   "Tilt"
  ],
  "topic": "confused",
  "axis": null,
  "test": null,
  "c": 0,
  "t": 1,
  "p": 62,
  "k": "Rotation vs orbit"
 },
 {
  "id": "learn-con2",
  "surface": "learn",
  "seq": 89,
  "type": "choice",
  "domain": null,
  "prompt": "“Affect” is usually a…",
  "options": [
   "Verb",
   "Noun",
   "Adjective",
   "Adverb"
  ],
  "topic": "confused",
  "axis": null,
  "test": null,
  "c": 0,
  "t": 1,
  "p": 57,
  "k": "Affect is the verb"
 },
 {
  "id": "learn-con3",
  "surface": "learn",
  "seq": 90,
  "type": "choice",
  "domain": null,
  "prompt": "With things you can count, use…",
  "options": [
   "Fewer",
   "Less",
   "Either",
   "Neither"
  ],
  "topic": "confused",
  "axis": null,
  "test": null,
  "c": 0,
  "t": 1,
  "p": 64,
  "k": "Fewer for countables"
 },
 {
  "id": "learn-con4",
  "surface": "learn",
  "seq": 91,
  "type": "choice",
  "domain": null,
  "prompt": "“Its” without an apostrophe means…",
  "options": [
   "Belonging to it",
   "It is",
   "It has",
   "The plural of it"
  ],
  "topic": "confused",
  "axis": null,
  "test": null,
  "c": 0,
  "t": 1,
  "p": 71,
  "k": "Its = belonging to it"
 },
 {
  "id": "learn-con5",
  "surface": "learn",
  "seq": 92,
  "type": "choice",
  "domain": null,
  "prompt": "A “principal” is…",
  "options": [
   "A person or the main thing",
   "A rule",
   "A belief",
   "Interest owed"
  ],
  "topic": "confused",
  "axis": null,
  "test": null,
  "c": 0,
  "t": 1,
  "p": 52,
  "k": "Principal vs principle"
 },
 {
  "id": "learn-con6",
  "surface": "learn",
  "seq": 93,
  "type": "choice",
  "domain": null,
  "prompt": "“Literally” strictly means…",
  "options": [
   "Exactly as stated",
   "Very much",
   "Almost",
   "Figuratively"
  ],
  "topic": "confused",
  "axis": null,
  "test": null,
  "c": 0,
  "t": 3,
  "p": 68,
  "k": "Literally = exactly"
 },
 {
  "id": "learn-con7",
  "surface": "learn",
  "seq": 94,
  "type": "choice",
  "domain": null,
  "prompt": "“Compliment” with an i means…",
  "options": [
   "Praise",
   "A completion",
   "A match",
   "A full set"
  ],
  "topic": "confused",
  "axis": null,
  "test": null,
  "c": 0,
  "t": 2,
  "p": 59,
  "k": "Compliment is praise"
 },
 {
  "id": "learn-con8",
  "surface": "learn",
  "seq": 95,
  "type": "choice",
  "domain": null,
  "prompt": "Who implies — and who infers?",
  "options": [
   "Speaker implies",
   "Listener implies",
   "The text implies",
   "The editor implies"
  ],
  "topic": "confused",
  "axis": null,
  "test": null,
  "c": 0,
  "t": 1,
  "p": 46,
  "k": "Speakers imply, listeners infer"
 },
 {
  "id": "learn-anc9",
  "surface": "learn",
  "seq": 96,
  "type": "choice",
  "domain": null,
  "prompt": "Most of the Great Wall standing today was built by the…",
  "options": [
   "Qin dynasty",
   "Han dynasty",
   "Ming dynasty",
   "Tang dynasty"
  ],
  "topic": "ancient",
  "axis": null,
  "test": null,
  "c": 2,
  "t": 0,
  "p": 34,
  "k": "Great Wall: mostly Ming",
  "w": "Qin's walls were rammed earth; the stone wall tourists walk is 1,500 years younger."
 },
 {
  "id": "learn-anc10",
  "surface": "learn",
  "seq": 97,
  "type": "choice",
  "domain": null,
  "prompt": "When Cleopatra was born, the Great Pyramid was already…",
  "options": [
   "About 500 years old",
   "About 1,000 years old",
   "Newly built",
   "About 2,500 years old"
  ],
  "topic": "ancient",
  "axis": null,
  "test": null,
  "c": 3,
  "t": 0,
  "p": 31,
  "k": "Pyramid long predates Cleopatra",
  "w": "She lived nearer in time to the Moon landing than to the Great Pyramid."
 },
 {
  "id": "learn-anc11",
  "surface": "learn",
  "seq": 98,
  "type": "choice",
  "domain": null,
  "prompt": "The Library of Alexandria was lost…",
  "options": [
   "In one great fire",
   "Gradually, over centuries",
   "In an earthquake",
   "To a flood"
  ],
  "topic": "ancient",
  "axis": null,
  "test": null,
  "c": 1,
  "t": 0,
  "p": 38,
  "k": "Alexandria's library faded slowly",
  "w": "No single fire ended it — funding cuts, wars and neglect did, across centuries."
 },
 {
  "id": "learn-anc12",
  "surface": "learn",
  "seq": 99,
  "type": "choice",
  "domain": null,
  "prompt": "The ancient Olympic Games were held in honour of…",
  "options": [
   "Apollo",
   "Athena",
   "Zeus",
   "Hercules"
  ],
  "topic": "ancient",
  "axis": null,
  "test": null,
  "c": 2,
  "t": 0,
  "p": 61,
  "k": "Olympic Games honoured Zeus"
 },
 {
  "id": "learn-anc13",
  "surface": "learn",
  "seq": 100,
  "type": "choice",
  "domain": null,
  "prompt": "A Roman gladiator fight usually ended…",
  "options": [
   "With the loser killed",
   "With both men alive",
   "With the crowd deciding",
   "In a formal draw"
  ],
  "topic": "ancient",
  "axis": null,
  "test": null,
  "c": 1,
  "t": 0,
  "p": 36,
  "k": "Most gladiators survived their fights",
  "w": "A trained gladiator cost a fortune to keep; killing one threw that money away."
 },
 {
  "id": "learn-body9",
  "surface": "learn",
  "seq": 101,
  "type": "choice",
  "domain": null,
  "prompt": "Roughly how much of an adult's body weight is water?",
  "options": [
   "About 90%",
   "About 60%",
   "About 30%",
   "About 75%"
  ],
  "topic": "body",
  "axis": null,
  "test": null,
  "c": 1,
  "t": 0,
  "p": 47,
  "k": "Bodies are ~60% water"
 },
 {
  "id": "learn-body10",
  "surface": "learn",
  "seq": 102,
  "type": "choice",
  "domain": null,
  "prompt": "At rest, how much of the brain is active?",
  "options": [
   "About 10%",
   "Effectively all of it",
   "About 25%",
   "About half"
  ],
  "topic": "body",
  "axis": null,
  "test": null,
  "c": 1,
  "t": 0,
  "p": 52,
  "k": "The whole brain stays active",
  "w": "The 10% claim has no source in neuroscience — scans light the whole organ up."
 },
 {
  "id": "learn-body11",
  "surface": "learn",
  "seq": 103,
  "type": "choice",
  "domain": null,
  "prompt": "Which blood type can donate to anyone?",
  "options": [
   "AB positive",
   "A positive",
   "O positive",
   "O negative"
  ],
  "topic": "body",
  "axis": null,
  "test": null,
  "c": 3,
  "t": 0,
  "p": 58,
  "k": "O negative donates to anyone",
  "w": "AB positive is the opposite — the universal recipient, not the universal donor."
 },
 {
  "id": "learn-body12",
  "surface": "learn",
  "seq": 104,
  "type": "choice",
  "domain": null,
  "prompt": "Which organ filters waste out of the blood?",
  "options": [
   "The liver",
   "The spleen",
   "The kidneys",
   "The pancreas"
  ],
  "topic": "body",
  "axis": null,
  "test": null,
  "c": 2,
  "t": 0,
  "p": 77,
  "k": "Kidneys filter the blood"
 },
 {
  "id": "learn-body13",
  "surface": "learn",
  "seq": 105,
  "type": "choice",
  "domain": null,
  "prompt": "A red blood cell lives for about…",
  "options": [
   "A week",
   "Four months",
   "A year",
   "A day"
  ],
  "topic": "body",
  "axis": null,
  "test": null,
  "c": 1,
  "t": 0,
  "p": 33,
  "k": "Red cells last four months"
 },
 {
  "id": "learn-c209",
  "surface": "learn",
  "seq": 106,
  "type": "choice",
  "domain": null,
  "prompt": "The Titanic sank in…",
  "options": [
   "1905",
   "1923",
   "1912",
   "1899"
  ],
  "topic": "c20",
  "axis": null,
  "test": null,
  "c": 2,
  "t": 0,
  "p": 72,
  "k": "Titanic sank in 1912"
 },
 {
  "id": "learn-c210",
  "surface": "learn",
  "seq": 107,
  "type": "choice",
  "domain": null,
  "prompt": "The Wright brothers first flew in…",
  "options": [
   "1913",
   "1903",
   "1896",
   "1921"
  ],
  "topic": "c20",
  "axis": null,
  "test": null,
  "c": 1,
  "t": 0,
  "p": 55,
  "k": "First flight: 1903",
  "w": "A decade before WWI made aeroplanes ordinary — earlier than most people place it."
 },
 {
  "id": "learn-c211",
  "surface": "learn",
  "seq": 108,
  "type": "choice",
  "domain": null,
  "prompt": "The Chernobyl disaster happened in…",
  "options": [
   "1986",
   "1991",
   "1979",
   "1972"
  ],
  "topic": "c20",
  "axis": null,
  "test": null,
  "c": 0,
  "t": 1,
  "p": 63,
  "k": "Chernobyl: 1986",
  "w": "1991 is the Soviet collapse — the association that pulls the guess late."
 },
 {
  "id": "learn-c212",
  "surface": "learn",
  "seq": 109,
  "type": "choice",
  "domain": null,
  "prompt": "India became independent in…",
  "options": [
   "1950",
   "1939",
   "1957",
   "1947"
  ],
  "topic": "c20",
  "axis": null,
  "test": null,
  "c": 3,
  "t": 0,
  "p": 48,
  "k": "India independent in 1947",
  "w": "1950 is Republic Day — the constitution, not independence."
 },
 {
  "id": "learn-c213",
  "surface": "learn",
  "seq": 110,
  "type": "choice",
  "domain": null,
  "prompt": "The first woman to win a Nobel Prize was…",
  "options": [
   "Rosalind Franklin",
   "Marie Curie",
   "Mother Teresa",
   "Jane Goodall"
  ],
  "topic": "c20",
  "axis": null,
  "test": null,
  "c": 1,
  "t": 0,
  "p": 67,
  "k": "Curie, first female Nobel",
  "w": "Physics, 1903, shared with Pierre and Becquerel. Franklin famously never won — the injustice people remember pulls the guess."
 },
 {
  "id": "learn-cap9",
  "surface": "learn",
  "seq": 111,
  "type": "choice",
  "domain": null,
  "prompt": "The capital of the United States is…",
  "options": [
   "Washington, D.C.",
   "New York City",
   "Los Angeles",
   "Philadelphia"
  ],
  "topic": "capitals",
  "axis": null,
  "test": null,
  "c": 0,
  "t": 1,
  "p": 88,
  "k": "USA: Washington, D.C."
 },
 {
  "id": "learn-cap10",
  "surface": "learn",
  "seq": 112,
  "type": "choice",
  "domain": null,
  "prompt": "The capital of Vietnam is…",
  "options": [
   "Ho Chi Minh City",
   "Da Nang",
   "Hanoi",
   "Hue"
  ],
  "topic": "capitals",
  "axis": null,
  "test": null,
  "c": 2,
  "t": 0,
  "p": 52,
  "k": "Vietnam: Hanoi"
 },
 {
  "id": "learn-cap11",
  "surface": "learn",
  "seq": 113,
  "type": "choice",
  "domain": null,
  "prompt": "The capital of the Netherlands is…",
  "options": [
   "The Hague",
   "Amsterdam",
   "Rotterdam",
   "Utrecht"
  ],
  "topic": "capitals",
  "axis": null,
  "test": null,
  "c": 1,
  "t": 0,
  "p": 46,
  "k": "Netherlands: Amsterdam",
  "w": "The government sits in The Hague, but the constitution names Amsterdam the capital — the trap catches people who know half the story."
 },
 {
  "id": "learn-cap12",
  "surface": "learn",
  "seq": 114,
  "type": "choice",
  "domain": null,
  "prompt": "The capital of Nigeria is…",
  "options": [
   "Lagos",
   "Abuja",
   "Kano",
   "Ibadan"
  ],
  "topic": "capitals",
  "axis": null,
  "test": null,
  "c": 1,
  "t": 0,
  "p": 36,
  "k": "Nigeria: Abuja",
  "w": "The capital moved from Lagos to purpose-built Abuja in 1991; Lagos stays the giant."
 },
 {
  "id": "learn-cap13",
  "surface": "learn",
  "seq": 115,
  "type": "choice",
  "domain": null,
  "prompt": "The capital of Tanzania is…",
  "options": [
   "Dar es Salaam",
   "Nairobi",
   "Dodoma",
   "Zanzibar City"
  ],
  "topic": "capitals",
  "axis": null,
  "test": null,
  "c": 2,
  "t": 0,
  "p": 27,
  "k": "Tanzania: Dodoma",
  "w": "Dodoma has been the official capital since 1996; Dar es Salaam remains the largest city and former capital."
 },
 {
  "id": "learn-cell9",
  "surface": "learn",
  "seq": 116,
  "type": "choice",
  "domain": null,
  "prompt": "What controls what enters and leaves a cell?",
  "options": [
   "The cell wall",
   "The cell membrane",
   "The nucleus",
   "The cytoplasm"
  ],
  "topic": "cell",
  "axis": null,
  "test": null,
  "c": 1,
  "t": 0,
  "p": 55,
  "k": "Membranes control what enters",
  "w": "Plant cells have a wall too, but that is rigid support — the membrane underneath is what actually decides what crosses."
 },
 {
  "id": "learn-cell10",
  "surface": "learn",
  "seq": 117,
  "type": "choice",
  "domain": null,
  "prompt": "What speeds a cell's chemical reactions up without being used up?",
  "options": [
   "A hormone",
   "An enzyme",
   "A vitamin",
   "A mineral"
  ],
  "topic": "cell",
  "axis": null,
  "test": null,
  "c": 1,
  "t": 0,
  "p": 66,
  "k": "Enzymes speed reactions up",
  "w": "Enzymes lower the energy a reaction needs and come out unchanged, so a tiny amount works over and over."
 },
 {
  "id": "learn-cell11",
  "surface": "learn",
  "seq": 118,
  "type": "choice",
  "domain": null,
  "prompt": "Water moving across a membrane toward the saltier side is…",
  "options": [
   "Diffusion",
   "Filtration",
   "Osmosis",
   "Active transport"
  ],
  "topic": "cell",
  "axis": null,
  "test": null,
  "c": 2,
  "t": 0,
  "p": 72,
  "k": "Osmosis moves the water",
  "w": "Osmosis is diffusion's special case: the membrane lets water through but not the salt, so the water is what moves."
 },
 {
  "id": "learn-cell12",
  "surface": "learn",
  "seq": 119,
  "type": "choice",
  "domain": null,
  "prompt": "Where does a new cell come from?",
  "options": [
   "Another cell",
   "Non-living matter",
   "The bloodstream",
   "A virus"
  ],
  "topic": "cell",
  "axis": null,
  "test": null,
  "c": 0,
  "t": 1,
  "p": 48,
  "k": "Cells come only from cells",
  "w": "Virchow's line — omnis cellula e cellula. It is the observation that closed the door on spontaneous generation."
 },
 {
  "id": "learn-cell13",
  "surface": "learn",
  "seq": 120,
  "type": "choice",
  "domain": null,
  "prompt": "Which organelle packages and ships proteins?",
  "options": [
   "The ribosome",
   "The lysosome",
   "The nucleus",
   "The Golgi apparatus"
  ],
  "topic": "cell",
  "axis": null,
  "test": null,
  "c": 3,
  "t": 0,
  "p": 80,
  "k": "The Golgi ships proteins",
  "w": "Ribosomes build the protein; the Golgi folds, tags and sends it on. Building and shipping are different jobs in the same factory."
 },
 {
  "id": "learn-con9",
  "surface": "learn",
  "seq": 121,
  "type": "choice",
  "domain": null,
  "prompt": "Weather and climate differ because…",
  "options": [
   "Climate is the long-run average",
   "Climate is today's conditions",
   "They mean the same thing",
   "Weather is the long-run average"
  ],
  "topic": "confused",
  "axis": null,
  "test": null,
  "c": 0,
  "t": 3,
  "p": 50,
  "k": "Climate is the long average",
  "w": "Climate is weather averaged over about thirty years, which is why one cold week is not evidence about it either way."
 },
 {
  "id": "learn-con10",
  "surface": "learn",
  "seq": 122,
  "type": "choice",
  "domain": null,
  "prompt": "Standing on the Moon, what actually changes?",
  "options": [
   "Your mass",
   "Your weight",
   "Both equally",
   "Neither"
  ],
  "topic": "confused",
  "axis": null,
  "test": null,
  "c": 1,
  "t": 0,
  "p": 63,
  "k": "Weight changes, mass does not",
  "w": "Mass is how much of you there is; weight is gravity pulling on it. The Moon pulls a sixth as hard."
 },
 {
  "id": "learn-con11",
  "surface": "learn",
  "seq": 123,
  "type": "choice",
  "domain": null,
  "prompt": "A snake that injects toxin through a bite is…",
  "options": [
   "Poisonous",
   "Toxic",
   "Venomous",
   "Caustic"
  ],
  "topic": "confused",
  "axis": null,
  "test": null,
  "c": 2,
  "t": 0,
  "p": 58,
  "k": "Venom is injected",
  "w": "Venom is delivered by a bite or sting; poison is absorbed or swallowed. A pufferfish is poisonous, a cobra is venomous."
 },
 {
  "id": "learn-con12",
  "surface": "learn",
  "seq": 124,
  "type": "choice",
  "domain": null,
  "prompt": "Comparing two things, you use…",
  "options": [
   "Then",
   "Than",
   "Thence",
   "Thus"
  ],
  "topic": "confused",
  "axis": null,
  "test": null,
  "c": 1,
  "t": 0,
  "p": 44,
  "k": "Than compares two things",
  "w": "Than compares, then sequences. If the sentence would take “next”, it wants then."
 },
 {
  "id": "learn-con13",
  "surface": "learn",
  "seq": 125,
  "type": "choice",
  "domain": null,
  "prompt": "Antibiotics work against…",
  "options": [
   "Viruses",
   "Bacteria",
   "Both equally",
   "Neither"
  ],
  "topic": "confused",
  "axis": null,
  "test": null,
  "c": 1,
  "t": 0,
  "p": 70,
  "k": "Antibiotics miss viruses",
  "w": "Antibiotics attack bacterial machinery viruses do not have — which is why they do nothing for a cold."
 },
 {
  "id": "learn-ear9",
  "surface": "learn",
  "seq": 126,
  "type": "choice",
  "domain": null,
  "prompt": "The second-highest mountain on Earth is…",
  "options": [
   "Kangchenjunga",
   "K2",
   "Lhotse",
   "Annapurna"
  ],
  "topic": "earth",
  "axis": null,
  "test": null,
  "c": 1,
  "t": 0,
  "p": 55,
  "k": "K2 stands second"
 },
 {
  "id": "learn-ear10",
  "surface": "learn",
  "seq": 127,
  "type": "choice",
  "domain": null,
  "prompt": "Which river carries the most water?",
  "options": [
   "The Amazon",
   "The Nile",
   "The Congo",
   "The Yangtze"
  ],
  "topic": "earth",
  "axis": null,
  "test": null,
  "c": 0,
  "t": 1,
  "p": 48,
  "k": "Amazon: the biggest flow"
 },
 {
  "id": "learn-ear11",
  "surface": "learn",
  "seq": 128,
  "type": "choice",
  "domain": null,
  "prompt": "Kilimanjaro, Africa's highest peak, is a…",
  "options": [
   "Fold mountain",
   "Fault-block ridge",
   "Dormant volcano",
   "Plateau remnant"
  ],
  "topic": "earth",
  "axis": null,
  "test": null,
  "c": 2,
  "t": 0,
  "p": 64,
  "k": "Kilimanjaro is a volcano"
 },
 {
  "id": "learn-ear12",
  "surface": "learn",
  "seq": 129,
  "type": "choice",
  "domain": null,
  "prompt": "The river that carved the Grand Canyon is the…",
  "options": [
   "Rio Grande",
   "Colorado",
   "Mississippi",
   "Missouri"
  ],
  "topic": "earth",
  "axis": null,
  "test": null,
  "c": 1,
  "t": 0,
  "p": 42,
  "k": "The Colorado carved it"
 },
 {
  "id": "learn-ear13",
  "surface": "learn",
  "seq": 130,
  "type": "choice",
  "domain": null,
  "prompt": "Which mountains draw the classic Europe–Asia line?",
  "options": [
   "The Urals",
   "The Caucasus",
   "The Alps",
   "The Carpathians"
  ],
  "topic": "earth",
  "axis": null,
  "test": null,
  "c": 0,
  "t": 1,
  "p": 58,
  "k": "Urals: the continental line",
  "w": "The 18th-century convention puts the line on the Urals; the Caucasus marks its disputed southern stretch, which is why it pulls votes."
 },
 {
  "id": "learn-evo9",
  "surface": "learn",
  "seq": 131,
  "type": "choice",
  "domain": null,
  "prompt": "Onboard leftovers from an ancestor — those structures are…",
  "options": [
   "Homologous",
   "Analogous",
   "Adaptive",
   "Vestigial"
  ],
  "topic": "evo",
  "axis": null,
  "test": null,
  "c": 3,
  "t": 0,
  "p": 66,
  "k": "Vestigial: evolution's leftovers"
 },
 {
  "id": "learn-evo10",
  "surface": "learn",
  "seq": 132,
  "type": "choice",
  "domain": null,
  "prompt": "England's peppered moths turned dark because…",
  "options": [
   "Soot stained their wings",
   "Dark moths dodged the birds",
   "They chose camouflage",
   "Smog sped up mutation"
  ],
  "topic": "evo",
  "axis": null,
  "test": null,
  "c": 1,
  "t": 0,
  "p": 61,
  "k": "Peppered moth: selection"
 },
 {
  "id": "learn-evo11",
  "surface": "learn",
  "seq": 133,
  "type": "choice",
  "domain": null,
  "prompt": "Most of life's history on Earth was spent as…",
  "options": [
   "Fish",
   "Reptiles",
   "Single cells",
   "Plants"
  ],
  "topic": "evo",
  "axis": null,
  "test": null,
  "c": 2,
  "t": 0,
  "p": 71,
  "k": "Mostly single cells"
 },
 {
  "id": "learn-evo12",
  "surface": "learn",
  "seq": 134,
  "type": "choice",
  "domain": null,
  "prompt": "Lucy, the famous fossil, was a…",
  "options": [
   "Neanderthal",
   "Homo erectus",
   "Cro-Magnon",
   "An Australopithecus"
  ],
  "topic": "evo",
  "axis": null,
  "test": null,
  "c": 3,
  "t": 0,
  "p": 74,
  "k": "Lucy: Australopithecus"
 },
 {
  "id": "learn-evo13",
  "surface": "learn",
  "seq": 135,
  "type": "choice",
  "domain": null,
  "prompt": "In biology, \"the fittest\" is the one that…",
  "options": [
   "Is the strongest",
   "Leaves the most offspring",
   "Lives the longest",
   "Beats its rivals"
  ],
  "topic": "evo",
  "axis": null,
  "test": null,
  "c": 1,
  "t": 0,
  "p": 44,
  "k": "Fitness counts offspring"
 },
 {
  "id": "learn-gene9",
  "surface": "learn",
  "seq": 136,
  "type": "choice",
  "domain": null,
  "prompt": "How different is your DNA from a stranger's?",
  "options": [
   "About 5%",
   "About 0.1%",
   "About 1%",
   "About 10%"
  ],
  "topic": "gene",
  "axis": null,
  "test": null,
  "c": 1,
  "t": 2,
  "p": 52,
  "k": "Humans differ by 0.1%",
  "w": "Any two people are about 99.9% identical — the ~1% figure people reach for is the human-chimp comparison."
 },
 {
  "id": "learn-gene10",
  "surface": "learn",
  "seq": 137,
  "type": "choice",
  "domain": null,
  "prompt": "The first mammal cloned from an adult cell was a…",
  "options": [
   "Mouse",
   "Sheep",
   "Cat",
   "Monkey"
  ],
  "topic": "gene",
  "axis": null,
  "test": null,
  "c": 1,
  "t": 0,
  "p": 75,
  "k": "Dolly: cloned from adult cell",
  "w": "Dolly (1996), grown from a mammary-gland cell — mice, the lab default, weren't cloned until two years later."
 },
 {
  "id": "learn-gene11",
  "surface": "learn",
  "seq": 138,
  "type": "choice",
  "domain": null,
  "prompt": "Roughly how many protein-coding genes do you have?",
  "options": [
   "20,000",
   "100,000",
   "1 million",
   "3 billion"
  ],
  "topic": "gene",
  "axis": null,
  "test": null,
  "c": 0,
  "t": 3,
  "p": 44,
  "k": "About 20,000 human genes",
  "w": "Far fewer than the pre-genome guess of 100,000. The famous 3 billion counts base pairs, not genes."
 },
 {
  "id": "learn-gene12",
  "surface": "learn",
  "seq": 139,
  "type": "choice",
  "domain": null,
  "prompt": "Mitochondrial DNA is inherited from…",
  "options": [
   "Your mother",
   "Your father",
   "Both parents",
   "A random parent"
  ],
  "topic": "gene",
  "axis": null,
  "test": null,
  "c": 0,
  "t": 2,
  "p": 58,
  "k": "Mitochondrial DNA: maternal",
  "w": "Sperm mitochondria are destroyed after fertilisation, so the egg's line carries it — the basis of the 'Mitochondrial Eve' idea."
 },
 {
  "id": "learn-gene13",
  "surface": "learn",
  "seq": 140,
  "type": "choice",
  "domain": null,
  "prompt": "A baby's chromosomal sex is settled by…",
  "options": [
   "The mother's egg",
   "Either cell equally",
   "The father's sperm",
   "Nothing until after conception"
  ],
  "topic": "gene",
  "axis": null,
  "test": null,
  "c": 2,
  "t": 0,
  "p": 60,
  "k": "Sperm carries X or Y",
  "w": "Eggs always carry an X; sperm carry X or Y — history blamed mothers for a coin the father's side flips."
 },
 {
  "id": "learn-org9",
  "surface": "learn",
  "seq": 141,
  "type": "choice",
  "domain": null,
  "prompt": "“Ketchup” most likely began as a…",
  "options": [
   "Tomato jam",
   "Fish sauce",
   "Berry paste",
   "Meat glaze"
  ],
  "topic": "origins",
  "axis": null,
  "test": null,
  "c": 1,
  "t": 0,
  "p": 40,
  "k": "Ketchup began as fish sauce",
  "w": "From a Chinese fermented fish sauce (kê-tsiap); tomatoes joined the recipe centuries later."
 },
 {
  "id": "learn-org10",
  "surface": "learn",
  "seq": 142,
  "type": "choice",
  "domain": null,
  "prompt": "“Trivia” comes from the Latin for…",
  "options": [
   "Idle talk",
   "Small things",
   "Three roads",
   "Riddles"
  ],
  "topic": "origins",
  "axis": null,
  "test": null,
  "c": 2,
  "t": 1,
  "p": 31,
  "k": "Trivia: three roads",
  "w": "A trivium was a crossroads — the place where commonplace, everyday talk circulated."
 },
 {
  "id": "learn-org11",
  "surface": "learn",
  "seq": 143,
  "type": "choice",
  "domain": null,
  "prompt": "A “clue” was originally a…",
  "options": [
   "Whisper",
   "Footprint",
   "Key",
   "Ball of thread"
  ],
  "topic": "origins",
  "axis": null,
  "test": null,
  "c": 3,
  "t": 1,
  "p": 35,
  "k": "Clue: a ball of thread",
  "w": "A “clew” of yarn — like the one Theseus unwound to find his way out of the labyrinth."
 },
 {
  "id": "learn-org12",
  "surface": "learn",
  "seq": 144,
  "type": "choice",
  "domain": null,
  "prompt": "“Disaster” literally means a bad…",
  "options": [
   "Storm",
   "Star",
   "Day",
   "Omen"
  ],
  "topic": "origins",
  "axis": null,
  "test": null,
  "c": 1,
  "t": 3,
  "p": 48,
  "k": "Disaster: an ill star",
  "w": "Dis- plus astrum: born under an unfavourable star, back when the sky took the blame."
 },
 {
  "id": "learn-org13",
  "surface": "learn",
  "seq": 145,
  "type": "choice",
  "domain": null,
  "prompt": "“Denim” is named after a city in…",
  "options": [
   "Italy",
   "France",
   "America",
   "India"
  ],
  "topic": "origins",
  "axis": null,
  "test": null,
  "c": 1,
  "t": 0,
  "p": 55,
  "k": "Denim: de Nîmes",
  "w": "Serge de Nîmes. Italy is the half-knowledge trap: that city named the jeans — Genoa — not the cloth."
 },
 {
  "id": "learn-sol9",
  "surface": "learn",
  "seq": 146,
  "type": "choice",
  "domain": null,
  "prompt": "Which planet has the most moons?",
  "options": [
   "Jupiter",
   "Saturn",
   "Neptune",
   "Uranus"
  ],
  "topic": "solar",
  "axis": null,
  "test": null,
  "c": 1,
  "t": 0,
  "p": 38,
  "k": "Saturn: most moons",
  "w": "Saturn passed Jupiter in 2023 — well over a hundred confirmed, many just a few kilometres across."
 },
 {
  "id": "learn-sol10",
  "surface": "learn",
  "seq": 147,
  "type": "choice",
  "domain": null,
  "prompt": "The Great Red Spot is…",
  "options": [
   "A storm on Jupiter",
   "A Martian volcano",
   "A sunspot",
   "A crater on Mercury"
  ],
  "topic": "solar",
  "axis": null,
  "test": null,
  "c": 0,
  "t": 1,
  "p": 62,
  "k": "Red Spot: Jupiter's storm",
  "w": "A storm wider than Earth that has been blowing for at least 200 years."
 },
 {
  "id": "learn-sol11",
  "surface": "learn",
  "seq": 148,
  "type": "choice",
  "domain": null,
  "prompt": "Sunlight reaches Earth in about…",
  "options": [
   "8 seconds",
   "8 minutes",
   "8 hours",
   "No time at all"
  ],
  "topic": "solar",
  "axis": null,
  "test": null,
  "c": 1,
  "t": 3,
  "p": 55,
  "k": "Sunlight: eight minutes old"
 },
 {
  "id": "learn-sol12",
  "surface": "learn",
  "seq": 149,
  "type": "choice",
  "domain": null,
  "prompt": "Which planet spins on its side?",
  "options": [
   "Uranus",
   "Mercury",
   "Saturn",
   "Venus"
  ],
  "topic": "solar",
  "axis": null,
  "test": null,
  "c": 0,
  "t": 3,
  "p": 45,
  "k": "Uranus rolls on its side",
  "w": "Tilted about 98° — likely knocked over by an ancient collision. Venus is the backwards one, not the sideways one."
 },
 {
  "id": "learn-sol13",
  "surface": "learn",
  "seq": 150,
  "type": "choice",
  "domain": null,
  "prompt": "How much of the solar system's mass is the Sun?",
  "options": [
   "About half",
   "About 75%",
   "More than 99%",
   "About 90%"
  ],
  "topic": "solar",
  "axis": null,
  "test": null,
  "c": 2,
  "t": 0,
  "p": 34,
  "k": "The Sun is nearly everything",
  "w": "99.8% — Jupiter takes most of the rest, and every other body shares the crumbs."
 },
 {
  "id": "learn-str9",
  "surface": "learn",
  "seq": 151,
  "type": "choice",
  "domain": null,
  "prompt": "When you look at a distant star, you see it…",
  "options": [
   "As it is now",
   "As it was long ago",
   "Slightly blurred",
   "Slightly magnified"
  ],
  "topic": "stars",
  "axis": null,
  "test": null,
  "c": 1,
  "t": 0,
  "p": 58,
  "k": "Starlight is old light",
  "w": "The light left years — sometimes millennia — ago. Some of those stars no longer exist."
 },
 {
  "id": "learn-str10",
  "surface": "learn",
  "seq": 152,
  "type": "choice",
  "domain": null,
  "prompt": "What is the Sun mostly made of?",
  "options": [
   "Oxygen",
   "Iron",
   "Molten rock",
   "Hydrogen"
  ],
  "topic": "stars",
  "axis": null,
  "test": null,
  "c": 3,
  "t": 2,
  "p": 63,
  "k": "The Sun: mostly hydrogen"
 },
 {
  "id": "learn-str11",
  "surface": "learn",
  "seq": 153,
  "type": "choice",
  "domain": null,
  "prompt": "The brightest star in our night sky is…",
  "options": [
   "The North Star",
   "Sirius",
   "Venus",
   "Betelgeuse"
  ],
  "topic": "stars",
  "axis": null,
  "test": null,
  "c": 1,
  "t": 0,
  "p": 40,
  "k": "Sirius outshines Polaris",
  "w": "Polaris is famous for holding still, not for brightness — it ranks about 48th. Venus is brighter, but it is a planet."
 },
 {
  "id": "learn-str12",
  "surface": "learn",
  "seq": 154,
  "type": "choice",
  "domain": null,
  "prompt": "How many stars can you see at once with the naked eye, from a truly dark place?",
  "options": [
   "A few hundred",
   "A few thousand",
   "About a million",
   "Billions"
  ],
  "topic": "stars",
  "axis": null,
  "test": null,
  "c": 1,
  "t": 3,
  "p": 36,
  "k": "Naked eye: a few thousand",
  "w": "Around 2,500 at once — the Milky Way's glow is the rest, unresolved."
 },
 {
  "id": "learn-str13",
  "surface": "learn",
  "seq": 155,
  "type": "choice",
  "domain": null,
  "prompt": "What keeps the Sun shining?",
  "options": [
   "Nuclear fusion",
   "Burning fuel",
   "Gravity alone",
   "Electricity"
  ],
  "topic": "stars",
  "axis": null,
  "test": null,
  "c": 0,
  "t": 1,
  "p": 60,
  "k": "The Sun runs on fusion",
  "w": "Hydrogen fusing into helium in the core — not combustion; there is nothing up there to burn."
 },
 {
  "id": "learn-anc14",
  "surface": "learn",
  "seq": 156,
  "type": "choice",
  "domain": null,
  "prompt": "Pompeii was buried by…",
  "options": [
   "A volcano",
   "A flood",
   "An earthquake",
   "A sandstorm"
  ],
  "topic": "ancient",
  "axis": null,
  "test": null,
  "c": 0,
  "t": 2,
  "p": 72,
  "k": "Vesuvius buried Pompeii",
  "w": "AD 79 — and the town had already been rattled by a major earthquake seventeen years earlier."
 },
 {
  "id": "learn-anc15",
  "surface": "learn",
  "seq": 157,
  "type": "choice",
  "domain": null,
  "prompt": "The oldest known writing was mostly used for…",
  "options": [
   "Poetry",
   "Prayers",
   "Accounting",
   "Royal decrees"
  ],
  "topic": "ancient",
  "axis": null,
  "test": null,
  "c": 2,
  "t": 0,
  "p": 39,
  "k": "Writing began as accounting",
  "w": "The earliest cuneiform tablets are inventories — grain, beer, sheep — centuries before anyone wrote a poem down."
 },
 {
  "id": "learn-anc16",
  "surface": "learn",
  "seq": 158,
  "type": "choice",
  "domain": null,
  "prompt": "The Sphinx's missing nose was…",
  "options": [
   "Shot off by Napoleon's troops",
   "Removed to a museum",
   "Eroded by a flood",
   "Gone centuries before Napoleon"
  ],
  "topic": "ancient",
  "axis": null,
  "test": null,
  "c": 3,
  "t": 0,
  "p": 42,
  "k": "The nose predates Napoleon",
  "w": "Drawings made decades before Napoleon's campaign already show the Sphinx noseless."
 },
 {
  "id": "learn-anc17",
  "surface": "learn",
  "seq": 159,
  "type": "choice",
  "domain": null,
  "prompt": "The pyramids were built mainly by…",
  "options": [
   "Enslaved people",
   "Paid seasonal workers",
   "Prisoners of war",
   "Priests"
  ],
  "topic": "ancient",
  "axis": null,
  "test": null,
  "c": 1,
  "t": 0,
  "p": 40,
  "k": "Pyramid builders were paid",
  "w": "Workers' villages near Giza show bread and beer rations, medical care and honourable burials — not slave quarters."
 },
 {
  "id": "learn-anc18",
  "surface": "learn",
  "seq": 160,
  "type": "choice",
  "domain": null,
  "prompt": "The trial of Socrates was decided by…",
  "options": [
   "A single judge",
   "A jury of about 500",
   "The king of Athens",
   "An oracle"
  ],
  "topic": "ancient",
  "axis": null,
  "test": null,
  "c": 1,
  "t": 0,
  "p": 33,
  "k": "Socrates faced 500 jurors",
  "w": "Athenian juries ran to hundreds precisely so they could not be bribed."
 },
 {
  "id": "learn-body14",
  "surface": "learn",
  "seq": 161,
  "type": "choice",
  "domain": null,
  "prompt": "Your stomach gets a new lining every…",
  "options": [
   "Few days",
   "Few months",
   "Year",
   "It never renews"
  ],
  "topic": "body",
  "axis": null,
  "test": null,
  "c": 0,
  "t": 2,
  "p": 35,
  "k": "Stomach relines in days",
  "w": "The acid would digest the stomach itself otherwise — the mucus lining turns over in under a week."
 },
 {
  "id": "learn-body15",
  "surface": "learn",
  "seq": 162,
  "type": "choice",
  "domain": null,
  "prompt": "The body's strongest muscle for its size is…",
  "options": [
   "The thigh",
   "The jaw",
   "The heart",
   "The bicep"
  ],
  "topic": "body",
  "axis": null,
  "test": null,
  "c": 1,
  "t": 0,
  "p": 44,
  "k": "The jaw: strongest for size",
  "w": "The masseter — bite force concentrates through a short, brutal lever."
 },
 {
  "id": "learn-body16",
  "surface": "learn",
  "seq": 163,
  "type": "choice",
  "domain": null,
  "prompt": "Which sense is wired most directly to memory?",
  "options": [
   "Sight",
   "Hearing",
   "Smell",
   "Touch"
  ],
  "topic": "body",
  "axis": null,
  "test": null,
  "c": 2,
  "t": 0,
  "p": 51,
  "k": "Smell wires to memory",
  "w": "Olfactory signals skip the brain's relay station and land beside the memory centres — hence the time-travel of a familiar smell."
 },
 {
  "id": "learn-body17",
  "surface": "learn",
  "seq": 164,
  "type": "choice",
  "domain": null,
  "prompt": "Goosebumps are…",
  "options": [
   "A leftover from having fur",
   "A circulation boost",
   "An infection response",
   "Random nerve noise"
  ],
  "topic": "body",
  "axis": null,
  "test": null,
  "c": 0,
  "t": 1,
  "p": 57,
  "k": "Goosebumps: fur we lost",
  "w": "The muscles that raise hairs made ancestors look bigger and warmer; the reflex outlived the coat."
 },
 {
  "id": "learn-body18",
  "surface": "learn",
  "seq": 165,
  "type": "choice",
  "domain": null,
  "prompt": "How many times does your heart beat in a day, roughly?",
  "options": [
   "10,000",
   "100,000",
   "1 million",
   "1,000"
  ],
  "topic": "body",
  "axis": null,
  "test": null,
  "c": 1,
  "t": 0,
  "p": 62,
  "k": "100,000 beats a day"
 },
 {
  "id": "learn-c214",
  "surface": "learn",
  "seq": 166,
  "type": "choice",
  "domain": null,
  "prompt": "The first successful heart transplant was performed in…",
  "options": [
   "The United States",
   "South Africa",
   "The Soviet Union",
   "The United Kingdom"
  ],
  "topic": "c20",
  "axis": null,
  "test": null,
  "c": 1,
  "t": 0,
  "p": 38,
  "k": "First heart transplant: Cape Town",
  "w": "Christiaan Barnard, Groote Schuur Hospital, 1967 — the patient lived eighteen days; the technique lived on."
 },
 {
  "id": "learn-c215",
  "surface": "learn",
  "seq": 167,
  "type": "choice",
  "domain": null,
  "prompt": "Television was first demonstrated publicly in the…",
  "options": [
   "1900s",
   "1920s",
   "1940s",
   "1950s"
  ],
  "topic": "c20",
  "axis": null,
  "test": null,
  "c": 1,
  "t": 3,
  "p": 44,
  "k": "TV demoed in the 1920s",
  "w": "John Logie Baird showed working television in 1926 — two decades before most homes saw one."
 },
 {
  "id": "learn-c216",
  "surface": "learn",
  "seq": 168,
  "type": "choice",
  "domain": null,
  "prompt": "The Empire State Building went up in about…",
  "options": [
   "Fourteen months",
   "Three years",
   "Five years",
   "A decade"
  ],
  "topic": "c20",
  "axis": null,
  "test": null,
  "c": 0,
  "t": 3,
  "p": 33,
  "k": "Empire State: ~14 months",
  "w": "First steel to opening day in under fourteen months, 1930 to 1931 — Depression labour, round-the-clock shifts."
 },
 {
  "id": "learn-c217",
  "surface": "learn",
  "seq": 169,
  "type": "choice",
  "domain": null,
  "prompt": "The first email was sent in…",
  "options": [
   "1971",
   "1983",
   "1990",
   "1995"
  ],
  "topic": "c20",
  "axis": null,
  "test": null,
  "c": 0,
  "t": 2,
  "p": 47,
  "k": "Email: 1971",
  "w": "Ray Tomlinson sent the first networked email on ARPANET in 1971 — the web came nineteen years later."
 },
 {
  "id": "learn-c218",
  "surface": "learn",
  "seq": 170,
  "type": "choice",
  "domain": null,
  "prompt": "Concorde crossed the Atlantic in about…",
  "options": [
   "Three and a half hours",
   "Five hours",
   "Seven hours",
   "Nine hours"
  ],
  "topic": "c20",
  "axis": null,
  "test": null,
  "c": 0,
  "t": 2,
  "p": 56,
  "k": "Concorde: ~3.5 hours",
  "w": "London to New York at twice the speed of sound — no airliner has come close since its 2003 retirement."
 },
 {
  "id": "learn-cap14",
  "surface": "learn",
  "seq": 171,
  "type": "choice",
  "domain": null,
  "prompt": "The capital of Pakistan is…",
  "options": [
   "Karachi",
   "Islamabad",
   "Lahore",
   "Peshawar"
  ],
  "topic": "capitals",
  "axis": null,
  "test": null,
  "c": 1,
  "t": 0,
  "p": 51,
  "k": "Pakistan: Islamabad",
  "w": "Purpose-built in the 1960s to take the government from Karachi — the port kept the size, the new city took the state."
 },
 {
  "id": "learn-cap15",
  "surface": "learn",
  "seq": 172,
  "type": "choice",
  "domain": null,
  "prompt": "The capital of Kazakhstan is…",
  "options": [
   "Almaty",
   "Tashkent",
   "Astana",
   "Bishkek"
  ],
  "topic": "capitals",
  "axis": null,
  "test": null,
  "c": 2,
  "t": 0,
  "p": 34,
  "k": "Kazakhstan: Astana",
  "w": "The capital moved north from Almaty in 1997; the city has since been renamed twice — Astana, Nur-Sultan, Astana again."
 },
 {
  "id": "learn-cap16",
  "surface": "learn",
  "seq": 173,
  "type": "choice",
  "domain": null,
  "prompt": "The capital of Ivory Coast is…",
  "options": [
   "Abidjan",
   "Yamoussoukro",
   "Accra",
   "Dakar"
  ],
  "topic": "capitals",
  "axis": null,
  "test": null,
  "c": 1,
  "t": 0,
  "p": 29,
  "k": "Ivory Coast: Yamoussoukro",
  "w": "The official capital since 1983 — the first president's home village, with a basilica bigger than St Peter's; Abidjan kept the ministries."
 },
 {
  "id": "learn-cap17",
  "surface": "learn",
  "seq": 174,
  "type": "choice",
  "domain": null,
  "prompt": "Bolivia's constitutional capital is…",
  "options": [
   "La Paz",
   "Santa Cruz",
   "Quito",
   "Sucre"
  ],
  "topic": "capitals",
  "axis": null,
  "test": null,
  "c": 3,
  "t": 0,
  "p": 32,
  "k": "Bolivia: Sucre (on paper)",
  "w": "Sucre holds the constitutional title and the supreme court; the government sits in La Paz — both answers win arguments."
 },
 {
  "id": "learn-cap18",
  "surface": "learn",
  "seq": 175,
  "type": "choice",
  "domain": null,
  "prompt": "The capital of Sri Lanka is…",
  "options": [
   "Colombo",
   "Anuradhapura",
   "Sri Jayawardenepura Kotte",
   "Nuwara Eliya"
  ],
  "topic": "capitals",
  "axis": null,
  "test": null,
  "c": 2,
  "t": 0,
  "p": 26,
  "k": "Sri Lanka: Kotte",
  "w": "The legislative capital since 1982, swallowed by greater Colombo — which is why everyone says Colombo."
 },
 {
  "id": "pulse-pace",
  "surface": "pulse",
  "seq": 0,
  "type": "pulse",
  "domain": null,
  "prompt": "What pace was today?",
  "options": [
   "Crawling",
   "Dragging",
   "Steady",
   "Brisk",
   "Flying"
  ],
  "topic": null,
  "axis": null,
  "test": null
 },
 {
  "id": "pulse-energy",
  "surface": "pulse",
  "seq": 1,
  "type": "pulse",
  "domain": null,
  "prompt": "How was your energy today?",
  "options": [
   "Drained",
   "Low",
   "OK",
   "Charged",
   "Wired"
  ],
  "topic": null,
  "axis": null,
  "test": null
 },
 {
  "id": "pulse-sleep",
  "surface": "pulse",
  "seq": 2,
  "type": "pulse",
  "domain": null,
  "prompt": "How did you sleep?",
  "options": [
   "Badly",
   "Patchy",
   "OK",
   "Well",
   "Deeply"
  ],
  "topic": null,
  "axis": null,
  "test": null
 },
 {
  "id": "pulse-focus",
  "surface": "pulse",
  "seq": 3,
  "type": "pulse",
  "domain": null,
  "prompt": "How clear was your head today?",
  "options": [
   "Scattered",
   "Foggy",
   "OK",
   "Sharp",
   "Locked in"
  ],
  "topic": null,
  "axis": null,
  "test": null
 },
 {
  "id": "pulse-social",
  "surface": "pulse",
  "seq": 4,
  "type": "pulse",
  "domain": null,
  "prompt": "How connected did you feel today?",
  "options": [
   "Alone",
   "Distant",
   "OK",
   "Close",
   "Held"
  ],
  "topic": null,
  "axis": null,
  "test": null
 },
 {
  "id": "call-c01",
  "surface": "call",
  "seq": 0,
  "type": "call",
  "domain": null,
  "prompt": "By October, will 60% of everyone be on one side of Messi or Ronaldo?",
  "options": [
   "They will",
   "It stays close"
  ],
  "topic": null,
  "axis": null,
  "test": null,
  "tier": "A",
  "resolvesAt": "2026-10-01",
  "rubric": {
   "kind": "agg",
   "qid": "daily-000",
   "test": "topShareAtLeast",
   "threshold": 60
  },
  "active": false
 },
 {
  "id": "call-c02",
  "surface": "call",
  "seq": 1,
  "type": "call",
  "domain": null,
  "prompt": "By October, will 18-24 and 55-64 be on opposite sides of “Money can buy happiness”?",
  "options": [
   "Opposite sides",
   "The same side"
  ],
  "topic": null,
  "axis": null,
  "test": null,
  "tier": "A",
  "resolvesAt": "2026-10-01",
  "rubric": {
   "kind": "agg",
   "qid": "feed-f54",
   "test": "slicesDisagree",
   "dim": "ageBand",
   "buckets": [
    "18-24",
    "55-64"
   ]
  },
  "active": false
 },
 {
  "id": "call-c03",
  "surface": "call",
  "seq": 2,
  "type": "call",
  "domain": null,
  "prompt": "By October, will a thousand people have said whether they would eat lab-grown meat?",
  "options": [
   "A thousand",
   "Fewer"
  ],
  "topic": null,
  "axis": null,
  "test": null,
  "tier": "A",
  "resolvesAt": "2026-10-01",
  "rubric": {
   "kind": "agg",
   "qid": "feed-f11",
   "test": "turnoutAtLeast",
   "threshold": 1000
  },
  "active": false
 }
];

// Feed ads (D197) — docs/MONETIZATION.md path 3, and NOT path 2's
// sponsored questions. An ad takes no answer and folds into no
// aggregate, which is why it is a separate array and a separate
// collection: nothing that reads the question bank has to learn to skip
// it. Text only, no link, one coarse audience tag matched on the DEVICE.
export interface V2SeedAd { id: string; seq: number; advertiser: string; headline: string; body: string; until: string; audience?: Record<string, string>; active?: boolean; }
export const V2_ADS: V2SeedAd[] = [];
