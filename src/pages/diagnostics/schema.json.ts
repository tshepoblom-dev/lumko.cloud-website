/**
 * Build-time export of the diagnostic configurations for public/diagnostic.php.
 * The server uses it to validate submitted answers and to recalculate flags
 * and Process metrics, so client-side scores are never trusted blindly.
 * Contains only question/option/rule definitions: no user data.
 */
import type { APIRoute } from 'astro';
import { CONFIGS } from '@/data/diagnostics';
import { WORKING_DAYS } from '@/lib/diagnostics/process-metrics';
import { ORG_TYPES, INDUSTRIES, ORG_SIZES, REGIONS } from '@/data/diagnostics/shared';

export const GET: APIRoute = () =>
  new Response(
    JSON.stringify({
      generated: new Date().toISOString(),
      constants: { workingDays: WORKING_DAYS },
      lead: { org_type: ORG_TYPES, industry: INDUSTRIES, org_size: ORG_SIZES, region: REGIONS },
      diagnostics: Object.fromEntries(
        Object.values(CONFIGS).map((c) => [
          c.id,
          {
            id: c.id,
            version: c.version,
            title: c.title,
            steps: c.steps.map((s) => ({
              id: s.id,
              endsWhen: s.endsWhen,
              questions: s.questions.map((q) => ({
                id: q.id,
                type: q.type,
                short: q.short,
                optional: q.optional ?? false,
                showWhen: q.showWhen,
                options: 'options' in q ? q.options.map((o) => ({ value: o.value, label: o.label })) : undefined,
                optionsFrom:
                  q.type === 'single' && q.optionsFrom
                    ? { q: q.optionsFrom.q, extra: q.optionsFrom.extra?.map((e) => ({ when: e.when, option: e.option })) }
                    : undefined,
                units: q.type === 'number' ? q.units?.map((u) => u.value) : undefined,
                min: q.type === 'number' ? q.min : undefined,
                max: q.type === 'number' ? q.max : undefined,
                maxLength: q.type === 'text' ? q.maxLength ?? 120 : undefined,
              })),
            })),
            flags: c.flags,
            outcomes: c.outcomes?.map((o) => ({ id: o.id, levels: o.levels.map((l) => ({ value: l.value, label: l.label, when: l.when })) })),
            findings: c.findings.map((f) => ({ id: f.id, title: f.title, flags: f.flags, service: f.service, capability: f.capability, kind: f.kind ?? 'risk' })),
            dimensions: c.dimensions.map((d) => ({ id: d.id, label: d.label })),
            metrics: c.metrics,
          },
        ]),
      ),
    }),
    { headers: { 'Content-Type': 'application/json; charset=utf-8' } },
  );
