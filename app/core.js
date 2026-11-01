/* ===== core: helpers, state, storage, calculations ===== */
'use strict';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
const isNum = v => typeof v === 'number' && isFinite(v);
const num = v => (v === '' || v == null || isNaN(Number(v))) ? null : Number(v);
const sum = a => a.reduce((s, x) => s + (x || 0), 0);
const avg = a => a.length ? sum(a) / a.length : null;
const clone = o => JSON.parse(JSON.stringify(o));
const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const CAT = { pre: 'Pre-trade', entry: 'Entry', mgmt: 'Trade management', exit: 'Exit' };
const CATS = ['pre', 'entry', 'mgmt', 'exit'];

function cur() { return S.settings.currency || '$'; }
function fmt$(v, dp = 0) {
  if (!isNum(v)) return '—';
  const s = Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp });
  return (v < 0 ? '−' : '') + cur() + s;
}
function fmtS$(v, dp = 0) { return isNum(v) && v > 0 ? '+' + fmt$(v, dp) : fmt$(v, dp); }
function fmtR(v) { return !isNum(v) ? '—' : (v < 0 ? '−' : v > 0 ? '+' : '') + Math.abs(v).toFixed(2) + 'R'; }
function pct(v, dp = 1) { return !isNum(v) ? '—' : (v * 100).toFixed(dp) + '%'; }
function f2(v, dp = 2) { return !isNum(v) ? '—' : v.toFixed(dp); }
function cls(v) { return !isNum(v) ? '' : v > 0 ? 'pos' : v < 0 ? 'neg' : ''; }
function fmtDur(m) { if (!isNum(m)) return '—'; if (m < 60) return Math.round(m) + 'm'; const h = Math.floor(m / 60); return h + 'h ' + Math.round(m % 60) + 'm'; }

function parseLT(s) {
  if (!s) return null;
  const [d, t = '00:00'] = String(s).split('T');
  const [y, m, dd] = d.split('-').map(Number);
  const [hh, mm] = t.split(':').map(Number);
  if (!y || !m || !dd) return null;
  return new Date(y, m - 1, dd, hh || 0, mm || 0);
}
const pad = n => String(n).padStart(2, '0');
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const lt = d => `${ymd(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
function fmtDate(s, withTime) {
  const d = parseLT(s); if (!d) return '—';
  const base = `${MON[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
  return withTime ? `${base} ${pad(d.getHours())}:${pad(d.getMinutes())}` : base;
}
function fmtDay(s) { const d = parseLT(s); return d ? `${WD[d.getDay()]} ${MON[d.getMonth()]} ${d.getDate()}` : '—'; }

/* ---------- defaults ---------- */
function defaultSettings() {
  return {
    v: 1, currency: '$', beR: 0.1, defaultAccount: 'acc_main',
    accounts: [{ id: 'acc_main', name: 'Main account', broker: '', start: 50000, txns: [] }],
    instruments: [
      { sym: 'ES', pv: 50, tick: 0.25, fee: 4.5 }, { sym: 'MES', pv: 5, tick: 0.25, fee: 1.5 },
      { sym: 'NQ', pv: 20, tick: 0.25, fee: 4.5 }, { sym: 'MNQ', pv: 2, tick: 0.25, fee: 1.5 },
      { sym: 'YM', pv: 5, tick: 1, fee: 4.5 }, { sym: 'RTY', pv: 50, tick: 0.1, fee: 4.5 },
      { sym: 'CL', pv: 1000, tick: 0.01, fee: 4.5 }, { sym: 'GC', pv: 100, tick: 0.1, fee: 4.5 }
    ],
    setups: ['Model 1 · LVN continuation', 'Model 2 · POC fade', 'Model 3 · Paper'],
    stats: [
      { id: 'mist', name: 'Mistakes', values: ['None', 'Early exit', 'Moved stop', 'Chased entry', 'Entered early', 'Revenge trade', 'Oversized', 'Outside plan'] },
      { id: 'emo', name: 'Emotional state', values: ['Calm', 'Confident', 'Hesitant', 'Anxious', 'Frustrated', 'FOMO'] },
      { id: 'val', name: 'Value relationship', values: ['Overlapping', 'Partial overlap', 'Separated above', 'Separated below'] },
      { id: 'day', name: 'Day type', values: ['Trend', 'Balance', 'Double distribution', 'Neutral'] },
      { id: 'agg', name: 'Gate 3 confirmation', values: ['Big trades', 'Delta', 'Tape speed', 'Footprint'] },
      { id: 'qual', name: 'Setup quality', values: ['A+', 'A', 'B', 'C'] }
    ],
    comments: {
      pre: [{ t: 'Followed premarket plan', r: 1 }, { t: 'Full checklist confirmed', r: 1 }, { t: 'Skipped part of checklist', r: -1 }, { t: 'Traded against bias', r: -1 }],
      entry: [{ t: 'Entered at planned level', r: 1 }, { t: 'Waited for confirmation', r: 1 }, { t: 'Chased price', r: -1 }, { t: 'Entered early', r: -1 }, { t: 'Hesitated on entry', r: -1 }],
      mgmt: [{ t: 'Left stop untouched', r: 1 }, { t: 'Managed by structure', r: 1 }, { t: 'Moved stop', r: -1 }, { t: 'Managed by P&L feel', r: -1 }],
      exit: [{ t: 'Held to target', r: 1 }, { t: 'Exited on invalidation', r: 1 }, { t: 'Exited early out of fear', r: -1 }, { t: 'Let loser run past stop', r: -1 }]
    }
  };
}
function mergeDefaults(s) {
  const d = defaultSettings();
  const o = Object.assign({}, d, s || {});
  for (const k of ['accounts', 'instruments', 'setups', 'stats']) if (!Array.isArray(o[k])) o[k] = d[k];
  o.comments = Object.assign({}, d.comments, o.comments || {});
  for (const c of CATS) if (!Array.isArray(o.comments[c])) o.comments[c] = [];
  if (!o.accounts.length) o.accounts = d.accounts;
  o.accounts.forEach(a => { if (!Array.isArray(a.txns)) a.txns = []; });
  return o;
}

/* ---------- state ---------- */
const S = {
  settings: defaultSettings(), trades: [], journal: {},
  view: 'dashboard', sub: {}, loaded: false, demo: [], showDemo: true,
};
const G = { account: 'all', range: 'all', from: '', to: '' };
try { Object.assign(G, JSON.parse(localStorage.getItem('gj-filters') || '{}')); } catch (e) { }
function saveFilters() { try { localStorage.setItem('gj-filters', JSON.stringify(G)); } catch (e) { } }

/* ---------- trade math ---------- */
function inst(sym) { return S.settings.instruments.find(i => i.sym === sym) || { sym, pv: 1, tick: 0.01, fee: 0 }; }
function calc(t) {
  const pv = inst(t.instrument).pv || 1;
  const sgn = t.dir === 'short' ? -1 : 1;
  const exits = (t.exits || []).filter(e => isNum(e.price) && isNum(e.size) && e.size > 0);
  const exSize = sum(exits.map(e => e.size));
  const size = isNum(t.size) && t.size > 0 ? t.size : exSize;
  const closed = exits.length > 0 && isNum(t.entry);
  const avgExit = exSize ? sum(exits.map(e => e.price * e.size)) / exSize : null;
  const gross = closed ? sum(exits.map(e => (e.price - t.entry) * sgn * e.size * pv)) : null;
  const fees = num(t.fees) || 0;
  const pnl = closed ? gross - fees : null;
  const riskPts = isNum(t.stop) && isNum(t.entry) && t.stop !== t.entry ? Math.abs(t.entry - t.stop) : null;
  const risk = riskPts ? riskPts * size * pv : null;
  const r = closed && risk ? pnl / risk : null;
  const planR = riskPts && isNum(t.target) ? Math.abs(t.target - t.entry) / riskPts : null;
  const mfeR = riskPts && isNum(t.mfe) ? Math.max(0, (t.mfe - t.entry) * sgn / riskPts) : null;
  const maeR = riskPts && isNum(t.mae) ? Math.max(0, (t.entry - t.mae) * sgn / riskPts) : null;
  const pts = closed ? (avgExit - t.entry) * sgn : null;
  const mfePts = isNum(t.mfe) ? (t.mfe - t.entry) * sgn : null;
  const eff = closed && mfePts > 0 ? pts / mfePts : null;
  const ed = parseLT(t.entryTime);
  const lastExit = exits.map(e => e.time).filter(Boolean).sort().pop() || t.exitTime;
  const xd = parseLT(lastExit);
  const dur = ed && xd ? (xd - ed) / 60000 : null;
  const beR = S.settings.beR ?? 0.1;
  const res = !closed ? 'OPEN' : (isNum(r) ? (Math.abs(r) < beR ? 'BE' : r > 0 ? 'W' : 'L') : (pnl > 0 ? 'W' : pnl < 0 ? 'L' : 'BE'));
  let cp = 0, cn = 0;
  for (const c of CATS) for (const x of (t.comments?.[c] || [])) { if (x.r > 0) cp++; else if (x.r < 0) cn++; }
  t._ = {
    pv, size, closed, avgExit, gross, fees, pnl, riskPts, risk, r, planR, mfeR, maeR, pts, eff, dur, res, cp, cn,
    date: ed ? ymd(ed) : '', hour: ed ? ed.getHours() : null, wd: ed ? ed.getDay() : null, month: ed ? ed.getMonth() : null, ts: ed ? ed.getTime() : 0
  };
  return t;
}
function cleanTrade(t) { const o = clone(t); delete o._; delete o.demo; return o; }

/* ---------- metrics ---------- */
function metrics(list) {
  const c = list.filter(t => t._.closed);
  const n = c.length;
  const W = c.filter(t => t._.res === 'W'), L = c.filter(t => t._.res === 'L'), B = c.filter(t => t._.res === 'BE');
  const gw = sum(c.filter(t => t._.pnl > 0).map(t => t._.pnl)), gl = -sum(c.filter(t => t._.pnl < 0).map(t => t._.pnl));
  const net = sum(c.map(t => t._.pnl));
  const rs = c.map(t => t._.r).filter(isNum);
  const wr = (W.length + L.length) ? W.length / (W.length + L.length) : null;
  const avgW = avg(W.map(t => t._.pnl)), avgL = avg(L.map(t => t._.pnl));
  const avgWR = avg(W.map(t => t._.r).filter(isNum)), avgLR = avg(L.map(t => t._.r).filter(isNum));
  let eq = 0, peak = 0, mdd = 0, cw = 0, cl = 0, mcw = 0, mcl = 0;
  const sorted = [...c].sort((a, b) => a._.ts - b._.ts);
  for (const t of sorted) {
    eq += t._.pnl; peak = Math.max(peak, eq); mdd = Math.min(mdd, eq - peak);
    if (t._.res === 'W') { cw++; cl = 0; } else if (t._.res === 'L') { cl++; cw = 0; } else { cw = 0; cl = 0; }
    mcw = Math.max(mcw, cw); mcl = Math.max(mcl, cl);
  }
  let rq = 0, rpk = 0, rdd = 0;
  for (const t of sorted) if (isNum(t._.r)) { rq += t._.r; rpk = Math.max(rpk, rq); rdd = Math.min(rdd, rq - rpk); }
  const daysM = new Map(); for (const t of c) daysM.set(t._.date, (daysM.get(t._.date) || 0) + t._.pnl);
  const daily = [...daysM.values()];
  const dm = avg(daily); const dsd = daily.length > 1 ? Math.sqrt(sum(daily.map(x => (x - dm) ** 2)) / (daily.length - 1)) : null;
  const tp = sum(c.map(t => t._.cp)), tn = sum(c.map(t => t._.cn));
  return {
    n, wins: W.length, losses: L.length, be: B.length, wr, gw, gl, net,
    pf: gl > 0 ? gw / gl : (gw > 0 ? Infinity : null),
    exp: n ? net / n : null, expR: avg(rs), totalR: rs.length ? sum(rs) : null,
    avgW, avgL, avgWR, avgLR, payoff: avgW && avgL ? avgW / Math.abs(avgL) : null,
    bigW: n ? Math.max(...c.map(t => t._.pnl)) : null, bigL: n ? Math.min(...c.map(t => t._.pnl)) : null,
    mcw, mcl, mdd, rdd, fees: sum(c.map(t => t._.fees)),
    days: daily.length, greenDays: daily.filter(x => x > 0).length, bestDay: daily.length ? Math.max(...daily) : null, worstDay: daily.length ? Math.min(...daily) : null,
    avgDay: dm, sharpe: dsd ? dm / dsd * Math.sqrt(252) : null,
    holdW: avg(W.map(t => t._.dur).filter(isNum)), holdL: avg(L.map(t => t._.dur).filter(isNum)),
    mfe: avg(c.map(t => t._.mfeR).filter(isNum)), mae: avg(c.map(t => t._.maeR).filter(isNum)),
    eff: avg(c.map(t => t._.eff).filter(isNum)), planR: avg(c.map(t => t._.planR).filter(isNum)),
    contracts: sum(c.map(t => t._.size)), disc: (tp + tn) ? tp / (tp + tn) : null, cpos: tp, cneg: tn,
  };
}

/* ---------- data selection ---------- */
function usingDemo() { return S.loaded && S.trades.length === 0 && S.showDemo; }
function allTrades() { return usingDemo() ? S.demo : S.trades; }
function rangeBounds() {
  const now = new Date(); const t0 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const back = d => { const x = new Date(t0); x.setDate(x.getDate() - d); return ymd(x); };
  switch (G.range) {
    case 'today': return [ymd(t0), ymd(t0)];
    case 'week': { const x = new Date(t0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return [ymd(x), '9999']; }
    case 'month': return [`${t0.getFullYear()}-${pad(t0.getMonth() + 1)}-01`, '9999'];
    case '30': return [back(29), '9999'];
    case '90': return [back(89), '9999'];
    case 'ytd': return [`${t0.getFullYear()}-01-01`, '9999'];
    case 'custom': return [G.from || '0000', G.to || '9999'];
    default: return ['0000', '9999'];
  }
}
function scoped(opts = {}) {
  const [a, b] = opts.noRange ? ['0000', '9999'] : rangeBounds();
  return allTrades().filter(t => (G.account === 'all' || t.account === G.account) && t._.date >= a && t._.date <= b)
    .sort((x, y) => x._.ts - y._.ts);
}
const closedScoped = o => scoped(o).filter(t => t._.closed);

/* ---------- dimensions for grouping ---------- */
function hourLabel(h) { return h == null ? '—' : `${pad(h)}:00`; }
function dims() {
  const d = [
    { id: 'setup', name: 'Setup', fn: t => t.setup || '(no setup)' },
    { id: 'dir', name: 'Direction', fn: t => t.dir === 'short' ? 'Short' : 'Long' },
    { id: 'inst', name: 'Instrument', fn: t => t.instrument || '—' },
    { id: 'wd', name: 'Weekday', fn: t => WD[t._.wd] },
    { id: 'hour', name: 'Entry hour', fn: t => hourLabel(t._.hour) },
  ];
  for (const s of S.settings.stats) d.push({ id: 'st_' + s.id, name: s.name, fn: t => (t.stats?.[s.id] || []), stat: s });
  for (const c of CATS) d.push({ id: 'cm_' + c, name: 'Comments · ' + CAT[c], fn: t => (t.comments?.[c] || []).map(x => x.t) });
  return d;
}
function dimOrder(dim, keys) {
  if (dim.id === 'wd') return WD.filter(k => keys.includes(k));
  if (dim.id === 'hour') return [...keys].sort();
  if (dim.stat) { const o = dim.stat.values; return [...keys].sort((a, b) => (o.indexOf(a) + 1 || 99) - (o.indexOf(b) + 1 || 99)); }
  if (dim.id === 'setup') { const o = S.settings.setups; return [...keys].sort((a, b) => (o.indexOf(a) + 1 || 99) - (o.indexOf(b) + 1 || 99)); }
  return [...keys].sort();
}
function groupBy(list, fn) {
  const m = new Map();
  for (const t of list) { let ks = fn(t); if (!Array.isArray(ks)) ks = [ks]; for (const k of new Set(ks)) { if (k == null || k === '') continue; if (!m.has(k)) m.set(k, []); m.get(k).push(t); } }
  return m;
}

/* ---------- demo data (shown only while the journal is empty) ---------- */
function buildDemo() {
  let seed = 20261021; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const pick = a => a[Math.floor(rnd() * a.length)];
  const out = []; const today = new Date(); const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 84);
  let px = 5790;
  while (d <= today) {
    const wd = d.getDay();
    if (wd > 0 && wd < 6) {
      px += (rnd() - 0.48) * 30;
      const n = Math.floor(rnd() * 3.2);
      let minute = 9 * 60 + 33 + Math.floor(rnd() * 25);
      for (let i = 0; i < n; i++) {
        const m1 = rnd() < 0.62; const setup = m1 ? S.settings.setups[0] : S.settings.setups[1];
        const dir = rnd() < 0.5 ? 'long' : 'short'; const sg = dir === 'long' ? 1 : -1;
        const stopPts = [2, 2.5, 3, 3.5, 4][Math.floor(rnd() * 5)];
        const size = Math.max(1, Math.floor(250 / (stopPts * 50)));
        const entry = Math.round((px + (rnd() - 0.5) * 12) * 4) / 4;
        const tgtR = m1 ? 2.5 : 2;
        const quality = pick(['A+', 'A', 'A', 'B', 'B', 'C']);
        const qBoost = quality === 'A+' ? 0.12 : quality === 'A' ? 0.05 : quality === 'B' ? -0.05 : -0.14;
        const win = rnd() < (m1 ? 0.56 : 0.5) + qBoost;
        const mist = []; const cm = { pre: [], entry: [], mgmt: [], exit: [] };
        const C = S.settings.comments;
        let rr, mfeR, maeR;
        if (win) {
          const early = rnd() < 0.38;
          rr = early ? 0.5 + rnd() * 1.1 : tgtR; mfeR = early ? tgtR * (0.8 + rnd() * 0.4) : tgtR + rnd() * 0.6; maeR = rnd() * 0.75;
          if (early) { mist.push('Early exit'); cm.exit.push(C.exit[2]); } else cm.exit.push(C.exit[0]);
        } else {
          const moved = rnd() < 0.2;
          rr = moved ? -(1.3 + rnd() * 0.5) : -1; mfeR = rnd() * 1.3; maeR = -rr;
          if (moved) { mist.push('Moved stop'); cm.mgmt.push(C.mgmt[2]); cm.exit.push(C.exit[3]); } else { cm.mgmt.push(C.mgmt[0]); cm.exit.push(C.exit[1]); }
        }
        if (rnd() < 0.22) { mist.push(pick(['Chased entry', 'Entered early'])); cm.entry.push(rnd() < .5 ? C.entry[2] : C.entry[3]); rr -= 0.15; }
        else cm.entry.push(rnd() < .6 ? C.entry[0] : C.entry[1]);
        if (i === 2 && !win) { mist.push('Revenge trade'); }
        cm.pre.push(rnd() < 0.8 ? C.pre[0] : C.pre[2]);
        if (!mist.length) mist.push('None');
        for (const c of CATS) cm[c] = cm[c].filter(Boolean).map(x => ({ t: x.t, r: x.r }));
        const exitPx = entry + sg * rr * stopPts;
        const dur = 3 + Math.floor(rnd() * (win ? 40 : 18));
        const st = new Date(d); st.setHours(0, minute, 0, 0);
        const et = new Date(st.getTime() + dur * 60000);
        minute += dur + 6 + Math.floor(rnd() * 25);
        if (minute > 11 * 60 + 55) break;
        const t = {
          id: 'demo' + out.length, demo: true, account: 'acc_main', instrument: 'ES', dir,
          entryTime: lt(st), entry, size, stop: entry - sg * stopPts, target: entry + sg * tgtR * stopPts,
          exits: [{ price: Math.round(exitPx * 4) / 4, size, time: lt(et) }],
          fees: +(size * 4.5).toFixed(2), setup,
          mfe: Math.round((entry + sg * mfeR * stopPts) * 4) / 4, mae: Math.round((entry - sg * maeR * stopPts) * 4) / 4,
          stats: {
            mist, emo: [win ? pick(['Calm', 'Confident', 'Calm']) : pick(['Calm', 'Anxious', 'Hesitant', 'Frustrated'])],
            val: [m1 ? pick(['Separated above', 'Separated below', 'Partial overlap']) : pick(['Overlapping', 'Partial overlap'])],
            day: [m1 ? pick(['Trend', 'Double distribution', 'Neutral']) : pick(['Balance', 'Neutral'])],
            agg: [pick(['Big trades', 'Delta', 'Tape speed', 'Footprint'])], qual: [quality]
          },
          comments: cm, notes: '', shots: []
        };
        out.push(calc(t));
      }
    }
    d.setDate(d.getDate() + 1);
  }
  return out;
}

/* ---------- storage ---------- */
const Store = { mode: 'connecting', db: null, sref: null, tcol: null, jcol: null, assets: null, downloads: null, busy: {}, pending: {}, localTrades: 0 };
const LKEY = 'gj-local-v1';
const DESK = typeof window !== 'undefined' && window.desktop && typeof window.desktop.load === 'function' ? window.desktop : null;
function loadLocal() {
  if (DESK) { try { const s = DESK.load(); return s ? JSON.parse(s) : null; } catch (e) { toast('Could not read your journal file: ' + e.message); return null; } }
  try { const o = JSON.parse(localStorage.getItem(LKEY) || 'null'); return o; } catch (e) { return null; }
}
let deskTimer = null;
function saveLocal() {
  if (Store.mode !== 'local') return;
  const payload = () => JSON.stringify({ app: '3gates-journal', v: 1, settings: S.settings, trades: S.trades.map(cleanTrade), journal: S.journal });
  if (DESK) { clearTimeout(deskTimer); deskTimer = setTimeout(() => { DESK.save(payload()).catch(e => toast('Could not save to disk: ' + e.message)); }, 300); return; }
  try { localStorage.setItem(LKEY, payload()); }
  catch (e) { toast('This browser refused to save. Export a backup from Settings.'); }
}
if (DESK) window.addEventListener('beforeunload', () => { if (deskTimer) { clearTimeout(deskTimer); DESK.saveSync(JSON.stringify({ app: '3gates-journal', v: 1, settings: S.settings, trades: S.trades.map(cleanTrade), journal: S.journal })); } });
let wActive = 0; const wWait = [];
async function wSlot() { if (wActive >= 4) await new Promise(r => wWait.push(r)); wActive++; }
function wFree() { wActive--; const w = wWait.shift(); if (w) w(); }
async function rawWrite(ref, d) { await wSlot(); try { d === null ? await ref.delete() : await ref.set(d); } finally { wFree(); } }
async function writeDoc(ref, key, data) {
  Store.pending[key] = data;
  if (Store.busy[key]) return;
  Store.busy[key] = true;
  while (key in Store.pending) {
    const d = Store.pending[key]; delete Store.pending[key];
    try { await rawWrite(ref, d); }
    catch (e) {
      if (e && e.code === 'unavailable') { await new Promise(r => setTimeout(r, 600 + Math.random() * 600)); try { await rawWrite(ref, d); continue; } catch (e2) { e = e2; } }
      toast(e && e.code === 'quota_exceeded' ? 'Storage is full. Delete old screenshots or trades.' : 'Could not save: ' + (e && e.message || 'unknown error'));
    }
  }
  Store.busy[key] = false;
}
let settingsTimer = null;
function saveSettings() {
  if (Store.mode === 'db') { clearTimeout(settingsTimer); settingsTimer = setTimeout(() => writeDoc(Store.sref, 'settings', clone(S.settings)), 500); }
  else saveLocal();
}
function saveTrade(t) {
  t.updated = Date.now(); calc(t);
  const i = S.trades.findIndex(x => x.id === t.id);
  if (i >= 0) S.trades[i] = t; else S.trades.push(t);
  if (Store.mode === 'db') writeDoc(Store.tcol.doc(t.id), 't:' + t.id, cleanTrade(t)); else saveLocal();
}
function deleteTrade(id) {
  S.trades = S.trades.filter(t => t.id !== id);
  if (Store.mode === 'db') writeDoc(Store.tcol.doc(id), 't:' + id, null); else saveLocal();
}
function saveDay(date, obj) {
  S.journal[date] = obj;
  if (Store.mode === 'db') writeDoc(Store.jcol.doc(date), 'd:' + date, clone(obj)); else saveLocal();
}

async function connect() {
  const local = loadLocal();
  const useLocal = () => {
    Store.mode = 'local';
    if (local) { S.settings = mergeDefaults(local.settings); S.trades = (local.trades || []).map(calc); S.journal = local.journal || {}; }
    S.loaded = true; S.demo = buildDemo(); render();
  };
  if (!window.claude || typeof window.claude.use !== 'function') return useLocal();
  let db = null, user = null;
  try { [db, user] = await Promise.all([claude.use('db'), claude.use('user')]); } catch (e) { }
  const id = user ? await user.id().catch(() => null) : null;
  if (!db || !id) return useLocal();
  Store.db = db; Store.mode = 'db';
  Store.localTrades = local?.trades?.length || 0; Store.localData = local;
  const base = 'data/users/' + id;
  Store.sref = db.doc(base + '/journal');
  Store.tcol = Store.sref.collection('trades');
  Store.jcol = Store.sref.collection('days');
  const got = { s: false, t: false, j: false };
  const ready = () => { if (got.s && got.t && got.j && !S.loaded) { S.loaded = true; S.demo = buildDemo(); } scheduleRender(); };
  const onErr = e => { if (e && e.code === 'revoked') { Store.mode = 'readonly'; } toast('Sync stopped: ' + (e?.message || e?.code || 'error')); scheduleRender(); };
  Store.sref.onSnapshot(snap => {
    if (snap.exists) { S.settings = mergeDefaults(snap.data()); S.trades.forEach(calc); S.demo.forEach(calc); }
    got.s = true; ready();
  }, onErr);
  Store.tcol.onSnapshot(snap => {
    S.trades = snap.docs.map(d => calc(Object.assign({}, clone(d.data()), { id: d.id })));
    got.t = true; ready();
  }, onErr);
  Store.jcol.onSnapshot(snap => {
    const j = {}; snap.docs.forEach(d => { j[d.id] = clone(d.data()); }); S.journal = j;
    got.j = true; ready();
  }, onErr);
  claude.use('assets').then(a => { Store.assets = a; }).catch(() => { });
  setTimeout(() => { if (!S.loaded) { S.loaded = true; S.demo = buildDemo(); render(); } }, 8000);
}
function importLocalIntoSync() {
  const L = Store.localData; if (!L) return;
  if (L.settings) { S.settings = mergeDefaults(L.settings); saveSettings(); }
  (L.trades || []).forEach(t => saveTrade(calc(t)));
  Object.entries(L.journal || {}).forEach(([k, v]) => saveDay(k, v));
  Store.localTrades = 0;
  try { localStorage.removeItem(LKEY); } catch (e) { }
  toast('Moved browser data into your synced journal'); render();
}

/* ---------- files out ---------- */
async function offerFile(filename, data) {
  if (DESK) { try { const p = await DESK.saveFile(filename, data); if (p) toast('Saved ' + p.split(/[\\/]/).pop()); } catch (e) { toast('Could not save file: ' + e.message); } return; }
  try {
    if (!Store.downloads && window.claude?.use) Store.downloads = await claude.use('downloads');
    if (Store.downloads) { await Store.downloads.save({ filename, data }); return; }
  } catch (e) { if (e && e.code === 'declined') return; }
  openModal(`<div class="modal narrow"><div class="mhead"><h3>${esc(filename)}</h3><button class="btn ghost" data-act="close">Close</button></div>
    <div class="mbody"><p class="hint">Saving files isn't available in this view. Copy the contents below and save them yourself.</p>
    <textarea class="inp mono" id="copybox" style="min-height:300px;font-size:12px" readonly>${esc(data)}</textarea>
    <div class="row"><button class="btn pri" data-act="copybox">Copy</button></div></div></div>`);
}

/* ---------- ui plumbing ---------- */
let toastT;
function toast(msg) {
  let el = $('.toast'); if (!el) { el = document.createElement('div'); el.className = 'toast'; document.body.appendChild(el); }
  el.textContent = msg; el.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { el.hidden = true; }, 2600);
}
function openModal(html) { $('#modal').innerHTML = `<div class="scrim" data-scrim="1">${html}</div>`; }
function closeModal() { $('#modal').innerHTML = ''; }
function openDrawer(html) { $('#drawer').innerHTML = `<div class="drawer" role="dialog">${html}</div>`; }
function closeDrawer() { $('#drawer').innerHTML = ''; }

const charts = {};
function killCharts() { for (const k in charts) { try { charts[k].destroy(); } catch (e) { } delete charts[k]; } }
function tok() { const cs = getComputedStyle(document.documentElement); return k => cs.getPropertyValue('--' + k).trim(); }
function mkChart(id, cfg) {
  const el = document.getElementById(id); if (!el || !window.Chart) return;
  const T = tok();
  Chart.defaults.font.family = T('mono').replace(/"/g, '') || 'monospace';
  Chart.defaults.font.size = 11;
  Chart.defaults.color = T('muted');
  Chart.defaults.borderColor = T('line');
  cfg.options = Object.assign({ responsive: true, maintainAspectRatio: false, animation: { duration: 250 }, plugins: {} }, cfg.options || {});
  cfg.options.plugins = Object.assign({ legend: { display: false }, tooltip: { backgroundColor: T('panel2'), titleColor: T('fg'), bodyColor: T('fg'), borderColor: T('line2'), borderWidth: 1, padding: 10 } }, cfg.options.plugins);
  charts[id] = new Chart(el, cfg);
}

let renderQueued = false;
function scheduleRender() { if (renderQueued) return; renderQueued = true; requestAnimationFrame(() => { renderQueued = false; render(); }); }
