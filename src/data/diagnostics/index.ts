/**
 * Diagnostics registry: configs plus the landing/hub content for each.
 * To add a diagnostic (e.g. Cyber Resilience): write its config, add an entry
 * here and create src/pages/diagnostics/<slug>.astro. The engine is unchanged.
 */
import type { DiagnosticConfig, DiagnosticId } from '../../lib/diagnostics/types.ts';
import { processDiagnostic } from './process.ts';
import { dataDiagnostic } from './data.ts';
import { digitalTaxDiagnostic } from './digital-tax.ts';
import { aiDiagnostic } from './ai.ts';

export const CONFIGS: Record<DiagnosticId, DiagnosticConfig> = {
  process: processDiagnostic,
  data: dataDiagnostic,
  'digital-tax': digitalTaxDiagnostic,
  ai: aiDiagnostic,
};

export type DiagnosticMeta = {
  id: DiagnosticId;
  href: string;
  name: string;
  icon: string;
  /** The hidden issue it investigates. */
  hook: string;
  sub: string;
  who: string;
  time: string;
  receive: string;
  cta: string;
  /** Landing page content. */
  seo: { title: string; description: string };
  problem: string[];
  checks: string[];
  usefulFor: string[];
  why: string;
  claims: string[];
  flagship?: boolean;
};

export const DIAGNOSTICS: DiagnosticMeta[] = [
  {
    id: 'process',
    href: '/diagnostics/process',
    name: 'Paper & Process Diagnostic',
    icon: 'ph:flow-arrow-light',
    flagship: true,
    hook: 'Find the manual processes hiding inside your organisation.',
    sub: 'Analyse one workflow. See where information is recaptured, where approvals wait, how difficult records are to retrieve and how much staff time the process consumes.',
    who: 'Operations managers, department heads, COOs and programme managers.',
    time: '7–10 minutes',
    receive: 'A Process Digitisation Report with estimated annual administrative load and a recommended first intervention.',
    cta: 'Analyse a process',
    seo: {
      title: 'Paper & Process Diagnostic: find manual work worth digitising',
      description:
        'Analyse one business process and estimate its annual administrative load. Identify repeated capture, approval delays, retrieval problems and key-person dependency. Free diagnostic from Lumko, South Africa.',
    },
    problem: [
      'Manual work rarely announces itself. It sits in a form captured three times, an approval nobody can track, or a report that takes two days to compile.',
      'It hides in organisations with modern ERP and CRM systems too, in the gaps between them that staff bridge with spreadsheets, email and WhatsApp.',
    ],
    checks: [
      'How information enters the process, and whether it is printed, signed and scanned',
      'How many people handle each item and how often it is recaptured',
      'Volume and active staff time, converted into estimated annual hours',
      'How approvals are obtained, chased and tracked',
      'How quickly management can see accurate information',
      'How long it takes to retrieve an older record, and whether changes are traceable',
      'Where the master record lives, and how much depends on one person',
    ],
    usefulFor: [
      'Organisations still running core processes on paper',
      'Teams that replaced paper with PDFs, email and spreadsheets but kept the same workflow',
      'Organisations with established systems where staff still move information between them by hand',
    ],
    why: 'We ask for approximate volumes and staff-minutes so the report can show time, not guesses. If you add an hourly rate, we show an indicative cost range; otherwise we report hours only.',
    claims: [],
  },
  {
    id: 'data',
    href: '/diagnostics/data',
    name: 'Data Exposure & POPIA Diagnostic',
    icon: 'ph:shield-check-light',
    hook: 'If information was compromised tomorrow, would you know what was affected?',
    sub: 'Understand where organisational information lives, who can access it and whether you could trace the impact of an incident.',
    who: 'CIOs and IT managers, risk and compliance leads, information officers, COOs.',
    time: '5–7 minutes',
    receive: 'An Information Exposure Report covering inventory, access, third parties, incident traceability and recovery.',
    cta: 'Check data exposure',
    seo: {
      title: 'Data Exposure & POPIA Diagnostic: an operational data security assessment',
      description:
        'Find out whether your organisation knows where personal and confidential information is held, who can access it and whether an incident could be traced. An operational assessment, not legal advice.',
    },
    problem: [
      'Most organisations protect the systems they know about. Exposure tends to sit elsewhere: in inboxes, personal devices, messaging apps, shared accounts and providers nobody has listed.',
      'The question that matters after an incident is not only whether information was protected, but whether you can establish what was affected and who to contact.',
    ],
    checks: [
      'Which categories of information you hold, and where they are stored',
      'Whether you could produce an inventory of systems holding personal information',
      'Role-based access, shared accounts and what happens when staff leave',
      'Visibility of third parties that process your information',
      'Whether a compromised account could be scoped and affected people identified',
      'Backup coverage and when recovery was last tested',
    ],
    usefulFor: [
      'Organisations holding customer, employee, financial or health information',
      'Teams preparing for a security or information-governance review',
      'Executives who want a practical view of exposure before commissioning a full audit',
    ],
    why: 'We only ask about categories and practices. We never ask for passwords, account numbers or any actual personal information.',
    claims: ['popia_security_compromise'],
  },
  {
    id: 'digital-tax',
    href: '/diagnostics/digital-tax',
    name: 'Digital Tax & E-Invoicing Readiness Diagnostic',
    icon: 'ph:receipt-light',
    hook: 'Is your invoicing system ready for a more digital tax environment?',
    sub: 'Look beyond PDF invoices and assess the data, records, integrations and manual work behind your financial processes.',
    who: 'CFOs, financial managers, financial controllers and IT managers.',
    time: '5–7 minutes',
    receive: 'An Invoicing Data Readiness Report covering invoice generation, master data, reconciliation, integration, audit trail and retrieval.',
    cta: 'Check tax-system readiness',
    seo: {
      title: 'Digital Tax & E-Invoicing Readiness: assess your invoicing systems',
      description:
        'Assess whether your invoicing and transaction systems could adapt to more structured digital reporting, including SARS VAT modernisation. Technology-readiness guidance, not tax advice.',
    },
    problem: [
      'A PDF invoice can look digital while the data behind it is typed, copied and reconciled by hand.',
      'As tax administration moves towards structured digital exchange, the readiness question is less about the invoice and more about the data flow that produces it.',
    ],
    checks: [
      'How invoices are created, and whether invoice data is recaptured',
      'The quality and ownership of customer and supplier master data',
      'How reconciliation is performed and how much is manual',
      'Traceability of changes, cancellations and credit/debit notes',
      'Whether transaction data can be exported or exchanged in structured form',
      'How quickly older invoices and supporting records can be retrieved',
    ],
    usefulFor: [
      'VAT vendors planning ahead for VAT modernisation',
      'Organisations whose invoices start in an operational or billing system',
      'Finance teams carrying a heavy reconciliation load',
    ],
    why: 'We ask how your systems behave, not what your tax position is. Please do not enter VAT numbers or financial figures.',
    claims: ['sars_vat_modernisation'],
  },
  {
    id: 'ai',
    href: '/diagnostics/ai',
    name: 'AI Exposure & Governance Diagnostic',
    icon: 'ph:sparkle-light',
    hook: 'Do you know how AI is already being used inside your organisation?',
    sub: 'Identify unmanaged use, information exposure and practical opportunities for controlled AI adoption.',
    who: 'CEOs and MDs, CIOs, risk and compliance leads, HR and department heads.',
    time: '5–7 minutes',
    receive: 'An AI Use and Opportunity Report balancing governance gaps with practical opportunities.',
    cta: 'Check AI exposure',
    seo: {
      title: 'AI Exposure & Governance Diagnostic for organisations in South Africa',
      description:
        'Find out how AI is already used in your organisation, what information may be shared with it, and where controlled AI could save staff time. Practical AI governance, not anti-AI.',
    },
    problem: [
      'In most organisations, AI use started before anyone decided how it should be used. That is usually a sign of genuine value.',
      'The gap is visibility: which tools, which accounts, which information and who is accountable when AI output reaches a customer.',
    ],
    checks: [
      'How widely AI is used, and whether that use is approved',
      'Whether staff use organisation-managed or personal accounts',
      'What kinds of information may be pasted or uploaded',
      'Human review of AI output and accountability for decisions affecting people',
      'Written guidance, training and ownership',
      'Where controlled AI or automation could save substantial time',
    ],
    usefulFor: [
      'Executives who suspect AI is already in daily use',
      'Organisations drafting their first AI-use guideline',
      'Teams looking for a sensible first AI pilot',
    ],
    why: 'We ask about patterns of use, not about individuals. The aim is a realistic picture, so there are no wrong answers.',
    claims: ['eu_ai_act_literacy'],
  },
];

export const metaFor = (id: DiagnosticId) => DIAGNOSTICS.find((d) => d.id === id)!;
