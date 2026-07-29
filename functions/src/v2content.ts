// GENERATED from /content/*.json — do not hand-edit. There is no checked-in
// generator: scripts/gen-v2content.md records where it lived and the id
// scheme it used. Re-run only if /content changes.
// Canonical launch question bank for the v2 seed callable.
export interface V2SeedQuestion { id: string; surface: string; seq: number; type: string; prompt: string; options: string[]; topic: string | null; axis: string | null; test: string | null; }
export const V2_QUESTIONS: V2SeedQuestion[] = [
 {
  "id": "daily-000",
  "surface": "daily",
  "seq": 0,
  "type": "binary",
  "prompt": "Messi or Ronaldo?",
  "options": [
   "Messi",
   "Ronaldo"
  ],
  "topic": "light",
  "axis": null,
  "test": null
 },
 {
  "id": "daily-001",
  "surface": "daily",
  "seq": 1,
  "type": "binary",
  "prompt": "Tarantino or Wes Anderson?",
  "options": [
   "Tarantino",
   "Wes Anderson"
  ],
  "topic": "light",
  "axis": null,
  "test": null
 },
 {
  "id": "daily-002",
  "surface": "daily",
  "seq": 2,
  "type": "binary",
  "prompt": "Pineapple on pizza?",
  "options": [
   "Yes",
   "Never"
  ],
  "topic": "light",
  "axis": null,
  "test": null
 },
 {
  "id": "daily-003",
  "surface": "daily",
  "seq": 3,
  "type": "choice",
  "prompt": "What do you want more of this year?",
  "options": [
   "Time",
   "Quiet",
   "Adventure",
   "Closeness"
  ],
  "topic": "deep",
  "axis": null,
  "test": null
 },
 {
  "id": "daily-004",
  "surface": "daily",
  "seq": 4,
  "type": "scale",
  "prompt": "It's okay to do nothing sometimes.",
  "options": [
   "Strongly disagree",
   "Disagree",
   "Neutral",
   "Agree",
   "Strongly agree"
  ],
  "topic": "light",
  "axis": "at ease",
  "test": null
 },
 {
  "id": "daily-005",
  "surface": "daily",
  "seq": 5,
  "type": "binary",
  "prompt": "Are people getting kinder, or meaner?",
  "options": [
   "Kinder",
   "Meaner"
  ],
  "topic": "deep",
  "axis": null,
  "test": null
 },
 {
  "id": "daily-006",
  "surface": "daily",
  "seq": 6,
  "type": "dilemma",
  "prompt": "You find €500 in cash on an empty street. What do you do?",
  "options": [
   "Keep it",
   "Hand it in",
   "Leave it"
  ],
  "topic": "deep",
  "axis": null,
  "test": null
 },
 {
  "id": "daily-007",
  "surface": "daily",
  "seq": 7,
  "type": "rating",
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
  "axis": "optimistic",
  "test": null
 },
 {
  "id": "daily-008",
  "surface": "daily",
  "seq": 8,
  "type": "scale",
  "prompt": "People are basically trustworthy.",
  "options": [
   "Strongly disagree",
   "Disagree",
   "Neutral",
   "Agree",
   "Strongly agree"
  ],
  "topic": "deep",
  "axis": "trusting",
  "test": null
 },
 {
  "id": "daily-009",
  "surface": "daily",
  "seq": 9,
  "type": "binary",
  "prompt": "A pill that ends your need for sleep. Take it?",
  "options": [
   "Take it",
   "Never"
  ],
  "topic": "deep",
  "axis": null,
  "test": null
 },
 {
  "id": "daily-010",
  "surface": "daily",
  "seq": 10,
  "type": "choice",
  "prompt": "What should schools teach more of?",
  "options": [
   "Money",
   "Emotions",
   "Making things",
   "History"
  ],
  "topic": "deep",
  "axis": null,
  "test": null
 },
 {
  "id": "daily-011",
  "surface": "daily",
  "seq": 11,
  "type": "dilemma",
  "prompt": "A job you would love means moving somewhere your partner would hate. Do you take it?",
  "options": [
   "Take it",
   "Stay",
   "Find a third way"
  ],
  "topic": "deep",
  "axis": null,
  "test": null
 },
 {
  "id": "daily-012",
  "surface": "daily",
  "seq": 12,
  "type": "binary",
  "prompt": "Would you rather watch sport, or play it?",
  "options": [
   "Watch",
   "Play"
  ],
  "topic": "light",
  "axis": null,
  "test": null
 },
 {
  "id": "daily-013",
  "surface": "daily",
  "seq": 13,
  "type": "scale",
  "prompt": "Suffering can give life meaning.",
  "options": [
   "Strongly disagree",
   "Disagree",
   "Neutral",
   "Agree",
   "Strongly agree"
  ],
  "topic": "deep",
  "axis": "searching",
  "test": null
 },
 {
  "id": "daily-014",
  "surface": "daily",
  "seq": 14,
  "type": "rating",
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
  "axis": "trusting",
  "test": null
 },
 {
  "id": "daily-015",
  "surface": "daily",
  "seq": 15,
  "type": "binary",
  "prompt": "Will AI make everyday life better, or worse?",
  "options": [
   "Better",
   "Worse"
  ],
  "topic": "deep",
  "axis": null,
  "test": null
 },
 {
  "id": "daily-016",
  "surface": "daily",
  "seq": 16,
  "type": "choice",
  "prompt": "Humanity's best invention?",
  "options": [
   "Writing",
   "Medicine",
   "The internet",
   "Music"
  ],
  "topic": "blend",
  "axis": null,
  "test": null
 },
 {
  "id": "daily-017",
  "surface": "daily",
  "seq": 17,
  "type": "scale",
  "prompt": "Technology is making us lonelier.",
  "options": [
   "Strongly disagree",
   "Disagree",
   "Neutral",
   "Agree",
   "Strongly agree"
  ],
  "topic": "deep",
  "axis": "wary",
  "test": null
 },
 {
  "id": "daily-018",
  "surface": "daily",
  "seq": 18,
  "type": "choice",
  "prompt": "What matters most in a life well lived?",
  "options": [
   "Connection",
   "Freedom",
   "Creation",
   "Peace"
  ],
  "topic": "deep",
  "axis": null,
  "test": null
 },
 {
  "id": "daily-019",
  "surface": "daily",
  "seq": 19,
  "type": "dilemma",
  "prompt": "Would you rather know the exact date of your death?",
  "options": [
   "Know",
   "Never know"
  ],
  "topic": "deep",
  "axis": null,
  "test": null
 },
 {
  "id": "daily-020",
  "surface": "daily",
  "seq": 20,
  "type": "rating",
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
  "axis": "shaped by luck",
  "test": null
 },
 {
  "id": "daily-021",
  "surface": "daily",
  "seq": 21,
  "type": "scale",
  "prompt": "I'd rather have a few deep friendships than many.",
  "options": [
   "Strongly disagree",
   "Disagree",
   "Neutral",
   "Agree",
   "Strongly agree"
  ],
  "topic": "blend",
  "axis": "inward",
  "test": null
 },
 {
  "id": "daily-022",
  "surface": "daily",
  "seq": 22,
  "type": "dilemma",
  "prompt": "A lie that spares someone real pain. Tell it?",
  "options": [
   "Tell it",
   "Truth anyway"
  ],
  "topic": "deep",
  "axis": null,
  "test": null
 },
 {
  "id": "daily-023",
  "surface": "daily",
  "seq": 23,
  "type": "scale",
  "prompt": "It's better to be honest than kind.",
  "options": [
   "Strongly disagree",
   "Disagree",
   "Neutral",
   "Agree",
   "Strongly agree"
  ],
  "topic": "deep",
  "axis": "frank",
  "test": null
 },
 {
  "id": "daily-024",
  "surface": "daily",
  "seq": 24,
  "type": "scale",
  "prompt": "Money buys happiness.",
  "options": [
   "Strongly disagree",
   "Disagree",
   "Neutral",
   "Agree",
   "Strongly agree"
  ],
  "topic": "blend",
  "axis": "materialist",
  "test": null
 },
 {
  "id": "daily-025",
  "surface": "daily",
  "seq": 25,
  "type": "rating",
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
  "axis": "in control",
  "test": null
 },
 {
  "id": "daily-026",
  "surface": "daily",
  "seq": 26,
  "type": "choice",
  "prompt": "Where does your sense of self come from?",
  "options": [
   "What I do",
   "Who I love",
   "What I believe",
   "What I make"
  ],
  "topic": "deep",
  "axis": null,
  "test": null
 },
 {
  "id": "daily-027",
  "surface": "daily",
  "seq": 27,
  "type": "binary",
  "prompt": "Relive your best day, or live a new one?",
  "options": [
   "Relive it",
   "A new one"
  ],
  "topic": "blend",
  "axis": null,
  "test": null
 },
 {
  "id": "daily-028",
  "surface": "daily",
  "seq": 28,
  "type": "choice",
  "prompt": "Pick a season for the soul.",
  "options": [
   "Spring",
   "Summer",
   "Autumn",
   "Winter"
  ],
  "topic": "light",
  "axis": null,
  "test": null
 },
 {
  "id": "daily-029",
  "surface": "daily",
  "seq": 29,
  "type": "scale",
  "prompt": "Most people would help a stranger in need.",
  "options": [
   "Strongly disagree",
   "Disagree",
   "Neutral",
   "Agree",
   "Strongly agree"
  ],
  "topic": "deep",
  "axis": "hopeful",
  "test": null
 },
 {
  "id": "feed-f01",
  "surface": "feed",
  "seq": 0,
  "type": "duel",
  "prompt": "The better night in front of the TV?",
  "options": [
   "Champions League final",
   "Super Bowl"
  ],
  "topic": "sport",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-f02",
  "surface": "feed",
  "seq": 1,
  "type": "vote",
  "prompt": "Would you rather win…",
  "options": [
   "Olympic gold",
   "The World Cup"
  ],
  "topic": "sport",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-f03",
  "surface": "feed",
  "seq": 2,
  "type": "rank",
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
  "prompt": "VAR made football better.",
  "options": [
   "Better",
   "Worse"
  ],
  "topic": "sport",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-f05",
  "surface": "feed",
  "seq": 4,
  "type": "vote",
  "prompt": "Best sport to watch live in a stadium",
  "options": [
   "Football",
   "Basketball",
   "Tennis"
  ],
  "topic": "sport",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-f06",
  "surface": "feed",
  "seq": 5,
  "type": "vote",
  "prompt": "E-sports are real sports.",
  "options": [
   "They are",
   "They’re not"
  ],
  "topic": "sport",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-f07",
  "surface": "feed",
  "seq": 6,
  "type": "vote",
  "prompt": "Your team wins it all — but you can never watch them again. Deal?",
  "options": [
   "Take it",
   "Never"
  ],
  "topic": "sport",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-f08",
  "surface": "feed",
  "seq": 7,
  "type": "duel",
  "prompt": "One cuisine forever",
  "options": [
   "Italian",
   "Japanese"
  ],
  "topic": "food",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-f09",
  "surface": "feed",
  "seq": 8,
  "type": "vote",
  "prompt": "Milk before cereal is a crime.",
  "options": [
   "A crime",
   "It’s fine"
  ],
  "topic": "food",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-f10",
  "surface": "feed",
  "seq": 9,
  "type": "rank",
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
  "prompt": "Would you eat lab-grown meat?",
  "options": [
   "Sure",
   "Never"
  ],
  "topic": "food",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-f12",
  "surface": "feed",
  "seq": 11,
  "type": "vote",
  "prompt": "A free pill replaces all meals. Food becomes hobby-only. Take it?",
  "options": [
   "Take it",
   "Keep meals"
  ],
  "topic": "food",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-f13",
  "surface": "feed",
  "seq": 12,
  "type": "duel",
  "prompt": "Final dessert on earth",
  "options": [
   "Tiramisu",
   "Cheesecake"
  ],
  "topic": "food",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-f14",
  "surface": "feed",
  "seq": 13,
  "type": "vote",
  "prompt": "Spicy food: worth the pain?",
  "options": [
   "Always",
   "No pain please"
  ],
  "topic": "food",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-f15",
  "surface": "feed",
  "seq": 14,
  "type": "vote",
  "prompt": "The book is always better.",
  "options": [
   "Always",
   "Not always"
  ],
  "topic": "movies",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-f16",
  "surface": "feed",
  "seq": 15,
  "type": "rank",
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
  "prompt": "One world to live in",
  "options": [
   "Space opera",
   "Cozy fantasy"
  ],
  "topic": "movies",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-f18",
  "surface": "feed",
  "seq": 17,
  "type": "vote",
  "prompt": "Watching at 1.5× speed is disrespectful.",
  "options": [
   "Disrespectful",
   "Efficient"
  ],
  "topic": "movies",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-f19",
  "surface": "feed",
  "seq": 18,
  "type": "vote",
  "prompt": "The ideal movie length",
  "options": [
   "90 minutes",
   "Two hours",
   "Three-hour epic"
  ],
  "topic": "movies",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-f20",
  "surface": "feed",
  "seq": 19,
  "type": "vote",
  "prompt": "Spoilers ruin nothing for a good story.",
  "options": [
   "True",
   "Heresy"
  ],
  "topic": "movies",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-f21",
  "surface": "feed",
  "seq": 20,
  "type": "vote",
  "prompt": "Great lyrics or great melody?",
  "options": [
   "Lyrics",
   "Melody"
  ],
  "topic": "music",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-f22",
  "surface": "feed",
  "seq": 21,
  "type": "rank",
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
  "prompt": "Vinyl actually sounds better.",
  "options": [
   "It does",
   "It’s the ritual"
  ],
  "topic": "music",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-f24",
  "surface": "feed",
  "seq": 23,
  "type": "vote",
  "prompt": "Music while working?",
  "options": [
   "Always",
   "Instrumental only",
   "Silence"
  ],
  "topic": "music",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-f25",
  "surface": "feed",
  "seq": 24,
  "type": "duel",
  "prompt": "One decade of music forever",
  "options": [
   "The 70s",
   "The 2000s"
  ],
  "topic": "music",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-f26",
  "surface": "feed",
  "seq": 25,
  "type": "vote",
  "prompt": "Brain-computer interface, once it’s proven safe?",
  "options": [
   "Plug me in",
   "Absolutely not"
  ],
  "topic": "tech",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-f27",
  "surface": "feed",
  "seq": 26,
  "type": "vote",
  "prompt": "Phones should be banned in schools.",
  "options": [
   "Ban them",
   "Teach with them"
  ],
  "topic": "tech",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-f28",
  "surface": "feed",
  "seq": 27,
  "type": "rank",
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
  "prompt": "Delete all your data and start clean, or keep everything forever?",
  "options": [
   "Clean slate",
   "Keep it all"
  ],
  "topic": "tech",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-f30",
  "surface": "feed",
  "seq": 29,
  "type": "vote",
  "prompt": "A robot does your chores but records everything. Deal?",
  "options": [
   "Deal",
   "No deal"
  ],
  "topic": "tech",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-f31",
  "surface": "feed",
  "seq": 30,
  "type": "vote",
  "prompt": "Would you ride a driverless taxi tonight?",
  "options": [
   "Get in",
   "Not yet"
  ],
  "topic": "tech",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-f32",
  "surface": "feed",
  "seq": 31,
  "type": "vote",
  "prompt": "Tipping should be abolished.",
  "options": [
   "Abolish it",
   "Keep it"
  ],
  "topic": "culture",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-f33",
  "surface": "feed",
  "seq": 32,
  "type": "vote",
  "prompt": "Ten minutes early or exactly on time?",
  "options": [
   "Early",
   "On the dot"
  ],
  "topic": "culture",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-f34",
  "surface": "feed",
  "seq": 33,
  "type": "rank",
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
  "prompt": "The best age to be",
  "options": [
   "18",
   "30",
   "50",
   "75"
  ],
  "topic": "culture",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-f36",
  "surface": "feed",
  "seq": 35,
  "type": "duel",
  "prompt": "The view from your window, forever",
  "options": [
   "Ocean",
   "Mountains"
  ],
  "topic": "culture",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-f37",
  "surface": "feed",
  "seq": 36,
  "type": "vote",
  "prompt": "Small talk is a skill, not a chore.",
  "options": [
   "A skill",
   "A chore"
  ],
  "topic": "culture",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-f38",
  "surface": "feed",
  "seq": 37,
  "type": "vote",
  "prompt": "Read minds — but everyone knows you can. Take it?",
  "options": [
   "Take it",
   "Pass"
  ],
  "topic": "dilemma",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-f39",
  "surface": "feed",
  "seq": 38,
  "type": "vote",
  "prompt": "$1M now, but a stranger somewhere loses everything. Press the button?",
  "options": [
   "Press",
   "Never"
  ],
  "topic": "dilemma",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-f40",
  "surface": "feed",
  "seq": 39,
  "type": "vote",
  "prompt": "Would you want to know the date of your death?",
  "options": [
   "Tell me",
   "Never"
  ],
  "topic": "dilemma",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-f41",
  "surface": "feed",
  "seq": 40,
  "type": "vote",
  "prompt": "Five years in a job you hate, then never work again?",
  "options": [
   "Take the deal",
   "Keep working"
  ],
  "topic": "dilemma",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-f42",
  "surface": "feed",
  "seq": 41,
  "type": "vote",
  "prompt": "Restart life at 10, everything you know intact?",
  "options": [
   "Restart",
   "Stay here"
  ],
  "topic": "dilemma",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-f43",
  "surface": "feed",
  "seq": 42,
  "type": "vote",
  "prompt": "Perfect memory — but you can never forget anything. Take it?",
  "options": [
   "Take it",
   "Keep forgetting"
  ],
  "topic": "dilemma",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-f44",
  "surface": "feed",
  "seq": 43,
  "type": "vote",
  "prompt": "Your dog talks for one day, or understands you forever?",
  "options": [
   "Talks one day",
   "Understands forever"
  ],
  "topic": "dilemma",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-f45",
  "surface": "feed",
  "seq": 44,
  "type": "vote",
  "prompt": "Should voting be mandatory?",
  "options": [
   "Mandatory",
   "A right, not a duty"
  ],
  "topic": "event",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-f46",
  "surface": "feed",
  "seq": 45,
  "type": "vote",
  "prompt": "Four-day work week: inevitable or fantasy?",
  "options": [
   "Inevitable",
   "Fantasy"
  ],
  "topic": "event",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-f47",
  "surface": "feed",
  "seq": 46,
  "type": "vote",
  "prompt": "City centers should be car-free.",
  "options": [
   "Car-free",
   "Keep cars"
  ],
  "topic": "event",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-f48",
  "surface": "feed",
  "seq": 47,
  "type": "vote",
  "prompt": "Would you move to another country for good?",
  "options": [
   "I’d go",
   "Home is home"
  ],
  "topic": "event",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-f49",
  "surface": "feed",
  "seq": 48,
  "type": "vote",
  "prompt": "Judge the art apart from the artist?",
  "options": [
   "Separate them",
   "Can’t separate"
  ],
  "topic": "people",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-f50",
  "surface": "feed",
  "seq": 49,
  "type": "vote",
  "prompt": "Celebrities should stay out of politics.",
  "options": [
   "Stay out",
   "Speak up"
  ],
  "topic": "people",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-f51",
  "surface": "feed",
  "seq": 50,
  "type": "vote",
  "prompt": "Dinner with one",
  "options": [
   "A scientist you admire",
   "A musician you love",
   "A leader you’d grill"
  ],
  "topic": "people",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-f52",
  "surface": "feed",
  "seq": 51,
  "type": "vote",
  "prompt": "Free will is an illusion.",
  "options": [
   "An illusion",
   "It’s real"
  ],
  "topic": "bigq",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-f53",
  "surface": "feed",
  "seq": 52,
  "type": "vote",
  "prompt": "We’re not alone in the universe.",
  "options": [
   "Not alone",
   "Just us"
  ],
  "topic": "bigq",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-f54",
  "surface": "feed",
  "seq": 53,
  "type": "vote",
  "prompt": "Money can buy happiness.",
  "options": [
   "It can",
   "It can’t"
  ],
  "topic": "bigq",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-f55",
  "surface": "feed",
  "seq": 54,
  "type": "vote",
  "prompt": "Humanity’s best days are ahead.",
  "options": [
   "Ahead",
   "Behind"
  ],
  "topic": "bigq",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-f56",
  "surface": "feed",
  "seq": 55,
  "type": "rank",
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
  "prompt": "Doubles or singles?",
  "options": [
   "Doubles",
   "Singles"
  ],
  "topic": "sport",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-s02",
  "surface": "feed",
  "seq": 57,
  "type": "vote",
  "prompt": "Pick your surface",
  "options": [
   "Clay",
   "Grass",
   "Hard court"
  ],
  "topic": "sport",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-s03",
  "surface": "feed",
  "seq": 58,
  "type": "vote",
  "prompt": "Line judges or full electronic calls?",
  "options": [
   "Keep humans",
   "All electronic"
  ],
  "topic": "sport",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-s04",
  "surface": "feed",
  "seq": 59,
  "type": "vote",
  "prompt": "Cold water: wetsuit or skin?",
  "options": [
   "Wetsuit",
   "Skin"
  ],
  "topic": "sport",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-s05",
  "surface": "feed",
  "seq": 60,
  "type": "rank",
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
  "prompt": "Pool or open water?",
  "options": [
   "Pool",
   "Open water"
  ],
  "topic": "sport",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-s07",
  "surface": "feed",
  "seq": 62,
  "type": "vote",
  "prompt": "First drafts: longhand or keyboard?",
  "options": [
   "Longhand",
   "Keyboard"
  ],
  "topic": "culture",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-s08",
  "surface": "feed",
  "seq": 63,
  "type": "vote",
  "prompt": "Plot it all, or find it as you write?",
  "options": [
   "Plot it",
   "Find it"
  ],
  "topic": "culture",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-s09",
  "surface": "feed",
  "seq": 64,
  "type": "vote",
  "prompt": "Can great writing be taught?",
  "options": [
   "Taught",
   "Only sharpened"
  ],
  "topic": "culture",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-s10",
  "surface": "feed",
  "seq": 65,
  "type": "vote",
  "prompt": "The Ship of Theseus, fully replaced — same ship?",
  "options": [
   "Same ship",
   "A new ship"
  ],
  "topic": "bigq",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-s11",
  "surface": "feed",
  "seq": 66,
  "type": "vote",
  "prompt": "Is morality discovered or invented?",
  "options": [
   "Discovered",
   "Invented"
  ],
  "topic": "bigq",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-s12",
  "surface": "feed",
  "seq": 67,
  "type": "vote",
  "prompt": "A perfectly happy simulated life — plug in?",
  "options": [
   "Plug in",
   "Stay real"
  ],
  "topic": "bigq",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-s13",
  "surface": "feed",
  "seq": 68,
  "type": "vote",
  "prompt": "Blitz or classical?",
  "options": [
   "Blitz",
   "Classical"
  ],
  "topic": "bigq",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-s14",
  "surface": "feed",
  "seq": 69,
  "type": "vote",
  "prompt": "Best first move",
  "options": [
   "e4",
   "d4",
   "Something weird"
  ],
  "topic": "bigq",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-s15",
  "surface": "feed",
  "seq": 70,
  "type": "vote",
  "prompt": "A draw offer from a stronger player — take it?",
  "options": [
   "Take it",
   "Play on"
  ],
  "topic": "bigq",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-s16",
  "surface": "feed",
  "seq": 71,
  "type": "vote",
  "prompt": "Your sourdough starter deserves a name.",
  "options": [
   "Named, obviously",
   "It’s yeast"
  ],
  "topic": "food",
  "axis": null,
  "test": null
 },
 {
  "id": "feed-s17",
  "surface": "feed",
  "seq": 72,
  "type": "vote",
  "prompt": "Kombucha or kefir?",
  "options": [
   "Kombucha",
   "Kefir"
  ],
  "topic": "food",
  "axis": null,
  "test": null
 },
 {
  "id": "group-gu0",
  "surface": "group",
  "seq": 0,
  "type": "choice",
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
  "id": "duo-000",
  "surface": "duo",
  "seq": 0,
  "type": "binary",
  "prompt": "Plans get cancelled last minute. First feeling?",
  "options": [
   "Relief",
   "Annoyed"
  ],
  "topic": null,
  "axis": null,
  "test": null
 },
 {
  "id": "duo-001",
  "surface": "duo",
  "seq": 1,
  "type": "binary",
  "prompt": "Phone rings, unknown number.",
  "options": [
   "Answer",
   "Ignore",
   "Text back later"
  ],
  "topic": null,
  "axis": null,
  "test": null
 },
 {
  "id": "duo-002",
  "surface": "duo",
  "seq": 2,
  "type": "binary",
  "prompt": "A compliment in front of everyone — love it or squirm?",
  "options": [
   "Love it",
   "Squirm"
  ],
  "topic": null,
  "axis": null,
  "test": null
 },
 {
  "id": "duo-003",
  "surface": "duo",
  "seq": 3,
  "type": "binary",
  "prompt": "Running late. Their text says…",
  "options": [
   "\"5 min\" (it’s 20)",
   "The honest ETA",
   "Nothing — just arrives"
  ],
  "topic": null,
  "axis": null,
  "test": null
 },
 {
  "id": "duo-004",
  "surface": "duo",
  "seq": 4,
  "type": "binary",
  "prompt": "The food arrives wrong. Say something?",
  "options": [
   "Say something",
   "Eat it anyway"
  ],
  "topic": null,
  "axis": null,
  "test": null
 },
 {
  "id": "duo-005",
  "surface": "duo",
  "seq": 5,
  "type": "binary",
  "prompt": "Lost in a new city. They…",
  "options": [
   "Ask someone",
   "Map it out",
   "Just wander"
  ],
  "topic": null,
  "axis": null,
  "test": null
 },
 {
  "id": "duo-006",
  "surface": "duo",
  "seq": 6,
  "type": "binary",
  "prompt": "A free Saturday, zero plans. Bliss or restless?",
  "options": [
   "Bliss",
   "Restless"
  ],
  "topic": null,
  "axis": null,
  "test": null
 },
 {
  "id": "duo-007",
  "surface": "duo",
  "seq": 7,
  "type": "binary",
  "prompt": "Karaoke machine appears.",
  "options": [
   "Grabs the mic",
   "One duet, then done",
   "Vanishes"
  ],
  "topic": null,
  "axis": null,
  "test": null
 },
 {
  "id": "duo-008",
  "surface": "duo",
  "seq": 8,
  "type": "binary",
  "prompt": "Someone takes their joke too far. Laugh it off, or say so?",
  "options": [
   "Laugh it off",
   "Say so"
  ],
  "topic": null,
  "axis": null,
  "test": null
 },
 {
  "id": "duo-009",
  "surface": "duo",
  "seq": 9,
  "type": "binary",
  "prompt": "Big decision to make. How do they call it?",
  "options": [
   "Gut",
   "A list",
   "Ask everyone",
   "Sleep on it"
  ],
  "topic": null,
  "axis": null,
  "test": null
 },
 {
  "id": "duo-010",
  "surface": "duo",
  "seq": 10,
  "type": "binary",
  "prompt": "Cry in a film — freely, or fight it?",
  "options": [
   "Freely",
   "Fight it"
  ],
  "topic": null,
  "axis": null,
  "test": null
 },
 {
  "id": "duo-011",
  "surface": "duo",
  "seq": 11,
  "type": "binary",
  "prompt": "Ideal holiday day?",
  "options": [
   "Packed itinerary",
   "One plan, then drift",
   "Pool. Book. Done."
  ],
  "topic": null,
  "axis": null,
  "test": null
 },
 {
  "id": "duo-012",
  "surface": "duo",
  "seq": 12,
  "type": "binary",
  "prompt": "They win €10k. First move?",
  "options": [
   "Save it",
   "Book a trip that night",
   "Treat someone else",
   "Spend a little now"
  ],
  "topic": null,
  "axis": null,
  "test": null
 },
 {
  "id": "duo-013",
  "surface": "duo",
  "seq": 13,
  "type": "binary",
  "prompt": "An old friend owes an apology. Bring it up, or let it go?",
  "options": [
   "Bring it up",
   "Let it go"
  ],
  "topic": null,
  "axis": null,
  "test": null
 },
 {
  "id": "duo-014",
  "surface": "duo",
  "seq": 14,
  "type": "binary",
  "prompt": "Deep talk at 2am, or a proper night of sleep?",
  "options": [
   "The talk",
   "The sleep"
  ],
  "topic": null,
  "axis": null,
  "test": null
 },
 {
  "id": "duo-015",
  "surface": "duo",
  "seq": 15,
  "type": "binary",
  "prompt": "When hurt, they go…",
  "options": [
   "Quiet",
   "Loud",
   "Busy"
  ],
  "topic": null,
  "axis": null,
  "test": null
 },
 {
  "id": "duo-016",
  "surface": "duo",
  "seq": 16,
  "type": "binary",
  "prompt": "Hard truth or comfortable silence?",
  "options": [
   "Hard truth",
   "Silence"
  ],
  "topic": null,
  "axis": null,
  "test": null
 },
 {
  "id": "duo-017",
  "surface": "duo",
  "seq": 17,
  "type": "binary",
  "prompt": "After a brutal week, what refills them?",
  "options": [
   "People",
   "Solitude",
   "Movement",
   "Sleep"
  ],
  "topic": null,
  "axis": null,
  "test": null
 },
 {
  "id": "duo-018",
  "surface": "duo",
  "seq": 18,
  "type": "binary",
  "prompt": "A week alone in a cabin. Gift or sentence?",
  "options": [
   "Gift",
   "Sentence"
  ],
  "topic": null,
  "axis": null,
  "test": null
 },
 {
  "id": "duo-019",
  "surface": "duo",
  "seq": 19,
  "type": "binary",
  "prompt": "Old age: surrounded, or independent?",
  "options": [
   "Surrounded",
   "Independent"
  ],
  "topic": null,
  "axis": null,
  "test": null
 },
 {
  "id": "test-big5-00",
  "surface": "test",
  "seq": 0,
  "type": "scale",
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
  "id": "test-political-00",
  "surface": "test",
  "seq": 10,
  "type": "scale",
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
  "seq": 11,
  "type": "scale",
  "prompt": "A society is judged by how it treats the weakest.",
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
  "id": "test-political-02",
  "surface": "test",
  "seq": 12,
  "type": "scale",
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
  "seq": 13,
  "type": "scale",
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
  "test": "political"
 },
 {
  "id": "test-political-04",
  "surface": "test",
  "seq": 14,
  "type": "scale",
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
  "seq": 15,
  "type": "scale",
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
  "seq": 16,
  "type": "scale",
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
  "seq": 17,
  "type": "scale",
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
  "seq": 18,
  "type": "scale",
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
  "seq": 19,
  "type": "scale",
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
  "test": "political"
 },
 {
  "id": "test-political-10",
  "surface": "test",
  "seq": 20,
  "type": "scale",
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
  "seq": 21,
  "type": "scale",
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
  "id": "test-values-00",
  "surface": "test",
  "seq": 22,
  "type": "scale",
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
  "seq": 23,
  "type": "scale",
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
  "seq": 24,
  "type": "scale",
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
  "test": "values"
 },
 {
  "id": "test-values-03",
  "surface": "test",
  "seq": 25,
  "type": "scale",
  "prompt": "I'd sacrifice comfort now for a stranger's future.",
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
  "seq": 26,
  "type": "scale",
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
  "seq": 27,
  "type": "scale",
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
  "test": "values"
 },
 {
  "id": "test-values-06",
  "surface": "test",
  "seq": 28,
  "type": "scale",
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
  "seq": 29,
  "type": "scale",
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
  "seq": 30,
  "type": "scale",
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
  "seq": 31,
  "type": "scale",
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
  "seq": 32,
  "type": "scale",
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
  "seq": 33,
  "type": "scale",
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
  "id": "test-attachment-00",
  "surface": "test",
  "seq": 34,
  "type": "scale",
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
  "seq": 35,
  "type": "scale",
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
  "seq": 36,
  "type": "scale",
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
  "seq": 37,
  "type": "scale",
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
  "seq": 38,
  "type": "scale",
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
  "seq": 39,
  "type": "scale",
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
  "seq": 40,
  "type": "scale",
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
  "seq": 41,
  "type": "scale",
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
  "seq": 42,
  "type": "scale",
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
  "seq": 43,
  "type": "scale",
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
 }
];
