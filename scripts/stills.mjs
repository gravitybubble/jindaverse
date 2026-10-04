// Contact sheet: render every generator (and each of its presets) to PNG.
//   npm run dev            (in one terminal)
//   npm run stills         (in another)  → ./stills/*.png
// Options: --url http://localhost:5173  --only core,jinda  --wait 2500
//          --presets (also shoot every preset)  --action jinda:activate
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  ({ chromium } = require('/opt/node-tools/node_modules/playwright'));
}

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, all) => {
    if (a.startsWith('--')) acc.push([a.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : true]);
    return acc;
  }, []),
);
const base = args.url || 'http://localhost:5173';
const wait = Number(args.wait || 2500);
const only = args.only ? String(args.only).split(',') : null;
const actions = args.action ? String(args.action).split(',').map((s) => s.split(':')) : [];

mkdirSync('stills', { recursive: true });
const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
page.on('pageerror', (e) => console.error('pageerror:', e.message));
page.on('console', (m) => m.type() === 'error' && console.error('console:', m.text()));

await page.goto(base);
await page.waitForFunction(() => window.__jinda);
const gens = await page.evaluate(() => {
  // eslint-disable-next-line no-undef
  return [...document.querySelectorAll('.gen:not(.planned)')].map((b) => b.firstChild.textContent);
});
const ids = await page.evaluate(() => window.__jinda.state && import('/src/generators/index.js').then((m) => m.GENERATORS.map((g) => ({ id: g.id, presets: Object.keys(g.presets || {}) }))));

for (const { id, presets } of ids) {
  if (only && !only.includes(id)) continue;
  const shots = [null, ...(args.presets ? presets : [])];
  for (const preset of shots) {
    await page.evaluate(async ([id, preset]) => {
      const m = await import('/src/generators/index.js');
      const g = m.GENERATORS.find((x) => x.id === id);
      window.__jinda.select(id);
      if (preset) {
        Object.assign(window.__jinda.state.params, g.presets[preset]);
        window.__jinda.setParam('seed', window.__jinda.state.params.seed);
      }
    }, [id, preset]);
    await page.waitForTimeout(400);
    for (const [aid, act] of actions) if (aid === id) await page.evaluate((a) => window.__jinda.action(a), act);
    await page.waitForTimeout(wait);
    const file = `stills/${id}${preset ? '_' + preset.replace(/[^\w]+/g, '_') : ''}.png`;
    await page.locator('#stage-wrap').screenshot({ path: file });
    console.log('wrote', file);
  }
}
console.log(gens.length, 'generators');
await browser.close();
