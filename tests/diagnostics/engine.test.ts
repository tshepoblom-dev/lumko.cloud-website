/**
 * Diagnostic engine tests. Run: npm run test:diagnostics
 * (Node's built-in runner with type stripping; no extra dependencies.)
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluate } from '../../src/lib/diagnostics/conditions.ts';
import { processMetrics } from '../../src/lib/diagnostics/process-metrics.ts';
import { computeResult, resolveOptions, visibleSteps, findQuestion, pruneAnswers } from '../../src/lib/diagnostics/scoring.ts';
import { CONFIGS } from '../../src/data/diagnostics/index.ts';
import type { Answers } from '../../src/lib/diagnostics/types.ts';

const P = CONFIGS.process;
const ids = (a: Answers, c = P) => visibleSteps(c, a).steps.flatMap((s) => s.questions.map((q) => q.id));

/** A heavily manual process: high opportunity. */
const MANUAL: Answers = {
  org_type: 'municipality',
  industry: 'government_and_municipalities',
  org_size: '201_500',
  a2_1: ['inspections', 'approvals'],
  a2_2: 'inspections',
  a2_3: 'Field inspection approval',
  a3_1: ['paper', 'whatsapp'],
  a3_2: 'frequently',
  a3_3: 'usually',
  a4_1: '5plus',
  a4_2: 'twice',
  a4_3: ['spreadsheet', 'report_template'],
  a4_4: 'frequently',
  a5_1: { value: 40, unit: 'day' },
  a5_2: { value: 30 },
  a5_4: { value: 8, unit: 'week' },
  a5_5: { value: 300 },
  a6_1: 'two_three',
  a6_2: ['physical', 'email'],
  a6_3: 'no',
  a6_4: ['phone', 'forgotten'],
  a6_5: 'week_plus',
  a7_1: 'report_only',
  a7_2: 'rarely',
  a7_3: 'frequently',
  a8_1: ['shared_folders', 'email', 'physical', 'ask_employee'],
  a8_2: 'hour_plus',
  a8_3: 'no',
  a9_1: 'multiple',
  a9_2: 'no',
  a10_1: 'depends',
  a10_2: 'no',
  a11_1: 'weekly',
  a11_2: ['handwriting', 'capture_error'],
  a12_1: ['print_sign', 'scan_back', 'excel_bridge', 'whatsapp'],
};

/** A well-systemised process. */
const SYSTEMISED: Answers = {
  org_type: 'private',
  industry: 'financial_services',
  org_size: '501_1000',
  a2_1: ['purchase_requests'],
  a2_2: 'purchase_requests',
  a3_1: ['erp_crm'],
  a3_2: 'no',
  a3_3: 'no',
  a4_1: '2',
  a4_2: 'no',
  a4_4: 'no',
  a5_1: { value: 20, unit: 'month' },
  a5_2: { value: 10 },
  a5_4: { state: 'none' },
  a6_1: 'one',
  a6_2: ['workflow'],
  a6_3: 'realtime',
  a6_4: ['auto_reminder'],
  a6_5: 'same_day',
  a7_1: 'realtime',
  a7_2: 'usually',
  a7_3: 'no',
  a8_1: ['one_system'],
  a8_2: 'under_1',
  a8_3: 'yes',
  a9_1: 'one_system',
  a10_1: 'yes',
  a10_2: 'yes',
  a11_1: 'rarely',
  a12_1: ['none'],
};

test('conditions: in / notIn / count / state', () => {
  const a: Answers = { x: 'a', m: ['p', 'q', 'r'], n: { state: 'unsure' } };
  assert.equal(evaluate({ q: 'x', in: ['a'] }, { answers: a }), true);
  assert.equal(evaluate({ q: 'x', notIn: ['a'] }, { answers: a }), false);
  assert.equal(evaluate({ q: 'missing', notIn: ['a'] }, { answers: a }), false);
  assert.equal(evaluate({ q: 'm', countGte: 3 }, { answers: a }), true);
  assert.equal(evaluate({ q: 'm', countGte: 2, among: ['p', 'z'] }, { answers: a }), false);
  assert.equal(evaluate({ q: 'n', state: 'unsure' }, { answers: a }), true);
});

test('process metrics: hours from volume × minutes, reporting normalised', () => {
  const m = processMetrics(P.metrics!, MANUAL);
  // 40/day × 250 = 10,000 items; × 30 min ÷ 60 = 5,000 h; reporting 8 × 52 = 416 h
  assert.equal(m.annualVolume, 10000);
  assert.equal(m.annualProcessingHours, 5000);
  assert.equal(m.annualReportingHours, 420); // 416 rounded to nearest 10
  assert.equal(m.estimatedAdminHours, 5400); // 5,416 rounded to nearest 50
  assert.equal(m.adminLoad, 'very_significant');
  assert.ok(m.costLow! < m.costHigh!);
  assert.equal(m.costLow, Math.round((5400 * 300 * 0.8) / 50000) * 50000);
});

test('process metrics: no rate → no cost; unsure minutes → no hours', () => {
  const m = processMetrics(P.metrics!, { ...MANUAL, a5_5: undefined, a5_2: { state: 'unsure' } });
  assert.equal(m.costLow, null);
  assert.equal(m.annualProcessingHours, null);
  assert.equal(m.estimatedAdminHours, 420);
  assert.equal(m.partial, true);
});

test('branching: A2.1 none shows A2.1b; "No" ends the diagnostic early', () => {
  assert.ok(!ids({ a2_1: ['inspections'] }).includes('a2_1b'));
  assert.ok(ids({ a2_1: ['none'] }).includes('a2_1b'));
  const v = visibleSteps(P, { a2_1: ['none'], a2_1b: 'no' });
  assert.equal(v.endedEarly, true);
  assert.equal(v.steps.at(-1)!.id, 'discovery');
  const r = computeResult(P, { a2_1: ['none'], a2_1b: 'no' });
  assert.equal(r.headline.title, 'No obvious manual process stood out.');
  assert.equal(r.outcomes.opportunity.value, 'not_assessed');
});

test('branching: A2.2 options come from A2.1, plus system hand-off when relevant', () => {
  const q = findQuestion(P, 'a2_2')!;
  assert.deepEqual(resolveOptions(P, q, { a2_1: ['leave', 'invoicing'] }).map((o) => o.value), ['leave', 'invoicing']);
  assert.deepEqual(resolveOptions(P, q, { a2_1: ['none'], a2_1b: 'yes' }).map((o) => o.value), ['system_handoff']);
});

test('branching: A4.3 only after recapture; approvals detail skipped when none', () => {
  assert.ok(!ids({ a4_2: 'no' }).includes('a4_3'));
  assert.ok(ids({ a4_2: 'once' }).includes('a4_3'));
  const none = ids({ a6_1: 'no' });
  for (const id of ['a6_2', 'a6_3', 'a6_4', 'a6_5']) assert.ok(!none.includes(id), id);
  assert.ok(ids({ a6_1: 'one' }).includes('a6_5'));
});

test('hidden answers from an abandoned branch are ignored', () => {
  const a = { ...MANUAL, a6_1: 'no' };
  const pruned = pruneAnswers(P, a);
  assert.equal(pruned.a6_4, undefined);
  const r = computeResult(P, a);
  assert.ok(!r.flags.some((f) => f.id === 'approvals_lost'));
});

test('flags: digital paper loop, repeated capture severity, not sure = uncertain', () => {
  const r = computeResult(P, MANUAL);
  const f = new Map(r.flags.map((x) => [x.id, x]));
  assert.ok(f.get('digital_paper_loop')?.confirmed);
  assert.equal(f.get('repeated_capture')?.severity, 'high');
  const once = computeResult(P, { ...MANUAL, a4_2: 'once' });
  assert.equal(once.flags.find((x) => x.id === 'repeated_capture')?.severity, 'medium');
  const unsure = computeResult(P, { ...MANUAL, a4_2: 'unsure' }).flags.find((x) => x.id === 'repeated_capture')!;
  assert.equal(unsure.confirmed, false);
  assert.equal(unsure.severity, 'low'); // medium downgraded one step
});

test('results: manual process is high opportunity with 1–3 priorities and evidence', () => {
  const r = computeResult(P, MANUAL);
  assert.equal(r.outcomes.opportunity.value, 'high');
  assert.equal(r.headline.title, 'This process is a strong candidate for digitisation.');
  assert.ok(r.headline.body.includes('Field inspection approval'));
  assert.ok(r.priorities.length >= 1 && r.priorities.length <= 3);
  assert.ok(r.priorities.every((p) => p.evidence.length > 0));
  assert.equal(r.process?.estimatedAdminHours, 5400);
  assert.ok(!JSON.stringify(r).includes('{q:'), 'tokens interpolated');
  assert.equal(r.outcomes.pseudo_signal.value, 'strong');
});

test('results: systemised process is targeted improvement, strong dimensions', () => {
  const r = computeResult(P, SYSTEMISED);
  assert.equal(r.outcomes.opportunity.value, 'targeted');
  assert.ok(r.dimensions.filter((d) => d.status === 'strong').length >= 3);
  assert.match(r.headline.title, /largely systemised/);
});

test('data diagnostic: B4.2 only when providers used; recovery never → high', () => {
  const D = CONFIGS.data;
  assert.ok(!ids({ b4_1: 'no' }, D).includes('b4_2'));
  assert.ok(ids({ b4_1: 'yes' }, D).includes('b4_2'));
  const r = computeResult(D, { b1_1: ['health'], b2_1: 'no', b2_2: ['whatsapp'], b6_2: 'never', b5_1: 'probably_not' });
  assert.equal(r.flags.find((f) => f.id === 'recovery_uncertainty')?.severity, 'high');
  assert.equal(r.flags.find((f) => f.id === 'data_inventory_gap')?.severity, 'high');
  assert.match(r.headline.title, /knowing where information is/);
});

test('digital tax: non-VAT framing; digital invoice with manual flow headline', () => {
  const T = CONFIGS['digital-tax'];
  const r = computeResult(T, { c1_1: 'no', c2_1: 'accounting_erp', c2_2: 'frequently', c4_2: 'sometimes', c6_1: 'api' });
  assert.equal(r.outcomes.framing.value, 'invoicing');
  assert.match(r.headline.title, /digital, but the underlying data flow is still manual/);
  assert.ok(r.opportunities.some((o) => o.id === 'integration_ready'));
});

test('ai diagnostic: D5.2 only for people decisions; no-use path skips usage', () => {
  const A = CONFIGS.ai;
  assert.ok(!ids({ d1_1: 'informal', d4_1: ['drafting'] }, A).includes('d5_2'));
  assert.ok(ids({ d1_1: 'informal', d4_1: ['hr'] }, A).includes('d5_2'));
  const noUse = ids({ d1_1: 'no' }, A);
  assert.ok(!noUse.includes('d2_1') && !noUse.includes('d3_1') && noUse.includes('d8_1'));
  const r = computeResult(A, { d1_1: 'informal', d2_1: 'personal', d3_1: ['customer'], d6_1: 'no', d8_1: ['drafting', 'reports', 'search'] });
  assert.match(r.headline.title, /adoption is ahead of governance/);
  assert.ok(r.opportunities.length >= 1);
  assert.equal(r.flags.find((f) => f.id === 'ai_data_exposure')?.severity, 'high');
});

test('every finding/headline references existing flags and questions', () => {
  for (const c of Object.values(CONFIGS)) {
    const flagIds = new Set(c.flags.map((f) => f.id));
    const dims = new Set([...c.dimensions.map((d) => d.id), 'opportunity']);
    for (const f of c.flags) assert.ok(dims.has(f.dimension), `${c.id}:${f.id} dimension`);
    for (const f of c.findings) {
      for (const id of f.flags) assert.ok(flagIds.has(id), `${c.id}:${f.id} → ${id}`);
      for (const q of f.evidence) assert.ok(findQuestion(c, q), `${c.id}:${f.id} evidence ${q}`);
    }
    const qids = c.steps.flatMap((s) => s.questions.map((q) => q.id));
    assert.equal(new Set(qids).size, qids.length, `${c.id} duplicate question ids`);
  }
});
