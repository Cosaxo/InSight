// Ported from design/InSight_standalone_15.html (world-catalogs.js, 2026-07-31
// revision). THIS file is the live source now, hand-edits and all.
// Cross-module references resolve through the shared global scope and
// spec-index.js load order is semantic — scripts/check-spec-globals.mjs
// guards the wiring in CI.
import React from 'react';

// world-catalogs.js — catalogue questions. A vote has two sides; a catalogue has
// hundreds of entries, so the interaction is search-and-pick and the result is a
// long tail rather than a split. That tail IS the insight: not "which side won"
// but how rare your pick is, and how much of the field the top few actually hold.
//
// Only the head of each catalogue ships here (~20 entries with counts). The rest
// is implied by `total` — the app knows the full list; this is the part that has
// enough votes to rank. `picks` is the total answers, so every share is a real
// fraction of the whole vote and the untallied tail is honest arithmetic.
export const WF_CATALOGS = {
  films: {
    noun: 'films', shape: 'poster', hue: 310, total: 812, picks: 47000,
    items: [
      { id: 'godfather', name: 'The Godfather', meta: '1972', count: 3900 },
      { id: 'spirited', name: 'Spirited Away', meta: '2001', count: 3100 },
      { id: 'blade', name: 'Blade Runner', meta: '1982', count: 2400 },
      { id: 'mood', name: 'In the Mood for Love', meta: '2000', count: 2100 },
      { id: 'parasite', name: 'Parasite', meta: '2019', count: 2000 },
      { id: '2001', name: '2001: A Space Odyssey', meta: '1968', count: 1900 },
      { id: 'alien', name: 'Alien', meta: '1979', count: 1700 },
      { id: 'empire', name: 'The Empire Strikes Back', meta: '1980', count: 1600 },
      { id: 'samurai', name: 'Seven Samurai', meta: '1954', count: 1450 },
      { id: 'pulp', name: 'Pulp Fiction', meta: '1994', count: 1400 },
      { id: 'furyroad', name: 'Mad Max: Fury Road', meta: '2015', count: 1250 },
      { id: 'arrival', name: 'Arrival', meta: '2016', count: 1150 },
      { id: 'amelie', name: 'Am\u00e9lie', meta: '2001', count: 1050 },
      { id: 'whiplash', name: 'Whiplash', meta: '2014', count: 980 },
      { id: 'heat', name: 'Heat', meta: '1995', count: 900 },
      { id: 'portrait', name: 'Portrait of a Lady on Fire', meta: '2019', count: 860 },
      { id: 'paprika', name: 'Paprika', meta: '2006', count: 780 },
      { id: 'thing', name: 'The Thing', meta: '1982', count: 720 },
      { id: 'lost', name: 'Lost in Translation', meta: '2003', count: 690 },
      { id: 'comeandsee', name: 'Come and See', meta: '1985', count: 610 },
    ],
  },
  pokemon: {
    noun: 'Pok\u00e9mon', shape: 'square', hue: 145, total: 1025, picks: 38000,
    items: [
      { id: 'gengar', name: 'Gengar', meta: 'Ghost', count: 2600 },
      { id: 'charizard', name: 'Charizard', meta: 'Fire', count: 2500 },
      { id: 'bulbasaur', name: 'Bulbasaur', meta: 'Grass', count: 1900 },
      { id: 'mimikyu', name: 'Mimikyu', meta: 'Ghost', count: 1750 },
      { id: 'snorlax', name: 'Snorlax', meta: 'Normal', count: 1600 },
      { id: 'eevee', name: 'Eevee', meta: 'Normal', count: 1500 },
      { id: 'lucario', name: 'Lucario', meta: 'Fighting', count: 1350 },
      { id: 'umbreon', name: 'Umbreon', meta: 'Dark', count: 1300 },
      { id: 'squirtle', name: 'Squirtle', meta: 'Water', count: 1150 },
      { id: 'dragonite', name: 'Dragonite', meta: 'Dragon', count: 1050 },
      { id: 'tyranitar', name: 'Tyranitar', meta: 'Rock', count: 950 },
      { id: 'sylveon', name: 'Sylveon', meta: 'Fairy', count: 900 },
      { id: 'blaziken', name: 'Blaziken', meta: 'Fire', count: 840 },
      { id: 'metagross', name: 'Metagross', meta: 'Steel', count: 760 },
      { id: 'garchomp', name: 'Garchomp', meta: 'Dragon', count: 720 },
      { id: 'absol', name: 'Absol', meta: 'Dark', count: 650 },
      { id: 'ampharos', name: 'Ampharos', meta: 'Electric', count: 600 },
      { id: 'scizor', name: 'Scizor', meta: 'Bug', count: 560 },
      { id: 'togekiss', name: 'Togekiss', meta: 'Fairy', count: 500 },
      { id: 'bidoof', name: 'Bidoof', meta: 'Normal', count: 470 },
    ],
  },
  athletes: {
    noun: 'athletes', shape: 'square', hue: 85, total: 640, picks: 34000,
    items: [
      { id: 'biles', name: 'Simone Biles', meta: 'Gymnastics', count: 2300 },
      { id: 'serena', name: 'Serena Williams', meta: 'Tennis', count: 2150 },
      { id: 'ali', name: 'Muhammad Ali', meta: 'Boxing', count: 1950 },
      { id: 'bolt', name: 'Usain Bolt', meta: 'Sprinting', count: 1800 },
      { id: 'jordan', name: 'Michael Jordan', meta: 'Basketball', count: 1700 },
      { id: 'maradona', name: 'Diego Maradona', meta: 'Football', count: 1300 },
      { id: 'federer', name: 'Roger Federer', meta: 'Tennis', count: 1250 },
      { id: 'ledecky', name: 'Katie Ledecky', meta: 'Swimming', count: 1100 },
      { id: 'kipchoge', name: 'Eliud Kipchoge', meta: 'Marathon', count: 1050 },
      { id: 'comaneci', name: 'Nadia Com\u0103neci', meta: 'Gymnastics', count: 950 },
      { id: 'owens', name: 'Jesse Owens', meta: 'Sprinting', count: 900 },
      { id: 'gretzky', name: 'Wayne Gretzky', meta: 'Ice hockey', count: 820 },
      { id: 'messi', name: 'Lionel Messi', meta: 'Football', count: 780 },
      { id: 'joyner', name: 'Jackie Joyner-Kersee', meta: 'Heptathlon', count: 700 },
      { id: 'pele', name: 'Pel\u00e9', meta: 'Football', count: 660 },
      { id: 'djokovic', name: 'Novak Djokovic', meta: 'Tennis', count: 620 },
      { id: 'zaharias', name: 'Babe Didrikson Zaharias', meta: 'Multi-sport', count: 540 },
      { id: 'senna', name: 'Ayrton Senna', meta: 'Motor racing', count: 500 },
      { id: 'ronaldo', name: 'Cristiano Ronaldo', meta: 'Football', count: 470 },
      { id: 'tendulkar', name: 'Sachin Tendulkar', meta: 'Cricket', count: 430 },
    ],
  },
};

// the questions themselves — joined to the pool by loadWorldFeed().
//
// A named export rather than a module-scope append, and the append was the
// only thing keeping this file in the first-paint graph: its one importer
// (world-feed.jsx's WF_CATALOGS) is deferred, so the pool was the entire
// reason a demo catalogue shipped eagerly. `joinDemoStock`
// (world-feed-data.js) takes it now, past the live guard.
export const WF_CATALOG_QS = [
    { id: 'c01', cat: 'fav', type: 'pick', catalog: 'athletes', prompt: 'The greatest athlete who ever lived' },
    { id: 'c02', cat: 'fav', type: 'pick', catalog: 'films', prompt: 'Your favourite film of all time' },
    // c03 ('Your favourite Pokémon') is dropped from the prototype's list:
    // the repo already ships that exact question as pk01 (pick-data.js),
    // keyed to the real committed Pokédex rather than this 20-entry demo
    // head — two cards asking the same thing would race each other in the feed.
];
// WORLD_FEED_QS is still a shared global and this file no longer writes it.
// The note that stood here said converting the POOL means designing an
// owner with an add/replace API and moving four writers onto it — a design
// change, not a mechanical conversion. That is still true and still not
// done: what changed is only that this writer hands its array to the one
// function that appends, instead of appending itself at module scope.
// world-feed-data.js CREATES the pool, world-subtopics.js APPENDS to it —
// through its own installer now, past the same guard — and data/live.ts
// REPLACES it wholesale in live mode.
