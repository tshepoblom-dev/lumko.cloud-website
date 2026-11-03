/**
 * Factual "change is happening" statements used on public pages.
 *
 * Rules:
 *  - primary authorities only (SARS, Information Regulator, official EU sources);
 *  - keep the public wording conservative: describe what the source says,
 *    never a deadline or obligation the source does not state;
 *  - re-check every claim before relying on it, and update `checked`.
 *
 * The diagnostics themselves ask operational questions and do not depend on
 * these claims.
 */
export type Claim = {
  id: string;
  /** Public wording. */
  claim: string;
  sourceOrg: string;
  sourceTitle: string;
  sourceUrl: string;
  /** ISO date the source was last checked. */
  checked: string;
  /** Internal note: what to watch, caveats. Not shown publicly. */
  note: string;
};

export const CLAIMS: Record<string, Claim> = {
  sars_vat_modernisation: {
    id: 'sars_vat_modernisation',
    claim:
      'SARS is consulting on VAT modernisation, including proposals for e-invoicing and e-reporting introduced in phases. Final requirements and timelines are set by SARS, not by this diagnostic.',
    sourceOrg: 'South African Revenue Service (SARS)',
    sourceTitle: 'VAT Modernisation',
    sourceUrl: 'https://www.sars.gov.za/types-of-tax/value-added-tax/vat-modernisation/',
    checked: '2026-11-03',
    note:
      'Discussion paper Sept 2023; consultation paper Aug 2026 (comments closed 16 Oct 2026) proposes e-invoicing, interoperability and e-reporting, phased from large businesses. Do not state that VAT vendors are currently required to e-invoice. Re-check after SARS publishes its response to the consultation.',
  },
  popia_security_compromise: {
    id: 'popia_security_compromise',
    claim:
      'Under section 22 of POPIA, responsible parties must notify the Information Regulator and affected people of a security compromise. The Regulator receives these notifications through its eServices portal.',
    sourceOrg: 'Information Regulator (South Africa)',
    sourceTitle: 'Fact sheet: handling of security compromises',
    sourceUrl: 'https://inforegulator.org.za/2025/08/19/fact-sheet-handling-of-security-compromises/',
    checked: '2026-11-03',
    note:
      'Regulator guidance: notify as soon as reasonably possible after discovery; no risk threshold for reporting; portal mandatory since 1 April 2025. We only cite the duty to notify, to explain why traceability matters.',
  },
  eu_ai_act_literacy: {
    id: 'eu_ai_act_literacy',
    claim:
      'The EU AI Act includes an AI-literacy duty for organisations that provide or deploy AI systems, in application since February 2025. It is most relevant to organisations operating in, or serving, the EU.',
    sourceOrg: 'European Commission',
    sourceTitle: 'AI Literacy: Questions & Answers',
    sourceUrl: 'https://digital-strategy.ec.europa.eu/en/faqs/ai-literacy-questions-answers',
    checked: '2026-11-03',
    note:
      'Article 4 applied from 2 Feb 2025; national enforcement from 2 Aug 2026; amended by the Digital Omnibus on AI (mid-2026), which removed the "sufficient level" wording. South Africa has no equivalent AI statute; do not imply one.',
  },
};
