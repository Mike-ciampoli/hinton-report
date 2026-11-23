/* Hinton Water Disinfection Report: the app.
   PWD rules are in rules.js, the printable PWD forms are in forms.js,
   saving is in store.js. */
'use strict';
(async () => {

/* ---------- small helpers ---------- */
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = v => (v === '' || v == null || isNaN(+v) ? null : +v);
const p2 = n => String(n).padStart(2, '0');
const isoLocal = d => d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()) + 'T' + p2(d.getHours()) + ':' + p2(d.getMinutes());
const today = () => isoLocal(new Date()).slice(0, 10);
const parseLocal = s => { if (!s) return null; const d = new Date(s.length === 10 ? s + 'T00:00' : s); return isNaN(d) ? null : d; };
const fmt = d => d.toLocaleString([], { weekday: 'short', month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit' });
const fmtDate = d => d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
const hm = ms => new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
const mdy = (s, withTime) => { const d = parseLocal(s); if (!d) return ''; let o = p2(d.getMonth() + 1) + '/' + p2(d.getDate()) + '/' + d.getFullYear(); if (withTime) o += ' ' + d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); return o; };
const mdyMs = (ms, withTime) => mdy(isoLocal(new Date(ms)), withTime);
const getP = (o, k) => k.split('.').reduce((a, b) => (a == null ? a : a[b]), o);
const setP = (o, k, v) => { const ks = k.split('.'), l = ks.pop(); ks.reduce((a, b) => (a[b] ??= {}), o)[l] = v; };
const uid = () => Math.random().toString(36).slice(2, 10);
const last = a => a[a.length - 1];
const DAY = 864e5;
const left = ms => { const s = Math.max(0, Math.round(ms / 1000)), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60; return h ? `${h} h ${p2(m)} m ${p2(x)} s` : `${m} m ${p2(x)} s`; };
const leftShort = ms => { const m = Math.max(0, Math.ceil(ms / 6e4)); return m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} m` : `${m} min`; };
const footer = () => `<footer class="foot"><p>${esc(RULES.footer[0])}</p><p>${esc(RULES.footer[1])}</p></footer>`;

/* ---------- data ---------- */
const blankState = () => ({ v: 2, jobs: [], settings: { recipients: RULES.recipients.slice(), tags: [] }, meta: { created: Date.now(), lastBackup: null, snoozed: null, firstData: null, alerted: {}, range: {} } });
const newCf = () => ({ reason: '', flush: [], ver: [], logs: {}, events: [], phase: '' });
const newRound = kind => ({ kind, method: null, c: {}, fix: {}, r: {}, t: {}, ferrules: [], res: {}, cf: newCf() });
const newJob = (street, from, to) => ({ id: uid(), created: Date.now(), street, from, to, f: {}, rounds: [newRound('initial')], labs: [], log: [], mail: { off: [], extra: [] } });

let S = await Store.get('state');
if (!S || !Array.isArray(S.jobs)) S = blankState();
fixup(S);
function fixup(s) {
  s.settings ??= {}; s.settings.recipients ??= RULES.recipients.slice(); s.settings.tags ??= [];
  s.meta ??= {}; s.meta.alerted ??= {}; s.meta.range ??= {};
  for (const j of s.jobs) {
    j.f ??= {}; j.rounds ??= [newRound('initial')]; j.labs ??= []; j.mail ??= { off: [], extra: [] }; j.mail.off ??= []; j.mail.extra ??= [];
    j.log ??= [];
    if (typeof j.notes === 'string') { if (j.notes.trim()) j.log.unshift({ id: uid(), t: j.created || Date.now(), ri: 0, stage: '', tags: [], text: j.notes }); delete j.notes; }
    j.rounds.forEach((r, i) => {
      r.c ??= {}; r.fix ??= {}; r.r ??= {}; r.t ??= {}; r.ferrules ??= []; r.res ??= {}; r.cf ??= newCf();
      const cf = r.cf; cf.flush ??= []; cf.ver ??= []; cf.logs ??= {}; cf.events ??= [];
      if (r.method === undefined) {   // data from version 1.0
        if (i === 0) r.method = (r.t.loaded || r.r.tablets || Object.keys(r.c).length) ? 'tablets' : null;
        else { r.res.fix ??= 'rechlor'; r.method = 'rsform'; }
      }
    });
  }
  s.v = 2;
}
let saveT = null;
function save() { clearTimeout(saveT); saveT = setTimeout(flush, 250); }
function flush() { clearTimeout(saveT); saveT = null; return Store.put('state', S).catch(() => toast('Could not save', 'This device is out of storage space. Make a backup now.', true)); }
addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && saveT) flush(); });
addEventListener('pagehide', () => { if (saveT) flush(); });
Store.persist();

/* ---------- rules applied to a job ---------- */
const cur = j => j.rounds.length - 1;
const isRs = ri => ri > 0;
const roundName = ri => (ri ? `Resample ${ri}` : 'Initial');
const isDis = (j, i) => i === 0 || j.rounds[i].res.fix === 'rechlor';
const disCount = (j, ri) => j.rounds.slice(0, ri + 1).filter((r, i) => isDis(j, i)).length;
function methodOf(j, ri) {
  const rd = j.rounds[ri];
  if (ri === 0) return rd.method || null;
  const f = rd.res.fix;
  if (f === 'rechlor') return rd.method || 'rsform';
  return f ? 'flush' : null;
}
const methodLabel = m => (m === 'flush' ? 'Flush only' : RULES.methods[m] || 'Not picked');
function prevLoaded(j, ri) { for (let i = ri - 1; i >= 0; i--) { const t = j.rounds[i].t.loaded; if (t) return mdy(t, true); } return ''; }
const usesCf = (j, ri) => methodOf(j, ri) === 'cf';

function cfPoints(rd) {
  return [{ id: 'inj', kind: 'inj', name: 'Injection point', loc: rd.cf.injLoc || '' },
    ...rd.cf.flush.map((p, i) => ({ id: p.id, kind: 'flush', name: `Flush point #${i + 1}`, loc: p.loc || '', rate: p.rate, dia: p.dia })),
    ...rd.cf.ver.map((p, i) => ({ id: p.id, kind: 'ver', name: `Verification point #${i + 1}`, loc: p.loc || '' }))];
}
function cfStatus(rd) {
  const cf = rd.cf, lo = num(cf.tmin), hi = num(cf.tmax), pts = cfPoints(rd), chk = pts.filter(p => p.kind !== 'inj');
  const inR = v => lo !== null && hi !== null && v >= lo && v <= hi;
  const per = {};
  for (const p of pts) {
    const all = (cf.logs[p.id] || []).filter(x => !x.void);
    const feed = all.filter(x => x.ph === 'feed'), hold = all.filter(x => x.ph === 'hold'), fl = all.filter(x => x.ph === 'flush'), l2 = feed.slice(-RULES.cf.stableReadings);
    per[p.id] = { all, n: all.length, stable: l2.length === RULES.cf.stableReadings && l2.every(x => inR(x.ppm)), lastFeed: last(feed), lastHold: last(hold), lastFlush: last(fl),
      inRange: feed.length ? inR(last(feed).ppm) : null,
      holdOk: hold.length ? last(hold).ppm >= RULES.cf.holdMin : null, flushOk: fl.length ? last(fl).ppm <= RULES.cf.flushMax : null };
  }
  const nStable = chk.filter(p => per[p.id].stable).length, flushPts = chk.filter(p => p.kind === 'flush');
  const nHold = chk.filter(p => per[p.id].holdOk === true).length, nFl = flushPts.filter(p => per[p.id].flushOk === true).length;
  const allStable = chk.length > 0 && nStable === chk.length, holdOk = chk.length > 0 && nHold === chk.length, flushOk = flushPts.length > 0 && nFl === flushPts.length;
  const phase = cf.phase || (rd.t.flushStart ? 'flush' : rd.t.holdStart ? 'hold' : 'feed');
  return { pts, chk, per, lo, hi, inR, phase, nStable, allStable, nHold, holdOk, nFl, flushPts, flushOk,
    stableText: chk.length ? `From the live log: ${nStable} of ${chk.length} points stable.` : 'Add flush and verification points in setup first.',
    holdText: chk.length ? `From the live log: ${nHold} of ${chk.length} points at 10 ppm or more after the hold.` : '',
    flushText: flushPts.length ? `From the live log: ${nFl} of ${flushPts.length} flush points at 0 ppm.` : '' };
}
function ctx(j, ri) {
  const rd = j.rounds[ri];
  const baseline = num(rd.r.srcTotal) ?? num(j.rounds[0].r.srcTotal);
  return { j, ri, rd, baseline, method: methodOf(j, ri), holdH: RULES.holdHours(num(rd.r.waterT), methodOf(j, ri)), prevLoaded: prevLoaded(j, ri), cfs: cfStatus(rd) };
}
const val = (c, k) => (k.startsWith('job.') ? getP(c.j, k.slice(4)) : getP(c.rd, k));
const path = (c, k) => (k.startsWith('job.') ? k.slice(4) : `rounds.${c.ri}.${k}`);
const fixKey = k => k.replace(/\./g, '_');
const txt = (x, c) => (typeof x === 'function' ? x(c) : x);
const vis = (c, it) => !it.show || it.show(c);
function itemState(c, it) {
  const v = val(c, it.k);
  if (it.t === 'yn') { if (!v) return ''; if (it.warnOn && v === it.warnOn) return 'warn'; if (it.good === null) return ''; return v === (it.good || 'Y') ? 'ok' : 'bad'; }
  if (it.t === 'num' && it.ok) { const n = num(v); return n === null ? '' : it.ok(n, c) ? 'ok' : 'bad'; }
  return '';
}
function groups(j, ri) {
  const rd = j.rounds[ri];
  if (ri === 0) return rd.method === 'cf' ? RULES.cfGroups : rd.method === 'tablets' ? RULES.tablets : [];
  const f = rd.res.fix, rest = f === 'reflush' || f === 'scour' ? RULES.reflush : f === 'rechlor' ? (rd.method === 'cf' ? RULES.cfGroups : rd.method === 'rsform' ? RULES.rechlor : []) : f === 'other' ? RULES.otherFix : [];
  return [RULES.resolution, ...rest];
}
const items = c => groups(c.j, c.ri).flatMap(g => g.items).filter(i => i.k && vis(c, i));
const timerIds = (j, ri) => groups(j, ri).flatMap(g => g.items).filter(i => i.t === 'timer').map(i => i.id);
function ferrState(f) { const n = num(f.ppm); return n === null ? '' : n >= RULES.ferruleMin ? 'ok' : 'bad'; }
function flags(j, ri) {
  const c = ctx(j, ri); let filled = 0, red = 0, needFix = 0; const all = items(c).filter(i => i.t !== 'sel' && i.t !== 'auto');
  for (const it of all) {
    if (val(c, it.k)) filled++;
    if (itemState(c, it) === 'bad') { red++; if (!(c.rd.fix[fixKey(it.k)] || '').trim()) needFix++; }
  }
  if (groups(j, ri).some(g => g.items.some(i => i.t === 'ferrules'))) for (const f of c.rd.ferrules) if (ferrState(f) === 'bad') red++;
  return { filled, total: all.length, red, needFix };
}
function timer(j, ri, id) {
  const c = ctx(j, ri), d = RULES.timers[id];
  const hours = typeof d.hours === 'function' ? d.hours(c) : d.hours;
  const name = typeof d.name === 'function' ? d.name(c) : d.name;
  const st = parseLocal(getP(c.rd, d.from));
  if (!st || !hours) return { id, name, hours, d, start: null };
  const end = new Date(st.getTime() + hours * 36e5);
  return { id, name, hours, d, start: st, end, left: end - Date.now(), key: `${j.id}|${ri}|${id}|${end.getTime()}` };
}
function labEval(j, row) {
  const b = ctx(j, row.ri).baseline, multi = disCount(j, row.ri) > 1; let fails = [], missing = 0;
  for (const p of RULES.lab) { const n = num(row[p.k]); if (n === null) { missing++; continue; } if (!p.ok(n, b, multi)) fails.push(p.name); }
  return { fails, missing, pass: fails.length ? false : missing ? null : true };
}
function roundResult(j, ri) {
  const rows = j.labs.filter(l => l.ri === ri); if (!rows.length) return undefined;
  const ev = rows.map(r => labEval(j, r));
  if (ev.some(e => e.pass === false)) return false;
  if (ev.every(e => e.pass === true)) return true;
  return null;
}
function status(j) {
  const ri = cur(j), rr = roundResult(j, ri), t = j.rounds[ri].t;
  if (rr === true) return ['Passed', 'ok'];
  if (rr === false) return ['Failed: fix needed', 'bad'];
  if (rr === null) return ['Waiting on lab', 'warn'];
  const sd = parseLocal(t.shutdown);
  if (sd) return Date.now() >= sd.getTime() + 16 * 36e5 ? ['Waiting on lab', 'warn'] : ['16-hr hold', 'prog'];
  if (t.flushStart) return ['Flushing', 'prog'];
  if (t.holdStart) return ['24-hr hold', 'prog'];
  if (t.loaded) return ['Disinfecting', 'prog'];
  return [ri ? 'Resolution' : 'Getting ready', ''];
}
function nextTimer(j) {
  const ri = cur(j); let best = null;
  for (const id of timerIds(j, ri)) { const t = timer(j, ri, id); if (t.start && t.left > 0 && (!best || t.left < best.left)) best = t; }
  return best;
}

/* ---------- routing (#/..., so the phone's back button works) ---------- */
let V = {};
function route() {
  const p = location.hash.replace(/^#\/?/, '').split('/').map(decodeURIComponent);
  V = { page: p[0] || 'home', id: p[1], sec: p[2] || 'steps', ri: p[3] != null && p[3] !== '' ? +p[3] : null };
  if (V.page === 'print') { V.kind = p[2]; }
  if ((V.page === 'job' || (V.page === 'print' && V.id !== 'range')) && !S.jobs.find(j => j.id === V.id)) V.page = 'home';
}
const go = h => { if (location.hash === h) render(); else location.hash = h; };
addEventListener('hashchange', () => { route(); scrollTo(0, 0); render(); });

/* ---------- pages ---------- */
const app = $('#app');
const job = () => S.jobs.find(j => j.id === V.id);

function backupBanner() {
  if (!S.jobs.length) return '';
  const base = Math.max(S.meta.lastBackup || 0, S.meta.snoozed || 0, S.meta.firstData || 0);
  if (Date.now() - base < 7 * DAY) return '';
  const msg = S.meta.lastBackup ? `Your last backup was ${Math.floor((Date.now() - S.meta.lastBackup) / DAY)} days ago.` : 'You haven’t made a backup yet.';
  return `<div class="banner warn"><p><b>Time to back up.</b> ${msg} Your data lives only on this device, so a backup file keeps it safe if the phone is lost or reset.</p><div class="acts"><button class="btn" data-act="backup">Back up now</button><button class="btn ghost" data-act="snooze">Remind me next week</button></div></div>`;
}
function runningBanner() {
  const rows = [];
  for (const j of S.jobs) { const ri = cur(j); for (const id of timerIds(j, ri)) { const t = timer(j, ri, id); if (t.start && t.left > 0) rows.push([t, j]); } }
  if (!rows.length) return '';
  rows.sort((a, b) => a[0].left - b[0].left);
  return `<div class="banner"><p><b>Timers running</b><br>${rows.map(([t, j]) => `<a href="#/job/${j.id}/steps">${esc(j.street)}</a>: ${esc(t.name)}, <span data-end="${t.end.getTime()}" data-short="1">${leftShort(t.left)}</span> left`).join('<br>')}</p></div>`;
}
function howto(full) {
  return `<section class="card howto"><h3>How to use this app</h3>
<ol>
<li><b>Add a street</b> for each new main, then fill in its <b>Job info</b>.</li>
<li>In <b>Steps</b>, pick the method: <b>Tablets</b> or <b>Continuous feed</b>. Work down the checklist. A wrong answer turns <b style="color:var(--bad)">red</b> and asks what was done to fix it.</li>
<li>Continuous feed has a <b>live log</b>: tap to add a chlorine reading at each point and the time is stamped for you.</li>
<li>Start the <b>timers</b> and tap <b>Add to calendar</b>, so your phone reminds you even with the app closed.</li>
<li>Use <b>Email</b> to request the sample, and <b>Print</b> for the PWD forms and logs.</li>
<li>Enter BLS results under <b>Lab results</b>. If a sample fails, start a <b>resolution round</b> and record the lab’s fix.</li>
<li>Everything saves on this device and works with no signal. <b>Back up</b> once a week.</li>
</ol>
${full ? `<h3 style="margin-top:14px">Put it on your home screen</h3><div class="inst">
<div><b>iPhone:</b> open the app’s link in Safari, tap the Share button, then <b>Add to Home Screen</b>.</div>
<div><b>Android:</b> open the link in Chrome, tap the ⋮ menu, then <b>Install app</b> (or Add to Home screen).</div>
<div><b>Windows:</b> open the link in Edge or Chrome and click the install icon at the right end of the address bar.</div></div>` : `<p class="small mut"><a href="#/help">Installing on your home screen and more help</a></p>`}
</section>`;
}
function home() {
  const js = S.jobs;
  const add = `<form class="add" id="addf"><h3>${js.length ? 'Add a street' : 'Add your first street'}</h3><input id="a-st" placeholder="Street name" aria-label="Street name" required autocomplete="off"><input id="a-from" placeholder="From (cross street)" aria-label="From" autocomplete="off"><input id="a-to" placeholder="To (cross street)" aria-label="To" autocomplete="off"><button class="btn">Add street</button></form>`;
  if (!js.length) return `<div class="top"><h2>Streets</h2></div>${howto(false)}${add}`;
  return `${backupBanner()}${runningBanner()}<div class="top"><h2>Streets <span class="mut" style="font-size:18px">${js.length}</span></h2><span class="mut">Tap a tab to open its folder</span></div>
<div id="idx">${js.map((j, i) => {
    const L = 22 + (i % 8) * 5.5, dark = L < 46, [s, c] = status(j), nt = nextTimer(j);
    return `<a class="tab" href="#/job/${j.id}/steps" style="background:hsl(${206 - (i % 8) * 2} 78% ${L}%);color:${dark ? '#fff' : '#06203a'}"><span><span class="nm">${esc(j.street)}</span><small>${esc([j.from, j.to].filter(Boolean).join(' to '))}${cur(j) ? ` · ${roundName(cur(j))}` : ''}</small>${nt ? `<small class="tm">${esc(nt.name)}: <span data-end="${nt.end.getTime()}" data-short="1">${leftShort(nt.left)}</span> left</small>` : ''}</span><span class="chip"><i class="${c}"></i>${s}</span></a>`;
  }).join('')}</div><div class="drawer"></div>${add}`;
}

/* --- steps --- */
function itemHtml(c, it) {
  if (!vis(c, it)) return '';
  if (it.t === 'note') return `<div class="note ${it.tone || ''}">${it.html}${it.fill ? fillRate(c.j) : ''}</div>`;
  if (it.t === 'calc') return calcHtml(c.j);
  if (it.t === 'timer') return timerHtml(c.j, c.ri, it.id);
  if (it.t === 'ferrules') return ferrHtml(c);
  if (it.t === 'cfpoints') return cfPointsHtml(c);
  if (it.t === 'cflive') return cfLiveHtml(c);
  const q = txt(it.q, c);
  if (it.t === 'auto') { const v = txt(it.v, c); return `<div class="it"><div class="q"><span class="dot"></span><div><b>${esc(q)}</b><small>Filled in automatically.</small></div></div><div class="auto">${esc(v || '—')}</div></div>`; }
  const v = val(c, it.k) ?? '', st = itemState(c, it), p = path(c, it.k), id = 'f-' + p.replace(/\./g, '-');
  let ctl;
  if (it.t === 'yn') ctl = `<div class="yn" role="group" aria-label="${esc(q)}">${['Y', 'N'].map(x => `<button data-yn="${p}" data-v="${x}" class="${v === x ? 'on' : ''} ${v === x && st === 'bad' ? 'no' : ''} ${v === x && st === 'warn' ? 'wn' : ''}" aria-pressed="${v === x}">${x === 'Y' ? 'Yes' : 'No'}</button>`).join('')}</div>`;
  else if (it.t === 'sel') ctl = `<div class="yn sel" role="group" aria-label="${esc(q)}">${it.opts.map(([x, l]) => `<button data-sel="${p}" data-v="${x}" class="${v === x ? 'on' : ''}" aria-pressed="${v === x}">${esc(l)}</button>`).join('')}</div>`;
  else if (it.t === 'num') ctl = `<div class="nw"><input id="${id}" data-k="${p}" type="number" step="any" inputmode="decimal" value="${esc(v)}" aria-label="${esc(q)}"><span>${it.u || ''}</span></div>`;
  else if (it.t === 'time') ctl = `<div class="tw"><input id="${id}" data-k="${p}" type="datetime-local" value="${esc(v)}" aria-label="${esc(q)}"><button class="btn ghost sm" data-now="${p}">Now</button></div>`;
  else if (it.t === 'date') ctl = `<input class="tx" id="${id}" data-k="${p}" type="date" value="${esc(v)}" aria-label="${esc(q)}">`;
  else ctl = `<input class="tx" id="${id}" data-k="${p}" ${it.t === 'tel' ? 'type="tel"' : ''} value="${esc(v)}" placeholder="${esc(it.ph || '')}" aria-label="${esc(q)}">`;
  let fix = '';
  if (st === 'bad') {
    const fk = `rounds.${c.ri}.fix.${fixKey(it.k)}`, fv = c.rd.fix[fixKey(it.k)] || '';
    fix = `<div class="fixbox ${fv.trim() ? 'done' : ''}"><label for="${'f-' + fk.replace(/\./g, '-')}">${fv.trim() ? 'Corrective action' : 'Corrective action needed: what was done to fix it?'}</label><textarea id="${'f-' + fk.replace(/\./g, '-')}" data-k="${fk}" placeholder="Required before asking for a sample">${esc(fv)}</textarea></div>`;
  }
  const hint = txt(it.hint, c);
  return `<div class="it ${st} ${it.t === 'sel' ? 'wide' : ''}"><div class="q"><span class="dot"></span><div><b>${esc(q)}</b>${it.flag ? '<span class="b flag">Flag item</span>' : ''}${hint ? `<small>${esc(hint)}</small>` : ''}${it.fp ? '<small class="fp">Field practice, not on the PWD form</small>' : ''}${st === 'bad' && it.t === 'num' ? `<small class="fix">Out of range: needs ${esc(it.okText || 'a passing value')}.</small>` : ''}</div></div>${ctl}${fix}</div>`;
}
function fillRate(j) { const D = num(j.f.dia); return D ? ` Max fill rate for a ${D}" main: <b>${Math.round(RULES.flush.gpmAt(D, 1)).toLocaleString()} gpm</b>.` : ''; }
function calcHtml(j) {
  const L = num(j.f.length), D = num(j.f.dia), F = RULES.flush;
  let out = '<div class="out"><div>Enter the length and diameter to see flush targets.</div></div>';
  if (L && D) {
    const gal = F.gallonsPerFt(D) * L, gpm = F.gpmAt(D, 3), mins = 3 * gal / gpm;
    out = `<div class="out"><div>1 pipe volume<strong>${Math.round(gal).toLocaleString()} gal</strong></div><div>3 pipe volumes<strong>${Math.round(gal * 3).toLocaleString()} gal</strong></div><div>Flow needed for 3 ft/s<strong>${Math.round(gpm).toLocaleString()} gpm</strong></div><div>3 volumes at 3 ft/s takes<strong>${mins < 10 ? mins.toFixed(1) : Math.round(mins)} min</strong></div><div>“2 min per 100 ft” rule<strong>${+(L / 100 * F.minutesPer100ft).toFixed(1)} min</strong></div></div>
<p class="sample">Gallons = 0.0408 × ${D}² × ${L.toLocaleString()} ft. Flow for 3 ft/s = 7.34 × ${D}².</p>`;
  }
  return `<div class="calc"><h4 style="margin:0 0 8px;font:700 19px 'Barlow Semi Condensed',sans-serif">Flush calculator</h4><div class="in"><label>Length (ft)<input data-k="f.length" id="c-len" type="number" inputmode="decimal" step="any" value="${esc(j.f.length ?? '')}"></label><label>Diameter (in)<input data-k="f.dia" id="c-dia" type="number" inputmode="decimal" step="any" value="${esc(j.f.dia ?? '')}"></label></div>${out}</div>`;
}
const FROM_LABEL = { 't.loaded': 'Main loaded', 't.shutdown': 'Shut down', 't.holdStart': 'Start of 24-hour hold' };
function timerHtml(j, ri, id) {
  const t = timer(j, ri, id), live = ri === cur(j);
  let cls = '', body, acts = '';
  if (!t.start) {
    if (id === 'interval') { if (!t.hours) return ''; body = '<div class="small mut">Starts when you add a reading in the live log.</div>'; }
    else body = `<div class="small mut">${t.d.start ? 'Tap Start when the pre-flush begins.' : `Starts from “${FROM_LABEL[t.d.from] || 'the time above'}”. Fill that in to start the countdown.`}</div>`;
    if (t.d.start && live) acts = `<button class="btn" data-tstart="${id}">Start ${t.hours < 1 ? Math.round(t.hours * 60) + ' min' : t.hours + ' hr'}</button>`;
  } else if (t.left > 0) {
    cls = 'run';
    body = `<div class="cd" data-end="${t.end.getTime()}">${left(t.left)}</div><div class="small mut">Done ${esc(fmt(t.end))}</div>`;
  } else {
    cls = 'done';
    body = `<div class="cd">Done ${esc(fmt(t.end))}</div><div class="small mut">${esc(t.d.doneMsg)}</div>`;
  }
  if (t.start && live) {
    if (t.left > 0 && id !== 'interval') acts += `<button class="btn" data-ics="${id}">Add to calendar</button>`;
    if (t.d.start) acts += `<button class="btn ghost sm" data-tclear="${id}">${t.left > 0 ? 'Cancel' : 'Clear'}</button>`;
  }
  const gc = t.start && live && t.left > 0 && id !== 'interval' ? `<a class="gc" href="${esc(gcalUrl(j, t))}" target="_blank" rel="noopener">Use Google Calendar instead</a>` : '';
  return `<div class="timer ${cls}"><div><h4>⏱ ${esc(t.name)}</h4>${body}</div><div><div class="acts">${acts}</div>${gc}</div></div>`;
}
function ferrHtml(c) {
  const fs = c.rd.ferrules, low = fs.map(f => num(f.ppm)).filter(n => n !== null);
  const min = low.length ? Math.min(...low) : null;
  return `<div class="it ${min === null ? '' : min >= RULES.ferruleMin ? 'ok' : 'bad'}" style="grid-template-columns:1fr"><div class="q"><span class="dot"></span><div><b>FREE chlorine measured at regular intervals at the ferrules</b><small>No location in the main under ${RULES.ferruleMin} ppm.</small>${min !== null ? `<span class="b ${min >= RULES.ferruleMin ? 'ok' : 'bad'}">Lowest reading: ${min} ppm${min >= RULES.ferruleMin ? '' : '. Keep feeding before the hold.'}</span>` : ''}</div></div>
<div>${fs.map((f, i) => `<div class="ferr"><input data-k="rounds.${c.ri}.ferrules.${i}.loc" id="fr-${c.ri}-${i}-l" value="${esc(f.loc)}" placeholder="Ferrule location" aria-label="Ferrule ${i + 1} location"><div class="nw" style="width:auto"><input data-k="rounds.${c.ri}.ferrules.${i}.ppm" id="fr-${c.ri}-${i}-p" type="number" step="any" inputmode="decimal" value="${esc(f.ppm)}" aria-label="Ferrule ${i + 1} ppm"><span>ppm</span></div>${ferrState(f) ? `<span class="b ${ferrState(f)}">${ferrState(f) === 'ok' ? 'OK' : 'Under 25'}</span>` : '<span></span>'}<button class="btn ghost sm" data-ferdel="${i}" aria-label="Remove ferrule ${i + 1}">✕</button></div>`).join('')}
<button class="btn ghost" data-feradd="1">+ Add ferrule reading</button></div></div>`;
}

/* --- continuous feed --- */
function cfPointsHtml(c) {
  const cf = c.rd.cf, base = `rounds.${c.ri}.cf`;
  const used = id => (cf.logs[id] || []).length > 0;
  const fl = cf.flush.map((p, i) => `<div class="ptrow"><b>Flush #${i + 1}</b><input data-k="${base}.flush.${i}.loc" id="pf-${i}-l" value="${esc(p.loc)}" placeholder="Location" aria-label="Flush point ${i + 1} location"><div class="nw"><input data-k="${base}.flush.${i}.dia" id="pf-${i}-d" type="number" step="any" inputmode="decimal" value="${esc(p.dia)}" aria-label="Flush point ${i + 1} diameter"><span>in</span></div><div class="nw"><input data-k="${base}.flush.${i}.rate" id="pf-${i}-r" type="number" step="any" inputmode="decimal" value="${esc(p.rate)}" aria-label="Flush point ${i + 1} total flush rate"><span>gpm</span></div>${used(p.id) ? '<span class="small mut">Has readings</span>' : `<button class="btn ghost sm" data-ptdel="flush|${i}" aria-label="Remove flush point ${i + 1}">✕</button>`}</div>`).join('');
  const vr = cf.ver.map((p, i) => `<div class="ptrow v"><b>Verif. #${i + 1}</b><input data-k="${base}.ver.${i}.loc" id="pv-${i}-l" value="${esc(p.loc)}" placeholder="Location / description" aria-label="Verification point ${i + 1} location">${used(p.id) ? '<span class="small mut">Has readings</span>' : `<button class="btn ghost sm" data-ptdel="ver|${i}" aria-label="Remove verification point ${i + 1}">✕</button>`}</div>`).join('');
  return `<div class="it" style="grid-template-columns:1fr"><div class="q"><span class="dot"></span><div><b>Flush points (up to ${RULES.cf.maxFlush}) and additional verification points (up to ${RULES.cf.maxVerify})</b><small>Each one gets its own live log and Chlorine Verification Log.</small></div></div>
<div>${fl}${cf.flush.length < RULES.cf.maxFlush ? '<button class="btn ghost sm" data-ptadd="flush">+ Flush point</button>' : ''}</div>
<div>${vr}${cf.ver.length < RULES.cf.maxVerify ? '<button class="btn ghost sm" data-ptadd="ver">+ Verification point</button>' : ''}</div></div>`;
}
const PH = { feed: 'Feeding', hold: 'After hold', flush: 'Final flush' };
const EV = { start: 'Start', change: 'Rate change', stop: 'Stop' };
function evWhat(rd, w) { if (w === 'inj') return 'Injection'; const i = rd.cf.flush.findIndex(p => p.id === w); return i < 0 ? 'Flush point' : `Flush #${i + 1}`; }
function cfLiveHtml(c) {
  const rd = c.rd, cf = rd.cf, s = c.cfs, live = c.ri === cur(c.j);
  let h = '';
  if (!s.chk.length) h += '<div class="note warn">Add the flush and verification points in setup above, so each gets a log.</div>';
  if (s.lo === null || s.hi === null) h += '<div class="note warn">Enter the target minimum and maximum above. Readings are judged against that range.</div>';
  else h += `<div class="note">Target range: <b>${s.lo} to ${s.hi} ppm</b>. A point turns green after ${RULES.cf.stableReadings} readings in a row inside it.</div>`;
  h += `<div class="phase" role="group" aria-label="Which stage new readings belong to"><span class="small mut">New readings are for:</span>${Object.entries(PH).map(([k, l]) => `<button class="${s.phase === k ? 'on' : ''}" data-phase="${k}" aria-pressed="${s.phase === k}">${l}</button>`).join('')}</div>`;
  if (s.phase === 'feed') h += s.allStable ? '<div class="banner ok"><p><b>OK to shut off injection.</b> Every flush and verification point had 2 readings in a row in range.</p></div>' : `<div class="banner"><p><b>Keep feeding.</b> ${s.nStable} of ${s.chk.length} points stable so far.</p></div>`;
  if (s.phase === 'hold') h += s.holdOk ? '<div class="banner ok"><p><b>Hold passed.</b> Every point read 10 ppm or more after the hold.</p></div>' : `<div class="banner"><p><b>After the hold every point needs 10 ppm or more.</b> ${s.nHold} of ${s.chk.length} so far.</p></div>`;
  if (s.phase === 'flush') h += s.flushOk ? '<div class="banner ok"><p><b>Flushing done.</b> Every flush point reads 0 ppm.</p></div>' : `<div class="banner"><p><b>Flush until every flush point reads 0 ppm.</b> ${s.nFl} of ${s.flushPts.length} so far.</p></div>`;
  const opts = [['inj', 'Injection'], ...cf.flush.map((p, i) => [p.id, `Flush #${i + 1}${p.loc ? ` (${p.loc})` : ''}`])];
  h += `<div class="evbox"><h4>Injection and flush: start, change, stop</h4>${live ? `<div class="evrow"><select id="ev-what" aria-label="Which">${opts.map(([v, l]) => `<option value="${v}">${esc(l)}</option>`).join('')}</select><div class="nw"><input id="ev-rate" type="number" step="any" inputmode="decimal" placeholder="Rate" aria-label="Rate in gpm"><span>gpm</span></div></div>
<div class="btns">${Object.entries(EV).map(([k, l]) => `<button class="btn ${k === 'stop' ? 'red' : k === 'change' ? 'ghost' : ''}" data-ev="${k}">${l}</button>`).join('')}</div>` : ''}
${cf.events.length ? `<ul class="evlist">${cf.events.slice().reverse().map(e => `<li><b>${esc(hm(e.t))}</b> ${esc(evWhat(rd, e.what))}: ${EV[e.act]}${e.rate ? `, ${esc(e.rate)} gpm` : ''} <span class="mut small">${esc(mdyMs(e.t))}</span></li>`).join('')}</ul>` : '<p class="small mut">Nothing logged yet. The time is stamped when you tap.</p>'}</div>`;
  h += `<div class="pts">${s.pts.map(p => {
    const st = s.per[p.id], cls = p.kind === 'inj' ? '' : s.phase === 'feed' ? (st.stable ? 'ok' : st.inRange === false ? 'bad' : '') : s.phase === 'hold' ? (st.holdOk === true ? 'ok' : st.holdOk === false ? 'bad' : '') : p.kind === 'flush' ? (st.flushOk === true ? 'ok' : st.flushOk === false ? 'bad' : '') : '';
    const badge = p.kind === 'inj' ? '' : s.phase === 'feed' ? (st.stable ? '<span class="b ok">Stable</span>' : st.inRange === false ? '<span class="b bad">Out of range</span>' : st.inRange ? '<span class="b prog">1 in range</span>' : '') : s.phase === 'hold' ? (st.holdOk === true ? '<span class="b ok">10+ ppm</span>' : st.holdOk === false ? '<span class="b bad">Under 10</span>' : '') : p.kind === 'flush' ? (st.flushOk === true ? '<span class="b ok">0 ppm</span>' : st.flushOk === false ? '<span class="b bad">Not 0 yet</span>' : '') : '';
    const rows = (cf.logs[p.id] || []).map((x, i) => [x, i]).reverse();
    return `<div class="pt ${cls}"><div class="pth"><div><b>${esc(p.name)}</b><small>${esc(p.loc || 'No location yet')}</small></div>${badge}</div>
${live ? `<form class="rdf" data-pt="${p.id}" data-ri="${c.ri}"><div class="nw"><input id="rd-${p.id}" type="number" step="any" inputmode="decimal" placeholder="Free Cl₂" aria-label="${esc(p.name)} free chlorine reading"><span>ppm</span></div><input id="rn-${p.id}" placeholder="Comment (optional)" aria-label="${esc(p.name)} comment"><button class="btn">Add reading</button></form>` : ''}
${rows.length ? `<table class="rdl"><tbody>${rows.map(([x, i]) => `<tr class="${x.void ? 'void' : ''}"><td>${esc(hm(x.t))}</td><td><b>${esc(x.ppm)}</b> ppm${p.kind !== 'inj' && x.ph === 'feed' && !x.void && s.lo !== null && s.hi !== null ? (s.inR(x.ppm) ? ' <span class="b ok">in</span>' : ' <span class="b bad">out</span>') : ''}</td><td class="mut small">${PH[x.ph]}${x.note ? ` · ${esc(x.note)}` : ''}${x.void ? ' · marked as a mistake' : ''}</td><td>${live && !x.void ? `<button class="lk" data-void="${c.ri}|${p.id}|${i}" aria-label="Mark this reading as a mistake">Mistake?</button>` : ''}</td></tr>`).join('')}</tbody></table>` : '<p class="small mut">No readings yet.</p>'}</div>`;
  }).join('')}</div>`;
  return h;
}

function methodPicker(j) {
  return `<section class="card picker"><h3>How is this main being disinfected?</h3><p class="small mut">You can change it later. Nothing you’ve entered is lost.</p>
<div class="pick"><button data-sel="rounds.0.method" data-v="tablets"><b>Tablets</b><span>PWD Initial Sample Request</span></button><button data-sel="rounds.0.method" data-v="cf"><b>Continuous feed</b><span>Disinfection Form (Pre and Post) and Chlorine Verification Logs</span></button></div></section>`;
}
function formName(j, ri) {
  const m = methodOf(j, ri);
  if (ri === 0) return m === 'cf' ? 'PWD Disinfection Form (Continuous Feed) and Chlorine Verification Logs' : 'PWD Initial Sample Request';
  return 'PWD Resample Request' + (m === 'cf' ? ', plus the Continuous Feed form and logs' : '');
}
function steps(j) {
  const ri = V.ri != null && j.rounds[V.ri] ? V.ri : cur(j), c = ctx(j, ri), rd = c.rd;
  let h = '';
  if (j.rounds.length > 1) h += `<div class="rounds">${j.rounds.map((r, i) => `<a href="#/job/${j.id}/steps/${i}" class="${i === ri ? 'on' : ''}">${roundName(i)}</a>`).join('')}</div>`;
  if (ri !== cur(j)) h += `<div class="banner"><p>You’re looking at the ${roundName(ri)} steps from earlier. Timers and the email use the latest round.</p></div>`;
  if (status(j)[1] === 'bad' && ri === cur(j)) h += `<div class="banner bad"><p><b>The last sample failed.</b> Start a resolution round to record the lab’s fix and the work done.</p><div class="acts"><button class="btn red" data-act="resample">Start resolution round</button></div></div>`;
  if (ri === 0 && !rd.method) return h + methodPicker(j);
  const m = methodOf(j, ri);
  h += `<p class="small mut" style="margin:0 0 12px">${esc(formName(j, ri))}${m && m !== 'flush' ? ` · Hold: ${c.holdH} hours${c.holdH === 48 ? ' (water below 41°F)' : ''}` : ''}${ri === 0 ? ` · <button class="lk" data-act="unmethod">Change method</button>` : ''}</p>`;
  return h + groups(j, ri).map(g => { const body = g.items.map(it => itemHtml(c, it)).join(''); return body ? `<section class="grp ${g.live ? 'live' : ''}"><h3>${esc(g.g)}</h3>${body}</section>` : ''; }).join('');
}

/* --- job info --- */
function infoVal(j, k) { return k.startsWith('R.') ? getP(j.rounds[cur(j)], k.slice(2)) : getP(j, k); }
function infoPath(j, k) { return k.startsWith('R.') ? `rounds.${cur(j)}.${k.slice(2)}` : k; }
function info(j) {
  return `<div class="form">${RULES.jobFields.map(f => {
    const p = infoPath(j, f.k), id = 'f-' + p.replace(/\./g, '-'), v = infoVal(j, f.k) ?? '';
    return `<div class="${v === '' && !f.opt ? 'blank' : ''}"><label for="${id}">${esc(f.l)}${f.opt ? ' <span class="small">(for the forms)</span>' : ''}</label><input id="${id}" data-k="${p}" ${f.type ? `type="${f.type}"` : ''} ${f.type === 'number' ? 'inputmode="decimal" step="any"' : ''} value="${esc(v)}"></div>`;
  }).join('')}</div>
<p class="sample">Fields outlined in amber are needed for the sample request email. The three date/time fields are the same ones as in Steps${j.rounds.length > 1 ? `, for the ${roundName(cur(j))} round` : ''}.</p>
<p style="margin-top:28px"><button class="btn red" data-del="1">Delete this street</button></p>`;
}

/* --- lab results --- */
function labs(j) {
  const rows = j.labs.map((a, i) => {
    const e = labEval(j, a), b = ctx(j, a.ri).baseline, multi = disCount(j, a.ri) > 1, pfx = `labs.${i}.`;
    return `<div class="lab"><h3><span>${roundName(a.ri)}${j.labs.filter(x => x.ri === a.ri).length > 1 ? ` <span class="mut" style="font-size:16px">${esc(a.point || '')}</span>` : ''}</span>${e.pass === true ? '<span class="b ok">Passed</span>' : e.pass === false ? `<span class="b bad wrap">Failed: ${esc(e.fails.join(', '))}</span>` : `<span class="b warn">${e.missing} result${e.missing === 1 ? '' : 's'} still blank</span>`}</h3>
<div class="meta"><div><label for="l${i}d">Sample date</label><input id="l${i}d" type="date" data-k="${pfx}date" value="${esc(a.date)}"></div><div><label for="l${i}p">Sample point</label><input id="l${i}p" data-k="${pfx}point" value="${esc(a.point || '')}" placeholder="e.g. ferrule at Dover & Somerset"></div></div>
<table class="stack"><thead><tr><th>Test</th><th>Acceptable</th><th>Result</th><th></th></tr></thead><tbody>${RULES.lab.map(p => {
      const n = num(a[p.k]), ok = n === null ? '' : p.ok(n, b, multi), id = `l${i}-${p.k}`;
      const ctl = p.presence
        ? `<select id="${id}" data-k="${pfx}${p.k}" aria-label="${p.name}"><option value=""${a[p.k] == null || a[p.k] === '' ? ' selected' : ''}>—</option><option value="0"${a[p.k] === '0' ? ' selected' : ''}>0, absent</option><option value="1"${a[p.k] === '1' ? ' selected' : ''}>1, present</option></select>`
        : `<input id="${id}" data-k="${pfx}${p.k}" type="number" step="any" inputmode="decimal" value="${esc(a[p.k] ?? '')}" aria-label="${p.name}">`;
      return `<tr><td><b>${p.name}</b> <span class="mut">${p.u}</span></td><td>${esc(p.range(b, multi))}</td><td>${ctl}</td><td>${ok === '' ? '' : ok ? '<span class="b ok">OK</span>' : '<span class="b bad">Fail</span>'}</td></tr>`;
    }).join('')}</tbody></table>
<button class="btn ghost sm" data-labdel="${i}">Delete this result</button></div>`;
  }).join('');
  const ri = cur(j);
  let act = `<button class="btn" data-addlab="1">Add ${roundName(ri)} sample result</button>`;
  if (status(j)[1] === 'bad') act += ` <button class="btn red" data-act="resample">Start resolution round</button>`;
  return (rows || '<p class="mut">No lab results yet. Add them when BLS sends the report. Add one result for each sample point.</p>') + `<div class="btns">${act}</div>`;
}

/* --- email --- */
function mailParts(j) {
  const ri = cur(j), rd = j.rounds[ri], rs = isRs(ri), flushOnly = methodOf(j, ri) === 'flush';
  const list = S.settings.recipients.filter(e => !j.mail.off.includes(e));
  const extra = [j.f.contractorEmail, ...j.mail.extra].filter(Boolean).filter(e => !j.mail.off.includes(e));
  const to = [...new Set([...list, ...extra])];
  const subject = RULES.subject(rs, j.f.work);
  const loc = j.street ? `On ${j.street}${j.from ? `, from ${j.from}` : ''}${j.to ? ` to ${j.to}` : ''}` : '';
  const body = RULES.emailBody.map(([label, k, kind]) => {
    let v = k === 'location' ? (j.street && j.from && j.to ? loc : '') : k.startsWith('R.') ? getP(rd, k.slice(2)) : getP(j, k);
    if (kind === 'date') v = mdy(v); else if (kind === 'dt') v = mdy(v, true);
    if (k === 'R.t.loaded' && !v && flushOnly) v = `N/A (flush only; last loaded ${prevLoaded(j, ri) || 'earlier'})`;
    return [label, v ?? '', k];
  });
  return { to, subject, body, text: body.map(b => `${b[0]}: ${b[1]}`).join('\n'), missing: body.filter(b => !b[1]), rs };
}
function email(j) {
  const m = mailParts(j), fl = flags(j, cur(j));
  const warn = [];
  if (m.missing.length) warn.push(`<b>Still blank:</b> ${m.missing.map(b => `<a href="#/job/${j.id}/info" data-focus="${esc(b[2] === 'location' ? 'from' : infoPath(j, b[2]))}">${esc(b[0])}</a>`).join(', ')}`);
  if (fl.red) warn.push(`<b>${fl.red} step${fl.red === 1 ? ' is' : 's are'} red</b> in Steps${fl.needFix ? `, and ${fl.needFix} still need${fl.needFix === 1 ? 's' : ''} a corrective action note` : ''}.`);
  if (usesCf(j, cur(j)) && j.rounds[cur(j)].cf && j.rounds[cur(j)].c && getP(j.rounds[cur(j)], 'cf.logsSent') !== 'Y') warn.push('<b>Chlorine Verification Logs:</b> send them to the PWD lab before sanitary release sampling.');
  if (!m.to.length) warn.push(S.settings.recipients.length ? '<b>No recipients selected.</b>' : '<b>No recipients yet.</b> Add the PWD list once under <a href="#/settings">Backup</a> &gt; Email recipients.');
  const all = [...new Set([...S.settings.recipients, ...[j.f.contractorEmail, ...j.mail.extra].filter(Boolean)])];
  const mailto = `mailto:${m.to.map(encodeURIComponent).join(',')}?subject=${encodeURIComponent(m.subject)}&body=${encodeURIComponent(m.text.replace(/\n/g, '\r\n'))}`;
  return `<div class="mail">${warn.length ? `<div class="banner warn"><p>${warn.join('<br>')}</p></div>` : '<div class="banner"><p><b>Every required field is filled in.</b></p></div>'}
<div class="btns"><a class="btn" href="${esc(mailto)}">Open in my email app</a><button class="btn ghost" data-copy="all">Copy everything</button></div>
<h3>To <span class="mut" style="font-size:15px">(${m.to.length})</span></h3>
<div>${all.map(e => { const isC = e === j.f.contractorEmail, isX = j.mail.extra.includes(e); return `<label class="rcp"><input type="checkbox" data-rcp="${esc(e)}" ${j.mail.off.includes(e) ? '' : 'checked'}><span>${esc(e)}${isC ? ' <span class="mut small">(contractor)</span>' : ''}</span>${isX ? `<button data-rcpdel="${esc(e)}" aria-label="Remove ${esc(e)}">Remove</button>` : ''}</label>`; }).join('')}</div>
<form class="addrow" id="rcpf"><input id="rcp-new" type="email" placeholder="Add another address for this street" aria-label="Add an address"><button class="btn ghost">Add</button></form>
<p class="sample">Untick anyone who shouldn’t get this one. The PWD list itself is under Backup. The contractor email comes from Job info.</p>
<div class="btns"><button class="btn ghost sm" data-copy="to">Copy recipients</button></div>
<h3>Subject</h3><pre>${esc(m.subject)}</pre><div class="btns"><button class="btn ghost sm" data-copy="subject">Copy subject</button></div>
<h3>Body</h3><pre>${esc(m.text)}</pre><div class="btns"><button class="btn ghost sm" data-copy="body">Copy body</button></div>
<p class="sample">After shutdown, reply all to BLS’s acknowledgement with the signed form and sketch as one PDF.</p></div>`;
}

/* --- notes: a running log, never overwritten --- */
const allTags = () => [...new Set([...RULES.tags, ...S.settings.tags])];
const STAGE_OF = { 'Getting ready': 'Setup', Disinfecting: 'Disinfecting', '24-hr hold': 'Disinfecting', Flushing: 'Flushing', '16-hr hold': '16-hr hold', 'Waiting on lab': 'Waiting on lab', 'Failed: fix needed': 'Resolution', Resolution: 'Resolution' };
function noteEntry(j, n) {
  return `<li class="ne"><div class="nh"><b>${esc(mdyMs(n.t, true))}</b>${j.rounds.length > 1 ? ` <span class="b">${roundName(n.ri || 0)}</span>` : ''}${n.stage ? ` <span class="b prog">${esc(n.stage)}</span>` : ''}${(n.tags || []).map(t => ` <span class="b tag">${esc(t)}</span>`).join('')}</div><div class="nt">${esc(n.text)}</div></li>`;
}
function notes(j) {
  const fx = [];
  j.rounds.forEach((r, i) => { const c = ctx(j, i); for (const it of items(c)) if (itemState(c, it) === 'bad') fx.push([i, txt(it.q, c), r.fix[fixKey(it.k)] || '']); });
  const stage = STAGE_OF[status(j)[0]] || '';
  return `<form id="notef" class="card notef"><h3>Add a note</h3><label for="n-text" class="small mut">What happened? Each note is stamped with the date and time and can’t be changed later. To correct one, add another.</label>
<textarea id="n-text" required></textarea>
<div class="nrow"><label class="small mut" for="n-stage">Stage</label><select id="n-stage"><option value="">—</option>${RULES.stages.map(s => `<option${s === stage ? ' selected' : ''}>${esc(s)}</option>`).join('')}</select></div>
<div class="tags" role="group" aria-label="Tags">${allTags().map(t => `<label class="tg"><input type="checkbox" name="tag" value="${esc(t)}"><span>${esc(t)}</span></label>`).join('')}<input id="n-newtag" placeholder="+ New tag" aria-label="New tag" class="newtag"></div>
<div class="btns"><button class="btn">Add note</button></div></form>
<h3 style="font-size:20px;margin:8px 0">Log <span class="mut" style="font-size:15px">(${j.log.length})</span></h3>
${j.log.length ? `<ul class="nlog">${j.log.slice().sort((a, b) => b.t - a.t).map(n => noteEntry(j, n)).join('')}</ul>` : '<p class="mut">No notes yet.</p>'}
${fx.length ? `<h3 style="font-size:20px;margin:20px 0 8px">Corrective actions from Steps</h3>${fx.map(([i, q, f]) => `<div class="note ${f.trim() ? '' : 'warn'}"><b>${j.rounds.length > 1 ? roundName(i) + ': ' : ''}${esc(q)}</b><br>${f.trim() ? esc(f) : '<i>No corrective action written yet. Add it under Steps.</i>'}</div>`).join('')}` : ''}`;
}

/* --- print menu --- */
function printMenu(j) {
  const rows = j.rounds.map((r, i) => {
    const m = methodOf(j, i), L = [];
    if (i === 0 && m === 'tablets') L.push(['initial', 'Initial Sample Request']);
    if (i > 0) L.push(['resample', 'Resample Request']);
    if (m === 'cf') L.push(['cfpre', 'Disinfection Form: Pre-Disinfection'], ['cfpost', 'Disinfection Form: Post-Disinfection'], ['cflog', 'Chlorine Verification Logs (every point)']);
    return `<div class="card"><h3>${roundName(i)} <span class="mut" style="font-size:16px">${esc(methodLabel(m))}${i ? ` · ${esc(RULES.fixes[r.res.fix] || 'fix not picked')}` : ''}</span></h3>${L.length ? `<div class="btns">${L.map(([k, l]) => `<a class="btn ghost" href="#/print/${j.id}/${k}/${i}">${l}</a>`).join('')}</div>` : '<p class="small mut">Pick the method in Steps first.</p>'}</div>`;
  }).join('');
  return `<p class="mut">Each one opens a printable page. Use <b>Print / Save as PDF</b> there. On a phone, choose “Save as PDF” as the printer.</p>
<div class="card"><h3>Street report</h3><p class="small mut">Everything on this street: steps, logs, lab results and notes.</p><div class="btns"><a class="btn" href="#/print/${j.id}/report/0">Street report</a></div></div>${rows}
<p class="sample">The PWD form printouts follow the layout of the forms in hand. Check them against the official form before signing.</p>`;
}

function detail(j) {
  const [s, c] = status(j), fl = flags(j, cur(j));
  const secs = [['steps', 'Steps'], ['info', 'Job info'], ['lab', 'Lab results'], ['email', 'Email'], ['notes', 'Notes'], ['print', 'Print']];
  const body = { steps, info, lab: labs, email, notes, print: printMenu }[V.sec] || steps;
  return `<a class="back" href="#/">← All streets</a><h2 style="font-size:clamp(28px,5vw,40px)">${esc(j.street)}</h2>
<div class="mut">${esc([j.from, j.to].filter(Boolean).join(' to '))}${j.f.work ? ` · Work #${esc(j.f.work)}` : ''}${j.f.length || j.f.dia ? ` · ${esc(j.f.length || '?')} ft of ${esc(j.f.dia || '?')}"` : ''}</div>
<div class="sum"><span class="b ${c}">${s}</span>${fl.total ? `<span class="b">${fl.filled} of ${fl.total} steps filled</span>` : ''}${fl.red ? `<span class="b bad">${fl.red} red</span>` : ''}${fl.needFix ? `<span class="b bad">${fl.needFix} need a corrective action</span>` : ''}</div>
<nav class="secs" aria-label="Sections">${secs.map(([k, l]) => `<a href="#/job/${j.id}/${k}" class="${V.sec === k ? 'on' : ''}" ${V.sec === k ? 'aria-current="page"' : ''}>${l}</a>`).join('')}</nav>${body(j)}`;
}

/* --- analysis --- */
function rateTable(title, groupsMap) {
  const rows = Object.entries(groupsMap).sort((a, b) => b[1].n - a[1].n);
  return `<h3 class="ah">${esc(title)}</h3>${rows.length ? `<table class="stack rt"><thead><tr><th></th><th>Rounds with a result</th><th>Passed</th><th>Pass rate</th></tr></thead><tbody>${rows.map(([k, v]) => `<tr><td><b>${esc(k)}</b></td><td>${v.n}</td><td>${v.p}</td><td><b>${Math.round(100 * v.p / v.n)}%</b></td></tr>`).join('')}</tbody></table>` : '<p class="mut">Nothing yet.</p>'}`;
}
function whoDid(j, ri) {
  const rd = j.rounds[ri];
  if (ri === 0) return j.f.disSub ? `${j.f.disSub} (sub-contractor)` : 'Contractor in-house';
  return rd.res.by === 'sub' ? `${rd.res.subCo || 'Sub-contractor'} (sub-contractor)` : rd.res.by === 'inhouse' ? 'Contractor in-house' : 'Not recorded';
}
function rangeData(from, to) {
  const a = parseLocal(from), b = parseLocal(to), lo = a ? a.getTime() : -Infinity, hi = b ? b.getTime() + DAY - 1 : Infinity;
  const inR = t => t >= lo && t <= hi, tags = {}, streets = [];
  for (const j of S.jobs) {
    const lab = j.labs.map((l, i) => ({ l, i, t: parseLocal(l.date)?.getTime() })).filter(x => x.t != null && inR(x.t));
    const notes = j.log.filter(n => inR(n.t));
    for (const n of notes) for (const t of n.tags || []) tags[t] = (tags[t] || 0) + 1;
    if (lab.length || notes.length) streets.push({ j, lab, notes });
  }
  return { streets, tags };
}
function rangeReportHtml(from, to) {
  const { streets, tags } = rangeData(from, to);
  const head = `<p class="mut">${from || to ? `${from ? mdy(from) : 'The start'} to ${to ? mdy(to) : 'today'}` : 'All dates'} · ${streets.length} street${streets.length === 1 ? '' : 's'}</p>`;
  const tagH = Object.keys(tags).length ? `<h3 class="ah">Tags</h3><div class="tagc">${Object.entries(tags).sort((a, b) => b[1] - a[1]).map(([t, n]) => `<span class="b tag">${esc(t)}: ${n}</span>`).join(' ')}</div>` : '';
  const body = streets.map(({ j, lab, notes }) => `<div class="rs"><h4>${esc(j.street)} <span class="mut small">${esc([j.from, j.to].filter(Boolean).join(' to '))}${j.f.work ? ` · Work #${esc(j.f.work)}` : ''}</span></h4>
${lab.length ? `<ul>${lab.map(({ l }) => { const e = labEval(j, l); return `<li>${esc(mdy(l.date))}: ${roundName(l.ri)}${l.point ? ` (${esc(l.point)})` : ''}, ${esc(methodLabel(methodOf(j, l.ri)))}${l.ri ? `, ${esc(RULES.fixes[j.rounds[l.ri].res.fix] || 'fix not recorded')}` : ''}: ${e.pass === true ? '<b class="okt">Passed</b>' : e.pass === false ? `<b class="badt">Failed</b> (${esc(e.fails.join(', '))})` : 'incomplete'}</li>`; }).join('')}</ul>` : ''}
${notes.length ? `<ul class="nlog">${notes.slice().sort((a, b) => a.t - b.t).map(n => noteEntry(j, n)).join('')}</ul>` : ''}</div>`).join('');
  return head + tagH + (body || '<p class="mut">Nothing in this date range.</p>');
}
function analysis() {
  const D = S.jobs.filter(j => roundResult(j, 0) === true || roundResult(j, 0) === false);
  const first = j => roundResult(j, 0) === true;
  const rate = a => (a.length ? Math.round(100 * a.filter(first).length / a.length) + '%' : '—');
  const wt = j => num(j.rounds[0].r.waterT);
  const cold = D.filter(j => wt(j) !== null && wt(j) < RULES.coldF), warm = D.filter(j => wt(j) !== null && wt(j) >= RULES.coldF);
  const samples = j => new Set(j.labs.map(l => l.ri)).size;
  const tries = D.length ? (D.reduce((s, j) => s + samples(j), 0) / D.length).toFixed(1) : '—';
  const cnt = {}; for (const j of S.jobs) for (const l of j.labs) for (const f of labEval(j, l).fails) cnt[f] = (cnt[f] || 0) + 1;
  const mx = Math.max(1, ...Object.values(cnt));
  const byFix = {}, byMethod = {}, byWho = {};
  const add = (m, k, p) => { m[k] ??= { n: 0, p: 0 }; m[k].n++; if (p) m[k].p++; };
  for (const j of S.jobs) j.rounds.forEach((r, ri) => {
    const rr = roundResult(j, ri); if (rr !== true && rr !== false) return;
    add(byMethod, methodLabel(methodOf(j, ri)), rr);
    add(byWho, whoDid(j, ri), rr);
    if (ri > 0) add(byFix, RULES.fixes[r.res.fix] || 'Not recorded', rr);
  });
  const R = S.meta.range;
  return `<div class="top"><h2>What makes samples pass</h2><span class="mut">${D.length} main${D.length === 1 ? '' : 's'} with a first lab result</span></div>
${D.length ? '' : '<div class="banner"><p>This page fills in as lab results are entered. Nothing to show yet.</p></div>'}
<div class="kpis"><div class="kpi"><strong>${rate(D)}</strong><span>Passed on the first sample</span></div><div class="kpi"><strong>${tries}</strong><span>Samples per main, on average</span></div><div class="kpi"><strong>${rate(cold)}</strong><span>First-try pass, water below 41°F (${cold.length})</span></div><div class="kpi"><strong>${rate(warm)}</strong><span>First-try pass, water 41°F and up (${warm.length})</span></div></div>
${rateTable('Pass rate by method', byMethod)}
${rateTable('Pass rate by fix type (resolution rounds)', byFix)}
${rateTable('Pass rate by who did the work', byWho)}
<h3 class="ah">Which tests fail most</h3><div class="bars">${Object.keys(cnt).length ? Object.entries(cnt).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<div class="bar"><span>${esc(k)}</span><div><i style="width:${100 * v / mx}%"></i></div><span>${v}</span></div>`).join('') : '<p class="mut">No failed tests logged yet.</p>'}</div>
<section class="card"><h3>Report for a date range</h3><p class="small mut">Each street’s lab results and notes in the period, with a count of each tag.</p>
<div class="range"><label>From<input type="date" id="rg-from" data-mk="range.from" value="${esc(R.from || '')}"></label><label>To<input type="date" id="rg-to" data-mk="range.to" value="${esc(R.to || '')}"></label><a class="btn ghost" href="#/print/range">Print this report</a></div>
${rangeReportHtml(R.from, R.to)}</section>
<h3 class="ah">Every main</h3>${S.jobs.length ? `<div class="scroll"><table class="stack"><thead><tr><th>Street</th><th>Work #</th><th>Length</th><th>Dia.</th><th>Method</th><th>Water °F</th><th>Pipe maker</th><th>Samples</th><th>First sample</th><th>Status</th></tr></thead><tbody>${S.jobs.map(j => {
    const [s, c] = status(j), r0 = j.rounds[0].r, fr = roundResult(j, 0);
    return `<tr><td><a href="#/job/${j.id}/steps"><b>${esc(j.street)}</b></a></td><td>${esc(j.f.work)}</td><td>${j.f.length ? esc(j.f.length) + ' ft' : ''}</td><td>${j.f.dia ? esc(j.f.dia) + '"' : ''}</td><td>${methodOf(j, 0) ? esc(methodLabel(methodOf(j, 0))) : ''}</td><td>${esc(r0.waterT)}</td><td>${esc(j.f.mfr)}</td><td>${samples(j) || ''}</td><td>${fr === true ? '<span class="b ok">Pass</span>' : fr === false ? '<span class="b bad">Fail</span>' : ''}</td><td><span class="b ${c}">${s}</span>${cur(j) ? ` <span class="small mut">${roundName(cur(j))}</span>` : ''}</td></tr>`;
  }).join('')}</tbody></table></div>` : '<p class="mut">No streets yet.</p>'}`;
}

/* --- printable pages --- */
function ansText(c, it) {
  const v = val(c, it.k);
  if (v == null || v === '') return '';
  if (it.t === 'yn') return v === 'Y' ? 'Yes' : 'No';
  if (it.t === 'time') return mdy(v, true);
  if (it.t === 'date') return mdy(v);
  if (it.t === 'sel') return (it.opts.find(o => o[0] === v) || [, v])[1];
  if (it.t === 'num') return `${v} ${it.u || ''}`.trim();
  return v;
}
function streetReport(j) {
  const F = [['Location', [j.from, j.to].filter(Boolean).join(' to ')], ['Work #', j.f.work], ['Contract No.', j.f.contract], ['Contractor', j.f.contractor], ['Disinfection sub-contractor', j.f.disSub], ['Inspector', j.f.inspector], ['Division engineer', j.f.engineer], ['Length', j.f.length && j.f.length + ' ft'], ['Diameter', j.f.dia && j.f.dia + ' in'], ['Pipe manufacturer', j.f.mfr], ['Status', status(j)[0]]].filter(x => x[1]);
  const rounds = j.rounds.map((rd, ri) => {
    const c = ctx(j, ri), m = methodOf(j, ri);
    const rows = groups(j, ri).map(g => {
      const its = g.items.filter(it => it.k && vis(c, it) && ansText(c, it));
      return its.length ? `<tr><th colspan="2" class="gh">${esc(g.g)}</th></tr>${its.map(it => { const st = itemState(c, it), fx = c.rd.fix[fixKey(it.k)]; return `<tr class="${st}"><td>${esc(txt(it.q, c))}</td><td>${esc(ansText(c, it))}${st === 'bad' ? ' ✗' : ''}${fx ? `<div class="fxp">Corrective action: ${esc(fx)}</div>` : ''}</td></tr>`; }).join('')}` : '';
    }).join('');
    const fer = rd.ferrules.length && groups(j, ri).some(g => g.items.some(i => i.t === 'ferrules')) ? `<p><b>Ferrule readings:</b> ${rd.ferrules.map(f => `${esc(f.loc || '?')} ${esc(f.ppm)} ppm`).join('; ')}</p>` : '';
    const cfp = m === 'cf' ? `<table class="rep"><thead><tr><th>Point</th><th>Location</th><th>Readings</th><th>Stable in range</th><th>After hold</th><th>Final flush</th></tr></thead><tbody>${c.cfs.pts.map(p => { const s = c.cfs.per[p.id]; return `<tr><td>${esc(p.name)}</td><td>${esc(p.loc)}</td><td>${s.n}</td><td>${p.kind === 'inj' ? '' : s.stable ? 'Yes' : 'No'}</td><td>${s.lastHold ? esc(s.lastHold.ppm) + ' ppm' : ''}</td><td>${s.lastFlush ? esc(s.lastFlush.ppm) + ' ppm' : ''}</td></tr>`; }).join('')}</tbody></table><p class="small">${rd.cf.events.length} injection/flush start, change and stop entries. Full detail is on the Chlorine Verification Logs.</p>` : '';
    const lb = j.labs.filter(l => l.ri === ri).map(l => { const e = labEval(j, l); return `<tr><td>${esc(mdy(l.date))}</td><td>${esc(l.point || '')}</td><td>${RULES.lab.map(p => `${p.name} ${esc(l[p.k] ?? '—')}`).join(', ')}</td><td>${e.pass === true ? 'Passed' : e.pass === false ? 'Failed: ' + esc(e.fails.join(', ')) : 'Incomplete'}</td></tr>`; }).join('');
    return `<section class="rr"><h3>${roundName(ri)}: ${esc(methodLabel(m))}${ri ? ` · ${esc(RULES.fixes[rd.res.fix] || 'fix not recorded')}` : ''}</h3>
${rows ? `<table class="rep">${rows}</table>` : '<p class="small">No steps answered.</p>'}${fer}${cfp}
${lb ? `<h4>Lab results</h4><table class="rep"><thead><tr><th>Date</th><th>Point</th><th>Results</th><th>Outcome</th></tr></thead><tbody>${lb}</tbody></table>` : ''}</section>`;
  }).join('');
  return `<div class="sheet rep-sheet"><h1>Street report: ${esc(j.street)}</h1><p class="small">Printed ${esc(fmtDate(new Date()))}</p>
<table class="rep kv">${F.map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join('')}</table>${rounds}
<section class="rr"><h3>Notes log</h3>${j.log.length ? `<ul class="nlog">${j.log.slice().sort((a, b) => a.t - b.t).map(n => noteEntry(j, n)).join('')}</ul>` : '<p class="small">No notes.</p>'}</section>${footer()}</div>`;
}
function formData(j, ri) {
  const c = ctx(j, ri), rd = c.rd;
  const failed = j.labs.filter(l => l.ri === ri - 1).flatMap(l => labEval(j, l).fails);
  return { j, rd, ri, c, esc, mdy, mdyMs, hm, num, cfPoints: cfPoints(rd), cfs: c.cfs, prevLoaded: c.prevLoaded, evWhat: w => evWhat(rd, w), EV, PH,
    labs: j.labs.filter(l => l.ri === ri).map(l => ({ l, e: labEval(j, l) })), failedTests: failed, fixes: RULES.fixes, round: roundName(ri) };
}
function printPage() {
  const j = job(), k = V.kind, ri = V.ri ?? 0;
  let html = '', back = j ? `#/job/${j.id}/print` : '#/analysis', title = '';
  if (V.id === 'range') { const R = S.meta.range; title = 'Date-range report'; html = `<div class="sheet rep-sheet"><h1>Hinton Water: date-range report</h1>${rangeReportHtml(R.from, R.to)}${footer()}</div>`; }
  else if (k === 'report') { title = `${j.street} street report`; html = streetReport(j); }
  else if (j && j.rounds[ri]) {
    const D = formData(j, ri);
    if (k === 'initial') { title = 'Initial Sample Request'; html = FORMS.initial(D); }
    else if (k === 'resample') { title = 'Resample Request'; html = FORMS.resample(D); }
    else if (k === 'cfpre') { title = 'Disinfection Form (Pre)'; html = FORMS.cfForm(D, true); }
    else if (k === 'cfpost') { title = 'Disinfection Form (Post)'; html = FORMS.cfForm(D, false); }
    else if (k === 'cflog') { title = 'Chlorine Verification Logs'; html = FORMS.cfLogs(D); }
  }
  if (!html) return `<a class="back" href="#/">← All streets</a><p>Nothing to print.</p>`;
  document.title = `${title}${j ? ` - ${j.street}` : ''}`;
  return `<div class="ptools"><a class="back" href="${back}">← Back</a><button class="btn" data-act="print">Print / Save as PDF</button></div>${html}`;
}

/* --- settings / backup --- */
async function settings() {
  const lb = S.meta.lastBackup, pers = await Store.persisted(), undo = await Store.get('beforeRestore');
  const notif = 'Notification' in self ? Notification.permission : 'unsupported';
  return `<div class="top"><h2>Backup and settings</h2></div>
<section class="card"><h3>Backup</h3><p>Everything is saved on this device only. A backup is one file with every street in it. Keep it in Google Drive, your Files app, or email it to yourself.</p>
<p><b>Last backup:</b> ${lb ? esc(fmt(new Date(lb))) : 'never'}</p>
<div class="btns"><button class="btn" data-act="backup">Back up</button><button class="btn ghost" data-act="restore">Restore from a backup file</button>${undo ? '<button class="btn ghost" data-act="undo">Undo last restore</button>' : ''}</div>
<input type="file" id="restore-file" accept=".json,application/json" hidden>
<p class="sample">Restore replaces what’s on this device with the backup. You’ll be asked to confirm first, and you can undo it.</p></section>
<section class="card"><h3>Email recipients</h3><p>The PWD list used on every street. Each street’s Email page can untick names or add more. The list is saved only on this device.</p>
${S.settings.recipients.length ? '' : '<p class="sample"><b>The list is empty.</b> Paste the whole PWD list into the box below (commas, semicolons or spaces between addresses are all fine) and tap Add.</p>'}
<div>${S.settings.recipients.map(e => `<div class="rcp"><span>${esc(e)}</span><button data-grcpdel="${esc(e)}" aria-label="Remove ${esc(e)}">Remove</button></div>`).join('')}</div>
<form class="addrow" id="grcpf"><input id="grcp-new" type="text" inputmode="email" autocomplete="off" placeholder="Add an address, or paste a list" aria-label="Add an address, or paste a list"><button class="btn ghost">Add</button></form></section>
${S.settings.tags.length ? `<section class="card"><h3>Your note tags</h3><p class="small mut">Tags you added. Removing one here keeps it on notes that already use it.</p><div>${S.settings.tags.map(t => `<div class="rcp"><span>${esc(t)}</span><button data-tagdel="${esc(t)}">Remove</button></div>`).join('')}</div></section>` : ''}
<section class="card"><h3>Timer alerts</h3><p>Each timer has an <b>Add to calendar</b> button. That puts an alarm on your phone’s calendar, which goes off even with this app closed. That’s the reliable way.</p>
<p>While the app is open it will also pop up and beep when a timer finishes.${notif === 'default' ? ' You can also let it show a notification while it’s open in the background:' : notif === 'granted' ? ' Notifications are on.' : notif === 'denied' ? ' Notifications are blocked in this browser’s settings.' : ''}</p>
${notif === 'default' ? '<div class="btns"><button class="btn ghost" data-act="notif">Allow notifications</button></div>' : ''}
<div class="btns"><button class="btn ghost sm" data-act="testbeep">Test the alert sound</button></div></section>
<section class="card"><h3>About</h3><p>Hinton Water Disinfection Report, version ${esc(APP_VERSION)}.</p>
<p class="small mut">Storage: ${pers ? 'protected (the browser won’t clear it to free space)' : 'standard. Installing the app to the home screen helps keep it safe.'}</p>
<p class="small"><a href="#/help">How to use and install</a></p>
<div class="btns" style="margin-top:18px"><button class="btn red sm" data-act="wipe">Erase everything on this device</button></div></section>${footer()}`;
}

/* ---------- render ---------- */
let ro = null;
function layoutTabs() {
  const box = $('#idx'); if (!box) return;
  const W = box.clientWidth, land = innerWidth > innerHeight && innerWidth >= 560;
  const tw = Math.min(land ? Math.max(W * 0.5, 420) : W < 560 ? W * 0.8 : 340, W), max = W - tw;
  const step = W < 560 ? 26 : 46, n = Math.max(1, Math.floor(max / step)), s = max / n;
  box.style.setProperty('--tw', tw + 'px');
  [...box.children].forEach((t, i) => { const k = i % (2 * n); t.style.marginLeft = (k <= n ? k : 2 * n - k) * s + 'px'; });
}
async function render() {
  const j = job();
  if (V.page === 'job' && !j) V.page = 'home';
  let html;
  document.body.classList.toggle('printing', V.page === 'print');
  if (V.page === 'job') html = detail(j);
  else if (V.page === 'print') html = printPage();
  else if (V.page === 'analysis') html = analysis();
  else if (V.page === 'settings') html = await settings();
  else if (V.page === 'help') html = `<a class="back" href="#/">← All streets</a>${howto(true)}`;
  else html = home();
  app.innerHTML = html;
  for (const a of document.querySelectorAll('header nav a')) a.classList.toggle('on', a.dataset.nav === (V.page === 'job' || V.page === 'help' ? 'home' : V.page));
  if (V.page !== 'print') document.title = V.page === 'job' && j ? `${j.street}: Hinton Water` : 'Hinton Water Disinfection Report';
  labelStack();
  if (ro) ro.disconnect();
  const box = $('#idx'); if (box) { ro = new ResizeObserver(layoutTabs); ro.observe(box); layoutTabs(); }
  tick();
}
function rerender() {
  setTimeout(async () => {
    const a = document.activeElement, id = a && a.id, y = scrollY;
    await render(); scrollTo(0, y);
    if (id) { const e = document.getElementById(id); if (e) e.focus({ preventScroll: true }); }
  }, 0);
}
function labelStack() {
  for (const c of document.querySelectorAll('.stack td:not([data-l])')) { let i = 0, p = c; while ((p = p.previousElementSibling)) i += p.colSpan; c.dataset.l = c.closest('table').rows[0].cells[i]?.textContent || ''; }
}
addEventListener('resize', () => layoutTabs());

/* ---------- timers: countdowns and alerts ---------- */
function markOldAlerts() { for (const j of S.jobs) { const ri = cur(j); for (const id of timerIds(j, ri)) { const t = timer(j, ri, id); if (t.start && t.left < -2 * 6e4) S.meta.alerted[t.key] = 1; } } }
markOldAlerts();
function tick() {
  const now = Date.now();
  for (const el of document.querySelectorAll('[data-end]')) { const ms = +el.dataset.end - now; el.textContent = el.dataset.short ? leftShort(ms) : left(ms); }
  let changed = false;
  for (const j of S.jobs) {
    const ri = cur(j);
    for (const id of timerIds(j, ri)) {
      const t = timer(j, ri, id);
      if (t.start && t.left <= 0 && !S.meta.alerted[t.key]) { S.meta.alerted[t.key] = 1; changed = true; alarm(`${j.street}: ${t.name} is done`, t.d.doneMsg, j.id); }
    }
  }
  if (changed) { save(); if (V.page !== 'print') rerender(); }
}
setInterval(tick, 1000);

let actx = null;
function unlockAudio() { try { actx ??= new (self.AudioContext || self.webkitAudioContext)(); if (actx.state === 'suspended') actx.resume(); } catch (e) {} }
addEventListener('pointerdown', unlockAudio, { once: false, passive: true });
function beep() {
  try {
    unlockAudio(); if (!actx) return;
    const t0 = actx.currentTime;
    for (let i = 0; i < 6; i++) {
      const o = actx.createOscillator(), g = actx.createGain(); o.type = 'square'; o.frequency.value = i % 2 ? 880 : 1175;
      g.gain.setValueAtTime(0.0001, t0 + i * 0.35); g.gain.exponentialRampToValueAtTime(0.25, t0 + i * 0.35 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + i * 0.35 + 0.3);
      o.connect(g).connect(actx.destination); o.start(t0 + i * 0.35); o.stop(t0 + i * 0.35 + 0.32);
    }
  } catch (e) {}
}
function alarm(title, body, jobId) {
  beep(); try { navigator.vibrate && navigator.vibrate([400, 200, 400, 200, 400]); } catch (e) {}
  toast(title, body, true, jobId);
  try {
    if ('Notification' in self && Notification.permission === 'granted' && navigator.serviceWorker) navigator.serviceWorker.ready.then(r => r.showNotification(title, { body, tag: title, requireInteraction: true, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', data: { url: jobId ? `#/job/${jobId}/steps` : '#/' } }));
  } catch (e) {}
}
function toast(title, body, alarmStyle, jobId) {
  const box = $('#toasts'), el = document.createElement('div');
  el.className = 'toast' + (alarmStyle ? ' alarm' : ''); el.setAttribute('role', alarmStyle ? 'alert' : 'status');
  el.innerHTML = `<p><b>${esc(title)}</b>${esc(body || '')}</p>${jobId ? `<button data-open="${jobId}">Open</button>` : ''}<button data-x="1">OK</button>`;
  box.appendChild(el);
  el.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; if (b.dataset.open) go(`#/job/${b.dataset.open}/steps`); el.remove(); });
  if (!alarmStyle) setTimeout(() => el.remove(), 4000);
}

/* ---------- calendar ---------- */
const icsDate = d => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const icsEsc = s => String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
function calText(j, t) { return { title: `${j.street}: ${t.name} done`, details: `${t.d.doneMsg}\n\n${j.street}${j.from ? ` (${j.from} to ${j.to || ''})` : ''}${j.f.work ? `, Work #${j.f.work}` : ''}. From the Hinton Water Disinfection Report app.` }; }
function icsFor(j, t) {
  const { title, details } = calText(j, t), end = new Date(t.end.getTime() + 15 * 6e4);
  const alarms = [`BEGIN:VALARM\r\nACTION:DISPLAY\r\nDESCRIPTION:${icsEsc(title)}\r\nTRIGGER:PT0M\r\nEND:VALARM`];
  if (t.hours >= 2) alarms.push(`BEGIN:VALARM\r\nACTION:DISPLAY\r\nDESCRIPTION:${icsEsc(title + ' in 30 minutes')}\r\nTRIGGER:-PT30M\r\nEND:VALARM`);
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Hinton Water Disinfection Report//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'BEGIN:VEVENT',
    `UID:${t.key.replace(/\|/g, '-')}@hinton-water`, `DTSTAMP:${icsDate(new Date())}`, `DTSTART:${icsDate(t.end)}`, `DTEND:${icsDate(end)}`,
    `SUMMARY:${icsEsc(title)}`, `DESCRIPTION:${icsEsc(details)}`, ...alarms, 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
}
function gcalUrl(j, t) {
  const { title, details } = calText(j, t);
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${icsDate(t.end)}/${icsDate(new Date(t.end.getTime() + 15 * 6e4))}&details=${encodeURIComponent(details)}`;
}
const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
function saveFile(name, text, type) {
  const blob = new Blob([text], { type });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 60000);
}
function addToCalendar(j, id) {
  const t = timer(j, cur(j), id); if (!t.start) return;
  const ics = icsFor(j, t), name = `${j.street} ${t.name}`.replace(/[^\w -]+/g, '').trim() + '.ics';
  if (isIOS()) { location.href = 'data:text/calendar;charset=utf-8,' + encodeURIComponent(ics); return; }
  saveFile(name, ics, 'text/calendar');
  toast('Calendar file saved', 'Open it to add the alarm to your calendar. On Android, if it won’t open, use “Google Calendar instead”.');
}

/* ---------- backup / restore ---------- */
async function backup() {
  await flush();
  const data = JSON.stringify({ app: 'hinton-water-disinfection-report', version: APP_VERSION, exported: new Date().toISOString(), streets: S.jobs.length, state: S }, null, 1);
  const name = `Hinton backup ${today()}.json`;
  const file = typeof File === 'function' ? new File([data], name, { type: 'application/json' }) : null;
  const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || isIOS();
  if (mobile && file && navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: name }); done(); return; }
    catch (e) { if (e && e.name === 'AbortError') return; }
  }
  saveFile(name, data, 'application/json'); done();
  function done() { S.meta.lastBackup = Date.now(); save(); toast('Backup saved', `${name}: ${S.jobs.length} street${S.jobs.length === 1 ? '' : 's'}.`); rerender(); }
}
async function restoreFrom(file) {
  let d; try { d = JSON.parse(await file.text()); } catch (e) { toast('That file can’t be read', 'Pick a backup file made by this app (it ends in .json).', true); return; }
  if (!d || d.app !== 'hinton-water-disinfection-report' || !d.state || !Array.isArray(d.state.jobs)) { toast('Not a backup file', 'That file wasn’t made by this app’s Back up button.', true); return; }
  const when = d.exported ? fmt(new Date(d.exported)) : 'an unknown date';
  if (!confirm(`Restore the backup from ${when}?\n\nIt has ${d.state.jobs.length} street(s). It will replace the ${S.jobs.length} street(s) on this device. You can undo this afterward.`)) return;
  await Store.put('beforeRestore', S);
  S = d.state; fixup(S); S.meta.lastBackup = Date.now(); markOldAlerts(); await flush();
  toast('Backup restored', `${S.jobs.length} street(s) loaded.`); go('#/');
}

/* ---------- copy ---------- */
async function copy(text, btn) {
  const old = btn.textContent;
  try { await navigator.clipboard.writeText(text); btn.textContent = 'Copied ✓'; }
  catch (e) { const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); btn.textContent = 'Copied ✓'; } catch (e2) { btn.textContent = 'Copy failed'; } ta.remove(); }
  setTimeout(() => { btn.textContent = old; }, 1500);
}

/* ---------- events ---------- */
function onSel(j, p, v) {
  const m = p.match(/^rounds\.(\d+)\.method$/);
  if (m && v === 'cf') {
    const ri = +m[1], rd = j.rounds[ri];
    if (!rd.cf.reason) rd.cf.reason = ri === 0 ? 'init' : j.labs.filter(l => l.ri === ri - 1).some(l => labEval(j, l).fails.some(f => RULES.bacterial.includes(f))) ? 'bact' : 'other';
    if (!rd.cf.flush.length) rd.cf.flush.push({ id: uid(), loc: '', dia: '', rate: '' });
  }
}
document.addEventListener('click', async e => {
  const fl = e.target.closest('[data-focus]');
  if (fl) { const f = fl.dataset.focus; setTimeout(() => { const el = document.getElementById('f-' + f.replace(/\./g, '-')); if (el) { el.scrollIntoView({ block: 'center' }); el.focus(); } }, 80); return; }
  const b = e.target.closest('button'); if (!b || b.closest('.toast')) return;
  const d = b.dataset, j = job();
  const ri = j ? (V.ri != null && j.rounds[V.ri] ? V.ri : cur(j)) : 0;
  if (d.yn && j) { setP(j, d.yn, getP(j, d.yn) === d.v ? '' : d.v); save(); rerender(); }
  else if (d.sel && j) { const was = getP(j, d.sel); setP(j, d.sel, was === d.v && !/\.method$/.test(d.sel) ? '' : d.v); onSel(j, d.sel, d.v); save(); rerender(); }
  else if (d.now && j) { setP(j, d.now, isoLocal(new Date())); save(); rerender(); }
  else if (d.tstart && j) { setP(j.rounds[cur(j)], RULES.timers[d.tstart].from, isoLocal(new Date())); save(); rerender(); }
  else if (d.tclear && j) { setP(j.rounds[cur(j)], RULES.timers[d.tclear].from, ''); save(); rerender(); }
  else if (d.ics && j) addToCalendar(j, d.ics);
  else if (d.feradd && j) { j.rounds[ri].ferrules.push({ loc: '', ppm: '' }); save(); render().then(() => { const el = document.getElementById(`fr-${ri}-${j.rounds[ri].ferrules.length - 1}-l`); el && el.focus(); }); }
  else if (d.ferdel && j) { j.rounds[ri].ferrules.splice(+d.ferdel, 1); save(); rerender(); }
  else if (d.ptadd && j) { const cf = j.rounds[ri].cf, L = d.ptadd === 'flush' ? cf.flush : cf.ver; L.push(d.ptadd === 'flush' ? { id: uid(), loc: '', dia: '', rate: '' } : { id: uid(), loc: '' }); save(); render().then(() => { const el = document.getElementById(`p${d.ptadd === 'flush' ? 'f' : 'v'}-${L.length - 1}-l`); el && el.focus(); }); }
  else if (d.ptdel && j) { const [k, i] = d.ptdel.split('|'), cf = j.rounds[ri].cf; (k === 'flush' ? cf.flush : cf.ver).splice(+i, 1); save(); rerender(); }
  else if (d.phase && j) { j.rounds[ri].cf.phase = d.phase; save(); rerender(); }
  else if (d.ev && j) {
    const rd = j.rounds[cur(j)], what = $('#ev-what').value, rate = $('#ev-rate').value.trim(), now = new Date();
    rd.cf.events.push({ t: now.getTime(), what, act: d.ev, rate });
    if (what === 'inj' && d.ev === 'start' && !rd.t.loaded) rd.t.loaded = isoLocal(now);
    if (what === 'inj' && d.ev === 'stop' && !rd.t.holdStart) { rd.t.holdStart = isoLocal(now); if (!rd.cf.phase || rd.cf.phase === 'feed') rd.cf.phase = 'hold'; }
    if (what !== 'inj' && d.ev === 'start' && rd.t.holdStart && !rd.t.flushStart) { rd.t.flushStart = isoLocal(now); rd.cf.phase = 'flush'; }
    toast(`${evWhat(rd, what)}: ${EV[d.ev]}`, `Logged at ${hm(now.getTime())}.`);
    save(); rerender();
  }
  else if (d.void && j) {
    if (b.dataset.armed) { const [r, p, i] = d.void.split('|'); const x = j.rounds[+r].cf.logs[p][+i]; x.void = true; x.voidAt = Date.now(); save(); rerender(); }
    else { b.dataset.armed = 1; b.textContent = 'Tap again'; }
  }
  else if (d.addlab && j) { const r = cur(j); j.labs.push({ id: uid(), ri: r, date: today(), point: '' }); save(); await render(); const el = document.getElementById(`l${j.labs.length - 1}-free`); el && el.scrollIntoView({ block: 'center' }); }
  else if (d.labdel && j) { if (b.dataset.armed) { j.labs.splice(+d.labdel, 1); save(); rerender(); } else { b.dataset.armed = 1; b.textContent = 'Tap again to delete'; } }
  else if (d.del && j) { if (b.dataset.armed) { S.jobs = S.jobs.filter(x => x !== j); save(); go('#/'); } else { b.dataset.armed = 1; b.textContent = 'Tap again to delete this street for good'; } }
  else if (d.rcpdel && j) { j.mail.extra = j.mail.extra.filter(x => x !== d.rcpdel); save(); rerender(); }
  else if (d.grcpdel) { S.settings.recipients = S.settings.recipients.filter(x => x !== d.grcpdel); save(); rerender(); }
  else if (d.tagdel) { S.settings.tags = S.settings.tags.filter(x => x !== d.tagdel); save(); rerender(); }
  else if (d.copy && j) { const m = mailParts(j); copy(d.copy === 'to' ? m.to.join('; ') : d.copy === 'subject' ? m.subject : d.copy === 'body' ? m.text : `To: ${m.to.join('; ')}\n\nSubject: ${m.subject}\n\n${m.text}`, b); }
  else if (d.act === 'resample' && j) { j.rounds.push(newRound('resample')); save(); go(`#/job/${j.id}/steps`); }
  else if (d.act === 'unmethod' && j) { if (confirm('Pick the method again? Answers already entered are kept.')) { j.rounds[0].method = null; save(); rerender(); } }
  else if (d.act === 'print') window.print();
  else if (d.act === 'backup') backup();
  else if (d.act === 'snooze') { S.meta.snoozed = Date.now(); save(); rerender(); }
  else if (d.act === 'restore') $('#restore-file').click();
  else if (d.act === 'undo') { const u = await Store.get('beforeRestore'); if (u && confirm('Put back the data you had before the last restore?')) { await Store.put('beforeRestore', null); S = u; fixup(S); await flush(); toast('Restore undone', ''); go('#/'); } }
  else if (d.act === 'notif') { try { await Notification.requestPermission(); } catch (e2) {} rerender(); }
  else if (d.act === 'testbeep') { beep(); try { navigator.vibrate && navigator.vibrate(300); } catch (e2) {} }
  else if (d.act === 'wipe') { if (confirm('Erase every street on this device? Make a backup first if you might want it.') && confirm('Are you sure? This can’t be undone.')) { S = blankState(); await flush(); go('#/'); } }
  else if (d.act === 'update') { const w = window.__waiting; if (w) w.postMessage('skip'); else location.reload(); }
});
document.addEventListener('change', e => {
  const t = e.target;
  if (t.id === 'restore-file') { const f = t.files && t.files[0]; t.value = ''; if (f) restoreFrom(f); return; }
  if (t.dataset.mk) { setP(S.meta, t.dataset.mk, t.value); save(); rerender(); return; }
  const j = job();
  if (t.dataset.rcp && j) { const em = t.dataset.rcp; j.mail.off = t.checked ? j.mail.off.filter(x => x !== em) : [...new Set([...j.mail.off, em])]; save(); rerender(); return; }
  const k = t.dataset.k; if (!k || !j) return;
  setP(j, k, t.tagName === 'TEXTAREA' ? t.value : t.value.trim()); save(); rerender();
});
document.addEventListener('input', e => { const t = e.target, j = job(); if (t.tagName === 'TEXTAREA' && t.dataset.k && j) { setP(j, t.dataset.k, t.value); save(); } });
document.addEventListener('submit', e => {
  e.preventDefault(); const f = e.target, v = id => ($('#' + id)?.value || '').trim(), j = job();
  if (f.id === 'addf') {
    if (!v('a-st')) return;
    const nj = newJob(v('a-st'), v('a-from'), v('a-to')); S.jobs.push(nj); S.meta.firstData ??= Date.now(); save(); go(`#/job/${nj.id}/info`);
  } else if (f.id === 'rcpf') { const em = v('rcp-new'); if (em && j && /.+@.+\..+/.test(em)) { j.mail.extra = [...new Set([...j.mail.extra, em])]; j.mail.off = j.mail.off.filter(x => x !== em); save(); rerender(); } }
  else if (f.id === 'grcpf') {
    const ems = v('grcp-new').split(/[\s,;]+/).map(x => x.replace(/^<|>$/g, '')).filter(x => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x));
    if (ems.length) { S.settings.recipients = [...new Set([...S.settings.recipients, ...ems])]; save(); rerender(); }
  }
  else if (f.id === 'notef' && j) {
    const text = $('#n-text').value.trim(); if (!text) return;
    const tags = [...f.querySelectorAll('input[name=tag]:checked')].map(x => x.value), nt = v('n-newtag');
    if (nt) { tags.push(nt); if (!RULES.tags.includes(nt)) S.settings.tags = [...new Set([...S.settings.tags, nt])]; }
    j.log.push({ id: uid(), t: Date.now(), ri: cur(j), stage: v('n-stage'), tags: [...new Set(tags)], text });
    save(); rerender(); toast('Note added', '');
  }
  else if (f.dataset.pt && j) {
    const ri = +f.dataset.ri, rd = j.rounds[ri], pt = f.dataset.pt, ppm = num(v(`rd-${pt}`));
    if (ppm === null) return;
    const now = new Date();
    (rd.cf.logs[pt] ??= []).push({ t: now.getTime(), ppm, ph: cfStatus(rd).phase, note: v(`rn-${pt}`) });
    rd.cf.lastRead = isoLocal(now);
    save(); rerender();
  }
});
addEventListener('focus', () => { if (V.page === 'home') rerender(); });
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') tick(); });

/* ---------- offline + updates ---------- */
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').then(reg => {
    const offer = w => { window.__waiting = w; const bar = $('#update'); bar.hidden = false; };
    if (reg.waiting && navigator.serviceWorker.controller) offer(reg.waiting);
    reg.addEventListener('updatefound', () => { const w = reg.installing; w && w.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) offer(w); }); });
    setInterval(() => reg.update().catch(() => {}), 60 * 60 * 1000);
  }).catch(() => {});
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (!reloaded) { reloaded = true; flush().finally(() => location.reload()); } });
}

route(); render();
})();
