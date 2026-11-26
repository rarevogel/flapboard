const { chromium, devices } = require('playwright'); const path = require('path');
const out = process.argv[2];
const cases = [['nl', 'train', 'dep', 'local', 'classic'], ['jp', 'train', 'dep', 'local', 'classic'], ['cn', 'air', 'dep', 'local', 'amber'], ['eg', 'train', 'dep', 'local', 'blue'],
  ['il', 'air', 'arr', 'local', 'classic'], ['in', 'train', 'dep', 'local', 'green'], ['th', 'air', 'dep', 'local', 'amber'], ['kr', 'train', 'dep', 'alt', 'classic'], ['ru', 'train', 'dep', 'local', 'white'], ['gr', 'air', 'dep', 'local', 'classic'], ['uk', 'train', 'dep', 'local', 'amber'], ['de', 'air', 'dep', 'local', 'classic']];
(async () => {
  const b = await chromium.launch();
  for (const [label, opts] of [['land', { viewport: { width: 1280, height: 720 } }], ['phone', { ...devices['Pixel 7'] }]]) {
    const ctx = await b.newContext({ ...opts, deviceScaleFactor: 1 }); const p = await ctx.newPage();
    p.on('pageerror', e => console.log('ERR', label, e.message)); p.on('console', m => { if (m.type() === 'error') console.log('CONSOLE', m.text()); });
    await p.goto('file://' + path.resolve(__dirname, '../dist/flapboard.html')); await p.waitForTimeout(1200);
    await p.screenshot({ path: `${out}/${label}-start.png` });
    for (const [cc, kind, dir, lang, theme] of (label === 'land' ? cases : cases.slice(0, 4))) {
      await p.evaluate(([cc, kind, dir, lang, theme]) => { const F = FLAP; F.S.kind = kind; F.S.dir = dir; F.S.lang = lang; F.S.theme = theme; F.apply('country', cc); }, [cc, kind, dir, lang, theme]);
      await p.waitForTimeout(600); await p.evaluate(() => FLAP.settle()); await p.waitForTimeout(150);
      await p.screenshot({ path: `${out}/${label}-${cc}-${kind}-${lang}.png` });
    }
    await p.evaluate(() => document.querySelector('#board').click()); await p.waitForTimeout(400); await p.screenshot({ path: `${out}/${label}-panel.png` });
    await ctx.close();
  }
  await b.close();
})();
