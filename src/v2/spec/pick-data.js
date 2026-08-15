// Born in this repo (docs/CATALOG-QUESTIONS.md), not ported from a
// standalone — but it follows the spec layer's rules: cross-module
// references resolve through the shared global scope and spec-index.js
// load order is semantic (scripts/check-spec-globals.mjs guards the wiring).

// pick-data.js — the `pick` card's demo store + its feed questions.
// A favourite is one pick from a catalogue of ~1,025 (data/pokedex.ts);
// the reveal is a leaderboard, not a split: top entities above the floor,
// everyone else folded into one honest bucket. The real fold — ties at the
// boundary, complementary suppression — lives in functions/src/pure.ts
// where it is tested; this demo shows the same shape without re-implementing
// the disclosure math on synthetic numbers.
(function () {
  const LS = 'insight.picks.v1';
  let mine = {};
  try { mine = JSON.parse(localStorage.getItem(LS) || '{}'); } catch (e) { mine = {}; }
  const subs = new Set();

  // Mirrors the DESIGN value of AGG_MIN_N (functions/src/v2.ts) and the
  // top-N cap in docs/CATALOG-QUESTIONS.md. Deliberately NOT following
  // D81's launch pause (which drops the live floor to 1): this store is
  // the demo crowd, whose whole job is to demonstrate the floor's shape —
  // sub-floor entries folding into "everyone else" — and at a floor of 1
  // there would be nothing to demonstrate.
  const AGG_MIN_N = 5;
  const TOP_N = 10;

  // Baked demo crowd PER QUESTION (keyed by qid, not domain: two questions
  // over the same catalogue are different questions and must not share a
  // reveal), entity → count, so the board is full from day one (the
  // place-stats precedent). Sub-floor entries are here ON PURPOSE: the
  // reveal has to demonstrate the floor's honesty, not dodge it. Key '0' is
  // the "Not listed" bucket — published as a count inside "everyone else",
  // never enumerated.
  const CROWD = {
    pk01: {
      25: 41,  // Pikachu
      6: 38,   // Charizard
      448: 29, // Lucario
      133: 26, // Eevee
      94: 24,  // Gengar
      7: 19,   // Squirtle
      1: 17,   // Bulbasaur
      143: 12, // Snorlax
      778: 9,  // Mimikyu
      658: 7,  // Greninja
      197: 6,  // Umbreon — clears the floor but not the top 10; folds
      359: 5,  // Absol — same
      4: 3,    // Charmander — below the floor
      258: 2,  // Mudkip — below the floor
      0: 4,    // Not listed
    },
    // daily catalog-question run, 2026-07-30 (docs/QUESTION-FARM.md § the
    // daily catalog-question run)
    pk02: {
      94: 34,  // Gengar
      778: 26, // Mimikyu
      491: 18, // Darkrai
      487: 15, // Giratina
      354: 9,  // Banette
      93: 8,   // Haunter
      442: 7,  // Spiritomb
      356: 6,  // Dusclops
      425: 5,  // Drifloon
      635: 5,  // Hydreigon
      200: 3,  // Misdreavus — below the floor
      92: 2,   // Gastly — below the floor
      0: 6,    // Not listed
    },
    // daily catalog-question run, 2026-07-31
    pk03: {
      133: 31, // Eevee
      175: 24, // Togepi
      39: 21,  // Jigglypuff
      25: 17,  // Pikachu — cute AND everyone's favourite; overlap is honest
      393: 14, // Piplup
      258: 11, // Mudkip
      300: 8,  // Skitty
      417: 7,  // Pachirisu
      173: 6,  // Cleffa
      172: 6,  // Pichu
      431: 4,  // Glameow — below the floor
      427: 3,  // Buneary — below the floor
      0: 5,    // Not listed
    },
    // first card of the emoji domain, 2026-07-31 (keys are Unicode
    // codepoints — data/catalogs.ts, build-emoji.mjs)
    pk04: {
      128514: 43, // 😂 face with tears of joy
      10084: 31,  // ❤️ red heart
      128557: 27, // 😭 loudly crying face
      128293: 22, // 🔥 fire
      129315: 18, // 🤣 rolling on the floor laughing
      128525: 14, // 😍 smiling face with heart-eyes
      128128: 12, // 💀 skull
      128077: 10, // 👍 thumbs up
      10024: 8,   // ✨ sparkles
      128591: 7,  // 🙏 folded hands
      129401: 6,  // 🥹 face holding back tears — clears the floor, folds
      128522: 5,  // 😊 smiling face with smiling eyes — same
      127881: 4,  // 🎉 party popper — below the floor
      128173: 2,  // 💭 thought balloon — below the floor
      0: 9,       // Not listed — the ZWJ-combo and flag devotees
    },
    // daily catalog-question run, 2026-08-01 — annoyance is its own canon:
    // pk04 ranks what people SEND, this ranks what they roll their eyes
    // at RECEIVING, and the boards disagree from the top down (😂 sits
    // high on both, which is honest — beloved and resented at once).
    pk05: {
      128580: 37, // 🙄 face with rolling eyes
      128514: 29, // 😂 tears of joy — the backlash vote
      128077: 25, // 👍 thumbs up — the passive-aggressive reply
      128169: 21, // 💩 pile of poo
      129313: 17, // 🤡 clown face
      128579: 13, // 🙃 upside-down face
      128175: 11, // 💯 hundred points
      128536: 8,  // 😘 face blowing a kiss
      128521: 7,  // 😉 winking face
      129392: 6,  // 🥰 smiling face with hearts
      10024: 5,   // ✨ sparkles — clears the floor but not the top 10; folds
      129315: 5,  // 🤣 rolling on the floor laughing — same
      128556: 3,  // 😬 grimacing face — below the floor
      129760: 2,  // 🫠 melting face — below the floor
      0: 8,       // Not listed
    },
    // daily catalog-question run, 2026-08-02 — power is the fourth pokemon
    // canon: favouritism ranks mascots, fear ranks ghosts, cuteness ranks
    // the small and round; strength ranks the box legendaries, with
    // Charizard as the honest fan-vote overlap (a favourite people also
    // insist is strong).
    pk06: {
      150: 39, // Mewtwo
      493: 33, // Arceus
      384: 28, // Rayquaza
      890: 14, // Eternatus
      6: 12,   // Charizard — the fan vote
      383: 10, // Groudon
      382: 9,  // Kyogre
      487: 8,  // Giratina
      888: 7,  // Zacian
      149: 6,  // Dragonite — takes the last slot on the entity tie-break
      483: 6,  // Dialga — same count, higher dex; folds
      448: 5,  // Lucario — clears the floor but not the top 10; folds
      445: 3,  // Garchomp — below the floor
      248: 2,  // Tyranitar — below the floor
      0: 7,    // Not listed
    },
    // daily catalog-question run, 2026-08-03 — identity, the fifth pokemon
    // canon: not what you love (pk01) or fear (pk02) but who you ARE.
    // Snorlax and Psyduck lead a board favouritism never produces —
    // self-image runs on naps and mild panic, not on mascots.
    pk07: {
      143: 34, // Snorlax — the nap vote
      54: 27,  // Psyduck — the quietly overwhelmed vote
      133: 24, // Eevee — undecided, all potential
      129: 19, // Magikarp — late bloomer, cope pending
      132: 15, // Ditto — fits in anywhere
      79: 12,  // Slowpoke — gets there eventually
      94: 10,  // Gengar — the menace self-image
      25: 8,   // Pikachu — main-character energy
      6: 7,    // Charizard
      39: 6,   // Jigglypuff — sings anyway
      448: 5,  // Lucario — clears the floor but not the top 10; folds
      202: 5,  // Wobbuffet — same
      7: 3,    // Squirtle — below the floor
      4: 2,    // Charmander — below the floor
      0: 8,    // Not listed
    },
    // daily catalog-question run, 2026-08-04 — permanence, the third emoji
    // canon: pk04 ranks what you send daily, pk05 what you wince at;
    // this ranks what you would carry in ink for good. Commitment
    // produces a symbol board — hearts, moons, butterflies — not the
    // reaction board usage produces.
    pk08: {
      10084: 33,  // ❤️ red heart — the classic for a reason
      129419: 28, // 🦋 butterfly — yes, it is a cliché; clichés chart
      127769: 24, // 🌙 crescent moon
      128293: 18, // 🔥 fire
      127754: 15, // 🌊 water wave
      10024: 12,  // ✨ sparkles
      128013: 10, // 🐍 snake
      127801: 9,  // 🌹 rose
      9889: 7,    // ⚡ high voltage
      9854: 6,    // ♾️ infinity
      11088: 5,   // ⭐ star — clears the floor but not the top 10; folds
      128128: 5,  // 💀 skull — same
      128330: 3,  // 🕊️ dove — below the floor
      129535: 2,  // 🧿 nazar amulet — below the floor
      0: 9,       // Not listed
    },
    // daily catalog-question run, 2026-08-05 — wordcraft, the sixth pokemon
    // canon: not the creature, the NAME. Wobbuffet and Bidoof lead a board
    // no other canon produces — nobody calls Bidoof strong, scary or cute,
    // but the word is a small masterpiece and people know it.
    pk09: {
      202: 31, // Wobbuffet — a name you can hear
      399: 27, // Bidoof — the people's champion
      122: 22, // Mr. Mime — unsettling AND formal
      39: 18,  // Jigglypuff — onomatopoeia with a career
      103: 14, // Exeggutor — the pun that got away with it
      272: 12, // Ludicolo
      707: 9,  // Klefki — it is a key ring and it OWNS that
      143: 8,  // Snorlax
      54: 7,   // Psyduck
      129: 6,  // Magikarp
      25: 5,   // Pikachu — clears the floor but not the top 10; folds
      771: 5,  // Pyukumuku — same, tragically
      587: 3,  // Emolga — below the floor
      869: 2,  // Alcremie — below the floor
      0: 8,    // Not listed
    },
    // daily catalog-question run, 2026-08-06 — dread, the fourth emoji
    // canon (the pokemon fear canon's echo, pk02): what unsettles, not
    // what you send. The clown leads for the same reason it leads
    // everywhere; the ghost, defanged by a decade of cute usage, clears
    // the floor and folds — which is itself the honest finding.
    pk10: {
      129313: 32, // 🤡 clown face — coulrophobia has a constituency
      128520: 24, // 😈 smiling face with horns
      128121: 19, // 👹 ogre
      128122: 16, // 👺 goblin
      128375: 14, // 🕷️ spider
      128065: 12, // 👁️ eye — the lone eye is worse than the pair
      128128: 10, // 💀 skull
      128298: 9,  // 🔪 kitchen knife
      129656: 7,  // 🩸 drop of blood
      127875: 6,  // 🎃 jack-o-lantern
      128123: 5,  // 👻 ghost — clears the floor but not the top 10; folds
      128561: 5,  // 😱 face screaming in fear — same
      129415: 3,  // 🦇 bat — below the floor
      128013: 2,  // 🐍 snake — below the floor
      0: 8,       // Not listed
    },
    // first card of the elements domain, 2026-08-11 (keys are atomic
    // numbers — data/elements.ts, build-elements.mjs). The favourite-class
    // opener, per the domain precedent (pk01, pk04): gold for the classic,
    // carbon for the life vote, uranium for the edgy one.
    pk11: {
      79: 31, // Gold (Au) — the classic
      6: 26,  // Carbon (C) — the life vote
      8: 21,  // Oxygen (O) — the dependency vote
      26: 17, // Iron (Fe) — star-forged
      2: 14,  // Helium (He) — balloons and squeaky voices
      10: 12, // Neon (Ne) — the aesthetic vote
      92: 10, // Uranium (U) — the edgy vote
      47: 8,  // Silver (Ag)
      22: 7,  // Titanium (Ti)
      1: 6,   // Hydrogen (H) — three quarters of everything
      80: 5,  // Mercury (Hg) — clears the floor but not the top 10; folds
      3: 5,   // Lithium (Li) — same
      78: 3,  // Platinum (Pt) — below the floor
      54: 2,  // Xenon (Xe) — below the floor
      0: 8,   // Not listed
    },
    // daily catalog-question run, 2026-08-12 — identity, the elements
    // turn (the pk07 canon crossing domains the way "favourite" does).
    // Chemistry writes the punchlines itself: argon for doing nothing,
    // nobly; mercury for mercurial; the periodic table has been a
    // personality test since it was laid out.
    pk12: {
      18: 29, // Argon (Ar) — inert, and at peace with it
      80: 24, // Mercury (Hg) — the word for it comes from the element
      26: 21, // Iron (Fe) — dependable under load
      2: 17,  // Helium (He) — lighter than the room, leaves early
      6: 14,  // Carbon (C) — in everything, somehow
      11: 12, // Sodium (Na) — reacts to water, dramatically
      10: 10, // Neon (Ne) — only glows when charged
      8: 8,   // Oxygen (O) — everyone's dependency
      74: 7,  // Tungsten (W) — will not move
      79: 6,  // Gold (Au) — knows their worth
      14: 5,  // Silicon (Si) — clears the floor but not the top 10; folds
      92: 5,  // Uranium (U) — same, unstable
      34: 3,  // Selenium (Se) — below the floor
      53: 2,  // Iodine (I) — below the floor
      0: 8,   // Not listed
    },
    // daily catalog-question run, 2026-08-13 — wordcraft, the elements
    // turn (pk09's canon crossing domains): the name, not the atom.
    // Molybdenum is a mouth-feel masterpiece, Praseodymium a keyboard
    // dare, and four elements are named after one Swedish village —
    // Ytterbium carries that flag here.
    pk13: {
      42: 28, // Molybdenum (Mo) — say it out loud, you'll vote for it
      59: 22, // Praseodymium (Pr)
      83: 19, // Bismuth (Bi)
      51: 16, // Antimony (Sb) — sounds like a betrayal
      40: 13, // Zirconium (Zr)
      70: 11, // Ytterbium (Yb) — one village, four elements
      80: 10, // Mercury (Hg) — a god, a planet, and the letters match nothing
      36: 9,  // Krypton (Kr) — the Superman vote
      22: 8,  // Titanium (Ti)
      10: 7,  // Neon (Ne) — new, said in Greek, forever
      74: 5,  // Tungsten (W) — "heavy stone"; clears the floor, folds
      33: 5,  // Arsenic (As) — same
      64: 3,  // Gadolinium (Gd) — below the floor
      41: 2,  // Niobium (Nb) — below the floor
      0: 8,   // Not listed
    },
    // daily catalog-question run, 2026-08-14 — dread, the elements turn
    // (pk02/pk10's canon reaching its third domain): danger, not
    // affection. Chemistry's villains are a different cast from its
    // mascots — favouritism's board (gold, carbon, neon) shares nothing
    // with this one, and history supplies every vote.
    pk14: {
      94: 27, // Plutonium (Pu) — named for the underworld, used accordingly
      80: 23, // Mercury (Hg) — beautiful, liquid, patient
      33: 19, // Arsenic (As) — a whole genre of crime fiction runs on it
      92: 16, // Uranium (U) — the famous one
      84: 13, // Polonium (Po) — the cup of tea that made the news
      9: 11,  // Fluorine (F) — the chemists' vote; reacts with nearly everything
      17: 9,  // Chlorine (Cl) — the one that has been a weapon
      82: 8,  // Lead (Pb) — slow, and everywhere
      88: 7,  // Radium (Ra) — the watch-dial girls
      55: 6,  // Cesium (Cs) — explodes on contact with water
      81: 5,  // Thallium (Tl) — "the poisoner's poison"; clears the floor, folds
      48: 5,  // Cadmium (Cd) — same
      4: 3,   // Beryllium (Be) — the quiet one chemists respect; below the floor
      87: 2,  // Francium (Fr) — too rare to ever hurt anyone; below the floor
      0: 8,   // Not listed
    },
    // daily catalog-question run, 2026-08-15 — confusion, the fifth emoji
    // canon: not what you send (pk04), resent (pk05), would ink (pk08)
    // or fear (pk10), but what nobody can agree on the MEANING of.
    // Unicode named half this board something no sender intends, and
    // the folded hands have been starting arguments since 2010.
    pk15: {
      128591: 31, // 🙏 folded hands — a prayer, or a high five
      128579: 24, // 🙃 upside-down face — fine, or not fine at all
      128128: 20, // 💀 skull — dead, or dead laughing
      128548: 16, // 😤 face with steam from nose — named triumph, read fury
      129394: 13, // 🥲 smiling face with tear — happy-sad, grateful, coping
      128554: 11, // 😪 sleepy face — the bubble is snot, not a tear
      129305: 9,  // 🤙 call me hand — shaka, phone, or hang loose
      128133: 8,  // 💅 nail polish — grooming, or devastating indifference
      10024: 7,   // ✨ sparkles — emphasis, magic, or sarcasm
      128557: 6,  // 😭 loudly crying face — despair or delight
      128175: 5,  // 💯 hundred points — clears the floor but not the top 10; folds
      127814: 5,  // 🍆 eggplant — misunderstood on purpose; same
      129760: 3,  // 🫠 melting face — below the floor
      128558: 2,  // 😮 face with open mouth — below the floor
      0: 9,       // Not listed
    },
  };

  // Baked demo segment slices, per question: how each cohort orders the
  // global board (D17 — segments only ever reorder the published top,
  // never surface their own long tail). Small per-entity counts inside a
  // ≥floor cohort are publishable on purpose: "one of these fourteen
  // picked Gengar" names nobody (the D8 k-argument). Real slices come
  // from anchors folded at answer time; the demo can't know your cohort,
  // so your own pick joins the global board only.
  const BY = {
    pk01: {
      ageBand: {
        '18-24': { 448: 14, 25: 8, 778: 6, 6: 6, 133: 5, 658: 5, 94: 4 },
        '25-34': { 25: 15, 6: 13, 94: 10, 448: 9, 133: 8, 7: 6, 143: 6, 1: 5 },
        '45+': { 25: 12, 6: 11, 1: 9, 7: 8, 133: 6, 143: 5 },
      },
      gender: {
        Women: { 25: 14, 133: 12, 94: 9, 6: 9, 448: 7, 778: 6 },
        Men: { 6: 21, 25: 16, 448: 15, 7: 9, 94: 8, 1: 8, 143: 7 },
      },
    },
    pk02: {
      ageBand: {
        '18-24': { 778: 12, 94: 9, 491: 7, 354: 4, 425: 3 },
        '25-34': { 94: 14, 778: 9, 491: 8, 487: 7, 354: 3 },
      },
      gender: {
        Women: { 778: 14, 94: 10, 354: 5, 425: 4 },
        Men: { 94: 18, 778: 10, 491: 9, 487: 8, 635: 4 },
      },
    },
    pk03: {
      ageBand: {
        '18-24': { 175: 9, 133: 8, 39: 6, 393: 6, 258: 5 },
        '25-34': { 133: 12, 39: 8, 175: 7, 25: 7, 300: 4 },
      },
      gender: {
        Women: { 133: 11, 175: 9, 39: 8, 300: 5, 173: 4 },
        Men: { 133: 9, 258: 8, 25: 7, 393: 6, 172: 4 },
      },
    },
    pk04: {
      ageBand: {
        '18-24': { 128557: 11, 128128: 9, 128514: 8, 129401: 5, 10024: 4 },
        '25-34': { 128514: 15, 10084: 9, 129315: 8, 128293: 7, 128077: 4 },
      },
      gender: {
        Women: { 10084: 12, 128557: 10, 129401: 6, 10024: 6, 128525: 5 },
        Men: { 128514: 16, 129315: 9, 128293: 8, 128128: 7, 128077: 6 },
      },
    },
    pk05: {
      ageBand: {
        // the 😂 backlash is a young-cohort phenomenon; older cohorts
        // resent the passive-aggressive 👍 more
        '18-24': { 128514: 12, 128077: 9, 128580: 7, 129313: 6, 128175: 4 },
        '25-34': { 128580: 11, 128514: 8, 128169: 7, 128077: 6, 128579: 5 },
      },
      gender: {
        Women: { 128580: 13, 128077: 8, 128514: 7, 128536: 6, 128521: 5 },
        Men: { 128514: 10, 128580: 9, 129313: 9, 128169: 8, 128175: 5 },
      },
    },
    pk06: {
      ageBand: {
        // younger cohorts reach for the newest box legendaries; the
        // older ones hold the Kanto line
        '18-24': { 384: 9, 150: 8, 493: 7, 890: 6, 888: 5 },
        '25-34': { 150: 13, 493: 10, 384: 8, 6: 6, 382: 4 },
      },
      gender: {
        Women: { 150: 9, 493: 8, 384: 6, 6: 5, 487: 4 },
        Men: { 150: 14, 384: 10, 493: 9, 383: 6, 149: 4 },
      },
    },
    pk07: {
      ageBand: {
        // the overwhelmed-Psyduck and Magikarp-cope votes skew young;
        // the settled Snorlax vote grows with age
        '18-24': { 54: 10, 129: 8, 143: 7, 94: 6, 133: 5 },
        '25-34': { 143: 12, 54: 8, 133: 7, 132: 5, 79: 5 },
      },
      gender: {
        Women: { 133: 9, 143: 8, 54: 7, 39: 5, 129: 5 },
        Men: { 143: 11, 94: 7, 129: 7, 6: 6, 25: 5 },
      },
    },
    pk08: {
      ageBand: {
        // butterflies and moons skew young; the plain heart holds with age
        '18-24': { 129419: 9, 127769: 8, 128013: 6, 10084: 5, 128293: 5 },
        '25-34': { 10084: 11, 129419: 8, 127754: 6, 10024: 5, 9854: 4 },
      },
      gender: {
        Women: { 129419: 12, 127769: 9, 10084: 8, 127801: 5, 10024: 5 },
        Men: { 10084: 9, 128293: 8, 128013: 7, 9889: 5, 127754: 5 },
      },
    },
    pk09: {
      ageBand: {
        // Bidoof is a young internet's in-joke; Mr. Mime lands with the
        // cohort that grew up unsettled by him
        '18-24': { 399: 9, 202: 7, 707: 6, 129: 5, 272: 4 },
        '25-34': { 202: 10, 122: 8, 399: 7, 103: 5, 39: 5 },
      },
      gender: {
        Women: { 39: 8, 202: 7, 399: 6, 272: 5, 54: 4 },
        Men: { 202: 11, 399: 8, 122: 7, 103: 6, 129: 5 },
      },
    },
    pk10: {
      ageBand: {
        // the lone-eye and blood votes skew young; the classic monsters
        // hold with age
        '18-24': { 129313: 10, 128520: 7, 128065: 6, 128128: 5, 129656: 4 },
        '25-34': { 129313: 9, 128121: 7, 128375: 6, 128520: 5, 128298: 5 },
      },
      gender: {
        Women: { 128375: 9, 129313: 8, 128298: 6, 128065: 5, 129656: 4 },
        Men: { 129313: 11, 128520: 8, 128122: 6, 128121: 6, 128128: 5 },
      },
    },
    pk11: {
      ageBand: {
        // neon and uranium skew young; gold and carbon hold everywhere
        '18-24': { 10: 8, 92: 7, 79: 6, 6: 5, 2: 5 },
        '25-34': { 79: 9, 6: 8, 8: 6, 26: 5, 22: 4 },
      },
      gender: {
        Women: { 79: 8, 10: 7, 47: 6, 8: 5, 6: 5 },
        Men: { 26: 8, 6: 7, 92: 7, 79: 6, 22: 5 },
      },
    },
    pk12: {
      ageBand: {
        // sodium and mercury skew young; the settled argon-and-iron
        // self-image grows with age — the pk07 Snorlax curve again
        '18-24': { 80: 9, 11: 7, 10: 6, 18: 6, 2: 5 },
        '25-34': { 18: 10, 26: 8, 80: 6, 6: 6, 8: 5 },
      },
      gender: {
        Women: { 2: 8, 80: 7, 10: 6, 8: 6, 18: 5 },
        Men: { 18: 11, 26: 8, 74: 6, 6: 6, 11: 5 },
      },
    },
    pk13: {
      ageBand: {
        // Krypton and Bismuth are internet-native votes; the Latinate
        // tongue-twisters hold with age
        '18-24': { 36: 8, 83: 7, 42: 6, 10: 5, 80: 4 },
        '25-34': { 42: 9, 59: 7, 51: 6, 83: 5, 70: 4 },
      },
      gender: {
        Women: { 83: 8, 42: 7, 10: 6, 59: 5, 80: 5 },
        Men: { 42: 10, 36: 7, 51: 6, 22: 5, 59: 5 },
      },
    },
    pk14: {
      ageBand: {
        // the fissile votes are internet-native; the slow historical
        // poisons — mercury, arsenic, lead — hold with age
        '18-24': { 94: 9, 92: 7, 84: 6, 9: 5, 33: 4 },
        '25-34': { 94: 8, 80: 7, 33: 6, 84: 5, 17: 4 },
      },
      gender: {
        Women: { 33: 8, 80: 7, 84: 6, 94: 5, 88: 4 },
        Men: { 94: 10, 92: 8, 9: 6, 80: 5, 17: 5 },
      },
    },
    pk15: {
      ageBand: {
        // the ironic readings — skull, upside-down, nail polish — are
        // youngest where they were coined; the folded-hands argument
        // belongs to everyone who has ever received one from a parent
        '18-24': { 128128: 9, 128579: 7, 129394: 6, 128133: 5, 128591: 4 },
        '25-34': { 128591: 8, 128579: 7, 128548: 6, 128554: 5, 10024: 4 },
      },
      gender: {
        Women: { 128579: 8, 128591: 7, 129394: 6, 10024: 5, 128133: 5 },
        Men: { 128591: 9, 129305: 7, 128128: 6, 128548: 6, 128557: 5 },
      },
    },
  };

  const api = {
    AGG_MIN_N,
    TOP_N,
    my(qid) { const v = mine[qid]; return v == null ? null : v; },
    pick(qid, entity) {
      mine[qid] = entity;
      try { localStorage.setItem(LS, JSON.stringify(mine)); } catch { /* best-effort: private mode, quota */ }
      subs.forEach((f) => f());
    },
    // The published view: top entities above the floor plus the fold. Your
    // own pick joins the counts at read time (the wfPcts convention) — it
    // is your own answer, so no floor applies to your seeing it.
    canon(qid) {
      const counts = { ...(CROWD[qid] || {}) };
      const v = qid != null ? api.my(qid) : null;
      if (v != null) counts[v] = (counts[v] || 0) + 1;
      let total = 0;
      for (const k of Object.keys(counts)) total += counts[k];
      const top = Object.keys(counts)
        .filter((k) => k !== '0')
        .map((k) => ({ entity: Number(k), count: counts[k] }))
        .sort((a, b) => b.count - a.count || a.entity - b.entity)
        .filter((r) => r.count >= AGG_MIN_N)
        .slice(0, TOP_N);
      const shown = top.reduce((a, r) => a + r.count, 0);
      // The fold's two honest scalars: how many distinct entries it covers
      // (excluding "Not listed", which is votes rather than an entry) and
      // whether every one of them still sits below the floor. Aggregate
      // properties of the tail, never an enumeration — the UI additionally
      // renders the entity count only when the fold covers at least two
      // entries and stepped down, the same subtraction-leak and
      // delta-disclosure rules the published counts already keep
      // (docs/CATALOG-QUESTIONS.md § the reveal).
      const folded = Object.keys(counts)
        .filter((k) => k !== '0' && !top.some((r) => String(r.entity) === k));
      return {
        top, rest: total - shown, total,
        restEntities: folded.length,
        restBelowFloor: folded.every((k) => counts[k] < AGG_MIN_N),
      };
    },
    // The segment chips a question can offer — flattened from its BY data,
    // in the data's own order. Empty when a question ships no slices.
    segs(qid) {
      const by = BY[qid];
      if (!by) return [];
      const out = [];
      for (const dim of Object.keys(by)) {
        for (const bucket of Object.keys(by[dim])) out.push({ dim, bucket });
      }
      return out;
    },
    // One segment's ordering of the global board: rows sorted by the
    // cohort's own counts, plus the cohort size for the "as N of them see
    // it" line. Null when the question has no slice for that segment.
    canonSeg(qid, dim, bucket) {
      const cell = BY[qid] && BY[qid][dim] && BY[qid][dim][bucket];
      if (!cell) return null;
      const rows = Object.keys(cell)
        .map((k) => ({ entity: Number(k), count: cell[k] }))
        .sort((a, b) => b.count - a.count || a.entity - b.entity);
      return { rows, cohort: rows.reduce((a, r) => a + r.count, 0) };
    },
    subscribe(f) { subs.add(f); return () => subs.delete(f); },
  };
  // The purge (data/live.ts, D51): drop your picks too, or the next
  // pick()'s save writes the previous account's back under the new uid.
  // Notify without re-creating the purged key.
  window.addEventListener('insight:local-purge', () => { mine = {}; subs.forEach((f) => f()); });
  window.PICKS = api;

  // the feed questions — one per COMMITTED catalogue. Films/artists cards
  // land here the day scripts/build-catalog.mjs output is committed (an
  // operator step, D15) — a card whose catalogue is absent would open
  // straight into the picker's error state, which is worse than no card.
  //
  // cat 'fav', all of them: the v15 revision makes catalogue picks a FORMAT
  // with a channel of their own (world-feed-data.js), replacing this repo's
  // earlier 'games' channel — same guarantee (a pick card is never
  // invisible-by-default), one home instead of a per-subject scatter.
  window.PICK_QS = [
    { id: 'pk01', cat: 'fav', type: 'pick', domain: 'pokemon', prompt: 'Favourite Pokémon?', n: 242 },
    // 2026-07-30 daily run: a different canon, not a rephrase — fear
    // ranks ghosts; favouritism ranks starters and mascots.
    { id: 'pk02', cat: 'fav', type: 'pick', domain: 'pokemon', prompt: 'The scariest Pokémon?', n: 144 },
    // 2026-07-31 daily run: cuteness ranks the small and round — a third
    // canon next to favouritism and fear.
    { id: 'pk03', cat: 'fav', type: 'pick', domain: 'pokemon', prompt: 'The cutest Pokémon?', n: 157 },
    // 2026-07-31, first card of the emoji domain — "most-used" beats
    // "favourite" here: it is the question people actually answer about
    // emoji, and their keyboard already knows.
    { id: 'pk04', cat: 'fav', type: 'pick', domain: 'emoji', prompt: 'Your most-used emoji?', n: 218 },
    // 2026-08-01 daily run: annoyance, not usage — what you send (pk04)
    // and what makes you wince are different questions with different
    // winners.
    { id: 'pk05', cat: 'fav', type: 'pick', domain: 'emoji', prompt: 'The most annoying emoji?', n: 197 },
    // 2026-08-02 daily run: strength, the fourth pokemon canon — a
    // legendary board, not the mascot board favouritism produces.
    { id: 'pk06', cat: 'fav', type: 'pick', domain: 'pokemon', prompt: 'The strongest Pokémon?', n: 189 },
    // 2026-08-03 daily run: identity — who you are, not what you love.
    // Warmer and stranger than a fifth ranking of the same mascots.
    { id: 'pk07', cat: 'fav', type: 'pick', domain: 'pokemon', prompt: 'The Pokémon you’d be?', n: 185 },
    // 2026-08-04 daily run: permanence — what you send (pk04) and what
    // you resent (pk05) change weekly; what you'd wear for good is a
    // different question with a different, symbol-heavy board.
    { id: 'pk08', cat: 'fav', type: 'pick', domain: 'emoji', prompt: 'The emoji you’d tattoo?', n: 186 },
    // 2026-08-05 daily run: the name, not the creature — a wordcraft
    // canon whose board no appraisal question produces.
    { id: 'pk09', cat: 'fav', type: 'pick', domain: 'pokemon', prompt: 'The best Pokémon name?', n: 177 },
    // 2026-08-06 daily run: dread — the fear canon that worked for
    // pokemon (pk02), asked of a catalogue where cute usage has
    // defanged the obvious answers.
    { id: 'pk10', cat: 'fav', type: 'pick', domain: 'emoji', prompt: 'The scariest emoji?', n: 172 },
    // 2026-08-11, first card of the elements domain — the favourite-class
    // opener every domain gets; the canons diverge from here.
    { id: 'pk11', cat: 'fav', type: 'pick', domain: 'elements', prompt: 'Your favourite element?', n: 175 },
    // 2026-08-12 daily run: identity — the canon that crosses domains
    // the way favouritism does; chemistry supplies the self-images.
    { id: 'pk12', cat: 'fav', type: 'pick', domain: 'elements', prompt: 'The element you’d be?', n: 171 },
    // 2026-08-13 daily run: wordcraft — the name, not the atom; the
    // canon pk09 proved, crossing domains like identity did.
    { id: 'pk13', cat: 'fav', type: 'pick', domain: 'elements', prompt: 'The best-named element?', n: 166 },
    // 2026-08-14 daily run: dread — the fear canon's third domain (pk02,
    // pk10). Danger ranks the poisons and the fissile, a cast no
    // affection or identity question ever surfaces.
    { id: 'pk14', cat: 'fav', type: 'pick', domain: 'elements', prompt: 'The most dangerous element?', n: 162 },
    // 2026-08-15 daily run: confusion — the fifth emoji canon. Meaning,
    // not feeling: usage, annoyance, permanence and fear all assume the
    // symbol is understood; this board exists because half of them aren't.
    { id: 'pk15', cat: 'fav', type: 'pick', domain: 'emoji', prompt: 'The most misunderstood emoji?', n: 169 },
  ];
})();
