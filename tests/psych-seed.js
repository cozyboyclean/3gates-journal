// HYPOTHETICAL test sessions for the psychology module. Not real trades.
const pb = (ok = true, extra = {}) => Object.assign({ state: 'balance', htf: 'htf_fa', locs: ['Prior-day VAL'], trigs: ['trg_tc'], g1: 'yes', g2: ok ? 'yes' : 'no', g3: 'yes', pre: 'yes', thesis: 'HYPOTHETICAL' }, extra);
let n = 0;
function trade(date, hm, mins, rMult, o = {}) {
  const entry = 20000, stopPts = o.stopPts ?? 20, size = o.size ?? 3, dir = o.dir || 'long', sg = dir === 'long' ? 1 : -1;
  const [h, m] = hm.split(':').map(Number); const xm = h * 60 + m + mins;
  const xt = `${date}T${String(Math.floor(xm / 60)).padStart(2, '0')}:${String(xm % 60).padStart(2, '0')}`;
  return {
    id: 'hyp' + (++n), account: 'acc_main', instrument: 'MNQ', dir, entryTime: `${date}T${hm}`, entry, size,
    stop: o.noStop ? null : entry - sg * stopPts, target: entry + sg * stopPts * 2,
    exits: [{ price: entry + sg * rMult * stopPts, size, time: xt }], fees: 0, setup: '', mfe: null, mae: null,
    stats: o.stats || {}, comments: o.comments || { pre: [], entry: [], mgmt: [], exit: [] }, notes: 'HYPOTHETICAL TEST TRADE', shots: [],
    pb: o.pb || pb(), ...(o.psy ? { psy: o.psy } : {}), ...(o.kind ? { kind: o.kind, missReason: o.missReason } : {}),
  };
}
const green = { sleep: 4, energy: 4, clarity: 4, stable: 4, conf: 4, patience: 4, uncert: 4, stress: 2, finp: 2, urge: 2, fearl: 2, resid: 1, trap: 'miss', resp: 'If price moves without me, then I wait.', obj: ['Trade only pre-marked locations'] };
const allReh = { loss: 1, miss: 1, invwin: 1, consec: 1, approach: 1, hes: 1, notrade: 1, wrong: 1 };
const at = (d, hm) => new Date(`${d}T${hm}:00`).getTime();
const P = 'Bias: balance day, fade VAH/VAL with TC trigger. HYPOTHETICAL.';
const D = { d1: '2026-11-16', d2: '2026-11-17', d3: '2026-11-18', d4: '2026-11-19', d5: '2026-11-20', d6: '2026-11-23', d7: '2026-11-12' };
const trades = [
  // D1 clean losing day: two valid -1R losses, spaced past cooldown
  trade(D.d1, '09:45', 6, -1, { psy: { motive: 'plan', origin: 'planned', exit: 'sys', risk: 'yes' } }),
  trade(D.d1, '10:30', 8, -1, { psy: { motive: 'plan', origin: 'planned', exit: 'sys', risk: 'yes' } }),
  // D2 profitable but undisciplined
  trade(D.d2, '09:45', 5, -1, { psy: { motive: 'plan' } }),
  trade(D.d2, '09:53', 10, 3, { pb: pb(false), psy: { motive: 'rev' } }),           // revenge inside cooldown -> emo
  trade(D.d2, '10:30', 10, 2, { pb: pb(false), psy: { motive: 'fomo' } }),          // FOMO -> imp, and taken while Red
  trade(D.d2, '11:10', 10, 2, { psy: { motive: 'plan' } }),                          // 4th trade, over max 3 -> imp
  // D3 risk violation with everything else perfect: 10 MNQ x 20pt = $400 risk > $150
  trade(D.d3, '09:50', 12, 2, { size: 10, psy: { motive: 'plan', exit: 'sys', risk: 'yes' } }),
  // D5 hesitation day
  trade(D.d5, '10:05', 15, 2, { psy: { motive: 'plan', hes: 'late' } }),
  trade(D.d5, '10:40', 10, 2, { kind: 'missed', missReason: 'Hesitated' }),
  trade(D.d5, '11:20', 10, 2, { kind: 'missed', missReason: 'Away from screen' }),
  // D6 emotions present but handled
  trade(D.d6, '10:15', 20, 2, { psy: { motive: 'plan', exit: 'sys' } }),
  // D7 rationalized trade + early fear exit comment on a valid one
  trade(D.d7, '09:40', 5, 0.5, { comments: { pre: [], entry: [], mgmt: [], exit: [{ t: 'Exited early out of fear', r: -1 }] }, psy: { motive: 'plan' } }),
  trade(D.d7, '10:30', 10, 1, { psy: { motive: 'other', rat: 'yes' } }),
];
const journal = {
  [D.d1]: { date: D.d1, plan: P, lesson: 'Keep the cooldown.', psy: { type: 'trade', pre: green, reh: allReh, post: { done: 1 } } },
  [D.d2]: { date: D.d2, plan: P, lesson: 'No re-entry inside cooldown.', psy: { type: 'trade', pre: green, reh: allReh, ev: [{ id: 'e1', at: at(D.d2, '09:51'), tag: 'rev', act: 'acted' }], post: { done: 1, chains: [{ dev: 't:hyp4', pat: 'repair', label: 'x' }] } } },
  [D.d3]: { date: D.d3, plan: P, lesson: 'Size from the stop.', psy: { type: 'trade', pre: green, reh: allReh, post: { done: 1 } } },
  [D.d4]: { date: D.d4, plan: P, lesson: 'Same again.', psy: { type: 'trade', pre: green, reh: allReh, ev: [{ id: 'e2', at: at(D.d4, '10:00'), tag: 'fomo', act: 'resisted' }, { id: 'e3', at: at(D.d4, '11:00'), tag: 'bore', act: 'resisted' }], post: { done: 1 } } },
  [D.d5]: { date: D.d5, plan: P, psy: { type: 'trade', pre: Object.assign({}, green, { sleep: 2, finp: 4, urge: 4, fearl: 4 }), reh: allReh } },
  [D.d6]: { date: D.d6, plan: P, lesson: 'x', psy: { type: 'trade', pre: { sleep: 4, energy: 4, clarity: 4 }, reh: allReh, ev: [{ id: 'e4', at: at(D.d6, '09:50'), tag: 'fear', act: 'noted' }, { id: 'e5', at: at(D.d6, '09:55'), tag: 'frus', act: 'resisted' }], post: { done: 1 } } },
  [D.d7]: { date: D.d7, plan: P, psy: { type: 'trade', pre: green, reh: allReh } },
  '2026-11-21': { date: '2026-11-21', psy: { type: 'off' } },
};
module.exports = { trades, journal, D };
