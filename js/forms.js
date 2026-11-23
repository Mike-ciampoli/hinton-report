/* Hinton Water Disinfection Report: printable PWD forms.
   Laid out after the paper forms (photos in the project's Forms folder):
   Initial Sample Request (Feb. 2016), Resample Request (Feb. 2016),
   Sanitary Release Disinfection Form (Continuous Feed; Pre / Post) and the
   Chlorine Verification Log. These pages carry NO app footer: they're the
   official forms. Each takes D, the data object built in app.js (formData). */
'use strict';

const FORMS = (() => {
  const g = (o, k) => k.split('.').reduce((a, b) => (a == null ? a : a[b]), o);
  let esc = s => String(s ?? '');
  const bx = on => `<span class="bx">${on ? '✕' : ''}</span>`;
  const yn = v => `<span class="ynp">YES ${bx(v === 'Y')} NO ${bx(v === 'N')}</span>`;
  const fv = (s, w) => `<span class="fv"${w ? ` style="min-width:${w}"` : ''}>${esc(s ?? '')}</span>`;
  const R = (D, k) => g(D.rd, k) ?? '';
  const F = (D, k) => g(D.j, k) ?? '';
  const dt = (D, s) => { const d = D.mdy(s, true); return d ? d.split(' ') : ['', '']; };
  const datePart = (D, s) => D.mdy(s) || '';
  const timePart = (D, s) => { const d = D.mdy(s, true); return d ? d.slice(11) : ''; };
  const loc = D => [D.j.from && `from ${D.j.from}`, D.j.to && `to ${D.j.to}`].filter(Boolean).join(' ');
  const q = (n, text, ans, cls) => `<tr class="${cls || ''}"><td class="qn">${n}</td><td class="qt">${text}</td><td class="qa">${ans ?? ''}</td></tr>`;
  const sec = t => `<tr class="sh"><td colspan="3">${t}</td></tr>`;
  const sig = () => `<table class="pf sig"><tr><td class="sl">SIGNATURES, CERTIFIED BY THE FOLLOWING, CONFIRM THE ABOVE STEPS HAVE BEEN SUCCESSFULLY COMPLETED:</td><td>INSPECTOR:<div class="line"></div></td><td>CONTRACTOR:<div class="line"></div></td></tr></table>`;
  const title = (sub, right) => `<div class="pt-h"><div>Sanitary Release Testing for New Water Main Construction</div><div>Philadelphia Water Department</div><div class="pt-sub">${sub}</div>${right ? `<span class="pt-r">${right}</span>` : ''}</div>`;
  const bg = D => `<table class="pf grid">
<tr><td>CONTRACTOR${fv(F(D, 'f.contractor'))}</td><td>CONTRACT NO.${fv(F(D, 'f.contract') || F(D, 'f.work'))}</td><td>INSPECTOR${fv(F(D, 'f.inspector'))}</td><td>ENGINEER${fv(F(D, 'f.engineer'))}</td></tr>
<tr><td colspan="2">APPOINTMENT LOCATION${fv(F(D, 'f.appt'))}</td><td>INSPECTOR EMAIL${fv(F(D, 'f.inspEmail'))}</td><td>ENGINEER EMAIL${fv(F(D, 'f.engEmail'))}</td></tr>
<tr><td colspan="2">NAME OF STREET CONTAINING MAIN${fv(D.j.street)}</td><td colspan="2">SPECIFIC LOCATION OF MAIN (from, to, etc…)${fv(loc(D))}</td></tr>
<tr><td>PIPE MANUFACTURER${fv(F(D, 'f.mfr'))}</td><td colspan="2">PIPE SECTION LENGTH(S) ${fv(F(D, 'f.length'), '5em')} feet</td><td>PIPE DIAMETER(S) ${fv(F(D, 'f.dia'), '3em')} inches</td></tr></table>`;
  const blsBlock = (resample) => resample
    ? `<table class="pf bls"><tr class="sh"><td colspan="8">THIS SECTION TO BE COMPLETED BY BUREAU OF LABORATORY SERVICES</td></tr>
<tr><td colspan="4">Lab No. <span class="line in"></span></td><td colspan="4">Number of Sample Ferrules: <span class="line in"></span></td></tr>
<tr class="th"><td>Resample Date</td><td>Notice Date</td><td>Resample Needed</td><td>Chargeable Sample</td><td>Reason for Failure</td><td>Flushing Needed</td><td>Re Cl₂ Needed</td><td>Status/Comments</td></tr>
${'<tr><td></td><td></td><td>Y☐ N☐</td><td>Y☐ N☐</td><td></td><td>Y☐ N☐</td><td>Y☐ N☐</td><td></td></tr>'.repeat(5)}</table>
<div class="rel"><span>Final release date: <span class="line in"></span></span><span>Released &amp; approved by: <span class="line in"></span></span></div>`
    : `<table class="pf bls"><tr class="sh"><td colspan="6">THIS SECTION TO BE COMPLETED BY BUREAU OF LABORATORY SERVICES</td></tr>
<tr><td colspan="3">Lab No.: <span class="line in"></span></td><td colspan="3">Initial Sanitary Release Sample Date: <span class="line in"></span></td></tr>
<tr><td colspan="3">Number of Sample Ferrules: <span class="line in"></span></td><td colspan="3">Initial Sanitary Release Sample Status: Failed ☐ Approved ☐</td></tr>
<tr class="th"><td>Notice Date</td><td>Resample Needed</td><td>Reason for Failure</td><td>Flushing Needed</td><td>Re Cl₂ Needed</td><td>Comments</td></tr>
<tr><td></td><td>Y☐ N☐</td><td></td><td>Y☐ N☐</td><td>Y☐ N☐</td><td></td></tr></table>
<div class="rel"><span>Final release date: <span class="line in"></span></span><span>Released &amp; approved by: <span class="line in"></span></span></div>`;
  const correctives = D => {
    const L = Object.entries(D.rd.fix || {}).filter(([, v]) => v && v.trim());
    return L.length ? L.map(([, v]) => `<div>• ${esc(v)}</div>`).join('') : '';
  };
  const setEsc = D => { esc = D.esc; };

  /* ---- Initial Sample Request ---- */
  function initial(D) {
    setEsc(D);
    const ld = R(D, 't.loaded');
    return `<div class="sheet pform">${title('INITIAL SAMPLE REQUEST', 'Feb. 2016')}
<table class="pf"><tr class="sh"><td colspan="3">SECTION I - BACKGROUND INFORMATION</td></tr></table>${bg(D)}
<table class="pf">
${sec(`SECTION II – PREVENTIVE MEASURES BEFORE &amp; DURING CONSTRUCTION <span class="fr">DELIVERY DATE OF PIPE TO CONSTRUCTION SITE: ${fv(datePart(D, F(D, 'f.delivery')), '7em')}</span>`)}
${q('1.', 'Was the new pipe that was strung out at the site placed on cribs <u>at least</u> 6 inches above ground level?', yn(R(D, 'c.p1')))}
${q('2.', 'Was the new pipe protected by capping, wrapping, or watertight sealing <u>at all times</u> prior to installation?', yn(R(D, 'c.p2')))}
${q('3.', 'If trench conditions were unsuitable (water accumulation in trench), did all protective seals remain in place until the trench was dry?', yn(R(D, 'c.p3')))}
${q('4.', 'Before the new pipe was lowered in the trench, were the surfaces of all joints, the interior of all pipes, and appurtenances thoroughly inspected; if dirt entered, were the respective parts cleaned by spraying or swabbing them with an appropriate disinfecting solution?', yn(R(D, 'c.p4')))}
${q('5.', 'Were the interior coatings of any new pipe or appurtenance found to be tacky before installation?', yn(R(D, 'c.p5')))}
${sec(`SECTION III – SEALING MATERIALS <span class="fr">PIPE JOINT LUBRICANT USED (brand name): ${fv(R(D, 'r.lube'), '9em')}</span>`)}
${q('1.', 'Was the lubricant delivered in closed containers, kept clean and applied with dedicated, clean, disposable applicator brushes?', yn(R(D, 'c.p6')))}
${sec('SECTION IV – PRE-FLUSHING OF SOURCE WATER')}
${q('1.', 'Did the contractor flush the supply main to which the new main will obtain its fill water for <u>at least</u> 15 minutes prior to filling?', yn(R(D, 'c.p7')))}
${sec(`SECTION V – DISINFECTION <span class="fr">MAIN FIRST LOADED ON: ${fv(datePart(D, ld), '7em')} · <u>CHLORINE TABLETS MUST BE USED AS SPECIFIED</u></span>`)}
${q('', 'NUMBER OF CHLORINE TABLETS PER PIPE:', `${fv(R(D, 'r.tablets'), '3em')} tablets per pipe`)}
${q('', 'Were CHLORINE GRANULES applied in addition to tablets?', yn(R(D, 'r.granules')))}
${q('1.', 'Prior to filling the new main, were valves positioned so that any chlorine solution formed will not flow into active mains?', yn(R(D, 'c.d1')))}
${q('2.', 'When the new main was filled with water from a single source, was the velocity of the fill water no greater than 1 ft./sec?', yn(R(D, 'c.d2')))}
${q('3.', 'After filling the new main, did the fill water sit still in the pipe for at least 24 hours (48 hrs. if water temperature &lt; 41°F (5° C))?', yn(R(D, 'c.d3')))}
${q('4.', 'After 24 (or 48) hours, what was the free chlorine residual in the new main?', `${fv(R(D, 'r.hold'), '3em')} ppm`)}
${sec('SECTION VI – FLUSHING AFTER DISINFECTION &amp; FILLING THE NEW MAIN WITH SOURCE WATER')}
${q('1.', 'Were <u>at least</u> 3 pipe volumes of fill water flushed through a hydrant or blowoff connection at the end of the new main?', yn(R(D, 'c.f2')))}
${q('2.', 'Was an approved backflow prevention assembly utilized for any connections to existing hydrants?', yn(R(D, 'c.f3')))}
${q('3.', 'Was highly chlorinated water discharged, via air-gap separation, to an approved sanitary sewer or dechlorinated prior to discharge?', yn(R(D, 'c.f4')))}
${q('4.', 'After flushing, what was the free chlorine residual in the new main?', `${fv(R(D, 'r.afterFlush'), '3em')} ppm`)}
${q('5.', 'After verification of no free chlorine remaining in the new main, did the fill water sit without movement for at least 16 hours?', yn(R(D, 'c.f8')))}
<tr><td colspan="3"><i>Flushing Activity Summary</i> &nbsp; Date &amp; Time Flushing Initiated: ${fv(D.mdy(R(D, 't.flushStart'), true), '10em')} &nbsp; Date &amp; Time of Shutdown: ${fv(D.mdy(R(D, 't.shutdown'), true), '10em')}</td></tr>
<tr><td colspan="3" class="ins"><u>Instructions</u> - After the above has been <b>successfully</b> completed:<br>1. Complete a sketch showing source of supply, valves, valve positions, sampling location #, unidirectional flow of water, flushing locations, &amp; section lengths.<br>2. Contact Bureau of Laboratory Services to schedule sample collection and delivery of the completed sketch.</td></tr>
</table>${sig()}${blsBlock(false)}</div>`;
  }

  /* ---- Resample Request ---- */
  function resample(D) {
    setEsc(D);
    const fix = D.rd.res.fix, flushFix = fix === 'reflush' || fix === 'scour', rech = fix === 'rechlor', cfm = rech && D.rd.method === 'cf';
    const show = (on, v) => (on ? v : '');
    const fer = D.rd.ferrules.map(f => D.num(f.ppm)).filter(n => n !== null);
    const q3 = fer.length ? (Math.min(...fer) >= 25 ? 'Y' : 'N') : '';
    const holdMin = cfm ? (() => { const v = D.cfs.chk.map(p => D.cfs.per[p.id].lastHold).filter(Boolean).map(x => x.ppm); return v.length ? Math.min(...v) : ''; })() : R(D, 'r.hold');
    const ca = correctives(D);
    return `<div class="sheet pform">${title('RESAMPLE REQUEST', 'Feb. 2016')}
<table class="pf"><tr class="sh"><td colspan="3">SECTION I - BACKGROUND INFORMATION</td></tr></table>${bg(D)}
<table class="pf">
${sec('SECTION II – ACTIONS BEFORE FLUSHING/DISINFECTION')}
${q('1.', 'Did the contractor flush the supply main to which the new main will obtain its fill water for <u>at least</u> 15 minutes prior to filling?', yn(show(flushFix, R(D, 'c.p7'))))}
${q('2.', 'Were <u>at least</u> 3 pipe volumes of fill water flushed through a hydrant or blowoff connection at the end of the new main?', yn(show(flushFix, R(D, 'c.f2'))))}
${sec('SECTION III – RE-FLUSHING')}
${q('1.', 'After filling the main, did the fill water sit without movement for at least 16 hours?', yn(show(flushFix, R(D, 'c.rs3'))))}
<tr><td colspan="3" class="ins"><u>Instructions</u> – If flushing was the corrective action required, after the above has been successfully completed:<br>1. Contact Bureau of Laboratory Services to schedule re-sample collection.</td></tr>
${sec('SECTION IV – RE-DISINFECTION (CONTINUOUS-FEED METHOD)')}
${cfm ? '<tr><td colspan="3" class="ins">Re-disinfected by continuous feed: see the attached Sanitary Release Disinfection Form (Continuous Feed) and Chlorine Verification Logs.</td></tr>' : ''}
${q('1.', 'Prior to filling with chlorinated water, were valves positioned so that any strong chlorine solution will not flow back into active mains?', yn(show(rech && !cfm, R(D, 'c.d1'))))}
${q('2.', 'Was the chlorinated water pumped into the new main at constant rate?', yn(show(rech && !cfm, R(D, 'c.rs4_2'))))}
${q('3.', 'Was the chlorine concentration measured at regular intervals at available ferrules such that the water at any location in the main was no less than 25 ppm free chlorine?', yn(show(rech && !cfm, q3)))}
${q('4.', 'After filling, did the chlorinated water sit still in the pipe for at least 24 hours?', yn(show(rech, cfm ? R(D, 'cf.q10') : R(D, 'c.rs4_4'))))}
${q('5.', 'After 24 hours, what was that the free chlorine residual in the new main?', `${fv(show(rech, holdMin), '3em')} ppm`)}
${sec('SECTION V – FLUSHING AFTER RE-DISINFECTION &amp; FILLING THE NEW MAIN WITH SOURCE WATER')}
${q('1.', 'Were <u>at least</u> 3 pipe volumes of fill water flushed through a hydrant or blowoff connection at the end of the new main?', yn(show(rech && !cfm, R(D, 'c.f2'))))}
${q('2.', 'Was highly chlorinated water discharged to an approved sanitary sewer or dechlorinated before being discharged?', yn(show(rech && !cfm, R(D, 'c.f4'))))}
${q('3.', 'After flushing, what was the free chlorine residual in the new main?', `${fv(show(rech && !cfm, R(D, 'r.afterFlush')), '3em')} ppm`)}
${q('4.', 'After verification of no free chlorine remaining in the new main, did the fill water sit without movement for at least 16 hours?', yn(show(rech && !cfm, R(D, 'c.f8'))))}
<tr><td colspan="3" class="ins"><u>Instructions</u> - If the flushing and disinfection were the corrective actions required, after the above has been successfully completed:<br>1. Contact Bureau of Laboratory Services to schedule re-sample collection<br><b><i>*** If the response to any question above is “NO”, corrective action must be taken and described below. ***</i></b><div class="ca">${ca}</div></td></tr>
</table>${sig()}${blsBlock(true)}</div>`;
  }

  /* ---- Sanitary Release Disinfection Form (Continuous Feed) ---- */
  function cfForm(D, pre) {
    setEsc(D);
    const cf = D.rd.cf, P = v => (pre ? '' : v), reason = cf.reason;
    const prev = D.prevLoaded ? D.prevLoaded.split(' ') : ['', ''];
    const hs = R(D, 't.holdStart'), he = R(D, 't.holdEnd');
    const fl = [0, 1, 2].map(i => cf.flush[i] || {}), vr = [0, 1, 2, 3, 4].map(i => cf.ver[i] || {});
    return `<div class="sheet pform">${title(`SANITARY RELEASE DISINFECTION FORM (Continuous Feed; ${pre ? 'Pre' : 'Post'}-Disinfection)`)}
<table class="pf"><tr class="sh"><td colspan="3">SECTION I - JOB INFORMATION</td></tr></table>
<table class="pf grid">
<tr><td>CONTRACTOR${fv(F(D, 'f.contractor'))}</td><td>CONTRACT No.${fv(F(D, 'f.contract') || F(D, 'f.work'))}</td><td>INSPECTOR${fv(F(D, 'f.inspector'))}</td><td>ENGINEER${fv(F(D, 'f.engineer'))}</td></tr>
<tr><td colspan="2">NAME OF STREET CONTAINING MAIN${fv(D.j.street)}</td><td colspan="2">SPECIFIC LOCATION OF MAIN (from, to, etc.)${fv(loc(D))}</td></tr>
<tr><td>DISINFECTION SUB-CONTRACTOR${fv(F(D, 'f.disSub'))}</td><td colspan="2">LENGTH OF PIPE DISINFECTED ${fv(F(D, 'f.length'), '5em')} feet</td><td>DIAMETER OF PIPE ${fv(F(D, 'f.dia'), '3em')} inches</td></tr></table>
<table class="pf">
${sec('SECTION II - PRE-DISINFECTION FLUSHING AND PREPARATION')}
${q('1.', `Reason for Disinfection: ${bx(reason === 'init')} Initial Sample &nbsp; ${bx(reason === 'bact')} Prior Bacterial Failure &nbsp; ${bx(reason === 'other')} Other: ${fv(reason === 'other' ? cf.reasonOther : '', '8em')}`, '')}
${q('2.', 'If previously disinfected, when was the most recent disinfection?', `DATE LOADED: ${fv(prev[0], '6em')} TIME: ${fv(prev.slice(1).join(' '), '4em')}`)}
${q('3.', 'Has the contractor agreed to comply with all provisions of the PWD W-22 (2016 Revision) and the AWWA 651-14 Standards?', yn(R(D, 'c.cf3')))}
${q('4.', 'Has the <b>CONTRACTOR</b> provided a labelled sketch of pipe to be disinfected, including all mains (new and existing), valve positions (open or shut), sources, and flush/verification/injection points? (Please include sketch with this form when submitted)', yn(R(D, 'c.cf4')))}
${q('5.', 'Were all flushing/discharge locations approved by the PWD Industrial Waste &amp; Backflow Unit and the PWD Collector Systems Unit for both potable and highly-chlorinated water flushing?', yn(R(D, 'c.cf5')))}
${q('', 'Is dechlorination of the flush water required by either unit (IW or CS)?', yn(R(D, 'c.cf5b')))}
${q('6.', `Identify the source (control valve) to be used for this disinfection: ${fv(cf.srcValve, '12em')}`, '')}
${q('7.', `Identify the flush point for this water source to be used prior to the start of disinfection: ${fv(cf.srcFlushPt, '12em')}`, '')}
${q('8.', `Identify the following for the source flush prior to the start of disinfection: Estimated Flow Rate: ${fv(cf.srcFlushRate, '4em')} gpm<br>Start of source flush Date: ${fv(datePart(D, cf.srcFlushStart), '6em')} Time: ${fv(timePart(D, cf.srcFlushStart), '4em')} &nbsp; End of source flush Date: ${fv(datePart(D, cf.srcFlushEnd), '6em')} Time: ${fv(timePart(D, cf.srcFlushEnd), '4em')}`, '')}
${q('9.', 'What was the measured value of the source water’s total chlorine residual prior to loading the main?', `${fv(R(D, 'r.srcTotal'), '3em')} ppm`)}
${sec('SECTION III - DISINFECTION AND VERIFICATION')}
${q('1.', `What method will be used to determine free chlorine concentration in the field? ${fv(cf.testMethod, '10em')}<br>Who will be performing this analysis? ${fv(cf.analyst, '10em')}`, '')}
${q('2.', `Identify the following for the Injection Point: Ferrule Size: ${fv(cf.ferrule, '4em')} Location: ${fv(cf.injLoc, '10em')}<br>Is the free chlorine injection point located within 10’ of where the source water enters the water main?`, yn(cf.within10))}
${q('3.', `Identify the following for the chlorinating material: Manufacturer: ${fv(cf.mfr, '8em')} Brand Name: ${fv(cf.brand, '8em')}<br>Chemical Name: ${fv(cf.chem, '8em')} Injection Concentration: ${fv(cf.injConc, '3em')} ppm Injection Rate: ${fv(cf.injRate, '3em')} gpm<br>Target Concentration Within The Main: Minimum: ${fv(cf.tmin, '3em')} ppm Maximum: ${fv(cf.tmax, '3em')} ppm<br>Was the Chlorinating Material NSF/ANSI 60 Certification and SDS included/sent to the PWD BLS Pipelines Group?`, yn(cf.nsf))}
${q('4.', `Identify the following for the flush points: Total Number of Flush Points: ${fv(cf.flush.length || '', '2em')}<br>${fl.map((p, i) => `Flush Point #${i + 1}: Location: ${fv(p.loc, '10em')} Diameter of Flush: ${fv(p.dia, '2em')} inches Total Flush Rate: ${fv(p.rate, '3em')} gpm`).join('<br>')}`, '')}
${q('5.', `Identify the following for any additional verification points: Total Number of Additional Verification Points: ${fv(cf.ver.length || '', '2em')}<br>${vr.map((p, i) => `Verification Point #${i + 1}: Location/Description: ${fv(p.loc, '16em')}`).join('<br>')}`, '')}
${q('6.', `What is the target measurement interval for all flush and verification points? ${fv(cf.interval, '3em')} minutes<br>Was the chlorine measurement at each flush/verification point shown with at least two concecutive measurements to have stabilized within the target free chlorine residual range from Section III, Question 3?`, yn(P(R(D, 'cf.q6'))), 'later')}
${q('7.', 'Were the chlorine injection and source turned off/closed only after all flush and verification points were shown to have stabilized within the target free chlorine residual range?', yn(P(R(D, 'cf.q7'))), 'later')}
${q('8.', 'Were all source and flush valves closed securely to prevent any accidental release of disinfectant into the distribution system or environment?', yn(P(R(D, 'cf.q8'))), 'later')}
${q('9.', 'Were Disinfection Logs completed for every Injection Point, Verification Point, and Flush Point? Were separate entries made for every injection start/modification/stop, flush start/modification/stop, and free chlorine measurement?', yn(P(R(D, 'cf.q9'))), 'later')}
${q('10.', `Was the disinfectant solution allowed to sit within the water main undisturbed for 24 hours?<br>Start of 24-hour hold Date: ${fv(P(datePart(D, hs)), '6em')} Time: ${fv(P(timePart(D, hs)), '4em')} &nbsp; End of 24-hour hold Date: ${fv(P(datePart(D, he)), '6em')} Time: ${fv(P(timePart(D, he)), '4em')}`, yn(P(R(D, 'cf.q10'))), 'later')}
${q('11.', 'After the 24-hour hold, was the free chlorine residual measured at all flush and verification points to be at or above 10 ppm? Were these values added to the Disinfection Logs? Were all Disinfection Logs submitted to BLS?', yn(P(R(D, 'cf.q11'))), 'later')}
${sec('SECTION IV - FLUSHING AFTER DISINFECTION')}
${q('1.', 'Were the approved discharge locations (Section I, Question 5) used for all flushing?', yn(P(R(D, 'cf.s4_1'))), 'later')}
${q('2.', 'Was each flush point flushed until the free chlorine residual of the discharge measured 0 ppm?', yn(P(R(D, 'cf.s4_2'))), 'later')}
</table>
<table class="pf sig"><tr><td class="sl">SIGNATURES, CERTIFIED BY THE FOLLOWING, CONFIRM THE ABOVE STEPS HAVE BEEN SUCCESSFULLY COMPLETED:</td><td>INSPECTOR<div class="line"></div></td><td>CONTRACTOR<div class="line"></div></td></tr></table>
<table class="pf bls"><tr class="sh"><td colspan="3">THIS SECTION FOR BUREAU OF LABORATORY SERVICES USE ONLY</td></tr>
<tr><td>BLS Job #:<br>Date Recieved: &nbsp;/&nbsp;&nbsp;/</td><td>Disinfection Approved? YES ☐ NO ☐<br>Date: &nbsp;/&nbsp;&nbsp;/ &nbsp; Initials:</td><td>COMMENTS:</td></tr></table></div>`;
  }

  /* ---- Chlorine Verification Logs (one per point, 25 rows a page) ---- */
  function cfLogs(D) {
    setEsc(D);
    const cf = D.rd.cf, j = D.j, ld = R(D, 't.loaded');
    const flushLocs = cf.flush.map((p, i) => `#${i + 1} ${p.loc || ''}`).join('; ');
    return D.cfPoints.map(p => {
      const rows = [];
      for (const x of cf.logs[p.id] || []) rows.push({ t: x.t, loc: p.loc || p.name, ppm: x.void ? `<s>${esc(x.ppm)}</s>` : esc(x.ppm), c: [D.PH[x.ph], x.note, x.void ? 'VOID: recorded in error' : ''].filter(Boolean).join('. '), n: true });
      for (const e of cf.events) if ((p.kind === 'inj' && e.what === 'inj') || e.what === p.id) rows.push({ t: e.t, loc: '', ppm: '', c: `${D.evWhat(e.what)} ${D.EV[e.act].toLowerCase()}${e.rate ? `: ${e.rate} gpm` : ''}`, n: false });
      rows.sort((a, b) => a.t - b.t);
      let k = 0; rows.forEach(r => { if (r.n) r.no = ++k; });
      const pages = []; for (let i = 0; i < Math.max(rows.length, 1); i += 25) pages.push(rows.slice(i, i + 25));
      const day0 = rows.length ? D.mdyMs(rows[0].t) : '';
      return pages.map((pg, pi) => `<div class="sheet pform log">
<div class="pt-h"><div>Chlorine Verification Log</div><div class="pt-sub">For use with Continuous Feed Disinfection at each monitoring location for chlorine residual</div>${pages.length > 1 ? `<span class="pt-r">Page ${pi + 1} of ${pages.length}</span>` : ''}</div>
<table class="pf grid lg">
<tr><td colspan="4">Street Location of Main to be Disinfected: ${fv(`${j.street} ${loc(D)}`)}</td></tr>
<tr><td>Total Pipe Length: ${fv(F(D, 'f.length') && F(D, 'f.length') + ' ft')}</td><td>Pipe Diameter: ${fv(F(D, 'f.dia') && F(D, 'f.dia') + ' in')}</td><td colspan="2">Date of Disinfection: ${fv(datePart(D, ld))}</td></tr>
<tr><td colspan="4">Source/Chlorine Injection Location: ${fv(cf.injLoc)}</td></tr>
<tr><td colspan="2">Test Ferrule Location/ID: ${fv(`${p.name}${p.loc ? ': ' + p.loc : ''}`)}</td><td colspan="2">Flushing Location: ${fv(flushLocs)}</td></tr>
<tr><td colspan="2">Chlorinating Agent: ${fv(cf.chem)}</td><td colspan="2">SDS and NSF 60 Certification Provided? ${fv(cf.nsf === 'Y' ? 'Yes' : cf.nsf === 'N' ? 'No' : '')}</td></tr>
<tr><td>Injection Start Time: ${fv(timePart(D, ld))}</td><td>Injection Rate: ${fv(cf.injRate && cf.injRate + ' gpm')}</td><td colspan="2">Flush Rate: ${fv(p.kind === 'flush' ? (p.rate ? p.rate + ' gpm' : '') : cf.flush.map(f => f.rate).filter(Boolean).join(' / ') + (cf.flush.some(f => f.rate) ? ' gpm' : ''))}</td></tr>
<tr><td colspan="4" class="ins c">Must note <b>ANY</b> changes to Injection/Flush Rates and their times. Use additional pages as needed.<br><u>Scan and send completed verification log to PWD laboratory prior to Sanitary Release Sampling.</u></td></tr></table>
<table class="pf rows"><thead><tr><th>Test No.</th><th>Test Location</th><th>Time</th><th>Free Chlorine (ppm)</th><th>Comments</th></tr></thead><tbody>
${pg.map(r => `<tr><td>${r.no || ''}</td><td>${esc(r.loc)}</td><td>${esc(D.hm(r.t))}${D.mdyMs(r.t) !== day0 ? ` <small>${esc(D.mdyMs(r.t))}</small>` : ''}</td><td>${r.ppm}</td><td>${esc(r.c)}</td></tr>`).join('')}
${'<tr><td>&nbsp;</td><td></td><td></td><td></td><td></td></tr>'.repeat(25 - pg.length)}
</tbody></table>
<table class="pf sig"><tr><td class="sl">Names and Signatures, certified by the following, confirm the above values have been accurately verified:</td><td>Inspector Name Printed:<div class="line"></div>Inspector Signature:<div class="line"></div></td><td>Contractor/Analyst Name Printed:<div class="line"></div>Contractor/Analyst Signature:<div class="line"></div></td></tr></table></div>`).join('');
    }).join('');
  }

  return { initial, resample, cfForm, cfLogs };
})();
