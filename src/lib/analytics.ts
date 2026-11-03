/**
 * Privacy-safe analytics hook.
 *
 * No analytics provider is installed. Events are pushed to `window.dataLayer`
 * if a tag manager is added later, and dispatched as a `lumko:analytics`
 * DOM event (used by tests). Only whitelisted, non-sensitive properties are
 * ever sent: never answers, contact details or results.
 */
export type AnalyticsProps = {
  diagnostic?: string;
  step?: number;
  section?: string;
  total?: number;
  cta?: string;
};

const ALLOWED: (keyof AnalyticsProps)[] = ['diagnostic', 'step', 'section', 'total', 'cta'];

declare global {
  interface Window {
    dataLayer?: Record<string, unknown>[];
  }
}

export function track(event: string, props: AnalyticsProps = {}): void {
  const clean: Record<string, string | number> = {};
  for (const k of ALLOWED) {
    const v = props[k];
    if (typeof v === 'number' || (typeof v === 'string' && /^[\w-]{1,40}$/.test(v))) clean[k] = v;
  }
  try {
    window.dataLayer?.push({ event, ...clean });
    window.dispatchEvent(new CustomEvent('lumko:analytics', { detail: { event, ...clean } }));
  } catch {
    /* analytics must never break the page */
  }
}

/** Track clicks on any element with data-analytics="event_name". */
export function bindClickTracking(): void {
  document.addEventListener('click', (e) => {
    const el = (e.target as Element | null)?.closest<HTMLElement>('[data-analytics]');
    if (!el) return;
    track(el.dataset.analytics!, {
      diagnostic: el.dataset.analyticsDiagnostic,
      cta: el.dataset.analyticsCta,
    });
  });
}

const ATTR_KEY = 'lumko-attribution';

export type Attribution = {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
  referrer?: string;
  landing?: string;
};

/** Remember first-touch UTM values and referrer for this browser session. */
export function captureAttribution(): void {
  try {
    if (sessionStorage.getItem(ATTR_KEY)) return;
    const p = new URLSearchParams(location.search);
    const a: Attribution = {};
    for (const k of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'] as const) {
      const v = p.get(k);
      if (v) a[k] = v.slice(0, 100);
    }
    if (document.referrer && !document.referrer.startsWith(location.origin)) a.referrer = document.referrer.slice(0, 300);
    a.landing = location.pathname;
    sessionStorage.setItem(ATTR_KEY, JSON.stringify(a));
  } catch {
    /* storage unavailable */
  }
}

export function getAttribution(): Attribution {
  try {
    return JSON.parse(sessionStorage.getItem(ATTR_KEY) || '{}') as Attribution;
  } catch {
    return {};
  }
}
