// JINDA canon, encoded as data the generators read.
// Source of truth remains the writers' room documents; every entry cites one.
//   BIBLE    = JINDA_Series_Bible
//   POWER    = JINDA_Power_Systems_Reference
//   GLOSSARY = JINDA_Series_Glossary
// When the documents change, change this file, and every generator follows.

// Point levels: aura reach in metres. The docs give ranges in words
// ("arm's reach", "several metres", "tens of metres"); the numbers below are
// previz interpretations of those words, flagged as such.
export const POINT = {
  source: 'POWER §5 Point Rating System; §2.5 Topology of the Jinda Field',
  levels: {
    1: { aura: 0.9, band: 'low' },
    2: { aura: 1.0, band: 'low' },
    3: { aura: 1.2, band: 'low' },
    4: { aura: 3.0, band: 'mid' },
    5: { aura: 4.5, band: 'mid' },
    6: { aura: 6.0, band: 'mid' },
    7: { aura: 12, band: 'high' },
    8: { aura: 20, band: 'high' },
    9: { aura: 30, band: 'high' },
  },
  bands: {
    low: 'Basic functionality. Minimal aura (arm\'s reach). Personal-scale matter manipulation. No energy direction.',
    mid: 'Complex reasoning. Modest aura (several metres). Tactical-scale manipulation. Limited energy direction.',
    high: 'Significant aura (tens of metres). Combat/industrial manipulation. Significant energy direction.',
  },
  // Lattice complexity: "High Point develops recursive features — patterns
  // that reference other patterns." Rendered as nested (Matryoshka) shells.
  recursion: (p) => (p <= 3 ? 1 : p <= 6 ? 2 : p <= 8 ? 3 : 4),
  interpretation: 'Aura metre values are previz readings of the docs\' verbal ranges, not canon.',
};

// Core filigree (POWER §2 Core Filigree — Visual Language).
export const FILIGREE = {
  source: 'POWER §2 Core Filigree; GLOSSARY M-Carbon, Truncated Icosahedron',
  // "colors ranging from violet through green — hue indicates the depth of
  // consciousness integration ... deep meditative states shine violet-blue.
  // High emotional intensity glow yellow-orange."
  states: {
    meditative: { hex: '#6b5cff', label: 'Meditative (violet-blue)' },
    integrated: { hex: '#3fae8a', label: 'Integrated (green)' },
    intense: { hex: '#ffab3d', label: 'Emotional intensity (yellow-orange)' },
  },
  coreDiameterMm: 32, // "approximately the size of a large coin" — previz value
  note: 'Rings are only visible under magnification with polarised light. In natural light the core reads as dark carbon.',
};

// Tactical aura (POWER §10).
export const AURA = {
  source: 'POWER §10 Tactical Aura; §7 Energy Direction (Grounding)',
  activation: ['Decision (stillness)', 'Core pulse', 'First ring', 'Successive layers', 'Full deployment (holds)'],
  // Trace count is the exhaustion meter.
  traces: (spend) => (spend < 0.35 ? 6 : spend < 0.6 ? 4 : spend < 0.8 ? 3 : spend < 0.95 ? 1 : 0),
  groundingSeconds: 0.5, // "a half-second of light travelling the geometry"
};

// Combat doctrine (POWER §21). The generators enforce these; the UI lists them.
export const DOCTRINE = {
  source: 'POWER §21 Combat Doctrine',
  refuse: [
    'No casting. Direction is by attention, never hands.',
    'No dodging, no parrying.',
    'The bodies barely move. Animate the space, not the fighters.',
    'Quiet. The sound is structural failure.',
    'Nothing is conjured. Location is loadout.',
    'No bullet time, no speed ramping.',
  ],
  movement: [
    'No ease-in, no ease-out, no follow-through.',
    'No inertia. Stop at full extension, no sway.',
    'The face does not participate.',
    'Crisp, never smeared: environment may blur, the Jinda never does.',
    'Punctuated: still, gone, there, still.',
  ],
};

// The four peoples of the Asylum (BIBLE "The Asylum — The Four Peoples").
export const PEOPLES = {
  source: 'BIBLE The Asylum — The Four Peoples',
  rax: { name: 'Rax', sound: 'clicks', role: 'Spatial weavers' },
  geist: { name: 'Geist', sound: 'hisses', role: 'Phase-walkers' },
  omai: { name: 'Omai', sound: 'resonates', role: 'Empathic shape-shifters' },
  skarn: { name: 'Skarn', sound: 'scrapes', role: 'Armoured endurance people', height: [2.45, 2.75] },
};

// Asylum ecology (BIBLE "The Asylum — Dangerous Ecology" / "Physics").
export const ASYLUM = {
  source: 'BIBLE The Asylum — Scale, Physics and Structure, Dangerous Ecology; GLOSSARY Amargosa Valley',
  radiusMiles: [600, 700],
  rimSector: 'Amargosa Valley (southern Nevada), Domo Syn. Shaft Five: "Perdition".',
  phenomena: ['Uncontained tears', 'Temporal flora', 'Spore fields', 'Dimensional predators'],
};

// Hedron materials and architecture.
export const MATERIALS = {
  relicrete: {
    source: 'GLOSSARY The Promises',
    text: 'Asylum mining tailings pressed into composite panels. Emits low-level dimensional radiation: a continuous hum to Jinda, felt somatically by Diviners.',
  },
  mcarbon: {
    source: 'POWER §1 Core Composition',
    text: 'Carbon allotrope with nested geometric architecture. Our-universe matter, transformed. Name pending.',
  },
};

export const PROMISES = {
  source: 'GLOSSARY The Promises',
  matrix: [20, 20, 20],
  address: (site, level, col, row) => `Prom-${site}-${String(level).padStart(2, '0')}-${String(col).padStart(2, '0')}-${String(row).padStart(2, '0')}`,
  builder: 'Domo Kovar',
  slang: 'the Crates',
};

export const ADYTUM = {
  source: 'BIBLE Hedron — The Adytum; GLOSSARY Adytum, The Sander Home',
  states: {
    paradise: 'Light, idealised family, the life Sander imagined.',
    corruption: 'Shadows lengthening, accusatory gazes, industrial facilities visible.',
    wasteland: 'Night, Asylum ruins beyond glass, family as accusers.',
  },
};

// Inconsistencies found in the documents while encoding them. Surfaced in the
// UI so they get resolved in the writers' room rather than silently in code.
export const OPEN_QUESTIONS = [
  'Domini count: BIBLE says thirteen houses ringing the Asylum; GLOSSARY ("The Domini") and BIBLE ("twelve parties" at the Conclave) say twelve.',
  'Omai pronunciation note reads "rhymes with limb", which does not match the spelling. Needs a locked pronunciation.',
  '"Exotic matter" is flagged in POWER §2 as needing a better term; the glossary uses "osmotic matter". Pick one.',
  'M-carbon allotrope name is pending (POWER §1).',
  'Tok (physical currency) design is TBD: a natural next prop generator.',
  'Pilot summary "Domo Syn" subsection in the BIBLE has its paragraphs in reverse order (headings follow their content).',
];
