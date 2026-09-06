// The daily's category taxonomy, lifted out of daily-questions.js so a
// consumer can have the fourteen branches without the question bank.
//
// WHY IT IS ITS OWN FILE. map-branches.js needs exactly EMERGENT_CATS —
// fourteen {id,label,hue} rows derived from the table below — and was
// importing it from daily-questions.js, which put that module's whole
// demo archive (36 KB, and the file the question farm appends to EVERY
// DAY) into the first-paint graph for the sake of a colour and a label.
// map-branches is in the entry chunk, so that edge alone was enough:
// dropping the spec-index side-effect line moved the eager graph by 2 KB
// and nothing else, because this import held it there.
//
// Nothing here depends on a question, which is the property that makes
// the split honest rather than convenient: the table is authored
// metadata, the archive is content, and only one of the two belongs in
// the bytes a phone fetches before it can paint.
//
// A question's path (e.g. ['Sport','Football']) is its tag AND where its
// answer lands on your map. topWord -> placement: a seedId reuses an
// existing self-branch; the rest are topical branches that emerge as you
// answer.
export function slug(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export const CAT_META = {
  Body: { seedId: 'health', hue: 150 }, Skills: { seedId: 'craft', hue: 40 }, Interests: { seedId: 'interests', hue: 78 },
  Home: { seedId: 'home', hue: 110 }, Story: { seedId: 'story', hue: 320 }, Goals: { seedId: 'goals', hue: 240 }, Values: { seedId: 'values', hue: 356 },
  Sport: { hue: 18 }, Film: { hue: 265 }, Food: { hue: 35 }, Travel: { hue: 200 }, Mind: { hue: 255 }, Morals: { hue: 305 }, Music: { hue: 130 },
};

export function catMeta(top) {
  const m = CAT_META[top] || { hue: 250 };
  return { top, hue: m.hue, seedId: m.seedId || null, catId: m.seedId || ('top-' + slug(top)) };
}

export const EMERGENT_CATS = Object.keys(CAT_META)
  .filter((k) => !CAT_META[k].seedId)
  .map((k) => ({ id: 'top-' + slug(k), label: k, hue: CAT_META[k].hue }));
