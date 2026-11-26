/* ===== Clip cutter (desktop only) =====
   Open a session recording (or an attached clip), mark In / Out, and cut exact clips straight onto the trade.
   The recording itself is never copied into the journal; only the cut clips are saved to the clips folder.
   Keys: Space play/pause · I set in · O set out · ← → 1s (Shift 5s) · , . one frame · P preview selection · Enter add clip · Esc close */
'use strict';
const CLIP_OK = !!(typeof DESK !== 'undefined' && DESK && DESK.clip);
let CL = null;
const clipFmt = s => { if (!isFinite(s)) return '0:00.0'; const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = (s % 60).toFixed(1).padStart(4, '0'); return (h ? h + ':' + pad(m) : m) + ':' + x; };
const clipV = () => CL && $('#cl-video');
let clipUrl = s => s.token ? 'journal-media://src/' + encodeURIComponent(s.token) : 'journal-media://m/' + encodeURIComponent(s.file);
if (CLIP_OK) DESK.clip.onProgress((job, p) => { if (CL && CL.job === job) { const el = $('#cl-prog'); if (el) el.textContent = `Cutting… ${Math.round(p * 100)}%`; } });

/* src: { token, name } for a recording, or { file, name } for a clip already attached (trim mode with idx) */
function openClipper(src, opts = {}) {
  if (!CLIP_OK || !F) return;
  CL = { src, name: src.name || 'recording', url: clipUrl(src), dur: 0, in: null, out: null, clips: [], busy: false, trim: opts.trim ?? null, preview: false, remuxed: false, job: 0, path: opts.path || '' };
  const box = document.createElement('div'); box.className = 'clipper'; box.id = 'clipper';
  box.innerHTML = `<div class="cl-wrap" role="dialog" aria-label="Cut clips">
    <div class="mhead"><h3>${CL.trim != null ? 'Trim clip' : 'Cut clips from'} <span class="muted" style="font-weight:600">${esc(CL.name)}</span></h3><button class="btn ghost" data-cl="close">Done</button></div>
    <div class="cl-body">
      <div class="cl-stage"><video id="cl-video" src="${esc(CL.url)}" preload="auto" playsinline></video><div class="cl-msg" id="cl-msg" hidden></div></div>
      <div class="cl-bar" id="cl-bar"><div class="cl-sel" id="cl-sel"></div><div class="cl-head" id="cl-head"></div><div id="cl-marks"></div></div>
      <div class="row between">
        <div class="row" style="gap:6px">
          <button class="btn sm" data-cl="play" id="cl-play" title="Space">▶ Play</button>
          <button class="btn sm" data-cl="seek" data-v="-5" title="Shift+←">−5s</button><button class="btn sm" data-cl="seek" data-v="-1" title="←">−1s</button>
          <button class="btn sm" data-cl="frame" data-v="-1" title=",">‹ frame</button><button class="btn sm" data-cl="frame" data-v="1" title=".">frame ›</button>
          <button class="btn sm" data-cl="seek" data-v="1" title="→">+1s</button><button class="btn sm" data-cl="seek" data-v="5" title="Shift+→">+5s</button>
          <span class="num" id="cl-time" style="min-width:150px">0:00.0 / 0:00.0</span>
        </div>
        <div class="seg" id="cl-speed">${[0.5, 1, 2, 4, 8].map(r => `<button class="${r === 1 ? 'on' : ''}" data-cl="rate" data-v="${r}">${r}×</button>`).join('')}</div>
      </div>
      <div class="row between cl-marks-row">
        <div class="row" style="gap:6px">
          <button class="btn" data-cl="in" title="I">[ Set start</button><b class="num" id="cl-in">—</b>
          <button class="btn" data-cl="out" title="O">Set end ]</button><b class="num" id="cl-out">—</b>
          <span class="hint" id="cl-len"></span>
          <button class="btn sm ghost" data-cl="preview" title="P">Preview selection</button>
        </div>
        <div class="row" style="gap:6px">
          ${CL.trim != null ? '' : `<input class="inp" id="cl-name" placeholder="Clip name (optional)" style="width:180px">`}
          <button class="btn pri" data-cl="cut" id="cl-cut" title="Enter" disabled>${CL.trim != null ? 'Save trimmed clip' : 'Add clip to trade'}</button>
        </div>
      </div>
      <div class="hint" id="cl-prog"></div>
      <div id="cl-list"></div>
      <p class="hint" style="margin:0">Space play/pause · I start · O end · ← → 1s (Shift 5s) · , . one frame · P preview · Enter ${CL.trim != null ? 'save' : 'add clip'} · Esc done. ${CL.trim != null ? 'The original clip is replaced when you save the trade; your backup keeps a copy.' : 'Cut as many clips as you like from one recording. The recording itself is not copied into the journal.'}${opts.wholeFile ? ' <button class="btn sm ghost" data-cl="whole">Add the whole file instead</button>' : ''}</p>
    </div></div>`;
  document.body.appendChild(box);
  const v = clipV();
  v.addEventListener('loadedmetadata', () => { CL.dur = v.duration; if (CL.trim != null) { CL.in = 0; CL.out = v.duration; } clipPaint(); });
  v.addEventListener('timeupdate', () => { if (CL && CL.preview && CL.out != null && v.currentTime >= CL.out) { v.pause(); CL.preview = false; } clipPaint(); });
  v.addEventListener('play', clipPaint); v.addEventListener('pause', clipPaint);
  v.addEventListener('error', () => clipCantPlay());
  const bar = $('#cl-bar'); let drag = false;
  const at = ev => { const r = bar.getBoundingClientRect(); return Math.max(0, Math.min(1, (ev.clientX - r.left) / r.width)) * (CL.dur || 0); };
  bar.addEventListener('pointerdown', ev => { drag = true; bar.setPointerCapture(ev.pointerId); v.currentTime = at(ev); });
  bar.addEventListener('pointermove', ev => { if (drag) v.currentTime = at(ev); });
  bar.addEventListener('pointerup', () => { drag = false; });
  clipPaint();
}
async function clipCantPlay() {
  if (!CL) return; const msg = $('#cl-msg');
  if (CL.remuxed || !CL.src.token && !CL.src.file) { msg.hidden = false; msg.textContent = "This video format can't be previewed. In OBS, use File → Remux Recordings to make an .mp4, then open that."; return; }
  msg.hidden = false; msg.textContent = 'Preparing this recording for preview… (one-time, no quality loss)';
  try { const r = await DESK.clip.remux(CL.src); if (!CL) return; CL.remuxed = true; CL.src = { token: r.token, name: CL.name }; msg.hidden = true; clipV().src = clipUrl(CL.src); }
  catch (e) { msg.textContent = "This video can't be previewed: " + (e.message || e); }
}
function clipPaint() {
  if (!CL) return; const v = clipV(); if (!v) return; const D = CL.dur || 0; const pc = x => D ? (x / D * 100) + '%' : '0%';
  $('#cl-time').textContent = `${clipFmt(v.currentTime)} / ${clipFmt(D)}`;
  $('#cl-play').textContent = v.paused ? '▶ Play' : '❚❚ Pause';
  $('#cl-head').style.left = pc(v.currentTime);
  $('#cl-in').textContent = CL.in == null ? '—' : clipFmt(CL.in); $('#cl-out').textContent = CL.out == null ? '—' : clipFmt(CL.out);
  const sel = $('#cl-sel'); const ok = CL.in != null && CL.out != null && CL.out > CL.in;
  sel.hidden = CL.in == null && CL.out == null;
  const a = CL.in ?? 0, b = CL.out ?? D; sel.style.left = pc(a); sel.style.width = D ? ((Math.max(0, b - a)) / D * 100) + '%' : '0';
  sel.classList.toggle('bad', CL.in != null && CL.out != null && CL.out <= CL.in);
  $('#cl-len').textContent = ok ? `${clipFmt(CL.out - CL.in)} selected` : CL.in != null && CL.out != null ? 'End must be after start' : '';
  $('#cl-cut').disabled = !ok || CL.busy;
  $('#cl-marks').innerHTML = CL.clips.map(c => `<div class="cl-done" style="left:${pc(c.in)};width:${D ? (c.out - c.in) / D * 100 : 0}%"></div>`).join('');
  $('#cl-list').innerHTML = CL.clips.length ? `<div class="row" style="gap:6px"><span class="lbl">Added to this trade</span>${CL.clips.map(c => `<span class="chip on">${esc(c.name || 'Clip')} · ${clipFmt(c.out - c.in)}</span>`).join('')}</div>` : '';
}
function clipSeek(t) { const v = clipV(); v.currentTime = Math.max(0, Math.min(CL.dur || 0, t)); CL.preview = false; }
async function clipCut() {
  if (!CL || CL.busy || !(CL.in != null && CL.out > CL.in)) return;
  CL.busy = true; CL.job++; const job = CL.job; clipPaint(); clipV().pause();
  const prog = $('#cl-prog'); prog.textContent = 'Cutting… 0%';
  try {
    const r = await DESK.clip.cut({ ...CL.src, start: CL.in, end: CL.out, job });
    if (!F) return;
    const nm = ($('#cl-name')?.value || '').trim();
    if (CL.trim != null) {
      const sh = F.shots[CL.trim]; if (sh) { sh.file = r.file; sh.kind = 'video'; delete sh.id; delete sh.data; }
      F._added.push(r.file); toast('Clip trimmed'); closeClipper(); return;
    }
    const name = nm || `${CL.name.replace(/\.[^.]+$/, '')} ${clipFmt(CL.in)}–${clipFmt(CL.out)}`;
    F.shots.push({ file: r.file, kind: 'video', name }); F._added.push(r.file);
    CL.clips.push({ in: CL.in, out: CL.out, name }); CL.in = CL.out; CL.out = null;
    if ($('#cl-name')) $('#cl-name').value = '';
    prog.textContent = `Added "${name}" (${(r.size / 1048576).toFixed(1)} MB). Mark the next one or press Done.`;
    drawFormKeepScroll();
  } catch (e) { prog.textContent = 'Could not cut: ' + (e.message || e); }
  finally { if (CL) { CL.busy = false; clipPaint(); } }
}
function closeClipper() { const b = $('#clipper'); if (b) { const v = b.querySelector('video'); if (v) { v.pause(); v.removeAttribute('src'); v.load(); } b.remove(); } CL = null; if (F) drawFormKeepScroll(); }

document.addEventListener('click', async e => {
  const el = e.target.closest('[data-cl],[data-trimshot],[data-act="clip-pick"]'); if (!el || !CLIP_OK) return;
  if (el.dataset.act === 'clip-pick') { try { const s = await DESK.clip.pick(); if (s) openClipper(s); } catch (err) { toast('Could not open: ' + (err.message || err)); } return; }
  if (el.dataset.trimshot != null) { const i = +el.dataset.trimshot; const sh = F && F.shots[i]; if (sh && sh.file) openClipper({ file: sh.file, name: sh.name || 'clip' }, { trim: i }); return; }
  if (!CL) return; const v = clipV(); const d = el.dataset;
  switch (d.cl) {
    case 'close': return closeClipper();
    case 'play': CL.preview = false; return v.paused ? v.play() : v.pause();
    case 'seek': return clipSeek(v.currentTime + +d.v);
    case 'frame': v.pause(); return clipSeek(v.currentTime + +d.v / 30);
    case 'rate': v.playbackRate = +d.v; $$('#cl-speed button').forEach(b => b.classList.toggle('on', b === el)); return;
    case 'in': CL.in = v.currentTime; return clipPaint();
    case 'out': CL.out = v.currentTime; return clipPaint();
    case 'preview': if (CL.in == null || CL.out == null || CL.out <= CL.in) return toast('Set a start and an end first'); v.currentTime = CL.in; CL.preview = true; return v.play();
    case 'cut': return clipCut();
    case 'whole': { const p = CL.path; closeClipper(); try { const r = await DESK.addMedia({ path: p }); F.shots.push({ file: r.file, kind: 'video', name: p.split(/[\\/]/).pop() }); F._added.push(r.file); drawFormKeepScroll(); } catch (err) { toast('Could not add file: ' + (err.message || err)); } return; }
  }
});
// Capture phase so the trade form's own Escape/shortcuts don't fire underneath the cutter.
window.addEventListener('keydown', e => {
  if (!CL) return; const t = e.target; if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA') && e.key !== 'Escape' && e.key !== 'Enter') return;
  const v = clipV(); const k = e.key; let hit = true;
  if (k === ' ') { CL.preview = false; v.paused ? v.play() : v.pause(); }
  else if (k === 'i' || k === 'I') { CL.in = v.currentTime; clipPaint(); }
  else if (k === 'o' || k === 'O') { CL.out = v.currentTime; clipPaint(); }
  else if (k === 'ArrowLeft') clipSeek(v.currentTime - (e.shiftKey ? 5 : 1));
  else if (k === 'ArrowRight') clipSeek(v.currentTime + (e.shiftKey ? 5 : 1));
  else if (k === ',') { v.pause(); clipSeek(v.currentTime - 1 / 30); }
  else if (k === '.') { v.pause(); clipSeek(v.currentTime + 1 / 30); }
  else if (k === 'p' || k === 'P') { if (CL.in != null && CL.out > CL.in) { v.currentTime = CL.in; CL.preview = true; v.play(); } }
  else if (k === 'Enter') clipCut();
  else if (k === 'Escape') closeClipper();
  else hit = false;
  if (hit) { e.preventDefault(); e.stopImmediatePropagation(); }
}, true);
