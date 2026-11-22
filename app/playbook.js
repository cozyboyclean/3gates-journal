/* ===== Playbook: three-layer classification (HTF setup / location / LTF trigger) and compliance =====
   Trade field:   t.pb = { state, htf, loc, level, trigs: [id], thesis, evidence, objective, g1, g2, g3, pre }
                  htf/trigs hold library item ids (older trades may have a single `trig` id instead of `trigs`);
                  g1/g2/g3/pre are 'yes' | 'no' | 'unknown'.
   Settings:      S.settings.playbook = { htf: [item], trig: [item], loc: [name], pairs: ['htfId|trigId'], deleted: { id: {code, name} } }
                  Deleting a (deprecated) item keeps a snapshot in `deleted` so trades tagged with it stay readable.
                  item = { id, code, name, status: 'approved' | 'candidate' | 'deprecated', def }
   Compliance is computed from predeclared rules only. It never looks at P&L, and Unknown stays Unknown. */
'use strict';

const PB_STATUS = { approved: 'Approved', candidate: 'Research candidate', deprecated: 'Deprecated' };
const PB_STATES = { balance: 'Balance', imbalance: 'Imbalance', transition: 'Transition', unknown: 'Unknown' };
const PB_CLASS = {
  compliant: ['Playbook', 'pb-ok', 'Every rule met and documented before entry'],
  offplaybook: ['Off-playbook', 'pb-off', 'A rule was broken or missing'],
  research: ['Research', 'pb-res', 'Uses a setup or trigger that is still a research candidate'],
  undetermined: ['Undetermined', 'pb-und', 'Some answers are still Unknown'],
  unreviewed: ['Not classified', 'pb-none', 'No playbook fields filled in yet'],
};

function defaultPlaybook() {
  const c = (id, code, name, def) => ({ id, code, name, status: 'candidate', def });
  return {
    htf: [
      c('htf_fa', 'FA', 'Failed Auction', 'Price attempts to auction beyond a meaningful reference, fails to sustain acceptance, and reverses through that reference.'),
      c('htf_vre', 'VRE', 'Value Re-entry', 'Price reestablishes acceptance inside a prior value area after trading outside it, creating a possible rotation through that value area. Re-entry does not by itself imply a full value-area traverse: acceptance must be defined, with explicit invalidation and objectives.'),
      c('htf_ic', 'IC', 'Initiative Continuation', 'Price establishes acceptance outside a balance area and continues in a directional auction / price-discovery phase.'),
    ],
    trig: [
      c('trg_zps', 'ZPS', 'Zero Print Shove', 'Candidate definition, needs exact specification: a predefined aggressive directional push / zero-print signature and entry response.'),
      c('trg_ar', 'AR', 'Absorption Reversal', 'Candidate definition, needs exact specification: opposing aggressive market orders are absorbed, followed by a predefined directional response.'),
      c('trg_tc', 'TC', 'Trapped Counterparty', 'Candidate definition, needs exact specification: aggressive participants fail to get continuation, then directional order flow confirms their vulnerability.'),
    ],
    loc: ['Prior-day VAH', 'Prior-day VAL', 'Prior-day POC', 'Prior-day HVN', 'LVN', 'Globex VAH', 'Globex VAL', 'Failed-breakout reference'],
    pairs: [],
    deleted: {},
  };
}
function mergePlaybook(p) {
  const d = defaultPlaybook();
  if (!p || typeof p !== 'object') return d;
  const o = Object.assign({}, p);
  for (const k of ['htf', 'trig', 'loc', 'pairs']) if (!Array.isArray(o[k])) o[k] = d[k];
  if (!o.deleted || typeof o.deleted !== 'object') o.deleted = {};
  return o;
}
const pbLib = () => S.settings.playbook || (S.settings.playbook = defaultPlaybook());
const pbItem = (kind, id) => (pbLib()[kind] || []).find(x => x.id === id) || null;
/* live item, or a read-only stand-in for one that was deleted from the library */
function pbRef(kind, id) {
  if (!id) return null;
  const x = pbItem(kind, id); if (x) return x;
  const d = (pbLib().deleted || {})[id];
  return d ? { id, code: d.code, name: d.name, status: 'deleted' } : { id, code: '?', name: 'Unknown', status: 'deleted' };
}
const pbTrigIds = p => !p ? [] : Array.isArray(p.trigs) ? p.trigs : p.trig ? [p.trig] : [];
const pbHas = t => { const p = t.pb; return !!p && (['state', 'htf', 'loc', 'g1', 'g2', 'g3', 'pre', 'thesis'].some(k => p[k]) || pbTrigIds(p).length > 0); };
const pbCode = x => x.status === 'deleted' ? x.code + ' (deleted)' : x.code;

function pbLabel(t) {
  const p = t.pb || {}; const h = pbRef('htf', p.htf), gs = pbTrigIds(p).map(id => pbRef('trig', id));
  if (!h && !gs.length) return '';
  return `${h ? pbCode(h) : '—'} / ${gs.length ? gs.map(pbCode).join(' + ') : '—'}`;
}
function pbClassify(t) {
  if (!pbHas(t)) return { status: 'unreviewed', reasons: [], unknown: [] };
  const p = t.pb, h = pbRef('htf', p.htf), gs = pbTrigIds(p).map(id => pbRef('trig', id));
  const reasons = [], unknown = []; let research = false;
  if (!h) reasons.push('No HTF setup');
  else if (h.status === 'deprecated') reasons.push('Deprecated HTF setup');
  else if (h.status === 'deleted') reasons.push('Deleted HTF setup');
  else if (h.status === 'candidate') research = true;
  if (!gs.length) reasons.push('No execution trigger');
  if (gs.some(g => g.status === 'deprecated')) reasons.push('Deprecated trigger');
  if (gs.some(g => g.status === 'deleted')) reasons.push('Deleted trigger');
  if (gs.some(g => g.status === 'candidate')) research = true;
  // every tagged trigger must be an approved pair with the setup
  if (h && h.status === 'approved' && gs.length && gs.every(g => g.status === 'approved') && gs.some(g => !pbLib().pairs.includes(h.id + '|' + g.id))) reasons.push('Setup / trigger pair not approved');
  if (!p.loc) reasons.push('No trade location');
  const gate = (k, msg, label) => { if (p[k] === 'no') reasons.push(msg); else if (p[k] !== 'yes') unknown.push(label); };
  gate('g1', 'Gate 1 failed: market state', 'Gate 1');
  gate('g2', 'Gate 2 failed: location', 'Gate 2');
  gate('g3', 'Gate 3 failed: no confirming aggression', 'Gate 3');
  gate('pre', 'Plan not written before entry', 'Pre-entry evidence');
  if (!isNum(t.stop)) reasons.push('No invalidation (stop)');
  if (!isNum(t.target) && !(p.objective || '').trim()) reasons.push('No objective / target');
  const status = reasons.length ? 'offplaybook' : research ? 'research' : unknown.length ? 'undetermined' : 'compliant';
  return { status, reasons, unknown };
}
function pbPill(t) { const c = pbClassify(t); const [l, k, tip] = PB_CLASS[c.status]; return `<span class="pill ${k}" title="${esc(c.reasons.concat(c.unknown.map(u => u + ' unknown')).join(' · ') || tip)}">${l}</span>`; }

/* extra Edge Finder / Simulator dimensions */
function pbDims() {
  const nm = (kind, id) => { const x = pbRef(kind, id); return x ? `${pbCode(x)} · ${x.name}` : '(none)'; };
  return [
    { id: 'pb_status', name: 'Playbook status', fn: t => PB_CLASS[pbClassify(t).status][0] },
    { id: 'pb_htf', name: 'HTF setup', fn: t => nm('htf', t.pb?.htf) },
    { id: 'pb_trig', name: 'Execution trigger', fn: t => { const ids = pbTrigIds(t.pb); return ids.length ? ids.map(id => nm('trig', id)) : '(none)'; } },
    { id: 'pb_pair', name: 'Setup / trigger pair', fn: t => pbLabel(t) || '(none)' },
    { id: 'pb_loc', name: 'Trade location', fn: t => t.pb?.loc || '(none)' },
    { id: 'pb_state', name: 'Market state', fn: t => PB_STATES[t.pb?.state] || '(none)' },
  ];
}

/* ---------- trade form section ---------- */
function pbYN(key, label, hint) {
  const v = (F.pb || {})[key] || 'unknown';
  return `<div class="f"><label title="${esc(hint)}">${label}</label><div class="seg yn">${[['yes', 'Yes'], ['no', 'No'], ['unknown', 'Unknown']].map(([k, l]) => `<button class="${v === k ? 'on ' + k : ''}" data-pbset="${key}" data-val="${k}">${l}</button>`).join('')}</div></div>`;
}
function pbOptions(kind, cur) {
  const L = pbLib()[kind]; const grp = (st, label) => { const xs = L.filter(x => x.status === st || (st === 'deprecated' && x.id === cur && x.status === 'deprecated')); return xs.length ? `<optgroup label="${label}">${xs.map(x => `<option value="${esc(x.id)}" ${x.id === cur ? 'selected' : ''}>${esc(x.code)} · ${esc(x.name)}</option>`).join('')}</optgroup>` : ''; };
  return `<option value="">Unclassified</option>${grp('approved', 'Approved')}${grp('candidate', 'Research candidates (not approved)')}${L.some(x => x.status === 'deprecated' && x.id === cur) ? grp('deprecated', 'Deprecated') : ''}`;
}
function pbTrigChips(sel) {
  const L = pbLib().trig; const chip = x => `<button class="chip ${x.status === 'approved' ? 'cp' : ''} ${sel.includes(x.id) ? 'on' : ''}" data-pbtrig="${esc(x.id)}" title="${esc(x.def || '')}">${esc(pbCode(x))} · ${esc(x.name)}</button>`;
  const appr = L.filter(x => x.status === 'approved'), cand = L.filter(x => x.status === 'candidate');
  const old = sel.map(id => pbRef('trig', id)).filter(x => x.status === 'deprecated' || x.status === 'deleted');
  return `<div class="trigpick">${appr.length ? `<div class="chips"><span class="faint tp-l">Approved</span>${appr.map(chip).join('')}</div>` : ''}${cand.length ? `<div class="chips"><span class="faint tp-l">Research candidates</span>${cand.map(chip).join('')}</div>` : ''}${old.length ? `<div class="chips"><span class="faint tp-l">No longer in use</span>${old.map(chip).join('')}</div>` : ''}${!L.length && !old.length ? '<span class="muted">Add triggers in Settings → Playbook library.</span>' : ''}</div>`;
}
function pbFormSection() {
  const p = F.pb || {}; const lib = pbLib();
  return `<div class="sec-t">Playbook: pre-trade qualification</div>
    <div class="pbbox">
      <div class="pb-status" id="pb-status"></div>
      <div class="fgrid">
        <div class="f"><label>Market state (Gate 1)</label><select class="sel" data-pb="state"><option value="">—</option>${Object.entries(PB_STATES).map(([k, l]) => `<option value="${k}" ${p.state === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
        <div class="f"><label>HTF auction setup · why</label><select class="sel" data-pb="htf">${pbOptions('htf', p.htf)}</select></div>
        <div class="f"><label>Location · where (Gate 2)</label><select class="sel" data-pb="loc"><option value="">—</option>${[...new Set([...lib.loc, p.loc].filter(Boolean))].map(x => `<option ${p.loc === x ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select></div>
        <div class="f"><label>Level / zone</label><input class="inp" data-pb="level" value="${esc(p.level || '')}" placeholder="e.g. 5812.25–5814"></div>
        <div class="f span4"><label>Execution triggers · when (Gate 3) <span class="faint" style="text-transform:none;letter-spacing:0">pick every one that printed</span></label>${pbTrigChips(pbTrigIds(p))}</div>
        <div class="f span4"><label>Objective / target reference</label><input class="inp" data-pb="objective" value="${esc(p.objective || '')}" placeholder="e.g. prior-day POC 5838"></div>
        <div class="f span2"><label>Auction thesis (written before entry)</label><textarea class="inp" data-pb="thesis" rows="2" placeholder="Why the opportunity exists, before the trigger">${esc(p.thesis || '')}</textarea></div>
        <div class="f span2"><label>Trigger evidence (what actually printed)</label><textarea class="inp" data-pb="evidence" rows="2" placeholder="Timing, big trades, delta, DOM, footprint">${esc(p.evidence || '')}</textarea></div>
      </div>
      <div class="fgrid">
        ${pbYN('g1', 'Gate 1 pass · market state', 'Market state confirmed by your defined criteria')}
        ${pbYN('g2', 'Gate 2 pass · location', 'Price at a prequalified reference aligned with the state and thesis')}
        ${pbYN('g3', 'Gate 3 pass · aggression', 'The approved trigger actually printed')}
        ${pbYN('pre', 'Evidence captured before entry?', 'Thesis, location, invalidation and target were written before you clicked')}
      </div>
      <p class="hint">Answer from what you had <b>before</b> entry. If you don't know, leave it Unknown. Stop and target come from the Trade section above.</p>
    </div>`;
}
function pbUpdateStatus() {
  const el = $('#pb-status'); if (!el || !F) return;
  const c = pbClassify(F); const [l, k, tip] = PB_CLASS[c.status]; const lab = pbLabel(F);
  el.innerHTML = `<span class="pill ${k}">${l}</span>${lab ? `<b class="mono">${esc(lab)}</b>` : ''}<span class="hint">${c.reasons.length ? esc(c.reasons.join(' · ')) : c.status === 'research' ? 'Research candidate: logged, but cannot count as a playbook trade until approved.' : c.unknown.length ? esc('Unknown: ' + c.unknown.join(', ')) : esc(tip)}</span>`;
}

/* ---------- settings panel ---------- */
function pbLibList(kind, title, blurb) {
  const L = pbLib()[kind];
  return `<div class="stack" style="gap:10px"><div><span class="lbl">${title}</span><p class="hint" style="margin:4px 0 0">${blurb}</p></div>
    ${L.map((x, n) => `<div class="pbitem ${x.status}">
      <div class="ed-row"><input class="inp mono" style="max-width:84px" data-pblib="${kind}:${n}:code" value="${esc(x.code)}" aria-label="Code"><input class="inp" data-pblib="${kind}:${n}:name" value="${esc(x.name)}" aria-label="Name">
      <select class="sel" data-pblib="${kind}:${n}:status" aria-label="Status">${Object.entries(PB_STATUS).map(([k, l]) => `<option value="${k}" ${x.status === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
      <textarea class="inp" rows="2" data-pblib="${kind}:${n}:def" placeholder="Exact definition: what must be observed">${esc(x.def || '')}</textarea>
      ${x.status === 'deprecated' ? pbDeleteRow(kind, x) : ''}</div>`).join('')}
    <div class="row"><input class="inp mono" id="pbnew-${kind}-code" placeholder="Code" style="width:84px"><input class="inp" id="pbnew-${kind}-name" placeholder="Name" style="flex:1;min-width:140px"><button class="btn sm" data-pbadd="${kind}">Add as candidate</button></div></div>`;
}
function pbUsage(kind, id) { return S.trades.filter(t => kind === 'htf' ? t.pb?.htf === id : pbTrigIds(t.pb).includes(id)).length; }
function pbDeleteRow(kind, x) {
  if (S.sub.pbdel === kind + ':' + x.id) {
    const n = pbUsage(kind, x.id);
    return `<div class="confirm">Delete ${esc(x.code)} for good?${n ? ` ${n} trade${n > 1 ? 's are' : ' is'} tagged with it. They keep the label, marked "(deleted)", and stay off-playbook.` : ' No trades use it.'} <button class="btn sm danger" data-pbdelyes="${kind}:${esc(x.id)}">Delete</button><button class="btn sm" data-act="pb-del-no">Keep</button></div>`;
  }
  return `<div><button class="btn sm danger" data-pbdel="${kind}:${esc(x.id)}">Delete</button></div>`;
}
function pbDelete(kind, id) {
  const lib = pbLib(); const x = pbItem(kind, id); if (!x) return;
  lib.deleted = lib.deleted || {}; lib.deleted[id] = { code: x.code, name: x.name, kind };
  lib[kind] = lib[kind].filter(y => y.id !== id);
  lib.pairs = lib.pairs.filter(k => !k.split('|').includes(id));
}
function pbSettingsPanel() {
  const lib = pbLib(); const H = lib.htf.filter(x => x.status !== 'deprecated'), T = lib.trig.filter(x => x.status !== 'deprecated');
  return `<div class="panel stack"><h2>Playbook library <small>HTF setups (why) · locations (where) · execution triggers (when)</small></h2>
    <p class="hint" style="margin:0;max-width:90ch">To remove one you no longer use, set it to <b>Deprecated</b> first; a Delete button then appears. New entries start as <b>research candidates</b>. Only <b>approved</b> setups and triggers, in an <b>approved pair</b>, can make a trade count as a playbook trade. Candidates stay in this research backlog and are never treated as validated.</p>
    <div class="grid g2">${pbLibList('htf', 'HTF auction setups', 'The contextual opportunity. It should still make sense if the trigger disappeared.')}${pbLibList('trig', 'Execution triggers', 'The order-flow behavior required to enter. A trigger alone never authorizes a trade.')}</div>
    <div class="grid g2">
      <div class="stack" style="gap:8px"><span class="lbl">Trade locations</span>
        <div class="ed-list">${lib.loc.map((x, n) => `<div class="ed-row"><input class="inp" data-pbloc="${n}" value="${esc(x)}"><button class="btn sm ghost" data-pbdelloc="${n}">Remove</button></div>`).join('')}</div>
        <div class="row"><input class="inp" id="pbnew-loc" placeholder="New location" style="flex:1"><button class="btn sm" data-act="pb-add-loc">Add</button></div></div>
      <div class="stack" style="gap:8px"><span class="lbl">Approved pairings</span><p class="hint" style="margin:0">Tick the setup × trigger combinations you allow. Nothing is allowed by default.</p>
        ${H.length && T.length ? `<div class="tbl-wrap"><table class="pairs"><thead><tr><th></th>${T.map(g => `<th title="${esc(g.name)}" style="text-align:center">${esc(g.code)}</th>`).join('')}</tr></thead><tbody>${H.map(h => `<tr><th style="position:static;text-transform:none;letter-spacing:0;color:var(--fg)" title="${esc(h.name)}">${esc(h.code)}</th>${T.map(g => { const k = h.id + '|' + g.id; return `<td style="text-align:center"><input type="checkbox" data-pbpair="${esc(k)}" ${lib.pairs.includes(k) ? 'checked' : ''} aria-label="Allow ${esc(h.code)} with ${esc(g.code)}"></td>`; }).join('')}</tr>`).join('')}</tbody></table></div>` : '<p class="muted">Add setups and triggers first.</p>'}
      </div></div></div>`;
}

/* ---------- Playbook analytics view ---------- */
function medianR(list) { const r = list.map(t => t._.r).filter(isNum).sort((a, b) => a - b); if (!r.length) return null; const m = r.length >> 1; return r.length % 2 ? r[m] : (r[m - 1] + r[m]) / 2; }
const SMALL_N = 20;
function pbGroupTable(L, fn, head, order) {
  const g = groupBy(L, fn); let keys = [...g.keys()]; if (order) keys = order.filter(k => g.has(k)).concat(keys.filter(k => !order.includes(k)));
  if (!keys.length) return '<p class="muted">No data.</p>';
  return `<div class="tbl-wrap"><table><thead><tr><th>${head}</th><th class="r">Trades</th><th class="r">Win %</th><th class="r">Exp. (R)</th><th class="r">Median R</th><th class="r">Total R</th><th class="r">PF</th><th class="r">Max DD</th></tr></thead><tbody>${keys.map(k => { const ts = g.get(k); const m = metrics(ts); return `<tr><td style="white-space:normal"><b>${esc(k)}</b>${m.n < SMALL_N ? ' <span class="pill" title="Fewer than 20 trades: too few to judge">small sample</span>' : ''}</td><td class="r num">${m.n}</td><td class="r num">${pct(m.wr, 0)}</td><td class="r num ${cls(m.expR)}">${fmtR(m.expR)}</td><td class="r num">${fmtR(medianR(ts))}</td><td class="r num ${cls(m.totalR)}">${fmtR(m.totalR)}</td><td class="r num">${m.pf === Infinity ? '∞' : f2(m.pf)}</td><td class="r num">${fmtR(m.rdd)}</td></tr>`; }).join('')}</tbody></table></div>`;
}
VIEWS.playbook = {
  html() {
    const L = closedScoped(); const all = scoped();
    if (!L.length) return noData();
    const C = L.map(t => [t, pbClassify(t)]);
    const by = s => C.filter(x => x[1].status === s).map(x => x[0]);
    const classified = C.filter(x => x[1].status !== 'unreviewed');
    const ok = by('compliant'), off = by('offplaybook');
    const decided = ok.length + off.length;
    const mo = metrics(ok), mf = metrics(off);
    const rc = new Map(); for (const [t, c] of C) for (const r of c.reasons) { if (!rc.has(r)) rc.set(r, []); rc.get(r).push(t); }
    const reasons = [...rc.entries()].sort((a, b) => b[1].length - a[1].length);
    const unrev = all.filter(t => !pbHas(t)).length;
    const statusName = t => PB_CLASS[pbClassify(t).status][0];
    const nm = (kind, id) => { const x = pbRef(kind, id); return x ? `${x.code} · ${x.name}${x.status !== 'approved' ? ' (' + (PB_STATUS[x.status] || 'deleted').toLowerCase() + ')' : ''}` : 'Unclassified'; };
    return `<div class="kpis" style="grid-template-columns:repeat(4,minmax(0,1fr))">
        ${kpi('Playbook compliance', decided ? pct(ok.length / decided, 0) : '—', `${ok.length} playbook · ${off.length} off-playbook`, decided ? (ok.length / decided >= .9 ? 'pos' : ok.length / decided < .7 ? 'neg' : '') : '')}
        ${kpi('Playbook trades', fmtR(mo.expR), `expectancy · ${mo.n} trades${mo.n && mo.n < SMALL_N ? ' (small sample)' : ''}`, cls(mo.expR))}
        ${kpi('Off-playbook trades', fmtR(mf.expR), `expectancy · ${mf.n} trades · ${fmtR(mf.totalR)} total`, cls(mf.expR))}
        ${kpi('Needs review', unrev, 'trades with no playbook fields yet')}
      </div>
      ${unrev ? `<div class="banner"><span><b>${unrev}</b> trades in this range have no playbook classification. Older trades stay <b>Not classified</b>: only fill them in where your records from the time support it.</span><button class="btn sm" data-act="pb-review-queue">Open review queue</button></div>` : ''}
      <div class="grid g2">
        <div class="panel"><h2>Results by playbook status <small>process, not P&L, decides the status</small></h2>${pbGroupTable(L, statusName, 'Status', Object.values(PB_CLASS).map(x => x[0]))}</div>
        <div class="panel"><h2>Most common rule breaks</h2>${reasons.length ? `<table><thead><tr><th>Reason</th><th class="r">Trades</th><th class="r">Share</th><th class="r">Exp. (R)</th></tr></thead><tbody>${reasons.map(([r, ts]) => { const m = metrics(ts); return `<tr><td style="white-space:normal">${esc(r)}</td><td class="r num">${ts.length}</td><td class="r num">${pct(ts.length / (classified.length || 1), 0)}</td><td class="r num ${cls(m.expR)}">${fmtR(m.expR)}</td></tr>`; }).join('')}</tbody></table>` : '<p class="muted">No rule breaks among classified trades.</p>'}</div>
      </div>
      <div class="grid g2">
        <div class="panel"><h2>By HTF setup</h2>${pbGroupTable(L.filter(pbHas), t => nm('htf', t.pb.htf), 'HTF setup')}</div>
        <div class="panel"><h2>By execution trigger <small>a trade with two triggers counts under both</small></h2>${pbGroupTable(L.filter(pbHas), t => { const ids = pbTrigIds(t.pb); return ids.length ? ids.map(id => nm('trig', id)) : 'Unclassified'; }, 'Trigger')}</div>
      </div>
      <div class="grid g2">
        <div class="panel"><h2>By setup / trigger pair</h2>${pbGroupTable(L.filter(t => pbLabel(t)), t => { const h = pbItem('htf', t.pb.htf), ids = pbTrigIds(t.pb); return pbLabel(t) + (h && ids.length && ids.every(id => pbLib().pairs.includes(h.id + '|' + id)) ? ' (approved)' : ''); }, 'Pair')}</div>
        <div class="panel"><h2>By market state</h2>${pbGroupTable(L.filter(t => t.pb?.state), t => PB_STATES[t.pb.state], 'Market state', Object.values(PB_STATES))}</div>
      </div>
      <p class="hint">Groups under 20 trades are marked small sample. A pattern in a small sample isn't evidence of an edge. Status uses your rules as they stand now in Settings → Playbook library.</p>`;
  }
};
