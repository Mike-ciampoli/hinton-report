/* Hinton Water Disinfection Report: the app.
   Built from the original prototype. Saving on the device is in store.js. */
'use strict';
(async () => {

/* ---------- helpers ---------- */
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = v => (v === '' || v == null || isNaN(+v) ? null : +v);
const p2 = n => String(n).padStart(2, '0');
const iso = d => d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()) + 'T' + p2(d.getHours()) + ':' + p2(d.getMinutes());
const today = () => iso(new Date()).slice(0, 10);
const parse = s => { if (!s) return null; const d = new Date(s.length === 10 ? s + 'T00:00' : s); return isNaN(d) ? null : d; };
const fmt = d => d.toLocaleString([], { weekday: 'short', month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit' });
const mdy = s => { const d = parse(s); if (!d) return ''; return p2(d.getMonth() + 1) + '/' + p2(d.getDate()) + '/' + d.getFullYear() + (s.length > 10 ? ' ' + p2(d.getHours()) + ':' + p2(d.getMinutes()) : ''); };
const get = (o, k) => k.split('.').reduce((a, b) => (a == null ? a : a[b]), o);
const set = (o, k, v) => { const ks = k.split('.'), l = ks.pop(); ks.reduce((a, b) => (a[b] ??= {}), o)[l] = v; };
const uid = () => Math.random().toString(36).slice(2, 10);
const dur = ms => { if (ms == null || isNaN(ms)) return ''; const m = Math.round(Math.abs(ms) / 6e4), d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60), mm = m % 60; return (ms < 0 ? '−' : '') + (d ? `${d} d ${h} h` : h ? `${h} h ${mm} m` : `${mm} m`); };
const FOOT = ['© 2026 Michael E. Ciampoli. All rights reserved. Created with help from Claude by Anthropic.',
  'Field aid only; not affiliated with the Philadelphia Water Department. BLS lab results are the official record.'];
const footer = () => `<footer class="foot">${FOOT.map(t => `<p>${esc(t)}</p>`).join('')}</footer>`;
const BLS_PHONE = '(215) 685-1421';

/* ---------- data (saved on this device only) ---------- */
const KEY = 'state3';
const blank = () => ({ v: 3, jobs: [], settings: { recipients: [] }, meta: { lastBackup: null } });
function mk(street, from, to) {
  return { id: uid(), street, from, to,
    f: { sampleDate: '', contractor: '', contractorEmail: '', work: '', inspector: '', phone: '', engineer: '', engEmail: '', mfr: '', length: '', dia: '', flushPipe: '', nFlush: '', flushLoc: '', nSamples: '', delivered: '' },
    c: {}, r: { srcTotal: '', lube: '', tablets: '', granules: '', waterT: '', airT: '', weather: '', dissolve: '', hold: '', afterFlush: '', refill: '' },
    t: { loaded: '', flushStart: '', shutdown: '' }, labs: [], notes: '', mailReq: '' };
}
const LABKEYS = ['free', 'total', 'ph', 'turb', 'odor', 'coli', 'ecoli', 'hpc'];
const lab = date => Object.assign({ date }, Object.fromEntries(LABKEYS.map(k => [k, ''])));

/* Turn a version 1.x save or backup into this shape. Nothing is thrown away on the device. */
function fromV1(old) {
  const s = blank();
  s.settings.recipients = (old.settings && old.settings.recipients) || [];
  s.meta.lastBackup = (old.meta && old.meta.lastBackup) || null;
  for (const o of old.jobs || []) {
    const j = mk(o.street || '', o.from || '', o.to || ''); j.id = o.id || j.id;
    Object.assign(j.f, o.f || {});
    const r0 = (o.rounds && o.rounds[0]) || o;
    Object.assign(j.c, r0.c || {}); Object.assign(j.r, r0.r || {}); Object.assign(j.t, r0.t || {});
    j.labs = (o.labs || []).map(l => Object.assign(lab(l.date || ''), Object.fromEntries(LABKEYS.map(k => [k, l[k] ?? '']))));
    const notes = [];
    if (typeof o.notes === 'string' && o.notes.trim()) notes.push(o.notes.trim());
    for (const n of o.log || []) if (n.text) notes.push((n.t ? mdy(iso(new Date(n.t))) + '  ' : '') + n.text);
    j.notes = notes.join('\n\n');
    s.jobs.push(j);
  }
  return s;
}
function fixup(s) {
  s.settings ??= {}; s.settings.recipients ??= []; s.meta ??= {};
  for (const j of s.jobs) { const b = mk(); for (const k of ['f', 'c', 'r', 't']) j[k] = Object.assign(b[k], j[k] || {}); j.labs ??= []; j.notes ??= ''; j.mailReq ??= ''; }
  return s;
}
let S = await Store.get(KEY);
if (!S || !Array.isArray(S.jobs)) {
  const old = await Store.get('state');
  S = old && Array.isArray(old.jobs) ? fromV1(old) : blank();
  await Store.put(KEY, S).catch(() => {});
}
fixup(S);
let saveT = null;
const flush = () => { clearTimeout(saveT); saveT = null; return Store.put(KEY, S).catch(() => toast('Could not save. The device may be out of space. Make a backup now.')); };
const save = () => { clearTimeout(saveT); saveT = setTimeout(flush, 250); };
addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && saveT) flush(); });
addEventListener('pagehide', () => { if (saveT) flush(); });
Store.persist();

let V = { page: 'home', id: null, sec: 'info' };
try { Object.assign(V, JSON.parse(sessionStorage.getItem('hwdr-v') || '{}')); } catch (e) {}
let pick = { an: false, ids: [] };

/* ---------- PWD rules ---------- */
const holdH = j => (num(j.r.waterT) != null && +j.r.waterT < 41 ? 48 : 24);
function until(from, h, label) {
  if (!from) return ''; const t = new Date(from).getTime() + h * 3600e3, m = Math.round((t - Date.now()) / 6e4);
  return m <= 0 ? `<span class="b ok">${label} since ${fmt(new Date(t))}</span>` : `<span class="b warn">${label} ${fmt(new Date(t))} · ${Math.floor(m / 60)} h ${m % 60} m left</span>`;
}
const totalOk = (v, j) => v > 1 && (num(j.r.srcTotal) == null || j.r.srcTotal - v <= 0.5);
const P = [
  ['free', 'Free chlorine', 'mg/L', () => '0.10 or less', v => v <= 0.10],
  ['total', 'Total chlorine', 'mg/L', () => 'Above 1.00 and within 0.50 of the main', totalOk],
  ['ph', 'pH', '', () => '7.0 to 7.4', v => v >= 7 && v <= 7.4],
  ['turb', 'Turbidity', 'NTU', () => 'Below 0.400', v => v < 0.4],
  ['odor', 'Odor', '0 or 1', () => '0, no unusual odor', v => v == 0],
  ['coli', 'Total coliforms', '0 or 1', () => '0, absent', v => v == 0],
  ['ecoli', 'E. coli', '0 or 1', () => '0, absent', v => v == 0],
  ['hpc', 'HPC', 'MPN/mL', i => (i ? '6 or less (resample)' : 'Below 50 (initial)'), (v, j, i) => (i ? v <= 6 : v < 50)]];
const labName = i => (i ? 'Resample ' + i : 'Initial');
function labRes(a, j, i) { let fails = [], missing = 0; for (const p of P) { const n = num(a[p[0]]); if (n == null) { missing++; continue; } if (!p[4](n, j, i)) fails.push(p[1]); } return { fails, pass: missing ? (fails.length ? false : null) : !fails.length }; }
function status(j) {
  const L = j.labs;
  if (L.length) { const r = labRes(L[L.length - 1], j, L.length - 1); if (r.pass === true) return ['Passed', 'ok']; if (r.pass === false) return ['Resample needed', 'bad']; return ['Waiting on lab', 'warn']; }
  if (j.t.shutdown) return ['16-hr hold', 'warn']; if (j.t.flushStart) return ['Flushing', 'warn']; if (j.t.loaded) return ['Disinfecting', 'warn']; return ['Getting ready', ''];
}
const released = j => { const i = j.labs.findIndex((a, k) => labRes(a, j, k).pass === true); return i < 0 ? null : { i, date: j.labs[i].date }; };

const G = [
  { g: 'Preventive measures', items: [
    { k: 'c.p1', t: 'yn', q: 'Pipe strung out on cribs at least 6 in above ground' },
    { k: 'c.p2', t: 'yn', q: 'Pipe capped, wrapped or sealed at all times before install' },
    { k: 'c.p3', t: 'yn', q: 'Seals stayed in place until the trench was dry' },
    { k: 'c.p4', t: 'yn', q: 'Joints, pipe interior and fittings inspected; any dirt swabbed or sprayed with disinfecting solution' },
    { k: 'c.p5', t: 'yn', q: 'Interior coatings found tacky before install', good: 'N' },
    { k: 'r.lube', t: 'text', q: 'Pipe joint lubricant (brand)' },
    { k: 'c.p6', t: 'yn', q: 'Lubricant in closed containers, kept clean, dedicated disposable brushes' },
    { k: 'c.p7', t: 'yn', q: 'Supply main flushed at least 15 minutes before filling' },
    { k: 'r.srcTotal', t: 'num', u: 'ppm', q: 'Source water TOTAL chlorine (baseline)', hint: 'City water averaged about 1.5 to 2.5 ppm in 2025. Saved for the refill and lab checks.', ok: v => v >= 1 }] },
  { g: 'Disinfection', items: [
    { k: 't.loaded', t: 'time', q: 'Main loaded (tablets in, fill started)' },
    { k: 'r.tablets', t: 'num', u: 'per pipe', q: 'Calcium hypochlorite tablets' },
    { k: 'r.granules', t: 'yn', q: 'Chlorine granules added too', good: null },
    { k: 'c.d1', t: 'yn', q: 'Valves set so chlorine cannot reach active mains' },
    { k: 'c.d2', t: 'yn', q: 'Fill velocity no more than 1 ft/s' },
    { k: 'r.waterT', t: 'num', u: '°F', q: 'Water temperature', hint: 'Below 41°F the hold becomes 48 hours.' },
    { k: 'r.airT', t: 'num', u: '°F', q: 'Outside air temperature' },
    { k: 'r.weather', t: 'text', q: 'Weather' },
    { k: 'r.dissolve', t: 'num', u: 'ppm', q: 'FREE chlorine after tablets dissolve', hint: 'At least 25 ppm. About 7 hrs in normal temps, longer when cold. Bleed off some water to spread it.', ok: v => v >= 25, at: j => until(j.t.loaded, 7, 'Test') },
    { k: 'r.hold', t: 'num', u: 'ppm', q: j => `FREE chlorine after ${holdH(j)}-hour hold`, hint: 'At least 10 ppm.', ok: v => v >= 10, at: j => until(j.t.loaded, holdH(j), 'Hold done') }] },
  { g: 'Flushing and release', items: [
    { k: 't.flushStart', t: 'time', q: 'Flushing started' },
    { t: 'calc' },
    { k: 'c.f1', t: 'yn', q: 'Flush velocity at least 3 ft/s' },
    { k: 'c.f2', t: 'yn', q: 'At least 3 pipe volumes flushed at the end of the main' },
    { k: 'c.f3', t: 'yn', q: 'Approved backflow preventer on hydrant connections' },
    { k: 'c.f4', t: 'yn', q: 'Chlorinated water to sanitary sewer through an air gap, or dechlorinated' },
    { k: 'r.afterFlush', t: 'num', u: 'ppm', q: 'FREE chlorine after flushing', hint: 'Should be none left.', ok: v => v <= 0.1 },
    { k: 'r.refill', t: 'num', u: 'ppm', q: 'TOTAL chlorine after refill', hint: 'Above 1.0 and no more than 0.5 below your baseline.', ok: totalOk },
    { k: 't.shutdown', t: 'time', q: 'Shut down for the 16-hour hold', at: j => until(j.t.shutdown, 16, 'Ready to sample') },
    { k: 'c.f5', t: 'yn', q: `Called BLS before the 16-hour hold: ${BLS_PHONE}` },
    { k: 'c.f6', t: 'yn', q: 'Signed form and sketch sent as PDF (reply all to BLS)' },
    { k: 'c.f7', t: 'yn', q: 'Copper tubing on sample points before BLS arrives' }] }];
const ITEMS = G.flatMap(g => g.items).filter(i => i.k);
const qText = (it, j) => (typeof it.q === 'function' ? it.q(j) : it.q);
function state(j, it) {
  const v = get(j, it.k);
  if (it.t === 'yn') { if (!v || it.good === null) return ''; return v === (it.good || 'Y') ? 'ok' : 'bad'; }
  if (it.t === 'num' && it.ok) { const n = num(v); return n == null ? '' : it.ok(n, j) ? 'ok' : 'bad'; }
  return '';
}
function progress(j) { let d = 0, b = 0; for (const it of ITEMS) { if (get(j, it.k)) d++; if (state(j, it) === 'bad') b++; } return { d, b, n: ITEMS.length }; }

/* ---------- street screens ---------- */
const FIELDS = [['street', 'Street name'], ['from', 'From'], ['to', 'To'], ['f.work', 'Work #'], ['f.sampleDate', 'Sample date requested', 'date'], ['f.contractor', 'Contractor'], ['f.contractorEmail', 'Contractor email', 'email'], ['f.inspector', 'Inspector'], ['f.phone', 'Inspector phone', 'tel'], ['f.engineer', 'Division engineer'], ['f.engEmail', 'Division engineer email', 'email'], ['f.mfr', 'Pipe manufacturer'], ['f.delivered', 'Pipe delivered to site', 'date'], ['f.length', 'Pipe length (ft)', 'number'], ['f.dia', 'Pipe diameter (in)', 'number'], ['f.flushPipe', 'Flushing pipe size (in)', 'number'], ['f.nFlush', 'Number of flushing locations', 'number'], ['f.flushLoc', 'Flushing location(s)'], ['f.nSamples', 'Number of samples requested', 'number']];
const fid = k => 'in-' + k.replace(/\./g, '-');

function item(j, it) {
  if (it.t === 'calc') return calc(j);
  const v = get(j, it.k), q = qText(it, j), st = state(j, it), id = fid(it.k); let ctl = '';
  if (it.t === 'yn') ctl = `<div class="yn">${['Y', 'N'].map(x => `<button data-yn="${it.k}" data-v="${x}" class="${v === x ? 'on' : ''}" aria-pressed="${v === x}">${x === 'Y' ? 'Yes' : 'No'}</button>`).join('')}</div>`;
  else if (it.t === 'num') ctl = `<div class="nw"><input id="${id}" data-k="${it.k}" type="number" step="any" inputmode="decimal" value="${esc(v)}" aria-label="${esc(q)}"><span>${it.u}</span></div>`;
  else if (it.t === 'time') ctl = `<input id="${id}" data-k="${it.k}" type="datetime-local" value="${esc(v)}" aria-label="${esc(q)}">`;
  else ctl = `<input id="${id}" data-k="${it.k}" value="${esc(v)}" aria-label="${esc(q)}">`;
  return `<div class="it ${st}"><div class="q"><span class="dot"></span><div><b>${esc(q)}</b>${it.hint ? `<small>${it.hint}</small>` : ''}${it.at ? it.at(j) : ''}${st === 'bad' ? `<small class="fix">${it.t === 'yn' ? 'Write the corrective action in Notes before asking for a sample.' : 'Out of range. Fix before calling BLS.'}</small>` : ''}</div></div>${ctl}</div>`;
}
function calc(j) {
  const L = num(j.f.length), D = num(j.f.dia);
  if (!L || !D) return `<div class="calc"><div>Enter pipe length and diameter under Job info to see the flush target.</div></div>`;
  const gal = 0.0408 * D * D * L, gpm = 7.34 * D * D;
  return `<div class="calc"><div>One pipe volume<strong>${Math.round(gal).toLocaleString()} gal</strong></div><div>Flush 3 volumes<strong>${Math.round(gal * 3).toLocaleString()} gal</strong></div><div>Flow for 3 ft/s in ${D}" main<strong>${Math.round(gpm).toLocaleString()} gpm</strong></div><div>Rule of thumb, 2 min per 100 ft<strong>${Math.max(1, Math.round(L / 50))} min</strong></div></div>`;
}
function info(j) {
  return `<div class="form">${FIELDS.map(([k, l, t]) => `<div><label for="${fid(k)}">${l}</label><input id="${fid(k)}" data-k="${k}" ${t ? `type="${t}"` : ''} ${t === 'number' ? 'inputmode="decimal" step="any"' : ''} value="${esc(get(j, k))}"></div>`).join('')}</div>
<p style="margin-top:24px"><button class="btn red" id="del" data-del="${j.id}">Delete this street</button></p>`;
}
function labs(j) {
  const L = j.labs;
  const h = L.map((a, i) => {
    const r = labRes(a, j, i);
    return `<div class="lab"><h3><span>${labName(i)} <input type="date" data-k="labs.${i}.date" id="in-lab${i}-date" value="${esc(a.date)}" style="width:auto;display:inline-block;margin-left:8px" aria-label="Sample date"></span>${r.pass === true ? '<span class="b ok">Passed</span>' : r.pass === false ? `<span class="b bad">Failed: ${esc(r.fails.join(', '))}</span>` : '<span class="b warn">Enter all results</span>'}</h3>
<table class="stack"><thead><tr><th>Parameter</th><th>Acceptable</th><th>Result</th><th></th></tr></thead><tbody>${P.map(p => {
      const n = num(a[p[0]]), ok = n == null ? '' : p[4](n, j, i), id = `in-lab${i}-${p[0]}`;
      const ctl = p[2] === '0 or 1' ? `<select id="${id}" data-k="labs.${i}.${p[0]}" aria-label="${p[1]}"><option value=""${a[p[0]] === '' ? ' selected' : ''}>—</option><option value="0"${a[p[0]] === '0' ? ' selected' : ''}>0, absent</option><option value="1"${a[p[0]] === '1' ? ' selected' : ''}>1, present</option></select>`
        : `<input id="${id}" data-k="labs.${i}.${p[0]}" type="number" step="any" inputmode="decimal" value="${esc(a[p[0]])}" aria-label="${p[1]}">`;
      return `<tr><td><b>${p[1]}</b> <span class="mut">${p[2]}</span></td><td>${p[3](i)}</td><td>${ctl}</td><td>${ok === '' ? '' : ok ? '<span class="b ok">OK</span>' : '<span class="b bad">Fail</span>'}</td></tr>`;
    }).join('')}</tbody></table></div>`;
  }).join('');
  return (h || '<p class="mut">No lab results yet. Add them when BLS emails the report.</p>') + `<button class="btn" data-addlab="1">${L.length ? 'Add resample result' : 'Add initial result'}</button>`;
}

/* Which request this email is for: Initial, then Resample 1, 2, 3 after each failed result. */
function autoReq(j) { const L = j.labs; if (!L.length) return 0; return labRes(L[L.length - 1], j, L.length - 1).pass === false ? L.length : L.length - 1; }
const reqOf = j => (j.mailReq === '' || j.mailReq == null ? autoReq(j) : +j.mailReq);
function mailParts(j) {
  const f = j.f, ri = reqOf(j);
  const to = S.settings.recipients.concat(f.contractorEmail ? [f.contractorEmail] : []).join('; ');
  const sub = `Water Sample, ${labName(ri)} Request (${f.work || 'Work #'})`;
  const body = [['Sample Date Requested', mdy(f.sampleDate)], ['Contractor', f.contractor], ['Work #', f.work], ['Inspector', f.inspector], ['Inspector Phone #', f.phone], ['Division Engineer', f.engineer], ['Division Engineer Email', f.engEmail], ['Street Location of Main', `On ${j.street}, from ${j.from} to ${j.to}`], ['# of Flushing Locations', f.nFlush], ['Flushing Location', f.flushLoc], ['# of Samples Requested', f.nSamples], ['Length (feet)', f.length], ['Diameter (inches)', f.dia], ['Flushing Pipe Size (inches)', f.flushPipe], ['Date/Time Loaded for Disinfection', mdy(j.t.loaded)], ['Date/Time Flushing Started', mdy(j.t.flushStart)], ['Date/Time of Shutdown for Sanitary Release Testing', mdy(j.t.shutdown)]];
  return { ri, to, sub, body, txt: body.map(b => b[0] + ': ' + (b[1] || '')).join('\n'), miss: body.filter(b => !b[1]).map(b => b[0]) };
}
function mail(j) {
  const m = mailParts(j), n = Math.max(j.labs.length, m.ri) + 1;
  const opts = `<option value=""${j.mailReq === '' ? ' selected' : ''}>Automatic (${labName(autoReq(j))})</option>` + Array.from({ length: n }, (_, i) => `<option value="${i}"${j.mailReq !== '' && +j.mailReq === i ? ' selected' : ''}>${labName(i)}</option>`).join('');
  return `<div class="mail">${m.miss.length ? `<p class="b warn" style="white-space:normal">Still blank: ${esc(m.miss.join(', '))}</p>` : '<p class="b ok">Every required field is filled in</p>'}
<label for="m-req">Request</label><select id="m-req" data-req="1">${opts}</select>
<label>To</label><pre id="m-to">${esc(m.to) || '<span class="mut">No recipients yet. Add the PWD list once under “Email recipients” on the Streets screen.</span>'}</pre><button class="btn ghost" data-copy="m-to">Copy recipients</button>
<label>Subject</label><pre id="m-sub">${esc(m.sub)}</pre><button class="btn ghost" data-copy="m-sub">Copy subject</button>
<label>Body</label><pre id="m-body">${esc(m.txt)}</pre><button class="btn ghost" data-copy="m-body">Copy body</button>
<p class="sample">Paste these into your email app. After shutdown, reply all to BLS's acknowledgement with the signed form and sketch as a PDF.</p></div>`;
}

/* Mini analysis for one street */
function jobAn(j) {
  const T = s => parse(s)?.getTime() ?? null;
  const ld = T(j.t.loaded), fs = T(j.t.flushStart), sd = T(j.t.shutdown), rel = released(j);
  const ev = [];
  const add = (label, t, note, todo) => ev.push({ label, t, note, todo });
  add('Main loaded', ld, ld ? fmt(new Date(ld)) : 'Not entered yet', !ld);
  add(`${holdH(j)}-hour hold done`, ld ? ld + holdH(j) * 3600e3 : null, ld ? fmt(new Date(ld + holdH(j) * 3600e3)) : 'After loading', !ld || ld + holdH(j) * 3600e3 > Date.now());
  add('Flushing started', fs, fs ? fmt(new Date(fs)) + (ld ? ` · ${dur(fs - ld)} after loading` : '') : 'Not entered yet', !fs);
  add('Shut down for 16-hour hold', sd, sd ? fmt(new Date(sd)) + (fs ? ` · flushed ${dur(sd - fs)}` : '') : 'Not entered yet', !sd);
  let prev = sd;
  j.labs.forEach((a, i) => {
    const t = T(a.date), r = labRes(a, j, i);
    const res = r.pass === true ? 'Passed' : r.pass === false ? 'Failed: ' + r.fails.join(', ') : 'Results not complete';
    add(i ? labName(i) : 'Initial sample', t, (t ? new Date(t).toLocaleDateString() : 'No date') + ` · ${res}` + (t && prev ? ` · ${dur(t - prev)} after ${i ? 'last sample' : 'shutdown'}` : ''), false);
    if (t) prev = t;
  });
  const rt = rel ? T(rel.date) : null;
  add('Released', rt, rel ? `${new Date(rt).toLocaleDateString()} · passed on ${labName(rel.i).toLowerCase()}` : 'Waiting for a passing result', !rel);
  const total = ld && rt ? `<p><b>Loaded to released:</b> ${dur(rt - ld)} (lab dates have no time, so this counts to midnight of the sample day)</p>` : '';

  const rowC = (label, v, target, ok) => { const n = num(v); return `<tr><td><b>${label}</b></td><td>${n == null ? '<span class="mut">—</span>' : esc(v) + ' ppm'}</td><td>${target}</td><td>${n == null ? '' : ok(n) ? '<span class="b ok">OK</span>' : '<span class="b bad">Off target</span>'}</td></tr>`; };
  const rows = [rowC('Source water total (baseline)', j.r.srcTotal, '1.0 or more', v => v >= 1),
    rowC('Free after tablets dissolve', j.r.dissolve, '25 or more', v => v >= 25),
    rowC(`Free after ${holdH(j)}-hour hold`, j.r.hold, '10 or more', v => v >= 10),
    rowC('Free after flushing', j.r.afterFlush, '0.10 or less', v => v <= 0.1),
    rowC('Total after refill', j.r.refill, 'Above 1.0, within 0.5 of baseline', v => totalOk(v, j))];
  j.labs.forEach((a, i) => { rows.push(rowC(`${labName(i)}: free (lab)`, a.free, '0.10 or less', v => v <= 0.1)); rows.push(rowC(`${labName(i)}: total (lab)`, a.total, 'Above 1.00, within 0.50 of main', v => totalOk(v, j))); });

  const res = j.labs.map((a, i) => labRes(a, j, i)), nPass = res.filter(r => r.pass === true).length, nFail = res.filter(r => r.pass === false).length;
  const cnt = {}; res.forEach(r => r.fails.forEach(f => (cnt[f] = (cnt[f] || 0) + 1)));
  const v = (x, u) => (x === '' || x == null ? '—' : esc(x) + (u || ''));
  return `<div class="kpis"><div class="kpi"><strong>${j.labs.length}</strong><span>Samples taken</span></div><div class="kpi"><strong>${nFail}</strong><span>Failed</span></div><div class="kpi"><strong>${v(j.r.waterT, '°')}</strong><span>Water °F</span></div><div class="kpi"><strong>${v(j.r.airT, '°')}</strong><span>Air °F</span></div></div>
<p><b>Weather:</b> ${v(j.r.weather)} · <b>Hold:</b> ${holdH(j)} hrs · <b>Tablets:</b> ${v(j.r.tablets)} · <b>Granules:</b> ${j.r.granules === 'Y' ? 'Yes' : j.r.granules === 'N' ? 'No' : '—'}${Object.keys(cnt).length ? ` · <b>Failed on:</b> ${esc(Object.entries(cnt).map(([k, n]) => n > 1 ? `${k} (${n})` : k).join(', '))}` : ''}</p>
<h3 class="h3" style="margin-top:18px">Timeline</h3>
<ol class="tl">${ev.map(e => `<li class="${e.todo ? 'todo' : ''}"><b>${e.label}</b><small>${esc(e.note)}</small></li>`).join('')}</ol>${total}
<h3 class="h3" style="margin-top:18px">Chlorine readings vs targets</h3>
<table class="stack"><thead><tr><th>Reading</th><th>Result</th><th>Target</th><th></th></tr></thead><tbody>${rows.join('')}</tbody></table>`;
}

function detail(j) {
  const [s, c] = status(j), pr = progress(j), secs = [['info', 'Job info'], ['steps', 'Steps'], ['lab', 'Lab results'], ['email', 'Email'], ['notes', 'Notes'], ['an', 'Analysis']];
  let body = '';
  if (V.sec === 'steps') body = G.map(g => `<section class="grp"><h3>${g.g}</h3>${g.items.map(it => item(j, it)).join('')}</section>`).join('');
  else if (V.sec === 'lab') body = labs(j); else if (V.sec === 'email') body = mail(j);
  else if (V.sec === 'notes') body = `<label for="in-notes" class="mut">Notes, corrective actions, anything unusual</label><textarea id="in-notes" data-k="notes">${esc(j.notes)}</textarea>`;
  else if (V.sec === 'an') body = jobAn(j) + footer();
  else body = info(j);
  return `<button class="back" data-go="home">← All streets</button><h2 style="font-size:clamp(28px,5vw,40px)">${esc(j.street)}</h2><div class="mut">${esc(j.from)} to ${esc(j.to)} · Work #${esc(j.f.work)} · ${esc(j.f.length || '?')} ft of ${esc(j.f.dia || '?')}"</div>
<div class="sum"><span class="b ${c}">${s}</span><span class="b">${pr.d} of ${pr.n} steps filled</span>${pr.b ? `<span class="b bad">${pr.b} flagged</span>` : ''}<span class="b">Hold: ${holdH(j)} hrs</span></div>
<div class="secs" role="tablist">${secs.map(([k, l]) => `<button role="tab" data-sec="${k}" class="${V.sec === k ? 'on' : ''}" aria-selected="${V.sec === k}">${l}</button>`).join('')}</div>${body}`;
}

/* ---------- home ---------- */
let installEvt = null;
const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
let undoAvail = false;
function home() {
  const js = S.jobs, lb = S.meta.lastBackup, n = S.settings.recipients.length;
  return `<div class="top"><h2>Streets <span class="mut" style="font-size:18px">${js.length}</span></h2><span class="mut">${js.length ? 'Tap a tab to open its folder' : ''}</span></div>
${js.length ? `<div id="idx">${js.map((j, i) => { const L = 24 + (i % 8) * 5.5, dark = L < 48, [s, c] = status(j); return `<button class="tab" data-open="${j.id}" style="background:hsl(${206 - (i % 8) * 2} 78% ${L}%);color:${dark ? '#fff' : '#06203a'}"><span><span class="nm">${esc(j.street)}</span><small>${j.from || j.to ? esc(j.from) + ' to ' + esc(j.to) : '&nbsp;'}</small></span><span class="chip"><i class="${c}"></i>${s}</span></button>`; }).join('')}</div><div class="drawer"></div>`
    : '<div class="empty">No streets yet. Add your first one below.</div>'}
<form class="add" id="addf"><input id="a-st" placeholder="Street name" aria-label="Street name" required><input id="a-from" placeholder="From" aria-label="From"><input id="a-to" placeholder="To" aria-label="To"><button class="btn">Add street</button></form>
<p class="sample">Your entries stay on this device.</p>
<div class="tools"><button class="btn ghost" data-act="backup">Back up</button><button class="btn ghost" data-act="restore">Restore</button>${undoAvail ? '<button class="btn ghost" data-act="undo">Undo restore</button>' : ''}${installEvt ? '<button class="btn ghost" data-act="install">Install app</button>' : ''}
<span class="sample" style="margin:0">Last backup: ${lb ? esc(fmt(new Date(lb))) : 'never'}</span>
<input type="file" id="restore-file" accept=".json,application/json" hidden>
${isIOS() && !standalone() ? '<p class="sample" style="flex-basis:100%">To install on iPhone: tap Share, then Add to Home Screen.</p>' : ''}
<details><summary>Email recipients (${n})</summary><p class="sample">The PWD list used on every street's Email page. Saved on this device only and included in backups. Paste the whole list; commas, semicolons or new lines between addresses are fine.</p><textarea id="rcp" data-rcp="1" aria-label="Email recipients">${esc(S.settings.recipients.join('\n'))}</textarea></details></div>`;
}

/* ---------- full analysis ---------- */
function analysis() {
  const D = S.jobs.filter(j => j.labs.length && labRes(j.labs[0], j, 0).pass !== null);
  const first = j => labRes(j.labs[0], j, 0).pass, rate = a => (a.length ? Math.round(100 * a.filter(first).length / a.length) + '%' : '—');
  const cold = D.filter(j => num(j.r.waterT) != null && +j.r.waterT < 41), warm = D.filter(j => num(j.r.waterT) != null && +j.r.waterT >= 41);
  const gr = D.filter(j => j.r.granules === 'Y'), tb = D.filter(j => j.r.granules === 'N');
  const cnt = {}; for (const j of S.jobs) j.labs.forEach((a, i) => labRes(a, j, i).fails.forEach(f => (cnt[f] = (cnt[f] || 0) + 1)));
  const mx = Math.max(1, ...Object.values(cnt)), tries = D.length ? (D.reduce((s, j) => s + j.labs.length, 0) / D.length).toFixed(1) : '—';
  return `<div class="top"><h2>What makes samples pass</h2><span class="mut">${D.length} streets with lab results</span></div>
<div class="kpis"><div class="kpi"><strong>${rate(D)}</strong><span>Passed on the first sample</span></div><div class="kpi"><strong>${tries}</strong><span>Samples per main, on average</span></div><div class="kpi"><strong>${rate(cold)}</strong><span>First-try pass, water below 41°F (${cold.length})</span></div><div class="kpi"><strong>${rate(warm)}</strong><span>First-try pass, water 41°F and up (${warm.length})</span></div><div class="kpi"><strong>${rate(gr)}</strong><span>Tablets plus granules (${gr.length})</span></div><div class="kpi"><strong>${rate(tb)}</strong><span>Tablets only (${tb.length})</span></div></div>
<h3 class="h3">Why samples failed</h3><div class="bars">${Object.keys(cnt).length ? Object.entries(cnt).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<div class="bar"><span>${k}</span><div><i style="width:${100 * v / mx}%"></i></div><span>${v}</span></div>`).join('') : '<p class="mut">No failures logged yet.</p>'}</div>
<h3 class="h3">Every main with results</h3>${D.length ? `<table class="stack"><thead><tr><th>Street</th><th>Water °F</th><th>Air °F</th><th>Granules</th><th>Samples</th><th>Result</th></tr></thead><tbody>${D.map(j => { const [s, c] = status(j); return `<tr><td><b>${esc(j.street)}</b></td><td>${esc(j.r.waterT)}</td><td>${esc(j.r.airT)}</td><td>${j.r.granules === 'Y' ? 'Yes' : j.r.granules === 'N' ? 'No' : ''}</td><td>${j.labs.length}</td><td><span class="b ${c}">${s}</span></td></tr>`; }).join('')}</tbody></table>` : '<p class="mut">Nothing yet.</p>'}
<p class="sample">Fills in from your streets as lab results are entered.</p>`;
}

/* ---------- print / save ---------- */
function printPage() {
  const js = S.jobs, all = js.length && js.every(j => pick.ids.includes(j.id)), n = pick.ids.filter(id => js.some(j => j.id === id)).length + (pick.an ? 1 : 0);
  return `<div class="top"><h2>Print or save</h2><span class="mut">Pick what to include</span></div>
<div class="pick">${js.length ? `<label class="all"><input type="checkbox" data-pick="all"${all ? ' checked' : ''}> All streets (${js.length})</label>` : '<p class="mut">No streets yet.</p>'}
${js.map(j => { const [s] = status(j); return `<label><input type="checkbox" data-pick="${j.id}"${pick.ids.includes(j.id) ? ' checked' : ''}><span><b>${esc(j.street)}</b> <small>${esc(j.from)} to ${esc(j.to)} · ${s}</small></span></label>`; }).join('')}
<label class="all" style="margin-top:8px"><input type="checkbox" data-pick="an"${pick.an ? ' checked' : ''}> Full Analysis</label></div>
<button class="btn" data-act="print"${n ? '' : ' disabled style="opacity:.5"'}>Print or save as PDF${n ? ` (${n})` : ''}</button>
<p class="sample">This opens your device's print screen. To keep a file, choose <b>Save as PDF</b> (on iPhone, tap Share, then Save to Files). The PDF goes to your Downloads or Documents folder on this device. Nothing is sent anywhere.</p>`;
}
const ans = (j, it) => {
  const v = get(j, it.k); if (!v) return '<span class="mut">—</span>';
  if (it.t === 'yn') return v === 'Y' ? 'Yes' : 'No';
  if (it.t === 'time') return esc(mdy(v));
  return esc(v) + (it.u ? ' ' + it.u : '');
};
function streetDoc(j) {
  const [s, c] = status(j), m = mailParts(j);
  const info = FIELDS.slice(3).map(([k, l, t]) => `<tr><th style="width:38%">${l}</th><td>${esc(t === 'date' ? mdy(get(j, k)) : get(j, k)) || '<span class="mut">—</span>'}</td></tr>`).join('');
  const steps = G.map(g => `<h3>${g.g}</h3><table><tbody>${g.items.map(it => it.t === 'calc' ? `<tr><td colspan="3">${calc(j)}</td></tr>` : `<tr><td>${esc(qText(it, j))}</td><td style="width:22%">${ans(j, it)}</td><td style="width:12%">${{ ok: '<span class="b ok">OK</span>', bad: '<span class="b bad">Flagged</span>' }[state(j, it)] || ''}</td></tr>`).join('')}</tbody></table>`).join('');
  const labsH = j.labs.length ? j.labs.map((a, i) => { const r = labRes(a, j, i); return `<h3>${labName(i)} · ${esc(mdy(a.date)) || 'no date'} · ${r.pass === true ? '<span class="b ok">Passed</span>' : r.pass === false ? `<span class="b bad">Failed: ${esc(r.fails.join(', '))}</span>` : '<span class="b warn">Not complete</span>'}</h3>
<table><thead><tr><th>Parameter</th><th>Acceptable</th><th>Result</th><th></th></tr></thead><tbody>${P.map(p => { const n = num(a[p[0]]), ok = n == null ? '' : p[4](n, j, i); return `<tr><td>${p[1]} <span class="mut">${p[2]}</span></td><td>${p[3](i)}</td><td>${esc(a[p[0]]) || '—'}</td><td>${ok === '' ? '' : ok ? '<span class="b ok">OK</span>' : '<span class="b bad">Fail</span>'}</td></tr>`; }).join('')}</tbody></table>`; }).join('') : '<p class="mut">No lab results yet.</p>';
  return `<section class="doc"><h1>${esc(j.street)}</h1><p class="mut">${esc(j.from)} to ${esc(j.to)} · Work #${esc(j.f.work)} · <span class="b ${c}">${s}</span> · Printed ${esc(fmt(new Date()))}</p>
<h2>Job info</h2><table><tbody>${info}</tbody></table>
<h2>Steps</h2>${steps}
<h2>Lab results</h2>${labsH}
<h2>Email</h2><p><b>Subject:</b> ${esc(m.sub)}</p><pre>${esc(m.txt)}</pre>
<h2>Notes</h2>${j.notes ? `<p class="notes">${esc(j.notes)}</p>` : '<p class="mut">None.</p>'}
<h2>Analysis</h2>${jobAn(j)}</section>`;
}
function doPrint() {
  const docs = S.jobs.filter(j => pick.ids.includes(j.id)).map(streetDoc);
  if (pick.an) docs.push(`<section class="doc"><h1>Hinton Water: Analysis</h1><p class="mut">Printed ${esc(fmt(new Date()))}</p>${analysis()}</section>`);
  if (!docs.length) return;
  $('#print').innerHTML = `<table><tbody><tr><td>${docs.join('')}</td></tr></tbody><tfoot><tr><td></td></tr></tfoot></table><div class="pfoot">${FOOT.map(t => `<p>${esc(t)}</p>`).join('')}</div>`;
  const sel = S.jobs.filter(j => pick.ids.includes(j.id));
  const what = sel.length === 1 && !pick.an ? sel[0].street : sel.length === S.jobs.length && sel.length > 1 ? 'All streets' : sel.length ? `${sel.length} streets` : 'Analysis';
  const whatAll = what + (pick.an && sel.length ? ' and Analysis' : '');
  const old = document.title; document.title = `Hinton report - ${whatAll} - ${today()}`;
  const done = () => { document.title = old; removeEventListener('afterprint', done); };
  addEventListener('afterprint', done);
  setTimeout(() => { window.print(); setTimeout(done, 1000); }, 50);
}

/* ---------- render ---------- */
const app = $('#app'); let ro = null;
function layoutTabs() {
  const box = $('#idx'); if (!box) return; const W = box.clientWidth, tw = Math.min(W < 560 ? W * 0.8 : 340, W), max = W - tw, step = W < 560 ? 26 : 46, n = Math.max(1, Math.floor(max / step)), s = max / n;
  box.style.setProperty('--tw', tw + 'px'); [...box.children].forEach((t, i) => { const k = i % (2 * n); t.style.marginLeft = ((k <= n ? k : 2 * n - k) * s) + 'px'; });
}
function render() {
  const j = S.jobs.find(x => x.id === V.id); if (V.page === 'job' && !j) V.page = 'home';
  app.innerHTML = V.page === 'job' ? detail(j) : V.page === 'analysis' ? analysis() + footer() : V.page === 'print' ? printPage() : home();
  $('#nav-home').className = V.page === 'home' || V.page === 'job' ? 'on' : ''; $('#nav-an').className = V.page === 'analysis' ? 'on' : ''; $('#nav-pr').className = V.page === 'print' ? 'on' : '';
  try { sessionStorage.setItem('hwdr-v', JSON.stringify(V)); } catch (e) {}
  if (ro) ro.disconnect(); const box = $('#idx'); if (box) { ro = new ResizeObserver(layoutTabs); ro.observe(box); layoutTabs(); }
}
function rerender() { setTimeout(() => { const a = document.activeElement, id = a && a.id, y = scrollY; render(); scrollTo(0, y); if (id) { const e = document.getElementById(id); if (e) e.focus({ preventScroll: true }); } }, 0); }
/* Phone back button moves between screens instead of closing the app. */
function go(nv) { Object.assign(V, nv); history.pushState({ ...V }, ''); scrollTo(0, 0); render(); }
history.replaceState({ ...V }, '');
addEventListener('popstate', e => { if (e.state) { Object.assign(V, e.state); render(); } });
/* Fill in the column names for phone-width tables. */
new MutationObserver(() => { for (const c of document.querySelectorAll('.stack td:not([data-l])')) { let i = 0, p = c; while ((p = p.previousElementSibling)) i += p.colSpan; c.dataset.l = c.closest('table').rows[0].cells[i]?.textContent || ''; } }).observe(document.body, { childList: true, subtree: true });

let toastT;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => (t.hidden = true), 3500); }

/* ---------- backup / restore ---------- */
function saveFile(name, text, type) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}
async function backup() {
  await flush();
  const data = JSON.stringify({ app: 'hinton-water-disinfection-report', version: APP_VERSION, exported: new Date().toISOString(), streets: S.jobs.length, state: S }, null, 1);
  const name = `Hinton backup ${today()}.json`;
  const file = typeof File === 'function' ? new File([data], name, { type: 'application/json' }) : null;
  const done = () => { S.meta.lastBackup = Date.now(); save(); toast(`Backup saved: ${name}`); render(); };
  if ((/Android/i.test(navigator.userAgent) || isIOS()) && file && navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: name }); done(); return; } catch (e) { if (e && e.name === 'AbortError') return; }
  }
  saveFile(name, data, 'application/json'); done();
}
async function restoreFrom(file) {
  let d; try { d = JSON.parse(await file.text()); } catch (e) { toast('That file can’t be read. Pick a backup file made by this app.'); return; }
  if (!d || d.app !== 'hinton-water-disinfection-report' || !d.state || !Array.isArray(d.state.jobs)) { toast('That isn’t a backup file from this app.'); return; }
  const ns = d.state.v === 3 ? fixup(d.state) : fixup(fromV1(d.state));
  const when = d.exported ? fmt(new Date(d.exported)) : 'an unknown date';
  if (!confirm(`Restore the backup from ${when}?\n\nIt has ${ns.jobs.length} street(s). It replaces the ${S.jobs.length} street(s) on this device. You can undo this afterward.`)) return;
  await Store.put('beforeRestore3', S); undoAvail = true;
  S = ns; S.meta.lastBackup = Date.now(); await flush();
  toast(`Backup restored: ${S.jobs.length} street(s).`); go({ page: 'home' });
}
undoAvail = !!(await Store.get('beforeRestore3'));

/* ---------- events ---------- */
const cur = () => S.jobs.find(x => x.id === V.id);
async function copyText(id, b) {
  const t = document.getElementById(id).textContent, old = b.textContent;
  try { await navigator.clipboard.writeText(t); b.textContent = 'Copied'; }
  catch (e) { const r = document.createRange(); r.selectNodeContents(document.getElementById(id)); getSelection().removeAllRanges(); getSelection().addRange(r); b.textContent = 'Selected, now copy'; }
  setTimeout(() => (b.textContent = old), 1500);
}
document.addEventListener('click', async e => {
  const b = e.target.closest('button'); if (!b) return; const d = b.dataset;
  if (d.go) go({ page: d.go });
  else if (d.open) go({ page: 'job', id: d.open, sec: 'info' });
  else if (d.sec) { V.sec = d.sec; history.replaceState({ ...V }, ''); render(); }
  else if (d.yn) { const j = cur(); set(j, d.yn, get(j, d.yn) === d.v ? '' : d.v); save(); rerender(); }
  else if (d.addlab) { const j = cur(); j.labs.push(lab(today())); save(); render(); }
  else if (d.del) { if (b.dataset.armed) { S.jobs = S.jobs.filter(x => x.id !== d.del); pick.ids = pick.ids.filter(x => x !== d.del); save(); go({ page: 'home' }); } else { b.dataset.armed = '1'; b.textContent = 'Tap again to delete for good'; } }
  else if (d.copy) copyText(d.copy, b);
  else if (d.act === 'backup') backup();
  else if (d.act === 'restore') $('#restore-file').click();
  else if (d.act === 'undo') { const u = await Store.get('beforeRestore3'); if (u && confirm('Put back the data you had before the last restore?')) { await Store.put('beforeRestore3', null); undoAvail = false; S = fixup(u); await flush(); toast('Restore undone.'); go({ page: 'home' }); } }
  else if (d.act === 'install' && installEvt) { installEvt.prompt(); try { await installEvt.userChoice; } catch (x) {} installEvt = null; render(); }
  else if (d.act === 'print') doPrint();
  else if (d.act === 'update') { const w = window.__waiting; if (w) w.postMessage('skip'); else location.reload(); }
});
document.addEventListener('change', e => {
  const t = e.target, d = t.dataset;
  if (t.id === 'restore-file') { const f = t.files && t.files[0]; t.value = ''; if (f) restoreFrom(f); return; }
  if (d.pick) {
    if (d.pick === 'all') pick.ids = t.checked ? S.jobs.map(j => j.id) : [];
    else if (d.pick === 'an') pick.an = t.checked;
    else pick.ids = t.checked ? [...new Set([...pick.ids, d.pick])] : pick.ids.filter(x => x !== d.pick);
    render(); return;
  }
  if (d.rcp) { S.settings.recipients = [...new Set((t.value.match(/[^\s,;<>"']+@[^\s,;<>"']+/g) || []))]; save(); render(); return; }
  const j = cur(); if (!j) return;
  if (d.req) { j.mailReq = t.value; save(); rerender(); return; }
  if (!d.k) return;
  set(j, d.k, t.value.trim()); save(); rerender();
});
document.addEventListener('submit', e => {
  if (e.target.id !== 'addf') return; e.preventDefault(); const v = id => document.getElementById(id).value.trim(); if (!v('a-st')) return;
  const j = mk(v('a-st'), v('a-from'), v('a-to')); S.jobs.push(j); save(); go({ page: 'job', id: j.id, sec: 'info' });
});
setInterval(() => { if (V.page === 'job' && (V.sec === 'steps' || V.sec === 'an') && !(document.activeElement && document.activeElement.dataset && document.activeElement.dataset.k)) rerender(); }, 60000);
addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; if (V.page === 'home') render(); });
render();

/* ---------- offline + updates ---------- */
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').then(reg => {
    const offer = w => { window.__waiting = w; $('#update').hidden = false; };
    if (reg.waiting && navigator.serviceWorker.controller) offer(reg.waiting);
    reg.addEventListener('updatefound', () => { const w = reg.installing; w && w.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) offer(w); }); });
    setInterval(() => reg.update().catch(() => {}), 60 * 60 * 1000);
  }).catch(() => {});
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (!reloaded) { reloaded = true; flush().finally(() => location.reload()); } });
}
})();
