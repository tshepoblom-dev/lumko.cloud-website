/**
 * Declarative condition evaluation. Mirrored in public/diagnostic.php
 * (function cond_eval) — keep the two in step when adding a condition type.
 */
import type { Answers, AnswerValue, Cond, NumberAnswer, RaisedFlag } from './types.ts';

export type EvalContext = {
  answers: Answers;
  flags?: Map<string, RaisedFlag>;
  metrics?: Record<string, number | null>;
};

export const isNumberAnswer = (v: AnswerValue | undefined): v is NumberAnswer =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** Has the respondent given a usable answer? */
export function isAnswered(v: AnswerValue | undefined): boolean {
  if (v === undefined || v === null) return false;
  if (typeof v === 'string') return v.trim() !== '';
  if (Array.isArray(v)) return v.length > 0;
  return v.state !== undefined || (typeof v.value === 'number' && Number.isFinite(v.value));
}

/** The selected values as a list (single → [value], multi → values). */
function selected(v: AnswerValue | undefined): string[] {
  if (typeof v === 'string') return v === '' ? [] : [v];
  if (Array.isArray(v)) return v;
  if (isNumberAnswer(v) && v.unit) return [v.unit];
  return [];
}

export function evaluate(cond: Cond, ctx: EvalContext): boolean {
  if ('always' in cond) return true;
  if ('all' in cond) return cond.all.every((c) => evaluate(c, ctx));
  if ('any' in cond) return cond.any.some((c) => evaluate(c, ctx));
  if ('not' in cond) return !evaluate(cond.not, ctx);
  if ('flagCount' in cond) {
    const n = cond.flagCount.filter((id) => {
      const f = ctx.flags?.get(id);
      return f && (f.confirmed || cond.includeUncertain);
    }).length;
    return n >= cond.gte;
  }
  if ('flag' in cond) {
    const f = ctx.flags?.get(cond.flag);
    if (!f) return false;
    return cond.confirmed ? f.confirmed : true;
  }
  if ('metric' in cond) {
    const m = ctx.metrics?.[cond.metric];
    if (m === null || m === undefined || !Number.isFinite(m)) return false;
    if (cond.gte !== undefined && m < cond.gte) return false;
    if (cond.lte !== undefined && m > cond.lte) return false;
    return true;
  }

  const v = ctx.answers[cond.q];
  if ('answered' in cond) return isAnswered(v) === cond.answered;
  if ('in' in cond) return selected(v).some((s) => cond.in.includes(s));
  if ('notIn' in cond) {
    const s = selected(v);
    return s.length > 0 && !s.some((x) => cond.notIn.includes(x));
  }
  if ('state' in cond) return isNumberAnswer(v) && v.state === cond.state;
  if ('gte' in cond || 'lte' in cond) {
    if (!isNumberAnswer(v) || typeof v.value !== 'number' || v.state) return false;
    if ('gte' in cond) return v.value >= cond.gte;
    return v.value <= cond.lte;
  }
  if ('countGte' in cond || 'countLte' in cond) {
    const s = selected(v).filter((x) => !cond.among || cond.among.includes(x));
    if ('countGte' in cond) return s.length >= cond.countGte;
    return s.length <= cond.countLte;
  }
  return false;
}
