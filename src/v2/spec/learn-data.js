// Ported from design/InSight_standalone_15.html (learn-data.js, 2026-07-31
// revision). THIS file is the live source now, hand-edits and all.
// Cross-module references resolve through the shared global scope and
// spec-index.js load order is semantic — scripts/check-spec-globals.mjs
// guards the wiring in CI.
import React from 'react';

// learn-data.js — the Learn mode's content. Three levels of nesting, and only
// the bottom two are taxonomy: Learn is the MODE (a question with a right
// answer), subject is tier 2 (Biology), field is tier 3 (Cell biology). That
// reuses the topic → subtopic shape the World feed already has, so nothing in
// the existing taxonomy has to bend.
//
// A card carries:
//   q  the question · a  the options · c  index of the correct one
//   t  index of the TRAP — the wrong answer people actually pick. This is what
//      makes a knowledge question an InSight question: the split of wrong
//      answers is a map of common misconceptions, not noise.
//   p  % of the crowd who get it right. Doubles as difficulty (low p = hard),
//      so "on your level" runs on real crowd data, not invented 1–5 labels.
//   k  the fact in three words — the label the mastered dot wears on your map.
//   w  optional one line of why. Only where the fact is genuinely counter-
//      intuitive; never an argument, never more than ~20 words.

window.LEARN_SUBJECTS = [
  { id: 'biology', label: 'Biology', hue: 150 },
  { id: 'space',   label: 'Space',   hue: 282 },
  { id: 'history', label: 'History', hue: 40  },
  { id: 'geo',     label: 'Geography', hue: 195 },
  { id: 'words',   label: 'Words',   hue: 8   },
];

window.LEARN_FIELDS = [
  { id: 'cell',     subject: 'biology', label: 'Cell biology' },
  { id: 'gene',     subject: 'biology', label: 'Genetics' },
  { id: 'body',     subject: 'biology', label: 'The human body' },
  { id: 'evo',      subject: 'biology', label: 'Evolution' },
  { id: 'solar',    subject: 'space',   label: 'The solar system' },
  { id: 'stars',    subject: 'space',   label: 'Stars & galaxies' },
  { id: 'ancient',  subject: 'history', label: 'The ancient world' },
  { id: 'c20',      subject: 'history', label: 'The 20th century' },
  { id: 'earth',    subject: 'geo',     label: 'Rivers & mountains' },
  { id: 'capitals', subject: 'geo',     label: 'Countries & capitals' },
  { id: 'origins',  subject: 'words',   label: 'Word origins' },
  { id: 'confused', subject: 'words',   label: 'Commonly confused' },
];

window.LEARN_CARDS = [
  // ─── Cell biology ───
  { id: 'cell1', f: 'cell', q: 'What do ribosomes build?', a: ['Proteins', 'Lipids', 'DNA', 'Sugars'], c: 0, t: 2, p: 71, k: 'Ribosomes build proteins' },
  { id: 'cell2', f: 'cell', q: 'Which organelle releases most of a cell\u2019s energy?', a: ['Mitochondrion', 'Nucleus', 'Ribosome', 'Lysosome'], c: 0, t: 1, p: 84, k: 'Mitochondria make energy' },
  { id: 'cell3', f: 'cell', q: 'A plant cell wall is made mostly of\u2026', a: ['Cellulose', 'Chitin', 'Keratin', 'Starch'], c: 0, t: 3, p: 52, k: 'Cell walls are cellulose' },
  { id: 'cell4', f: 'cell', q: 'Where does an animal cell keep its DNA?', a: ['The nucleus', 'The cytoplasm', 'The membrane', 'A vacuole'], c: 0, t: 1, p: 88, k: 'DNA lives in the nucleus' },
  { id: 'cell5', f: 'cell', q: 'What does a lysosome do?', a: ['Breaks down waste', 'Stores water', 'Builds proteins', 'Splits the cell'], c: 0, t: 2, p: 44, k: 'Lysosomes break down waste' },
  { id: 'cell6', f: 'cell', q: 'Which of these cells has no nucleus?', a: ['A bacterium', 'A plant cell', 'A fungal cell', 'They all have one'], c: 0, t: 3, p: 61, k: 'Bacteria have no nucleus' },
  { id: 'cell7', f: 'cell', q: 'Photosynthesis happens in the\u2026', a: ['Chloroplast', 'Mitochondrion', 'Nucleus', 'Ribosome'], c: 0, t: 1, p: 77, k: 'Chloroplasts do photosynthesis' },
  { id: 'cell8', f: 'cell', q: 'Division that makes two identical cells is\u2026', a: ['Mitosis', 'Meiosis', 'Osmosis', 'Mutation'], c: 0, t: 1, p: 58, k: 'Mitosis copies a cell', w: 'Meiosis is the other one \u2014 it halves the chromosomes to make egg and sperm cells.' },

  // ─── Genetics ───
  { id: 'gene1', f: 'gene', q: 'DNA\u2019s four bases are A, C, G and\u2026', a: ['T', 'U', 'P', 'M'], c: 0, t: 1, p: 69, k: 'DNA: A, C, G, T' },
  { id: 'gene2', f: 'gene', q: 'How many chromosomes are in a human body cell?', a: ['46', '23', '92', '64'], c: 0, t: 1, p: 63, k: '46 chromosomes', w: '23 pairs \u2014 one of each pair from each parent. 23 is the count in an egg or sperm cell.' },
  { id: 'gene3', f: 'gene', q: 'A variant that shows only when inherited from both parents is\u2026', a: ['Recessive', 'Dominant', 'Mutant', 'Linked'], c: 0, t: 1, p: 72, k: 'Recessive needs both parents' },
  { id: 'gene4', f: 'gene', q: 'RNA uses which base in place of thymine?', a: ['Uracil', 'Guanine', 'Adenine', 'Cytosine'], c: 0, t: 2, p: 41, k: 'RNA swaps T for uracil' },
  { id: 'gene5', f: 'gene', q: 'Who published DNA\u2019s double helix in 1953?', a: ['Watson & Crick', 'Mendel', 'Darwin', 'Pasteur'], c: 0, t: 1, p: 66, k: 'Double helix, 1953', w: 'Built on Rosalind Franklin\u2019s X-ray images, used without her knowledge.' },
  { id: 'gene6', f: 'gene', q: 'Mendel worked out inheritance by breeding\u2026', a: ['Pea plants', 'Fruit flies', 'Mice', 'Roses'], c: 0, t: 1, p: 57, k: 'Mendel bred peas' },
  { id: 'gene7', f: 'gene', q: 'Identical twins share\u2026', a: ['All their DNA', 'Half their DNA', 'A quarter of it', 'None of it'], c: 0, t: 1, p: 81, k: 'Identical twins: all DNA' },
  { id: 'gene8', f: 'gene', q: 'A change in a DNA sequence is a\u2026', a: ['Mutation', 'Mitosis', 'Meiosis', 'Marker'], c: 0, t: 2, p: 86, k: 'DNA change = mutation' },

  // ─── The human body ───
  { id: 'body1', f: 'body', q: 'Which vessels carry blood away from the heart?', a: ['Arteries', 'Veins', 'Capillaries', 'Ventricles'], c: 0, t: 1, p: 74, k: 'Arteries carry blood out' },
  { id: 'body2', f: 'body', q: 'How many chambers does the heart have?', a: ['Four', 'Two', 'Three', 'Six'], c: 0, t: 1, p: 79, k: 'Four heart chambers' },
  { id: 'body3', f: 'body', q: 'The largest organ in the body is the\u2026', a: ['Skin', 'Liver', 'Lung', 'Brain'], c: 0, t: 1, p: 64, k: 'Skin is the largest organ' },
  { id: 'body4', f: 'body', q: 'Which organ makes insulin?', a: ['The pancreas', 'The liver', 'A kidney', 'The spleen'], c: 0, t: 1, p: 55, k: 'The pancreas makes insulin' },
  { id: 'body5', f: 'body', q: 'Where does most nutrient absorption happen?', a: ['Small intestine', 'Stomach', 'Large intestine', 'Liver'], c: 0, t: 1, p: 48, k: 'Small intestine absorbs' },
  { id: 'body6', f: 'body', q: 'How many bones does an adult have?', a: ['206', 'About 300', 'About 150', '412'], c: 0, t: 1, p: 52, k: '206 adult bones', w: 'Babies start with about 300; many fuse together as they grow.' },
  { id: 'body7', f: 'body', q: 'Which part of the brain handles balance?', a: ['Cerebellum', 'Cerebrum', 'Brain stem', 'Hippocampus'], c: 0, t: 1, p: 43, k: 'Cerebellum: balance' },
  { id: 'body8', f: 'body', q: 'Red blood cells carry oxygen using\u2026', a: ['Haemoglobin', 'Insulin', 'Collagen', 'Keratin'], c: 0, t: 2, p: 76, k: 'Haemoglobin carries oxygen' },

  // ─── Evolution ───
  { id: 'evo1', f: 'evo', q: 'Natural selection acts on\u2026', a: ['Inherited variation', 'Individual effort', 'Learned habits', 'Random wishes'], c: 0, t: 2, p: 59, k: 'Selection needs inherited variation' },
  { id: 'evo2', f: 'evo', q: 'Darwin\u2019s finches came from the\u2026', a: ['Gal\u00e1pagos', 'Canaries', 'Azores', 'Falklands'], c: 0, t: 1, p: 72, k: 'Darwin: the Gal\u00e1pagos' },
  { id: 'evo3', f: 'evo', q: 'Humans and chimpanzees have\u2026', a: ['A common ancestor', 'Direct descent', 'No relation', 'An identical genome'], c: 0, t: 1, p: 67, k: 'Chimps: a shared ancestor', w: 'We did not descend from chimps \u2014 both lines split from one older species.' },
  { id: 'evo4', f: 'evo', q: 'Whales evolved from\u2026', a: ['Land mammals', 'Fish', 'Reptiles', 'Sharks'], c: 0, t: 1, p: 51, k: 'Whales came from land' },
  { id: 'evo5', f: 'evo', q: 'Same origin, different use \u2014 those structures are\u2026', a: ['Homologous', 'Analogous', 'Vestigial', 'Convergent'], c: 0, t: 1, p: 37, k: 'Homologous: shared origin' },
  { id: 'evo6', f: 'evo', q: 'Roughly how old is the Earth?', a: ['4.5 billion years', '4.5 million years', '450 million years', '45 billion years'], c: 0, t: 1, p: 69, k: 'Earth: 4.5 billion years' },
  { id: 'evo7', f: 'evo', q: 'Birds are the living descendants of\u2026', a: ['Dinosaurs', 'Pterosaurs', 'Crocodiles', 'Early mammals'], c: 0, t: 1, p: 62, k: 'Birds are dinosaurs' },
  { id: 'evo8', f: 'evo', q: 'Antibiotic resistance is an example of\u2026', a: ['Evolution in action', 'A lab error', 'A virus', 'Natural immunity'], c: 0, t: 3, p: 73, k: 'Resistance is evolution' },

  // ─── The solar system ───
  { id: 'sol1', f: 'solar', q: 'Which planet is closest to the Sun?', a: ['Mercury', 'Venus', 'Mars', 'Earth'], c: 0, t: 1, p: 83, k: 'Mercury is closest' },
  { id: 'sol2', f: 'solar', q: 'Which planet is hottest?', a: ['Venus', 'Mercury', 'Mars', 'Jupiter'], c: 0, t: 1, p: 47, k: 'Venus is hottest', w: 'Mercury sits closer, but Venus\u2019s thick CO\u2082 blanket traps far more heat.' },
  { id: 'sol3', f: 'solar', q: 'How many moons does Mars have?', a: ['Two', 'One', 'None', 'Four'], c: 0, t: 1, p: 44, k: 'Mars has two moons' },
  { id: 'sol4', f: 'solar', q: 'Which planet has the fastest winds?', a: ['Neptune', 'Jupiter', 'Saturn', 'Earth'], c: 0, t: 1, p: 33, k: 'Neptune: fastest winds' },
  { id: 'sol5', f: 'solar', q: 'The largest planet is\u2026', a: ['Jupiter', 'Saturn', 'Neptune', 'Uranus'], c: 0, t: 1, p: 88, k: 'Jupiter is largest' },
  { id: 'sol6', f: 'solar', q: 'Reclassified as a dwarf planet in 2006:', a: ['Pluto', 'Ceres', 'Eris', 'Charon'], c: 0, t: 1, p: 86, k: 'Pluto demoted, 2006' },
  { id: 'sol7', f: 'solar', q: 'A year on Venus is shorter than\u2026', a: ['Its own day', 'An Earth month', 'An Earth day', 'Nothing'], c: 0, t: 2, p: 29, k: 'Venus: year < day', w: 'Venus turns so slowly that one rotation takes longer than one trip round the Sun.' },
  { id: 'sol8', f: 'solar', q: 'The asteroid belt sits between\u2026', a: ['Mars and Jupiter', 'Earth and Mars', 'Jupiter and Saturn', 'Venus and Earth'], c: 0, t: 1, p: 64, k: 'Belt: Mars\u2013Jupiter' },

  // ─── Stars & galaxies ───
  { id: 'str1', f: 'stars', q: 'Our galaxy is the\u2026', a: ['Milky Way', 'Andromeda', 'Triangulum', 'Sombrero'], c: 0, t: 1, p: 87, k: 'We live in the Milky Way' },
  { id: 'str2', f: 'stars', q: 'The Sun is a\u2026', a: ['Yellow dwarf', 'Red giant', 'White dwarf', 'Supergiant'], c: 0, t: 1, p: 58, k: 'The Sun: a yellow dwarf' },
  { id: 'str3', f: 'stars', q: 'A light year measures\u2026', a: ['Distance', 'Time', 'Brightness', 'Mass'], c: 0, t: 1, p: 71, k: 'Light year = distance' },
  { id: 'str4', f: 'stars', q: 'A massive star\u2019s collapse can leave\u2026', a: ['A black hole', 'A nebula', 'A comet', 'A planet'], c: 0, t: 1, p: 61, k: 'Collapse \u2192 black hole' },
  { id: 'str5', f: 'stars', q: 'The nearest star to the Sun is\u2026', a: ['Proxima Centauri', 'Sirius', 'Alpha Centauri A', 'Polaris'], c: 0, t: 2, p: 39, k: 'Nearest: Proxima Centauri' },
  { id: 'str6', f: 'stars', q: 'Most of a galaxy\u2019s visible mass sits in its\u2026', a: ['Stars', 'Central black hole', 'Dust clouds', 'Planets'], c: 0, t: 1, p: 46, k: 'Galaxies are mostly stars' },
  { id: 'str7', f: 'stars', q: 'The universe is about\u2026', a: ['13.8 billion years old', '4.5 billion years old', '100 billion years old', 'A trillion years old'], c: 0, t: 1, p: 66, k: 'Universe: 13.8 billion years' },
  { id: 'str8', f: 'stars', q: 'Which colour of star burns hottest?', a: ['Blue', 'Red', 'Yellow', 'Orange'], c: 0, t: 1, p: 41, k: 'Blue stars are hottest', w: 'Backwards from taps and maps: on stars, blue is hot and red is cool.' },

  // ─── The ancient world ───
  { id: 'anc1', f: 'ancient', q: 'The Great Pyramid at Giza was built for\u2026', a: ['Khufu', 'Tutankhamun', 'Ramesses II', 'Cleopatra'], c: 0, t: 1, p: 48, k: 'Great Pyramid: Khufu' },
  { id: 'anc2', f: 'ancient', q: 'Hieroglyphs were deciphered thanks to the\u2026', a: ['Rosetta Stone', 'Dead Sea Scrolls', 'Code of Hammurabi', 'Parthenon friezes'], c: 0, t: 2, p: 74, k: 'Rosetta Stone cracked it' },
  { id: 'anc3', f: 'ancient', q: 'The first known written law code comes from\u2026', a: ['Mesopotamia', 'Egypt', 'Greece', 'China'], c: 0, t: 1, p: 52, k: 'First laws: Mesopotamia' },
  { id: 'anc4', f: 'ancient', q: 'Which empire built Machu Picchu?', a: ['Inca', 'Maya', 'Aztec', 'Olmec'], c: 0, t: 1, p: 63, k: 'Machu Picchu: Inca' },
  { id: 'anc5', f: 'ancient', q: 'Athens is credited with the first\u2026', a: ['Democracy', 'Republic', 'Monarchy', 'Empire'], c: 0, t: 1, p: 78, k: 'Athens: first democracy' },
  { id: 'anc6', f: 'ancient', q: 'Alexander the Great was tutored by\u2026', a: ['Aristotle', 'Plato', 'Socrates', 'Homer'], c: 0, t: 1, p: 56, k: 'Aristotle taught Alexander' },
  { id: 'anc7', f: 'ancient', q: 'The Colosseum held roughly\u2026', a: ['50,000 people', '5,000 people', '200,000 people', '12,000 people'], c: 0, t: 1, p: 44, k: 'Colosseum: ~50,000' },
  { id: 'anc8', f: 'ancient', q: 'Rome\u2019s republic gave way to empire under\u2026', a: ['Augustus', 'Julius Caesar', 'Nero', 'Hadrian'], c: 0, t: 1, p: 41, k: 'Augustus: first emperor', w: 'Caesar was never emperor \u2014 his heir Augustus took that step.' },

  // ─── The 20th century ───
  { id: 'c201', f: 'c20', q: 'The Berlin Wall fell in\u2026', a: ['1989', '1991', '1985', '1979'], c: 0, t: 1, p: 71, k: 'Wall fell in 1989' },
  { id: 'c202', f: 'c20', q: 'The first person in space was\u2026', a: ['Yuri Gagarin', 'Neil Armstrong', 'Alan Shepard', 'Valentina Tereshkova'], c: 0, t: 1, p: 64, k: 'Gagarin went first' },
  { id: 'c203', f: 'c20', q: 'The Second World War ended in\u2026', a: ['1945', '1944', '1946', '1939'], c: 0, t: 1, p: 89, k: 'WWII ended 1945' },
  { id: 'c204', f: 'c20', q: 'Apollo 11 landed on the Moon in\u2026', a: ['1969', '1968', '1972', '1965'], c: 0, t: 1, p: 81, k: 'Moon landing: 1969' },
  { id: 'c205', f: 'c20', q: 'Penicillin was discovered by\u2026', a: ['Alexander Fleming', 'Louis Pasteur', 'Marie Curie', 'Jonas Salk'], c: 0, t: 1, p: 59, k: 'Fleming found penicillin' },
  { id: 'c206', f: 'c20', q: 'The United Nations was founded in\u2026', a: ['1945', '1919', '1950', '1930'], c: 0, t: 1, p: 57, k: 'UN founded 1945', w: '1919 was the League of Nations \u2014 the attempt that came before.' },
  { id: 'c207', f: 'c20', q: 'Which country launched the first satellite?', a: ['The Soviet Union', 'The USA', 'Germany', 'Japan'], c: 0, t: 1, p: 76, k: 'Sputnik was Soviet' },
  { id: 'c208', f: 'c20', q: 'Apartheid in South Africa formally ended in the\u2026', a: ['Early 1990s', 'Late 1970s', 'Early 1980s', 'Late 1990s'], c: 0, t: 2, p: 53, k: 'Apartheid ended, early 90s' },

  // ─── Rivers & mountains ───
  { id: 'ear1', f: 'earth', q: 'The longest river in the world is the\u2026', a: ['Nile', 'Amazon', 'Yangtze', 'Mississippi'], c: 0, t: 1, p: 56, k: 'Nile: longest river', w: 'Contested \u2014 by length the Nile leads, but the Amazon carries far more water.' },
  { id: 'ear2', f: 'earth', q: 'Everest sits on the border of Nepal and\u2026', a: ['China', 'India', 'Bhutan', 'Pakistan'], c: 0, t: 1, p: 51, k: 'Everest: Nepal\u2013China' },
  { id: 'ear3', f: 'earth', q: 'The deepest ocean trench is the\u2026', a: ['Mariana Trench', 'Puerto Rico Trench', 'Java Trench', 'Tonga Trench'], c: 0, t: 3, p: 73, k: 'Deepest: the Mariana' },
  { id: 'ear4', f: 'earth', q: 'Which river flows through Paris?', a: ['The Seine', 'The Loire', 'The Rh\u00f4ne', 'The Rhine'], c: 0, t: 1, p: 77, k: 'Paris: the Seine' },
  { id: 'ear5', f: 'earth', q: 'The largest freshwater lake by volume is\u2026', a: ['Lake Baikal', 'Lake Superior', 'Lake Victoria', 'The Caspian Sea'], c: 0, t: 1, p: 38, k: 'Baikal holds the most' },
  { id: 'ear6', f: 'earth', q: 'Which continent has no rivers to speak of?', a: ['Antarctica', 'Australia', 'Africa', 'Europe'], c: 0, t: 1, p: 57, k: 'Antarctica: no rivers' },
  { id: 'ear7', f: 'earth', q: 'The Andes run along which coast?', a: ['Western South America', 'Eastern South America', 'Western Africa', 'Southern Asia'], c: 0, t: 1, p: 79, k: 'Andes: western coast' },
  { id: 'ear8', f: 'earth', q: 'The Sahara is roughly the size of\u2026', a: ['The USA', 'Spain', 'India', 'Australia\u2019s outback'], c: 0, t: 2, p: 35, k: 'Sahara \u2248 the USA' },

  // ─── Countries & capitals ───
  { id: 'cap1', f: 'capitals', q: 'The capital of Australia is\u2026', a: ['Canberra', 'Sydney', 'Melbourne', 'Perth'], c: 0, t: 1, p: 61, k: 'Australia: Canberra' },
  { id: 'cap2', f: 'capitals', q: 'The capital of Turkey is\u2026', a: ['Ankara', 'Istanbul', 'Izmir', 'Bursa'], c: 0, t: 1, p: 54, k: 'Turkey: Ankara' },
  { id: 'cap3', f: 'capitals', q: 'The capital of Canada is\u2026', a: ['Ottawa', 'Toronto', 'Vancouver', 'Montreal'], c: 0, t: 1, p: 58, k: 'Canada: Ottawa' },
  { id: 'cap4', f: 'capitals', q: 'The capital of Brazil is\u2026', a: ['Bras\u00edlia', 'Rio de Janeiro', 'S\u00e3o Paulo', 'Salvador'], c: 0, t: 1, p: 63, k: 'Brazil: Bras\u00edlia' },
  { id: 'cap5', f: 'capitals', q: 'The capital of Switzerland is\u2026', a: ['Bern', 'Zurich', 'Geneva', 'Basel'], c: 0, t: 1, p: 42, k: 'Switzerland: Bern' },
  { id: 'cap6', f: 'capitals', q: 'The capital of New Zealand is\u2026', a: ['Wellington', 'Auckland', 'Christchurch', 'Dunedin'], c: 0, t: 1, p: 49, k: 'New Zealand: Wellington' },
  { id: 'cap7', f: 'capitals', q: 'The capital of Morocco is\u2026', a: ['Rabat', 'Casablanca', 'Marrakesh', 'Fez'], c: 0, t: 1, p: 39, k: 'Morocco: Rabat' },
  { id: 'cap8', f: 'capitals', q: 'The capital of Myanmar is\u2026', a: ['Naypyidaw', 'Yangon', 'Mandalay', 'Bago'], c: 0, t: 1, p: 31, k: 'Myanmar: Naypyidaw', w: 'Built from scratch and made capital in 2006; Yangon is still much larger.' },

  // ─── Word origins ───
  { id: 'org1', f: 'origins', q: '\u201cSalary\u201d comes from the Latin for\u2026', a: ['Salt', 'Silver', 'Service', 'Sale'], c: 0, t: 1, p: 47, k: 'Salary from salt' },
  { id: 'org2', f: 'origins', q: '\u201cQuarantine\u201d comes from the Italian for\u2026', a: ['Forty', 'Quiet', 'Border', 'Clean'], c: 0, t: 1, p: 36, k: 'Quarantine = forty days' },
  { id: 'org3', f: 'origins', q: '\u201cSandwich\u201d is named after\u2026', a: ['An English earl', 'A Dutch town', 'A baker', 'A ship'], c: 0, t: 1, p: 58, k: 'Sandwich: an earl' },
  { id: 'org4', f: 'origins', q: '\u201cMuscle\u201d comes from the Latin for\u2026', a: ['Little mouse', 'Strong rope', 'Living thread', 'Warm flesh'], c: 0, t: 1, p: 29, k: 'Muscle = little mouse', w: 'A flexing bicep looked, to Roman eyes, like a mouse moving under the skin.' },
  { id: 'org5', f: 'origins', q: '\u201cAlcohol\u201d entered English from\u2026', a: ['Arabic', 'Latin', 'Greek', 'German'], c: 0, t: 1, p: 44, k: 'Alcohol from Arabic' },
  { id: 'org6', f: 'origins', q: '\u201cRobot\u201d was coined in a\u2026', a: ['Czech play', 'German novel', 'Russian film', 'British essay'], c: 0, t: 1, p: 38, k: 'Robot: a Czech play' },
  { id: 'org7', f: 'origins', q: '\u201cAvocado\u201d traces back to\u2026', a: ['Nahuatl', 'Spanish', 'Portuguese', 'Quechua'], c: 0, t: 1, p: 33, k: 'Avocado from Nahuatl' },
  { id: 'org8', f: 'origins', q: '\u201cNightmare\u201d originally meant a\u2026', a: ['Crushing spirit', 'Bad dream', 'Dark horse', 'Night fever'], c: 0, t: 1, p: 26, k: 'Nightmare: a spirit', w: 'The \u201cmare\u201d is an old word for a demon that sat on a sleeper\u2019s chest \u2014 no horse involved.' },

  // ─── Commonly confused ───
  { id: 'con1', f: 'confused', q: 'Turning on its own axis is\u2026', a: ['Rotation', 'Orbit', 'Revolution', 'Tilt'], c: 0, t: 1, p: 62, k: 'Rotation vs orbit' },
  { id: 'con2', f: 'confused', q: '\u201cAffect\u201d is usually a\u2026', a: ['Verb', 'Noun', 'Adjective', 'Adverb'], c: 0, t: 1, p: 57, k: 'Affect is the verb' },
  { id: 'con3', f: 'confused', q: 'With things you can count, use\u2026', a: ['Fewer', 'Less', 'Either', 'Neither'], c: 0, t: 1, p: 64, k: 'Fewer for countables' },
  { id: 'con4', f: 'confused', q: '\u201cIts\u201d without an apostrophe means\u2026', a: ['Belonging to it', 'It is', 'It has', 'The plural of it'], c: 0, t: 1, p: 71, k: 'Its = belonging to it' },
  { id: 'con5', f: 'confused', q: 'A \u201cprincipal\u201d is\u2026', a: ['A person or the main thing', 'A rule', 'A belief', 'Interest owed'], c: 0, t: 1, p: 52, k: 'Principal vs principle' },
  { id: 'con6', f: 'confused', q: '\u201cLiterally\u201d strictly means\u2026', a: ['Exactly as stated', 'Very much', 'Almost', 'Figuratively'], c: 0, t: 3, p: 68, k: 'Literally = exactly' },
  { id: 'con7', f: 'confused', q: '\u201cCompliment\u201d with an i means\u2026', a: ['Praise', 'A completion', 'A match', 'A full set'], c: 0, t: 2, p: 59, k: 'Compliment is praise' },
  { id: 'con8', f: 'confused', q: 'Who implies \u2014 and who infers?', a: ['Speaker implies', 'Listener implies', 'The text implies', 'The editor implies'], c: 0, t: 1, p: 46, k: 'Speakers imply, listeners infer' },
];

// ── the crowd split ─────────────────────────────────────────────────────────
// The correct answer takes p%. The rest goes mostly to the trap — a wrong
// answer that lots of people pick is the interesting part of the card, and the
// same instrument the app uses for opinions reads it. Deterministic, so the
// split never shifts between sittings.
window.LEARN_SPLIT = function (card) {
  const n = card.a.length;
  let h = 0;
  for (let i = 0; i < card.id.length; i++) h = (h * 31 + card.id.charCodeAt(i)) >>> 0;
  const out = new Array(n).fill(0);
  out[card.c] = card.p;
  let rest = 100 - card.p;
  const wrong = [];
  for (let i = 0; i < n; i++) if (i !== card.c) wrong.push(i);
  const trap = card.t != null && card.t !== card.c ? card.t : wrong[0];
  const trapShare = Math.round(rest * (0.5 + ((h % 18) / 100)));   // 50–68% of the misses
  out[trap] = trapShare;
  rest -= trapShare;
  const others = wrong.filter((i) => i !== trap);
  others.forEach((i, k) => {
    const last = k === others.length - 1;
    const share = last ? rest : Math.round(rest / (others.length - k) * (0.8 + (((h >> (k + 2)) % 40) / 100)));
    out[i] = Math.max(0, Math.min(rest, share));
    rest -= out[i];
  });
  if (rest > 0) out[trap] += rest;
  return out;
};
