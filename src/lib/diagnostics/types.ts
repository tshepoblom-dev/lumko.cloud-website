/**
 * Typed structures for the Lumko diagnostic engine.
 *
 * Everything in a DiagnosticConfig is plain data (no functions), so the same
 * configuration can be serialised to /diagnostics/schema.json and evaluated by
 * public/diagnostic.php to validate submissions and recalculate flags/metrics.
 */

export type DiagnosticId = 'process' | 'data' | 'digital-tax' | 'ai';

/* -------------------------------------------------------------------------- */
/* Answers                                                                     */
/* -------------------------------------------------------------------------- */

/** Number questions: a value plus an optional unit, or an explicit state. */
export type NumberAnswer = {
  value?: number;
  unit?: string;
  /** "Not sure" or "None / not applicable" chosen instead of a number. */
  state?: 'unsure' | 'none';
};

/** single/text → string, multi → string[], number → NumberAnswer. */
export type AnswerValue = string | string[] | NumberAnswer;
export type Answers = Record<string, AnswerValue | undefined>;

/* -------------------------------------------------------------------------- */
/* Conditions (declarative, evaluated identically in TS and PHP)               */
/* -------------------------------------------------------------------------- */

export type Cond =
  /** Single: value is one of. Multi: any selected value is one of. */
  | { q: string; in: string[] }
  /** Answered, and (single) value not one of / (multi) none selected is one of. */
  | { q: string; notIn: string[] }
  | { q: string; answered: boolean }
  /** Number answer value comparison (only when a number was given). */
  | { q: string; gte: number }
  | { q: string; lte: number }
  /** Number answer state ('unsure' | 'none'). */
  | { q: string; state: 'unsure' | 'none' }
  /** Multi: how many selected values (optionally only among a subset). */
  | { q: string; countGte: number; among?: string[] }
  | { q: string; countLte: number; among?: string[] }
  /** A previously evaluated flag is raised (confirmed or uncertain). */
  | { flag: string; confirmed?: boolean }
  /** How many of the listed flags are raised (confirmed only by default). */
  | { flagCount: string[]; gte: number; includeUncertain?: boolean }
  /** A calculated metric comparison. Missing metric → false. */
  | { metric: string; gte?: number; lte?: number }
  | { all: Cond[] }
  | { any: Cond[] }
  | { not: Cond }
  | { always: true };

/* -------------------------------------------------------------------------- */
/* Questions                                                                   */
/* -------------------------------------------------------------------------- */

export type Option = {
  value: string;
  label: string;
  /** Multi-select: choosing this clears the others (e.g. "None of these"). */
  exclusive?: boolean;
  hint?: string;
};

export type Observation = {
  when: Cond;
  title: string;
  body: string;
};

type BaseQuestion = {
  id: string;
  prompt: string;
  /** Short label used when quoting the answer back as evidence. */
  short: string;
  help?: string;
  /** Optional "Why we ask" explanation. */
  why?: string;
  optional?: boolean;
  showWhen?: Cond;
  /** Inline observation shown once the answer reveals a meaningful issue. */
  observation?: Observation;
};

export type SingleQuestion = BaseQuestion & {
  type: 'single';
  options: Option[];
  /**
   * Build the options from another multi-select's chosen values (A2.2).
   * `extra` options are appended when their condition holds.
   */
  optionsFrom?: { q: string; extra?: { when: Cond; option: Option }[] };
};

export type MultiQuestion = BaseQuestion & {
  type: 'multi';
  options: Option[];
};

export type NumberQuestion = BaseQuestion & {
  type: 'number';
  min?: number;
  max?: number;
  step?: number;
  /** Shown before the input, e.g. "R". */
  prefix?: string;
  /** Shown after the input when there is no unit select, e.g. "minutes". */
  suffix?: string;
  /** Unit/period options, e.g. per day / week / month / year. */
  units?: Option[];
  unitLabel?: string;
  allowUnsure?: boolean;
  unsureLabel?: string;
  /** Label for an explicit "none" choice, e.g. "No recurring report". */
  noneLabel?: string;
  placeholder?: string;
};

export type TextQuestion = BaseQuestion & {
  type: 'text';
  maxLength?: number;
  placeholder?: string;
  /** Prefill with the label of another single-select answer. */
  prefillFrom?: string;
};

export type Question = SingleQuestion | MultiQuestion | NumberQuestion | TextQuestion;

export type Step = {
  id: string;
  /** Stage title, e.g. "How work enters". */
  title: string;
  intro?: string;
  questions: Question[];
  /** If this holds after the step, the assessment ends here (early exit). */
  endsWhen?: Cond;
};

/* -------------------------------------------------------------------------- */
/* Flags, dimensions, findings                                                 */
/* -------------------------------------------------------------------------- */

export type Severity = 'high' | 'medium' | 'low';

export type FlagDef = {
  id: string;
  label: string;
  dimension: string;
  severity: Severity;
  /** Raised as a confirmed issue. */
  when: Cond;
  /** Severity overrides; first match wins (e.g. recaptured twice → high). */
  severityWhen?: { when: Cond; severity: Severity }[];
  /**
   * Raised as an uncertainty (e.g. "Not sure") when `when` is false. Lack of
   * visibility is relevant, but it is weighted lower than a confirmed issue.
   */
  uncertainWhen?: Cond;
  /** 'opportunity' flags describe upside rather than exposure. */
  kind?: 'risk' | 'opportunity';
};

export type RaisedFlag = {
  id: string;
  label: string;
  dimension: string;
  severity: Severity;
  confirmed: boolean;
  kind: 'risk' | 'opportunity';
};

export type DimensionDef = {
  id: string;
  label: string;
  description: string;
};

export type DimensionStatus =
  | 'strong'
  | 'review'
  | 'priority'
  | 'significant';

export type DimensionResult = {
  id: string;
  label: string;
  description: string;
  status: DimensionStatus;
  statusLabel: string;
  flags: RaisedFlag[];
};

export type FindingDef = {
  id: string;
  /** Raised when any of these flags is raised. */
  flags: string[];
  title: string;
  /** Plain-language finding. Tokens: {q:id} answer label, {m:id} metric. */
  finding: string;
  /** Why it matters operationally. */
  why: string;
  nextStep: string;
  /** Lumko service id (src/data/services.ts) and the specific capability. */
  service: string;
  capability: string;
  /** Question ids quoted back as evidence. */
  evidence: string[];
  kind?: 'risk' | 'opportunity';
};

export type Finding = Omit<FindingDef, 'flags' | 'evidence'> & {
  severity: Severity;
  confirmed: boolean;
  priority: 'high' | 'improve' | 'investigate' | 'opportunity';
  priorityLabel: string;
  evidence: string[];
  flags: string[];
};

export type HeadlineDef = { when: Cond; title: string; body: string };

/** A named outcome with ordered levels (first match wins). */
export type OutcomeDef = {
  id: string;
  label: string;
  levels: { value: string; label: string; body: string; when: Cond }[];
};

/** Process Diagnostic calculation inputs (question ids). */
export type ProcessMetricsDef = {
  kind: 'process';
  frequency: string;
  minutes: string;
  reporting: string;
  rate: string;
  processType: string;
  processName: string;
};

export type DiagnosticConfig = {
  id: DiagnosticId;
  version: number;
  title: string;
  shortTitle: string;
  /** Report name shown on the result. */
  reportName: string;
  steps: Step[];
  flags: FlagDef[];
  dimensions: DimensionDef[];
  findings: FindingDef[];
  headlines: HeadlineDef[];
  outcomes?: OutcomeDef[];
  metrics?: ProcessMetricsDef;
  disclaimer?: string;
  cta: { label: string; body: string };
};

/* -------------------------------------------------------------------------- */
/* Results                                                                     */
/* -------------------------------------------------------------------------- */

export type ProcessMetrics = {
  annualVolume: number | null;
  monthlyVolume: number | null;
  minutesPerItem: number | null;
  annualProcessingHours: number | null;
  annualReportingHours: number | null;
  estimatedAdminHours: number | null;
  fte: number | null;
  costLow: number | null;
  costHigh: number | null;
  adminLoad: 'low' | 'moderate' | 'significant' | 'very_significant' | null;
  adminLoadLabel: string | null;
  /** True when hours exclude reporting because reporting time was unknown. */
  partial: boolean;
};

export type DiagnosticResult = {
  diagnostic: DiagnosticId;
  version: number;
  headline: { title: string; body: string };
  flags: RaisedFlag[];
  dimensions: DimensionResult[];
  findings: Finding[];
  priorities: Finding[];
  opportunities: Finding[];
  outcomes: Record<string, { value: string; label: string; body: string }>;
  metrics: Record<string, number | null>;
  process?: ProcessMetrics & { name: string; type: string; typeLabel: string };
  endedEarly: boolean;
};
