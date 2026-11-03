/**
 * Diagnostic scoring: branching, flags, dimensions, findings, headline.
 *
 * Scoring philosophy (ASSESSMENT_SPEC.md §G):
 *  - findings first; no universal percentage, no decimals on screen;
 *  - high-severity facts outweigh many low-severity positives;
 *  - "Not sure" raises an *uncertain* flag, one severity step lower than a
 *    confirmed issue, because missing visibility is itself relevant;
 *  - a result names 1–3 priorities, not a wall of warnings.
 *
 * Dimension status is transparent: each raised risk flag scores
 * high 3 / medium 2 / low 1, halved when uncertain.
 *   0 → Strong foundation · <3 → Worth reviewing ·
 *   ≥3 or any confirmed high → Priority area · ≥7 → Significant operational exposure
 */
import { evaluate, isAnswered, isNumberAnswer, type EvalContext } from './conditions.ts';
import { metricRecord, processMetrics } from './process-metrics.ts';
import type {
  Answers,
  DiagnosticConfig,
  DiagnosticResult,
  DimensionResult,
  DimensionStatus,
  Finding,
  Option,
  Question,
  RaisedFlag,
  Severity,
  SingleQuestion,
  Step,
} from './types.ts';

export const SEVERITY_WEIGHT: Record<Severity, number> = { high: 3, medium: 2, low: 1 };
const DOWNGRADE: Record<Severity, Severity> = { high: 'medium', medium: 'low', low: 'low' };

export const DIMENSION_LABELS: Record<DimensionStatus, string> = {
  strong: 'Strong foundation',
  review: 'Worth reviewing',
  priority: 'Priority area',
  significant: 'Significant operational exposure',
};

export const PRIORITY_LABELS: Record<Finding['priority'], string> = {
  high: 'High priority',
  improve: 'Improve',
  investigate: 'Worth investigating',
  opportunity: 'Opportunity',
};

/* -------------------------------------------------------------------------- */
/* Branching                                                                   */
/* -------------------------------------------------------------------------- */

export function isQuestionVisible(q: Question, answers: Answers): boolean {
  return !q.showWhen || evaluate(q.showWhen, { answers });
}

/**
 * Steps the respondent should see given their answers so far. A step with no
 * visible questions is skipped; a step whose `endsWhen` holds ends the flow.
 */
export function visibleSteps(config: DiagnosticConfig, answers: Answers): { steps: Step[]; endedEarly: boolean } {
  const steps: Step[] = [];
  for (const step of config.steps) {
    const questions = step.questions.filter((q) => isQuestionVisible(q, answers));
    if (!questions.length) continue;
    steps.push({ ...step, questions });
    if (step.endsWhen && evaluate(step.endsWhen, { answers })) return { steps, endedEarly: true };
  }
  return { steps, endedEarly: false };
}

export function findQuestion(config: DiagnosticConfig, id: string): Question | undefined {
  for (const s of config.steps) for (const q of s.questions) if (q.id === id) return q;
  return undefined;
}

/** Only answers to questions that are visible on the respondent's path. */
export function pruneAnswers(config: DiagnosticConfig, answers: Answers): Answers {
  const out: Answers = {};
  for (const s of visibleSteps(config, answers).steps)
    for (const q of s.questions) if (isAnswered(answers[q.id])) out[q.id] = answers[q.id];
  return out;
}

/** Options for a single-select, resolving `optionsFrom` (A2.2). */
export function resolveOptions(config: DiagnosticConfig, q: Question, answers: Answers): Option[] {
  if (q.type !== 'single' && q.type !== 'multi') return [];
  if (q.type === 'single' && q.optionsFrom) {
    const src = findQuestion(config, q.optionsFrom.q);
    const chosen = answers[q.optionsFrom.q];
    const list = Array.isArray(chosen) ? chosen : typeof chosen === 'string' ? [chosen] : [];
    const base =
      src && (src.type === 'multi' || src.type === 'single')
        ? src.options.filter((o) => list.includes(o.value) && !o.exclusive)
        : [];
    const extra = (q.optionsFrom.extra ?? []).filter((e) => evaluate(e.when, { answers })).map((e) => e.option);
    return [...base, ...extra];
  }
  return q.options;
}

/* -------------------------------------------------------------------------- */
/* Answer formatting (evidence)                                                */
/* -------------------------------------------------------------------------- */

const nf = new Intl.NumberFormat('en-ZA', { maximumFractionDigits: 1 });
export const formatNumber = (n: number) => nf.format(n);

export function answerLabel(config: DiagnosticConfig, q: Question, answers: Answers): string {
  const v = answers[q.id];
  if (!isAnswered(v)) return '';
  if (q.type === 'text') return String(v);
  if (q.type === 'number') {
    if (!isNumberAnswer(v)) return '';
    if (v.state === 'unsure') return q.unsureLabel ?? 'Not sure';
    if (v.state === 'none') return q.noneLabel ?? 'None';
    const unit = q.units?.find((u) => u.value === v.unit)?.label;
    const val = `${q.prefix ?? ''}${formatNumber(v.value ?? 0)}`;
    return unit ? `${val} ${unit}` : q.suffix ? `${val} ${q.suffix}` : val;
  }
  const opts = resolveOptions(config, q, answers);
  const all = q.type === 'single' && q.optionsFrom ? [...opts, ...((findQuestion(config, q.optionsFrom.q) as SingleQuestion | undefined)?.options ?? [])] : opts;
  const values = Array.isArray(v) ? v : [String(v)];
  return values.map((x) => all.find((o) => o.value === x)?.label ?? x).join('; ');
}

/* -------------------------------------------------------------------------- */
/* Results                                                                     */
/* -------------------------------------------------------------------------- */

export function computeFlags(config: DiagnosticConfig, ctx: EvalContext): Map<string, RaisedFlag> {
  const flags = new Map<string, RaisedFlag>();
  const c: EvalContext = { ...ctx, flags };
  for (const def of config.flags) {
    let confirmed: boolean | null = null;
    if (evaluate(def.when, c)) confirmed = true;
    else if (def.uncertainWhen && evaluate(def.uncertainWhen, c)) confirmed = false;
    if (confirmed === null) continue;
    let severity = def.severity;
    if (confirmed) {
      const o = def.severityWhen?.find((s) => evaluate(s.when, c));
      if (o) severity = o.severity;
    } else severity = DOWNGRADE[severity];
    flags.set(def.id, {
      id: def.id,
      label: def.label,
      dimension: def.dimension,
      severity,
      confirmed,
      kind: def.kind ?? 'risk',
    });
  }
  return flags;
}

function flagScore(f: RaisedFlag): number {
  return f.kind === 'opportunity' ? 0 : SEVERITY_WEIGHT[f.severity] * (f.confirmed ? 1 : 0.5);
}

export function dimensionStatus(flags: RaisedFlag[]): DimensionStatus {
  const score = flags.reduce((s, f) => s + flagScore(f), 0);
  const confirmedHigh = flags.some((f) => f.kind === 'risk' && f.confirmed && f.severity === 'high');
  if (score >= 7) return 'significant';
  if (score >= 3 || confirmedHigh) return 'priority';
  if (score > 0) return 'review';
  return 'strong';
}

function fmtMetric(id: string, metrics: Record<string, number | null>): string {
  const m = metrics[id];
  return m === null || m === undefined ? 'an unknown number of' : formatNumber(m);
}

export function interpolate(
  text: string,
  config: DiagnosticConfig,
  answers: Answers,
  metrics: Record<string, number | null>,
  outcomes: DiagnosticResult['outcomes'] = {},
): string {
  return text.replace(/\{(q|m|o):([a-z0-9_]+)\}/gi, (_, kind: string, id: string) => {
    if (kind === 'm') return fmtMetric(id, metrics);
    if (kind === 'o') return outcomes[id]?.label ?? '';
    const q = findQuestion(config, id);
    return q ? answerLabel(config, q, answers) || 'this process' : '';
  });
}

function rank(f: Finding): number {
  return SEVERITY_WEIGHT[f.severity] * (f.confirmed ? 2 : 1);
}

export function computeResult(config: DiagnosticConfig, rawAnswers: Answers): DiagnosticResult {
  const { endedEarly } = visibleSteps(config, rawAnswers);
  const answers = pruneAnswers(config, rawAnswers);

  const pm = config.metrics ? processMetrics(config.metrics, answers) : null;
  const metrics = pm ? metricRecord(pm) : {};
  const flags = computeFlags(config, { answers, metrics });
  const ctx: EvalContext = { answers, metrics, flags };
  const raised = [...flags.values()];

  const outcomes: DiagnosticResult['outcomes'] = {};
  for (const o of config.outcomes ?? []) {
    const level = o.levels.find((l) => evaluate(l.when, ctx));
    if (level) outcomes[o.id] = { value: level.value, label: level.label, body: interpolate(level.body, config, answers, metrics) };
  }

  const dimensions: DimensionResult[] = config.dimensions.map((d) => {
    const fs = raised.filter((f) => f.dimension === d.id);
    const status = dimensionStatus(fs);
    return { ...d, status, statusLabel: DIMENSION_LABELS[status], flags: fs };
  });

  const findings: Finding[] = [];
  config.findings.forEach((def) => {
    const hits = def.flags.map((id) => flags.get(id)).filter((f): f is RaisedFlag => !!f);
    if (!hits.length) return;
    const severity = hits.reduce<Severity>((s, f) => (SEVERITY_WEIGHT[f.severity] > SEVERITY_WEIGHT[s] ? f.severity : s), 'low');
    const confirmed = hits.some((f) => f.confirmed);
    const kind = def.kind ?? 'risk';
    const priority: Finding['priority'] =
      kind === 'opportunity'
        ? 'opportunity'
        : severity === 'high' && confirmed
          ? 'high'
          : (severity === 'medium' && confirmed) || severity === 'high'
            ? 'improve'
            : 'investigate';
    const evidence = def.evidence
      .map((id) => {
        const q = findQuestion(config, id);
        if (!q || !isAnswered(answers[id])) return '';
        return `${q.short}: ${answerLabel(config, q, answers)}`;
      })
      .filter(Boolean);
    const t = (s: string) => interpolate(s, config, answers, metrics, outcomes);
    findings.push({
      id: def.id,
      title: t(def.title),
      finding: t(def.finding),
      why: t(def.why),
      nextStep: t(def.nextStep),
      service: def.service,
      capability: def.capability,
      kind,
      severity,
      confirmed,
      priority,
      priorityLabel: PRIORITY_LABELS[priority],
      evidence,
      flags: hits.map((f) => f.id),
    });
  });

  const order = new Map(findings.map((f, i) => [f.id, i]));
  const risks = findings
    .filter((f) => f.kind !== 'opportunity')
    .sort((a, b) => rank(b) - rank(a) || order.get(a.id)! - order.get(b.id)!);
  const opportunities = findings.filter((f) => f.kind === 'opportunity');

  const headlineDef = config.headlines.find((h) => evaluate(h.when, ctx)) ?? config.headlines[config.headlines.length - 1];
  const headline = {
    title: interpolate(headlineDef.title, config, answers, metrics, outcomes),
    body: interpolate(headlineDef.body, config, answers, metrics, outcomes),
  };

  let process: DiagnosticResult['process'];
  if (pm && config.metrics) {
    const typeQ = findQuestion(config, config.metrics.processType);
    const nameQ = findQuestion(config, config.metrics.processName);
    const typeLabel = typeQ ? answerLabel(config, typeQ, answers) : '';
    const name = (nameQ && answerLabel(config, nameQ, answers)) || typeLabel;
    process = { ...pm, name, type: String(answers[config.metrics.processType] ?? ''), typeLabel };
  }

  return {
    diagnostic: config.id,
    version: config.version,
    headline,
    flags: raised,
    dimensions,
    findings: [...risks, ...opportunities],
    priorities: risks.slice(0, 3),
    opportunities,
    outcomes,
    metrics,
    process,
    endedEarly,
  };
}
