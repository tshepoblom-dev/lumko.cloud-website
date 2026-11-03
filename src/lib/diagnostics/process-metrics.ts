/**
 * Process Diagnostic calculations (ASSESSMENT_SPEC.md, Stage A5).
 * Mirrored in public/diagnostic.php (function process_metrics).
 *
 *   annual_volume          = frequency normalised to a year
 *   annual_processing_hrs  = annual_volume × active staff-minutes per item ÷ 60
 *   annual_reporting_hrs   = reporting time normalised to a year
 *   estimated_admin_hours  = processing + reporting
 *
 * Waiting time is never counted as labour. Cost is only estimated when the
 * respondent supplies an hourly rate, and is shown as a range, never "savings".
 */
import { isNumberAnswer } from './conditions.ts';
import type { Answers, ProcessMetrics, ProcessMetricsDef } from './types.ts';

/** Working days per year used to normalise "per day" volumes. */
export const WORKING_DAYS = 250;
/** Productive hours in a full-time year, for the staff-equivalent figure. */
export const FTE_HOURS = 1800;

const VOLUME_FACTOR: Record<string, number> = { day: WORKING_DAYS, week: 52, month: 12, year: 1 };
const REPORT_FACTOR: Record<string, number> = { week: 52, month: 12, quarter: 4, year: 1 };

export const ADMIN_LOAD_LABELS = {
  low: 'Low',
  moderate: 'Moderate',
  significant: 'Significant',
  very_significant: 'Very significant',
} as const;

function num(answers: Answers, id: string): { value: number | null; unit?: string; state?: string } {
  const v = answers[id];
  if (!isNumberAnswer(v)) return { value: null };
  if (v.state) return { value: null, state: v.state, unit: v.unit };
  const n = typeof v.value === 'number' && Number.isFinite(v.value) && v.value >= 0 ? v.value : null;
  return { value: n, unit: v.unit };
}

/** Round to a sensible, non-precise figure. */
export function roundHours(h: number): number {
  if (h < 10) return Math.round(h);
  if (h < 100) return Math.round(h / 5) * 5;
  if (h < 1000) return Math.round(h / 10) * 10;
  return Math.round(h / 50) * 50;
}

function roundMoney(r: number): number {
  const step = r >= 1_000_000 ? 50_000 : r >= 100_000 ? 10_000 : 1_000;
  return Math.round(r / step) * step;
}

export function adminLoadBand(hours: number): ProcessMetrics['adminLoad'] {
  if (hours < 100) return 'low';
  if (hours < 500) return 'moderate';
  if (hours < 2000) return 'significant';
  return 'very_significant';
}

export function processMetrics(def: ProcessMetricsDef, answers: Answers): ProcessMetrics {
  const freq = num(answers, def.frequency);
  const mins = num(answers, def.minutes);
  const rep = num(answers, def.reporting);
  const rate = num(answers, def.rate);

  const annualVolume =
    freq.value !== null && freq.unit && VOLUME_FACTOR[freq.unit] ? freq.value * VOLUME_FACTOR[freq.unit] : null;
  const monthlyVolume = annualVolume !== null ? annualVolume / 12 : null;

  const annualProcessingHours =
    annualVolume !== null && mins.value !== null ? (annualVolume * mins.value) / 60 : null;

  let annualReportingHours: number | null = null;
  if (rep.state === 'none') annualReportingHours = 0;
  else if (rep.value !== null && rep.unit && REPORT_FACTOR[rep.unit]) annualReportingHours = rep.value * REPORT_FACTOR[rep.unit];

  let estimatedAdminHours: number | null = null;
  let partial = false;
  if (annualProcessingHours !== null) {
    estimatedAdminHours = annualProcessingHours + (annualReportingHours ?? 0);
    partial = annualReportingHours === null;
  } else if (annualReportingHours !== null && annualReportingHours > 0) {
    estimatedAdminHours = annualReportingHours;
    partial = true;
  }

  const est = estimatedAdminHours !== null ? roundHours(estimatedAdminHours) : null;
  const hourly = rate.value !== null && rate.value > 0 ? rate.value : null;
  const adminLoad = est !== null ? adminLoadBand(est) : null;

  return {
    annualVolume: annualVolume !== null ? Math.round(annualVolume) : null,
    monthlyVolume: monthlyVolume !== null ? Math.round(monthlyVolume) : null,
    minutesPerItem: mins.value,
    annualProcessingHours: annualProcessingHours !== null ? roundHours(annualProcessingHours) : null,
    annualReportingHours: annualReportingHours !== null ? roundHours(annualReportingHours) : null,
    estimatedAdminHours: est,
    fte: est !== null ? Math.round((est / FTE_HOURS) * 10) / 10 : null,
    costLow: est !== null && hourly !== null ? roundMoney(est * hourly * 0.8) : null,
    costHigh: est !== null && hourly !== null ? roundMoney(est * hourly * 1.2) : null,
    adminLoad,
    adminLoadLabel: adminLoad ? ADMIN_LOAD_LABELS[adminLoad] : null,
    partial,
  };
}

/** Flattened numbers for use in conditions ({metric: ...}). */
export function metricRecord(m: ProcessMetrics): Record<string, number | null> {
  return {
    annual_volume: m.annualVolume,
    monthly_volume: m.monthlyVolume,
    minutes_per_item: m.minutesPerItem,
    annual_processing_hours: m.annualProcessingHours,
    annual_reporting_hours: m.annualReportingHours,
    estimated_admin_hours: m.estimatedAdminHours,
    fte: m.fte,
    cost_low: m.costLow,
    cost_high: m.costHigh,
  };
}
