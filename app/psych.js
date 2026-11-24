/* ===== Psychology & peak-performance module =====
   Adds: premarket readiness + mental rehearsal, live tagging with a circuit breaker, psychological fields on trades,
   a post-session debrief with pattern mapping, a 0-100 process score, a Mind dashboard, a weekly review and a
   30-session development program.

   Data (all additive, older journal files keep loading):
     S.journal[date].psy = { type: 'trade'|'off', pre: {sleep..resid: 1-5, trap, trig, resp, obj: [], success, maxT},
                             reh: { scenarioId: 1 }, ev: [{ id, at, tag, act }], post: { done, chains: [chain], deep } }
     S.journal[monday].psyWeek = { read, commit, target }
     trade.psy = { motive, origin, conf, hes, urg, risk, rat, exit }
     S.settings.psy = { maxTrades, maxDailyLoss, maxRiskTrade, cooldownMin, researchInPlan, psychMiss: [], patterns: [], scen: [], programStart }
   The process score never reads P&L except to check hard risk rules (stop respected, daily loss limit). */
'use strict';

/* ---------- content ---------- */
const PSY_TAGS = [
  { id: 'fomo', l: 'FOMO', pat: 'miss', urge: 1 }, { id: 'hes', l: 'Hesitation', pat: 'cert' }, { id: 'frus', l: 'Frustration', pat: 'repair' },
  { id: 'bore', l: 'Boredom', pat: 'stim', urge: 1 }, { id: 'imp', l: 'Impatience', pat: 'miss', urge: 1 }, { id: 'fear', l: 'Fear', pat: 'cert' },
  { id: 'over', l: 'Overconfidence', pat: 'narr', urge: 1 }, { id: 'rev', l: 'Revenge urge', pat: 'repair', urge: 1 }, { id: 'dir', l: 'Married to direction', pat: 'narr', urge: 1 },
  { id: 'money', l: 'Money urgency', pat: 'repair', urge: 1 }, { id: 'focus', l: 'Lost focus', pat: 'stim' }, { id: 'dev', l: 'Urge to deviate', pat: 'narr', urge: 1 },
];
const PSY_TAG = Object.fromEntries(PSY_TAGS.map(x => [x.id, x]));
const PSY_OUT = { W: 'Win', L: 'Loss', X: 'Rule break' }; // quick outcome taps, used only while no trades are logged for the day
const PSY_ACTS = { noted: 'Noted', resisted: 'Resisted', paused: 'Paused', acted: 'Acted on it' };
const PSY_MOTIVES = [
  { id: 'plan', l: 'My setup printed' }, { id: 'fomo', l: 'Fear of missing it', pat: 'miss', imp: 1 }, { id: 'chase', l: 'Chasing a move I missed', pat: 'miss', imp: 1 },
  { id: 'bore', l: 'Boredom / wanted action', pat: 'stim', imp: 1 }, { id: 'rev', l: 'Make back a loss', pat: 'repair', rev: 1 }, { id: 'money', l: 'Pressure to make money', pat: 'repair', imp: 1 },
  { id: 'bias', l: 'Conviction in my direction', pat: 'narr', imp: 1 }, { id: 'other', l: 'Other' },
];
const PSY_MOTIVE = Object.fromEntries(PSY_MOTIVES.map(x => [x.id, x]));
const PSY_READY = [
  ['sleep', 'Sleep quality', 1], ['energy', 'Physical energy', 1], ['clarity', 'Mental clarity', 1], ['stable', 'Emotional stability', 1],
  ['conf', 'Confidence in my process', 1], ['patience', 'Patience', 1], ['uncert', 'OK not knowing the outcome', 1],
  ['stress', 'Outside stress', -1], ['finp', 'Financial pressure', -1], ['urge', 'Urge to make money today', -1], ['fearl', 'Fear of losing', -1], ['resid', 'Leftover emotion from last session', -1],
];
const PSY_OBJ = ['Trade only pre-marked locations', 'All 3 gates before every entry', 'Hold to stop or target, no early exits', 'Take every valid setup without hesitating', 'Respect max trades', 'Full cooldown after every loss', 'Stop after the first rule break'];
const PSY_RISK_REASONS = ['No invalidation (stop)'];
const LV = ['green', 'yellow', 'red'];
const LV_NAME = { green: 'Green · Regulated', yellow: 'Yellow · Elevated risk', red: 'Red · Compromised', stop: 'Hard stop · Daily loss limit' };
const PSY_W = { prep: 10, sel: 25, exec: 15, risk: 20, emo: 15, imp: 10, rev: 5 };
const PSY_CAT = { prep: 'Preparation', sel: 'Plan & 3 Gates selection', exec: 'Execution discipline', risk: 'Risk discipline', emo: 'Emotional regulation & recovery', imp: 'Impulse control', rev: 'Post-session review' };

function defaultPatterns() {
  const p = (id, name, o) => Object.assign({ id, name }, o);
  return [
    p('miss', 'Missing-out loop', { symptoms: 'FOMO, chasing, early entries, impatience at the level', warnings: 'Leaning toward the order button before price reaches the level; replaying the move I missed; counting points I "could have" made', triggers: 'Price moves without me; price approaching my level fast; a big move right after I passed', interp: "This move is money I'm losing. If I don't get in now I miss the day.", emotion: 'Anxiety, frustration', urge: 'Click now', behavior: 'Enter early or chase at an invalid location', shortC: 'Relief from the feeling of missing out', longC: 'Trains impulsive entries; worse locations; erodes trust in the plan', belief: "Every move is an opportunity I'm supposed to catch.", replacement: "My edge lives at my locations. Moves away from them are not my business.", corrective: 'Hands off. Mark the next valid location. Wait for Gate 2 and Gate 3 again.', prevent: 'Levels pre-marked before the open; limit orders staged but not armed', ifthen: 'If price moves without me, then I say "not my trade", mark the next location and take my hand off the mouse for 60 seconds.' }),
    p('repair', 'Loss-repair loop', { symptoms: 'Revenge trading, pressure to make money, last outcome steering the next decision, frustration', warnings: 'Checking daily P&L between trades; thinking in dollars instead of R; wanting to size up "to get it back"', triggers: 'A loss, especially a stop-out right before price goes my way; a red day; payout or bills pressure', interp: 'I need to get back to even today. That loss was unfair.', emotion: 'Frustration, anger, shame', urge: 'Get it back now', behavior: 'Re-enter fast without all three gates, bigger size or wider stop', shortC: 'A brief sense of control', longC: 'Turns one normal loss into a big red day; risk violations; account damage', belief: "A losing day means I failed. Today's P&L says what I'm worth.", replacement: "One loss is one sample of a positive-expectancy process. The day's P&L is not a grade.", corrective: 'Cooldown: no orders until it ends. Log the loss in R. Next trade only if it is A+ at a pre-marked level.', prevent: 'Hide the P&L display; fixed size; cooldown after every loss', ifthen: 'If I take a loss, then I stand up, log it in R, and wait the full cooldown before looking for the next valid setup.' }),
    p('cert', 'Certainty-seeking loop', { symptoms: 'Hesitation on valid setups, fear of taking losses, waiting for one more confirmation, over-reading the DOM, constantly tweaking charts and execution', warnings: 'Asking "but what if"; adding a confirmation that is not in the rules; opening settings mid-session', triggers: 'Price arrives at my level; a recent loss on the same setup; a mixed-looking DOM', interp: 'I need to be sure this one works.', emotion: 'Fear, doubt', urge: 'Wait / look for more', behavior: 'Hesitate, enter late at a worse price, or skip a valid trade', shortC: 'Avoids the pain of a possible loss right now', longC: 'Misses the winners that pay for the losers; feeds the tweaking habit', belief: 'A good trader knows which trades will win.', replacement: "I can't know which trade wins. My job is to take every valid one at defined risk; the sample decides.", corrective: 'If all 3 gates are yes, execute within 5 seconds at planned size. The stop is the price of finding out.', prevent: 'Exact trigger written in the plan; dollar risk accepted before the open; no tool changes during RTH', ifthen: 'If all three gates are yes, then I enter immediately at planned size, even if I feel doubt.' }),
    p('narr', 'Narrative-attachment loop', { symptoms: 'Married to a direction, abandoning the premarket plan, rationalizing with technical analysis, inventing setup labels, overconfidence', warnings: 'Telling a story about where price "has to" go; only seeing evidence that agrees; using a label that is not in my playbook', triggers: 'A strong premarket opinion; a couple of winners in a row; price doing what I predicted', interp: 'I know where this is going.', emotion: 'Certainty, excitement', urge: 'Trade my opinion', behavior: 'Take trades outside the playbook and justify them afterwards', shortC: 'Feeling right', longC: "Off-playbook trades contaminate the data, so I never learn what my edge is", belief: 'A convincing explanation makes a trade valid.', replacement: 'Only the three gates make a trade valid. An explanation after the fact is not evidence.', corrective: 'Ask: which setup, which location, which trigger? If any answer is "sort of", no trade.', prevent: 'Bias written as if/then, not a prediction; classify the trade before entry, not after', ifthen: "If I catch myself predicting, then I name setup, location and trigger out loud. If I can't, I don't trade." }),
    p('stim', 'Stimulation-seeking loop', { symptoms: 'Boredom trading, overtrading, losing focus in slow tape', warnings: 'Flipping timeframes; trading the middle of the range; "just a small one"', triggers: 'Slow, balanced tape; a long gap since the last trade; late morning', interp: "If I'm not trading, I'm not working.", emotion: 'Boredom, restlessness', urge: 'Do something', behavior: 'Small unplanned trades away from my locations', shortC: 'Relief from boredom', longC: 'Death by fees and small losses; teaches me that clicking equals working', belief: 'Activity equals productivity.', replacement: 'Waiting at my levels is the work. Sitting on my hands is a skill I get paid for.', corrective: 'Stand down 10 minutes; set alerts at my levels; step back from the DOM.', prevent: 'Alerts at levels; a hard trade cap; session ends at 12:00', ifthen: 'If I feel bored, then I set alerts at my levels and step away from the DOM until one fires.' }),
  ];
}
function defaultScenarios() {
  const s = (id, l, t) => ({ id, l, t });
  return [
    s('loss', 'Taking a valid losing trade', 'If a valid trade stops out, then I log it as a valid −1R, sit out the cooldown, and treat the next setup as independent.'),
    s('miss', 'Missing a big move', "If I miss a planned entry, then I don't chase. I mark the next valid location and wait."),
    s('invwin', 'A setup I passed on works anyway', 'If a trade I correctly skipped becomes profitable, then I log it as a correct pass. It was not my trade.'),
    s('consec', 'Two or more losses in a row', 'If I take 2 losses in a row, then I go to Yellow: A+ only, minimum size, and I stop after the next loss.'),
    s('approach', 'Price approaching my level', 'If price approaches my level, then I wait for Gate 3 at the level and do not enter in anticipation.'),
    s('hes', 'Hesitating on a valid setup', 'If all three gates are yes and I feel doubt, then I enter at planned size within 5 seconds.'),
    s('notrade', 'Finishing with no trade', 'If no valid setup appears, then I end at 12:00 and log a disciplined no-trade session.'),
    s('wrong', 'My thesis is wrong', 'If price invalidates my thesis, then I drop the bias and re-read Gate 1 from scratch.'),
  ];
}
function defaultPsy() {
  return { maxTrades: 3, maxDailyLoss: 400, maxRiskTrade: 150, cooldownMin: 10, researchInPlan: true, psychMiss: ['Hesitated', 'Doubted the setup'], patterns: defaultPatterns(), scen: defaultScenarios(), programStart: '' };
}
function mergePsy(p) {
  const d = defaultPsy();
  const o = Object.assign({}, d, p && typeof p === 'object' ? p : {});
  for (const k of ['psychMiss', 'patterns', 'scen']) if (!Array.isArray(o[k])) o[k] = d[k];
  for (const k of ['maxTrades', 'maxDailyLoss', 'maxRiskTrade', 'cooldownMin']) if (!isNum(o[k])) o[k] = d[k];
  return o;
}
function psyCfg() { const s = S.settings; if (!s.psy || !Array.isArray(s.psy.patterns)) s.psy = mergePsy(s.psy); return s.psy; }
const psyPat = id => psyCfg().patterns.find(p => p.id === id) || null;

/* ---------- small helpers ---------- */
const PSY_DATE = /^\d{4}-\d{2}-\d{2}$/;
function psyToday() { return ymd(new Date()); }
function psyDate() { return S.sub.jd || psyToday(); }
function psyJ(date) { return S.journal[date] || {}; }
function psyP(date) { return psyJ(date).psy || {}; }
function psyDayTrades(date, book = 'live') { return S.trades.filter(t => bookOf(t) === book && t._.date === date).sort((a, b) => a._.ts - b._.ts); }
function psyAt(date, hhmm) { const d = parseLT(date + 'T' + (hhmm || '12:00')); return d ? d.getTime() : Date.now(); }
function psyHM(ms) { const d = new Date(ms); return pad(d.getHours()) + ':' + pad(d.getMinutes()); }
const negCmt = (t, c, except = []) => (t.comments?.[c] || []).some(x => x.r < 0 && !except.includes(x.t));
const hasCmt = (t, txt) => CATS.some(c => (t.comments?.[c] || []).some(x => x.t === txt));
const hasMist = (t, list) => (t.stats?.mist || []).some(x => list.includes(x));
function psyExitTs(t) { const xs = (t.exits || []).map(e => e.time).filter(Boolean).sort(); const d = parseLT(xs.pop()); return d ? d.getTime() : (isNum(t._.dur) ? t._.ts + t._.dur * 60000 : t._.ts); }
function psyMondayOf(date) { const d = parseLT(date + 'T00:00'); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return ymd(d); }
function psyAddDays(date, n) { const d = parseLT(date + 'T00:00'); d.setDate(d.getDate() + n); return ymd(d); }

/* ---------- readiness ---------- */
function psyReady(pre) {
  pre = pre || {}; let n = 0, s = 0, flags = [];
  for (const [k, l, dir] of PSY_READY) {
    const v = num(pre[k]); if (!isNum(v)) continue; n++;
    s += dir > 0 ? (v - 1) / 4 : (5 - v) / 4;
    if (dir < 0 && v === 5) flags.push(l);
    if (dir > 0 && v === 1 && ['sleep', 'clarity', 'stable'].includes(k)) flags.push(l);
  }
  if (n < 6) return { n, idx: null, cls: null, flags };
  const idx = Math.round(s / n * 100);
  const cls = idx < 45 || flags.length >= 2 ? 'red' : idx < 65 || flags.length === 1 ? 'yellow' : 'green';
  return { n, idx, cls, flags };
}
function psyRecMax(cls) { const m = psyCfg().maxTrades; return cls === 'red' ? 1 : cls === 'yellow' ? Math.min(2, m) : m; }
const PSY_READY_REC = {
  green: ['Normal readiness', 'Trade your plan at normal size.', 'Max trades as planned. Circuit breaker starts at Green.'],
  yellow: ['Elevated risk', 'A+ setups only, at your smallest planned size.', 'Max 2 trades. The first rule break ends the session. Circuit breaker starts at Yellow.'],
  red: ['Significantly impaired', 'Observe, replay or sim today. If you trade live: one A+ trade at minimum size, then done.', 'Max 1 trade. Circuit breaker starts at Yellow; any rule break is Red.'],
};
function psySuggestTrap(pre) {
  const v = k => num(pre[k]) ?? 3;
  const sc = { repair: v('urge') + v('finp') + v('resid'), cert: v('fearl') + (6 - v('conf')) + (6 - v('uncert')), miss: (6 - v('patience')) + v('urge') + 1, stim: (6 - v('energy')) + (6 - v('clarity')) + (6 - v('patience')) - 1, narr: (v('conf') >= 5 ? 3 : 0) + (6 - v('uncert')) };
  // recent history nudges the suggestion
  for (const d of Object.keys(S.journal).filter(k => PSY_DATE.test(k)).sort().slice(-10)) for (const c of (psyP(d).post?.chains || [])) if (sc[c.pat] != null) sc[c.pat] += 0.5;
  return Object.entries(sc).sort((a, b) => b[1] - a[1])[0][0];
}

/* ---------- trade classification ---------- */
function psyValidity(t, pc) {
  pc = pc || pbClassify(t);
  if (pc.status === 'compliant') return 'valid';
  if (pc.status === 'research') return psyCfg().researchInPlan ? 'valid' : 'unclear';
  if (pc.status === 'offplaybook') return 'invalid';
  return 'unclear';
}
const PSY_CLASS6 = { vw: 'Valid winner', vl: 'Valid loser', iw: 'Invalid winner', il: 'Invalid loser', mp: 'Missed: psychological', mx: 'Missed: practical', u: 'Not yet classifiable' };
function psyClass6(t, v) {
  if (bookOf(t) === 'missed') return psyCfg().psychMiss.includes(t.missReason) ? 'mp' : 'mx';
  if (v === 'unclear' || !t._.closed) return 'u';
  const win = t._.res === 'W';
  return v === 'valid' ? (win ? 'vw' : 'vl') : (win ? 'iw' : 'il');
}

/* ---------- the session engine ---------- */
const PSY_CACHE = new Map();
if (typeof render === 'function') { const _psyRender = render; render = function () { PSY_CACHE.clear(); return _psyRender(); }; }
function psyEval(date, depth = 0) {
  const key = date + '|' + depth; if (PSY_CACHE.has(key)) return PSY_CACHE.get(key);
  const r = psyEval0(date, depth); PSY_CACHE.set(key, r); return r;
}
function psyEval0(date, depth) {
  const C = psyCfg(); const j = psyJ(date); const P = j.psy || {};
  const trades = psyDayTrades(date), missed = psyDayTrades(date, 'missed');
  const pre = P.pre || {}; const rd = psyReady(pre);
  const maxT = isNum(num(pre.maxT)) ? num(pre.maxT) : psyRecMax(rd.cls);
  const ev = (P.ev || []).slice().sort((a, b) => a.at - b.at);
  const off = P.type === 'off';
  const rows = []; let cum = 0, prev = null, limitHit = false;
  trades.forEach((t, i) => {
    const ps = t.psy || {}; const pc = pbClassify(t);
    let v = psyValidity(t, pc); const reasons = pc.reasons.slice();
    if (ps.rat === 'yes') { reasons.push('Rationalized after the fact'); v = 'invalid'; }
    const over = isNum(maxT) && i >= maxT;
    if (over) { reasons.push(`Trade ${i + 1} is over today's max of ${maxT}`); v = 'invalid'; }
    const rv = [];
    if (!isNum(t.stop)) rv.push('No stop');
    if (isNum(t._.risk) && C.maxRiskTrade && t._.risk > C.maxRiskTrade * 1.1) rv.push(`Risk ${fmt$(t._.risk)} over max ${fmt$(C.maxRiskTrade)}`);
    if ((isNum(t._.r) && t._.r < -1.25) || hasCmt(t, 'Let loser run past stop')) rv.push('Loss ran past the stop');
    if (ps.risk === 'no') rv.push('Broke a risk rule');
    if (limitHit) rv.push('Traded after hitting the daily loss limit');
    if (t._.closed) { cum += t._.pnl; if (cum <= -C.maxDailyLoss) { if (cum < -C.maxDailyLoss * 1.1) rv.push('Daily loss limit exceeded'); limitHit = true; } }
    // each invalid trade is charged once, to its root category
    let cat = null, why = '';
    if (v === 'invalid') {
      const nonRisk = reasons.filter(r => !PSY_RISK_REASONS.includes(r));
      const gap = prev ? (t._.ts - prev.exitTs) / 60000 : null;
      const afterBad = prev && (prev.t._.res === 'L' || prev.v === 'invalid') && gap != null && gap < C.cooldownMin;
      const mot = PSY_MOTIVE[ps.motive] || {};
      const actedTag = ev.some(e => e.act === 'acted' && PSY_TAG[e.tag]?.urge && e.at <= t._.ts + 60000 && e.at >= t._.ts - 5 * 60000);
      if (!nonRisk.length && rv.length) { cat = 'risk'; why = 'Only broke risk rules'; }
      else if (mot.rev || afterBad) { cat = 'emo'; why = mot.rev ? 'Entered to make back a loss' : `Re-entered ${Math.max(0, Math.round(gap))} min after a ${prev.t._.res === 'L' ? 'loss' : 'rule break'} (cooldown ${C.cooldownMin} min)`; }
      else if (over || mot.imp || ps.origin === 'reactive' || actedTag) { cat = 'imp'; why = over ? 'Overtrading' : mot.imp ? 'Motive: ' + mot.l.toLowerCase() : ps.origin === 'reactive' ? 'Reactive entry' : 'Acted on a tagged urge'; }
      else { cat = 'sel'; why = 'Setup did not pass the playbook'; }
    }
    let q = null, flaws = [];
    if (v !== 'invalid') {
      const e = ['late', 'size'].includes(ps.hes) || negCmt(t, 'entry') || hasMist(t, ['Chased entry', 'Entered early']);
      const m = !rv.includes('Loss ran past the stop') && (negCmt(t, 'mgmt') || hasMist(t, ['Moved stop']));
      const x = ps.exit === 'emo' || negCmt(t, 'exit', ['Let loser run past stop']) || hasMist(t, ['Early exit']);
      if (e) flaws.push(ps.hes === 'late' || ps.hes === 'size' ? 'Hesitation hurt the entry' : 'Entry flaw');
      if (m) flaws.push('Managed off-plan');
      if (x) flaws.push('Emotional exit');
      q = Math.max(0, 1 - (e ? .4 : 0) - (m ? .3 : 0) - (x ? .4 : 0));
    }
    const row = { t, v, reasons, rv, cat, why, q, flaws, over, exitTs: psyExitTs(t), c6: psyClass6(t, v) };
    rows.push(row); prev = row;
  });
  const psychMissed = missed.filter(t => C.psychMiss.includes(t.missReason));
  // live events: resisted vs acted
  const urgeEv = ev.filter(e => PSY_TAG[e.tag]?.urge);
  const linked = e => trades.some(t => t._.ts >= e.at - 60000 && t._.ts <= e.at + 5 * 60000);
  const R = ev.filter(e => PSY_TAG[e.tag] && ['resisted', 'paused'].includes(e.act)).length;
  const actedFree = urgeEv.filter(e => e.act === 'acted' && !linked(e)).length;
  const cb = psyCircuit(date, rows, ev, rd, depth);
  // categories
  const cnt = k => rows.filter(r => r.cat === k).length;
  const unclear = rows.filter(r => r.v === 'unclear').length;
  const execRows = rows.filter(r => r.v !== 'invalid');
  const riskRows = rows.filter(r => r.rv.length);
  const sc = {};
  const rehN = psyCfg().scen.filter(s => (P.reh || {})[s.id]).length;
  sc.prep = Math.min(1, (rd.n / PSY_READY.length) * .3 + ([pre.trap, pre.resp, (pre.obj || []).length].filter(Boolean).length / 3) * .1 + rehN / Math.max(1, psyCfg().scen.length) * .3 + ((j.plan || '').trim().length >= 20 ? .3 : 0));
  sc.sel = Math.max(0, 1 - .5 * cnt('sel') - .15 * unclear);
  sc.exec = execRows.length + psychMissed.length ? (sum(execRows.map(r => r.q)) + .25 * psychMissed.length) / (execRows.length + psychMissed.length) : null;
  sc.risk = riskRows.length ? 0 : 1;
  sc.emo = cb.tradedInRed ? 0 : Math.max(0, 1 - .5 * cnt('emo') - (cb.yellowNoProtocol ? .2 : 0));
  const A = cnt('imp') + actedFree;
  sc.imp = (R + 1) / (R + A + 1);
  const devs = psyDeviations(rows, ev, psychMissed, trades);
  const post = P.post || {};
  sc.rev = (post.done ? .6 : 0) + (devs.length ? ((post.chains || []).length ? .4 : 0) : .4);
  const hasAny = !!j.psy || ((trades.length || missed.length) && C.since && date >= C.since);
  let score = null, raw = null, caps = [];
  if (!off && hasAny) {
    let tw = 0, ts = 0; for (const k in PSY_W) if (sc[k] != null) { tw += PSY_W[k]; ts += PSY_W[k] * sc[k]; }
    raw = Math.round(ts / tw * 100); score = raw;
    if (riskRows.length) { caps.push('Risk rule broken: capped at 49'); score = Math.min(score, 49); }
    if (cb.tradedInRed) { caps.push('Traded while Red: capped at 59'); score = Math.min(score, 59); }
  }
  const lost = {}; let tw = 0; for (const k in PSY_W) if (sc[k] != null) tw += PSY_W[k];
  for (const k in PSY_W) lost[k] = sc[k] == null ? 0 : PSY_W[k] * (1 - sc[k]) * 100 / (tw || 100);
  return { date, off, rd, maxT, trades, missed, psychMissed, rows, ev, cb, sc, score, raw, caps, lost, R, A, devs, done: !!post.done, chains: post.chains || [], pnl: sum(trades.filter(t => t._.closed).map(t => t._.pnl)), rTot: sum(trades.map(t => t._.r).filter(isNum)) };
}
function psyDeviations(rows, ev, psychMissed, trades) {
  const d = [];
  for (const r of rows) {
    const lab = `${psyHM(r.t._.ts)} ${r.t.dir === 'short' ? 'short' : 'long'}`;
    if (r.v === 'invalid') d.push({ id: 't:' + r.t.id, k: 'invalid', l: `Invalid trade (${lab}): ${r.why || r.reasons[0] || ''}`, pat: PSY_MOTIVE[r.t.psy?.motive]?.pat || (r.cat === 'emo' ? 'repair' : r.cat === 'imp' ? 'miss' : 'narr') });
    else if (r.rv.length) d.push({ id: 'r:' + r.t.id, k: 'risk', l: `Risk rule (${lab}): ${r.rv.join(', ')}`, pat: 'repair' });
    else if (r.flaws.length) d.push({ id: 'f:' + r.t.id, k: 'exec', l: `Execution (${lab}): ${r.flaws.join(', ')}`, pat: r.flaws[0].startsWith('Hesitation') ? 'cert' : r.flaws.includes('Emotional exit') ? 'cert' : 'miss' });
  }
  const linked = e => trades.some(t => t._.ts >= e.at - 60000 && t._.ts <= e.at + 5 * 60000);
  for (const e of ev) if (e.act === 'acted' && PSY_TAG[e.tag]?.urge && !linked(e)) d.push({ id: 'e:' + e.id, k: 'impulse', l: `Acted on ${PSY_TAG[e.tag].l.toLowerCase()} at ${psyHM(e.at)}`, pat: PSY_TAG[e.tag].pat });
  for (const t of psychMissed) d.push({ id: 'm:' + t.id, k: 'missed', l: `Missed a valid setup at ${psyHM(t._.ts)}: ${t.missReason.toLowerCase()}`, pat: 'cert' });
  return d;
}
/* Circuit breaker: replays the session in time order. Trades logged for the day take priority; quick outcome taps
   (Win / Loss / Rule break) only count while no trades are logged, so nothing is counted twice. */
function psyCircuit(date, rows, ev, rd, depth) {
  const C = psyCfg();
  const prevDays = Object.keys(S.journal).filter(k => PSY_DATE.test(k) && k < date && S.journal[k].psy && S.journal[k].psy.type !== 'off').sort();
  let prevRed = false;
  if (prevDays.length && !depth) { const pc = psyEval(prevDays[prevDays.length - 1], 1).cb; prevRed = pc.lv >= 2 || pc.hard; }
  let lv = rd.cls === 'green' || !rd.cls ? 0 : 1; const hist = [];
  if (lv) hist.push({ at: null, lv, why: `Readiness ${rd.cls}` });
  if (prevRed && lv < 1) { lv = 1; hist.push({ at: null, lv, why: 'Last session ended Red' }); }
  const items = [];
  for (const e of ev) items.push({ at: e.at, e });
  const useOut = !rows.length;
  for (const r of rows) items.push({ at: r.t._.ts, r });
  items.sort((a, b) => a.at - b.at);
  const up = (n, at, why) => { if (n > lv) { lv = n; hist.push({ at, lv, why }); } };
  let tagTimes = [], invalid = 0, consec = 0, cum = 0, yellowAt = lv >= 1 ? 0 : null, protocol = false, tradedInRed = false, hard = false;
  for (const it of items) {
    if (it.e) {
      const e = it.e;
      if (e.tag === 'reset') { if (lv === 1 && protocol) { lv = 0; hist.push({ at: e.at, lv, why: 'Protocol done, back to plan' }); yellowAt = null; protocol = false; } continue; }
      if (PSY_OUT[e.tag]) {
        if (!useOut) continue;
        if (e.tag === 'L') { consec++; if (consec >= 2) up(1, e.at, `${consec} losses in a row`); }
        if (e.tag === 'W') consec = 0;
        if (e.tag === 'X') { if (lv >= 2) tradedInRed = true; invalid++; up(invalid >= 2 || lv >= 1 ? 2 : 1, e.at, invalid >= 2 ? '2nd rule break' : lv >= 1 ? 'Rule break while Yellow' : 'Rule break'); }
        if (lv === 1 && yellowAt == null) yellowAt = e.at;
        continue;
      }
      const tg = PSY_TAG[e.tag]; if (!tg) continue;
      tagTimes = tagTimes.filter(x => e.at - x < 15 * 60000); tagTimes.push(e.at);
      if (tagTimes.length >= 2) up(1, e.at, `${tagTimes.length} tags within 15 min`);
      if (tg.urge && e.act === 'acted') up(1, e.at, `Acted on ${tg.l.toLowerCase()}`);
      if (e.tag === 'rev') up(1, e.at, 'Revenge urge');
      if (lv >= 1 && ['resisted', 'paused'].includes(e.act)) protocol = true;
      if (lv === 1 && yellowAt == null) yellowAt = e.at;
      continue;
    }
    const r = it.r;
    if (lv >= 2) tradedInRed = true;
    if (r.v === 'invalid') { invalid++; up(r.cat === 'emo' || invalid >= 2 || lv >= 1 ? 2 : 1, r.t._.ts, r.cat === 'emo' ? 'Revenge / tilt trade' : invalid >= 2 ? '2nd invalid trade' : lv >= 1 ? 'Invalid trade while Yellow' : 'Invalid trade'); }
    if (r.rv.length) up(2, r.t._.ts, 'Risk rule broken');
    if (r.t._.closed) {
      if (r.t._.res === 'L') { consec++; if (consec >= 2) up(1, r.t._.ts, `${consec} losses in a row`); } else if (r.t._.res === 'W') consec = 0;
      cum += r.t._.pnl;
      if (cum <= -C.maxDailyLoss * .5) up(1, r.t._.ts, 'Down half the daily loss limit');
      if (cum <= -C.maxDailyLoss) hard = true;
    }
    if (lv === 1 && yellowAt == null) yellowAt = r.t._.ts;
  }
  const reachedYellow = hist.some(h => h.lv >= 1);
  return { lv, level: hard ? 'stop' : LV[lv], hist, tradedInRed, hard, yellowNoProtocol: reachedYellow && !protocol && lv < 2 && !hist.some(h => h.why === 'Protocol done, back to plan') && ev.some(e => PSY_TAG[e.tag]) };
}
function psyBand(s) { return s == null ? ['—', ''] : s >= 90 ? ['Elite process', 'pos'] : s >= 80 ? ['Professional', 'pos'] : s >= 65 ? ['Developing', ''] : s >= 50 ? ['Inconsistent', 'warn'] : ['Compromised', 'neg']; }

/* ---------- days in range ---------- */
function psyDays(all) {
  const [a, b] = all ? ['0000', '9999'] : rangeBounds(); const set = new Set();
  for (const k of Object.keys(S.journal)) if (PSY_DATE.test(k) && S.journal[k].psy) set.add(k);
  for (const t of S.trades) if (bookOf(t) !== 'bt' && t._.date) set.add(t._.date);
  return [...set].filter(d => d >= a && d <= b).sort();
}
function psyEvals(all) { return psyDays(all).map(psyEval).filter(e => e.score != null); }

/* ---------- aggregate metrics (dashboard + weekly) ---------- */
function psyAgg(E) {
  const rows = E.flatMap(e => e.rows), ev = E.flatMap(e => e.ev);
  const valid = rows.filter(r => r.v === 'valid').length, invalid = rows.filter(r => r.v === 'invalid').length, unclear = rows.filter(r => r.v === 'unclear').length;
  const gatesAsked = rows.filter(r => pbHas(r.t));
  const gatesAll = gatesAsked.filter(r => ['g1', 'g2', 'g3'].every(k => r.t.pb[k] === 'yes')).length;
  const R = sum(E.map(e => e.R)), A = sum(E.map(e => e.A));
  const hesMiss = sum(E.map(e => e.psychMissed.length)), hesEntry = rows.filter(r => ['late', 'size'].includes(r.t.psy?.hes)).length;
  const riskV = rows.filter(r => r.rv.length).length;
  const tagCount = {}; for (const e of ev) if (PSY_TAG[e.tag]) { const o = tagCount[e.tag] || (tagCount[e.tag] = { n: 0, resisted: 0, acted: 0, noted: 0 }); o.n++; o[e.act === 'paused' ? 'resisted' : e.act] = (o[e.act === 'paused' ? 'resisted' : e.act] || 0) + 1; }
  // next-trade quality after a win / loss / mistake (same session only)
  const after = { W: [0, 0], L: [0, 0], X: [0, 0] };
  for (const e of E) for (let i = 1; i < e.rows.length; i++) { const p = e.rows[i - 1], n = e.rows[i]; const ok = n.v === 'valid' ? 1 : 0; if (p.t._.res === 'W') { after.W[0] += ok; after.W[1]++; } if (p.t._.res === 'L') { after.L[0] += ok; after.L[1]++; } if (p.v === 'invalid' || p.rv.length) { after.X[0] += ok; after.X[1]++; } }
  const byReady = {}; for (const e of E) { const k = e.rd.cls || 'not logged'; const o = byReady[k] || (byReady[k] = { n: 0, s: 0, inv: 0 }); o.n++; o.s += e.score; o.inv += e.rows.filter(r => r.v === 'invalid').length; }
  const pat = {}; for (const e of E) for (const c of e.chains) if (c.pat) pat[c.pat] = (pat[c.pat] || 0) + 1;
  for (const e of E) for (const d of e.devs) if (!e.chains.some(c => c.dev === d.id) && d.pat) pat['~' + d.pat] = (pat['~' + d.pat] || 0) + 1;
  const lost = {}; for (const k in PSY_W) lost[k] = sum(E.map(e => e.lost[k]));
  const c6 = {}; for (const r of rows) (c6[r.c6] || (c6[r.c6] = [])).push(r.t); for (const e of E) for (const t of e.missed) (c6[psyClass6(t)] || (c6[psyClass6(t)] = [])).push(t);
  let streak = 0; for (let i = E.length - 1; i >= 0; i--) { const e = E[i]; if (e.rows.some(r => r.v === 'invalid' || r.rv.length)) break; streak++; }
  return { n: E.length, avg: avg(E.map(e => e.score)), valid, invalid, unclear, adh: valid + invalid ? valid / (valid + invalid) : null, gates: gatesAsked.length ? gatesAll / gatesAsked.length : null, gatesN: gatesAsked.length, R, A, resist: R + A ? R / (R + A) : null, hesMiss, hesEntry, riskV, tagCount, after, byReady, pat, lost, c6, streak, trades: rows.length, noTrade: E.filter(e => !e.rows.length).length };
}
const PSY_BOTTLE = {
  sel: ['Taking trades outside the playbook', 'Pre-entry callout: before every click say setup / location / trigger out loud. If any answer is missing or "sort of", no trade.', 'Invalid trades charged to selection: 0–1 for the week'],
  imp: ['Acting on urges (FOMO, boredom, money pressure, overtrading)', 'Urge surfing: every time an urge shows up, tap it, run the 15-second reset, and mark Resisted or Acted. Aim to log every urge, not to feel none.', 'Resisted share ≥ 80% with ≤ 1 impulsive trade'],
  emo: ['Recovery after losses and mistakes (revenge, tilt)', 'Mandatory cooldown after every loss: stand up, log the loss in R, wait the full cooldown before looking at the DOM again.', '0 trades inside the cooldown after a loss or rule break'],
  exec: ['Execution on valid trades (hesitation, early exits, managing by P&L)', '5-second rule: when all three gates are yes, enter at planned size within 5 seconds. Brackets attached at entry, hands off until stop or target.', 'Execution quality ≥ 85% and ≤ 1 psychologically missed setup'],
  risk: ['Risk discipline', 'Bracket orders auto-attached on every entry; daily loss limit set in the platform; size derived from the stop before the open.', '0 risk violations'],
  prep: ['Preparation', 'Readiness check and rehearsal done before 9:25 ET, before you look at the DOM.', 'Preparation complete on every session'],
  rev: ['Review follow-through', 'Debrief within 30 minutes of the close. Map every deviation and write one adjustment only.', 'Debrief finished on every session'],
};
function psyBottleneck(G) {
  const ks = Object.keys(G.lost).sort((a, b) => G.lost[b] - G.lost[a]);
  const k = ks[0]; if (!k || G.lost[k] < 0.5) return null;
  return { k, pts: G.lost[k] / Math.max(1, G.n), b: PSY_BOTTLE[k] };
}
function psyEvidence(k, G) {
  switch (k) {
    case 'sel': return `${G.invalid} invalid of ${G.trades} trades; plan adherence ${pct(G.adh, 0)}.`;
    case 'imp': return `${G.A} acted urges / impulsive trades vs ${G.R} resisted (${pct(G.resist, 0)} resisted).`;
    case 'emo': return `Next trade after a loss was valid ${G.after.L[1] ? pct(G.after.L[0] / G.after.L[1], 0) : '—'} of the time (${G.after.L[1]} cases); after a mistake ${G.after.X[1] ? pct(G.after.X[0] / G.after.X[1], 0) : '—'}.`;
    case 'exec': return `${G.hesMiss} valid setups missed for psychological reasons; ${G.hesEntry} entries hurt by hesitation.`;
    case 'risk': return `${G.riskV} trade${G.riskV === 1 ? '' : 's'} broke a risk rule.`;
    case 'prep': return 'Readiness, rehearsal or written plan was incomplete on some sessions.';
    case 'rev': return 'Debriefs or deviation maps were left unfinished.';
  }
  return '';
}

/* ---------- saving ---------- */
let psyTimer = null;
function psyEdit(date, fn, opts = {}) {
  const obj = Object.assign({}, S.journal[date] || {}, { date });
  PSY_CACHE.clear(); obj.psy = clone(obj.psy || {}); fn(obj.psy, obj);
  const C = psyCfg(); if (!C.since || date < C.since) { C.since = date; saveSettings(); }
  S.journal[date] = obj;
  clearTimeout(psyTimer);
  if (opts.later) psyTimer = setTimeout(() => saveDay(date, S.journal[date]), 600); else saveDay(date, obj);
  if (!opts.quiet) render();
}
function psySetPath(o, path, v) { const ks = path.split('.'); let x = o; for (let i = 0; i < ks.length - 1; i++) x = x[ks[i]] = Object.assign({}, x[ks[i]]); if (v === undefined || v === '') delete x[ks[ks.length - 1]]; else x[ks[ks.length - 1]] = v; }

/* ---------- shared UI bits ---------- */
function psyLevelBox(cb, big) {
  const L = cb.level; const last = cb.hist[cb.hist.length - 1];
  return `<div class="lvl lvl-${L}${big ? ' big' : ''}"><b>${LV_NAME[L]}</b><span>${L === 'stop' ? 'Daily loss limit reached. The session is over: no new orders.' : last ? esc(last.why) + (last.at ? ' · ' + psyHM(last.at) : '') : 'Focused, prepared, following the process.'}</span></div>`;
}
function psyScoreBox(e) {
  const [band, c] = psyBand(e.score);
  return `<div class="panel"><h2>Process score <small>${e.done ? 'final' : 'provisional until the debrief is done'}</small></h2>
    <div class="row between"><b class="num ${c}" style="font-size:34px">${e.score ?? '—'}</b><span class="pill">${band}</span></div>
    ${e.caps.length ? `<p class="hint" style="color:var(--neg)">${e.caps.map(esc).join(' · ')} (uncapped ${e.raw})</p>` : ''}
    <table style="margin-top:8px"><tbody>${Object.keys(PSY_W).map(k => `<tr><td>${PSY_CAT[k]}</td><td class="r num muted">${PSY_W[k]}</td><td style="min-width:90px"><div class="bar"><i style="left:0;width:${e.sc[k] == null ? 0 : Math.round(e.sc[k] * 100)}%;background:var(--${e.sc[k] == null ? 'line2' : e.sc[k] >= .8 ? 'pos' : e.sc[k] >= .5 ? 'warn' : 'neg'})"></i></div></td><td class="r num">${e.sc[k] == null ? 'n/a' : Math.round(e.sc[k] * 100) + '%'}</td></tr>`).join('')}</tbody></table>
    <p class="hint">P&L is not an input. Weights are rescaled when a category doesn't apply (e.g. no valid trades to execute).</p></div>`;
}
function psyScaleRow(date, k, l, dir, v) {
  return `<div class="f"><label>${l} <span class="faint" style="text-transform:none;letter-spacing:0">${dir > 0 ? '1 poor · 5 great' : '1 none · 5 severe'}</span></label><div class="seg yn">${[1, 2, 3, 4, 5].map(n => `<button class="${num(v) === n ? 'on ' + ((dir > 0 ? n >= 4 : n <= 2) ? 'yes' : (dir > 0 ? n <= 2 : n >= 4) ? 'no' : 'unknown') : ''}" data-py="set" data-path="pre.${k}" data-v="${n}">${n}</button>`).join('')}</div></div>`;
}
function psyChip(on, attrs, label, kind = '') { return `<button class="chip ${kind} ${on ? 'on' : ''}" ${attrs}>${esc(label)}</button>`; }
function psyC6Pill(k) { const c = { vw: 'W', vl: 'pb-ok', iw: 'pb-off', il: 'L', mp: 'pb-und', mx: 'pb-none', u: 'pb-none' }[k]; return `<span class="pill ${c}">${PSY_CLASS6[k]}</span>`; }

/* ---------- Today: phases A-E ---------- */
NAV.splice(1, 0, ['Performance', [['today', 'Today', 'sun'], ['live', 'Live session', 'pulse'], ['mind', 'Mind dashboard', 'brain'], ['mental', 'Mental playbook', 'shield']]]);
Object.assign(IC, {
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  pulse: '<path d="M3 12h4l2-5 4 10 2-5h6"/><circle cx="12" cy="12" r="10" stroke-dasharray="2 3"/>',
  brain: '<path d="M9 4a3 3 0 0 0-3 3 3 3 0 0 0-2 5 3 3 0 0 0 2 5 3 3 0 0 0 6 1V5a3 3 0 0 0-3-1zM15 4a3 3 0 0 1 3 3 3 3 0 0 1 2 5 3 3 0 0 1-2 5 3 3 0 0 1-6 1"/>',
  shield: '<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/><path d="m9 12 2 2 4-4"/>',
});
Object.assign(TITLES, { today: 'Today: session workflow', live: 'Live session', mind: 'Mind dashboard', mental: 'Mental playbook' });

function psyDateBar(date) {
  const P = psyP(date);
  return `<div class="row between"><div class="row"><button class="btn sm" data-py="day" data-v="${psyAddDays(date, -1)}">‹</button><input class="inp" type="date" id="jd-pick" value="${date}"><button class="btn sm" data-py="day" data-v="${psyAddDays(date, 1)}">›</button>${date !== psyToday() ? `<button class="btn sm ghost" data-py="day" data-v="${psyToday()}">Today</button>` : ''}</div>
    <div class="seg"><button class="${P.type !== 'off' ? 'on' : ''}" data-py="set" data-path="type" data-v="trade">Trading session</button><button class="${P.type === 'off' ? 'on' : ''}" data-py="set" data-path="type" data-v="off">Not trading today</button></div></div>`;
}
VIEWS.today = {
  html() {
    const date = psyDate(); S.sub.jd = date;
    const P = psyP(date); const j = psyJ(date);
    if (P.type === 'off') return psyDateBar(date) + `<div class="panel empty"><p><b>Marked as a non-trading day.</b></p><p class="hint">No score is produced and the day is left out of your averages. Choosing not to trade on a planned day off is not a no-trade session; a no-trade session is a trading day where no valid setup appeared.</p></div>`;
    const e = psyEval(date); const pre = P.pre || {}; const rd = e.rd; const C = psyCfg();
    const sug = psySuggestTrap(pre); const trap = pre.trap || '';
    const rec = rd.cls ? PSY_READY_REC[rd.cls] : null;
    const tp = psyPat(trap);
    const doneA = rd.n === PSY_READY.length && pre.trap && pre.resp && !S.sub.pyOpenA;
    const A = doneA ? `<div class="panel"><div class="row between"><span><b>A · Readiness ${rd.idx}/100 · ${rec[0]}</b> <span class="muted">· trap: ${esc(tp ? tp.name : '')} · max ${e.maxT ?? '—'} trades</span><br><span class="hint">${esc(pre.resp)}</span></span><button class="btn sm ghost" data-py="openA">Edit</button></div></div>` : `<div class="panel stack"><h2>A · Premarket readiness <small>3–5 min · answer for how you are right now</small></h2>
      <div class="fgrid" style="grid-template-columns:repeat(2,minmax(0,1fr))">${PSY_READY.map(([k, l, d]) => psyScaleRow(date, k, l, d, pre[k])).join('')}</div>
      ${rec ? `<div class="lvl lvl-${rd.cls}"><b>Readiness ${rd.idx}/100 · ${rec[0]}</b><span>${rec[1]} ${rec[2]}${rd.flags.length ? ` Red flags: ${esc(rd.flags.join(', '))}.` : ''}</span></div>` : `<p class="hint">Answer at least 6 to get a readiness level (${rd.n}/12 so far).</p>`}
      <div class="f"><label>My most likely trap today ${!trap ? `<span class="faint" style="text-transform:none;letter-spacing:0">suggested: ${esc(psyPat(sug)?.name || '')}</span>` : ''}</label><div class="chips">${C.patterns.map(p => psyChip(trap === p.id, `data-py="trap" data-v="${esc(p.id)}"`, p.name, p.id === sug && !trap ? 'cp' : '')).join('')}</div></div>
      ${tp ? `<p class="hint" style="margin:0"><b>Early warning signs:</b> ${esc(tp.warnings)}</p>` : ''}
      <div class="fgrid" style="grid-template-columns:1fr 2fr">
        <div class="f"><label>What could trigger it today?</label><input class="inp" data-pyf="pre.trig" value="${esc(pre.trig || '')}" placeholder="${esc(tp ? tp.triggers.split(';')[0] : 'e.g. a fast move into my level')}"></div>
        <div class="f"><label>Planned response (if… then…)</label><input class="inp" data-pyf="pre.resp" value="${esc(pre.resp || '')}" placeholder="${esc(tp ? tp.ifthen : 'If ___ happens, then I will ___')}">${tp && !pre.resp ? `<button class="btn sm ghost" style="align-self:flex-start" data-py="useifthen">Use the playbook response</button>` : ''}</div>
      </div>
      <div class="f"><label>Primary behavioral objective (pick 1–2)</label><div class="chips">${PSY_OBJ.map(o => psyChip((pre.obj || []).includes(o), `data-py="obj" data-v="${esc(o)}"`, o)).join('')}</div></div>
      <div class="fgrid" style="grid-template-columns:3fr 1fr">
        <div class="f"><label>A successful session looks like (no P&L)</label><input class="inp" data-pyf="pre.success" value="${esc(pre.success || '')}" placeholder="e.g. Only traded my two levels, held to target, logged every urge"></div>
        <div class="f"><label>Max trades today</label><input class="inp num" type="number" min="0" data-pyf="pre.maxT" value="${esc(pre.maxT ?? '')}" placeholder="${psyRecMax(rd.cls)} recommended"></div>
      </div>
      <div class="f"><label>Premarket execution plan</label><textarea class="inp" data-j="plan" placeholder="Bias as if/then, key levels, invalidation, trade locations, max trades, risk">${esc(j.plan || '')}</textarea></div></div>`;
    const reh = P.reh || {};
    const doneB = C.scen.every(x => reh[x.id]) && !S.sub.pyOpenB;
    const B = doneB ? `<div class="panel"><div class="row between"><b>B · Mental rehearsal done <span class="muted" style="font-weight:500">· ${C.scen.length} scenarios</span></b><button class="btn sm ghost" data-py="openB">Show</button></div></div>` : `<div class="panel stack"><h2>B · Mental rehearsal <small>1–2 min · picture each one at your level on the DOM, then read the response once</small></h2>
      <div class="grid g2" style="gap:8px">${C.scen.map(s => `<label class="rehe ${reh[s.id] ? 'on' : ''}"><input type="checkbox" data-py="reh" data-v="${esc(s.id)}" ${reh[s.id] ? 'checked' : ''}><span><b>${esc(s.l)}</b><br><span class="muted">${esc(s.t)}</span></span></label>`).join('')}</div>
      <div class="row"><button class="btn sm" data-py="rehall">Mark all rehearsed</button><span class="hint">Edit these in Mental playbook → Rehearsal.</span></div></div>`;
    return psyDateBar(date) + `<div class="grid g32"><div class="stack" style="gap:16px">${A}${B}${psyLivePanel(date, e)}${psyTradesPanel(date, e)}${psyDebrief(date, e)}</div>
      <div class="stack" style="gap:16px">${psyScoreBox(e)}${psyCircuitCard(e)}</div></div>`;
  }
};
VIEWS.live = {
  html() {
    const date = psyToday(); S.sub.jd = date; const e = psyEval(date);
    return `<div class="grid g32"><div class="stack" style="gap:16px">${psyLivePanel(date, e, true)}</div><div class="stack" style="gap:16px">${psyCircuitCard(e)}<div class="panel"><h2>Today's plan</h2>${psyP(date).pre?.resp ? `<p><b>If-then:</b> ${esc(psyP(date).pre.resp)}</p>` : ''}<div class="note">${esc(psyJ(date).plan || 'No premarket plan written. Write it in Today.')}</div></div></div></div>`;
  }
};
function psyLivePanel(date, e, full) {
  const ev = e.ev; const open = ev.find(x => x.id === S.sub.pyOpen);
  const noTrades = !e.trades.length;
  return `<div class="panel stack"><h2>C · Live session <small>one tap; no typing while the market moves</small></h2>
    ${psyLevelBox(e.cb, true)}
    <div class="tagrid">${PSY_TAGS.map(t => `<button class="tagbtn ${t.urge ? 'urge' : ''}" data-py="tag" data-v="${t.id}">${esc(t.l)}</button>`).join('')}</div>
    <div class="row"><span class="lbl">Quick outcome</span>${Object.entries(PSY_OUT).map(([k, l]) => `<button class="btn sm" data-py="tag" data-v="${k}">${l}</button>`).join('')}<span class="hint">${noTrades ? 'Used for the circuit breaker until you log the trades.' : 'Ignored now: logged trades drive the circuit breaker.'}</span></div>
    ${open ? psyProtocol(open, e) : ''}
    ${e.cb.level === 'red' || e.cb.level === 'stop' ? `<div class="lvl lvl-red"><b>Stop trading for the rest of this session.</b><span>Flatten, close the DOM, log what happened while it's fresh. The next session starts at Yellow. Hard financial limits are never overridden by anything on this screen.</span></div>` : ''}
    ${ev.length ? `<div class="tbl-wrap"><table><thead><tr><th>Time</th><th>Tag</th><th>What I did</th><th></th></tr></thead><tbody>${ev.slice().reverse().map(x => `<tr><td><input class="inp num" type="time" style="width:96px" data-pyev="${esc(x.id)}" value="${psyHM(x.at)}"></td><td>${esc(PSY_TAG[x.tag]?.l || PSY_OUT[x.tag] || (x.tag === 'reset' ? 'Back to green' : x.tag))}</td><td>${PSY_TAG[x.tag] ? `<div class="seg">${Object.entries(PSY_ACTS).map(([k, l]) => `<button class="${x.act === k ? 'on' : ''}" data-py="act" data-id="${esc(x.id)}" data-v="${k}">${l}</button>`).join('')}</div>` : ''}</td><td class="r"><button class="btn sm ghost" data-py="delev" data-id="${esc(x.id)}">×</button></td></tr>`).join('')}</tbody></table></div>` : `<p class="hint">Tap a tag the moment you notice it. Feeling it isn't a mistake; acting on it is what gets scored.</p>`}
    ${e.cb.level === 'yellow' && ev.some(x => ['resisted', 'paused'].includes(x.act)) ? `<div><button class="btn sm" data-py="tag" data-v="reset">Protocol done: back to Green</button></div>` : ''}
    ${full ? '' : ''}</div>`;
}
function psyProtocol(x, e) {
  const t = PSY_TAG[x.tag]; const p = psyPat(t?.pat);
  const many = e.ev.filter(y => PSY_TAG[y.tag] && x.at - y.at < 15 * 60000 && y.at <= x.at).length >= 2;
  return `<div class="proto"><div class="row between"><b>15-second reset · ${esc(t ? t.l : '')}</b><button class="btn sm ghost" data-py="closeproto">Close</button></div>
    <ol><li><b>Name it.</b> "I notice ${esc((t?.l || '').toLowerCase())}." Done by tapping.</li><li><b>Hands off.</b> Mouse away from the DOM. One slow breath: in 4, out 6.</li>
    <li><b>Facts.</b> Market state right now? Is price at a pre-marked location? Did your trigger actually print?</li><li><b>Rules.</b> Does this match my written plan?</li>
    <li><b>Decide.</b> All three gates yes → execute normally. Otherwise stand down.${many || x.tag === 'rev' ? ' <b>This is a repeat or a revenge urge: pause 5 minutes away from the screen.</b>' : ''}</li></ol>
    ${p ? `<p class="hint" style="margin:0"><b>${esc(p.name)}:</b> ${esc(p.ifthen)}</p>` : ''}
    <p class="hint" style="margin:0"><b>Tolerate it</b> if you can still answer the facts questions and you haven't broken a rule. <b>Step away</b> if you can't state the market state, the urge is back within minutes, you already acted on one, or your body is still racing after the breath.</p>
    <div class="row">${['resisted', 'paused', 'acted'].map(k => `<button class="btn sm ${k === 'acted' ? 'danger' : 'pri'}" data-py="act" data-id="${esc(x.id)}" data-v="${k}" data-close="1">${PSY_ACTS[k]}</button>`).join('')}</div></div>`;
}
function psyCircuitCard(e) {
  const L = e.cb.level === 'stop' ? 'red' : e.cb.level; const c = PSY_CB[L];
  return `<div class="panel stack"><h2>Circuit breaker</h2>${psyLevelBox(e.cb)}
    ${e.cb.hist.length ? `<div class="hint">${e.cb.hist.map(h => `${h.at ? psyHM(h.at) + ' · ' : ''}${LV[h.lv]}: ${esc(h.why)}`).join('<br>')}</div>` : ''}
    <div><span class="lbl">Allowed</span><p class="hint" style="margin:2px 0 0">${c.allow}</p></div>
    <div><span class="lbl">Not allowed</span><p class="hint" style="margin:2px 0 0">${c.deny}</p></div>
    <div><span class="lbl">Required now</span><p class="hint" style="margin:2px 0 0">${c.req}</p></div>
    <div><span class="lbl">Resume when</span><p class="hint" style="margin:2px 0 0">${c.resume}</p></div>
    <p class="hint" style="margin:0">Max trades ${e.maxT ?? '—'} · daily loss limit ${fmt$(psyCfg().maxDailyLoss)} · cooldown ${psyCfg().cooldownMin} min. Your prop firm's limits always win if stricter.</p></div>`;
}
const PSY_CB = {
  green: { ind: 'Readiness green; no more than one tag in 15 min; no invalid trades; no risk breaks.', warn: 'Calm attention, patience at levels, able to sit through slow tape.', allow: 'Normal plan: approved setups at pre-marked locations, planned size, up to max trades.', deny: 'Nothing beyond your normal rules.', req: 'Tag any urge the moment you notice it.', resume: '—', end: 'Max trades reached, hard loss limit, or 12:00 ET.' },
  yellow: { ind: 'Readiness yellow/red, or: 2+ tags in 15 min, an urge acted on, a revenge urge, 1 invalid trade, 2 losses in a row, down 50% of the daily limit, or last session ended Red.', warn: 'Urgency, frustration, fear, overconfidence, wanting to deviate, checking P&L.', allow: 'A+ setups only, minimum size, full cooldown after any loss.', deny: 'Adding to losers, new setups, size increases, trading away from pre-marked levels, re-entering inside the cooldown.', req: 'Run the 15-second reset now and mark it Resisted or Paused. After a 2nd tag or a revenge urge: 5 minutes off screen.', resume: 'Protocol logged, 3 gate questions answered calmly, then tap "back to Green". A loss streak keeps you Yellow for the session.', end: 'Any further rule break → Red.' },
  red: { ind: '2 invalid trades, an invalid trade while Yellow, a revenge/tilt trade, any risk-rule break, or the daily loss limit.', warn: "Can't disengage, escalating emotion, rules feel optional, justifying trades.", allow: 'Flatten, close the DOM, journal.', deny: 'Any new order for the rest of the session.', req: 'End the session. Map what happened in the debrief while it is fresh.', resume: 'Next session, starting at Yellow.', end: 'Immediately.' },
};
function psyTradesPanel(date, e) {
  const rows = e.rows;
  return `<div class="panel stack"><h2>D · Trades & missed setups <span class="row"><button class="btn sm" data-py="newmissed">${icon('plus')}Missed setup</button><button class="btn sm pri" data-act="new-trade">${icon('plus')}Trade</button></span></h2>
    ${rows.length || e.missed.length ? `<div class="tbl-wrap"><table><thead><tr><th>Time</th><th>Side</th><th>Class</th><th>Charged to</th><th>Psychology</th><th class="r">R</th></tr></thead><tbody>
      ${rows.map(r => `<tr class="click" data-trade="${esc(r.t.id)}"><td>${psyHM(r.t._.ts)}</td><td><span class="pill ${r.t.dir === 'short' ? 'short' : 'long'}">${r.t.dir === 'short' ? 'Short' : 'Long'}</span></td><td>${psyC6Pill(r.c6)}</td><td class="muted" style="white-space:normal;max-width:240px">${r.cat ? PSY_CAT[r.cat] + (r.why ? ' · ' + esc(r.why) : '') : r.rv.length ? 'Risk: ' + esc(r.rv.join(', ')) : r.flaws.length ? esc(r.flaws.join(', ')) : r.v === 'unclear' ? 'Finish the playbook fields' : '—'}</td><td>${r.t.psy?.motive ? esc(PSY_MOTIVE[r.t.psy.motive]?.l || '') : '<span class="faint">not filled</span>'}</td><td class="r num ${cls(r.t._.r)}">${fmtR(r.t._.r)}</td></tr>`).join('')}
      ${e.missed.map(t => `<tr class="click" data-trade="${esc(t.id)}"><td>${psyHM(t._.ts)}</td><td><span class="pill ${t.dir === 'short' ? 'short' : 'long'}">${t.dir === 'short' ? 'Short' : 'Long'}</span></td><td>${psyC6Pill(psyClass6(t))}</td><td class="muted">${esc(t.missReason || '')}</td><td></td><td class="r num ${cls(t._.r)}">${fmtR(t._.r)}</td></tr>`).join('')}
      </tbody></table></div>` : `<p class="hint">No trades logged for this day. A day with no valid setup and no trades is a disciplined no-trade session.</p>`}</div>`;
}
function psyDebrief(date, e) {
  const j = psyJ(date); const P = psyP(date); const post = P.post || {}; const chains = post.chains || [];
  const devs = e.devs; const unmapped = devs.filter(d => !chains.some(c => c.dev === d.id));
  const clean = !devs.length;
  const v = e.rows.filter(r => r.v === 'valid').length, inv = e.rows.filter(r => r.v === 'invalid').length;
  return `<div class="panel stack"><h2>E · Postmarket debrief <small>5–8 min · process first, P&L last</small></h2>
    <div class="kv"><div><label>Trades</label><b>${e.rows.length} (${v} valid · ${inv} invalid)</b></div><div><label>Urges resisted / acted</label><b>${e.R} / ${e.A}</b></div><div><label>Missed (psych.)</label><b>${e.psychMissed.length}</b></div></div>
    <div class="f"><label>What did I execute well today?</label><textarea class="inp" data-j="right" rows="2" style="min-height:56px">${esc(j.right || '')}</textarea></div>
    ${clean ? `<div class="banner"><span><b>No deviations found.</b> Nothing to map. ${e.rows.length ? '' : 'A clean no-trade session counts.'}</span>${post.deep ? '' : `<button class="btn sm ghost" data-py="deep">Deep review anyway</button>`}</div>` :
      `<div><span class="lbl">Where behavior deviated from intention</span><p class="hint" style="margin:4px 0 8px">Map each one: Trigger → Interpretation → Emotion → Urge → Behavior → Consequence → Corrective. Pick the loop it belongs to; one root pattern often explains several symptoms.</p>
      ${devs.map(d => { const c = chains.find(x => x.dev === d.id); return `<div class="devrow"><span>${esc(d.l)}</span>${c ? `<span class="pill pb-ok">Mapped · ${esc(psyPat(c.pat)?.name || '')}</span>` : `<button class="btn sm" data-py="mapdev" data-id="${esc(d.id)}" data-pat="${esc(d.pat || '')}">Map it</button>`}</div>`; }).join('')}</div>`}
    ${chains.map((c, i) => psyChainForm(c, i)).join('')}
    ${post.deep && clean && !chains.length ? `<div><button class="btn sm" data-py="mapdev" data-id="deep" data-pat="">Map a pattern I noticed</button></div>` : ''}
    <div class="f"><label>The single most important behavioral adjustment for next session</label><textarea class="inp" data-j="lesson" rows="2" style="min-height:56px" placeholder="One behavior, stated as an action. e.g. Wait the full 10-minute cooldown after any loss.">${esc(j.lesson || '')}</textarea></div>
    <div class="row between"><span class="hint">${unmapped.length ? `${unmapped.length} deviation${unmapped.length > 1 ? 's' : ''} still unmapped.` : ''}</span>${post.done ? `<span class="pill pb-ok">Debrief done</span>` : `<button class="btn pri" data-py="finish">Finish debrief</button>`}</div></div>`;
}
const PSY_CHAIN = [['trigger', 'Trigger', 'What happened in the market or in me?'], ['interp', 'Interpretation', 'What was I telling myself?'], ['emotion', 'Emotion', 'What did I feel?'], ['urge', 'Urge', 'What did I want to do?'], ['behavior', 'Behavior', 'What did I actually do?'], ['shortC', 'Immediate relief sought', 'What did it give me right then?'], ['longC', 'Long-term cost', 'What does it reinforce?'], ['belief', 'Underlying belief', 'The assumption behind it'], ['evidence', 'Evidence check', 'What evidence did I have that my read was right?'], ['corrective', 'Professional response', 'What would a professional have done?']];
function psyChainForm(c, i) {
  const p = psyPat(c.pat);
  return `<div class="pbbox"><div class="row between"><b>${esc(c.label || 'Pattern map')}</b><button class="btn sm ghost" data-py="delchain" data-v="${i}">Remove</button></div>
    <div class="chips">${psyCfg().patterns.map(x => psyChip(c.pat === x.id, `data-py="chainpat" data-i="${i}" data-v="${esc(x.id)}"`, x.name)).join('')}</div>
    <div class="fgrid" style="grid-template-columns:repeat(2,minmax(0,1fr))">${PSY_CHAIN.map(([k, l, ph]) => `<div class="f"><label>${l}</label><input class="inp" data-pyf="post.chains.${i}.${k}" value="${esc(c[k] || '')}" placeholder="${esc(p && p[k] ? p[k] : ph)}"></div>`).join('')}</div>
    ${p ? `<p class="hint" style="margin:0">Placeholders show your playbook's usual version of this loop. Overwrite them only where today was different. <b>Replacement belief:</b> ${esc(p.replacement)}</p>` : ''}</div>`;
}

/* ---------- trade form section + drawer ---------- */
function psyFormSection() {
  if (!F || bookOf(F) !== 'live') return '';
  const p = F.psy || {};
  const seg = (k, opts) => `<div class="seg yn">${opts.map(([v, l]) => `<button class="${p[k] === v ? 'on ' + (['plan', 'yes', 'no', 'sys', 'none', 'ontime'].includes(v) && k !== 'rat' && k !== 'urg' ? 'yes' : ['emo', 'late', 'size', 'reactive'].includes(v) || (k === 'rat' && v === 'yes') || (k === 'urg' && v === 'yes') || (k === 'risk' && v === 'no') ? 'no' : 'unknown') : ''}" data-tpsy="${k}" data-v="${v}">${l}</button>`).join('')}</div>`;
  return `<div class="sec-t">Psychology</div><div class="pbbox">
    <div class="f"><label>Main reason I entered</label><div class="chips">${PSY_MOTIVES.map(m => `<button class="chip ${m.id === 'plan' ? 'cp' : m.imp || m.rev ? 'cn' : ''} ${p.motive === m.id ? 'on' : ''}" data-tpsy="motive" data-v="${m.id}">${esc(m.l)}</button>`).join('')}</div></div>
    <div class="fgrid">
      <div class="f"><label>Planned or reactive</label>${seg('origin', [['planned', 'Planned'], ['reactive', 'Reactive']])}</div>
      <div class="f"><label>Confidence in the setup</label><div class="seg yn">${[1, 2, 3, 4, 5].map(n => `<button class="${p.conf === n ? 'on unknown' : ''}" data-tpsy="conf" data-v="${n}">${n}</button>`).join('')}</div></div>
      <div class="f span2"><label>Hesitation</label>${seg('hes', [['none', 'None'], ['ontime', 'Felt it, entered on time'], ['late', 'Late entry'], ['size', 'Cut size']])}</div>
      <div class="f"><label>Urgency drove the decision</label>${seg('urg', [['no', 'No'], ['yes', 'Yes']])}</div>
      <div class="f"><label>Risk rules followed</label>${seg('risk', [['yes', 'Yes'], ['no', 'No']])}</div>
      <div class="f"><label>Rationalized after the fact</label>${seg('rat', [['no', 'No'], ['yes', 'Yes']])}</div>
      <div class="f"><label>Exit</label>${seg('exit', [['sys', 'Systematic'], ['emo', 'Emotional']])}</div>
    </div>
    <p class="hint" style="margin:0">Rationalized = the reason you'd give now isn't the reason you clicked. Answering Yes makes the trade invalid regardless of the gates. Log the emotion before entry under Custom statistics → Emotional state.</p></div>`;
}
function psyDrawer(t) {
  if (bookOf(t) === 'bt') return '';
  const e = psyEval(t._.date); const r = e.rows.find(x => x.t.id === t.id);
  const c6 = r ? r.c6 : psyClass6(t); const p = t.psy || {};
  const L = [p.motive && ['Reason', PSY_MOTIVE[p.motive]?.l], p.origin && ['Origin', p.origin], p.conf && ['Confidence', p.conf + '/5'], p.hes && ['Hesitation', { none: 'None', ontime: 'Felt it, on time', late: 'Late entry', size: 'Cut size' }[p.hes]], p.urg && ['Urgency drove it', p.urg], p.risk && ['Risk rules followed', p.risk], p.rat && ['Rationalized', p.rat], p.exit && ['Exit', p.exit === 'sys' ? 'Systematic' : 'Emotional']].filter(Boolean);
  return `<div><span class="lbl">Process classification</span><div class="row" style="margin-top:4px">${psyC6Pill(c6)}${r && r.cat ? `<span class="hint">Charged to ${PSY_CAT[r.cat]}${r.why ? ': ' + esc(r.why) : ''}</span>` : ''}</div>
    ${r && r.rv.length ? `<p class="hint" style="color:var(--neg)">Risk: ${esc(r.rv.join(', '))}</p>` : ''}${r && r.flaws.length ? `<p class="hint">Execution: ${esc(r.flaws.join(', '))}</p>` : ''}
    ${c6 === 'iw' ? '<p class="hint"><b>An invalid winner is not a success.</b> It counts as a rule break; the profit does not offset it.</p>' : ''}
    ${L.length ? `<div class="kv" style="margin-top:8px">${L.map(([a, b]) => `<div><label>${a}</label><b style="font-family:var(--ui)">${esc(b)}</b></div>`).join('')}</div>` : (bookOf(t) === 'live' ? '<p class="hint">Psychology fields not filled in yet.</p>' : '')}</div>`;
}
function psyDiaryBanner(date) {
  const e = psyEval(date); if (e.score == null && !psyP(date).pre) return `<div class="banner"><span>Run the full session workflow (readiness, rehearsal, live tags, debrief) in <b>Today</b>.</span><button class="btn sm" data-py="opentoday" data-v="${date}">Open in Today</button></div>`;
  const [band, c] = psyBand(e.score);
  return `<div class="banner"><span>Process score <b class="num ${c}">${e.score ?? '—'}</b> · ${band}${e.rd.cls ? ` · readiness ${e.rd.cls}` : ''} · ${e.done ? 'debrief done' : 'debrief not finished'}</span><button class="btn sm" data-py="opentoday" data-v="${date}">Open in Today</button></div>`;
}

/* ---------- Mind dashboard ---------- */
const PSY_METRICS = [
  ['Process score', 'How closely the session followed your process.', 'Weighted categories (see Score rules); 0–100. Risk breaks cap it at 49, trading while Red at 59.', 'It rewards decisions, not outcomes, so it is the number you control.', 'Self-reported fields (motive, hesitation) can be shaded. Partly subjective.', 'Read the weakest category on the day; the weekly review picks one to train.'],
  ['Rolling 10-session score', 'Trend of your process.', 'Mean of the last 10 scored sessions.', 'One day is noise; ten is a direction.', 'Lags; a bad streak takes days to show.', 'A drop of 10+ points: go back to the phase of the program that covers the weakest category.'],
  ['Plan adherence', 'Share of trades that passed the playbook.', 'Valid ÷ (valid + invalid). Unclear trades excluded until classified.', 'Off-playbook trades contaminate the data that tells you whether your edge exists.', 'Only as honest as your gate answers. Unclassified trades hide from it.', 'Below 90%: train selection (pre-entry callout).'],
  ['3 Gates compliance', 'Trades where all three gates were answered Yes.', 'Trades with G1, G2, G3 = Yes ÷ trades with playbook fields.', 'Checks the core rule directly.', 'Unknown answers count as not-yes.', 'Look at which gate fails most in Playbook compliance.'],
  ['Impulse resistance', 'How often you held back when an urge showed up.', 'Resisted + paused ÷ (resisted + paused + acted urges + impulsive trades).', 'Resisting a bad trade is a performance achievement and should show up somewhere.', 'Depends on tagging urges you resisted; untagged urges are invisible.', 'Below 70%: the weekly exercise becomes urge surfing.'],
  ['Psychological misses', 'Valid setups you didn\'t take because of hesitation or doubt.', 'Missed trades whose reason is in your psychological-miss list (Settings in Mental playbook).', 'Hesitation costs edge as surely as impulsive trades do.', 'Only counts misses you log.', 'Rising: train execution confidence (5-second rule).'],
  ['Risk violations', 'Trades that broke a hard risk rule.', 'No stop, risk over max, loss past the stop, or trading after the daily limit.', 'One risk break can erase weeks of good process; that is why it caps the score.', 'Loss past the stop uses −1.25R to allow slippage.', 'Any at all: risk becomes the priority, ahead of everything else.'],
  ['After a win / loss / mistake', 'Whether the next trade in the same session stayed valid.', 'Valid next trades ÷ next trades, split by what came before.', 'Shows whether recent outcomes steer your decisions.', 'Small samples; one session can swing it.', 'After-loss well below after-win: recovery is the bottleneck (cooldown).'],
  ['Readiness vs execution', 'Whether low readiness predicts worse process.', 'Average score and invalid trades per session, by readiness level.', 'Tells you whether to respect Yellow/Red mornings.', 'Correlation, not cause; needs many sessions.', 'If Yellow days are much worse, cut size on Yellow automatically.'],
  ['Process vs outcome', 'Whether better process lines up with better results.', 'Each dot is a session: process score against total R.', 'Over time, good process should drift toward better R. If it never does, the strategy itself needs review.', 'Short-term variance hides any relationship; ignore it under ~40 sessions.', 'Use it to stop judging days by P&L.'],
  ['Pattern recurrence', 'Which loop keeps showing up.', 'Mapped chains plus unmapped deviations, by loop.', 'One root loop often explains several symptoms.', 'Relies on mapping in the debrief.', 'The top loop gets its if-then rehearsed first every morning.'],
  ['Clean streak', 'Consecutive sessions with no invalid trades and no risk breaks.', 'Counted back from the latest session.', 'Visible proof of consistency builds confidence from evidence.', 'Rewards no-trade days too; check psychological misses alongside it.', 'Protect it: on a streak day, the bar for a marginal setup is higher.'],
];
VIEWS.mind = {
  html() {
    const tab = S.sub.mind || 'overview';
    const head = `<div class="tabs">${[['overview', 'Overview'], ['week', 'Weekly review'], ['guide', 'Metric guide']].map(([k, l]) => `<button class="tab ${tab === k ? 'on' : ''}" data-sub="mind:${k}">${l}</button>`).join('')}</div>`;
    if (tab === 'guide') return head + psyGuide();
    if (tab === 'week') return head + psyWeekView();
    const E = psyEvals(); if (!E.length) return head + `<div class="panel empty"><p><b>No scored sessions in this range.</b></p><p class="hint">Fill in Today (readiness, live tags, debrief) and the psychology fields on your trades. Sample trades are not used here.</p><p><button class="btn pri" data-nav="today">Open Today</button></p></div>`;
    const G = psyAgg(E); const last = E[E.length - 1]; const r10 = avg(E.slice(-10).map(e => e.score));
    const small = E.length < 20 ? `<div class="banner"><span><b>${E.length} session${E.length > 1 ? 's' : ''}.</b> Under 20 sessions, treat every relationship below as a hint, not a finding.</span></div>` : '';
    const c6 = Object.keys(PSY_CLASS6).map(k => [k, G.c6[k] || []]);
    const pats = psyCfg().patterns.map(p => { const recent = psyAgg(E.slice(-10)).pat, before = psyAgg(E.slice(-20, -10)).pat; const n = (o) => (o[p.id] || 0) + (o['~' + p.id] || 0); return [p, n(G.pat), n(recent), n(before)]; }).sort((a, b) => b[1] - a[1]);
    const after = k => G.after[k][1] ? `${pct(G.after[k][0] / G.after[k][1], 0)} <span class="muted">(${G.after[k][1]})</span>` : '—';
    return head + small + `<div class="kpis">
      ${kpi('Last session', last.score, psyBand(last.score)[0] + ' · ' + fmtDay(last.date), psyBand(last.score)[1])}
      ${kpi('10-session avg', r10 == null ? '—' : Math.round(r10), `${G.n} sessions in range · avg ${Math.round(G.avg)}`)}
      ${kpi('Plan adherence', pct(G.adh, 0), `${G.valid} valid · ${G.invalid} invalid${G.unclear ? ' · ' + G.unclear + ' unclear' : ''}`, G.adh >= .9 ? 'pos' : G.adh < .7 ? 'neg' : '')}
      ${kpi('Impulse resistance', pct(G.resist, 0), `${G.R} resisted · ${G.A} acted`)}
      ${kpi('Risk violations', G.riskV, `3 Gates all-yes ${pct(G.gates, 0)}`, G.riskV ? 'neg' : 'pos')}
      ${kpi('Clean streak', G.streak, `sessions · ${G.hesMiss} psych. misses`)}
    </div>
    <div class="grid g32"><div class="panel"><h2>Process score by session <small>bars = day · line = rolling 10</small></h2><div class="chart tall"><canvas id="c-ps"></canvas></div></div>
      <div class="panel"><h2>Where the points went <small>score points lost, by category</small></h2><table><tbody>${Object.keys(PSY_W).sort((a, b) => G.lost[b] - G.lost[a]).map(k => `<tr><td>${PSY_CAT[k]}</td><td class="r num">${(G.lost[k] / G.n).toFixed(1)}</td></tr>`).join('')}</tbody></table><p class="hint">Average points lost per session. The top row is your bottleneck.</p></div></div>
    <div class="grid g2"><div class="panel"><h2>Process vs outcome <small>each dot is a session</small></h2><div class="chart"><canvas id="c-pvr"></canvas></div></div>
      <div class="panel"><h2>Live triggers <small>what you tagged, and what you did</small></h2><div class="chart"><canvas id="c-tags"></canvas></div></div></div>
    <div class="grid g3">
      <div class="panel"><h2>Trade classification</h2><table><thead><tr><th></th><th class="r">n</th><th class="r">Total R</th></tr></thead><tbody>${c6.map(([k, ts]) => `<tr><td>${psyC6Pill(k)}</td><td class="r num">${ts.length}</td><td class="r num ${cls(sum(ts.map(t => t._.r).filter(isNum)))}">${ts.length ? fmtR(sum(ts.map(t => t._.r).filter(isNum))) : '—'}</td></tr>`).join('')}</tbody></table><p class="hint">Invalid winners are rule breaks that happened to pay. Missed rows show R from the logged outcome.</p></div>
      <div class="panel"><h2>Next trade stays valid…</h2><table><tbody><tr><td>after a win</td><td class="r num">${after('W')}</td></tr><tr><td>after a loss</td><td class="r num">${after('L')}</td></tr><tr><td>after a mistake</td><td class="r num">${after('X')}</td></tr></tbody></table>
        <h2 style="margin-top:16px">By readiness</h2><table><thead><tr><th></th><th class="r">Sessions</th><th class="r">Avg score</th><th class="r">Invalid / session</th></tr></thead><tbody>${['green', 'yellow', 'red', 'not logged'].filter(k => G.byReady[k]).map(k => `<tr><td>${k}</td><td class="r num">${G.byReady[k].n}</td><td class="r num">${Math.round(G.byReady[k].s / G.byReady[k].n)}</td><td class="r num">${(G.byReady[k].inv / G.byReady[k].n).toFixed(1)}</td></tr>`).join('')}</tbody></table></div>
      <div class="panel"><h2>Pattern recurrence</h2><table><thead><tr><th></th><th class="r">All</th><th class="r">Last 10</th><th class="r">Prev 10</th></tr></thead><tbody>${pats.map(([p, a, b, c]) => `<tr><td style="white-space:normal">${esc(p.name)}</td><td class="r num">${a}</td><td class="r num ${b > c ? 'neg' : b < c ? 'pos' : ''}">${b}</td><td class="r num">${c}</td></tr>`).join('')}</tbody></table><p class="hint">Counts mapped chains plus unmapped deviations, assigned to their most likely loop.</p></div>
    </div>`;
  },
  after() {
    if ((S.sub.mind || 'overview') !== 'overview') return;
    const E = psyEvals(); if (!E.length) return; const T = tok(); const G = psyAgg(E);
    const roll = E.map((e, i) => avg(E.slice(Math.max(0, i - 9), i + 1).map(x => x.score)));
    mkChart('c-ps', { type: 'bar', data: { labels: E.map(e => e.date), datasets: [
      { type: 'bar', label: 'Session', data: E.map(e => e.score), backgroundColor: E.map(e => e.score >= 80 ? T('pos') : e.score >= 50 ? T('accent') : T('neg')), borderRadius: 4, order: 2 },
      { type: 'line', label: 'Rolling 10', data: roll, borderColor: T('fg'), borderWidth: 2, pointRadius: 0, tension: .2, order: 1 }] },
      options: { plugins: { legend: { display: true } }, scales: { x: { ticks: { maxTicksLimit: 8, callback: function (v) { return fmtDay(this.getLabelForValue(v)); } }, grid: { display: false } }, y: { min: 0, max: 100 } } } });
    mkChart('c-pvr', { type: 'scatter', data: { datasets: [{ label: 'Session', data: E.filter(e => e.rows.length).map(e => ({ x: e.score, y: e.rTot, d: e.date })), backgroundColor: T('accent'), pointRadius: 5 }] },
      options: { scales: { x: { min: 0, max: 100, title: { display: true, text: 'Process score' } }, y: { title: { display: true, text: 'Session R' } } }, plugins: { tooltip: { callbacks: { label: i => `${fmtDay(i.raw.d)} · score ${i.raw.x} · ${fmtR(i.raw.y)}` } } } } });
    const tags = PSY_TAGS.filter(t => G.tagCount[t.id]);
    mkChart('c-tags', { type: 'bar', data: { labels: tags.map(t => t.l), datasets: [['resisted', 'Resisted / paused', T('pos')], ['acted', 'Acted on it', T('neg')], ['noted', 'Noted only', T('line2')]].map(([k, l, c]) => ({ label: l, data: tags.map(t => G.tagCount[t.id][k] || 0), backgroundColor: c, borderRadius: 4, stack: 's' })) },
      options: { indexAxis: 'y', plugins: { legend: { display: true } }, scales: { x: { stacked: true, ticks: { stepSize: 1 } }, y: { stacked: true, grid: { display: false } } } } });
  }
};
function psyGuide() {
  return `<div class="panel"><h2>Metric guide</h2><div class="tbl-wrap"><table><thead><tr><th>Metric</th><th>Measures</th><th>How it's calculated</th><th>Why it matters</th><th>Limits</th><th>When it gets worse</th></tr></thead><tbody>${PSY_METRICS.map(r => `<tr>${r.map((x, i) => `<td style="white-space:normal;vertical-align:top;${i ? 'min-width:150px' : 'font-weight:700'}">${esc(x)}</td>`).join('')}</tr>`).join('')}</tbody></table></div></div>` + psyRulesPanel();
}
function psyRulesPanel() {
  const C = psyCfg();
  return `<div class="panel stack"><h2>Score rules <small>how the 0–100 process score is built</small></h2>
    <div class="tbl-wrap"><table><thead><tr><th>Category</th><th class="r">Weight</th><th>Formula (0–100% of the weight)</th><th>Why this weight</th></tr></thead><tbody>
      <tr><td>Preparation</td><td class="r num">10</td><td style="white-space:normal">30% readiness answered + 10% trap/response/objective + 30% scenarios rehearsed + 30% written plan (20+ characters)</td><td style="white-space:normal">An input, not the goal. Kept small so journaling can't stand in for execution.</td></tr>
      <tr><td>Plan & 3 Gates selection</td><td class="r num">25</td><td style="white-space:normal">100% − 50% per invalid trade charged here − 15% per trade still unclear</td><td style="white-space:normal">Your #1 stated problem: trades outside the playbook. Biggest single weight.</td></tr>
      <tr><td>Execution discipline</td><td class="r num">15</td><td style="white-space:normal">Average over valid trades: 100% − 40% entry flaw (chase, early, late from hesitation) − 30% off-plan management − 40% emotional exit. Each psychologically missed valid setup counts as 25%.</td><td style="white-space:normal">Covers your documented early-exit leak and hesitation. Only judges valid trades, so an invalid trade is never charged twice.</td></tr>
      <tr><td>Risk discipline</td><td class="r num">20</td><td style="white-space:normal">100% if no risk rule broken, else 0% <b>and the whole score is capped at 49</b>. Rules: stop exists; risk ≤ ${fmt$(C.maxRiskTrade)} (+10%); loss not past −1.25R; no trades after the ${fmt$(C.maxDailyLoss)} daily limit.</td><td style="white-space:normal">One break can undo weeks. The cap stops strong scores elsewhere from hiding it.</td></tr>
      <tr><td>Emotional regulation & recovery</td><td class="r num">15</td><td style="white-space:normal">100% − 50% per revenge/tilt trade − 20% if you reached Yellow and logged no reset. Trading while Red = 0% <b>and the score is capped at 59</b>.</td><td style="white-space:normal">Measures what you did after adversity. Feeling frustrated costs nothing.</td></tr>
      <tr><td>Impulse control</td><td class="r num">10</td><td style="white-space:normal">(resisted + 1) ÷ (resisted + acted + 1), where acted = impulsive trades + urges acted on that didn't become trades</td><td style="white-space:normal">The only place resisted impulses earn credit.</td></tr>
      <tr><td>Post-session review</td><td class="r num">5</td><td style="white-space:normal">60% debrief finished + 40% at least one deviation mapped (automatic if there were none)</td><td style="white-space:normal">Small on purpose: the review serves execution.</td></tr>
    </tbody></table></div>
    <p class="hint"><b>One charge per mistake.</b> Every invalid trade goes to exactly one category: <b>Risk</b> if its only problem was a missing stop; <b>Emotional regulation</b> if the motive was to make back a loss or it came inside the ${C.cooldownMin}-minute cooldown after a loss or rule break; <b>Impulse control</b> if it was over max trades, reactive, driven by an impulsive motive, or followed an urge you marked as acted on; otherwise <b>Selection</b>. A trade is invalid when the playbook marks it off-playbook, when you mark it rationalized, or when it is over today's max trades. ${C.researchInPlan ? 'Research-candidate setups currently <b>count as in-plan</b> if every gate is Yes (change in Mental playbook → Settings).' : 'Research-candidate setups currently count as <b>unclear</b>.'}</p>
    <p class="hint"><b>Never scored:</b> P&L, win rate, emotions themselves, how many tags you logged. A losing day with clean execution scores higher than a winning day with rule breaks. Bands: 90+ elite · 80–89 professional · 65–79 developing · 50–64 inconsistent · under 50 compromised.</p></div>`;
}

/* ---------- Weekly review ---------- */
function psyWeekView() {
  const mon = S.sub.pyWeek || psyMondayOf(psyToday()); const sun = psyAddDays(mon, 6);
  const inWeek = (a, b) => psyDays(true).filter(d => d >= a && d <= b).map(psyEval).filter(e => e.score != null);
  const E = inWeek(mon, sun), Ep = inWeek(psyAddDays(mon, -7), psyAddDays(mon, -1));
  const G = psyAgg(E), Gp = psyAgg(Ep); const w = psyJ(mon).psyWeek || {};
  const nav = `<div class="row"><button class="btn sm" data-py="week" data-v="${psyAddDays(mon, -7)}">‹</button><b style="min-width:200px;text-align:center">Week of ${fmtDay(mon)}</b><button class="btn sm" data-py="week" data-v="${psyAddDays(mon, 7)}">›</button></div>`;
  if (!E.length) return nav + `<div class="panel empty">No scored sessions this week.</div>`;
  const B = psyBottleneck(G);
  const d = (a, b, f, good) => { if (a == null || b == null) return ''; const x = a - b; if (Math.abs(x) < 1e-9) return '<span class="muted">=</span>'; return `<span class="${(x > 0) === good ? 'pos' : 'neg'}">${x > 0 ? '▲' : '▼'} ${f(Math.abs(x))}</span>`; };
  const n0 = v => String(Math.round(v)), p0 = v => Math.round(v * 100) + ' pts', i0 = v => String(v);
  const top = (o) => Object.entries(o).sort((a, b) => b[1].n - a[1].n).slice(0, 3).map(([k, v]) => `${PSY_TAG[k].l} (${v.n})`).join(', ') || '—';
  const patTop = Object.entries(G.pat).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => `${psyPat(k.replace('~', ''))?.name || k} (${v})`).join(', ') || '—';
  const rows = [
    ['Average process score', G.avg != null ? Math.round(G.avg) : '—', d(G.avg, Gp.avg, n0, true)], ['Sessions', G.n, ''], ['Plan adherence', pct(G.adh, 0), d(G.adh, Gp.adh, p0, true)], ['3 Gates all-yes', pct(G.gates, 0), d(G.gates, Gp.gates, p0, true)],
    ['Invalid trades', G.invalid, d(G.invalid, Gp.invalid, i0, false)], ['Valid setups missed (psychological)', G.hesMiss, d(G.hesMiss, Gp.hesMiss, i0, false)], ['Impulses resisted', G.R, d(G.R, Gp.R, i0, true)], ['Urges acted on / impulsive trades', G.A, d(G.A, Gp.A, i0, false)],
    ['Risk violations', G.riskV, d(G.riskV, Gp.riskV, i0, false)], ['Next trade valid after a loss', G.after.L[1] ? pct(G.after.L[0] / G.after.L[1], 0) + ` (${G.after.L[1]})` : '—', ''], ['Next trade valid after a win', G.after.W[1] ? pct(G.after.W[0] / G.after.W[1], 0) + ` (${G.after.W[1]})` : '—', ''], ['Next trade valid after a mistake', G.after.X[1] ? pct(G.after.X[0] / G.after.X[1], 0) + ` (${G.after.X[1]})` : '—', ''],
    ['Most common triggers', top(G.tagCount), ''], ['Most frequent loops', patTop, ''], ['Score by readiness', Object.entries(G.byReady).map(([k, v]) => `${k} ${Math.round(v.s / v.n)} (${v.n})`).join(' · ') || '—', ''],
  ];
  return nav + `<div class="grid g32"><div class="panel"><h2>This week vs last week ${Ep.length ? '' : '<small>no data for last week</small>'}</h2><div class="tbl-wrap"><table><tbody>${rows.map(r => `<tr><td>${r[0]}</td><td class="r num" style="white-space:normal">${r[1]}</td><td class="r num">${r[2]}</td></tr>`).join('')}</tbody></table></div>
      <p class="hint">${G.trades} trades over ${G.n} sessions. With samples this small, a change of one or two trades moves every percentage; look for the same signal two weeks running before acting on it. Results are not compared with P&L here on purpose.</p></div>
    <div class="stack" style="gap:16px"><div class="panel stack"><h2>One thing to train next week</h2>${B ? `
      <div><span class="lbl">1 · Biggest bottleneck</span><p style="margin:4px 0"><b>${esc(B.b[0])}</b> <span class="muted">(${B.b[0] === PSY_CAT[B.k] ? '' : PSY_CAT[B.k] + ', '}~${B.pts.toFixed(1)} pts lost per session)</span></p></div>
      <div><span class="lbl">2 · Evidence</span><p class="hint" style="margin:4px 0">${esc(psyEvidence(B.k, G))}</p></div>
      <div><span class="lbl">3 · Behavior to prioritize</span><p class="hint" style="margin:4px 0">${esc(B.b[0])}: only this; everything else stays on maintenance.</p></div>
      <div><span class="lbl">4 · Exercise</span><p class="hint" style="margin:4px 0">${esc(B.b[1])}</p></div>
      <div><span class="lbl">5 · Measurable target</span><p style="margin:4px 0"><b>${esc(B.b[2])}</b></p></div>` : '<p class="hint">No category lost meaningful points. Keep the current routine and maintain.</p>'}</div>
    <div class="panel stack"><h2>Your weekly reflection <small>15–20 min</small></h2>
      <div class="f"><label>What the data says (in one or two sentences)</label><textarea class="inp" rows="2" style="min-height:56px" data-pyw="read">${esc(w.read || '')}</textarea></div>
      <div class="f"><label>What I'm committing to next week</label><textarea class="inp" rows="2" style="min-height:56px" data-pyw="commit">${esc(w.commit || '')}</textarea></div>
      <div class="f"><label>Target (a number I can check next Friday)</label><input class="inp" data-pyw="target" value="${esc(w.target || '')}" placeholder="${esc(B ? B.b[2] : '')}"></div></div></div></div>`;
}

/* ---------- Mental playbook: patterns, program, code, rehearsal, settings ---------- */
const PSY_PF = [['symptoms', 'Symptoms it produces'], ['warnings', 'Early warning signs'], ['triggers', 'Common triggers'], ['interp', 'Typical interpretation'], ['emotion', 'Emotion'], ['urge', 'Urge'], ['behavior', 'Behavior'], ['shortC', 'Short-term payoff'], ['longC', 'Long-term consequence'], ['belief', 'Underlying belief'], ['replacement', 'Replacement belief'], ['corrective', 'Corrective action'], ['prevent', 'Prevention'], ['ifthen', 'If-then (rehearsed)']];
const PSY_PHASES = [
  { n: 'Awareness & baseline', obj: 'See your patterns clearly without trying to fix everything.', ex: 'Full readiness + rehearsal every session; tag every urge or emotion live; fill the psychology fields on every trade; map every deviation.', meas: 'Completion: readiness logged, debrief done, trades psych-tagged.', ok: 'Readiness and debrief on 4 of 5 sessions, and 90% of trades have a motive.', q: 'Which loop showed up most? What was the earliest warning sign you noticed?', fix: 'If you skipped logging, shorten nothing; do readiness before you open the platform.', test: E => E.filter(e => e.rd.cls).length >= 4 && E.filter(e => e.done).length >= 4 && (() => { const r = E.flatMap(e => e.rows); return !r.length || r.filter(x => x.t.psy?.motive).length / r.length >= .9; })() },
  { n: 'Impulse control', obj: 'Recognize and interrupt unauthorized trades.', ex: 'Before every entry say setup / location / trigger out loud. When an urge fires: tap it, run the 15-second reset, mark Resisted or Acted.', meas: 'Invalid trades and the resisted share.', ok: '≤ 1 invalid trade across the 5 sessions and every urge tag has a decision (not just Noted).', q: 'Which urge was hardest to resist, and what did you tell yourself right before?', fix: 'If you exceed it, cut max trades to 1 for the next phase block.', test: E => sum(E.map(e => e.rows.filter(r => r.v === 'invalid').length)) <= 1 && E.flatMap(e => e.ev).filter(x => PSY_TAG[x.tag]?.urge).every(x => x.act && x.act !== 'noted') },
  { n: 'Execution confidence', obj: 'Take valid setups without hesitation, at planned risk.', ex: '5-second rule: all three gates yes → enter at planned size within 5 seconds. Log every valid setup you skip as a missed trade.', meas: 'Valid setups taken vs psychologically missed; hesitation-hurt entries.', ok: '≥ 85% of valid opportunities taken (taken ÷ taken + psych. missed), at least 1 taken, and ≤ 1 hesitation-hurt entry.', q: 'When you hesitated, what were you waiting to be sure of?', fix: 'If you keep missing, drop to minimum size so the dollar risk stops being the reason.', test: E => { const t = sum(E.map(e => e.rows.filter(r => r.v === 'valid').length)), m = sum(E.map(e => e.psychMissed.length)); return t >= 1 && t / (t + m) >= .85 && sum(E.map(e => e.rows.filter(r => ['late', 'size'].includes(r.t.psy?.hes)).length)) <= 1; } },
  { n: 'Emotional regulation', obj: 'Handle losses, missed trades, uncertainty and bad outcomes without acting on them.', ex: 'Cooldown after every loss; read your "valid loss" and "missed move" if-thens out loud when they happen.', meas: 'Revenge/tilt trades, emotional exits, next-trade validity after a loss.', ok: '0 revenge/tilt trades, 0 emotional exits, and every trade taken after a loss was valid.', q: 'What did the last loss mean to you in the moment? What does it mean now?', fix: 'If you fail it, add a mandatory 20-minute break after any loss for the next block.', test: E => E.every(e => !e.rows.some(r => r.cat === 'emo' || r.t.psy?.exit === 'emo')) && E.every(e => e.rows.every((r, i) => i === 0 || e.rows[i - 1].t._.res !== 'L' || r.v === 'valid')) },
  { n: 'Consistency under pressure', obj: 'Keep the process intact regardless of recent results.', ex: 'Hide the P&L display. Score yourself before you look at the day\'s P&L.', meas: 'Average and lowest process score; score after red days vs green days.', ok: 'Average ≥ 80, no session under 65, and sessions after a red day average within 10 points of those after a green day.', q: 'Did a winning or losing streak change how you selected trades?', fix: 'If the floor fails, the lowest category becomes the only focus for the next block.', test: E => { const s = E.map(e => e.score); if (avg(s) < 80 || Math.min(...s) < 65) return false; const all = psyEvals(true); const pv = e => { const i = all.findIndex(x => x.date === e.date); return i > 0 ? all[i - 1].pnl : null; }; const a = E.filter(e => pv(e) < 0).map(e => e.score), b = E.filter(e => pv(e) > 0).map(e => e.score); return !a.length || !b.length || Math.abs(avg(a) - avg(b)) <= 10; } },
  { n: 'Integration & evaluation', obj: 'Show the behavior holds, then decide what to maintain.', ex: 'Run the full routine with no new rules. At the end, compare the last 10 sessions with sessions 1–5.', meas: 'Average score, risk breaks, sessions with zero invalid trades.', ok: 'Average ≥ 85, 0 risk violations, and no invalid trades in 4 of 5 sessions.', q: 'Which behaviors are now automatic? Which still need the checklist?', fix: 'If it fails, repeat this block. Then keep the daily core and drop to a weekly-only deep review.', test: E => avg(E.map(e => e.score)) >= 85 && !E.some(e => e.rows.some(r => r.rv.length)) && E.filter(e => !e.rows.some(r => r.v === 'invalid')).length >= 4 },
];
function psyProgram() {
  const C = psyCfg(); const all = psyEvals(true).filter(e => !C.programStart || e.date >= C.programStart);
  let p = 0; const blocks = [];
  for (let i = 0; i + 5 <= all.length && p < PSY_PHASES.length; i += 5) { const E = all.slice(i, i + 5); const ok = PSY_PHASES[p].test(E); blocks.push({ p, E, ok }); if (ok) p++; }
  const used = blocks.length * 5; const cur = all.slice(used);
  return { all, p, blocks, cur, done: p >= PSY_PHASES.length };
}
const PSY_CODE = [
  ['I do not need to participate in every opportunity.', 'Trade only pre-marked locations and respect max trades.', e => !e.rows.some(r => r.cat === 'sel' || r.cat === 'imp')],
  ['My job is to execute my edge, not predict every move.', 'Write bias as if/then. Classify setup, location and trigger before the click.', e => !e.rows.some(r => r.t.psy?.rat === 'yes' || r.t.psy?.motive === 'bias')],
  ['A valid losing trade is not a behavioral failure.', 'Log valid losses as valid, sit out the cooldown, continue.', e => !e.rows.some(r => r.cat === 'emo')],
  ['An invalid winning trade is not a behavioral success.', 'Count invalid winners as rule breaks in the debrief.', e => !e.rows.some(r => r.c6 === 'iw') || e.chains.length > 0],
  ['Missing a move does not create an obligation to trade.', 'After a miss: no chase; next location only.', e => !e.rows.some(r => ['chase', 'fomo'].includes(r.t.psy?.motive))],
  ['Emotional discomfort does not automatically require action.', 'Tag the feeling, run the 15-second reset, then choose.', e => e.R >= e.A],
  ['Confidence comes from repeated evidence of disciplined execution.', 'Take every valid setup at planned size.', e => !e.psychMissed.length && !e.rows.some(r => ['late', 'size'].includes(r.t.psy?.hes))],
  ['My financial results do not determine my worth.', 'Review process before P&L; grade the day by its process score.', e => e.done],
];
VIEWS.mental = {
  html() {
    const tab = S.sub.mental || 'patterns'; const C = psyCfg();
    const head = `<div class="tabs">${[['patterns', 'Pattern playbook'], ['program', '30-session program'], ['code', 'Operating code'], ['reh', 'Rehearsal & circuit breaker'], ['set', 'Settings']].map(([k, l]) => `<button class="tab ${tab === k ? 'on' : ''}" data-sub="mental:${k}">${l}</button>`).join('')}</div>`;
    if (tab === 'patterns') {
      const G = psyAgg(psyEvals(true));
      return head + `<p class="hint" style="max-width:90ch">Your stated problems grouped into five root loops. Several symptoms (FOMO, chasing, early entries) come from one loop, so you train the loop, not each symptom. Edit any field; the text feeds the debrief placeholders and live prompts.</p>` + C.patterns.map((p, i) => `<div class="panel stack"><h2>${esc(p.name)} <small>${(G.pat[p.id] || 0) + (G.pat['~' + p.id] || 0)} occurrences logged</small></h2>
        <div class="fgrid" style="grid-template-columns:repeat(2,minmax(0,1fr))">${PSY_PF.map(([k, l]) => `<div class="f"><label>${l}</label><textarea class="inp" rows="2" style="min-height:48px" data-pyp="${i}:${k}">${esc(p[k] || '')}</textarea></div>`).join('')}</div></div>`).join('') + `<div><button class="btn sm ghost" data-py="resetpat">Restore default pattern text</button></div>`;
    }
    if (tab === 'program') {
      const P = psyProgram();
      return head + `<div class="banner"><span>Progress depends on what you show, not on how many sessions you've done. Each block is 5 scored sessions. If a block misses its success condition, you repeat that phase.</span><label class="row" style="gap:6px"><span class="muted">Program start</span><input class="inp" type="date" data-pys="programStart" value="${esc(C.programStart || '')}"></label></div>
        <div class="kpis" style="grid-template-columns:repeat(3,minmax(0,1fr))">${kpi('Current phase', P.done ? 'Complete' : `${P.p + 1} · ${PSY_PHASES[P.p].n}`, P.done ? 'maintain the daily core' : `${P.cur.length}/5 sessions in this block`)}${kpi('Scored sessions', P.all.length, `${P.blocks.length} blocks evaluated`)}${kpi('Blocks repeated', P.blocks.filter(b => !b.ok).length, 'a repeat is information, not failure')}</div>
        ${PSY_PHASES.map((ph, i) => { const bl = P.blocks.filter(b => b.p === i); const st = i < P.p ? 'Passed' : i === P.p && !P.done ? 'Current' : 'Ahead'; return `<div class="panel stack ${st === 'Current' ? 'phase-on' : ''}"><h2>Sessions ${i * 5 + 1}–${i * 5 + 5} · ${esc(ph.n)} <span class="pill ${st === 'Passed' ? 'pb-ok' : st === 'Current' ? 'pb-res' : 'pb-none'}">${st}${bl.length > 1 || (bl.length && !bl[0].ok) ? ` · ${bl.length} block${bl.length > 1 ? 's' : ''}` : ''}</span></h2>
          <div class="kv" style="grid-template-columns:repeat(2,minmax(0,1fr))"><div><label>Objective</label><span>${esc(ph.obj)}</span></div><div><label>Daily exercise</label><span>${esc(ph.ex)}</span></div><div><label>Measured by</label><span>${esc(ph.meas)}</span></div><div><label>Success condition</label><span>${esc(ph.ok)}</span></div><div><label>Review question</label><span>${esc(ph.q)}</span></div><div><label>If it fails</label><span>${esc(ph.fix)}</span></div></div></div>`; }).join('')}`;
    }
    if (tab === 'code') {
      const E = psyEvals(true).slice(-10);
      return head + `<div class="panel stack"><h2>Professional operating code <small>each principle is tied to an action and checked against your last ${E.length} sessions</small></h2>
        <div class="tbl-wrap"><table><thead><tr><th>Principle</th><th>Daily action</th><th class="r">Held (last ${E.length})</th></tr></thead><tbody>${PSY_CODE.map(([p, a, f]) => { const n = E.filter(f).length; return `<tr><td style="white-space:normal"><b>${esc(p)}</b></td><td style="white-space:normal">${esc(a)}</td><td class="r num ${E.length ? (n / E.length >= .9 ? 'pos' : n / E.length < .6 ? 'neg' : '') : ''}">${E.length ? `${n}/${E.length}` : '—'}</td></tr>`; }).join('')}</tbody></table></div>
        <p class="hint">Identity: <b>I am a selective, rules-based executor. I take my edge at my locations, at defined risk, and let the sample decide.</b> Confidence here is a count of sessions where the code held, not a feeling. Selectivity, patience, probabilistic thinking, emotional awareness, risk acceptance, accountability, adaptability and process integrity each map to a row above.</p></div>`;
    }
    if (tab === 'reh') {
      return head + `<div class="panel stack"><h2>Rehearsal scenarios <small>used in Today · B</small></h2>${C.scen.map((s, i) => `<div class="ed-row"><input class="inp" style="max-width:260px;font-weight:700" data-pysc="${i}:l" value="${esc(s.l)}"><input class="inp" data-pysc="${i}:t" value="${esc(s.t)}"></div>`).join('')}</div>
        <div class="panel"><h2>Circuit breaker levels</h2><div class="tbl-wrap"><table><thead><tr><th></th>${['green', 'yellow', 'red'].map(k => `<th><span class="pill lvp-${k}">${LV_NAME[k]}</span></th>`).join('')}</tr></thead><tbody>${[['ind', 'Observable indicators (automatic)'], ['warn', 'Subjective warning signs'], ['allow', 'Permitted'], ['deny', 'Prohibited'], ['req', 'Required intervention'], ['resume', 'Resume trading when'], ['end', 'End the session when']].map(([k, l]) => `<tr><td style="white-space:normal;font-weight:700;vertical-align:top">${l}</td>${['green', 'yellow', 'red'].map(x => `<td style="white-space:normal;vertical-align:top;min-width:180px">${esc(PSY_CB[x][k])}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
        <p class="hint">Hard financial limits (your daily loss limit and your prop firm's rules) always end the session, whatever the level says. Psychology never loosens a risk rule.</p></div>`;
    }
    return head + `<div class="panel stack"><h2>Rules used by the score and circuit breaker</h2>
      <div class="fgrid">${[['maxTrades', 'Default max trades / session'], ['maxDailyLoss', 'Max daily loss ($, incl. fees)'], ['maxRiskTrade', 'Max risk per trade ($)'], ['cooldownMin', 'Cooldown after a loss (min)']].map(([k, l]) => `<div class="f"><label>${l}</label><input class="inp num" type="number" min="0" step="any" data-pys="${k}" value="${esc(C[k])}"></div>`).join('')}</div>
      <label class="row"><input type="checkbox" data-pys="researchInPlan" ${C.researchInPlan ? 'checked' : ''}> <span>Count research-candidate setups as in-plan when every gate is Yes <span class="hint">(your FA / IC / Value Rotation setups and TC / ZPS / RD triggers are still candidates in the Playbook library)</span></span></label>
      <div class="f"><label>Missed-trade reasons that count as psychological</label><div class="chips">${[...new Set([...S.settings.missReasons, ...C.psychMiss])].map(r => psyChip(C.psychMiss.includes(r), `data-py="pmiss" data-v="${esc(r)}"`, r)).join('')}</div><p class="hint" style="margin:0">Others count as practical (away from screen, platform issue, etc.) and aren't charged to you.</p></div></div>`;
  }
};

/* ---------- events ---------- */
document.addEventListener('click', e => {
  const el = e.target.closest('[data-py],[data-tpsy]'); if (!el) return;
  const d = el.dataset;
  if (d.tpsy != null && F) {
    F.psy = Object.assign({}, F.psy); const v = d.tpsy === 'conf' ? +d.v : d.v;
    if (F.psy[d.tpsy] === v) delete F.psy[d.tpsy]; else F.psy[d.tpsy] = v;
    if (!Object.keys(F.psy).length) delete F.psy;
    return drawFormKeepScroll();
  }
  const date = psyDate(); const C = psyCfg();
  switch (d.py) {
    case 'day': S.sub.jd = d.v; S.sub.pyOpenA = S.sub.pyOpenB = false; return render();
    case 'openA': S.sub.pyOpenA = true; return render();
    case 'openB': S.sub.pyOpenB = true; return render();
    case 'opentoday': S.sub.jd = d.v; return goto('today');
    case 'week': S.sub.pyWeek = d.v; return render();
    case 'set': return psyEdit(date, P => { const cur = d.path.split('.').reduce((o, k) => o && o[k], P); const v = isNaN(+d.v) ? d.v : +d.v; psySetPath(P, d.path, String(cur) === String(v) && d.path !== 'type' ? undefined : v); });
    case 'trap': return psyEdit(date, P => { P.pre = Object.assign({}, P.pre); P.pre.trap = P.pre.trap === d.v ? undefined : d.v; if (!P.pre.trap) delete P.pre.trap; });
    case 'useifthen': return psyEdit(date, P => { P.pre = Object.assign({}, P.pre); P.pre.resp = psyPat(P.pre.trap)?.ifthen || ''; });
    case 'obj': return psyEdit(date, P => { P.pre = Object.assign({}, P.pre); const a = (P.pre.obj || []).slice(); const i = a.indexOf(d.v); i >= 0 ? a.splice(i, 1) : a.push(d.v); P.pre.obj = a; });
    case 'reh': return psyEdit(date, P => { P.reh = Object.assign({}, P.reh); if (P.reh[d.v]) delete P.reh[d.v]; else P.reh[d.v] = 1; });
    case 'rehall': return psyEdit(date, P => { P.reh = Object.fromEntries(C.scen.map(s => [s.id, 1])); });
    case 'tag': {
      const id = uid(); const at = date === psyToday() ? Date.now() : psyAt(date, psyHM(Date.now()));
      psyEdit(date, P => { P.ev = (P.ev || []).concat([{ id, at, tag: d.v, act: PSY_TAG[d.v] ? 'noted' : undefined }]); }, { quiet: true });
      if (PSY_TAG[d.v]) S.sub.pyOpen = id;
      return render();
    }
    case 'act': psyEdit(date, P => { P.ev = (P.ev || []).map(x => x.id === d.id ? Object.assign({}, x, { act: d.v }) : x); }, { quiet: true }); if (d.close) S.sub.pyOpen = null; return render();
    case 'closeproto': S.sub.pyOpen = null; return render();
    case 'delev': return psyEdit(date, P => { P.ev = (P.ev || []).filter(x => x.id !== d.id); });
    case 'newmissed': openTradeForm(null, 'missed'); F.entryTime = date + 'T' + psyHM(Date.now()); F.entries = [{ price: null, size: 1, time: F.entryTime }]; F.exits[0].time = F.entryTime; return drawForm();
    case 'mapdev': return psyEdit(date, P => { P.post = Object.assign({}, P.post); const ev = psyEval(date); const dv = ev.devs.find(x => x.id === d.id); P.post.chains = (P.post.chains || []).concat([{ dev: d.id, label: dv ? dv.l : 'Pattern I noticed', pat: d.pat || undefined }]); });
    case 'chainpat': return psyEdit(date, P => { P.post = clone(P.post || {}); P.post.chains[+d.i].pat = d.v; });
    case 'delchain': return psyEdit(date, P => { P.post = clone(P.post || {}); P.post.chains.splice(+d.v, 1); });
    case 'deep': return psyEdit(date, P => { P.post = Object.assign({}, P.post, { deep: 1 }); });
    case 'finish': {
      if (!(psyJ(date).lesson || '').trim()) return toast('Write the one adjustment for next session first');
      return psyEdit(date, P => { P.post = Object.assign({}, P.post, { done: 1 }); });
    }
    case 'pmiss': { const a = C.psychMiss; const i = a.indexOf(d.v); i >= 0 ? a.splice(i, 1) : a.push(d.v); saveSettings(); return render(); }
    case 'resetpat': C.patterns = defaultPatterns(); saveSettings(); toast('Default pattern text restored'); return render();
  }
});
document.addEventListener('input', e => {
  const el = e.target; const d = el.dataset;
  if (d.pyf) { const date = psyDate(); const v = el.type === 'number' ? (num(el.value) ?? undefined) : el.value;
    return psyEdit(date, P => { if (d.pyf.startsWith('post.chains.')) { P.post = clone(P.post || {}); const [, , i, k] = d.pyf.split('.'); P.post.chains[+i][k] = v; } else psySetPath(P, d.pyf, v); }, { later: true, quiet: true }); }
  if (d.pyw) { const mon = S.sub.pyWeek || psyMondayOf(psyToday()); const obj = Object.assign({}, S.journal[mon] || {}, { date: mon }); obj.psyWeek = Object.assign({}, obj.psyWeek, { [d.pyw]: el.value }); S.journal[mon] = obj; clearTimeout(psyTimer); psyTimer = setTimeout(() => saveDay(mon, S.journal[mon]), 600); return; }
  if (d.pyp) { const [i, k] = d.pyp.split(':'); psyCfg().patterns[+i][k] = el.value; clearTimeout(psyTimer); psyTimer = setTimeout(saveSettings, 600); return; }
  if (d.pysc) { const [i, k] = d.pysc.split(':'); psyCfg().scen[+i][k] = el.value; clearTimeout(psyTimer); psyTimer = setTimeout(saveSettings, 600); return; }
});
document.addEventListener('change', e => {
  const el = e.target; const d = el.dataset;
  if (d.pys) { const C = psyCfg(); C[d.pys] = el.type === 'checkbox' ? el.checked : el.type === 'number' ? (num(el.value) ?? 0) : el.value; saveSettings(); return render(); }
  if (d.pyev) { const date = psyDate(); return psyEdit(date, P => { P.ev = (P.ev || []).map(x => x.id === d.pyev ? Object.assign({}, x, { at: psyAt(date, el.value) }) : x); }); }
  if (d.pyf && el.type === 'number') return render();
});
