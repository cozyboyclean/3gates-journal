// Needs a test video at app/__test.mp4 (60s, H.264). Run: PLAYWRIGHT=/path/to/playwright node tests/clip-test.js
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = require('path').join(__dirname, '..', 'app');
const srv = http.createServer((q, r) => { const u = decodeURIComponent(q.url.split('?')[0]); const f = path.join(ROOT, u === '/' ? 'index.html' : u); fs.stat(f, (e, st) => { if (e) { r.statusCode = 404; return r.end(); } const type = f.endsWith('.html') ? 'text/html' : f.endsWith('.js') ? 'text/javascript' : f.endsWith('.mp4') ? 'video/mp4' : 'application/octet-stream'; const m = /bytes=(\d+)-(\d*)/.exec(q.headers.range || ''); if (m) { const s = +m[1], en = m[2] ? +m[2] : st.size - 1; r.writeHead(206, { 'content-type': type, 'accept-ranges': 'bytes', 'content-range': `bytes ${s}-${en}/${st.size}`, 'content-length': en - s + 1 }); fs.createReadStream(f, { start: s, end: en }).pipe(r); } else { r.writeHead(200, { 'content-type': type, 'content-length': st.size, 'accept-ranges': 'bytes' }); fs.createReadStream(f).pipe(r); } }); }).listen(8766);
let fail = 0; const chk = (n, ok, i) => { if (!ok) fail++; console.log(`${ok ? 'PASS' : 'FAIL'} ${n}${i !== undefined ? ' · ' + JSON.stringify(i) : ''}`); };
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome' });
  const pg = await b.newPage({ viewport: { width: 1440, height: 1000 } });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.addInitScript(() => {
    // fake desktop bridge: same API as preload.js; video served over http instead of journal-media://
    window.__cuts = []; let saved = null;
    window.desktop = { load: () => saved, save: t => { saved = t; return Promise.resolve(true); }, saveSync: t => { saved = t; }, addMedia: () => Promise.resolve({ file: 'whole.mp4' }), deleteMedia: () => Promise.resolve(true), pathFor: () => 'C:\\Videos\\session.mp4',
      clip: { available: () => Promise.resolve(true), pick: () => Promise.resolve({ token: 'tok1', name: 'session.mp4', size: 1 }), open: () => Promise.resolve({ token: 'tok1', name: 'session.mp4' }), remux: () => Promise.resolve({ token: 'tok2' }),
        cut: o => { window.__cuts.push(o); return new Promise(r => setTimeout(() => r({ file: 'cut' + window.__cuts.length + '.mp4', size: 3e6 }), 200)); }, onProgress: () => { } } };
  });
  await pg.goto('http://localhost:8766/index.html'); await pg.waitForTimeout(500);
  await pg.evaluate(() => { clipUrl = () => '/__test.mp4'; });
  await pg.evaluate(() => openTradeForm(null)); await pg.waitForTimeout(200);
  chk('cut-from-recording button in form', await pg.isVisible('[data-act="clip-pick"]'));
  await pg.click('[data-act="clip-pick"]'); await pg.waitForSelector('#clipper');
  await pg.waitForFunction(() => CL && CL.dur > 50);
  // keyboard: seek, mark in/out
  await pg.evaluate(() => { clipV().currentTime = 12.4; }); await pg.waitForTimeout(250); await pg.keyboard.press('i');
  await pg.keyboard.press('Shift+ArrowRight'); await pg.waitForTimeout(250); await pg.keyboard.press('.'); await pg.waitForTimeout(250); await pg.keyboard.press('o');
  const marks = await pg.evaluate(() => ({ in: CL.in, out: CL.out, disabled: $('#cl-cut').disabled, len: $('#cl-len').textContent }));
  chk('I / Shift+→ / . / O set a 5s+1frame selection', Math.abs(marks.in - 12.4) < .05 && Math.abs(marks.out - (17.4 + 1 / 30)) < .06 && !marks.disabled, marks);
  await pg.fill('#cl-name', 'ZPS long at VAL'); await pg.screenshot({ path: require('os').tmpdir() + '/clipper.png' });
  await pg.keyboard.press('Enter'); await pg.waitForFunction(() => !CL.busy && CL.clips.length === 1);
  const r1 = await pg.evaluate(() => ({ cut: window.__cuts[0], shots: F.shots, added: F._added, in: CL.in, out: CL.out }));
  chk('Enter cuts the exact range from the source token', r1.cut.token === 'tok1' && Math.abs(r1.cut.start - 12.4) < .05, r1.cut);
  chk('clip attached to trade with name', r1.shots.length === 1 && r1.shots[0].kind === 'video' && r1.shots[0].name === 'ZPS long at VAL' && r1.added.includes('cut1.mp4'), r1.shots);
  chk('next clip starts where the last ended', Math.abs(r1.in - r1.cut.end) < .001 && r1.out === null);
  // second clip via buttons, with the end before the start blocked
  await pg.evaluate(() => { clipV().currentTime = 5; }); await pg.waitForTimeout(250); await pg.click('[data-cl="out"]');
  chk('end before start is blocked', await pg.evaluate(() => $('#cl-cut').disabled && $('#cl-len').textContent.includes('after')));
  await pg.evaluate(() => { clipV().currentTime = 30; }); await pg.waitForTimeout(250); await pg.click('[data-cl="in"]'); await pg.evaluate(() => { clipV().currentTime = 41; }); await pg.waitForTimeout(250); await pg.click('[data-cl="out"]');
  await pg.click('[data-cl="cut"]'); await pg.waitForFunction(() => !CL.busy && CL.clips.length === 2);
  await pg.screenshot({ path: require('os').tmpdir() + '/clipper2.png' });
  await pg.keyboard.press('Escape'); await pg.waitForTimeout(200);
  chk('Esc closes only the cutter, trade form stays open', !(await pg.$('#clipper')) && !!(await pg.$('#modal .modal')) && (await pg.evaluate(() => F.shots.length)) === 2);
  await pg.screenshot({ path: require('os').tmpdir() + '/form-clips.png' });
  // trim an attached clip
  chk('Trim button on attached clips', await pg.isVisible('[data-trimshot="0"]'));
  await pg.click('[data-trimshot="0"]'); await pg.waitForSelector('#clipper');
  await pg.waitForFunction(() => CL && CL.dur > 50 && CL.out > 50);
  await pg.evaluate(() => { clipV().currentTime = 2; }); await pg.waitForTimeout(200); await pg.keyboard.press('i');
  await pg.keyboard.press('Enter'); await pg.waitForFunction(() => !CL);
  const r3 = await pg.evaluate(() => ({ cut: window.__cuts[2], shot: F.shots[0] }));
  chk('trim cuts from the attached file and replaces it', r3.cut.file === 'cut1.mp4' && r3.shot.file === 'cut3.mp4' && r3.shot.name === 'ZPS long at VAL', r3);
  // dropping a single video opens the cutter instead of copying it
  await pg.evaluate(() => addShots([new File(['x'], 'session.mp4', { type: 'video/mp4' })])); await pg.waitForTimeout(300);
  chk('dropping a recording opens the cutter with "whole file" option', !!(await pg.$('#clipper')) && await pg.isVisible('[data-cl="whole"]'));
  await pg.click('[data-cl="whole"]'); await pg.waitForTimeout(300);
  chk('"whole file" falls back to the old copy behavior', (await pg.evaluate(() => F.shots.map(s => s.file))).includes('whole.mp4'));
  // save, reopen
  await pg.fill('#en-0-price', '20000'); await pg.click('[data-act="save-trade"]'); await pg.waitForTimeout(300);
  chk('trade saves with clips', await pg.evaluate(() => S.trades[0] && S.trades[0].shots.length === 3));
  chk('no page errors', !errs.length, errs);
  console.log(fail ? `${fail} FAILED` : 'ALL PASSED'); await b.close(); srv.close(); process.exit(fail ? 1 : 0);
})();
