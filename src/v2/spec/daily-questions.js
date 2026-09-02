// Ported from design/spec-modules/daily-questions.js (the historical prototype — no sync
// script survives; THIS file is the live source now, hand-edits and all).
// Cross-module references resolve through the shared global scope and
// spec-index.js load order is semantic — scripts/check-spec-globals.mjs
// guards the wiring in CI.
import { sharePcts } from '../data/pct';
// The store (D352). Read at CALL time only — `myAnswer` and `liveSync`
// below — never while this module evaluates. That is what makes the
// import safe this early in spec-index.js: data/live.ts imports
// test-definitions.js, and neither of the three reads another's bindings
// during evaluation, so the order they settle in cannot matter.
import LIVE from '../data/live';

// daily-questions.js — "Daily Question" feature data + persistent answer store.
// A new question each day (type varies). Each question carries a plausible,
// per-audience answer distribution so every tab (around / city / groups /
// world / people) shows a DIFFERENT crowd. The user's own answers persist to
// localStorage; "you vs them" is computed live from the current answer.
//
// The IIFE below is vestigial as of D39 — an ESM module already has its own
// scope, and the wrapper is what this file needed when every module shared
// one. It stays because unwrapping it re-indents 480 lines, which would bury
// four real edits in a whitespace diff. The export is hoisted out instead:
// ESM bindings are live and this module finishes evaluating before any
// importer's body runs, so DAILYQ is the api object by the time it is read.
export let DAILYQ;

(function () {
  // ── seeded RNG (mulberry32) ───────────────────────────────────────────────
  function hashStr(s) { let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function mulberry32(a) { return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const rng = (s) => mulberry32(hashStr(s));

  // softmax of logits → integer percentages summing to exactly 100
  function softmaxPct(logits) {
    const m = Math.max(...logits);
    const ex = logits.map(l => Math.exp(l - m));
    const sum = ex.reduce((a, b) => a + b, 0);
    const raw = ex.map(e => (e / sum) * 100);
    const floor = raw.map(Math.floor);
    let rem = 100 - floor.reduce((a, b) => a + b, 0);
    const order = raw.map((v, i) => [v - floor[i], i]).sort((a, b) => b[0] - a[0]);
    for (let k = 0; k < rem; k++) floor[order[k % order.length][1]]++;
    return floor;
  }

  // The five audiences, in tab order.
  const AUDIENCES = [
    { id: 'around', label: 'people near you', short: 'near you', hue: 40 },
    { id: 'city', label: 'Oslo', short: 'Oslo', hue: 150 },
    { id: 'groups', label: 'your circles', short: 'circles', hue: 310 },
    { id: 'world', label: 'the world', short: 'the world', hue: 235 },
    { id: 'people', label: 'your close ties', short: 'close ties', hue: 28 },
    { id: 'country', label: 'Norway', short: 'Norway', hue: 200 },
  ];
  // how strongly each audience leans toward the user's own answer (like-mindedness)
  const PULL = { people: 1.7, around: 0.9, groups: 1.25, city: 0.45, country: 0.25, world: 0.0 };
  // how spread-out each audience is (world most diverse)
  const SPREAD = { people: 1.7, around: 1.5, groups: 1.45, city: 1.2, country: 1.08, world: 0.95 };

  const SCALE5 = ['Strongly disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly agree'];

  // ── category taxonomy: the topic path each question carries ────────────────
  // A question's path (e.g. ['Sport','Football']) is its tag AND where its
  // answer lands on your map. topWord → placement: a seedId reuses an existing
  // self-branch; the rest are topical branches that emerge as you answer.
  function slug(s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''); }
  function pathKey(p) { return (p || []).join(' / '); }
  const CAT_META = {
    Body: { seedId: 'health', hue: 150 }, Skills: { seedId: 'craft', hue: 40 }, Interests: { seedId: 'interests', hue: 78 },
    Home: { seedId: 'home', hue: 110 }, Story: { seedId: 'story', hue: 320 }, Goals: { seedId: 'goals', hue: 240 }, Values: { seedId: 'values', hue: 356 },
    Sport: { hue: 18 }, Film: { hue: 265 }, Food: { hue: 35 }, Travel: { hue: 200 }, Mind: { hue: 255 }, Morals: { hue: 305 }, Music: { hue: 130 },
  };
  function catMeta(top) { const m = CAT_META[top] || { hue: 250 }; return { top, hue: m.hue, seedId: m.seedId || null, catId: m.seedId || ('top-' + slug(top)) }; }
  const EMERGENT_CATS = Object.keys(CAT_META).filter((k) => !CAT_META[k].seedId).map((k) => ({ id: 'top-' + slug(k), label: k, hue: CAT_META[k].hue }));
  // candidate branch paths per question: authored default (clearly top-voted) + a couple of alternates
  function buildCandidates(id, def, alts) {
    const r = rng(id + '|cat');
    const out = [{ path: def, votes: 240 + Math.floor(r() * 220) }];
    (alts || []).forEach((p) => out.push({ path: p, votes: 22 + Math.floor(r() * 130) }));
    return out;
  }

  // ── question content (newest first; index 0 = today) ───────────────────────
  // type: scale (5pt) | binary (2) | choice (3-4) | rating (1-10) | dilemma (a scenario)
  // cat: the default topic path · alts: alternative candidate paths the crowd can vote between
  const Q = [
    { type: 'binary', prompt: 'Messi or Ronaldo?', tag: 'The GOAT', options: ['Messi', 'Ronaldo'], tone: 'light',
      cat: ['Sport', 'Football'], alts: [['Sport', 'Greatness'], ['Values', 'What you admire']] },
    { type: 'binary', prompt: 'Tarantino or Wes Anderson?', tag: 'Director duel', options: ['Tarantino', 'Wes Anderson'], tone: 'light',
      cat: ['Film', 'Directors'], alts: [['Film', 'Taste'], ['Interests', 'Cinema']] },
    { type: 'binary', prompt: 'Pineapple on pizza?', tag: 'Pineapple', options: ['Yes', 'Never'], tone: 'light',
      cat: ['Food', 'Debates'], alts: [['Food', 'Taste'], ['Values', 'Openness']] },
    { type: 'choice', prompt: 'What do you want more of this year?', tag: 'Want more', options: ['Time', 'Quiet', 'Adventure', 'Closeness'], tone: 'deep',
      cat: ['Values', 'Longing'], alts: [['Mind', 'Wants'], ['Goals', 'This year']] },
    { type: 'scale', prompt: "It's okay to do nothing sometimes.", tag: 'Doing nothing', axis: 'at ease', tone: 'light',
      cat: ['Mind', 'Rest'], alts: [['Values', 'Rest'], ['Body', 'Recovery']] },
    { type: 'binary', prompt: 'Are people getting kinder, or meaner?', tag: 'People today', options: ['Kinder', 'Meaner'], tone: 'deep',
      cat: ['Morals', 'Direction'], alts: [['Mind', 'Outlook'], ['Values', 'Hope']] },
    // Prompt synced with content/daily-questions.json 006 (D52: currency
    // left the prompts) — liveSync and the pulse archive join key on
    // prompt-string equality, so the twins must not drift.
    { type: 'dilemma', prompt: "You find a week's pay in cash on an empty street. What do you do?", tag: 'Found cash', options: ['Keep it', 'Hand it in', 'Leave it'], tone: 'deep',
      cat: ['Morals', 'Honesty'], alts: [['Values', 'Honesty'], ['Mind', 'Conscience']] },
    { type: 'rating', prompt: 'How optimistic are you about the next ten years?', tag: 'Next 10 years', axis: 'optimistic', tone: 'deep',
      cat: ['Mind', 'Outlook'], alts: [['Values', 'Hope'], ['Story', 'The future']] },
    { type: 'scale', prompt: 'People are basically trustworthy.', tag: 'Trust in people', axis: 'trusting', tone: 'deep',
      cat: ['Values', 'Trust'], alts: [['Mind', 'Outlook'], ['Morals', 'Faith in others']] },
    { type: 'binary', prompt: 'A pill that ends your need for sleep. Take it?', tag: 'Sleep pill', options: ['Take it', 'Never'], tone: 'deep',
      cat: ['Mind', 'Human limits'], alts: [['Body', 'Sleep'], ['Values', 'Being human']] },
    { type: 'choice', prompt: 'What should schools teach more of?', tag: 'Schools', options: ['Money', 'Emotions', 'Making things', 'History'], tone: 'deep',
      cat: ['Values', 'Education'], alts: [['Mind', 'Learning'], ['Goals', 'Next generation']] },
    // Synced with content 011 (D52: the partner assumption dropped) — same
    // prompt-equality join as 006 above.
    { type: 'dilemma', prompt: 'A job you would love means moving somewhere the person closest to you would hate. Do you take it?', tag: 'Job or move', options: ['Take it', 'Stay', 'Find a third way'], tone: 'deep',
      cat: ['Morals', 'Loyalty'], alts: [['Values', 'Loyalty'], ['Goals', 'Career']] },
    { type: 'binary', prompt: 'Would you rather watch sport, or play it?', tag: 'Watch or play', options: ['Watch', 'Play'], tone: 'light',
      cat: ['Sport', 'How you engage'], alts: [['Body', 'Activity'], ['Interests', 'Sport']] },
    { type: 'scale', prompt: 'Suffering can give life meaning.', tag: 'Suffering', axis: 'searching', tone: 'deep',
      cat: ['Values', 'Meaning'], alts: [['Mind', 'Outlook'], ['Morals', 'Meaning']] },
    { type: 'rating', prompt: 'How much do you trust the news you read?', tag: 'The news', axis: 'trusting', tone: 'deep',
      cat: ['Mind', 'Media'], alts: [['Values', 'Truth'], ['Morals', 'Institutions']] },
    { type: 'binary', prompt: 'Will AI make everyday life better, or worse?', tag: 'AI', options: ['Better', 'Worse'], tone: 'deep',
      cat: ['Mind', 'Technology'], alts: [['Values', 'Tech'], ['Story', 'The future']] },
    { type: 'choice', prompt: "Humanity's best invention?", tag: 'Best invention', options: ['Writing', 'Medicine', 'The internet', 'Music'], tone: 'blend',
      cat: ['Mind', 'Civilisation'], alts: [['Interests', 'Ideas'], ['Values', 'Progress']] },
    { type: 'scale', prompt: 'Technology is making us lonelier.', tag: 'Loneliness', axis: 'wary', tone: 'deep',
      cat: ['Mind', 'Technology'], alts: [['Values', 'Tech'], ['Morals', 'Connection']] },
    { type: 'choice', prompt: 'What matters most in a life well lived?', tag: 'A good life', options: ['Connection', 'Freedom', 'Creation', 'Peace'], tone: 'deep',
      cat: ['Values', 'What matters'], alts: [['Mind', 'Priorities'], ['Morals', 'The good life']] },
    { type: 'dilemma', prompt: 'Would you rather know the exact date of your death?', tag: 'Date of death', options: ['Know', 'Never know'], tone: 'deep',
      cat: ['Mind', 'Mortality'], alts: [['Values', 'Fate'], ['Morals', 'Big questions']] },
    { type: 'rating', prompt: 'How much of your life so far is luck?', tag: 'Luck', axis: 'shaped by luck', tone: 'deep',
      cat: ['Mind', 'Fate'], alts: [['Story', 'Chance'], ['Values', 'Merit']] },
    { type: 'scale', prompt: "I'd rather have a few deep friendships than many.", tag: 'Deep or many', axis: 'inward', tone: 'blend',
      cat: ['Values', 'Friendship'], alts: [['Mind', 'Temperament'], ['Interests', 'Social']] },
    { type: 'dilemma', prompt: 'A lie that spares someone real pain. Tell it?', tag: 'The kind lie', options: ['Tell it', 'Truth anyway'], tone: 'deep',
      cat: ['Morals', 'Kindness'], alts: [['Values', 'Honesty'], ['Mind', 'Conscience']] },
    { type: 'scale', prompt: "It's better to be honest than kind.", tag: 'Honest or kind', axis: 'frank', tone: 'deep',
      cat: ['Morals', 'Honesty'], alts: [['Values', 'Honesty'], ['Mind', 'Temperament']] },
    { type: 'scale', prompt: 'Money buys happiness.', tag: 'Money', axis: 'materialist', tone: 'blend',
      cat: ['Values', 'Money'], alts: [['Mind', 'Happiness'], ['Morals', 'Wealth']] },
    { type: 'rating', prompt: 'How much control do you feel over your life?', tag: 'Control', axis: 'in control', tone: 'deep',
      cat: ['Mind', 'Agency'], alts: [['Values', 'Control'], ['Story', 'Now']] },
    { type: 'choice', prompt: 'Where does your sense of self come from?', tag: 'Sense of self', options: ['What I do', 'Who I love', 'What I believe', 'What I make'], tone: 'deep',
      cat: ['Values', 'Identity'], alts: [['Story', 'Self'], ['Mind', 'Identity']] },
    { type: 'binary', prompt: 'Relive your best day, or live a new one?', tag: 'Best day', options: ['Relive it', 'A new one'], tone: 'blend',
      cat: ['Mind', 'Time'], alts: [['Story', 'Memory'], ['Values', 'Outlook']] },
    { type: 'choice', prompt: 'Pick a season for the soul.', tag: 'Season', options: ['Spring', 'Summer', 'Autumn', 'Winter'], tone: 'light',
      cat: ['Travel', 'Seasons'], alts: [['Interests', 'Seasons'], ['Mind', 'Mood']] },
    { type: 'scale', prompt: 'Most people would help a stranger in need.', tag: 'Helping hands', axis: 'hopeful', tone: 'deep',
      cat: ['Morals', 'Faith in others'], alts: [['Values', 'Trust'], ['Mind', 'Outlook']] },
    // ── deeper archive: keeps every topic browsable, not just a select few ──
    { type: 'binary', prompt: 'Team sports or solo sports?', tag: 'Team or solo', options: ['Team', 'Solo'], tone: 'light',
      cat: ['Sport', 'How you play'], alts: [['Body', 'Activity'], ['Interests', 'Sport']] },
    { type: 'choice', prompt: 'Best way to watch a final?', tag: 'The final', options: ['Stadium', 'Pub', 'Sofa'], tone: 'light',
      cat: ['Sport', 'Watching'], alts: [['Interests', 'Sport'], ['Home', 'Rituals']] },
    { type: 'binary', prompt: 'Subtitles or dubbing?', tag: 'Subtitles', options: ['Subtitles', 'Dubbing'], tone: 'light',
      cat: ['Film', 'How you watch'], alts: [['Film', 'Taste'], ['Mind', 'Language']] },
    { type: 'choice', prompt: 'A great film should leave you…', tag: 'What film is for', options: ['Moved', 'Thinking', 'Entertained'], tone: 'blend',
      cat: ['Film', 'What it’s for'], alts: [['Values', 'Art'], ['Mind', 'Feeling']] },
    { type: 'binary', prompt: 'Cinema or sofa?', tag: 'Cinema night', options: ['Cinema', 'Sofa'], tone: 'light',
      cat: ['Film', 'Where you watch'], alts: [['Home', 'Nights in'], ['Interests', 'Cinema']] },
    { type: 'binary', prompt: 'Cook at home or eat out?', tag: 'Kitchen or table', options: ['Cook', 'Eat out'], tone: 'light',
      cat: ['Food', 'Habits'], alts: [['Home', 'Kitchen'], ['Body', 'Health']] },
    { type: 'choice', prompt: 'One cuisine, forever?', tag: 'One cuisine', options: ['Italian', 'Japanese', 'Mexican', 'Indian'], tone: 'light',
      cat: ['Food', 'Taste'], alts: [['Travel', 'Places'], ['Interests', 'Food']] },
    { type: 'scale', prompt: 'Breakfast is the best meal of the day.', tag: 'Breakfast', axis: 'breakfast-loyal', tone: 'light',
      cat: ['Food', 'Meals'], alts: [['Body', 'Mornings'], ['Home', 'Rituals']] },
    { type: 'binary', prompt: 'Mountains or sea?', tag: 'Mountains or sea', options: ['Mountains', 'Sea'], tone: 'light',
      cat: ['Travel', 'Landscapes'], alts: [['Body', 'Outdoors'], ['Mind', 'Mood']] },
    { type: 'choice', prompt: 'The best part of a trip?', tag: 'The trip', options: ['Planning it', 'Being there', 'Coming home'], tone: 'blend',
      cat: ['Travel', 'The arc'], alts: [['Mind', 'Anticipation'], ['Home', 'Return']] },
    { type: 'binary', prompt: 'One trip in a time machine: past or future?', tag: 'Time machine', options: ['The past', 'The future'], tone: 'blend',
      cat: ['Travel', 'Time travel'], alts: [['Mind', 'Time'], ['Story', 'History']] },
    { type: 'binary', prompt: 'A live gig or the perfect recording?', tag: 'Live or studio', options: ['Live', 'The recording'], tone: 'light',
      cat: ['Music', 'How you listen'], alts: [['Interests', 'Music'], ['Body', 'Presence']] },
    { type: 'choice', prompt: 'Music is mostly for…', tag: 'What music does', options: ['Dancing', 'Feeling', 'Focus', 'Memory'], tone: 'blend',
      cat: ['Music', 'What it does'], alts: [['Mind', 'Mood'], ['Story', 'Memory']] },
    { type: 'binary', prompt: 'Lyrics or melody?', tag: 'Lyrics or melody', options: ['Lyrics', 'Melody'], tone: 'light',
      cat: ['Music', 'What hooks you'], alts: [['Mind', 'Language'], ['Values', 'Beauty']] },
    { type: 'binary', prompt: 'Morning person or night owl?', tag: 'Your clock', options: ['Morning', 'Night owl'], tone: 'light',
      cat: ['Body', 'Clock'], alts: [['Mind', 'Energy'], ['Home', 'Rhythm']] },
    { type: 'scale', prompt: 'I feel better after moving — every time.', tag: 'Moving helps', axis: 'movement-powered', tone: 'blend',
      cat: ['Body', 'Movement'], alts: [['Mind', 'Mood'], ['Sport', 'Habit']] },
    { type: 'choice', prompt: 'Your childhood self would think you’re…', tag: 'Then and now', options: ['Doing great', 'Too serious', 'Surprising', 'A stranger'], tone: 'deep',
      cat: ['Story', 'Then and now'], alts: [['Mind', 'Self'], ['Values', 'Identity']] },
    { type: 'binary', prompt: 'Would you read a diary you kept at 15?', tag: 'The diary', options: ['Read it', 'Burn it'], tone: 'blend',
      cat: ['Story', 'The archive'], alts: [['Mind', 'Memory'], ['Values', 'Self-kindness']] },
    { type: 'choice', prompt: 'This decade is mostly for…', tag: 'The decade', options: ['Building', 'Exploring', 'Settling', 'Healing'], tone: 'deep',
      cat: ['Goals', 'The decade'], alts: [['Story', 'Chapters'], ['Values', 'Direction']] },
    { type: 'scale', prompt: 'I know what I want from the next five years.', tag: 'Five years', axis: 'clear-eyed', tone: 'deep',
      cat: ['Goals', 'Clarity'], alts: [['Mind', 'Agency'], ['Values', 'Direction']] },
    { type: 'choice', prompt: 'Home is mostly…', tag: 'What home is', options: ['A base', 'A nest', 'A project', 'A stopover'], tone: 'blend',
      cat: ['Home', 'What it is'], alts: [['Values', 'Belonging'], ['Story', 'Place']] },
    { type: 'binary', prompt: 'Master one thing, or dabble in many?', tag: 'Depth or range', options: ['Master one', 'Dabble'], tone: 'blend',
      cat: ['Skills', 'Depth'], alts: [['Goals', 'Craft'], ['Mind', 'Curiosity']] },
    { type: 'binary', prompt: 'New hobby: learn alone or join a club?', tag: 'How you start', options: ['Alone', 'Join a club'], tone: 'light',
      cat: ['Interests', 'How you start'], alts: [['Skills', 'Learning'], ['Values', 'Community']] },
    // ── question farm 2026-07-30 (docs/QUESTION-FARM.md): Home, Skills and
    // Interests each had a single question — four more apiece, still browsable
    // as archive via the dqx series. AI-proposed, human-reviewed via PR.
    { type: 'binary', prompt: 'A tidy home or a lived-in one?', tag: 'Tidy or lived-in', options: ['Tidy', 'Lived-in'], tone: 'light',
      cat: ['Home', 'How it looks'], alts: [['Mind', 'Order'], ['Values', 'Comfort']] },
    { type: 'choice', prompt: 'What makes a place feel like home first?', tag: 'What makes it home', options: ['The people', 'The things', 'The routines', 'Time'], tone: 'deep',
      cat: ['Home', 'What makes it'], alts: [['Values', 'Belonging'], ['Story', 'Place']] },
    { type: 'binary', prompt: 'A full house or a quiet one?', tag: 'Full or quiet', options: ['Full house', 'Quiet'], tone: 'blend',
      cat: ['Home', 'Guests'], alts: [['Values', 'Community'], ['Mind', 'Energy']] },
    { type: 'choice', prompt: 'Your home’s one non-negotiable?', tag: 'Non-negotiable', options: ['Light', 'Quiet', 'Space', 'The view'], tone: 'blend',
      cat: ['Home', 'Non-negotiables'], alts: [['Mind', 'Peace'], ['Values', 'Comfort']] },
    { type: 'binary', prompt: 'Read the manual, or wing it?', tag: 'Manual or wing it', options: ['The manual', 'Wing it'], tone: 'light',
      cat: ['Skills', 'How you learn'], alts: [['Mind', 'Learning'], ['Values', 'Patience']] },
    { type: 'choice', prompt: 'Which would you master overnight, if you could?', tag: 'Overnight mastery', options: ['A language', 'An instrument', 'Cooking', 'Carpentry'], tone: 'blend',
      cat: ['Skills', 'Wishlist'], alts: [['Goals', 'Craft'], ['Interests', 'Learning']] },
    { type: 'choice', prompt: 'The hardest thing to learn?', tag: 'Hardest to learn', options: ['Patience', 'Listening', 'Asking for help', 'Letting go'], tone: 'deep',
      cat: ['Skills', 'The hard ones'], alts: [['Mind', 'Growth'], ['Values', 'Humility']] },
    { type: 'scale', prompt: 'Being bad at something new is half the fun.', tag: 'Half the fun', axis: 'beginner-hearted', tone: 'blend',
      cat: ['Skills', 'Beginnings'], alts: [['Mind', 'Play'], ['Values', 'Humility']] },
    { type: 'binary', prompt: 'Collect things, or experiences?', tag: 'What you collect', options: ['Things', 'Experiences'], tone: 'blend',
      cat: ['Interests', 'Collecting'], alts: [['Values', 'What matters'], ['Home', 'Your things']] },
    { type: 'choice', prompt: 'A free Saturday, no plans. What pulls you?', tag: 'Free Saturday', options: ['Outdoors', 'A project', 'People', 'The sofa'], tone: 'light',
      cat: ['Interests', 'Free time'], alts: [['Mind', 'Energy'], ['Home', 'Weekends']] },
    { type: 'scale', prompt: 'Everyone needs at least one useless hobby.', tag: 'Useless hobbies', axis: 'play-minded', tone: 'blend',
      cat: ['Interests', 'Why we bother'], alts: [['Values', 'Play'], ['Mind', 'Rest']] },
    { type: 'binary', prompt: 'Would you rather be interesting, or interested?', tag: 'Interesting or interested', options: ['Interesting', 'Interested'], tone: 'deep',
      cat: ['Interests', 'The point'], alts: [['Values', 'Character'], ['Mind', 'Attention']] },
    // ── authoring session 2026-08-01 (docs/LAUNCH-PLAN.md, D30): the last 25
    // toward the 90-question launch bank. Lane-3 coverage first — Story, Goals,
    // Body and Music were thinnest — then a spread across the rest. Same review
    // bar as a farm batch (this PR is the review); promoted to
    // content/daily-questions.json in the same change with byte-identical
    // prompts (liveSync joins the seeded bank to this archive by prompt).
    { type: 'choice', prompt: 'Which chapter are you in?', tag: 'The chapter', options: ['Early pages', 'The thick of it', 'A turning point', 'A quiet chapter'], tone: 'deep',
      cat: ['Story', 'Chapters'], alts: [['Goals', 'The decade'], ['Mind', 'Self']] },
    { type: 'choice', prompt: 'The story you tell most often is about…', tag: 'Retellings', options: ['A triumph', 'A disaster', 'A coincidence', 'A person'], tone: 'blend',
      cat: ['Story', 'Retellings'], alts: [['Interests', 'Stories'], ['Mind', 'Memory']] },
    { type: 'binary', prompt: 'Do you remember your past in pictures, or in stories?', tag: 'How you remember', options: ['Pictures', 'Stories'], tone: 'blend',
      cat: ['Story', 'Memory'], alts: [['Mind', 'Memory'], ['Interests', 'How minds work']] },
    { type: 'choice', prompt: 'If someone wrote your biography, the title would mention…', tag: 'The biography', options: ['A place', 'A person', 'A struggle', 'A joke'], tone: 'blend',
      cat: ['Story', 'The book of you'], alts: [['Mind', 'Identity'], ['Values', 'What matters']] },
    { type: 'binary', prompt: 'Big goals: write them down, or keep them quiet?', tag: 'Goal keeping', options: ['Write them down', 'Keep them quiet'], tone: 'blend',
      cat: ['Goals', 'Method'], alts: [['Mind', 'Habits'], ['Skills', 'Discipline']] },
    { type: 'scale', prompt: "I'd rather aim high and miss than aim safe and hit.", tag: 'Aim high', axis: 'high-aiming', tone: 'deep',
      cat: ['Goals', 'Ambition'], alts: [['Values', 'Risk'], ['Mind', 'Temperament']] },
    { type: 'choice', prompt: 'What usually stops you?', tag: 'The obstacle', options: ['Starting', 'Sticking with it', 'Finishing', 'Knowing what I want'], tone: 'deep',
      cat: ['Goals', 'The obstacle'], alts: [['Mind', 'Agency'], ['Skills', 'Follow-through']] },
    { type: 'binary', prompt: 'Retire early, or never fully retire?', tag: 'The long game', options: ['Early', 'Never fully'], tone: 'blend',
      cat: ['Goals', 'The long game'], alts: [['Values', 'Work'], ['Story', 'The future']] },
    { type: 'choice', prompt: 'Your body mostly asks for…', tag: 'Body signals', options: ['Sleep', 'Food', 'Movement', 'Quiet'], tone: 'light',
      cat: ['Body', 'Signals'], alts: [['Mind', 'Needs'], ['Home', 'Rhythm']] },
    { type: 'binary', prompt: 'Sauna or ice bath?', tag: 'Heat or cold', options: ['Sauna', 'Ice bath'], tone: 'light',
      cat: ['Body', 'Heat or cold'], alts: [['Interests', 'Rituals'], ['Travel', 'Nordic things']] },
    { type: 'scale', prompt: 'Eight hours of sleep is non-negotiable.', tag: 'Sleep rules', axis: 'sleep-strict', tone: 'blend',
      cat: ['Body', 'Sleep'], alts: [['Mind', 'Discipline'], ['Home', 'Rhythm']] },
    { type: 'binary', prompt: 'Stairs or escalator?', tag: 'Small choices', options: ['Stairs', 'Escalator'], tone: 'light',
      cat: ['Body', 'Everyday movement'], alts: [['Mind', 'Habits'], ['Values', 'Effort']] },
    { type: 'binary', prompt: 'Music while you work?', tag: 'Work soundtrack', options: ['Always', 'Never'], tone: 'light',
      cat: ['Music', 'When you listen'], alts: [['Mind', 'Focus'], ['Skills', 'How you work']] },
    { type: 'choice', prompt: 'The music that made you was from your…', tag: 'Formative years', options: ['Teens', 'Twenties', 'Childhood', 'Last year'], tone: 'blend',
      cat: ['Music', 'Formative years'], alts: [['Story', 'Then and now'], ['Mind', 'Memory']] },
    { type: 'binary', prompt: 'One album forever, or shuffle forever?', tag: 'One album', options: ['One album', 'Shuffle'], tone: 'light',
      cat: ['Music', 'How you listen'], alts: [['Mind', 'Depth or range'], ['Interests', 'Music']] },
    { type: 'binary', prompt: 'Same place every year, or somewhere new every time?', tag: 'Repeat or explore', options: ['Same place', 'Somewhere new'], tone: 'blend',
      cat: ['Travel', 'Repeat or explore'], alts: [['Values', 'Novelty'], ['Home', 'Rituals']] },
    { type: 'binary', prompt: 'Underdog stories or dynasties?', tag: 'Who you root for', options: ['Underdogs', 'Dynasties'], tone: 'blend',
      cat: ['Sport', 'Rooting'], alts: [['Story', 'Narratives'], ['Values', 'What you admire']] },
    { type: 'binary', prompt: 'Sweet or salty?', tag: 'Cravings', options: ['Sweet', 'Salty'], tone: 'light',
      cat: ['Food', 'Cravings'], alts: [['Body', 'Signals'], ['Interests', 'Taste']] },
    { type: 'binary', prompt: "Spoilers: ruin everything, or don't matter?", tag: 'Spoilers', options: ['Ruin everything', "Don't matter"], tone: 'light',
      cat: ['Film', 'Spoilers'], alts: [['Mind', 'Anticipation'], ['Values', 'Surprise']] },
    { type: 'dilemma', prompt: 'You can know one true thing about how someone sees you. Ask, or not?', tag: 'The one truth', options: ['Ask', 'Never ask'], tone: 'deep',
      cat: ['Values', 'Truth'], alts: [['Mind', 'Self'], ['Morals', 'Courage']] },
    { type: 'scale', prompt: 'An apology can fix almost anything.', tag: 'Repair', axis: 'forgiving', tone: 'deep',
      cat: ['Values', 'Repair'], alts: [['Morals', 'Forgiveness'], ['Mind', 'Relationships']] },
    { type: 'choice', prompt: 'Who do you owe most?', tag: 'Debts', options: ['Family', 'Friends', 'Strangers in need', 'Yourself'], tone: 'deep',
      cat: ['Morals', 'Debts'], alts: [['Values', 'Circle'], ['Mind', 'Priorities']] },
    { type: 'dilemma', prompt: 'A favourite artist turns out to have done something awful. Keep listening?', tag: 'Art and artist', options: ['Keep listening', "Can't anymore"], tone: 'deep',
      cat: ['Morals', 'Art and artist'], alts: [['Music', 'What it does'], ['Values', 'Principles']] },
    { type: 'choice', prompt: 'The best seat in your home is…', tag: 'The good spot', options: ['The sofa', 'The kitchen table', 'The bed', 'By the window'], tone: 'light',
      cat: ['Home', 'The good spot'], alts: [['Body', 'Comfort'], ['Interests', 'Small pleasures']] },
    { type: 'rating', prompt: 'How alive is your curiosity these days?', tag: 'Curiosity', axis: 'curious', tone: 'blend',
      cat: ['Interests', 'Curiosity'], alts: [['Mind', 'Energy'], ['Goals', 'Growth']] },
    // ── the place scorecard, 2026-08-16 (D187) ────────────────────────────
    // The Mirror's Scores lens is the prototype's place scorecard, and the
    // live bank held nothing that rates a place — so it drew the ordinal
    // questions it could find ("Breakfast is the best meal of the day")
    // under the heading "How Oslo rated them". These are the eight facets
    // per radius that scorecard was designed around (spec/place-stats.js),
    // written SELF-REFERENTIALLY — "your city", never "Oslo" — so one
    // question serves every city on earth and the cohort cell does the
    // scoping. That is also what keeps them clear of hard rule 6
    // (QUESTION-FARM.md): a question scoped to one place's citizens is
    // sold inventory, and none of these is scoped to a place at all.
    //
    // `rates` names which Mirror stop may fold a question into its
    // scorecard — the City stop reads its city cell, Country its country
    // cell, World the globe. All `rating`, on purpose: the card is sorted
    // best → worst on ONE shared 0-10 baseline, so eight rows read as a
    // single shape rather than eight lookups.
    { type: 'rating', prompt: 'How easy is it to get into nature from where you live?', tag: 'Nature access', axis: 'nature-close', tone: 'blend', rates: 'city',
      cat: ['Home', 'Nature nearby'], alts: [['Travel', 'Outdoors'], ['Body', 'Being outside']] },
    { type: 'rating', prompt: 'How well does your city move you around?', tag: 'Getting around', axis: 'well-connected', tone: 'blend', rates: 'city',
      cat: ['Home', 'Getting around'], alts: [['Travel', 'Transit'], ['Skills', 'Daily life']] },
    { type: 'rating', prompt: 'How safe do you feel walking home at night?', tag: 'Safety', axis: 'safe', tone: 'deep', rates: 'city',
      cat: ['Home', 'Safety'], alts: [['Values', 'Safety'], ['Mind', 'Ease']] },
    { type: 'rating', prompt: 'Rate the food where you live.', tag: 'Food scene', axis: 'well-fed', tone: 'light', rates: 'city',
      cat: ['Food', 'Where you live'], alts: [['Home', 'Eating out'], ['Interests', 'Food scene']] },
    { type: 'rating', prompt: 'Your city after dark — rate the nightlife.', tag: 'Nightlife', axis: 'night-loving', tone: 'light', rates: 'city',
      cat: ['Home', 'After dark'], alts: [['Interests', 'Nightlife'], ['Music', 'Going out']] },
    { type: 'rating', prompt: 'How easy is it to talk to a stranger here?', tag: 'Friendliness', axis: 'warm', tone: 'blend', rates: 'city',
      cat: ['Home', 'Neighbours'], alts: [['Values', 'Warmth'], ['Morals', 'Kindness']] },
    { type: 'rating', prompt: 'How is dating where you live?', tag: 'Dating', axis: 'lucky in love', tone: 'blend', rates: 'city',
      cat: ['Home', 'Dating'], alts: [['Story', 'Love'], ['Values', 'Romance']] },
    { type: 'rating', prompt: 'How affordable is your city on a normal wage?', tag: 'Affordability', axis: 'comfortable', tone: 'deep', rates: 'city',
      cat: ['Home', 'Cost of living'], alts: [['Goals', 'Money'], ['Values', 'Money']] },
    { type: 'rating', prompt: "Your country's landscapes — how good are they?", tag: 'Nature', axis: 'landscape-blessed', tone: 'light', rates: 'country',
      cat: ['Travel', 'Landscapes'], alts: [['Home', 'Your country'], ['Interests', 'Outdoors']] },
    { type: 'rating', prompt: 'How safe a country is yours to live in?', tag: 'Safety', axis: 'unworried', tone: 'deep', rates: 'country',
      cat: ['Home', 'Your country'], alts: [['Values', 'Safety'], ['Mind', 'Ease']] },
    { type: 'rating', prompt: 'Work and rest in your country — how well do they balance?', tag: 'Work–life balance', axis: 'balanced', tone: 'deep', rates: 'country',
      cat: ['Goals', 'Work and life'], alts: [['Values', 'Balance'], ['Home', 'Your country']] },
    { type: 'rating', prompt: 'If you got sick tomorrow, how good would the care be?', tag: 'Healthcare', axis: 'well cared for', tone: 'deep', rates: 'country',
      cat: ['Body', 'Care'], alts: [['Home', 'Your country'], ['Values', 'Care']] },
    { type: 'rating', prompt: 'Do everyday services work where you are?', tag: 'Public services', axis: 'well-run', tone: 'blend', rates: 'country',
      cat: ['Home', 'Your country'], alts: [['Skills', 'Daily life'], ['Values', 'Fairness']] },
    { type: 'rating', prompt: 'How welcoming is your country to people who move there?', tag: 'Openness', axis: 'welcoming', tone: 'deep', rates: 'country', political: true,
      cat: ['Values', 'Openness'], alts: [['Morals', 'Welcome'], ['Home', 'Your country']] },
    { type: 'rating', prompt: 'The weather you live with. Be honest.', tag: 'Weather', axis: 'weather-blessed', tone: 'light', rates: 'country',
      cat: ['Home', 'Weather'], alts: [['Travel', 'Climate'], ['Body', 'Seasons']] },
    { type: 'rating', prompt: 'Can an ordinary wage carry an ordinary life here?', tag: 'Affordability', axis: 'well-off', tone: 'deep', rates: 'country',
      cat: ['Goals', 'Money'], alts: [['Home', 'Cost of living'], ['Values', 'Money']] },
    { type: 'rating', prompt: 'How good is what the world eats these days?', tag: 'What we eat', axis: 'food-glad', tone: 'light', rates: 'world',
      cat: ['Food', 'The world'], alts: [['Interests', 'Food'], ['Values', 'How we live']] },
    { type: 'rating', prompt: 'Music right now, worldwide — rate it.', tag: 'Music right now', axis: 'music-glad', tone: 'light', rates: 'world',
      cat: ['Music', 'Right now'], alts: [['Interests', 'Music'], ['Story', 'This era']] },
    { type: 'rating', prompt: 'How kind are strangers these days?', tag: 'Kindness of strangers', axis: 'faith in strangers', tone: 'deep', rates: 'world',
      cat: ['Morals', 'Kindness'], alts: [['Values', 'Trust'], ['Mind', 'Outlook']] },
    { type: 'rating', prompt: 'Where the world is heading — rate it.', tag: 'Where it’s heading', axis: 'world-hopeful', tone: 'deep', rates: 'world',
      cat: ['Story', 'The future'], alts: [['Mind', 'Outlook'], ['Values', 'Hope']] },
    { type: 'rating', prompt: 'The state of nature worldwide — rate it.', tag: 'State of nature', axis: 'unalarmed', tone: 'deep', rates: 'world',
      cat: ['Travel', 'The planet'], alts: [['Values', 'Nature'], ['Morals', 'Stewardship']] },
    { type: 'rating', prompt: 'How honest is public life these days?', tag: 'Public honesty', axis: 'unjaded', tone: 'deep', rates: 'world', political: true,
      cat: ['Morals', 'Honesty'], alts: [['Values', 'Trust'], ['Mind', 'Outlook']] },
    { type: 'rating', prompt: 'How fair is the world right now?', tag: 'Fairness', axis: 'fair-minded', tone: 'deep', rates: 'world',
      cat: ['Morals', 'Fairness'], alts: [['Values', 'Fairness'], ['Mind', 'Outlook']] },
    { type: 'rating', prompt: 'How well is the world being led?', tag: 'Leadership', axis: 'leader-trusting', tone: 'deep', rates: 'world', political: true,
      cat: ['Values', 'Leadership'], alts: [['Morals', 'Power'], ['Story', 'This era']] },
    // ── question farm 2026-08-19 (docs/QUESTION-FARM.md): the pen was empty
    // (0 of 56) with zero scorecard signal, so lane-3 thin-first — one each
    // into the eight thinnest topics (Sport, Film, Skills, Interests, Food,
    // Travel, Music, Body). AI-proposed, human-reviewed via PR.
    { type: 'binary', prompt: 'Win ugly, or lose beautifully?', tag: 'Ugly win', options: ['Win ugly', 'Lose beautifully'], tone: 'blend',
      cat: ['Sport', 'Style'], alts: [['Values', 'What you admire'], ['Story', 'Narratives']] },
    { type: 'binary', prompt: 'Black and white films: timeless, or homework?', tag: 'Black and white', options: ['Timeless', 'Homework'], tone: 'light',
      cat: ['Film', 'The classics'], alts: [['Interests', 'Cinema'], ['Story', 'History']] },
    { type: 'scale', prompt: "A skill isn't yours until you've taught it to someone.", tag: 'Teach it', axis: 'teaching-minded', tone: 'blend',
      cat: ['Skills', 'Mastery'], alts: [['Mind', 'Understanding'], ['Goals', 'Craft']] },
    { type: 'choice', prompt: 'What pulls you down a rabbit hole at 1 a.m.?', tag: 'Rabbit holes', options: ['History', 'How things work', "Other people's lives", 'Maps'], tone: 'light',
      cat: ['Interests', 'Rabbit holes'], alts: [['Mind', 'Curiosity'], ['Story', 'History']] },
    { type: 'binary', prompt: 'The last slice: take it, or offer it?', tag: 'Last slice', options: ['Take it', 'Offer it'], tone: 'light',
      cat: ['Food', 'Table manners'], alts: [['Morals', 'Small courtesies'], ['Values', 'Generosity']] },
    { type: 'binary', prompt: 'Window seat or aisle?', tag: 'The seat', options: ['Window', 'Aisle'], tone: 'light',
      cat: ['Travel', 'In transit'], alts: [['Body', 'Comfort'], ['Mind', 'The view']] },
    { type: 'choice', prompt: 'Where does music hit you hardest?', tag: 'Where it hits', options: ['Alone in headphones', 'Live in a crowd', 'In the car', 'On the dance floor'], tone: 'blend',
      cat: ['Music', 'Where it hits'], alts: [['Body', 'Presence'], ['Mind', 'Feeling']] },
    { type: 'scale', prompt: 'Your body runs your mood more than your mind does.', tag: 'Body first', axis: 'body-led', tone: 'deep',
      cat: ['Body', 'Mind and body'], alts: [['Mind', 'Mood'], ['Values', 'Self-knowledge']] },
    // ── question farm 2026-08-19 (docs/QUESTION-FARM.md): the pen was empty
    // (0 of 56) after #232 promoted the previous batch, so lane-3 thin-first —
    // one each into the eight thinnest tops (Sport, Film, Skills, Story,
    // Interests, Goals, Body, Music). AI-proposed, human-reviewed via PR.
    { type: 'binary', prompt: 'The team you support: inherited, or chosen?', tag: 'How you got them', options: ['Inherited', 'Chosen'], tone: 'blend',
      cat: ['Sport', 'Rooting'], alts: [['Story', 'Memory'], ['Values', 'Loyalty']] },
    { type: 'binary', prompt: 'Rewatch a favourite, or risk something new?', tag: 'Rewatch or risk', options: ['Rewatch', 'Risk it'], tone: 'light',
      cat: ['Film', 'How you watch'], alts: [['Interests', 'Taste'], ['Values', 'Openness']] },
    { type: 'choice', prompt: 'Which could you do perfectly, starting right now?', tag: 'The instant skill', options: ['Play an instrument', 'Speak a language', 'Draw anything', 'Fix anything'], tone: 'blend',
      cat: ['Skills', 'Wishlist'], alts: [['Interests', 'Curiosity'], ['Story', 'Self']] },
    { type: 'choice', prompt: 'Your life so far reads most like…', tag: 'The shape of it', options: ['A straight line', 'A few sharp turns', 'A slow drift', 'Still chapter one'], tone: 'deep',
      cat: ['Story', 'Chapters'], alts: [['Mind', 'Outlook'], ['Goals', 'The long game']] },
    { type: 'scale', prompt: 'The best hobbies have nothing to show for them.', tag: 'Nothing to show', axis: 'unproductive', tone: 'deep',
      cat: ['Interests', 'The point'], alts: [['Values', 'Rest'], ['Morals', 'The good life']] },
    { type: 'binary', prompt: 'Respected at work, or free to walk away from it?', tag: 'Respect or freedom', options: ['Respected', 'Free to walk'], tone: 'deep',
      cat: ['Goals', 'Work and life'], alts: [['Values', 'Meaning'], ['Morals', 'The good life']] },
    { type: 'choice', prompt: 'First thing you want in the morning?', tag: 'First thing', options: ['Quiet', 'Coffee', 'Movement', 'Ten more minutes'], tone: 'light',
      cat: ['Body', 'Mornings'], alts: [['Home', 'Rituals'], ['Mind', 'Rest']] },
    { type: 'binary', prompt: 'At a concert: front row, or back with space?', tag: 'Where you stand', options: ['Front row', 'Back with space'], tone: 'light',
      cat: ['Music', 'Going out'], alts: [['Interests', 'Nightlife'], ['Body', 'Comfort']] },
  ];

  const UNANSWERED_RECENT = 3; // today + 2 missed days carry no baked answer
  const TODAY = new Date('2026-05-28T08:00:00');
  const DAYNAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  function nOf(q) { return q.type === 'rating' ? 10 : q.type === 'binary' ? 2 : q.type === 'scale' ? 5 : q.options.length; }
  function labelsOf(q) {
    if (q.type === 'rating') return Array.from({ length: 10 }, (_, i) => String(i + 1));
    if (q.type === 'scale') return SCALE5;
    return q.options;
  }

  // base "shape" of opinion for a question (before audience perturbation)
  function baseLogits(q, n) {
    const r = rng(q.id + '|base');
    const arr = [];
    // give scale/rating a gentle hump so they look like real opinion curves
    const center = 1 + r() * (n - 2);
    for (let i = 0; i < n; i++) {
      let l = (r() - 0.5) * 1.8;
      if (q.type === 'scale' || q.type === 'rating') l += -Math.pow((i - center) / (n * 0.42), 2) * 1.6;
      arr.push(l);
    }
    return arr;
  }

  function genDist(q, aud, mineIdx, base) {
    const n = base.length;
    const r = rng(q.id + '|' + aud);
    const spread = SPREAD[aud] ?? 1.2;
    const logits = base.map(b => (b / spread) + (r() - 0.5) * 2.0 * spread);
    if (mineIdx != null) logits[mineIdx] += (PULL[aud] ?? 0);
    return softmaxPct(logits);
  }

  // build the question objects. Ids for the original 30 stay stable (map
  // anchors reference them); later additions get their own 'dqx' series.
  const DQ_BASE = 30;
  const QUESTIONS = Q.map((q, i) => {
    const id = i < DQ_BASE ? 'dq' + String(DQ_BASE - i).padStart(2, '0') : 'dqx' + String(i - DQ_BASE + 1).padStart(2, '0');
    const d = new Date(TODAY.getTime() - i * 86400000);
    const n = nOf(q);
    const base = baseLogits({ ...q, id }, n);
    // baked "what the user answered that day" (null for today + recent misses)
    let mineIdx = null;
    if (i >= UNANSWERED_RECENT) {
      const mr = rng(id + '|mine');
      // bias the user's own past answers slightly agreeable / positive
      const ml = base.map((b, k) => b + (mr() - 0.5) * 1.6 + ((q.type === 'scale' || q.type === 'rating') ? k * 0.12 : 0));
      mineIdx = ml.indexOf(Math.max(...ml));
    }
    const dist = {};
    AUDIENCES.forEach(a => { dist[a.id] = genDist({ ...q, id }, a.id, mineIdx, base); });
    return {
      id, idx: i, type: q.type, prompt: q.prompt, tag: q.tag || null, tone: q.tone, axis: q.axis || null,
      cat: q.cat, catCandidates: buildCandidates(id, q.cat, q.alts),
      options: labelsOf({ ...q, options: q.options }),
      n, dist, bakedMine: mineIdx,
      date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
      day: DAYNAMES[d.getDay()],
      dateLabel: `${d.getDate()} ${MONTHS[d.getMonth()]}`,
      isToday: i === 0,
    };
  });

  // ── persistent answer store ────────────────────────────────────────────────
  const LS = 'insight.dailyq.v1';
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(LS) || '{}'); } catch (e) { saved = {}; }
  const listeners = new Set();

  // ── personal branch placement (overrides the crowd's voted default) ───────
  const LSC = 'insight.dailyq.cat.v1';
  let savedCat = {};
  try { savedCat = JSON.parse(localStorage.getItem(LSC) || '{}'); } catch (e) { savedCat = {}; }
  function categoryPath(q) {
    if (savedCat[q.id]) return savedCat[q.id];
    let best = q.catCandidates[0];
    q.catCandidates.forEach((c) => { if (c.votes > best.votes) best = c; });
    return best.path;
  }
  function categoryCandidates(q) {
    const ov = savedCat[q.id];
    const list = q.catCandidates.map((c) => ({ path: c.path, votes: c.votes + (ov && pathKey(ov) === pathKey(c.path) ? 1 : 0) }));
    if (ov && !list.some((c) => pathKey(c.path) === pathKey(ov))) list.push({ path: ov, votes: 1, custom: true });
    list.forEach((c) => { c.mine = ov ? pathKey(ov) === pathKey(c.path) : false; });
    list.sort((a, b) => b.votes - a.votes);
    const total = list.reduce((s, c) => s + c.votes, 0) || 1;
    list.forEach((c) => { c.share = Math.round((c.votes / total) * 100); });
    return list;
  }
  function voteCategory(qid, path) {
    savedCat[qid] = path;
    try { localStorage.setItem(LSC, JSON.stringify(savedCat)); } catch { /* best-effort */ }
    listeners.forEach((f) => f());
  }
  function answeredCategorized() {
    return QUESTIONS.filter((q) => myAnswer(q) != null).map((q) => {
      const idx = myAnswer(q);
      const ansText = (q.options && q.options[idx] != null) ? q.options[idx] : (q.type === 'rating' ? (idx + 1) + '/10' : '—');
      const prompt = q.prompt.replace(/[.\s]+$/, '');
      const path = categoryPath(q);
      const meta = catMeta(path[0]);
      return { qid: q.id, top: path[0], sub: path[1] || null, catId: meta.catId, hue: meta.hue, label: prompt + ' → ' + ansText, dateLabel: q.dateLabel };
    });
  }

  function myAnswer(q) {
    if (q.id in saved) return saved[q.id];
    // live mode: the demo's baked history is Mira's, not the user's —
    // only genuinely-answered questions may reach the map
    if (LIVE.enabled) return null;
    return q.bakedMine;            // baked past answer, or null
  }

  const api = {
    AUDIENCES, audience: (id) => AUDIENCES.find(a => a.id === id),
    questions: QUESTIONS,
    today: QUESTIONS[0],
    myAnswer,
    isAnswered: (q) => myAnswer(q) != null,
    answer(id, choice) {
      saved[id] = choice;
      try { localStorage.setItem(LS, JSON.stringify(saved)); } catch { /* best-effort */ }
      listeners.forEach(f => f());
    },
    unansweredCount() { return QUESTIONS.filter(q => myAnswer(q) == null).length; },
    // questions the user still hasn't answered, newest first
    unanswered() { return QUESTIONS.filter(q => myAnswer(q) == null); },
    // answered questions (incl. baked), newest first
    answered() { return QUESTIONS.filter(q => myAnswer(q) != null); },
    subscribe(f) { listeners.add(f); return () => listeners.delete(f); },

    // ── category / branch placement ──
    categoryPath, categoryCandidates, voteCategory, catMeta, answeredCategorized,
    EMERGENT_CATS, CAT_META,

    // ── derived helpers for views ──
    // headline stat for a question + audience
    headline(q, audId) {
      const d = q.dist[audId];
      if (q.type === 'rating') {
        const avg = d.reduce((a, p, i) => a + p * (i + 1), 0) / 100;
        return { big: avg.toFixed(1), unit: '/10', sub: 'average' };
      }
      if (q.type === 'scale') {
        const agree = d[3] + d[4];
        return { big: agree + '%', unit: '', sub: 'agree' };
      }
      // binary / choice → leading option
      let top = 0; for (let i = 1; i < d.length; i++) if (d[i] > d[top]) top = i;
      return { big: d[top] + '%', unit: '', sub: q.options[top] };
    },
    /**
     * The date to print beside an answer — and NULL once the answers are
     * real ones.
     *
     * `dateLabel` and `idx` come off this module's own demo calendar,
     * whose clock is the constant `TODAY` above: a fixed morning in May
     * 2026, with each question dated one day earlier than the last.
     * `liveSync` below fills in the user's REAL Firestore votes by prompt
     * match and touches neither field, so on a live build the Map's
     * answer card was captioning a vote cast this morning "Values · 27
     * May", and every date on the map sat in May 2026 or earlier.
     *
     * A synthetic date presented as the day you answered is the shape D1
     * refuses; absence is the honest reading until an answer carries its
     * own timestamp (the answers cache stores `[qid, value]` and no
     * `answeredAt`, so that is a cache-shape change, not a caption fix).
     * The kicker drops the separator with it.
     */
    dateOf(q) { return liveHydrated ? null : q.dateLabel; },
    /**
     * Whether `idx` still means "days ago". False once live, for the same
     * reason: in a live build it is the demo bank's fixed position, which
     * is not the order this account answered in.
     */
    datesAreReal() { return !liveHydrated; },
    // "you vs them" line; returns null if user hasn't answered
    youVsThem(q, audId) {
      const mine = myAnswer(q);
      if (mine == null) return null;
      const d = q.dist[audId];
      const audLabel = (api.audience(audId) || {}).label || 'them';
      if (q.type === 'scale' || q.type === 'rating') {
        const below = d.slice(0, mine).reduce((a, b) => a + b, 0);
        const above = d.slice(mine + 1).reduce((a, b) => a + b, 0);
        const axis = q.axis || 'further along';
        if (below >= above) return { pct: below, text: `more ${axis} than ${below}% of ${audLabel}` };
        return { pct: above, text: `less ${axis} than ${above}% of ${audLabel}` };
      }
      const same = d[mine];
      return { pct: same, text: `${same}% of ${audLabel} are with you` };
    },
  };
  DAILYQ = api;

  // ── live hydration (Phase 4b) ─────────────────────────────────────
  // The Map's constellation and the Mirror's daily record read this
  // store. In live mode: (1) the user's real Firestore answers hydrate
  // `saved` (prompt-matched — the seeded daily bank came from this very
  // pool, and option orders are identical), and (2) each question's
  // WORLD distribution is replaced with the real k-floored aggregate.
  // Other audiences keep their synthetic dists until they have real
  // data sources; `liveWorld` marks the swapped ones.
  // Set the first time live hydration actually runs. What it says is
  // narrow and exact: the answers on this store are now the account's own,
  // so the demo calendar's `dateLabel`/`idx` no longer describe them. Read
  // through `dateOf`/`datesAreReal` above rather than by a second
  // liveness read.
  let liveHydrated = false;

  function liveSync() {
    const L = LIVE;
    if (!L.enabled || !L.ready) return;
    liveHydrated = true;
    const votes = L.confirmedVotes() || {};
    const byPrompt = {};
    const demoPrompts = new Set(QUESTIONS.map((q) => q.prompt));
    L.dailyBank().forEach((b) => {
      byPrompt[b.prompt] = b;
      // The join key is prompt-string equality. A bank entry no demo
      // question matches means a content edit silently orphaned it —
      // its votes would stop feeding the Map. Loud beats silent.
      if (!demoPrompts.has(b.prompt)) {
        console.warn('[dailyq] bank entry has no demo twin (prompt drifted?):', b.id);
      }
    });
    let changed = false;
    QUESTIONS.forEach((q) => {
      const b = byPrompt[q.prompt];
      if (!b) return;
      const v = votes[b.id];
      if (v != null && !(q.id in saved)) { saved[q.id] = Number(v); changed = true; }
      const agg = L.aggFor(b.id);
      const size = (q.dist && q.dist.world && q.dist.world.length) || (q.options && q.options.length) || 0;
      if (agg && agg.counts && size) {
        const counts = []; let total = 0;
        for (let i = 0; i < size; i++) { const n = agg.counts[String(i)] || 0; counts.push(n); total += n; }
        if (total > 0) {
          // `sharePcts` (data/pct.ts), the one rounding rule. This was
          // floor-then-hand-the-leftovers-out-from-index-0, which gives
          // the points to whoever sorts first rather than to whoever has
          // the largest remainder — so the Mirror's World stop could name
          // an option FEWER people picked as the leader (its headline
          // reads d[top] straight off this array). Measured over 200k
          // random count vectors at four options, the expression this
          // replaces drew a smaller count at a larger percentage 2174
          // times and put the leader below the top percentage 979 times;
          // at five options, 5600 and 1842. sharePcts: 0 and 0.
          q.dist.world = sharePcts(counts); q.liveWorld = true; changed = true;
        }
      }
    });
    if (changed) {
      try { localStorage.setItem(LS, JSON.stringify(saved)); } catch { /* best-effort */ }
      listeners.forEach((f) => f());
    }
  }
  if (typeof window !== 'undefined' && window.addEventListener) {
    window.addEventListener('insight-live-update', liveSync);
    // The purge (data/live.ts, D51): both keys are already gone; drop the
    // in-memory answer and branch-override maps too, or the next answer()'s
    // save writes the previous account's daily answers back under the new
    // uid. liveSync above then re-fills from the NEW uid's confirmed votes
    // on the next live update — the same heal the feed's reconcile does.
    window.addEventListener('insight:local-purge', () => { saved = {}; savedCat = {}; listeners.forEach((f) => f()); });
  }
  liveSync();
})();

