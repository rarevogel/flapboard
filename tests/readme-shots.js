// Makes the README screenshots in docs/screenshots. Needs the board served on 127.0.0.1:47815 (linux/flapboard-saver's server) and tests/mock-ns.py as a stand-in for NS (FLAPBOARD_NS_BASE=http://127.0.0.1:47900/).
const { chromium, devices } = require('playwright');
const out = '/home/claude/flapboard/docs/screenshots';
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1280, height: 720 }, timezoneId: 'Europe/Amsterdam' }); const p = await ctx.newPage();
  p.on('pageerror', e => console.log('ERR', e.message));
  await p.goto('http://127.0.0.1:47815/flapboard.html'); await p.waitForTimeout(900); await p.addStyleTag({ content: '#hint{display:none!important}' });
  const shot = async (name, set) => {
    await p.evaluate(set); await p.waitForTimeout(900); await p.evaluate(() => FLAP.settle()); await p.waitForTimeout(250);
    await p.screenshot({ path: `${out}/${name}.png` });
  };
  const base = { kind: 'train', dir: 'dep', lang: 'local', theme: 'classic', wear: 'off', frame: 'none', rows: 0, random: 'off', rollS: 0 };
  const cfg = o => `(() => { Object.assign(FLAP.S, ${JSON.stringify({ ...base, ...o })}); FLAP.apply('country', ${JSON.stringify(o.country || 'nl')}); })()`;
  await shot('trains-netherlands', cfg({ country: 'nl' }));
  await shot('trains-japan-wood-worn', cfg({ country: 'jp', frame: 'wood', wear: 'worn' }));
  await shot('flights-china-amber', cfg({ country: 'cn', kind: 'air', theme: 'amber' }));
  await shot('trains-egypt-arabic', cfg({ country: 'eg', theme: 'blue' }));
  await shot('flights-israel-hebrew', cfg({ country: 'il', kind: 'air', dir: 'arr' }));
  await shot('trains-india-hindi', cfg({ country: 'in', theme: 'green' }));
  await p.evaluate(() => { FLAP.S.nsKey = 'testkey'; FLAP.S.nsStation = 'UT'; });
  await shot('ns-live-utrecht-aluminium', cfg({ country: 'nl', kind: 'ns', theme: 'amber', frame: 'alu', wear: 'worn' }));
  // mid-roll
  await p.evaluate(cfg({ country: 'de', kind: 'air', theme: 'white' })); await p.waitForTimeout(700); await p.screenshot({ path: `${out}/flaps-rolling.png` });
  await p.waitForTimeout(6000); await p.evaluate(() => FLAP.settle());
  await p.evaluate(() => document.querySelector('#board').click()); await p.waitForTimeout(500); await p.screenshot({ path: `${out}/settings.png` });
  await ctx.close();
  const ph = await b.newContext({ ...devices['Pixel 7'], timezoneId: 'Europe/Amsterdam' }); const q = await ph.newPage();
  await q.goto('http://127.0.0.1:47815/flapboard.html'); await q.waitForTimeout(900); await q.addStyleTag({ content: '#hint{display:none!important}' });
  await q.evaluate(cfg({ country: 'kr', lang: 'local' })); await q.waitForTimeout(900); await q.evaluate(() => FLAP.settle()); await q.waitForTimeout(250);
  await q.screenshot({ path: `${out}/phone-korea.png` });
  await b.close();
})();
