import { Stage, ASPECTS } from './engine/stage.js';
import { Rng, randomSeedWord } from './engine/rng.js';
import { GENERATORS, PLANNED } from './generators/index.js';
import { DOCTRINE, OPEN_QUESTIONS } from './canon/canon.js';

const stage = new Stage(document.getElementById('stage'));
window.__stage = stage; // handy from the console, and used by the stills script

const LOOK_DEFAULTS = { lens: null, aspect: '2.39', bloom: 0.6, grain: 0.06, exposure: 1.0 };
const state = { gen: null, params: {}, look: { ...LOOK_DEFAULTS }, instance: null };

// ---------- URL state: every look is a link ----------
function readHash() {
  const [id, query] = location.hash.replace(/^#\/?/, '').split('?');
  const q = new URLSearchParams(query || '');
  return { id, q };
}

function writeHash() {
  const q = new URLSearchParams();
  for (const p of state.gen.params) q.set(p.key, String(state.params[p.key]));
  q.set('lens', state.look.lens);
  q.set('aspect', state.look.aspect);
  history.replaceState(null, '', `#${state.gen.id}?${q}`);
}

function coerce(p, raw) {
  if (raw === null || raw === undefined) return p.default;
  if (p.type === 'range') return Number(raw);
  if (p.type === 'toggle') return raw === 'true' || raw === true;
  return raw;
}

// ---------- generator lifecycle ----------
function select(id, q = new URLSearchParams()) {
  const gen = GENERATORS.find((g) => g.id === id) || GENERATORS[0];
  state.gen = gen;
  state.params = {};
  for (const p of gen.params) state.params[p.key] = coerce(p, q.get(p.key));
  state.look.lens = Number(q.get('lens')) || gen.camera.lens;
  state.look.aspect = q.get('aspect') in ASPECTS ? q.get('aspect') : state.look.aspect;
  stage.setAspect(state.look.aspect);
  build({ reframe: true });
  renderRail();
  renderPanel();
}

function build({ reframe = false } = {}) {
  state.instance?.dispose?.();
  stage.clear();
  const gen = state.gen;
  const rng = new Rng(`${gen.id}:${state.params.seed}`);
  const inst = gen.build({ stage, rng, params: { ...state.params } });
  state.instance = inst;
  stage.scene.add(inst.object);
  if (inst.update) stage.updaters.add(inst.update);
  if (reframe) stage.frame({ ...(inst.camera || gen.camera), lens: state.look.lens });
  else stage.setLens(state.look.lens);
  stage.setLook({ bloom: state.look.bloom * (inst.bloomScale ?? 1), grain: state.look.grain, exposure: state.look.exposure * (inst.exposure ?? 1) });
  writeHash();
  renderSlate();
}

let rebuildTimer = 0;
function setParam(key, value) {
  state.params[key] = value;
  const p = state.gen.params.find((x) => x.key === key);
  if (p.live && state.instance?.set) {
    state.instance.set(key, value);
    writeHash();
    renderSlate();
    return;
  }
  clearTimeout(rebuildTimer);
  rebuildTimer = setTimeout(() => build(), 120);
}

// ---------- UI ----------
const el = (tag, attrs = {}, ...kids) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else if (k === 'class') n.className = v;
    else if (v !== undefined && v !== null && v !== false) n.setAttribute(k, v === true ? '' : v);
  }
  for (const k of kids.flat()) if (k !== null && k !== undefined) n.append(k.nodeType ? k : document.createTextNode(k));
  return n;
};

function renderRail() {
  const nav = document.getElementById('generators');
  nav.replaceChildren();
  const cats = [...new Set([...GENERATORS, ...PLANNED].map((g) => g.category))];
  for (const cat of cats) {
    nav.append(el('div', { class: 'cat' }, cat));
    for (const g of GENERATORS.filter((x) => x.category === cat)) {
      nav.append(el('button', { class: `gen ${g === state.gen ? 'on' : ''}`, onclick: () => select(g.id) }, g.title, el('small', {}, g.blurb)));
    }
    for (const g of PLANNED.filter((x) => x.category === cat)) {
      nav.append(el('div', { class: 'gen planned', title: 'Planned' }, g.title, el('small', {}, 'planned · ' + g.note)));
    }
  }
}

function control(p) {
  const v = state.params[p.key];
  const label = p.label || p.key;
  if (p.type === 'seed') {
    const input = el('input', { type: 'text', value: v, onchange: (e) => setParam('seed', e.target.value.trim() || 'JINDA') });
    return el('div', { class: 'row full' }, el('label', {}, 'Seed'),
      el('div', { class: 'seed' }, input, el('button', { class: 'chip', title: 'New seed', onclick: () => { input.value = randomSeedWord(); setParam('seed', input.value); } }, '↻')));
  }
  if (p.type === 'range') {
    const out = el('span', { class: 'val' }, fmt(v, p.step));
    const input = el('input', { type: 'range', min: p.min, max: p.max, step: p.step, value: v,
      oninput: (e) => { const n = Number(e.target.value); out.textContent = fmt(n, p.step); setParam(p.key, n); } });
    return el('div', {}, el('div', { class: 'row' }, el('label', {}, label), out, input), p.hint ? el('div', { class: 'hint' }, p.hint) : null);
  }
  if (p.type === 'select') {
    const s = el('select', { onchange: (e) => setParam(p.key, e.target.value) }, p.options.map((o) => el('option', { value: o, selected: o === v }, o)));
    return el('div', { class: 'row full' }, el('label', {}, label), s);
  }
  if (p.type === 'toggle') {
    return el('label', { class: 'toggle' }, el('input', { type: 'checkbox', checked: v, onchange: (e) => setParam(p.key, e.target.checked) }), label);
  }
  return null;
}

const fmt = (n, step) => (step >= 1 ? String(n) : Number(n).toFixed(2));

function renderPanel() {
  const g = state.gen;
  const panel = document.getElementById('panel');
  panel.replaceChildren();
  panel.append(el('div', { class: 'sec' }, el('div', { class: 'title' }, g.title), el('p', {}, g.blurb)));

  if (g.presets) {
    panel.append(el('div', { class: 'sec' }, el('h3', {}, 'Presets'),
      el('div', { class: 'btns' }, Object.entries(g.presets).map(([name, vals]) =>
        el('button', { class: 'chip', onclick: () => applyPreset(vals) }, name)))));
  }
  panel.append(el('div', { class: 'sec' }, el('h3', {}, 'Parameters'), g.params.map(control)));

  const actions = state.instance?.actions || g.actions;
  if (actions?.length) {
    panel.append(el('div', { class: 'sec' }, el('h3', {}, 'Action'),
      el('div', { class: 'btns' }, actions.map((a) => el('button', { class: 'chip', title: a.hint || '', onclick: () => state.instance.action(a.id) }, a.label)))));
  }

  const look = el('div', { class: 'sec' }, el('h3', {}, 'Camera'));
  const setups = state.instance?.cameras || g.cameras;
  if (setups) {
    look.append(el('div', { class: 'btns', style: 'margin-bottom:8px' }, Object.entries(setups).map(([name, cam]) =>
      el('button', { class: 'chip', onclick: () => { if (cam.lens) { state.look.lens = cam.lens; } stage.frame({ ...cam, lens: state.look.lens }); writeHash(); renderSlate(); renderPanel(); } }, name))));
  }
  look.append(
    el('div', { class: 'row full' }, el('label', {}, 'Aspect'),
      el('select', { onchange: (e) => { state.look.aspect = e.target.value; stage.setAspect(e.target.value); writeHash(); renderSlate(); } },
        Object.keys(ASPECTS).map((a) => el('option', { value: a, selected: a === state.look.aspect }, a === '2.39' ? '2.39 : 1  scope' : a === '1.85' ? '1.85 : 1  flat' : a)))),
    rangeRow('Lens (mm)', 14, 200, 1, state.look.lens, (n) => { state.look.lens = n; stage.setLens(n); writeHash(); renderSlate(); }),
    rangeRow('Bloom', 0, 2, 0.01, state.look.bloom, (n) => { state.look.bloom = n; stage.setLook({ bloom: n * (state.instance?.bloomScale ?? 1) }); }),
    rangeRow('Grain', 0, 0.2, 0.005, state.look.grain, (n) => { state.look.grain = n; stage.setLook({ grain: n }); }),
    rangeRow('Exposure', 0.2, 2.5, 0.01, state.look.exposure, (n) => { state.look.exposure = n; stage.setLook({ exposure: n * (state.instance?.exposure ?? 1) }); }),
    el('div', { class: 'btns' },
      el('button', { class: 'primary', onclick: capture }, 'Capture still'),
      el('button', { class: 'chip', onclick: () => navigator.clipboard?.writeText(location.href) }, 'Copy link'),
      el('button', { class: 'chip', onclick: () => stage.frame({ ...(state.instance.camera || g.camera), lens: state.look.lens }) }, 'Reset frame'),
      el('button', { class: 'chip', onclick: (e) => { stage.paused = !stage.paused; e.target.textContent = stage.paused ? 'Play' : 'Pause'; } }, 'Pause')),
  );
  panel.append(look);

  if (g.doctrine) {
    panel.append(el('div', { class: 'sec' }, el('h3', {}, 'Doctrine enforced'),
      el('ul', { class: 'rules' }, [...DOCTRINE.movement, ...DOCTRINE.refuse.slice(0, 3)].map((r) => el('li', {}, r)))));
  }
  if (g.notes) panel.append(el('div', { class: 'sec' }, el('h3', {}, 'Notes'), g.notes.map((n) => el('p', {}, n))));
  panel.append(el('div', { class: 'sec' }, el('h3', {}, 'Canon sources'), el('ul', { class: 'refs' }, g.canon.map((c) => el('li', {}, c)))));
}

function rangeRow(label, min, max, step, v, on) {
  const out = el('span', { class: 'val' }, fmt(v, step));
  return el('div', { class: 'row' }, el('label', {}, label), out,
    el('input', { type: 'range', min, max, step, value: v, oninput: (e) => { const n = Number(e.target.value); out.textContent = fmt(n, step); on(n); } }));
}

function applyPreset(vals) {
  Object.assign(state.params, vals);
  build();
  renderPanel();
}

function slateLines() {
  const g = state.gen;
  return [`JINDA`, g.title.toUpperCase(), `SEED ${state.params.seed}`, `${Math.round(state.look.lens)}mm S35`, `${state.look.aspect}`];
}

function renderSlate() {
  const s = document.getElementById('slate');
  const [a, b, ...rest] = slateLines();
  s.replaceChildren(el('b', {}, a), el('span', {}, b), ...rest.map((r) => el('span', {}, r)));
}

function renderHud() {
  const lines = state.instance?.hud?.() || [];
  const h = document.getElementById('hud');
  const txt = lines.join('\n');
  if (h.dataset.txt !== txt) {
    h.dataset.txt = txt;
    h.replaceChildren(...lines.map((l) => el('div', {}, l)));
  }
}
stage.onFrame = renderHud;

function capture() {
  const name = `jinda_${state.gen.id}_${String(state.params.seed).replace(/[^\w-]+/g, '_')}_${Date.now()}.png`;
  stage.capture(slateLines(), name);
}

// Canon flags dialog
document.getElementById('open-canon').addEventListener('click', () => {
  const d = document.getElementById('canon-dialog');
  d.replaceChildren(
    el('h2', {}, 'Canon flags'),
    el('p', { style: 'color:var(--mute)' }, 'Inconsistencies found while encoding the writers\' room documents. Resolve them in the docs, then update src/canon/canon.js.'),
    el('ul', {}, OPEN_QUESTIONS.map((q) => el('li', {}, q))),
    el('button', { class: 'chip', onclick: () => d.close() }, 'Close'),
  );
  d.showModal();
});

// Expose actions to `window.__stage` callers (scripts) as well.
// Step simulated time without waiting on the renderer (stills, previews of a
// precise moment). advance(1.5) runs the updaters 1.5 s forward at 60 Hz.
function advance(seconds, hz = 60) {
  const dt = 1 / hz;
  for (let i = 0; i < Math.round(seconds * hz); i++) {
    stage.time += dt;
    for (const fn of stage.updaters) fn(stage.time, dt);
  }
}

window.__jinda = { select, setParam, state, advance, action: (id) => state.instance?.action?.(id) };

window.addEventListener('hashchange', () => {
  const { id, q } = readHash();
  if (id !== state.gen?.id) select(id, q);
});

const { id, q } = readHash();
select(id || GENERATORS[0].id, q);
