// GENERATED from src/v2/spec/archetype-data.js and
// src/v2/spec/test-definitions.js by scripts/gen-traits.mjs — do not
// hand-edit. Regenerate with `npm run build:traits`; `npm run
// check:traits` compares this file byte-for-byte against what those two
// modules generate, on the deploy path, so a hand edit here (or a client
// change without a regen) fails the gate.
//
// The trait cube's vocabulary and arithmetic (D330). The nightly
// foldTraitsV2 types each person exactly the way the app does, and these
// are the numbers that make that true — the same signatures the result
// card matches on, the same baselines the matcher centres on, the same
// magnitude thresholds the sold report bands by (D254).
//
// LABELS ARE NOT HERE ON PURPOSE. A bucket key is an archetype's NAME
// (which is its identity) or a band INDEX b0..b4; every word a person
// reads is drawn client-side from the client's own source. So a copy edit
// is never a data migration, and the two sides cannot disagree about a
// word they do not share.

/** The four instruments, persisted keys, in the order the sheet shows. */
export const TRAIT_KINDS = ["big5","political","values","attachment"] as const;
export type TraitKind = (typeof TRAIT_KINDS)[number];

/** Every dim always yields a bucket; absence yields this one, so each
 *  dim's buckets sum to the question's own total and the sheet's header
 *  bar is the published census rather than a second denominator. */
export const UNTESTED = "untested";

/** One archetype: the bucket key is `name`, verbatim. */
export interface ArchSig {
  name: string;
  share: number;
  sig: Record<string, number>;
}

/** IS_ARCHETYPES, signatures only. */
export const TRAIT_ARCH: Record<TraitKind, ArchSig[]> = {
  "big5": [
    {
      "name": "The Enthusiast",
      "share": 6,
      "sig": {
        "O": 88,
        "C": 40,
        "E": 75,
        "A": 55,
        "N": 45
      }
    },
    {
      "name": "The Planner",
      "share": 5,
      "sig": {
        "O": 80,
        "C": 90,
        "E": 32,
        "A": 42,
        "N": 35
      }
    },
    {
      "name": "The Diplomat",
      "share": 7,
      "sig": {
        "O": 82,
        "C": 55,
        "E": 50,
        "A": 82,
        "N": 42
      }
    },
    {
      "name": "The Dependable",
      "share": 12,
      "sig": {
        "O": 42,
        "C": 85,
        "E": 42,
        "A": 80,
        "N": 28
      }
    },
    {
      "name": "The Live Wire",
      "share": 8,
      "sig": {
        "O": 60,
        "C": 32,
        "E": 90,
        "A": 58,
        "N": 45
      }
    },
    {
      "name": "The Host",
      "share": 10,
      "sig": {
        "O": 52,
        "C": 62,
        "E": 85,
        "A": 85,
        "N": 35
      }
    },
    {
      "name": "The Lookout",
      "share": 9,
      "sig": {
        "O": 32,
        "C": 80,
        "E": 42,
        "A": 52,
        "N": 70
      }
    },
    {
      "name": "The Drifter",
      "share": 6,
      "sig": {
        "O": 85,
        "C": 22,
        "E": 62,
        "A": 62,
        "N": 50
      }
    },
    {
      "name": "The Reader",
      "share": 8,
      "sig": {
        "O": 60,
        "C": 48,
        "E": 42,
        "A": 90,
        "N": 65
      }
    },
    {
      "name": "The Plain Speaker",
      "share": 9,
      "sig": {
        "O": 45,
        "C": 62,
        "E": 62,
        "A": 22,
        "N": 32
      }
    },
    {
      "name": "The Quiet One",
      "share": 11,
      "sig": {
        "O": 72,
        "C": 55,
        "E": 15,
        "A": 58,
        "N": 50
      }
    },
    {
      "name": "The Sensitive",
      "share": 6,
      "sig": {
        "O": 62,
        "C": 50,
        "E": 25,
        "A": 65,
        "N": 78
      }
    },
    {
      "name": "The Hothead",
      "share": 3,
      "sig": {
        "O": 58,
        "C": 35,
        "E": 75,
        "A": 42,
        "N": 85
      }
    }
  ],
  "political": [
    {
      "name": "Solidarity Left",
      "share": 7,
      "sig": {
        "econ": 15,
        "auth": 35,
        "foreign": 55,
        "env": 70,
        "tech": 45,
        "estab": 65
      }
    },
    {
      "name": "Green Left",
      "share": 4,
      "sig": {
        "econ": 35,
        "auth": 25,
        "foreign": 70,
        "env": 85,
        "tech": 60,
        "estab": 55
      }
    },
    {
      "name": "Social Democrat",
      "share": 16,
      "sig": {
        "econ": 32,
        "auth": 48,
        "foreign": 55,
        "env": 65,
        "tech": 55,
        "estab": 30
      }
    },
    {
      "name": "Liberal Centrist",
      "share": 18,
      "sig": {
        "econ": 50,
        "auth": 40,
        "foreign": 60,
        "env": 60,
        "tech": 65,
        "estab": 25
      }
    },
    {
      "name": "Techno-Optimist",
      "share": 3,
      "sig": {
        "econ": 55,
        "auth": 30,
        "foreign": 70,
        "env": 55,
        "tech": 90,
        "estab": 50
      }
    },
    {
      "name": "Libertarian",
      "share": 5,
      "sig": {
        "econ": 78,
        "auth": 12,
        "foreign": 55,
        "env": 40,
        "tech": 80,
        "estab": 70
      }
    },
    {
      "name": "Market Liberal",
      "share": 12,
      "sig": {
        "econ": 68,
        "auth": 42,
        "foreign": 65,
        "env": 50,
        "tech": 75,
        "estab": 30
      }
    },
    {
      "name": "Communitarian",
      "share": 11,
      "sig": {
        "econ": 40,
        "auth": 62,
        "foreign": 40,
        "env": 60,
        "tech": 40,
        "estab": 55
      }
    },
    {
      "name": "Traditional Conservative",
      "share": 14,
      "sig": {
        "econ": 60,
        "auth": 75,
        "foreign": 35,
        "env": 40,
        "tech": 45,
        "estab": 35
      }
    },
    {
      "name": "National Populist",
      "share": 10,
      "sig": {
        "econ": 45,
        "auth": 72,
        "foreign": 20,
        "env": 35,
        "tech": 50,
        "estab": 85
      }
    }
  ],
  "values": [
    {
      "name": "The Tempered Optimist",
      "share": 12,
      "sig": {
        "future": 58,
        "circle": 48,
        "hedonism": 52,
        "meaning": 70,
        "moral": 45,
        "beauty": 75
      }
    },
    {
      "name": "The Romantic",
      "share": 6,
      "sig": {
        "future": 50,
        "circle": 45,
        "hedonism": 60,
        "meaning": 78,
        "moral": 40,
        "beauty": 92
      }
    },
    {
      "name": "The Provider",
      "share": 16,
      "sig": {
        "future": 48,
        "circle": 22,
        "hedonism": 40,
        "meaning": 60,
        "moral": 70,
        "beauty": 50
      }
    },
    {
      "name": "The Rationalist",
      "share": 7,
      "sig": {
        "future": 60,
        "circle": 55,
        "hedonism": 45,
        "meaning": 45,
        "moral": 88,
        "beauty": 30
      }
    },
    {
      "name": "The Builder",
      "share": 9,
      "sig": {
        "future": 88,
        "circle": 50,
        "hedonism": 50,
        "meaning": 50,
        "moral": 55,
        "beauty": 45
      }
    },
    {
      "name": "The Utilitarian",
      "share": 3,
      "sig": {
        "future": 60,
        "circle": 92,
        "hedonism": 45,
        "meaning": 55,
        "moral": 70,
        "beauty": 40
      }
    },
    {
      "name": "The Worried Idealist",
      "share": 10,
      "sig": {
        "future": 20,
        "circle": 62,
        "hedonism": 40,
        "meaning": 72,
        "moral": 50,
        "beauty": 60
      }
    },
    {
      "name": "The Traditionalist",
      "share": 16,
      "sig": {
        "future": 40,
        "circle": 28,
        "hedonism": 35,
        "meaning": 65,
        "moral": 78,
        "beauty": 55
      }
    },
    {
      "name": "The Hedonist",
      "share": 13,
      "sig": {
        "future": 55,
        "circle": 40,
        "hedonism": 88,
        "meaning": 28,
        "moral": 35,
        "beauty": 65
      }
    },
    {
      "name": "The Wanderer",
      "share": 8,
      "sig": {
        "future": 55,
        "circle": 45,
        "hedonism": 72,
        "meaning": 55,
        "moral": 22,
        "beauty": 72
      }
    }
  ],
  "attachment": [
    {
      "name": "The Constant",
      "share": 11,
      "sig": {
        "warm": 80,
        "loyal": 85,
        "open": 60,
        "play": 55,
        "easy": 60
      }
    },
    {
      "name": "The Loyalist",
      "share": 9,
      "sig": {
        "warm": 60,
        "loyal": 90,
        "open": 45,
        "play": 45,
        "easy": 50
      }
    },
    {
      "name": "The Cheerleader",
      "share": 9,
      "sig": {
        "warm": 85,
        "loyal": 60,
        "open": 70,
        "play": 80,
        "easy": 65
      }
    },
    {
      "name": "The Fixture",
      "share": 12,
      "sig": {
        "warm": 50,
        "loyal": 85,
        "open": 35,
        "play": 35,
        "easy": 75
      }
    },
    {
      "name": "The Confidant",
      "share": 8,
      "sig": {
        "warm": 70,
        "loyal": 75,
        "open": 85,
        "play": 45,
        "easy": 55
      }
    },
    {
      "name": "The Open Book",
      "share": 6,
      "sig": {
        "warm": 65,
        "loyal": 55,
        "open": 90,
        "play": 60,
        "easy": 55
      }
    },
    {
      "name": "The Comic Relief",
      "share": 9,
      "sig": {
        "warm": 55,
        "loyal": 55,
        "open": 50,
        "play": 90,
        "easy": 60
      }
    },
    {
      "name": "The Floater",
      "share": 6,
      "sig": {
        "warm": 70,
        "loyal": 30,
        "open": 55,
        "play": 80,
        "easy": 75
      }
    },
    {
      "name": "The Chill One",
      "share": 12,
      "sig": {
        "warm": 55,
        "loyal": 50,
        "open": 50,
        "play": 65,
        "easy": 90
      }
    },
    {
      "name": "The Overinvested",
      "share": 4,
      "sig": {
        "warm": 75,
        "loyal": 60,
        "open": 75,
        "play": 75,
        "easy": 30
      }
    },
    {
      "name": "The Slow Burn",
      "share": 10,
      "sig": {
        "warm": 45,
        "loyal": 70,
        "open": 40,
        "play": 35,
        "easy": 65
      }
    },
    {
      "name": "The Small Circle",
      "share": 4,
      "sig": {
        "warm": 40,
        "loyal": 80,
        "open": 25,
        "play": 40,
        "easy": 45
      }
    }
  ]
};

/** IS_TEST_AVG — the population baseline the matcher centres on (rule 2)
 *  and the band cut points are measured from. */
export const TRAIT_AVG: Record<TraitKind, Record<string, number>> = {
  "big5": {
    "O": 60,
    "C": 58,
    "E": 52,
    "A": 65,
    "N": 48
  },
  "political": {
    "econ": 50,
    "auth": 52,
    "foreign": 48,
    "env": 55,
    "tech": 60,
    "estab": 55
  },
  "values": {
    "future": 52,
    "circle": 45,
    "hedonism": 55,
    "meaning": 58,
    "moral": 55,
    "beauty": 60
  },
  "attachment": {
    "warm": 64,
    "loyal": 66,
    "open": 56,
    "play": 58,
    "easy": 60
  }
};

/** Each instrument's axis ids, from the instrument itself. */
export const TRAIT_AXES: Record<TraitKind, string[]> = {
  "big5": [
    "O",
    "C",
    "E",
    "A",
    "N"
  ],
  "political": [
    "econ",
    "auth",
    "foreign",
    "env",
    "tech",
    "estab"
  ],
  "values": [
    "future",
    "circle",
    "hedonism",
    "meaning",
    "moral",
    "beauty"
  ],
  "attachment": [
    "warm",
    "loyal",
    "open",
    "play",
    "easy"
  ]
};

/** archetype-data.js's module-private matcher constants, read from source. */
export const ARCH_W_FLOOR = 6;
export const ARCH_SHARE_PULL = 210;

/** The band magnitudes (D254): a lean worth naming, and a defining lean. */
export const RULE_REAL = 8;
export const RULE_STRONG = 18;

/** Synthetic profiles with the type the CLIENT matcher assigns them,
 *  computed at generation time. traitsFit.test.ts runs the SERVER matcher
 *  over these and asserts the same answers — the drift guard, and the only
 *  thing that can see two matchers in two runtimes disagreeing. */
export interface GoldenProfile {
  kind: TraitKind;
  dims: Array<{ id: string; value: number }>;
  type: string | null;
}
export const TRAIT_GOLDEN: GoldenProfile[] = [
  {
    "kind": "big5",
    "dims": [
      {
        "id": "O",
        "value": 60
      },
      {
        "id": "C",
        "value": 67
      },
      {
        "id": "E",
        "value": 43
      },
      {
        "id": "A",
        "value": 84
      },
      {
        "id": "N",
        "value": 29
      }
    ],
    "type": "The Dependable"
  },
  {
    "kind": "big5",
    "dims": [
      {
        "id": "O",
        "value": 69
      },
      {
        "id": "C",
        "value": 49
      },
      {
        "id": "E",
        "value": 71
      },
      {
        "id": "A",
        "value": 46
      },
      {
        "id": "N",
        "value": 78
      }
    ],
    "type": "The Hothead"
  },
  {
    "kind": "big5",
    "dims": [
      {
        "id": "O",
        "value": 51
      },
      {
        "id": "C",
        "value": 77
      },
      {
        "id": "E",
        "value": 33
      },
      {
        "id": "A",
        "value": 95
      },
      {
        "id": "N",
        "value": 18
      }
    ],
    "type": "The Dependable"
  },
  {
    "kind": "big5",
    "dims": [
      {
        "id": "O",
        "value": 79
      },
      {
        "id": "C",
        "value": 39
      },
      {
        "id": "E",
        "value": 82
      },
      {
        "id": "A",
        "value": 35
      },
      {
        "id": "N",
        "value": 93
      }
    ],
    "type": "The Hothead"
  },
  {
    "kind": "big5",
    "dims": [
      {
        "id": "O",
        "value": 41
      },
      {
        "id": "C",
        "value": 88
      },
      {
        "id": "E",
        "value": 22
      },
      {
        "id": "A",
        "value": 100
      },
      {
        "id": "N",
        "value": 3
      }
    ],
    "type": "The Dependable"
  },
  {
    "kind": "big5",
    "dims": [
      {
        "id": "O",
        "value": 90
      },
      {
        "id": "C",
        "value": 28
      },
      {
        "id": "E",
        "value": 97
      },
      {
        "id": "A",
        "value": 20
      },
      {
        "id": "N",
        "value": 50
      }
    ],
    "type": "The Enthusiast"
  },
  {
    "kind": "big5",
    "dims": [
      {
        "id": "O",
        "value": 30
      },
      {
        "id": "C",
        "value": 100
      },
      {
        "id": "E",
        "value": 7
      },
      {
        "id": "A",
        "value": 67
      },
      {
        "id": "N",
        "value": 48
      }
    ],
    "type": "The Dependable"
  },
  {
    "kind": "big5",
    "dims": [
      {
        "id": "O",
        "value": 100
      },
      {
        "id": "C",
        "value": 13
      },
      {
        "id": "E",
        "value": 54
      },
      {
        "id": "A",
        "value": 65
      },
      {
        "id": "N",
        "value": 57
      }
    ],
    "type": "The Drifter"
  },
  {
    "kind": "big5",
    "dims": [
      {
        "id": "O",
        "value": 15
      },
      {
        "id": "C",
        "value": 60
      },
      {
        "id": "E",
        "value": 52
      },
      {
        "id": "A",
        "value": 74
      },
      {
        "id": "N",
        "value": 39
      }
    ],
    "type": "The Dependable"
  },
  {
    "kind": "big5",
    "dims": [
      {
        "id": "O",
        "value": 62
      },
      {
        "id": "C",
        "value": 58
      },
      {
        "id": "E",
        "value": 61
      },
      {
        "id": "A",
        "value": 56
      },
      {
        "id": "N",
        "value": 67
      }
    ],
    "type": "The Lookout"
  },
  {
    "kind": "political",
    "dims": [
      {
        "id": "econ",
        "value": 50
      },
      {
        "id": "auth",
        "value": 61
      },
      {
        "id": "foreign",
        "value": 39
      },
      {
        "id": "env",
        "value": 74
      },
      {
        "id": "tech",
        "value": 41
      },
      {
        "id": "estab",
        "value": 85
      }
    ],
    "type": "Communitarian"
  },
  {
    "kind": "political",
    "dims": [
      {
        "id": "econ",
        "value": 59
      },
      {
        "id": "auth",
        "value": 43
      },
      {
        "id": "foreign",
        "value": 67
      },
      {
        "id": "env",
        "value": 36
      },
      {
        "id": "tech",
        "value": 90
      },
      {
        "id": "estab",
        "value": 25
      }
    ],
    "type": "Market Liberal"
  },
  {
    "kind": "political",
    "dims": [
      {
        "id": "econ",
        "value": 41
      },
      {
        "id": "auth",
        "value": 71
      },
      {
        "id": "foreign",
        "value": 29
      },
      {
        "id": "env",
        "value": 85
      },
      {
        "id": "tech",
        "value": 30
      },
      {
        "id": "estab",
        "value": 100
      }
    ],
    "type": "Communitarian"
  },
  {
    "kind": "political",
    "dims": [
      {
        "id": "econ",
        "value": 69
      },
      {
        "id": "auth",
        "value": 33
      },
      {
        "id": "foreign",
        "value": 78
      },
      {
        "id": "env",
        "value": 25
      },
      {
        "id": "tech",
        "value": 100
      },
      {
        "id": "estab",
        "value": 10
      }
    ],
    "type": "Market Liberal"
  },
  {
    "kind": "political",
    "dims": [
      {
        "id": "econ",
        "value": 31
      },
      {
        "id": "auth",
        "value": 82
      },
      {
        "id": "foreign",
        "value": 18
      },
      {
        "id": "env",
        "value": 100
      },
      {
        "id": "tech",
        "value": 15
      },
      {
        "id": "estab",
        "value": 57
      }
    ],
    "type": "Communitarian"
  },
  {
    "kind": "political",
    "dims": [
      {
        "id": "econ",
        "value": 80
      },
      {
        "id": "auth",
        "value": 22
      },
      {
        "id": "foreign",
        "value": 93
      },
      {
        "id": "env",
        "value": 10
      },
      {
        "id": "tech",
        "value": 62
      },
      {
        "id": "estab",
        "value": 55
      }
    ],
    "type": "Market Liberal"
  },
  {
    "kind": "political",
    "dims": [
      {
        "id": "econ",
        "value": 20
      },
      {
        "id": "auth",
        "value": 97
      },
      {
        "id": "foreign",
        "value": 3
      },
      {
        "id": "env",
        "value": 57
      },
      {
        "id": "tech",
        "value": 60
      },
      {
        "id": "estab",
        "value": 64
      }
    ],
    "type": "National Populist"
  },
  {
    "kind": "political",
    "dims": [
      {
        "id": "econ",
        "value": 95
      },
      {
        "id": "auth",
        "value": 7
      },
      {
        "id": "foreign",
        "value": 50
      },
      {
        "id": "env",
        "value": 55
      },
      {
        "id": "tech",
        "value": 69
      },
      {
        "id": "estab",
        "value": 46
      }
    ],
    "type": "Liberal Centrist"
  },
  {
    "kind": "political",
    "dims": [
      {
        "id": "econ",
        "value": 5
      },
      {
        "id": "auth",
        "value": 54
      },
      {
        "id": "foreign",
        "value": 48
      },
      {
        "id": "env",
        "value": 64
      },
      {
        "id": "tech",
        "value": 51
      },
      {
        "id": "estab",
        "value": 74
      }
    ],
    "type": "Solidarity Left"
  },
  {
    "kind": "political",
    "dims": [
      {
        "id": "econ",
        "value": 52
      },
      {
        "id": "auth",
        "value": 52
      },
      {
        "id": "foreign",
        "value": 57
      },
      {
        "id": "env",
        "value": 46
      },
      {
        "id": "tech",
        "value": 79
      },
      {
        "id": "estab",
        "value": 36
      }
    ],
    "type": "Liberal Centrist"
  },
  {
    "kind": "values",
    "dims": [
      {
        "id": "future",
        "value": 52
      },
      {
        "id": "circle",
        "value": 54
      },
      {
        "id": "hedonism",
        "value": 46
      },
      {
        "id": "meaning",
        "value": 77
      },
      {
        "id": "moral",
        "value": 36
      },
      {
        "id": "beauty",
        "value": 90
      }
    ],
    "type": "The Tempered Optimist"
  },
  {
    "kind": "values",
    "dims": [
      {
        "id": "future",
        "value": 61
      },
      {
        "id": "circle",
        "value": 36
      },
      {
        "id": "hedonism",
        "value": 74
      },
      {
        "id": "meaning",
        "value": 39
      },
      {
        "id": "moral",
        "value": 85
      },
      {
        "id": "beauty",
        "value": 30
      }
    ],
    "type": "The Rationalist"
  },
  {
    "kind": "values",
    "dims": [
      {
        "id": "future",
        "value": 43
      },
      {
        "id": "circle",
        "value": 64
      },
      {
        "id": "hedonism",
        "value": 36
      },
      {
        "id": "meaning",
        "value": 88
      },
      {
        "id": "moral",
        "value": 25
      },
      {
        "id": "beauty",
        "value": 100
      }
    ],
    "type": "The Romantic"
  },
  {
    "kind": "values",
    "dims": [
      {
        "id": "future",
        "value": 71
      },
      {
        "id": "circle",
        "value": 26
      },
      {
        "id": "hedonism",
        "value": 85
      },
      {
        "id": "meaning",
        "value": 28
      },
      {
        "id": "moral",
        "value": 100
      },
      {
        "id": "beauty",
        "value": 15
      }
    ],
    "type": "The Rationalist"
  },
  {
    "kind": "values",
    "dims": [
      {
        "id": "future",
        "value": 33
      },
      {
        "id": "circle",
        "value": 75
      },
      {
        "id": "hedonism",
        "value": 25
      },
      {
        "id": "meaning",
        "value": 100
      },
      {
        "id": "moral",
        "value": 10
      },
      {
        "id": "beauty",
        "value": 62
      }
    ],
    "type": "The Worried Idealist"
  },
  {
    "kind": "values",
    "dims": [
      {
        "id": "future",
        "value": 82
      },
      {
        "id": "circle",
        "value": 15
      },
      {
        "id": "hedonism",
        "value": 100
      },
      {
        "id": "meaning",
        "value": 13
      },
      {
        "id": "moral",
        "value": 57
      },
      {
        "id": "beauty",
        "value": 60
      }
    ],
    "type": "The Hedonist"
  },
  {
    "kind": "values",
    "dims": [
      {
        "id": "future",
        "value": 22
      },
      {
        "id": "circle",
        "value": 90
      },
      {
        "id": "hedonism",
        "value": 10
      },
      {
        "id": "meaning",
        "value": 60
      },
      {
        "id": "moral",
        "value": 55
      },
      {
        "id": "beauty",
        "value": 69
      }
    ],
    "type": "The Worried Idealist"
  },
  {
    "kind": "values",
    "dims": [
      {
        "id": "future",
        "value": 97
      },
      {
        "id": "circle",
        "value": 0
      },
      {
        "id": "hedonism",
        "value": 57
      },
      {
        "id": "meaning",
        "value": 58
      },
      {
        "id": "moral",
        "value": 64
      },
      {
        "id": "beauty",
        "value": 51
      }
    ],
    "type": "The Builder"
  },
  {
    "kind": "values",
    "dims": [
      {
        "id": "future",
        "value": 7
      },
      {
        "id": "circle",
        "value": 47
      },
      {
        "id": "hedonism",
        "value": 55
      },
      {
        "id": "meaning",
        "value": 67
      },
      {
        "id": "moral",
        "value": 46
      },
      {
        "id": "beauty",
        "value": 79
      }
    ],
    "type": "The Worried Idealist"
  },
  {
    "kind": "values",
    "dims": [
      {
        "id": "future",
        "value": 54
      },
      {
        "id": "circle",
        "value": 45
      },
      {
        "id": "hedonism",
        "value": 64
      },
      {
        "id": "meaning",
        "value": 49
      },
      {
        "id": "moral",
        "value": 74
      },
      {
        "id": "beauty",
        "value": 41
      }
    ],
    "type": "The Traditionalist"
  },
  {
    "kind": "attachment",
    "dims": [
      {
        "id": "warm",
        "value": 64
      },
      {
        "id": "loyal",
        "value": 75
      },
      {
        "id": "open",
        "value": 47
      },
      {
        "id": "play",
        "value": 77
      },
      {
        "id": "easy",
        "value": 41
      }
    ],
    "type": "The Constant"
  },
  {
    "kind": "attachment",
    "dims": [
      {
        "id": "warm",
        "value": 73
      },
      {
        "id": "loyal",
        "value": 57
      },
      {
        "id": "open",
        "value": 75
      },
      {
        "id": "play",
        "value": 39
      },
      {
        "id": "easy",
        "value": 90
      }
    ],
    "type": "The Chill One"
  },
  {
    "kind": "attachment",
    "dims": [
      {
        "id": "warm",
        "value": 55
      },
      {
        "id": "loyal",
        "value": 85
      },
      {
        "id": "open",
        "value": 37
      },
      {
        "id": "play",
        "value": 88
      },
      {
        "id": "easy",
        "value": 30
      }
    ],
    "type": "The Loyalist"
  },
  {
    "kind": "attachment",
    "dims": [
      {
        "id": "warm",
        "value": 83
      },
      {
        "id": "loyal",
        "value": 47
      },
      {
        "id": "open",
        "value": 86
      },
      {
        "id": "play",
        "value": 28
      },
      {
        "id": "easy",
        "value": 100
      }
    ],
    "type": "The Confidant"
  },
  {
    "kind": "attachment",
    "dims": [
      {
        "id": "warm",
        "value": 45
      },
      {
        "id": "loyal",
        "value": 96
      },
      {
        "id": "open",
        "value": 26
      },
      {
        "id": "play",
        "value": 100
      },
      {
        "id": "easy",
        "value": 15
      }
    ],
    "type": "The Loyalist"
  },
  {
    "kind": "attachment",
    "dims": [
      {
        "id": "warm",
        "value": 94
      },
      {
        "id": "loyal",
        "value": 36
      },
      {
        "id": "open",
        "value": 100
      },
      {
        "id": "play",
        "value": 13
      },
      {
        "id": "easy",
        "value": 62
      }
    ],
    "type": "The Open Book"
  },
  {
    "kind": "attachment",
    "dims": [
      {
        "id": "warm",
        "value": 34
      },
      {
        "id": "loyal",
        "value": 100
      },
      {
        "id": "open",
        "value": 11
      },
      {
        "id": "play",
        "value": 60
      },
      {
        "id": "easy",
        "value": 60
      }
    ],
    "type": "The Fixture"
  },
  {
    "kind": "attachment",
    "dims": [
      {
        "id": "warm",
        "value": 100
      },
      {
        "id": "loyal",
        "value": 21
      },
      {
        "id": "open",
        "value": 58
      },
      {
        "id": "play",
        "value": 58
      },
      {
        "id": "easy",
        "value": 69
      }
    ],
    "type": "The Cheerleader"
  },
  {
    "kind": "attachment",
    "dims": [
      {
        "id": "warm",
        "value": 19
      },
      {
        "id": "loyal",
        "value": 68
      },
      {
        "id": "open",
        "value": 56
      },
      {
        "id": "play",
        "value": 67
      },
      {
        "id": "easy",
        "value": 51
      }
    ],
    "type": "The Slow Burn"
  },
  {
    "kind": "attachment",
    "dims": [
      {
        "id": "warm",
        "value": 66
      },
      {
        "id": "loyal",
        "value": 66
      },
      {
        "id": "open",
        "value": 65
      },
      {
        "id": "play",
        "value": 49
      },
      {
        "id": "easy",
        "value": 79
      }
    ],
    "type": "The Chill One"
  }
];
