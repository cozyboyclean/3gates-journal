/* ===== views ===== */
'use strict';
const IC = {
  dash: '<path d="M4 13h6V4H4zM14 20h6v-9h-6zM4 20h6v-4H4zM14 4v4h6V4z"/>',
  trades: '<path d="M4 6h16M4 12h16M4 18h10"/>',
  journal: '<path d="M6 3h11a2 2 0 0 1 2 2v16l-4-2-4 2-4-2-3 2V5a2 2 0 0 1 2-2zM9 8h6M9 12h6"/>',
  cal: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  stats: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  edge: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3M8 11h6M11 8v6"/>',
  tilt: '<path d="M3 12h4l3-8 4 16 3-8h4"/>',
  sim: '<path d="M4 4v16h16"/><path d="m7 15 4-5 3 3 5-6"/><path d="M7 19l4-3 3 1 5-4" stroke-dasharray="2 2"/>',
  acct: '<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18M16 15h2"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
};
const icon = k => `<svg viewBox="0 0 24 24" aria-hidden="true">${IC[k]}</svg>`;
const NAV = [
  ['Journal', [['dashboard', 'Dashboard', 'dash'], ['trades', 'Trades', 'trades'], ['diary', 'Daily journal', 'journal'], ['calendar', 'Calendar', 'cal']]],
  ['Analytics', [['analytics', 'Statistics', 'stats'], ['edge', 'Edge Finder', 'edge'], ['tilt', 'Tiltmeter', 'tilt'], ['simulator', 'Simulator', 'sim']]],
  ['Manage', [['accounts', 'Accounts', 'acct'], ['config', 'Settings', 'gear']]],
];
const TITLES = { dashboard: 'Dashboard', trades: 'Trades', diary: 'Daily journal', calendar: 'Calendar', analytics: 'Statistics', edge: 'Edge Finder', tilt: 'Tiltmeter', simulator: 'Simulator', accounts: 'Accounts', config: 'Settings' };

function renderSide() {
  const sync = Store.mode === 'db' ? `<span class="sync ok"><i></i>Synced to your account</span>` : Store.mode === 'local' ? (DESK ? `<span class="sync ok"><i></i>Saved on this PC</span>` : `<span class="sync local"><i></i>Saved in this browser</span>`) : `<span class="sync"><i></i>Connecting…</span>`;
  $('#side').innerHTML = `
    <div class="brand"><span class="brand-mark"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-ink)" stroke-width="2.4" stroke-linecap="round"><path d="M5 20V9M12 20V4M19 20v-7"/></svg></span>
    <div><b>3 Gates</b><span>Trade journal</span></div></div>
    ${NAV.map(([sec, items]) => `<div class="navsec">${sec}</div>` + items.map(([id, label, ic]) => `<button class="nav ${S.view === id ? 'on' : ''}" data-nav="${id}">${icon(ic)}${label}</button>`).join('')).join('')}
    <div class="side-foot">${sync}</div>`;
}
function renderFilters() {
  const show = !['config', 'accounts'].includes(S.view);
  const acc = S.settings.accounts;
  $('#gfilters').innerHTML = (show ? `
    <select class="sel" id="g-acc" aria-label="Account"><option value="all">All accounts</option>${acc.map(a => `<option value="${esc(a.id)}" ${G.account === a.id ? 'selected' : ''}>${esc(a.name)}</option>`).join('')}</select>
    ${['calendar', 'diary'].includes(S.view) ? '' : `<select class="sel" id="g-range" aria-label="Date range">${[['all', 'All time'], ['today', 'Today'], ['week', 'This week'], ['month', 'This month'], ['30', 'Last 30 days'], ['90', 'Last 90 days'], ['ytd', 'Year to date'], ['custom', 'Custom range']].map(([v, l]) => `<option value="${v}" ${G.range === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
    ${G.range === 'custom' ? `<input class="inp" type="date" id="g-from" value="${esc(G.from)}" aria-label="From"><input class="inp" type="date" id="g-to" value="${esc(G.to)}" aria-label="To">` : ''}`}` : '')
    + `<button class="btn pri" data-act="new-trade">${icon('plus')}Add trade</button>`;
}
function demoBanner() {
  let h = '';
  if (Store.mode === 'db' && Store.localTrades > 0) h += `<div class="banner"><span>This browser holds <b>${Store.localTrades} trades</b> saved before sync was available.</span><button class="btn sm pri" data-act="import-local">Move them into your synced journal</button></div>`;
  if (usingDemo()) h += `<div class="banner"><span><b>Sample trades.</b> You're looking at generated ES trades so every screen has something to show. They disappear the moment you log or import your first trade.</span><span class="row"><button class="btn sm" data-act="import-csv">Import CSV</button><button class="btn sm pri" data-act="new-trade">Log first trade</button><button class="btn sm ghost" data-act="hide-demo">Hide samples</button></span></div>`;
  return h;
}

function render() {
  if (!VIEWS[S.view]) S.view = 'dashboard';
  killCharts();
  renderSide(); renderFilters();
  $('#vtitle').textContent = TITLES[S.view];
  if (!S.loaded) { $('#view').innerHTML = `<div class="panel empty">Loading your journal…</div>`; return; }
  const v = VIEWS[S.view];
  $('#view').innerHTML = `<div class="stack" style="gap:16px">${['config', 'accounts'].includes(S.view) ? '' : demoBanner()}${v.html()}</div>`;
  v.after && v.after();
}

/* ---------- shared bits ---------- */
function kpi(label, val, sub, c = '') { return `<div class="kpi"><label>${label}</label><div class="v ${c}">${val}</div>${sub ? `<div class="s">${sub}</div>` : ''}</div>`; }
function tiltBar(t) { const p = Math.min(t._.cp, 6), n = Math.min(t._.cn, 6); if (!p && !n) return '<span class="faint">—</span>'; return `<span class="tilt" title="${t._.cp} positive · ${t._.cn} negative">${'<i class="p"></i>'.repeat(p)}${'<i class="n"></i>'.repeat(n)}</span>`; }
function equitySeries(list) { let e = 0; return list.map(t => (e += t._.pnl)); }
function noData(msg = 'No closed trades in this range.') { return `<div class="panel empty">${msg}</div>`; }
function setupBreak(list, dimId, limit = 6) {
  const dim = dims().find(d => d.id === dimId); const g = groupBy(list, dim.fn);
  const rows = dimOrder(dim, [...g.keys()]).map(k => ({ k, m: metrics(g.get(k)) })).slice(0, limit);
  return rows;
}

/* ---------- Dashboard ---------- */
const VIEWS = {};
VIEWS.dashboard = {
  html() {
    const L = closedScoped(); const m = metrics(L);
    if (!L.length) return noData('No closed trades in this range yet. Add a trade or widen the date range.');
    const recent = [...L].reverse().slice(0, 8);
    const setups = setupBreak(L, 'setup');
    const longM = metrics(L.filter(t => t.dir !== 'short')), shortM = metrics(L.filter(t => t.dir === 'short'));
    return `
    <div class="kpis">
      ${kpi('Net P&L', fmtS$(m.net), `${m.n} trades · ${fmt$(m.fees)} fees`, cls(m.net))}
      ${kpi('Win rate', pct(m.wr), `${m.wins}W · ${m.losses}L · ${m.be}BE`)}
      ${kpi('Profit factor', m.pf === Infinity ? '∞' : f2(m.pf), `${fmt$(m.gw)} / ${fmt$(m.gl)}`)}
      ${kpi('Expectancy', fmtR(m.expR), `${fmtS$(m.exp)} per trade`, cls(m.expR))}
      ${kpi('Avg win / loss', `${fmtR(m.avgWR)}`, `loss ${fmtR(m.avgLR)} · payoff ${f2(m.payoff)}`)}
      ${kpi('Max drawdown', fmt$(m.mdd), `${fmtR(m.rdd)} in R`, m.mdd < 0 ? 'neg' : '')}
    </div>
    <div class="grid g32">
      <div class="panel"><h2>Equity curve <small>cumulative net P&L</small></h2><div class="chart tall"><canvas id="c-eq"></canvas></div></div>
      <div class="panel"><h2>Tiltmeter <small>last 30 trades</small></h2>
        <div class="row between" style="margin-bottom:8px"><span class="muted">Discipline score</span><b class="num ${m.disc >= .7 ? 'pos' : m.disc < .5 ? 'neg' : ''}" style="font-size:20px">${pct(m.disc, 0)}</b></div>
        <div class="chart" style="height:260px"><canvas id="c-tilt"></canvas></div></div>
    </div>
    <div class="grid g3">
      <div class="panel"><h2>Daily P&L <small>last 30 sessions</small></h2><div class="chart short"><canvas id="c-daily"></canvas></div></div>
      <div class="panel"><h2>By setup</h2>${miniTable(setups)}</div>
      <div class="panel"><h2>Long vs short</h2>
        <table><thead><tr><th></th><th class="r">Trades</th><th class="r">Win %</th><th class="r">Exp.</th><th class="r">Net</th></tr></thead><tbody>
        <tr><td><span class="pill long">Long</span></td><td class="r num">${longM.n}</td><td class="r num">${pct(longM.wr, 0)}</td><td class="r num ${cls(longM.expR)}">${fmtR(longM.expR)}</td><td class="r num ${cls(longM.net)}">${fmtS$(longM.net)}</td></tr>
        <tr><td><span class="pill short">Short</span></td><td class="r num">${shortM.n}</td><td class="r num">${pct(shortM.wr, 0)}</td><td class="r num ${cls(shortM.expR)}">${fmtR(shortM.expR)}</td><td class="r num ${cls(shortM.net)}">${fmtS$(shortM.net)}</td></tr>
        </tbody></table>
        <div class="kv" style="margin-top:14px">
          <div><label>Green days</label><b>${m.greenDays}/${m.days}</b></div>
          <div><label>Best day</label><b class="pos">${fmt$(m.bestDay)}</b></div>
          <div><label>Worst day</label><b class="neg">${fmt$(m.worstDay)}</b></div>
        </div></div>
    </div>
    <div class="panel"><h2>Recent trades <button class="btn sm ghost" data-nav="trades">View all</button></h2>${tradeTable(recent, true)}</div>`;
  },
  after() {
    const L = closedScoped(); if (!L.length) return; const T = tok();
    const eq = equitySeries(L);
    mkChart('c-eq', {
      type: 'line', data: { labels: L.map((t, i) => i + 1), datasets: [{ data: eq, borderColor: T('accent'), borderWidth: 2, pointRadius: 0, tension: .15, fill: { target: 'origin', above: T('accent-soft'), below: T('neg-soft') } }] },
      options: { scales: { x: { grid: { display: false }, ticks: { maxTicksLimit: 8 }, title: { display: true, text: 'Trade #' } }, y: { ticks: { callback: v => fmt$(v) } } }, plugins: { tooltip: { callbacks: { title: i => `#${i[0].label} · ${fmtDate(L[i[0].dataIndex].entryTime)}`, label: i => fmt$(i.raw) } } } }
    });
    const last = L.slice(-30);
    mkChart('c-tilt', {
      type: 'bar', data: { labels: last.map((t, i) => i + 1), datasets: [{ data: last.map(t => t._.cp), backgroundColor: T('pos'), stack: 's' }, { data: last.map(t => -t._.cn), backgroundColor: T('neg'), stack: 's' }] },
      options: { scales: { x: { display: false, stacked: true }, y: { stacked: true, ticks: { stepSize: 1, callback: v => Math.abs(v) } } }, plugins: { tooltip: { callbacks: { title: i => fmtDate(last[i[0].dataIndex].entryTime, true), label: i => (i.datasetIndex ? 'Negative: ' : 'Positive: ') + Math.abs(i.raw) } } } }
    });
    const dm = new Map(); for (const t of L) dm.set(t._.date, (dm.get(t._.date) || 0) + t._.pnl);
    const days = [...dm.entries()].slice(-30);
    mkChart('c-daily', {
      type: 'bar', data: { labels: days.map(d => d[0]), datasets: [{ data: days.map(d => d[1]), backgroundColor: days.map(d => d[1] >= 0 ? T('pos') : T('neg')), borderRadius: 2 }] },
      options: { scales: { x: { display: false }, y: { ticks: { callback: v => fmt$(v) } } }, plugins: { tooltip: { callbacks: { title: i => fmtDay(i[0].label), label: i => fmtS$(i.raw) } } } }
    });
  }
};
function miniTable(rows) {
  if (!rows.length) return '<p class="muted">No data.</p>';
  return `<table><thead><tr><th></th><th class="r">n</th><th class="r">Win %</th><th class="r">Exp.</th><th class="r">Net</th></tr></thead><tbody>${rows.map(r => `<tr><td style="white-space:normal">${esc(r.k)}</td><td class="r num">${r.m.n}</td><td class="r num">${pct(r.m.wr, 0)}</td><td class="r num ${cls(r.m.expR)}">${fmtR(r.m.expR)}</td><td class="r num ${cls(r.m.net)}">${fmtS$(r.m.net)}</td></tr>`).join('')}</tbody></table>`;
}
function tradeTable(list, compact) {
  if (!list.length) return '<div class="empty">No trades match.</div>';
  return `<div class="tbl-wrap"><table><thead><tr><th>Date</th><th>Instr.</th><th>Side</th>${compact ? '' : '<th>Setup</th>'}<th class="r">Size</th><th class="r">Entry</th><th class="r">Exit</th><th class="r">P&L</th><th class="r">R</th>${compact ? '' : '<th class="r">Hold</th><th>Mistakes</th>'}<th>Tilt</th><th>Result</th></tr></thead><tbody>
  ${list.map(t => `<tr class="click" data-trade="${esc(t.id)}"><td>${fmtDate(t.entryTime, true)}</td><td><b>${esc(t.instrument)}</b></td><td><span class="pill ${t.dir === 'short' ? 'short' : 'long'}">${t.dir === 'short' ? 'Short' : 'Long'}</span></td>
    ${compact ? '' : `<td style="max-width:200px;overflow:hidden;text-overflow:ellipsis">${esc(t.setup || '—')}</td>`}
    <td class="r num">${t._.size || '—'}</td><td class="r num">${isNum(t.entry) ? t.entry : '—'}</td><td class="r num">${isNum(t._.avgExit) ? +t._.avgExit.toFixed(4) : '—'}</td>
    <td class="r num ${cls(t._.pnl)}">${t._.closed ? fmtS$(t._.pnl, 2) : 'open'}</td><td class="r num ${cls(t._.r)}">${fmtR(t._.r)}</td>
    ${compact ? '' : `<td class="r num">${fmtDur(t._.dur)}</td><td class="muted" style="max-width:180px;overflow:hidden;text-overflow:ellipsis">${esc((t.stats?.mist || []).filter(x => x !== 'None').join(', ') || '')}</td>`}
    <td>${tiltBar(t)}</td><td><span class="pill ${t._.res}">${t._.res === 'OPEN' ? 'Open' : t._.res}</span></td></tr>`).join('')}
  </tbody></table></div>`;
}

/* ---------- Trades ---------- */
const TF = { q: '', setup: '', dir: '', res: '', inst: '', sort: 'date', desc: true };
VIEWS.trades = {
  html() {
    let L = scoped();
    const insts = [...new Set(L.map(t => t.instrument))];
    if (TF.setup) L = L.filter(t => t.setup === TF.setup);
    if (TF.dir) L = L.filter(t => t.dir === TF.dir);
    if (TF.res) L = L.filter(t => t._.res === TF.res);
    if (TF.inst) L = L.filter(t => t.instrument === TF.inst);
    if (TF.q) { const q = TF.q.toLowerCase(); L = L.filter(t => JSON.stringify([t.notes, t.setup, t.stats, t.comments, t.instrument]).toLowerCase().includes(q)); }
    const key = { date: t => t._.ts, pnl: t => t._.pnl ?? -1e12, r: t => t._.r ?? -1e9 }[TF.sort];
    L.sort((a, b) => (key(a) - key(b)) * (TF.desc ? -1 : 1));
    const m = metrics(L);
    return `<div class="panel">
      <div class="row between" style="margin-bottom:12px">
        <div class="row">
          <input class="inp" id="tf-q" placeholder="Search notes, tags, comments" value="${esc(TF.q)}" style="width:230px">
          <select class="sel" id="tf-setup"><option value="">All setups</option>${S.settings.setups.map(s => `<option ${TF.setup === s ? 'selected' : ''}>${esc(s)}</option>`).join('')}</select>
          <select class="sel" id="tf-inst"><option value="">All instruments</option>${insts.map(s => `<option ${TF.inst === s ? 'selected' : ''}>${esc(s)}</option>`).join('')}</select>
          <select class="sel" id="tf-dir"><option value="">Long & short</option><option value="long" ${TF.dir === 'long' ? 'selected' : ''}>Long</option><option value="short" ${TF.dir === 'short' ? 'selected' : ''}>Short</option></select>
          <select class="sel" id="tf-res"><option value="">All results</option>${[['W', 'Winners'], ['L', 'Losers'], ['BE', 'Break-even'], ['OPEN', 'Open']].map(([v, l]) => `<option value="${v}" ${TF.res === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
          <select class="sel" id="tf-sort">${[['date', 'Sort: date'], ['pnl', 'Sort: P&L'], ['r', 'Sort: R']].map(([v, l]) => `<option value="${v}" ${TF.sort === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
          <button class="btn sm" data-act="tf-desc">${TF.desc ? '↓ Desc' : '↑ Asc'}</button>
        </div>
        <div class="row"><button class="btn sm" data-act="import-csv">Import CSV</button><button class="btn sm" data-act="export-csv">Export CSV</button></div>
      </div>
      <div class="row muted" style="margin-bottom:10px;gap:18px;font-size:13px"><span><b class="num">${L.length}</b> trades</span><span>Net <b class="num ${cls(m.net)}">${fmtS$(m.net)}</b></span><span>Win rate <b class="num">${pct(m.wr)}</b></span><span>Total <b class="num ${cls(m.totalR)}">${fmtR(m.totalR)}</b></span></div>
      ${tradeTable(L)}</div>`;
  }
};

/* ---------- Statistics ---------- */
VIEWS.analytics = {
  html() {
    const tab = S.sub.an || 'overview';
    const tabs = [['overview', 'Overview'], ['time', 'Time'], ['mgmt', 'Trade management'], ['risk', 'Risk & Monte Carlo']];
    const L = closedScoped();
    const head = `<div class="tabs">${tabs.map(([k, l]) => `<button class="tab ${tab === k ? 'on' : ''}" data-sub="an:${k}">${l}</button>`).join('')}</div>`;
    if (!L.length) return head + noData();
    return head + ANA[tab].html(L);
  },
  after() { const L = closedScoped(); if (L.length) { const a = ANA[S.sub.an || 'overview']; a.after && a.after(L); } }
};
const ANA = {};
ANA.overview = {
  html(L) {
    const cols = [['All', L], ['Long', L.filter(t => t.dir !== 'short')], ['Short', L.filter(t => t.dir === 'short')]].map(([k, l]) => [k, metrics(l)]);
    const rows = [
      ['Performance'], ['Net P&L', m => fmtS$(m.net, 2), m => m.net], ['Total R', m => fmtR(m.totalR), m => m.totalR], ['Gross profit', m => fmt$(m.gw, 2)], ['Gross loss', m => fmt$(-m.gl, 2)], ['Commissions & fees', m => fmt$(m.fees, 2)],
      ['Profit factor', m => m.pf === Infinity ? '∞' : f2(m.pf)], ['Expectancy (R)', m => fmtR(m.expR), m => m.expR], ['Expectancy ($)', m => fmtS$(m.exp, 2), m => m.exp],
      ['Win / loss'], ['Number of trades', m => m.n], ['Winners', m => m.wins], ['Losers', m => m.losses], ['Break-even', m => m.be], ['Win rate (excl. BE)', m => pct(m.wr)],
      ['Average winner', m => fmt$(m.avgW, 2) + ' · ' + fmtR(m.avgWR)], ['Average loser', m => fmt$(m.avgL, 2) + ' · ' + fmtR(m.avgLR)], ['Payoff ratio', m => f2(m.payoff)],
      ['Largest winner', m => fmt$(m.bigW, 2)], ['Largest loser', m => fmt$(m.bigL, 2)], ['Max consecutive winners', m => m.mcw], ['Max consecutive losers', m => m.mcl],
      ['Risk'], ['Max drawdown ($)', m => fmt$(m.mdd, 2)], ['Max drawdown (R)', m => fmtR(m.rdd)], ['Sharpe (daily, annualised)', m => f2(m.sharpe)], ['Avg planned R:R', m => f2(m.planR)],
      ['Execution'], ['Avg MFE', m => fmtR(m.mfe)], ['Avg MAE', m => m.mae == null ? '—' : '−' + m.mae.toFixed(2) + 'R'], ['Exit efficiency', m => pct(m.eff, 0)], ['Avg hold — winners', m => fmtDur(m.holdW)], ['Avg hold — losers', m => fmtDur(m.holdL)],
      ['Discipline score', m => pct(m.disc, 0)], ['Contracts traded', m => m.contracts],
      ['Days'], ['Trading days', m => m.days], ['Green days', m => m.greenDays], ['Avg daily P&L', m => fmtS$(m.avgDay, 2), m => m.avgDay], ['Best day', m => fmt$(m.bestDay, 2)], ['Worst day', m => fmt$(m.worstDay, 2)],
    ];
    const tbl = `<div class="tbl-wrap"><table><thead><tr><th>Metric</th>${cols.map(c => `<th class="r">${c[0]}</th>`).join('')}</tr></thead><tbody>${rows.map(r => r.length === 1 ? `<tr><td colspan="4" style="padding-top:16px"><span class="lbl">${r[0]}</span></td></tr>` : `<tr><td>${r[0]}</td>${cols.map(([, m]) => `<td class="r num ${r[2] ? cls(r[2](m)) : ''}">${r[1](m)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
    return `<div class="grid g32"><div class="panel"><h2>All statistics</h2>${tbl}</div>
      <div class="stack" style="gap:16px">
        <div class="panel"><h2>R-multiple distribution</h2><div class="chart"><canvas id="c-rdist"></canvas></div></div>
        <div class="panel"><h2>Win / loss split</h2><div class="chart short"><canvas id="c-wl"></canvas></div></div>
        <div class="panel"><h2>Cumulative R</h2><div class="chart short"><canvas id="c-cr"></canvas></div></div>
      </div></div>`;
  },
  after(L) {
    const T = tok(); const rs = L.map(t => t._.r).filter(isNum);
    const bins = []; for (let b = -3; b <= 4; b += 0.5) bins.push(b);
    const counts = bins.map((b, i) => rs.filter(r => (i === 0 ? r < b + 0.5 : i === bins.length - 1 ? r >= b : r >= b && r < b + 0.5)).length);
    mkChart('c-rdist', { type: 'bar', data: { labels: bins.map((b, i) => i === 0 ? '<' + (b + .5) : i === bins.length - 1 ? '≥' + b : b.toFixed(1)), datasets: [{ data: counts, backgroundColor: bins.map(b => b < 0 ? T('neg') : T('pos')), borderRadius: 2 }] }, options: { scales: { x: { grid: { display: false }, title: { display: true, text: 'R multiple' } }, y: { ticks: { stepSize: 1 } } } } });
    const m = metrics(L);
    mkChart('c-wl', { type: 'doughnut', data: { labels: ['Winners', 'Losers', 'Break-even'], datasets: [{ data: [m.wins, m.losses, m.be], backgroundColor: [T('pos'), T('neg'), T('line2')], borderColor: T('panel'), borderWidth: 2 }] }, options: { cutout: '65%', plugins: { legend: { display: true, position: 'right' } } } });
    let c = 0; const cr = L.filter(t => isNum(t._.r)).map(t => (c += t._.r));
    mkChart('c-cr', { type: 'line', data: { labels: cr.map((_, i) => i + 1), datasets: [{ data: cr, borderColor: T('accent'), borderWidth: 2, pointRadius: 0, tension: .15 }] }, options: { scales: { x: { display: false }, y: { ticks: { callback: v => v + 'R' } } } } });
  }
};
const TMET = { net: ['Net P&L', m => m.net, v => fmt$(v)], exp: ['Expectancy (R)', m => m.expR, v => (+v).toFixed(2) + 'R'], wr: ['Win rate', m => m.wr, v => Math.round(v * 100) + '%'], n: ['Trades', m => m.n, v => v] };
function timeGroups(L) {
  const durB = [[0, 5, '<5m'], [5, 15, '5–15m'], [15, 30, '15–30m'], [30, 60, '30–60m'], [60, 120, '1–2h'], [120, 1e9, '>2h']];
  const hours = [...new Set(L.map(t => t._.hour))].filter(h => h != null).sort((a, b) => a - b);
  const g = (keys, fn) => keys.map(k => [k, metrics(L.filter(t => fn(t) === k))]);
  return {
    hour: g(hours, t => t._.hour).map(([k, m]) => [hourLabel(k), m]),
    wd: g([1, 2, 3, 4, 5, 6, 0].filter(d => L.some(t => t._.wd === d)), t => t._.wd).map(([k, m]) => [WD[k], m]),
    month: (() => { const ks = [...new Set(L.map(t => t._.date.slice(0, 7)))].sort(); return ks.map(k => [MON[+k.slice(5) - 1] + ' ' + k.slice(2, 4), metrics(L.filter(t => t._.date.startsWith(k)))]); })(),
    dur: durB.map(([a, b, l]) => [l, metrics(L.filter(t => isNum(t._.dur) && t._.dur >= a && t._.dur < b))]).filter(x => x[1].n),
  };
}
ANA.time = {
  html() {
    const met = S.sub.tm || 'net';
    const box = (id, title) => `<div class="panel"><h2>${title}</h2><div class="chart"><canvas id="${id}"></canvas></div><div id="${id}-t"></div></div>`;
    return `<div class="row between"><span class="hint">Every chart shows the selected measure. Hover a bar for trade count.</span>
      <div class="seg">${Object.entries(TMET).map(([k, v]) => `<button class="${met === k ? 'on' : ''}" data-sub="tm:${k}">${v[0]}</button>`).join('')}</div></div>
      <div class="grid g2">${box('c-hour', 'By entry hour')}${box('c-wd', 'By weekday')}${box('c-month', 'By month')}${box('c-dur', 'By holding time')}</div>`;
  },
  after(L) {
    const T = tok(); const [, fn, fmt] = TMET[S.sub.tm || 'net']; const G2 = timeGroups(L);
    const draw = (id, rows) => {
      const vals = rows.map(r => fn(r[1]) ?? 0);
      mkChart(id, { type: 'bar', data: { labels: rows.map(r => r[0]), datasets: [{ data: vals, backgroundColor: vals.map(v => (S.sub.tm === 'wr' ? v >= .5 : S.sub.tm === 'n' ? true : v >= 0) ? T('pos') : T('neg')), borderRadius: 3 }] }, options: { scales: { x: { grid: { display: false } }, y: { ticks: { callback: v => fmt(v) } } }, plugins: { tooltip: { callbacks: { label: i => `${fmt(i.raw)} · ${rows[i.dataIndex][1].n} trades · win ${pct(rows[i.dataIndex][1].wr, 0)}` } } } } });
    };
    draw('c-hour', G2.hour); draw('c-wd', G2.wd); draw('c-month', G2.month); draw('c-dur', G2.dur);
  }
};
ANA.mgmt = {
  html(L) {
    const withR = L.filter(t => isNum(t._.r) && isNum(t._.mfeR));
    const W = withR.filter(t => t._.res === 'W');
    const left = avg(W.map(t => Math.max(0, t._.mfeR - t._.r)));
    const hitTarget = L.filter(t => isNum(t._.planR) && isNum(t._.mfeR) && t._.mfeR >= t._.planR);
    const heldTarget = hitTarget.filter(t => t._.r >= t._.planR - 0.05);
    const stopRows = [0.25, 0.5, 0.75, 1].map(x => {
      const lost = L.filter(t => isNum(t._.maeR) && t._.maeR >= x && t._.res !== 'L');
      const saved = L.filter(t => t._.res === 'L' && isNum(t._.r) && t._.r < -x);
      return [x, lost.length, sum(lost.map(t => (t._.r || 0) + x)), saved.length];
    });
    const targetRows = [1, 1.5, 2, 2.5, 3, 4].map(x => {
      const sim = L.filter(t => isNum(t._.r)).map(t => isNum(t._.mfeR) && t._.mfeR >= x ? x : Math.min(t._.r, x));
      return [x, sim.filter(v => v >= x).length, sum(sim), avg(sim)];
    });
    const actualR = sum(L.map(t => t._.r).filter(isNum));
    return `<div class="kpis" style="grid-template-columns:repeat(4,minmax(0,1fr))">
        ${kpi('R left on table', left == null ? '—' : left.toFixed(2) + 'R', 'avg per winner (MFE − result)', 'neg')}
        ${kpi('Exit efficiency', pct(avg(L.map(t => t._.eff).filter(isNum)), 0), 'share of the best move captured')}
        ${kpi('Reached target', `${hitTarget.length}`, `held to target ${heldTarget.length} of ${hitTarget.length}`)}
        ${kpi('Avg MAE on winners', (() => { const v = avg(W.map(t => t._.maeR).filter(isNum)); return v == null ? '—' : '−' + v.toFixed(2) + 'R'; })(), 'heat taken before working')}
      </div>
      ${withR.length ? '' : '<div class="banner">Fill in <b>best price (MFE)</b>, <b>worst price (MAE)</b> and a stop on your trades to unlock these charts.</div>'}
      <div class="grid g2">
        <div class="panel"><h2>MFE vs result <small>dots on the diagonal held the whole move</small></h2><div class="chart tall"><canvas id="c-mfe"></canvas></div></div>
        <div class="panel"><h2>MAE vs result <small>how much heat winners and losers took</small></h2><div class="chart tall"><canvas id="c-mae"></canvas></div></div>
      </div>
      <div class="grid g2">
        <div class="panel"><h2>Fixed target study <small>actual total ${fmtR(actualR)}</small></h2><table><thead><tr><th>Target</th><th class="r">Hits</th><th class="r">Total R</th><th class="r">Exp.</th><th class="r">vs actual</th></tr></thead><tbody>${targetRows.map(r => `<tr><td class="num">${r[0]}R</td><td class="r num">${r[1]}</td><td class="r num ${cls(r[2])}">${fmtR(r[2])}</td><td class="r num">${fmtR(r[3])}</td><td class="r num ${cls(r[2] - actualR)}">${fmtR(r[2] - actualR)}</td></tr>`).join('')}</tbody></table><p class="hint">Assumes the target fills whenever MFE reached it; other trades keep their result, capped at the target.</p></div>
        <div class="panel"><h2>Tighter stop study</h2><table><thead><tr><th>Stop at</th><th class="r">Winners lost</th><th class="r">R given up</th><th class="r">Losers cut</th></tr></thead><tbody>${stopRows.map(r => `<tr><td class="num">−${r[0]}R</td><td class="r num">${r[1]}</td><td class="r num neg">${fmtR(-r[2])}</td><td class="r num">${r[3]}</td></tr>`).join('')}</tbody></table><p class="hint">Winners lost: non-losing trades whose MAE reached that stop. Losers cut: losses bigger than that stop.</p></div>
      </div>`;
  },
  after(L) {
    const T = tok(); const P = L.filter(t => isNum(t._.r));
    const pts = (k) => [{ data: P.filter(t => t._.r >= 0 && isNum(t._[k])).map(t => ({ x: t._[k], y: t._.r })), backgroundColor: T('pos') }, { data: P.filter(t => t._.r < 0 && isNum(t._[k])).map(t => ({ x: t._[k], y: t._.r })), backgroundColor: T('neg') }];
    const mx = Math.max(3, ...P.map(t => t._.mfeR || 0)) + .5;
    mkChart('c-mfe', { type: 'scatter', data: { datasets: [...pts('mfeR'), { type: 'line', data: [{ x: 0, y: 0 }, { x: mx, y: mx }], borderColor: T('line2'), borderDash: [4, 4], pointRadius: 0 }] }, options: { scales: { x: { min: 0, title: { display: true, text: 'MFE (R)' } }, y: { title: { display: true, text: 'Result (R)' } } } } });
    mkChart('c-mae', { type: 'scatter', data: { datasets: pts('maeR') }, options: { scales: { x: { min: 0, title: { display: true, text: 'MAE (R)' } }, y: { title: { display: true, text: 'Result (R)' } } } } });
  }
};
ANA.risk = {
  html(L) {
    const m = metrics(L);
    const R = S.sub.ror || { wr: +((m.wr || .5) * 100).toFixed(0), payoff: +(m.payoff ? m.payoff : 1.5).toFixed(2), risk: 1, ruin: 30, n: 300 };
    S.sub.ror = R;
    return `<div class="grid g2">
      <div class="panel"><h2>Risk of ruin <small>Monte Carlo · 2,000 runs</small></h2>
        <div class="fgrid" style="grid-template-columns:repeat(5,minmax(0,1fr))">
          ${[['wr', 'Win rate %'], ['payoff', 'Payoff ratio'], ['risk', 'Risk / trade %'], ['ruin', 'Ruin = drawdown %'], ['n', 'Trades']].map(([k, l]) => `<div class="f"><label for="ror-${k}">${l}</label><input class="inp num" id="ror-${k}" data-ror="${k}" type="number" step="any" value="${R[k]}"></div>`).join('')}
        </div>
        <div id="ror-out" style="margin-top:14px"></div>
        <p class="hint">Inputs start from your filtered stats. Ruin means the account falls by that percentage from its starting balance at any point.</p></div>
      <div class="panel"><h2>Monte Carlo equity <small>your R results reshuffled · 200 paths of ${L.filter(t => isNum(t._.r)).length} trades</small></h2><div class="chart tall"><canvas id="c-mc"></canvas></div><div id="mc-out" class="kv" style="margin-top:12px"></div></div>
    </div>`;
  },
  after(L) {
    rorRun();
    const rs = L.map(t => t._.r).filter(isNum); if (rs.length < 5) return;
    let seed = 99; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const paths = [], finals = [], dds = [];
    for (let p = 0; p < 200; p++) { let e = 0, pk = 0, dd = 0; const path = [0]; for (let i = 0; i < rs.length; i++) { e += rs[Math.floor(rnd() * rs.length)]; pk = Math.max(pk, e); dd = Math.min(dd, e - pk); path.push(e); } paths.push(path); finals.push(e); dds.push(dd); }
    finals.sort((a, b) => a - b); dds.sort((a, b) => a - b);
    const q = (a, x) => a[Math.floor(x * (a.length - 1))];
    const T = tok();
    const ds = paths.slice(0, 60).map(p => ({ data: p, borderColor: T('accent-soft'), borderWidth: 1, pointRadius: 0 }));
    let e = 0; ds.push({ data: [0, ...rs.map(r => (e += r))], borderColor: T('accent'), borderWidth: 2.5, pointRadius: 0 });
    mkChart('c-mc', { type: 'line', data: { labels: paths[0].map((_, i) => i), datasets: ds }, options: { animation: false, plugins: { tooltip: { enabled: false } }, scales: { x: { ticks: { maxTicksLimit: 6 } }, y: { ticks: { callback: v => v + 'R' } } } } });
    $('#mc-out').innerHTML = `<div><label>5th pct. outcome</label><b class="${cls(q(finals, .05))}">${fmtR(q(finals, .05))}</b></div><div><label>Median outcome</label><b class="${cls(q(finals, .5))}">${fmtR(q(finals, .5))}</b></div><div><label>Chance of loss</label><b>${pct(finals.filter(x => x < 0).length / finals.length, 0)}</b></div><div><label>Median max DD</label><b class="neg">${fmtR(q(dds, .5))}</b></div><div><label>Worst 5% DD</label><b class="neg">${fmtR(q(dds, .05))}</b></div><div><label>Actual path</label><b class="${cls(e)}">${fmtR(e)}</b></div>`;
  }
};
function rorRun() {
  const R = S.sub.ror; const out = $('#ror-out'); if (!out || !R) return;
  const wr = R.wr / 100, po = R.payoff, rk = R.risk / 100, ruin = 1 - R.ruin / 100, N = Math.min(5000, Math.max(1, R.n | 0));
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  let ruined = 0, fin = []; for (let r = 0; r < 2000; r++) { let b = 1, dead = false; for (let i = 0; i < N; i++) { const amt = b * rk; b += rnd() < wr ? amt * po : -amt; if (b <= ruin) { dead = true; break; } } if (dead) ruined++; fin.push(b); }
  fin.sort((a, b) => a - b);
  const edge = wr * po - (1 - wr);
  out.innerHTML = `<div class="kv"><div><label>Risk of ruin</label><b class="${ruined / 2000 > .05 ? 'neg' : 'pos'}" style="font-size:22px">${pct(ruined / 2000, 1)}</b></div><div><label>Edge per trade</label><b class="${cls(edge)}">${fmtR(edge)}</b></div><div><label>Median growth</label><b class="${cls(fin[1000] - 1)}">${pct(fin[1000] - 1, 0)}</b></div></div>`;
}

/* ---------- Edge Finder ---------- */
VIEWS.edge = {
  html() {
    const L = closedScoped(); if (!L.length) return noData();
    const D = dims(); const minN = S.sub.minN ?? 3;
    const all = [];
    for (const d of D) { const g = groupBy(L, d.fn); for (const [k, ts] of g) { const m = metrics(ts); if (m.n >= minN && isNum(m.expR)) all.push({ d, k, m }); } }
    all.sort((a, b) => b.m.expR - a.m.expR);
    const base = metrics(L);
    const top = all.filter(x => x.m.expR > base.expR).slice(0, 5), bot = all.filter(x => x.m.expR < base.expR).slice(-5).reverse();
    const card = (x) => `<tr><td style="white-space:normal"><span class="faint" style="font-size:11.5px">${esc(x.d.name)}</span><br><b>${esc(x.k)}</b></td><td class="r num">${x.m.n}</td><td class="r num">${pct(x.m.wr, 0)}</td><td class="r num ${cls(x.m.expR)}">${fmtR(x.m.expR)}</td><td class="r num ${cls(x.m.net)}">${fmtS$(x.m.net)}</td></tr>`;
    const sel = S.sub.edgeDim || 'setup';
    const dim = D.find(d => d.id === sel) || D[0];
    const g = groupBy(L, dim.fn);
    const rows = dimOrder(dim, [...g.keys()]).map(k => ({ k, m: metrics(g.get(k)) }));
    const maxAbs = Math.max(0.5, ...rows.map(r => Math.abs(r.m.expR || 0)));
    const rx = S.sub.rx || 'setup', ry = S.sub.ry || (D.find(d => d.stat) || D[1]).id;
    return `<div class="banner"><span>Your baseline: <b class="num ${cls(base.expR)}">${fmtR(base.expR)}</b> expectancy over <b>${base.n}</b> trades. Edge Finder ranks every setup, tag and comment against it.</span>
      <label class="row" style="gap:6px"><span class="muted">Min. trades</span><input class="inp num" type="number" min="1" id="minN" value="${minN}" style="width:70px"></label></div>
    <div class="grid g2">
      <div class="panel"><h2>Strongest edges <small>above baseline</small></h2>${top.length ? `<table><thead><tr><th></th><th class="r">n</th><th class="r">Win %</th><th class="r">Exp.</th><th class="r">Net</th></tr></thead><tbody>${top.map(card).join('')}</tbody></table>` : '<p class="muted">Not enough trades per group yet.</p>'}</div>
      <div class="panel"><h2>Biggest leaks <small>below baseline</small></h2>${bot.length ? `<table><thead><tr><th></th><th class="r">n</th><th class="r">Win %</th><th class="r">Exp.</th><th class="r">Net</th></tr></thead><tbody>${bot.map(card).join('')}</tbody></table>` : '<p class="muted">Not enough trades per group yet.</p>'}</div>
    </div>
    <div class="panel"><h2>Breakdown <select class="sel" id="edgeDim">${D.map(d => `<option value="${d.id}" ${d.id === dim.id ? 'selected' : ''}>${esc(d.name)}</option>`).join('')}</select></h2>
      <div class="tbl-wrap"><table><thead><tr><th>${esc(dim.name)}</th><th class="r">Trades</th><th class="r">Win %</th><th class="r">Profit factor</th><th class="r">Avg win</th><th class="r">Avg loss</th><th class="r">Expectancy</th><th style="min-width:160px"></th><th class="r">Net P&L</th></tr></thead><tbody>
      ${rows.map(r => { const w = Math.abs(r.m.expR || 0) / maxAbs * 50; return `<tr><td style="white-space:normal"><b>${esc(r.k)}</b></td><td class="r num">${r.m.n}</td><td class="r num">${pct(r.m.wr, 0)}</td><td class="r num">${r.m.pf === Infinity ? '∞' : f2(r.m.pf)}</td><td class="r num">${fmtR(r.m.avgWR)}</td><td class="r num">${fmtR(r.m.avgLR)}</td><td class="r num ${cls(r.m.expR)}">${fmtR(r.m.expR)}</td>
        <td><div class="bar mid"><i style="background:var(--${(r.m.expR || 0) >= 0 ? 'pos' : 'neg'});${(r.m.expR || 0) >= 0 ? `left:50%;width:${w}%` : `right:50%;width:${w}%`}"></i></div></td><td class="r num ${cls(r.m.net)}">${fmtS$(r.m.net)}</td></tr>`; }).join('')}
      </tbody></table></div></div>
    <div class="panel"><h2>Combination matrix <small>expectancy (R) and trade count where two factors meet</small></h2>
      <div class="row" style="margin-bottom:12px"><span class="muted">Rows</span><select class="sel" id="rx">${D.map(d => `<option value="${d.id}" ${d.id === rx ? 'selected' : ''}>${esc(d.name)}</option>`).join('')}</select><span class="muted">Columns</span><select class="sel" id="ry">${D.map(d => `<option value="${d.id}" ${d.id === ry ? 'selected' : ''}>${esc(d.name)}</option>`).join('')}</select></div>
      ${matrix(L, D.find(d => d.id === rx), D.find(d => d.id === ry))}</div>`;
  }
};
function matrix(L, a, b) {
  if (!a || !b) return '';
  const ga = groupBy(L, a.fn), gb = groupBy(L, b.fn);
  const ka = dimOrder(a, [...ga.keys()]), kb = dimOrder(b, [...gb.keys()]);
  const cell = (ra, rb) => { const ts = ga.get(ra).filter(t => gb.get(rb).includes(t)); if (!ts.length) return '<td class="faint">·</td>'; const m = metrics(ts); const e = m.expR || 0; const al = Math.min(.55, Math.abs(e) / 2 * .55 + .06); return `<td style="background:color-mix(in srgb, var(--${e >= 0 ? 'pos' : 'neg'}) ${Math.round(al * 100)}%, transparent)" title="${m.n} trades · win ${pct(m.wr, 0)} · net ${fmt$(m.net)}"><b>${fmtR(m.expR)}</b><br><span class="muted">${m.n}</span></td>`; };
  return `<div class="tbl-wrap"><table class="heat"><thead><tr><th></th>${kb.map(k => `<th style="text-align:center;white-space:normal">${esc(k)}</th>`).join('')}</tr></thead><tbody>${ka.map(ra => `<tr><th style="position:static;white-space:normal;text-transform:none;letter-spacing:0;font-size:12.5px;color:var(--fg)">${esc(ra)}</th>${kb.map(rb => cell(ra, rb)).join('')}</tr>`).join('')}</tbody></table></div>`;
}

/* ---------- Tiltmeter ---------- */
VIEWS.tilt = {
  html() {
    const L = closedScoped(); if (!L.length) return noData();
    const m = metrics(L); const last20 = metrics(L.slice(-20)); const prev20 = metrics(L.slice(-40, -20));
    const pure = L.filter(t => t._.cn === 0 && t._.cp > 0), dirty = L.filter(t => t._.cn > 0);
    const mp = metrics(pure), md = metrics(dirty);
    const rows = [];
    for (const c of CATS) { const g = groupBy(L, t => (t.comments?.[c] || []).map(x => x.t)); const tmpl = S.settings.comments[c]; for (const [k, ts] of g) { const r = (tmpl.find(x => x.t === k) || {}).r ?? ts[0].comments[c].find(x => x.t === k)?.r; rows.push({ c, k, r, m: metrics(ts) }); } }
    rows.sort((a, b) => b.m.n - a.m.n);
    return `<div class="kpis" style="grid-template-columns:repeat(4,minmax(0,1fr))">
      ${kpi('Discipline score', pct(m.disc, 0), `${m.cpos} positive · ${m.cneg} negative comments`, m.disc >= .7 ? 'pos' : m.disc < .5 ? 'neg' : '')}
      ${kpi('Last 20 trades', pct(last20.disc, 0), prev20.n ? `previous 20: ${pct(prev20.disc, 0)}` : '', last20.disc >= (prev20.disc ?? 0) ? 'pos' : 'neg')}
      ${kpi('Clean trades', fmtR(mp.expR), `${mp.n} trades with no negative comment`, cls(mp.expR))}
      ${kpi('Trades with errors', fmtR(md.expR), `${md.n} trades · cost ${fmtS$(md.net)}`, cls(md.expR))}
    </div>
    <div class="panel"><h2>Tiltmeter <small>positive vs negative comments per trade · line = rolling 10-trade discipline</small></h2><div class="chart tall"><canvas id="c-tiltfull"></canvas></div></div>
    <div class="panel"><h2>Comment analysis</h2><div class="tbl-wrap"><table><thead><tr><th>Comment</th><th>Category</th><th class="r">Used</th><th class="r">Frequency</th><th class="r">Win %</th><th class="r">Expectancy</th><th class="r">Net P&L</th></tr></thead><tbody>
      ${rows.map(r => `<tr><td><span class="pill ${r.r > 0 ? 'W' : r.r < 0 ? 'L' : ''}" style="margin-right:6px">${r.r > 0 ? '+' : r.r < 0 ? '−' : '•'}</span>${esc(r.k)}</td><td class="muted">${CAT[r.c]}</td><td class="r num">${r.m.n}</td><td class="r num">${pct(r.m.n / L.length, 0)}</td><td class="r num">${pct(r.m.wr, 0)}</td><td class="r num ${cls(r.m.expR)}">${fmtR(r.m.expR)}</td><td class="r num ${cls(r.m.net)}">${fmtS$(r.m.net)}</td></tr>`).join('') || '<tr><td colspan="7" class="muted">No comments on these trades yet. Add them in the trade form.</td></tr>'}
    </tbody></table></div></div>`;
  },
  after() {
    const L = closedScoped(); if (!L.length) return; const T = tok();
    const roll = L.map((t, i) => { const w = L.slice(Math.max(0, i - 9), i + 1); const p = sum(w.map(x => x._.cp)), n = sum(w.map(x => x._.cn)); return p + n ? p / (p + n) * 100 : null; });
    mkChart('c-tiltfull', {
      type: 'bar', data: { labels: L.map(t => fmtDate(t.entryTime)), datasets: [
        { type: 'bar', data: L.map(t => t._.cp), backgroundColor: T('pos'), stack: 's', yAxisID: 'y' },
        { type: 'bar', data: L.map(t => -t._.cn), backgroundColor: T('neg'), stack: 's', yAxisID: 'y' },
        { type: 'line', data: roll, borderColor: T('accent'), borderWidth: 2, pointRadius: 0, tension: .3, yAxisID: 'y2' }] },
      options: { scales: { x: { stacked: true, ticks: { maxTicksLimit: 8 }, grid: { display: false } }, y: { stacked: true, ticks: { stepSize: 1, callback: v => Math.abs(v) } }, y2: { position: 'right', min: 0, max: 100, grid: { display: false }, ticks: { callback: v => v + '%' } } } }
    });
  }
};

/* ---------- Simulator ---------- */
const SIM = { ex: [], target: '', stop: '', cap: '', worst: '', best: '', perDay: '', dayStop: '', dim: 'setup' };
function simulate(L, o) {
  const D = dims(); const ex = new Set(o.ex);
  let rows = L.filter(t => !D.some(d => { const v = d.fn(t); return (Array.isArray(v) ? v : [v]).some(k => ex.has(d.id + '::' + k)); }))
    .map(t => {
      let r = t._.r; let pnl = t._.pnl; const risk = t._.risk;
      if (isNum(r) && risk) {
        const stop = num(o.stop), tgt = num(o.target), cap = num(o.cap);
        if (stop && isNum(t._.maeR) && t._.maeR >= stop) r = -stop;
        else if (tgt && isNum(t._.mfeR) && t._.mfeR >= tgt) r = tgt;
        else if (tgt) r = Math.min(r, tgt);
        if (cap && r < -cap) r = -cap;
        pnl = r * risk;
      }
      return { t, r, pnl };
    });
  const perDay = num(o.perDay), dayStop = num(o.dayStop);
  if (perDay || dayStop) {
    const out = []; const day = {};
    for (const x of rows) { const d = day[x.t._.date] || (day[x.t._.date] = { n: 0, r: 0, stop: false }); if (d.stop || (perDay && d.n >= perDay)) continue; out.push(x); d.n++; d.r += x.r || 0; if (dayStop && d.r <= -dayStop) d.stop = true; }
    rows = out;
  }
  const w = num(o.worst), b = num(o.best);
  if (w || b) { const sorted = [...rows].sort((a, c) => a.pnl - c.pnl); const drop = new Set([...(w ? sorted.slice(0, w) : []), ...(b ? sorted.slice(-b) : [])]); rows = rows.filter(x => !drop.has(x)); }
  return rows;
}
function simStats(rows) {
  const n = rows.length; const net = sum(rows.map(x => x.pnl)); const rs = rows.map(x => x.r).filter(isNum);
  const W = rows.filter(x => x.pnl > 0), Lo = rows.filter(x => x.pnl < 0);
  const gw = sum(W.map(x => x.pnl)), gl = -sum(Lo.map(x => x.pnl));
  let e = 0, pk = 0, dd = 0; for (const x of rows) { e += x.pnl; pk = Math.max(pk, e); dd = Math.min(dd, e - pk); }
  return { n, net, wr: W.length + Lo.length ? W.length / (W.length + Lo.length) : null, pf: gl ? gw / gl : null, expR: avg(rs), totalR: rs.length ? sum(rs) : null, dd };
}
VIEWS.simulator = {
  html() {
    const L = closedScoped(); if (!L.length) return noData();
    const D = dims(); const dim = D.find(d => d.id === SIM.dim) || D[0];
    const keys = dimOrder(dim, [...groupBy(L, dim.fn).keys()]);
    const a = simStats(L.map(t => ({ t, r: t._.r, pnl: t._.pnl }))), s = simStats(simulate(L, SIM));
    const row = (l, f, k) => `<tr><td>${l}</td><td class="r num ${k ? cls(a[k]) : ''}">${f(a[k])}</td><td class="r num ${k ? cls(s[k]) : ''}">${f(s[k])}</td><td class="r num ${k && isNum(s[k]) && isNum(a[k]) ? cls(s[k] - a[k]) : ''}">${isNum(s[k]) && isNum(a[k]) && k !== 'n' ? (k === 'wr' ? ((s[k] - a[k]) * 100).toFixed(1) + ' pts' : k === 'net' || k === 'dd' ? fmtS$(s[k] - a[k]) : (s[k] - a[k]).toFixed(2)) : ''}</td></tr>`;
    const inp = (k, l, ph) => `<div class="f"><label for="sim-${k}">${l}</label><input class="inp num" type="number" step="any" min="0" id="sim-${k}" data-sim="${k}" value="${esc(SIM[k])}" placeholder="${ph}"></div>`;
    return `<div class="grid g32">
      <div class="stack" style="gap:16px">
        <div class="panel"><h2>Equity: actual vs simulated</h2><div class="chart tall"><canvas id="c-sim"></canvas></div></div>
        <div class="panel"><h2>Result</h2><table><thead><tr><th></th><th class="r">Actual</th><th class="r">Simulated</th><th class="r">Change</th></tr></thead><tbody>
          ${row('Trades', v => v ?? '—', 'n')}${row('Net P&L', v => fmtS$(v), 'net')}${row('Total R', fmtR, 'totalR')}${row('Win rate', v => pct(v), 'wr')}${row('Profit factor', f2, 'pf')}${row('Expectancy', fmtR, 'expR')}${row('Max drawdown', v => fmt$(v), 'dd')}
        </tbody></table></div>
      </div>
      <div class="panel stack"><h2>What if… <button class="btn sm ghost" data-act="sim-reset">Reset</button></h2>
        <div class="lbl">Skip trades where</div>
        <select class="sel" id="sim-dim">${D.map(d => `<option value="${d.id}" ${d.id === dim.id ? 'selected' : ''}>${esc(d.name)}</option>`).join('')}</select>
        <div class="chips">${keys.map(k => { const id = dim.id + '::' + k; return `<button class="chip cn ${SIM.ex.includes(id) ? 'on' : ''}" data-simex="${esc(id)}">${esc(k)}</button>`; }).join('')}</div>
        ${SIM.ex.length ? `<div class="hint">Excluding: ${SIM.ex.map(x => esc(x.split('::')[1])).join(', ')}</div>` : ''}
        <div class="lbl" style="margin-top:6px">Trade management</div>
        <div class="fgrid" style="grid-template-columns:1fr 1fr">${inp('target', 'Fixed target (R)', 'e.g. 2')}${inp('stop', 'Stop at (R)', 'e.g. 0.75')}${inp('cap', 'Cap losses at (R)', 'e.g. 1')}</div>
        <div class="lbl" style="margin-top:6px">Daily rules</div>
        <div class="fgrid" style="grid-template-columns:1fr 1fr">${inp('perDay', 'Max trades / day', 'e.g. 2')}${inp('dayStop', 'Stop day after −R', 'e.g. 2')}</div>
        <div class="lbl" style="margin-top:6px">Outliers</div>
        <div class="fgrid" style="grid-template-columns:1fr 1fr">${inp('worst', 'Remove worst N', '0')}${inp('best', 'Remove best N', '0')}</div>
        <p class="hint">Target and stop rules use each trade's MFE and MAE. If both were reached, the stop is assumed to hit first.</p>
      </div></div>`;
  },
  after() {
    const L = closedScoped(); if (!L.length) return; const T = tok();
    const sim = simulate(L, SIM); const idx = new Map(sim.map(x => [x.t, x]));
    let a = 0, s = 0; const A = [], B = [];
    for (const t of L) { a += t._.pnl; A.push(a); const x = idx.get(t); if (x) s += x.pnl; B.push(s); }
    mkChart('c-sim', { type: 'line', data: { labels: L.map((_, i) => i + 1), datasets: [{ label: 'Actual', data: A, borderColor: T('faint'), borderWidth: 2, pointRadius: 0 }, { label: 'Simulated', data: B, borderColor: T('accent'), borderWidth: 2.5, pointRadius: 0 }] }, options: { plugins: { legend: { display: true } }, scales: { x: { ticks: { maxTicksLimit: 8 }, title: { display: true, text: 'Trade #' } }, y: { ticks: { callback: v => fmt$(v) } } } } });
  }
};

/* ---------- Calendar ---------- */
VIEWS.calendar = {
  html() {
    const now = new Date(); const ym = S.sub.cal || `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
    const [y, mo] = ym.split('-').map(Number);
    const L = scoped({ noRange: true }).filter(t => t._.closed && t._.date.startsWith(ym));
    const byDay = groupBy(L, t => t._.date);
    const first = new Date(y, mo - 1, 1); const start = new Date(first); start.setDate(1 - ((first.getDay() + 6) % 7));
    const mm = metrics(L);
    let cells = ''; const today = ymd(now);
    const lastDay = new Date(y, mo, 0);
    for (let w = 0; w < 6; w++) {
      const ws = new Date(start); ws.setDate(start.getDate() + w * 7); if (ws > lastDay) break;
      let wk = 0, wn = 0, any = false;
      for (let i = 0; i < 7; i++) {
        const d = new Date(start); d.setDate(start.getDate() + w * 7 + i); const k = ymd(d); const ts = byDay.get(k) || []; const p = sum(ts.map(t => t._.pnl));
        if (d.getMonth() === mo - 1) any = true;
        wk += p; wn += ts.length; const j = S.journal[k];
        cells += `<div class="day ${d.getMonth() !== mo - 1 ? 'out' : ''} ${k === today ? 'today' : ''} ${ts.length ? (p >= 0 ? 'w' : 'l') : ''}" data-day="${k}"><div class="dn"><span>${d.getDate()}</span>${j && (j.plan || j.review) ? '<span title="Journal entry">✎</span>' : ''}</div>${ts.length ? `<div class="p ${cls(p)}">${fmtS$(p)}</div><div class="c">${ts.length} trade${ts.length > 1 ? 's' : ''} · ${fmtR(sum(ts.map(t => t._.r).filter(isNum)))}</div>` : ''}</div>`;
      }
      cells += `<div class="wk"><span class="lbl">Week ${w + 1}</span><span class="p ${cls(wk)}">${wn ? fmtS$(wk) : '—'}</span><span class="faint" style="font-size:11px">${wn} trades</span></div>`;
    }
    const prev = new Date(y, mo - 2, 1), next = new Date(y, mo, 1);
    return `<div class="panel"><div class="row between" style="margin-bottom:14px">
        <div class="row"><button class="btn sm" data-cal="${prev.getFullYear()}-${pad(prev.getMonth() + 1)}">‹</button><b style="font-size:17px;min-width:150px;text-align:center">${MON[mo - 1]} ${y}</b><button class="btn sm" data-cal="${next.getFullYear()}-${pad(next.getMonth() + 1)}">›</button></div>
        <div class="row muted" style="gap:16px"><span>Month <b class="num ${cls(mm.net)}">${fmtS$(mm.net)}</b></span><span><b class="num">${mm.n}</b> trades</span><span>Win <b class="num">${pct(mm.wr, 0)}</b></span><span>Green days <b class="num">${mm.greenDays}/${mm.days}</b></span></div></div>
      <div class="cal">${['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => `<div class="h">${d}</div>`).join('')}<div class="h wkh">Week</div>${cells}</div>
      <p class="hint" style="margin-top:10px">Click a day to open its journal entry and trades.</p></div>`;
  }
};

/* ---------- Daily journal ---------- */
VIEWS.diary = {
  html() {
    const today = ymd(new Date());
    const date = S.sub.jd || today;
    const tradeDays = new Set(scoped({ noRange: true }).map(t => t._.date));
    const keys = [...new Set([...Object.keys(S.journal), ...tradeDays, today, date])].sort().reverse();
    const j = S.journal[date] || {};
    const ts = scoped({ noRange: true }).filter(t => t._.date === date);
    const m = metrics(ts);
    const moods = ['Calm', 'Focused', 'Tired', 'Anxious', 'Frustrated', 'Overconfident'];
    return `<div class="jl">
      <div class="panel" style="padding:10px"><div class="row" style="padding:4px 4px 10px"><input class="inp" type="date" id="jd-pick" value="${date}" style="flex:1"></div>
        <div class="jlist">${keys.slice(0, 120).map(k => { const dts = scoped({ noRange: true }).filter(t => t._.date === k && t._.closed); const p = sum(dts.map(t => t._.pnl)); const has = S.journal[k] && (S.journal[k].plan || S.journal[k].review); return `<button class="jitem ${k === date ? 'on' : ''}" data-jd="${k}"><span>${fmtDay(k)}<br><small>${has ? 'Journal written' : 'No entry'}${dts.length ? ' · ' + dts.length + ' trades' : ''}</small></span><b class="num ${cls(p)}" style="font-size:12.5px">${dts.length ? fmtS$(p) : ''}</b></button>`; }).join('')}</div></div>
      <div class="stack" style="gap:16px">
        <div class="panel stack">
          <div class="row between"><h2 style="margin:0">${fmtDay(date)}, ${date.slice(0, 4)}</h2><span class="hint" id="jsaved">${S.journal[date] ? 'Saved' : 'Not written yet'}</span></div>
          <div class="fgrid" style="grid-template-columns:repeat(3,minmax(0,1fr))">
            <div class="f"><label>Mood before the open</label><select class="sel" data-j="mood"><option value="">—</option>${moods.map(x => `<option ${j.mood === x ? 'selected' : ''}>${x}</option>`).join('')}</select></div>
            <div class="f"><label>Plan followed</label><select class="sel" data-j="followed"><option value="">—</option>${['Fully', 'Partly', 'Not at all'].map(x => `<option ${j.followed === x ? 'selected' : ''}>${x}</option>`).join('')}</select></div>
            <div class="f"><label>Session grade</label><select class="sel" data-j="grade"><option value="">—</option>${['A', 'B', 'C', 'D', 'F'].map(x => `<option ${j.grade === x ? 'selected' : ''}>${x}</option>`).join('')}</select></div>
          </div>
          <div class="f"><label>Pre-market plan</label><textarea class="inp" data-j="plan" placeholder="Bias, key levels, invalidation, max trades, risk">${esc(j.plan || '')}</textarea></div>
          <div class="f"><label>Post-session review</label><textarea class="inp" data-j="review" placeholder="What happened, what you did well, where you deviated">${esc(j.review || '')}</textarea></div>
          <div class="f"><label>Lesson / rule for tomorrow</label><textarea class="inp" data-j="lesson" style="min-height:56px">${esc(j.lesson || '')}</textarea></div>
        </div>
        <div class="panel"><h2>Trades this day <small>${ts.length ? `${fmtS$(m.net)} · ${fmtR(m.totalR)}` : ''}</small></h2>${ts.length ? tradeTable(ts, true) : '<p class="muted">No trades logged for this day.</p>'}</div>
      </div></div>`;
  }
};

/* ---------- Accounts ---------- */
VIEWS.accounts = {
  html() {
    return `<div class="row between"><span class="hint">Balance = starting balance + deposits − withdrawals + net P&L of trades in the account.</span><button class="btn" data-act="add-account">${icon('plus')}Add account</button></div>
    ${S.settings.accounts.map(a => {
      const ts = S.trades.filter(t => t.account === a.id && t._.closed); const m = metrics(ts);
      const dep = sum(a.txns.filter(x => x.type === 'deposit').map(x => x.amount)), wd = sum(a.txns.filter(x => x.type === 'withdrawal').map(x => x.amount));
      const bal = (num(a.start) || 0) + dep - wd + m.net;
      return `<div class="panel stack" data-acc="${esc(a.id)}">
        <div class="fgrid">
          <div class="f span2"><label>Account name</label><input class="inp" data-af="name" value="${esc(a.name)}"></div>
          <div class="f"><label>Broker / prop firm</label><input class="inp" data-af="broker" value="${esc(a.broker || '')}"></div>
          <div class="f"><label>Starting balance</label><input class="inp num" type="number" step="any" data-af="start" value="${esc(a.start ?? '')}"></div>
        </div>
        <div class="kpis" style="grid-template-columns:repeat(5,minmax(0,1fr))">${kpi('Balance', fmt$(bal, 2))}${kpi('Net P&L', fmtS$(m.net, 2), `${m.n} trades`, cls(m.net))}${kpi('Return', pct(a.start ? m.net / a.start : null))}${kpi('Deposits', fmt$(dep))}${kpi('Withdrawals', fmt$(wd))}</div>
        <div><div class="lbl" style="margin-bottom:8px">Transactions</div>
          <div class="tbl-wrap"><table><thead><tr><th>Date</th><th>Type</th><th class="r">Amount</th><th>Note</th><th></th></tr></thead><tbody>
          ${a.txns.map(x => `<tr><td>${fmtDate(x.date)}</td><td>${x.type === 'deposit' ? 'Deposit' : 'Withdrawal'}</td><td class="r num ${x.type === 'deposit' ? 'pos' : 'neg'}">${fmt$(x.amount, 2)}</td><td class="muted">${esc(x.note || '')}</td><td class="r"><button class="btn sm ghost" data-deltx="${esc(x.id)}">Remove</button></td></tr>`).join('') || '<tr><td colspan="5" class="muted">No deposits or withdrawals.</td></tr>'}
          </tbody></table></div>
          <div class="row" style="margin-top:10px"><input class="inp" type="date" data-tx="date" value="${ymd(new Date())}"><select class="sel" data-tx="type"><option value="deposit">Deposit</option><option value="withdrawal">Withdrawal</option></select><input class="inp num" type="number" step="any" data-tx="amount" placeholder="Amount" style="width:120px"><input class="inp" data-tx="note" placeholder="Note (payout, reset…)" style="flex:1;min-width:140px"><button class="btn sm" data-act="add-tx">Add</button></div>
        </div>
        <div class="row between"><span class="hint">${S.settings.defaultAccount === a.id ? 'New trades go to this account by default.' : `<button class="btn sm ghost" data-act="default-acc">Make default for new trades</button>`}</span>
        ${S.settings.accounts.length > 1 ? (S.sub.delAcc === a.id ? `<span class="confirm">Delete this account? Its ${ts.length} trades stay but lose their account. <button class="btn sm danger" data-act="del-acc-yes">Delete</button><button class="btn sm" data-act="del-acc-no">Keep</button></span>` : `<button class="btn sm danger" data-act="del-acc">Delete account</button>`) : ''}</div>
      </div>`;
    }).join('')}`;
  }
};

/* ---------- Settings ---------- */
VIEWS.config = {
  html() {
    const s = S.settings;
    return `<div class="grid g2">
      <div class="panel stack"><h2>Instruments <small>point value drives P&L</small></h2>
        <div class="tbl-wrap"><table><thead><tr><th>Symbol</th><th>$ / point</th><th>Tick size</th><th>Fee / contract (round trip)</th><th></th></tr></thead><tbody>
          ${s.instruments.map((i, n) => `<tr><td><input class="inp" style="width:80px" data-inst="${n}:sym" value="${esc(i.sym)}"></td><td><input class="inp num" type="number" step="any" style="width:90px" data-inst="${n}:pv" value="${i.pv}"></td><td><input class="inp num" type="number" step="any" style="width:80px" data-inst="${n}:tick" value="${i.tick}"></td><td><input class="inp num" type="number" step="any" style="width:90px" data-inst="${n}:fee" value="${i.fee ?? 0}"></td><td><button class="btn sm ghost" data-delinst="${n}">Remove</button></td></tr>`).join('')}
        </tbody></table></div><div><button class="btn sm" data-act="add-inst">${icon('plus')}Add instrument</button></div>
        <div class="fgrid" style="grid-template-columns:1fr 1fr;margin-top:8px">
          <div class="f"><label>Currency symbol</label><input class="inp" id="cfg-cur" value="${esc(s.currency)}" maxlength="3"></div>
          <div class="f"><label>Break-even band (±R)</label><input class="inp num" type="number" step="0.01" min="0" id="cfg-be" value="${s.beR}"></div>
        </div></div>
      <div class="panel stack"><h2>Setups / strategies</h2>
        <div class="ed-list">${s.setups.map((x, n) => `<div class="ed-row"><input class="inp" data-setup="${n}" value="${esc(x)}"><button class="btn sm ghost" data-delsetup="${n}">Remove</button></div>`).join('')}</div>
        <div class="row"><input class="inp" id="new-setup" placeholder="New setup name" style="flex:1"><button class="btn sm" data-act="add-setup">Add</button></div></div>
    </div>
    <div class="panel stack"><h2>Custom statistics <small>tags you attach to each trade; every one becomes a breakdown in Edge Finder</small></h2>
      <div class="grid g3">${s.stats.map((st, n) => `<div class="panel" style="background:var(--panel2)"><div class="ed-row" style="margin-bottom:10px"><input class="inp" data-statname="${n}" value="${esc(st.name)}" style="font-weight:700"><button class="btn sm ghost" data-delstat="${n}">Delete</button></div>
        <div class="chips" style="margin-bottom:10px">${st.values.map((v, k) => `<span class="chip on">${esc(v)}<button class="x" style="border:0;background:none;color:inherit;cursor:pointer" data-delval="${n}:${k}" aria-label="Remove ${esc(v)}">×</button></span>`).join('')}</div>
        <div class="row"><input class="inp" data-newval="${n}" placeholder="Add value" style="flex:1"><button class="btn sm" data-addval="${n}">Add</button></div></div>`).join('')}
        <div class="panel" style="background:var(--panel2);display:flex;flex-direction:column;gap:8px;justify-content:center"><span class="lbl">New statistic</span><input class="inp" id="new-stat" placeholder="e.g. Market regime"><button class="btn sm" data-act="add-stat">Create</button></div></div></div>
    <div class="panel stack"><h2>Comments <small>rated + or −; they feed the Tiltmeter and discipline score</small></h2>
      <div class="cgrid">${CATS.map(c => `<div class="stack" style="gap:8px"><span class="lbl">${CAT[c]}</span>${s.comments[c].map((x, n) => `<div class="ed-row"><button class="ratebtn ${x.r > 0 ? 'p' : 'n'}" data-rate="${c}:${n}" aria-label="Toggle rating">${x.r > 0 ? '+' : '−'}</button><input class="inp" data-cmt="${c}:${n}" value="${esc(x.t)}"><button class="btn sm ghost" data-delcmt="${c}:${n}" aria-label="Remove">×</button></div>`).join('')}
        <div class="ed-row"><input class="inp" data-newcmt="${c}" placeholder="New comment"><button class="btn sm" data-addcmt="${c}">Add</button></div></div>`).join('')}</div></div>
    <div class="panel stack"><h2>Data</h2>
      <div class="row"><button class="btn" data-act="export-json">Export full backup (JSON)</button><button class="btn" data-act="export-csv">Export trades (CSV)</button><label class="btn">Restore backup<input type="file" accept=".json,application/json" id="restore-json" hidden></label><button class="btn" data-act="import-csv">Import trades (CSV)</button></div>
      <p class="hint">${Store.mode === 'db' ? 'Your journal is stored privately in your Claude account and syncs across your devices. Nobody you share this page with can see it.' : (DESK ? 'Your journal is saved on this PC. A dated backup copy is kept automatically each day (last 30 days).' : 'Your journal is stored in this browser only. Export a backup regularly.')}</p>
      ${DESK ? `<div><button class="btn" data-act="open-data">Open data folder</button></div>` : ''}
      ${S.sub.wipe ? `<div class="confirm">Delete all ${S.trades.length} trades and every journal entry? This cannot be undone. <button class="btn sm danger" data-act="wipe-yes">Delete everything</button><button class="btn sm" data-act="wipe-no">Cancel</button></div>` : `<div><button class="btn danger" data-act="wipe">Delete all trades…</button></div>`}
    </div>`;
  }
};
