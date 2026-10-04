// Deterministic randomness. Every generator draws from a seed string, so a
// look that works can be reproduced exactly, shared as a URL, and versioned.

function xmur3(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
  };
}

function mulberry32(a) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Rng {
  constructor(seed = 'JINDA') {
    this.seed = String(seed);
    this.next = mulberry32(xmur3(this.seed)());
  }
  // Independent sub-stream: changing how many numbers one subsystem draws
  // never reshuffles another subsystem's results.
  fork(label) {
    return new Rng(`${this.seed}/${label}`);
  }
  float(min = 0, max = 1) {
    return min + (max - min) * this.next();
  }
  int(min, max) {
    return Math.floor(this.float(min, max + 1));
  }
  pick(arr) {
    return arr[Math.floor(this.next() * arr.length)];
  }
  chance(p) {
    return this.next() < p;
  }
  // Approximately normal, mean 0, sd 1.
  gauss() {
    let u = 0;
    for (let i = 0; i < 6; i++) u += this.next();
    return u - 3;
  }
  unitVector() {
    const z = this.float(-1, 1);
    const a = this.float(0, Math.PI * 2);
    const r = Math.sqrt(1 - z * z);
    return [r * Math.cos(a), r * Math.sin(a), z];
  }
  shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
}

const WORDS = [
  'PERDITION', 'AMARGOSA', 'NOVALE', 'TERNARY', 'SPARK', 'PROMISES', 'HALO',
  'ADYTUM', 'RELICRETE', 'FIAT', 'VIRTUE', 'DRIFT', 'FRINGE', 'GROUNDING',
  'TRACE', 'HOLD', 'MOTE', 'KELVIN', 'FILIGREE', 'LATTICE', 'SCAFFOLD', 'ECHO',
];

export function randomSeedWord() {
  const r = Math.random;
  const w = WORDS[Math.floor(r() * WORDS.length)];
  return `${w}-${Math.floor(r() * 900 + 100)}`;
}
