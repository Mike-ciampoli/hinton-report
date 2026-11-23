/* Hinton Water Disinfection Report: PWD rules.
   Everything PWD-specific lives in this file: checklists, chlorine limits,
   timers, lab ranges, email fields. Change the rules here; the rest of the
   app reads from it.

   Checklist item fields:
     k      where the answer is saved (inside the round, or "job." for the street)
     t      yn | num | time | text | sel | auto | note | timer | calc | ferrules | cfpoints | cflive
     good   the passing yes/no answer ('Y' by default, 'N', or null = either is fine)
     warnOn a yes/no answer that shows amber (a heads-up, not a mistake)
     ok     passing test for a number
     fp     "field practice": a good habit that is NOT on the PWD form
     show   only show the item when this returns true */
'use strict';

const RULES = {};

RULES.blsPhone = '(215) 685-1421';
RULES.blsTel = '+12156851421';

/* The PWD email list is NOT kept here, because this code is public on GitHub.
   It's entered once in the app (Backup > Email recipients; paste the whole
   list) and stays on the device. */
RULES.recipients = [];

RULES.footer = ['© 2026 Michael E. Ciampoli. All rights reserved. Created with help from Claude by Anthropic.',
  'Field aid only; not affiliated with the Philadelphia Water Department. BLS lab results are the official record.'];

/* Hold time. Tablets (Initial Sample Request): 24 hours, or 48 when the water
   is below 41°F. Continuous feed and re-chlorination: 24 hours. The cold rule
   is NOT applied to re-chlorination until confirmed. */
RULES.coldF = 41;
RULES.holdHours = (waterT, method) => (method === 'tablets' && waterT !== null && waterT < RULES.coldF ? 48 : 24);

/* Continuous feed limits */
RULES.cf = { holdMin: 10, flushMax: 0, stableReadings: 2, maxFlush: 3, maxVerify: 5 };

RULES.methods = { tablets: 'Tablets', cf: 'Continuous feed', rsform: 'Continuous feed (Resample form)' };
RULES.fixes = { reflush: 'Reflush', scour: 'Scour flush', rechlor: 'Re-chlorination', other: 'Other' };

/* Timers. "from" is the round field the countdown starts from. */
RULES.timers = {
  preflush: { name: '15-minute pre-flush', hours: 0.25, from: 't.preflush', start: true,
    doneMsg: 'Pre-flush done. Supply main flushed 15 minutes. OK to start filling.' },
  dissolve: { name: '7-hour tablet dissolve check', hours: 7, from: 't.loaded',
    doneMsg: 'Tablets should be dissolved. Test FREE chlorine. Need at least 25 ppm.' },
  hold: { name: r => `${r.holdH}-hour hold`, hours: r => r.holdH, from: 't.loaded',
    doneMsg: 'Hold is over. Test FREE chlorine. Need at least 10 ppm, then flush.' },
  cfhold: { name: '24-hour hold', hours: 24, from: 't.holdStart',
    doneMsg: 'Hold is over. Take a FREE chlorine reading at every point. Need at least 10 ppm, then flush.' },
  interval: { name: r => `Next readings (every ${r.rd.cf.interval} min)`, hours: r => (+r.rd.cf.interval > 0 && !r.rd.t.holdStart ? r.rd.cf.interval / 60 : null), from: 'cf.lastRead',
    doneMsg: 'Time for the next round of chlorine readings.' },
  rest: { name: '16-hour rest after shutdown', hours: 16, from: 't.shutdown',
    doneMsg: '16-hour rest is over. Main is ready for BLS to sample.' }
};

/* Checkpoints shared by several checklists. ok(value, ctx) returns true when green. */
const baselineOk = (v, c) => v > 1.0 && (c.baseline === null || c.baseline - v <= 0.5);
const CK = {
  srcTotal: { k: 'r.srcTotal', t: 'num', u: 'ppm', q: 'Source water TOTAL chlorine before loading the main',
    hint: 'Test the supply main. This is also the baseline for the refill check and the lab total chlorine check.' },
  hold: { k: 'r.hold', t: 'num', u: 'ppm', q: c => `FREE chlorine after the ${c.holdH}-hour hold`,
    hint: 'At least 10 ppm.', ok: v => v >= 10, okText: 'at least 10 ppm' },
  afterFlush: { k: 'r.afterFlush', t: 'num', u: 'ppm', q: 'FREE chlorine after flushing',
    hint: 'No free chlorine left: 0.10 ppm or less.', ok: v => v <= 0.10, okText: '0.10 ppm or less' },
  refill: { k: 'r.refill', t: 'num', u: 'ppm', q: 'TOTAL chlorine after refill', fp: true,
    hint: c => c.baseline === null ? 'Above 1.0 ppm and no more than 0.5 below the baseline. Enter the baseline above.'
      : `Above 1.0 ppm and no more than 0.5 below the ${c.baseline} ppm baseline (so at least ${Math.max(1.01, c.baseline - 0.5).toFixed(2)} ppm).`,
    ok: baselineOk, okText: 'above 1.0 and within 0.5 of baseline' },
  waterT: { k: 'r.waterT', t: 'num', u: '°F', q: 'Water temperature', hint: c => c.method === 'tablets' ? 'Below 41°F the hold becomes 48 hours automatically.' : '' },
  airT: { k: 'r.airT', t: 'num', u: '°F', q: 'Outside air temperature' },
  weather: { k: 'r.weather', t: 'text', q: 'Weather', ph: 'Clear, rain, windy…' }
};

const FILL_NOTE = { t: 'note', tone: 'info', html: '<b>Fill at no more than 1 ft/s.</b> Slow and steady so the chlorine stays spread through the main.', fill: true };
const FLUSH_NOTE = { t: 'note', tone: 'info', html: '<b>Flush at no less than 3 ft/s.</b> At least 3 pipe volumes out the end of the main.' };
const CALL_NOTE = { t: 'note', tone: 'warn', html: `<b>Contact BLS at <a href="tel:${RULES.blsTel}">${RULES.blsPhone}</a> to schedule sample collection.</b>` };
const REPLY_NOTE = { t: 'note', tone: 'info', html: '<b>Reply all to BLS</b> with the signed form and sketch as one PDF.' };
const COPPER_NOTE = { t: 'note', tone: 'info', html: '<b>Copper tubing on the sample points</b> before BLS arrives.' };
const BLS_FLUSH_NOTE = { t: 'note', tone: 'warn', html: `<b>Contact BLS during flushing:</b> <a href="tel:${RULES.blsTel}">${RULES.blsPhone}</a>.` };
const BLS_LOAD_NOTE = { t: 'note', tone: 'warn', html: `<b>Contact BLS when the main is loaded:</b> <a href="tel:${RULES.blsTel}">${RULES.blsPhone}</a>.`, show: c => c.ri > 0 };
const LOGS_NOTE = { t: 'note', tone: 'warn', html: '<b>Scan and send every Chlorine Verification Log to the PWD lab before sanitary release sampling.</b> Print them from the Print tab.' };

const AFTER_SHUTDOWN = [
  { k: 't.shutdown', t: 'time', q: 'Shut down for the 16-hour rest' },
  { t: 'timer', id: 'rest' },
  CALL_NOTE,
  { k: 'c.f5', t: 'yn', q: `Contacted BLS to schedule sample collection: ${RULES.blsPhone}` },
  REPLY_NOTE,
  { k: 'c.f6', t: 'yn', q: 'Signed form and sketch sent as one PDF (reply all to BLS)' },
  COPPER_NOTE,
  { k: 'c.f7', t: 'yn', q: 'Copper tubing on the sample points before BLS arrives', fp: true }
];

/* ---------- PWD Initial Sample Request (tablets) ---------- */
RULES.tablets = [
  { g: 'Preventive measures (Sec II–III)', items: [
    { k: 'job.f.delivery', t: 'date', q: 'Delivery date of pipe to the site' },
    { k: 'c.p1', t: 'yn', q: 'Pipe strung out on cribs at least 6 in above the ground' },
    { k: 'c.p2', t: 'yn', q: 'Pipe capped, wrapped or sealed at all times before install' },
    { k: 'c.p3', t: 'yn', q: 'If the trench had water in it, seals stayed in place until the trench was dry' },
    { k: 'c.p4', t: 'yn', q: 'Joints, pipe interior and fittings inspected; any dirt swabbed or sprayed with disinfecting solution' },
    { k: 'c.p5', t: 'yn', q: 'Interior coatings found tacky before install', good: 'N', hint: 'The right answer here is No.' },
    { k: 'job.f.mfr', t: 'text', q: 'Pipe manufacturer' },
    { k: 'r.lube', t: 'text', q: 'Pipe joint lubricant (brand)' },
    { k: 'c.p6', t: 'yn', q: 'Lubricant in closed containers, kept clean, dedicated disposable brushes' }
  ] },
  { g: 'Pre-flushing of source water (Sec IV)', items: [
    { t: 'timer', id: 'preflush' },
    { k: 'c.p7', t: 'yn', q: 'Supply main flushed at least 15 minutes before filling' },
    { ...CK.srcTotal, fp: true }
  ] },
  { g: 'Disinfection (Sec V)', items: [
    FILL_NOTE,
    { k: 't.loaded', t: 'time', q: 'Main first loaded (tablets in, fill started)' },
    { k: 'r.tablets', t: 'num', u: 'per pipe', q: 'Chlorine tablets per pipe' },
    { k: 'r.granules', t: 'yn', q: 'Chlorine granules applied in addition to tablets', good: null, hint: 'Either answer is fine. Used in the Analysis.' },
    { k: 'c.d1', t: 'yn', q: 'Valves set so chlorine cannot flow into active mains' },
    { k: 'c.d2', t: 'yn', q: 'Filled from a single source at no more than 1 ft/s' },
    CK.waterT, CK.airT, CK.weather,
    { t: 'timer', id: 'dissolve' },
    { k: 'r.dissolve', t: 'num', u: 'ppm', q: 'FREE chlorine after the tablets dissolve', fp: true,
      hint: 'At least 25 ppm. About 7 hours in normal temperatures, longer when cold.', ok: v => v >= 25, okText: 'at least 25 ppm' },
    { t: 'timer', id: 'hold' },
    { k: 'c.d3', t: 'yn', q: c => `Fill water sat still in the pipe at least ${c.holdH} hours`, hint: '24 hours, or 48 when the water is below 41°F.' },
    CK.hold
  ] },
  { g: 'Flushing after disinfection (Sec VI)', items: [
    FLUSH_NOTE,
    { t: 'calc' },
    { k: 't.flushStart', t: 'time', q: 'Flushing started' },
    { k: 'c.f1', t: 'yn', q: 'Flush velocity at least 3 ft/s', fp: true },
    { k: 'c.f2', t: 'yn', q: 'At least 3 pipe volumes flushed through a hydrant or blowoff at the end of the main' },
    { k: 'c.f3', t: 'yn', q: 'Approved backflow preventer on connections to existing hydrants' },
    { k: 'c.f4', t: 'yn', q: 'Chlorinated water to an approved sanitary sewer through an air gap, or dechlorinated' },
    CK.afterFlush,
    CK.refill,
    { k: 'c.f8', t: 'yn', q: 'After no free chlorine was verified, fill water sat without movement at least 16 hours' },
    ...AFTER_SHUTDOWN
  ] }
];

/* ---------- Continuous feed: PWD Sanitary Release Disinfection Form + Chlorine Verification Logs ---------- */
RULES.cfGroups = [
  { g: 'Pre-disinfection flushing and preparation (Sec II)', items: [
    { k: 'cf.reason', t: 'sel', q: 'Reason for disinfection', opts: [['init', 'Initial sample'], ['bact', 'Prior bacterial failure'], ['other', 'Other']] },
    { k: 'cf.reasonOther', t: 'text', q: 'Other reason', show: c => c.rd.cf.reason === 'other' },
    { k: 'c.cf3', t: 'yn', q: 'Contractor agreed to comply with PWD W-22 (2016 Revision) and AWWA C651-14' },
    { k: 'c.cf4', t: 'yn', q: 'Contractor provided a labelled sketch: all mains, valve positions, sources, flush / verification / injection points' },
    { k: 'c.cf5', t: 'yn', q: 'All flushing / discharge locations approved by the PWD Industrial Waste & Backflow Unit AND the Collector Systems Unit', flag: true },
    { k: 'c.cf5b', t: 'yn', q: 'Dechlorination of the flush water required by either unit (IW or CS)', good: null, warnOn: 'Y', flag: true, hint: 'If Yes, plan the dechlorination before flushing.' },
    { k: 'cf.srcValve', t: 'text', q: 'Source (control valve) for this disinfection' },
    { k: 'cf.srcFlushPt', t: 'text', q: 'Flush point for the source flush' },
    { k: 'cf.srcFlushRate', t: 'num', u: 'gpm', q: 'Source flush estimated flow rate' },
    { k: 'cf.srcFlushStart', t: 'time', q: 'Start of source flush' },
    { k: 'cf.srcFlushEnd', t: 'time', q: 'End of source flush' },
    CK.srcTotal
  ] },
  { g: 'Disinfection setup (Sec III, questions 1–6)', items: [
    { k: 'cf.testMethod', t: 'text', q: 'Method used to measure free chlorine in the field', ph: 'e.g. Hach DR300' },
    { k: 'cf.analyst', t: 'text', q: 'Who is doing the analysis' },
    { k: 'cf.ferrule', t: 'text', q: 'Injection point ferrule size' },
    { k: 'cf.injLoc', t: 'text', q: 'Injection point location' },
    { k: 'cf.within10', t: 'yn', q: 'Injection point within 10 ft of where the source water enters the main', flag: true },
    { k: 'cf.mfr', t: 'text', q: 'Chlorinating material manufacturer' },
    { k: 'cf.brand', t: 'text', q: 'Brand name' },
    { k: 'cf.chem', t: 'text', q: 'Chemical name', ph: 'e.g. sodium hypochlorite 12.5%' },
    { k: 'cf.injConc', t: 'num', u: 'ppm', q: 'Injection concentration' },
    { k: 'cf.injRate', t: 'num', u: 'gpm', q: 'Injection rate' },
    { k: 'cf.tmin', t: 'num', u: 'ppm', q: 'Target concentration in the main: minimum', hint: 'Readings at or above this count as in range.' },
    { k: 'cf.tmax', t: 'num', u: 'ppm', q: 'Target concentration in the main: maximum', hint: 'Readings at or below this count as in range.' },
    { k: 'cf.nsf', t: 'yn', q: 'NSF/ANSI 60 certification and SDS sent to the PWD BLS Pipelines Group', flag: true },
    { t: 'cfpoints' },
    { k: 'cf.interval', t: 'num', u: 'min', q: 'Target measurement interval for all flush and verification points' }
  ] },
  { g: 'Live log', live: true, items: [
    BLS_LOAD_NOTE,
    { k: 'c.blsLoaded', t: 'yn', q: 'Contacted BLS when the main was loaded', show: c => c.ri > 0 },
    { t: 'cflive' },
    { t: 'timer', id: 'interval' },
    LOGS_NOTE
  ] },
  { g: 'Verification and hold (Sec III, questions 6–11)', after: true, items: [
    { k: 'cf.q6', t: 'yn', q: 'Each flush and verification point had at least 2 readings in a row inside the target range', hint: c => c.cfs.stableText },
    { k: 'cf.q7', t: 'yn', q: 'Injection and source shut off only after every point was stable in the target range' },
    { k: 'cf.q8', t: 'yn', q: 'All source and flush valves closed securely, so no disinfectant could get into the system or environment' },
    { k: 'cf.q9', t: 'yn', q: 'Logs completed for every injection, verification and flush point, with a separate entry for every start / change / stop and every reading' },
    { k: 't.holdStart', t: 'time', q: 'Start of 24-hour hold' },
    { t: 'timer', id: 'cfhold' },
    { k: 't.holdEnd', t: 'time', q: 'End of 24-hour hold' },
    { k: 'cf.q10', t: 'yn', q: 'Disinfectant sat in the main undisturbed for 24 hours' },
    { k: 'cf.q11', t: 'yn', q: 'After the hold, free chlorine at least 10 ppm at every flush and verification point, added to the logs, logs sent to BLS', hint: c => c.cfs.holdText },
    LOGS_NOTE,
    { k: 'cf.logsSent', t: 'yn', q: 'All Chlorine Verification Logs scanned and sent to the PWD lab' }
  ] },
  { g: 'Flushing after disinfection (Sec IV)', after: true, items: [
    FLUSH_NOTE,
    { t: 'calc' },
    { k: 't.flushStart', t: 'time', q: 'Flushing started' },
    { k: 'cf.s4_1', t: 'yn', q: 'Approved discharge locations (Sec II, question 5) used for all flushing' },
    { k: 'cf.s4_2', t: 'yn', q: 'Each flush point flushed until the discharge measured 0 ppm free chlorine', hint: c => c.cfs.flushText },
    CK.refill,
    ...AFTER_SHUTDOWN
  ] }
];

/* ---------- Resolution round (after a failed sample) ---------- */
RULES.resolution = { g: 'Lab result and fix', items: [
  { t: 'note', tone: 'info', html: 'Fill this in from the lab’s failure notice and the Resample Request’s lab section.' },
  { k: 'res.fix', t: 'sel', q: 'Lab’s recommended fix', opts: Object.entries(RULES.fixes) },
  { k: 'res.fixOther', t: 'text', q: 'Describe the fix', show: c => c.rd.res.fix === 'other' },
  { k: 'res.flushNeeded', t: 'yn', q: 'Flushing needed', good: null },
  { k: 'res.reCl2Needed', t: 'yn', q: 'Re-Cl₂ needed', good: null },
  { k: 'res.chargeable', t: 'yn', q: 'Chargeable sample', good: null },
  { k: 'method', t: 'sel', q: 'How will it be re-chlorinated?', opts: [['rsform', 'Resample form (Sec IV–V)'], ['cf', 'Full continuous-feed log']], show: c => c.rd.res.fix === 'rechlor' },
  { k: 'res.by', t: 'sel', q: 'Who did the work', opts: [['inhouse', 'Contractor in-house'], ['sub', 'Sub-contractor']] },
  { k: 'res.subCo', t: 'text', q: 'Sub-contractor company', show: c => c.rd.res.by === 'sub' },
  { k: 'res.subContact', t: 'text', q: 'Sub-contractor contact', show: c => c.rd.res.by === 'sub' },
  { k: 'res.subPhone', t: 'tel', q: 'Sub-contractor phone', show: c => c.rd.res.by === 'sub' },
  { k: 'res.how', t: 'text', q: 'Method', ph: 'e.g. 2½" hydrant flush, pump injection' },
  { k: 'res.product', t: 'text', q: 'Product used' },
  { k: 'res.amount', t: 'text', q: 'Amount used' },
  CK.waterT, CK.airT, CK.weather,
  { t: 'auto', q: 'Previously disinfected (most recent load)', v: c => c.prevLoaded }
] };

/* Resample Request: reflush and scour flush (Sec II–III) */
RULES.reflush = [
  { g: 'Actions before flushing (Resample Sec II)', items: [
    { t: 'timer', id: 'preflush' },
    { k: 'c.p7', t: 'yn', q: 'Supply main flushed at least 15 minutes before filling' },
    FLUSH_NOTE,
    { t: 'calc' },
    { k: 't.flushStart', t: 'time', q: 'Flushing started' },
    BLS_FLUSH_NOTE,
    { k: 'c.blsFlush', t: 'yn', q: 'Contacted BLS during flushing' },
    { k: 'c.f2', t: 'yn', q: 'At least 3 pipe volumes of fill water flushed through a hydrant or blowoff at the end of the new main' },
    CK.refill
  ] },
  { g: 'Re-flushing (Resample Sec III)', items: [
    { k: 'c.rs3', t: 'yn', q: 'After filling, the fill water sat without movement at least 16 hours' },
    ...AFTER_SHUTDOWN
  ] }
];

/* Resample Request: re-chlorination on the form (Sec IV–V) */
RULES.rechlor = [
  { g: 'Re-disinfection, continuous feed (Resample Sec IV)', items: [
    BLS_LOAD_NOTE,
    { k: 'c.blsLoaded', t: 'yn', q: 'Contacted BLS when the main was loaded' },
    { k: 'c.d1', t: 'yn', q: 'Before filling, valves set so strong chlorine solution cannot flow back into active mains' },
    { k: 't.loaded', t: 'time', q: 'Main loaded (chlorinated water pumping started)' },
    { k: 'c.rs4_2', t: 'yn', q: 'Chlorinated water pumped into the new main at a constant rate' },
    { t: 'ferrules' },
    { t: 'timer', id: 'hold' },
    { k: 'c.rs4_4', t: 'yn', q: 'After filling, the chlorinated water sat still at least 24 hours' },
    CK.hold
  ] },
  { g: 'Flushing after re-disinfection (Resample Sec V)', items: [
    FLUSH_NOTE,
    { t: 'calc' },
    { k: 't.flushStart', t: 'time', q: 'Flushing started' },
    { k: 'c.f2', t: 'yn', q: 'At least 3 pipe volumes flushed through a hydrant or blowoff at the end of the new main' },
    { k: 'c.f4', t: 'yn', q: 'Highly chlorinated water discharged to an approved sanitary sewer, or dechlorinated first' },
    CK.afterFlush,
    CK.refill,
    { k: 'c.f8', t: 'yn', q: 'After no free chlorine was verified, fill water sat without movement at least 16 hours' },
    ...AFTER_SHUTDOWN
  ] }
];

RULES.otherFix = [
  { g: 'Other fix', items: [
    { t: 'note', tone: 'info', html: 'Log what was done in <b>Notes</b>. Fill in the times below so the email and timers work.' },
    { k: 't.flushStart', t: 'time', q: 'Work / flushing started' },
    ...AFTER_SHUTDOWN
  ] }
];
RULES.ferruleMin = 25;

/* Lab results, BLS acceptable ranges.
   ok(value, baseline, multi) where multi = main disinfected more than once. */
RULES.lab = [
  { k: 'free', name: 'Free chlorine', u: 'mg/L', range: () => '0.10 or less', ok: v => v <= 0.10 },
  { k: 'total', name: 'Total chlorine', u: 'mg/L',
    range: b => b === null ? 'Above 1.00, no more than 0.50 below the main' : `Above 1.00, at least ${Math.max(1.01, b - 0.5).toFixed(2)} (main ${b} ppm)`,
    ok: (v, b) => v > 1.0 && (b === null || b - v <= 0.5) },
  { k: 'ph', name: 'pH', u: '', range: () => '7.0 to 7.4', ok: v => v >= 7.0 && v <= 7.4 },
  { k: 'turb', name: 'Turbidity', u: 'NTU', range: () => 'Below 0.400', ok: v => v < 0.4 },
  { k: 'odor', name: 'Odor', u: '', range: () => '0', ok: v => v === 0 },
  { k: 'coli', name: 'Total coliforms', u: '', range: () => '0', ok: v => v === 0, presence: true },
  { k: 'ecoli', name: 'E. coli', u: '', range: () => '0', ok: v => v === 0, presence: true },
  { k: 'hpc', name: 'HPC', u: '', range: (b, multi) => multi ? '6 or less (disinfected more than once)' : 'Below 50', ok: (v, b, multi) => multi ? v <= 6 : v < 50 }
];
RULES.bacterial = ['Total coliforms', 'E. coli', 'HPC'];

/* Job info: every field PWD wants in the email body, plus the form headers. */
RULES.jobFields = [
  { k: 'street', l: 'Street name' },
  { k: 'from', l: 'From (cross street)' },
  { k: 'to', l: 'To (cross street)' },
  { k: 'f.work', l: 'Work #' },
  { k: 'f.contract', l: 'Contract No.', opt: true },
  { k: 'f.sampleDate', l: 'Sample date requested', type: 'date' },
  { k: 'f.contractor', l: 'Contractor' },
  { k: 'f.contractorEmail', l: 'Contractor email', type: 'email' },
  { k: 'f.disSub', l: 'Disinfection sub-contractor', opt: true },
  { k: 'f.inspector', l: 'Inspector' },
  { k: 'f.inspEmail', l: 'Inspector email', type: 'email', opt: true },
  { k: 'f.phone', l: 'Inspector phone #', type: 'tel' },
  { k: 'f.engineer', l: 'Division engineer' },
  { k: 'f.engEmail', l: 'Division engineer email', type: 'email' },
  { k: 'f.appt', l: 'Appointment location', opt: true },
  { k: 'f.nFlush', l: 'Number of flushing locations', type: 'number' },
  { k: 'f.flushLoc', l: 'Flushing location(s)' },
  { k: 'f.nSamples', l: 'Number of samples requested', type: 'number' },
  { k: 'f.length', l: 'Length of main (ft)', type: 'number' },
  { k: 'f.dia', l: 'Diameter of main (in)', type: 'number' },
  { k: 'f.flushPipe', l: 'Flushing pipe size (in)', type: 'number' },
  { k: 'f.mfr', l: 'Pipe manufacturer' },
  { k: 'R.t.loaded', l: 'Date/time loaded for disinfection', type: 'datetime-local' },
  { k: 'R.t.flushStart', l: 'Date/time flushing started', type: 'datetime-local' },
  { k: 'R.t.shutdown', l: 'Date/time of shutdown', type: 'datetime-local' }
];

/* Email body, in PWD's order. */
RULES.emailBody = [
  ['Sample Date Requested', 'f.sampleDate', 'date'],
  ['Contractor', 'f.contractor'],
  ['Work #', 'f.work'],
  ['Inspector', 'f.inspector'],
  ['Inspector Phone #', 'f.phone'],
  ['Division Engineer', 'f.engineer'],
  ['Division Engineer Email', 'f.engEmail'],
  ['Street Location of Main', 'location'],
  ['# of Flushing Locations', 'f.nFlush'],
  ['Flushing Location(s)', 'f.flushLoc'],
  ['# of Samples Requested', 'f.nSamples'],
  ['Length (feet)', 'f.length'],
  ['Diameter (inches)', 'f.dia'],
  ['Flushing Pipe Size (inches)', 'f.flushPipe'],
  ['Date/Time Loaded for Disinfection', 'R.t.loaded', 'dt'],
  ['Date/Time Flushing Started', 'R.t.flushStart', 'dt'],
  ['Date/Time of Shutdown for Sanitary Release Testing', 'R.t.shutdown', 'dt']
];
RULES.subject = (isResample, work) => `Water Sample, ${isResample ? 'Resample' : 'Initial'} Request (${work || 'Work #'})`;

/* Flush calculator */
RULES.flush = {
  gallonsPerFt: d => 0.0408 * d * d,            // gallons = 0.0408 x d² x L
  gpmAt: (d, fps) => 2.448 * d * d * fps,       // 3 ft/s ≈ 7.34 x d²
  minutesPer100ft: 2
};

/* Notes log */
RULES.stages = ['Setup', 'Disinfecting', 'Flushing', '16-hr hold', 'Waiting on lab', 'Resolution'];
RULES.tags = ['Dirty pipe', 'Low pressure', 'Scour flush', 'Weather delay'];
