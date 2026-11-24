// Run: PLAYWRIGHT=/path/to/playwright node tests/psych-test.js  (uses Chrome at /usr/bin/google-chrome)
// Loads the real app in headless Chrome with HYPOTHETICAL sessions, checks the engine, screenshots each new screen.
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const { trades, journal, D } = require('./psych-seed');
const ROOT = require('path').join(__dirname, '..', 'app'), OUT = require('path').join(require('os').tmpdir(), 'psych-shots');
fs.mkdirSync(OUT, { recursive: true });
const srv = http.createServer((q, r) => { const f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0].split('#')[0]) === '/' ? 'index.html' : decodeURIComponent(q.url.split('?')[0])); fs.readFile(f, (e, b) => { if (e) { r.statusCode = 404; return r.end(); } r.setHeader('content-type', f.endsWith('.html') ? 'text/html' : f.endsWith('.js') ? 'text/javascript' : 'application/octet-stream'); r.end(b); }); }).listen(8765);
const expect = { [D.d1]: 100, [D.d2]: 59, [D.d3]: 49, [D.d4]: 100, [D.d5]: 86, [D.d6]: 97, [D.d7]: 77 };
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome' });
  const pg = await b.newPage({ viewport: { width: 1440, height: 1000 } });
  const errs = []; pg.on('pageerror', e => errs.push(e.message)); pg.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await pg.addInitScript(d => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('gj-local-v1', d); sessionStorage.setItem('seeded', '1'); } }, JSON.stringify({ app: '3gates-journal', v: 1, settings: { psy: { since: '2026-11-16' } }, trades, journal }));
  await pg.goto('http://localhost:8765/index.html#today'); await pg.waitForTimeout(800);
  const res = await pg.evaluate(() => {
    const out = {};
    for (const d of Object.keys(S.journal).sort()) { const e = psyEval(d); out[d] = { score: e.score, raw: e.raw, caps: e.caps, sc: Object.fromEntries(Object.entries(e.sc).map(([k, v]) => [k, v == null ? null : +v.toFixed(3)])), cats: e.rows.map(r => [r.t.id, r.v, r.cat, r.c6, r.rv.join('|'), r.q]), level: e.cb.level, hist: e.cb.hist.map(h => h.why), R: e.R, A: e.A, devs: e.devs.length, ready: e.rd.cls }; }
    const G = psyAgg(psyEvals(true)); out.agg = { adh: G.adh, resist: G.resist, riskV: G.riskV, hesMiss: G.hesMiss, streak: G.streak, after: G.after, lost: G.lost, bottleneck: psyBottleneck(G)?.k };
    psyCfg().researchInPlan = false; PSY_CACHE.clear(); const e1 = psyEval('2026-11-16'); out.noResearch = { score: e1.score, v: e1.rows.map(r => r.v), sel: e1.sc.sel };
    psyCfg().researchInPlan = true; PSY_CACHE.clear();
    out.prog = (() => { const P = psyProgram(); return { p: P.p, blocks: P.blocks.map(b => [b.p, b.ok]), cur: P.cur.length }; })();
    return out;
  });
  let fail = 0;
  for (const [d, want] of Object.entries(expect)) { const got = res[d].score; const ok = got === want; if (!ok) fail++; console.log(`${ok ? 'PASS' : 'FAIL'} ${d} score ${got} (want ${want}) raw ${res[d].raw} level ${res[d].level} caps ${res[d].caps.join(';')}`); }
  const chk = (name, ok, info) => { if (!ok) fail++; console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${info ? ' · ' + JSON.stringify(info) : ''}`); };
  chk('off day has no score', res['2026-11-21'].score === null);
  chk('losing clean day beats profitable undisciplined day', res[D.d1].score > res[D.d2].score);
  chk('D2 revenge -> emo, FOMO -> imp, over-max -> imp', JSON.stringify(res[D.d2].cats.map(c => c[2])) === JSON.stringify([null, 'emo', 'imp', 'imp']), res[D.d2].cats);
  chk('D2 invalid winners classified iw', res[D.d2].cats.filter(c => c[3] === 'iw').length === 3);
  chk('D2 traded while Red', res[D.d2].caps.some(c => c.includes('Red')));
  chk('D3 risk cap', res[D.d3].caps.some(c => c.includes('49')) && res[D.d3].raw === 78, res[D.d3]);
  chk('D4 no-trade: exec n/a, imp full', res[D.d4].sc.exec === null && res[D.d4].sc.imp === 1);
  chk('D5 readiness yellow + exec .425', res[D.d5].ready === 'yellow' && res[D.d5].sc.exec === 0.425, res[D.d5].sc);
  chk('D6 emotions not penalized (emo=1, yellow via tags, protocol credited)', res[D.d6].sc.emo === 1 && res[D.d6].level === 'yellow', res[D.d6]);
  chk('D7 rationalized -> invalid/sel; fear exit q .6', res[D.d7].cats[1][1] === 'invalid' && res[D.d7].cats[1][2] === 'sel' && res[D.d7].cats[0][5] === 0.6, res[D.d7].cats);
  chk('researchInPlan off -> unclear, sel .7', res.noResearch.v.every(v => v === 'unclear') && res.noResearch.sel === 0.7, res.noResearch);
  console.log('agg', JSON.stringify(res.agg)); console.log('program', JSON.stringify(res.prog));
  // UI pass: every new view renders, workflow clicks work
  const shot = async (n) => { await pg.waitForTimeout(350); await pg.screenshot({ path: `${OUT}/${n}.png`, fullPage: true }); };
  await pg.evaluate(d => { S.sub.jd = d; render(); }, D.d2); await shot('today-d2');
  for (const v of ['mind', 'mental']) { await pg.evaluate(v => { G.range = 'all'; goto(v); }, v); await shot(v); }
  await pg.evaluate(() => { S.sub.mind = 'week'; S.sub.pyWeek = '2026-11-16'; goto('mind'); }); await shot('mind-week');
  await pg.evaluate(() => { S.sub.mind = 'guide'; goto('mind'); }); await shot('mind-guide');
  for (const t of ['program', 'code', 'reh', 'set']) { await pg.evaluate(t => { S.sub.mental = t; goto('mental'); }, t); await shot('mental-' + t); }
  // fresh day: click through readiness, a tag, the protocol, map a deviation, finish
  await pg.evaluate(() => { S.sub.jd = ymd(new Date()); goto('today'); });
  for (const [k, v] of [['sleep', 4], ['energy', 4], ['clarity', 4], ['stable', 4], ['conf', 4], ['patience', 3], ['uncert', 3], ['stress', 2], ['finp', 3], ['urge', 3], ['fearl', 3], ['resid', 2]]) await pg.click(`[data-path="pre.${k}"][data-v="${v}"]`);
  await pg.click('[data-py="rehall"]'); await pg.click('[data-py="tag"][data-v="fomo"]');
  const proto = await pg.isVisible('.proto'); chk('tap opens 15-second reset', proto);
  await shot('today-live-proto');
  await pg.click('.proto [data-v="acted"]');
  const today = await pg.evaluate(() => { const e = psyEval(ymd(new Date())); return { ready: e.rd.cls, idx: e.rd.idx, lvl: e.cb.level, devs: e.devs.map(d => d.k), score: e.score }; });
  chk('acted urge -> Yellow + impulse deviation', today.lvl === 'yellow' && today.devs.includes('impulse'), today);
  await pg.click('[data-py="mapdev"]'); await pg.fill('[data-j="lesson"]', 'Tag and wait 60 seconds before any entry.'); await pg.waitForTimeout(900);
  await pg.click('[data-py="finish"]');
  const after = await pg.evaluate(() => psyEval(ymd(new Date())));
  chk('debrief finishes', after.done && after.chains.length === 1, { score: after.score });
  await shot('today-fresh');
  await pg.evaluate(() => goto('live')); await shot('live');
  // trade form psych section + drawer
  await pg.evaluate(() => openTradeForm(S.trades.find(t => t.id === 'hyp4'))); await pg.click('[data-tpsy="hes"][data-v="late"]'); await shot('trade-form');
  await pg.evaluate(() => { discardForm(); openDetail('hyp4'); }); await shot('drawer');
  await pg.evaluate(() => { closeDrawer(); S.sub.jd = '2026-11-17'; goto('diary'); }); await shot('diary');
  // persistence: reload, data still there and old views fine
  await pg.reload(); await pg.waitForTimeout(600);
  const persisted = await pg.evaluate(() => ({ lesson: (S.journal[ymd(new Date())] || {}).lesson, ev: ((S.journal[ymd(new Date())] || {}).psy || {}).ev?.length, since: psyCfg().since }));
  chk('saved across reload', persisted.ev === 1 && !!persisted.lesson, persisted);
  for (const v of ['dashboard', 'trades', 'analytics', 'playbook', 'edge', 'tilt', 'simulator', 'calendar', 'config']) { await pg.evaluate(v => goto(v), v); await pg.waitForTimeout(150); }
  await pg.evaluate(() => goto('dashboard')); await shot('dashboard-unchanged');
  chk('no page errors', !errs.filter(x => !x.includes('404')).length, errs);
  console.log(fail ? `\n${fail} FAILED` : '\nALL PASSED');
  await b.close(); srv.close(); process.exit(fail ? 1 : 0);
})();
