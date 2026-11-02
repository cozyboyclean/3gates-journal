/* ===== trade form, detail drawer, import, events, boot ===== */
'use strict';
let F = null; // trade being edited

function blankTrade() {
  const s = S.settings; const now = new Date(); now.setSeconds(0, 0);
  const i0 = s.instruments[0] || { sym: 'ES', fee: 0 };
  return { id: uid(), account: (G.account !== 'all' ? G.account : s.defaultAccount) || s.accounts[0].id, instrument: i0.sym, dir: 'long', entryTime: lt(now), entry: null, size: 1, stop: null, target: null, exits: [{ price: null, size: 1, time: lt(now) }], fees: i0.fee || 0, setup: s.setups[0] || '', mfe: null, mae: null, stats: {}, comments: { pre: [], entry: [], mgmt: [], exit: [] }, notes: '', shots: [], _feeAuto: true };
}
function shotSrc(s) { return s.file ? 'journal-media://m/' + encodeURIComponent(s.file) : s.id ? '/_blob/' + s.id : s.data; }
const isVid = s => s.kind === 'video';
function mediaThumb(sh, i, removable) {
  const src = esc(shotSrc(sh));
  const inner = isVid(sh)
    ? `<video src="${src}#t=0.1" preload="metadata" muted playsinline></video><span class="playbadge" aria-hidden="true">▶</span>`
    : `<img src="${src}" alt="Screenshot ${i + 1}">`;
  return `<div class="shot ${isVid(sh) ? 'vid' : ''}"><button class="shot-open" data-zoom="${src}" data-kind="${isVid(sh) ? 'video' : 'image'}" aria-label="Open ${isVid(sh) ? 'clip' : 'screenshot'} ${i + 1}">${inner}</button>${sh.name ? `<span class="shot-name">${esc(sh.name)}</span>` : ''}${removable ? `<button class="btn sm shot-rm" data-delshot="${i}">Remove</button>` : ''}</div>`;
}
function discardForm() {
  if (F && F._added) { const keep = new Set(mediaFiles(S.trades.find(t => t.id === F.id))); deleteMedia(F._added.filter(f => !keep.has(f))); }
  F = null; IMP = null; closeModal();
}

function openTradeForm(t) {
  F = t ? clone(cleanTrade(t)) : blankTrade();
  if (t) F._feeAuto = false;
  F._added = []; F._orig = mediaFiles(t);
  F.comments = Object.assign({ pre: [], entry: [], mgmt: [], exit: [] }, F.comments || {}); F.stats = F.stats || {}; F.shots = F.shots || []; F.exits = F.exits?.length ? F.exits : [{ price: null, size: F.size || 1, time: F.entryTime }];
  drawForm();
}
function drawForm() {
  const s = S.settings; const isNew = !S.trades.some(x => x.id === F.id);
  const inp = (k, l, type = 'number', extra = '') => `<div class="f ${extra}"><label for="ff-${k}">${l}</label><input class="inp ${type === 'number' ? 'num' : ''}" id="ff-${k}" type="${type}" ${type === 'number' ? 'step="any"' : ''} data-f="${k}" value="${esc(F[k] ?? '')}"></div>`;
  openModal(`<div class="modal" role="dialog" aria-label="Trade">
    <div class="mhead"><h3>${isNew ? 'New trade' : 'Edit trade'}</h3><button class="btn ghost" data-act="close">Close</button></div>
    <div class="mbody">
      <div class="preview" id="fprev"></div>
      <div class="sec-t">Trade</div>
      <div class="fgrid">
        <div class="f"><label for="ff-account">Account</label><select class="sel" id="ff-account" data-f="account">${s.accounts.map(a => `<option value="${esc(a.id)}" ${F.account === a.id ? 'selected' : ''}>${esc(a.name)}</option>`).join('')}</select></div>
        <div class="f"><label for="ff-instrument">Instrument</label><select class="sel" id="ff-instrument" data-f="instrument">${[...new Set([...s.instruments.map(i => i.sym), F.instrument])].map(x => `<option ${F.instrument === x ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select></div>
        <div class="f"><label>Direction</label><div class="seg" style="width:100%"><button style="flex:1" class="${F.dir !== 'short' ? 'on' : ''}" data-dir="long">Long</button><button style="flex:1" class="${F.dir === 'short' ? 'on' : ''}" data-dir="short">Short</button></div></div>
        <div class="f"><label for="ff-setup">Setup</label><select class="sel" id="ff-setup" data-f="setup"><option value="">—</option>${[...new Set([...s.setups, F.setup].filter(Boolean))].map(x => `<option ${F.setup === x ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select></div>
        ${inp('entryTime', 'Entry time', 'datetime-local')}${inp('entry', 'Entry price')}${inp('size', 'Contracts')}${inp('fees', 'Commission & fees')}
        ${inp('stop', 'Initial stop')}${inp('target', 'Planned target')}${inp('mfe', 'Best price reached (MFE)')}${inp('mae', 'Worst price reached (MAE)')}
      </div>
      <div class="sec-t">Exits</div>
      <div class="stack" style="gap:8px" id="exits">${F.exits.map((e, i) => `<div class="exitrow">
        <div class="f"><label>Exit price</label><input class="inp num" type="number" step="any" data-ex="${i}:price" value="${esc(e.price ?? '')}"></div>
        <div class="f"><label>Contracts</label><input class="inp num" type="number" step="any" data-ex="${i}:size" value="${esc(e.size ?? '')}"></div>
        <div class="f"><label>Exit time</label><input class="inp" type="datetime-local" data-ex="${i}:time" value="${esc(e.time ?? '')}"></div>
        <button class="btn sm ghost" data-delexit="${i}" ${F.exits.length < 2 ? 'disabled' : ''}>Remove</button></div>`).join('')}
        <div><button class="btn sm" data-act="add-exit">${icon('plus')}Add partial exit</button> <span class="hint">Leave exit price empty to log an open trade.</span></div></div>
      <div class="sec-t">Custom statistics</div>
      <div class="grid g3">${s.stats.map(st => `<div class="stack" style="gap:6px"><span class="lbl">${esc(st.name)}</span><div class="chips">${[...new Set([...st.values, ...(F.stats[st.id] || [])])].map(v => `<button class="chip ${(F.stats[st.id] || []).includes(v) ? 'on' : ''}" data-stat="${esc(st.id)}" data-val="${esc(v)}">${esc(v)}</button>`).join('')}</div></div>`).join('')}</div>
      <div class="sec-t">Comments</div>
      <div class="cgrid">${CATS.map(c => `<div class="stack" style="gap:6px"><span class="lbl">${CAT[c]}</span><div class="chips">${s.comments[c].map(x => `<button class="chip ${x.r > 0 ? 'cp' : 'cn'} ${(F.comments[c] || []).some(y => y.t === x.t) ? 'on' : ''}" data-cmtpick="${c}" data-val="${esc(x.t)}">${x.r > 0 ? '+ ' : '− '}${esc(x.t)}</button>`).join('')}</div></div>`).join('')}</div>
      <div class="sec-t">Notes, screenshots & clips</div>
      <textarea class="inp" data-f="notes" placeholder="What did you see? Why did you take it? What would you do differently?">${esc(F.notes || '')}</textarea>
      <div class="shots" id="shots">${F.shots.map((sh, i) => mediaThumb(sh, i, true)).join('')}
        <label class="drop" for="shot-in" id="dropzone"><span><b>Add screenshots or clips</b><br>Click, drag files here, or paste a screenshot</span><input type="file" id="shot-in" accept="image/*,video/*,.mp4,.mov,.webm,.m4v,.mkv" multiple hidden></label></div>
      <div class="hint" id="shot-status"></div>
    </div>
    <div class="mfoot"><span class="hint" id="ferr"></span><div class="row"><button class="btn" data-act="close">Cancel</button><button class="btn pri" data-act="save-trade">${isNew ? 'Save trade' : 'Save changes'}</button></div></div>
  </div>`);
  updatePreview();
}
function updatePreview() {
  const t = calc(clone(Object.assign({}, F, { _: null })));
  const el = $('#fprev'); if (!el) return;
  el.innerHTML = `<div><label>Net P&L</label><b class="${cls(t._.pnl)}">${t._.closed ? fmtS$(t._.pnl, 2) : 'open'}</b></div>
    <div><label>R multiple</label><b class="${cls(t._.r)}">${fmtR(t._.r)}</b></div>
    <div><label>Risk</label><b>${t._.risk ? fmt$(t._.risk, 0) : '—'}</b></div>
    <div><label>Planned R:R</label><b>${f2(t._.planR)}</b></div>
    <div><label>Hold / exit eff.</label><b>${fmtDur(t._.dur)} · ${pct(t._.eff, 0)}</b></div>`;
}
function saveForm() {
  const err = $('#ferr');
  if (!isNum(F.entry)) { err.textContent = 'Enter an entry price.'; return; }
  if (!F.entryTime) { err.textContent = 'Enter an entry time.'; return; }
  F.exits = F.exits.filter(e => isNum(e.price));
  F.exits.forEach(e => { if (!isNum(e.size)) e.size = F.size || 1; if (!e.time) e.time = F.entryTime; });
  const exSz = sum(F.exits.map(e => e.size));
  if (F.exits.length && isNum(F.size) && exSz > F.size + 1e-9) { err.textContent = `Exits total ${exSz} contracts but the position is ${F.size}.`; return; }
  if (isNum(F.stop) && ((F.dir === 'long' && F.stop >= F.entry) || (F.dir === 'short' && F.stop <= F.entry))) { err.textContent = `The stop is on the wrong side of entry for a ${F.dir} trade.`; return; }
  const removed = (F._orig || []).filter(f => !mediaFiles(F).includes(f));
  deleteMedia(removed);
  delete F._feeAuto; delete F._added; delete F._orig;
  const t = clone(F);
  saveTrade(t); closeModal(); F = null;
  S.showDemo = false;
  toast('Trade saved'); render();
}

const VID_EXT = /\.(mp4|m4v|mov|webm|mkv)$/i;
async function addShots(files) {
  const status = $('#shot-status');
  for (const file of files) {
    const video = file.type.startsWith('video/') || VID_EXT.test(file.name || '');
    if (!video && !file.type.startsWith('image/')) { toast(`${file.name} isn't an image or video`); continue; }
    try {
      if (DESK && DESK.addMedia) {
        if (status) status.textContent = `Adding ${file.name || 'screenshot'}…`;
        const p = DESK.pathFor ? DESK.pathFor(file) : '';
        const r = p ? await DESK.addMedia({ path: p }) : await DESK.addMedia({ bytes: await file.arrayBuffer(), ext: (file.type.split('/')[1] || 'png').replace('jpeg', 'jpg') });
        F.shots.push(video ? { file: r.file, kind: 'video', name: file.name || '' } : { file: r.file });
        F._added.push(r.file);
        if (status) status.textContent = '';
        continue;
      }
      if (video) {
        if (Store.mode === 'db' && Store.assets) {
          if (file.size > 20 * 1024 * 1024) { toast('Clips over 20 MB only fit in the desktop app. Export a shorter or smaller clip.'); continue; }
          if (status) status.textContent = `Uploading ${file.name}…`;
          const r = await Store.assets.upload(file);
          F.shots.push({ id: r.id, kind: 'video', name: file.name || '' });
          if (status) status.textContent = '';
        } else toast('Video clips need the desktop app.');
        continue;
      }
      if (Store.mode === 'db' && Store.assets) {
        const r = await Store.assets.upload(file);
        F.shots.push({ id: r.id });
      } else {
        const data = await shrink(file, Store.mode === 'db' ? 900 : 1400, Store.mode === 'db' ? 0.6 : 0.75);
        if (Store.mode === 'db' && data.length > 180000) { toast('That image is too large to store with the trade.'); continue; }
        F.shots.push({ data });
      }
    } catch (e) { if (status) status.textContent = ''; toast('Could not add file: ' + (e?.message || e?.code || 'error')); }
  }
  if (F) drawFormKeepScroll();
}
function shrink(file, max, q) {
  return new Promise((res, rej) => {
    const img = new Image(); const url = URL.createObjectURL(file);
    img.onload = () => { const k = Math.min(1, max / Math.max(img.width, img.height)); const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url); res(c.toDataURL('image/jpeg', q)); };
    img.onerror = rej; img.src = url;
  });
}
function drawFormKeepScroll() { const sc = $('.scrim'); const y = sc ? sc.scrollTop : 0; drawForm(); const s2 = $('.scrim'); if (s2) s2.scrollTop = y; }

/* ---------- trade detail drawer ---------- */
function openDetail(id) {
  const t = allTrades().find(x => x.id === id); if (!t) return;
  const x = t._;
  const statsH = S.settings.stats.map(st => (t.stats?.[st.id] || []).length ? `<div><span class="lbl">${esc(st.name)}</span><div class="chips" style="margin-top:4px">${t.stats[st.id].map(v => `<span class="chip on">${esc(v)}</span>`).join('')}</div></div>` : '').join('');
  const cm = CATS.map(c => (t.comments?.[c] || []).length ? `<div><span class="lbl">${CAT[c]}</span><div class="chips" style="margin-top:4px">${t.comments[c].map(v => `<span class="chip on ${v.r > 0 ? 'cp' : 'cn'}">${v.r > 0 ? '+ ' : '− '}${esc(v.t)}</span>`).join('')}</div></div>` : '').join('');
  openDrawer(`<div class="mhead"><h3>${esc(t.instrument)} <span class="pill ${t.dir === 'short' ? 'short' : 'long'}">${t.dir === 'short' ? 'Short' : 'Long'}</span> <span class="pill ${x.res}">${x.res === 'OPEN' ? 'Open' : x.res}</span></h3><button class="btn ghost" data-act="close-drawer">Close</button></div>
    <div class="dbody">
      <div class="row between"><span class="muted">${fmtDate(t.entryTime, true)} · ${esc(t.setup || 'No setup')}</span><b class="num ${cls(x.pnl)}" style="font-size:22px">${x.closed ? fmtS$(x.pnl, 2) : 'Open'}</b></div>
      <div class="kv">
        <div><label>R multiple</label><b class="${cls(x.r)}">${fmtR(x.r)}</b></div><div><label>Planned R:R</label><b>${f2(x.planR)}</b></div><div><label>Risk</label><b>${fmt$(x.risk, 0)}</b></div>
        <div><label>Entry</label><b>${t.entry}</b></div><div><label>Avg exit</label><b>${isNum(x.avgExit) ? +x.avgExit.toFixed(4) : '—'}</b></div><div><label>Contracts</label><b>${x.size}</b></div>
        <div><label>Stop</label><b>${t.stop ?? '—'}</b></div><div><label>Target</label><b>${t.target ?? '—'}</b></div><div><label>Points</label><b class="${cls(x.pts)}">${isNum(x.pts) ? x.pts.toFixed(2) : '—'}</b></div>
        <div><label>MFE</label><b>${fmtR(x.mfeR)}</b></div><div><label>MAE</label><b>${isNum(x.maeR) ? '−' + x.maeR.toFixed(2) + 'R' : '—'}</b></div><div><label>Exit efficiency</label><b>${pct(x.eff, 0)}</b></div>
        <div><label>Hold time</label><b>${fmtDur(x.dur)}</b></div><div><label>Fees</label><b>${fmt$(x.fees, 2)}</b></div><div><label>Account</label><b style="font-family:var(--ui)">${esc(S.settings.accounts.find(a => a.id === t.account)?.name || '—')}</b></div>
      </div>
      ${(t.exits || []).length > 1 ? `<div><span class="lbl">Exits</span><table style="margin-top:4px"><tbody>${t.exits.map(e => `<tr><td class="num">${e.price}</td><td class="num">${e.size} ct</td><td class="muted">${fmtDate(e.time, true)}</td></tr>`).join('')}</tbody></table></div>` : ''}
      ${statsH}${cm}
      ${t.notes ? `<div><span class="lbl">Notes</span><div class="note" style="margin-top:4px">${esc(t.notes)}</div></div>` : ''}
      ${(t.shots || []).length ? `<div><span class="lbl">Screenshots & clips</span><div class="shots" style="margin-top:6px">${t.shots.map((sh, i) => mediaThumb(sh, i, false)).join('')}</div></div>` : ''}
      ${t.demo ? '<div class="banner">This is a sample trade. Log your own to edit and delete.</div>' : `<div class="row" id="dact"><button class="btn pri" data-edit="${esc(t.id)}">Edit</button><button class="btn" data-dup="${esc(t.id)}">Duplicate</button><button class="btn danger" data-del="${esc(t.id)}">Delete</button></div>`}
    </div>`);
}

/* ---------- CSV ---------- */
function parseCSV(text) {
  const rows = []; let row = [], f = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true; else if (c === ',' || c === ';' || c === '\t') { row.push(f); f = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(f); rows.push(row); row = []; f = ''; }
    else f += c;
  }
  if (f.length || row.length) { row.push(f); rows.push(row); }
  return rows.filter(r => r.some(x => x.trim() !== ''));
}
const IMPF = [
  ['entryTime', 'Entry date/time', /(entry|open|bought|buy).*(time|date)|^date|^time|timestamp|opened/i, true],
  ['exitTime', 'Exit date/time', /(exit|close|sold|sell).*(time|date)|closed/i],
  ['instrument', 'Instrument / symbol', /symbol|instrument|contract|ticker|market/i],
  ['dir', 'Side (long/short)', /side|direction|type|b\/s|buy.?sell|action|long.?short/i, true],
  ['size', 'Quantity', /qty|quantity|size|contracts|lots|amount/i, true],
  ['entry', 'Entry price', /(entry|open|buy|avg.?entry).*price|^entry$|^price$|buyprice/i, true],
  ['exit', 'Exit price', /(exit|close|sell).*price|^exit$|sellprice/i, true],
  ['fees', 'Fees / commission', /fee|comm/i],
  ['stop', 'Stop loss', /stop|sl$/i],
  ['target', 'Take profit', /target|take.?profit|tp$/i],
];
let IMP = null;
function openImport() {
  IMP = { rows: null, map: {}, account: (G.account !== 'all' ? G.account : S.settings.defaultAccount), defInst: S.settings.instruments[0]?.sym || 'ES' };
  drawImport();
}
function drawImport() {
  const hdr = IMP.rows ? IMP.rows[0] : null;
  openModal(`<div class="modal narrow"><div class="mhead"><h3>Import trades from CSV</h3><button class="btn ghost" data-act="close">Close</button></div>
    <div class="mbody">
      ${!hdr ? `<p class="hint">Export a trade history from your platform (MotiveWave, Rithmic R|Trader, Tradovate, NinjaTrader, a prop dashboard) with one row per round-trip trade, then choose the file. You'll match its columns on the next step.</p>
        <label class="btn pri" style="align-self:flex-start">Choose CSV file<input type="file" accept=".csv,text/csv,.txt" id="csv-in" hidden></label>` : `
        <p class="hint">${IMP.rows.length - 1} rows found. Match each field to a column. Required fields are marked *.</p>
        <div class="fgrid" style="grid-template-columns:1fr 1fr">
        ${IMPF.map(([k, l, , req]) => `<div class="f"><label>${l}${req ? ' *' : ''}</label><select class="sel" data-imp="${k}"><option value="">— not in file —</option>${hdr.map((h, i) => `<option value="${i}" ${String(IMP.map[k]) === String(i) ? 'selected' : ''}>${esc(h || 'Column ' + (i + 1))}</option>`).join('')}</select></div>`).join('')}
        <div class="f"><label>Instrument if missing</label><select class="sel" data-impo="defInst">${S.settings.instruments.map(i => `<option ${IMP.defInst === i.sym ? 'selected' : ''}>${esc(i.sym)}</option>`).join('')}</select></div>
        <div class="f"><label>Import into account</label><select class="sel" data-impo="account">${S.settings.accounts.map(a => `<option value="${esc(a.id)}" ${IMP.account === a.id ? 'selected' : ''}>${esc(a.name)}</option>`).join('')}</select></div>
        </div><div id="imp-prev" class="hint"></div>`}
    </div>
    ${hdr ? `<div class="mfoot"><button class="btn ghost" data-act="imp-restart">Choose another file</button><button class="btn pri" data-act="imp-go">Import trades</button></div>` : ''}</div>`);
  if (hdr) impPreview();
}
function guessMap(hdr) {
  const m = {}; const used = new Set();
  for (const [k, , re] of IMPF) { const i = hdr.findIndex((h, j) => !used.has(j) && re.test(h.trim())); if (i >= 0) { m[k] = i; used.add(i); } }
  return m;
}
function parseAnyDate(s) {
  if (!s) return null; s = s.trim();
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})[ T]?(\d{1,2})?:?(\d{2})?(?::(\d{2}))?\s*(am|pm)?/i);
  let d;
  if (m) d = new Date(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0));
  else if ((m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})[ T]*(\d{1,2})?:?(\d{2})?(?::(\d{2}))?\s*(am|pm)?/i))) { let y = +m[3]; if (y < 100) y += 2000; d = new Date(y, +m[1] - 1, +m[2], +(m[4] || 0), +(m[5] || 0)); }
  else { d = new Date(s); if (isNaN(d)) return null; return lt(d); }
  const ap = m[7]; if (ap) { let h = d.getHours() % 12; if (/pm/i.test(ap)) h += 12; d.setHours(h); }
  return isNaN(d) ? null : lt(d);
}
function normInst(s) {
  const raw = String(s || '').toUpperCase().replace(/^[@/]/, '').trim(); if (!raw) return null;
  const syms = S.settings.instruments.map(i => i.sym.toUpperCase()).sort((a, b) => b.length - a.length);
  const hit = syms.find(x => raw === x || raw.startsWith(x + ' ') || new RegExp('^' + x + '[FGHJKMNQUVXZ]\\d{1,4}').test(raw) || raw.startsWith(x + '.'));
  return hit || raw;
}
function buildImported() {
  const [, ...rows] = IMP.rows; const M = IMP.map; const out = []; let bad = 0;
  const g = (r, k) => M[k] === undefined || M[k] === '' ? '' : (r[+M[k]] ?? '').trim();
  const n = v => { const x = parseFloat(String(v).replace(/[$,\s]/g, '').replace(/^\((.*)\)$/, '-$1')); return isFinite(x) ? x : null; };
  for (const r of rows) {
    const et = parseAnyDate(g(r, 'entryTime')); const side = g(r, 'dir').toLowerCase(); const entry = n(g(r, 'entry')), exit = n(g(r, 'exit')); let size = Math.abs(n(g(r, 'size')) ?? 1);
    if (!et || entry == null) { bad++; continue; }
    const dir = /^(s|sell|short|sld|sl)/.test(side) || /short|sell/.test(side) ? 'short' : 'long';
    const instrument = normInst(g(r, 'instrument')) || IMP.defInst;
    const xt = parseAnyDate(g(r, 'exitTime')) || et;
    const fees = n(g(r, 'fees'));
    out.push(calc({ id: uid(), account: IMP.account, instrument, dir, entryTime: et, entry, size, stop: n(g(r, 'stop')), target: n(g(r, 'target')), exits: exit == null ? [] : [{ price: exit, size, time: xt }], fees: fees == null ? +(size * (inst(instrument).fee || 0)).toFixed(2) : Math.abs(fees), setup: '', mfe: null, mae: null, stats: {}, comments: { pre: [], entry: [], mgmt: [], exit: [] }, notes: '', shots: [], imported: true }));
  }
  return { out, bad };
}
function impPreview() {
  const el = $('#imp-prev'); if (!el) return;
  const miss = IMPF.filter(f => f[3] && (IMP.map[f[0]] === undefined || IMP.map[f[0]] === '')).map(f => f[1]);
  if (miss.length) { el.innerHTML = `Still needed: <b>${miss.map(esc).join(', ')}</b>`; return; }
  const { out, bad } = buildImported(); const m = metrics(out);
  el.innerHTML = `<b>${out.length}</b> trades ready · net <b class="num ${cls(m.net)}">${fmtS$(m.net, 2)}</b>${bad ? ` · ${bad} rows skipped (no date or entry price)` : ''}${out[0] ? `<br>First: ${esc(out[0].instrument)} ${out[0].dir} ${out[0]._.size} @ ${out[0].entry} on ${fmtDate(out[0].entryTime, true)}` : ''}`;
}

function exportCSV() {
  const st = S.settings.stats;
  const head = ['Entry time', 'Exit time', 'Account', 'Instrument', 'Direction', 'Contracts', 'Entry', 'Avg exit', 'Stop', 'Target', 'MFE price', 'MAE price', 'Fees', 'Net P&L', 'R', 'Setup', ...st.map(s => s.name), ...CATS.map(c => 'Comments ' + CAT[c]), 'Notes'];
  const q = v => { const s = String(v ?? ''); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const rows = S.trades.slice().sort((a, b) => a._.ts - b._.ts).map(t => [t.entryTime, (t.exits || []).map(e => e.time).sort().pop() || '', S.settings.accounts.find(a => a.id === t.account)?.name || '', t.instrument, t.dir, t._.size, t.entry, isNum(t._.avgExit) ? +t._.avgExit.toFixed(5) : '', t.stop ?? '', t.target ?? '', t.mfe ?? '', t.mae ?? '', t._.fees, isNum(t._.pnl) ? t._.pnl.toFixed(2) : '', isNum(t._.r) ? t._.r.toFixed(3) : '', t.setup || '', ...st.map(s => (t.stats?.[s.id] || []).join('; ')), ...CATS.map(c => (t.comments?.[c] || []).map(x => x.t).join('; ')), t.notes || ''].map(q).join(','));
  if (!rows.length) { toast('No trades to export yet'); return; }
  offerFile(`trades-${ymd(new Date())}.csv`, [head.map(q).join(','), ...rows].join('\n'));
}
function exportJSON() {
  offerFile(`trade-journal-backup-${ymd(new Date())}.json`, JSON.stringify({ app: '3gates-journal', v: 1, exported: new Date().toISOString(), settings: S.settings, trades: S.trades.map(cleanTrade), journal: S.journal }, null, 1));
}

/* ---------- events ---------- */
function goto(v) { S.view = v; closeDrawer(); try { history.replaceState(null, '', '#' + v); } catch (e) { } render(); window.scrollTo(0, 0); }
function accEl(el) { const a = el.closest('[data-acc]'); return a && S.settings.accounts.find(x => x.id === a.dataset.acc); }

document.addEventListener('click', async e => {
  const el = e.target.closest('[data-act],[data-nav],[data-trade],[data-sub],[data-dir],[data-stat],[data-cmtpick],[data-delexit],[data-delshot],[data-zoom],[data-edit],[data-dup],[data-del],[data-simex],[data-cal],[data-day],[data-jd],[data-delinst],[data-delsetup],[data-delstat],[data-delval],[data-addval],[data-rate],[data-delcmt],[data-addcmt],[data-deltx],[data-scrim]');
  if (!el) return;
  const d = el.dataset;
  if (d.scrim) { if (e.target === el) discardForm(); return; }
  if (d.zoom) {
    const lb = document.createElement('div'); lb.className = 'lightbox';
    if (d.kind === 'video') { lb.innerHTML = `<video src="${esc(d.zoom)}" controls autoplay playsinline></video><button class="btn lb-close">Close</button>`; lb.onclick = ev => { if (ev.target === lb || ev.target.classList.contains('lb-close')) lb.remove(); }; }
    else { lb.innerHTML = `<img src="${esc(d.zoom)}" alt="Screenshot">`; lb.onclick = () => lb.remove(); }
    document.body.appendChild(lb); return;
  }
  if (d.nav) return goto(d.nav);
  if (d.trade) return openDetail(d.trade);
  if (d.sub) { const [k, v] = d.sub.split(':'); S.sub[k] = v; return render(); }
  if (d.dir && F) { F.dir = d.dir; $$('[data-dir]').forEach(b => b.classList.toggle('on', b.dataset.dir === d.dir)); return updatePreview(); }
  if (d.stat && F) { const a = F.stats[d.stat] || (F.stats[d.stat] = []); const i = a.indexOf(d.val); i >= 0 ? a.splice(i, 1) : a.push(d.val); el.classList.toggle('on'); return; }
  if (d.cmtpick && F) { const c = d.cmtpick; const a = F.comments[c]; const i = a.findIndex(x => x.t === d.val); if (i >= 0) a.splice(i, 1); else a.push({ t: d.val, r: (S.settings.comments[c].find(x => x.t === d.val) || {}).r || 1 }); el.classList.toggle('on'); return; }
  if (d.delexit != null && F) { F.exits.splice(+d.delexit, 1); return drawFormKeepScroll(); }
  if (d.delshot != null && F) { F.shots.splice(+d.delshot, 1); return drawFormKeepScroll(); }
  if (d.edit) { closeDrawer(); return openTradeForm(S.trades.find(t => t.id === d.edit)); }
  if (d.dup) { const src = S.trades.find(t => t.id === d.dup); closeDrawer(); openTradeForm(src); F.id = uid(); F.shots = []; F._orig = []; return drawForm(); }
  if (d.del) { $('#dact').innerHTML = `<div class="confirm">Delete this trade? <button class="btn sm danger" data-act="del-yes" data-id="${esc(d.del)}">Delete</button><button class="btn sm" data-act="close-drawer">Keep</button></div>`; return; }
  if (d.simex) { const i = SIM.ex.indexOf(d.simex); i >= 0 ? SIM.ex.splice(i, 1) : SIM.ex.push(d.simex); return render(); }
  if (d.cal) { S.sub.cal = d.cal; return render(); }
  if (d.day) { S.sub.jd = d.day; return goto('diary'); }
  if (d.jd) { S.sub.jd = d.jd; return render(); }
  const s = S.settings;
  if (d.delinst != null) { s.instruments.splice(+d.delinst, 1); saveSettings(); return render(); }
  if (d.delsetup != null) { s.setups.splice(+d.delsetup, 1); saveSettings(); return render(); }
  if (d.delstat != null) { s.stats.splice(+d.delstat, 1); saveSettings(); return render(); }
  if (d.delval) { const [a, b] = d.delval.split(':').map(Number); s.stats[a].values.splice(b, 1); saveSettings(); return render(); }
  if (d.addval != null) { const inp = $(`[data-newval="${d.addval}"]`); const v = inp.value.trim(); if (v && !s.stats[+d.addval].values.includes(v)) { s.stats[+d.addval].values.push(v); saveSettings(); render(); } return; }
  if (d.rate) { const [c, n] = d.rate.split(':'); s.comments[c][+n].r *= -1; saveSettings(); return render(); }
  if (d.delcmt) { const [c, n] = d.delcmt.split(':'); s.comments[c].splice(+n, 1); saveSettings(); return render(); }
  if (d.addcmt) { const inp = $(`[data-newcmt="${d.addcmt}"]`); const v = inp.value.trim(); if (v) { s.comments[d.addcmt].push({ t: v, r: 1 }); saveSettings(); render(); } return; }
  if (d.deltx) { const a = accEl(el); a.txns = a.txns.filter(x => x.id !== d.deltx); saveSettings(); return render(); }

  switch (d.act) {
    case 'close': return discardForm();
    case 'close-drawer': return closeDrawer();
    case 'copybox': { const ta = $('#copybox'); try { await navigator.clipboard.writeText(ta.value); toast('Copied'); } catch (_) { ta.select(); toast('Selected — press Ctrl/Cmd+C'); } return; }
    case 'new-trade': return openTradeForm(null);
    case 'save-trade': return saveForm();
    case 'add-exit': { const rem = Math.max(0, (F.size || 0) - sum(F.exits.map(x => x.size || 0))); F.exits.push({ price: null, size: rem || null, time: F.exits[F.exits.length - 1]?.time || F.entryTime }); return drawFormKeepScroll(); }
    case 'del-yes': deleteTrade(el.dataset.id); closeDrawer(); toast('Trade deleted'); return render();
    case 'hide-demo': S.showDemo = false; return render();
    case 'import-local': return importLocalIntoSync();
    case 'tf-desc': TF.desc = !TF.desc; return render();
    case 'import-csv': return openImport();
    case 'imp-restart': IMP.rows = null; return drawImport();
    case 'imp-go': {
      const miss = IMPF.filter(f => f[3] && (IMP.map[f[0]] === undefined || IMP.map[f[0]] === '')); if (miss.length) return impPreview();
      const { out } = buildImported(); if (!out.length) return toast('No rows could be read');
      out.forEach(t => saveTrade(t)); closeModal(); IMP = null; S.showDemo = false; toast(`Imported ${out.length} trades`); return render();
    }
    case 'export-csv': return exportCSV();
    case 'export-json': return exportJSON();
    case 'open-data': return DESK && DESK.openDataFolder();
    case 'sim-reset': Object.assign(SIM, { ex: [], target: '', stop: '', cap: '', worst: '', best: '', perDay: '', dayStop: '' }); return render();
    case 'add-account': { const id = 'acc_' + uid(); s.accounts.push({ id, name: 'New account', broker: '', start: 50000, txns: [] }); saveSettings(); return render(); }
    case 'default-acc': s.defaultAccount = accEl(el).id; saveSettings(); return render();
    case 'del-acc': S.sub.delAcc = accEl(el).id; return render();
    case 'del-acc-no': S.sub.delAcc = null; return render();
    case 'del-acc-yes': { const id = S.sub.delAcc; s.accounts = s.accounts.filter(a => a.id !== id); if (s.defaultAccount === id) s.defaultAccount = s.accounts[0].id; if (G.account === id) G.account = 'all'; S.sub.delAcc = null; saveSettings(); return render(); }
    case 'add-tx': { const a = accEl(el); const box = el.closest('[data-acc]'); const v = k => $(`[data-tx="${k}"]`, box).value; const amt = num(v('amount')); if (!amt) return toast('Enter an amount'); a.txns.push({ id: uid(), date: v('date'), type: v('type'), amount: Math.abs(amt), note: v('note') }); a.txns.sort((x, y) => x.date < y.date ? -1 : 1); saveSettings(); return render(); }
    case 'add-inst': s.instruments.push({ sym: 'NEW', pv: 1, tick: 0.01, fee: 0 }); saveSettings(); return render();
    case 'add-setup': { const v = $('#new-setup').value.trim(); if (v && !s.setups.includes(v)) { s.setups.push(v); saveSettings(); render(); } return; }
    case 'add-stat': { const v = $('#new-stat').value.trim(); if (v) { s.stats.push({ id: 'st' + uid(), name: v, values: [] }); saveSettings(); render(); } return; }
    case 'wipe': S.sub.wipe = true; return render();
    case 'wipe-no': S.sub.wipe = false; return render();
    case 'wipe-yes': { [...S.trades].forEach(t => deleteTrade(t.id)); Object.keys(S.journal).forEach(k => { if (Store.mode === 'db') writeDoc(Store.jcol.doc(k), 'd:' + k, null); }); S.journal = {}; saveLocal(); S.sub.wipe = false; toast('All trades deleted'); return render(); }
  }
});

let jTimer = null;
function onField(e) {
  const el = e.target; const d = el.dataset;
  if (d.f && F) {
    const k = d.f; const isN = ['entry', 'size', 'stop', 'target', 'fees', 'mfe', 'mae'].includes(k);
    F[k] = isN ? num(el.value) : el.value;
    if (k === 'fees') F._feeAuto = false;
    if ((k === 'size' || k === 'instrument') && F._feeAuto) { F.fees = +(((F.size || 0) * (inst(F.instrument).fee || 0))).toFixed(2); const fe = $('#ff-fees'); if (fe) fe.value = F.fees; }
    if (k === 'size' && F.exits.length === 1) { F.exits[0].size = F.size; const ex = $('[data-ex="0:size"]'); if (ex) ex.value = F.size ?? ''; }
    if (k === 'entryTime' && F.exits.length === 1 && (!F.exits[0].time || F.exits[0].time < F.entryTime)) { F.exits[0].time = F.entryTime; const ex = $('[data-ex="0:time"]'); if (ex) ex.value = F.entryTime; }
    return updatePreview();
  }
  if (d.ex && F) { const [i, k] = d.ex.split(':'); F.exits[+i][k] = k === 'time' ? el.value : num(el.value); return updatePreview(); }
  if (d.j) {
    const date = S.sub.jd || ymd(new Date()); const obj = Object.assign({}, S.journal[date] || {}, { [d.j]: el.value, date });
    S.journal[date] = obj; const sv = $('#jsaved'); if (sv) sv.textContent = 'Saving…';
    clearTimeout(jTimer); jTimer = setTimeout(() => { saveDay(date, obj); const s2 = $('#jsaved'); if (s2) s2.textContent = 'Saved'; }, el.tagName === 'SELECT' ? 0 : 700);
    return;
  }
  if (d.ror) { S.sub.ror[d.ror] = num(el.value) ?? 0; return rorRun(); }
}
document.addEventListener('input', e => {
  const el = e.target;
  if (el.id === 'tf-q') { TF.q = el.value; clearTimeout(onField.t); onField.t = setTimeout(() => { render(); const q = $('#tf-q'); if (q) { q.focus(); q.setSelectionRange(q.value.length, q.value.length); } }, 250); return; }
  if (el.dataset.sim) { SIM[el.dataset.sim] = el.value; clearTimeout(onField.s); onField.s = setTimeout(() => { const id = el.id; render(); const n = document.getElementById(id); if (n) { n.focus(); } }, 400); return; }
  if (el.type !== 'file' && el.tagName !== 'SELECT') onField(e);
});
document.addEventListener('change', async e => {
  const el = e.target; const d = el.dataset; const s = S.settings;
  if (el.tagName === 'SELECT' && (d.f || d.j)) return onField(e);
  if (el.id === 'g-acc') { G.account = el.value; saveFilters(); return render(); }
  if (el.id === 'g-range') { G.range = el.value; saveFilters(); return render(); }
  if (el.id === 'g-from' || el.id === 'g-to') { G[el.id.slice(2)] = el.value; saveFilters(); return render(); }
  if (el.id && el.id.startsWith('tf-') && el.id !== 'tf-q') { TF[el.id.slice(3)] = el.value; return render(); }
  if (el.id === 'edgeDim') { S.sub.edgeDim = el.value; return render(); }
  if (el.id === 'rx' || el.id === 'ry') { S.sub[el.id] = el.value; return render(); }
  if (el.id === 'minN') { S.sub.minN = Math.max(1, num(el.value) || 1); return render(); }
  if (el.id === 'sim-dim') { SIM.dim = el.value; return render(); }
  if (el.id === 'jd-pick' && el.value) { S.sub.jd = el.value; return render(); }
  if (el.id === 'shot-in') { await addShots([...el.files]); return; }
  if (el.id === 'csv-in') { const f = el.files[0]; if (!f) return; const rows = parseCSV(await f.text()); if (rows.length < 2) return toast('That file has no data rows'); IMP.rows = rows; IMP.map = guessMap(rows[0]); return drawImport(); }
  if (d.imp) { IMP.map[d.imp] = el.value; return impPreview(); }
  if (d.impo) { IMP[d.impo] = el.value; return impPreview(); }
  if (el.id === 'restore-json') {
    const f = el.files[0]; if (!f) return;
    try { const o = JSON.parse(await f.text()); if (!Array.isArray(o.trades)) throw new Error('No trades in file');
      S.settings = mergeDefaults(o.settings); saveSettings();
      const have = new Set(S.trades.map(t => t.id)); let n = 0;
      o.trades.forEach(t => { if (!have.has(t.id)) { saveTrade(calc(t)); n++; } });
      Object.entries(o.journal || {}).forEach(([k, v]) => saveDay(k, v));
      S.showDemo = false; toast(`Restored ${n} trades`); render();
    } catch (err) { toast('Could not read backup: ' + err.message); }
    return;
  }
  // settings fields
  if (d.inst) { const [n, k] = d.inst.split(':'); s.instruments[+n][k] = k === 'sym' ? el.value.trim().toUpperCase() : num(el.value) ?? 0; saveSettings(); S.trades.forEach(calc); return; }
  if (d.setup != null) { const old = s.setups[+d.setup]; const v = el.value.trim(); if (!v) return; s.setups[+d.setup] = v; saveSettings(); S.trades.filter(t => t.setup === old).forEach(t => { t.setup = v; saveTrade(t); }); return; }
  if (d.statname != null) { s.stats[+d.statname].name = el.value.trim() || s.stats[+d.statname].name; return saveSettings(); }
  if (d.cmt) { const [c, n] = d.cmt.split(':'); const old = s.comments[c][+n].t; const v = el.value.trim(); if (!v) return; s.comments[c][+n].t = v; saveSettings(); S.trades.forEach(t => { const x = (t.comments?.[c] || []).find(y => y.t === old); if (x) { x.t = v; saveTrade(t); } }); return; }
  if (el.id === 'cfg-cur') { s.currency = el.value || '$'; return saveSettings(); }
  if (el.id === 'cfg-be') { s.beR = Math.max(0, num(el.value) ?? 0.1); saveSettings(); S.trades.forEach(calc); return; }
  if (d.af) { const a = accEl(el); a[d.af] = d.af === 'start' ? num(el.value) : el.value; saveSettings(); return render(); }
});
// Drag files into the trade form; never let a dropped file replace the app page.
document.addEventListener('dragover', e => { e.preventDefault(); const dz = $('#dropzone'); if (dz && F) dz.classList.add('over'); });
document.addEventListener('dragleave', e => { if (!e.relatedTarget) { const dz = $('#dropzone'); if (dz) dz.classList.remove('over'); } });
document.addEventListener('drop', e => {
  e.preventDefault(); const dz = $('#dropzone'); if (dz) dz.classList.remove('over');
  const files = [...(e.dataTransfer?.files || [])];
  if (F && $('#shots') && files.length) addShots(files);
});
document.addEventListener('paste', e => {
  if (!F || !$('#shots')) return;
  const files = [...(e.clipboardData?.files || [])].filter(f => f.type.startsWith('image/'));
  if (files.length) { e.preventDefault(); addShots(files); }
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { const lb = $('.lightbox'); if (lb) return lb.remove(); if ($('#modal').innerHTML) return discardForm(); closeDrawer(); }
});
window.matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => render());
new MutationObserver(() => render()).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

/* ---------- boot ---------- */
(function boot() {
  const h = (location.hash || '').slice(1);
  if (VIEWS[h]) S.view = h;
  render();
  connect();
})();
