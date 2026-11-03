/**
 * Structured lead submission for public/diagnostic.php.
 * The server re-validates answers against /diagnostics/schema.json and
 * recalculates flags and Process metrics; client values are cross-checked.
 */
import { pruneAnswers } from './scoring.ts';
import type { Answers, DiagnosticConfig, DiagnosticResult } from './types.ts';
import type { Attribution } from '../analytics.ts';

export type LeadContact = {
  name: string;
  email: string;
  phone: string;
  organisation: string;
  role: string;
  org_type: string;
  industry: string;
  org_size: string;
  region: string;
  contact_consent: boolean;
  marketing_consent: boolean;
};

export type DiagnosticPayload = {
  diagnostic: { id: string; version: number };
  submitted_at: string;
  page: string;
  contact: Omit<LeadContact, 'contact_consent' | 'marketing_consent'>;
  consent: { contact: boolean; marketing: boolean };
  answers: Answers;
  result: {
    headline: string;
    priorities: { id: string; title: string; priority: string }[];
    findings: { id: string; severity: string; confirmed: boolean }[];
    flags: { id: string; severity: string; confirmed: boolean }[];
    dimensions: { id: string; status: string }[];
    outcomes: Record<string, string>;
    metrics: Record<string, number | null>;
  };
  process: null | {
    name: string;
    type: string;
    annual_volume: number | null;
    estimated_admin_hours: number | null;
    cost_low: number | null;
    cost_high: number | null;
  };
  attribution: Attribution;
  /** Bot traps. */
  website: string;
  ts: number;
};

export function buildPayload(
  config: DiagnosticConfig,
  answers: Answers,
  result: DiagnosticResult,
  contact: LeadContact,
  extra: { attribution: Attribution; website: string; ts: number; page: string },
): DiagnosticPayload {
  const { contact_consent, marketing_consent, ...details } = contact;
  return {
    diagnostic: { id: config.id, version: config.version },
    submitted_at: new Date().toISOString(),
    page: extra.page,
    contact: details,
    consent: { contact: contact_consent, marketing: marketing_consent },
    answers: pruneAnswers(config, answers),
    result: {
      headline: result.headline.title,
      priorities: result.priorities.map((p) => ({ id: p.id, title: p.title, priority: p.priority })),
      findings: result.findings.map((f) => ({ id: f.id, severity: f.severity, confirmed: f.confirmed })),
      flags: result.flags.map((f) => ({ id: f.id, severity: f.severity, confirmed: f.confirmed })),
      dimensions: result.dimensions.map((d) => ({ id: d.id, status: d.status })),
      outcomes: Object.fromEntries(Object.entries(result.outcomes).map(([k, v]) => [k, v.value])),
      metrics: result.metrics,
    },
    process: result.process
      ? {
          name: result.process.name,
          type: result.process.type,
          annual_volume: result.process.annualVolume,
          estimated_admin_hours: result.process.estimatedAdminHours,
          cost_low: result.process.costLow,
          cost_high: result.process.costHigh,
        }
      : null,
    attribution: extra.attribution,
    website: extra.website,
    ts: extra.ts,
  };
}
