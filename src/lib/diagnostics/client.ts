/**
 * Browser controller for a diagnostic. Vanilla TypeScript, no framework.
 *
 *  - one step at a time, rendered from the config (no page reloads);
 *  - answers mirrored to sessionStorage, resumed after refresh, cleared by
 *    "Start over"; nothing is ever written to the URL;
 *  - focus moves to each step heading and progress is announced politely;
 *  - summary is free, the full report unlocks after professional details.
 *
 * All user-provided text is inserted with textContent, never innerHTML.
 */
import { evaluate, isAnswered, isNumberAnswer } from './conditions.ts';
import { computeResult, findQuestion, formatNumber, isQuestionVisible, resolveOptions, visibleSteps } from './scoring.ts';
import { buildPayload, type LeadContact } from './payload.ts';
import { getAttribution, track } from '../analytics.ts';
import { SERVICES } from '../../data/services.ts';
import { CONTACT } from '../../consts.ts';
import type {
  Answers,
  DiagnosticConfig,
  DiagnosticResult,
  DimensionStatus,
  Finding,
  NumberAnswer,
  NumberQuestion,
  Question,
  Step,
} from './types.ts';

type Phase = 'intro' | 'questions' | 'summary' | 'report';
type State = { answers: Answers; phase: Phase; stepId: string | null; submitted: boolean; notice?: string };

/* -------------------------------------------------------------------------- */
/* DOM helpers                                                                 */
/* -------------------------------------------------------------------------- */

type Attrs = Record<string, string | number | boolean | undefined | null>;
type Child = Node | string | null | undefined | false;

function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Attrs = {}, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') el.className = String(v);
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, String(v));
  }
  for (const c of children) if (c !== null && c !== undefined && c !== false) el.append(c);
  return el;
}

const SERVICE_NAME = Object.fromEntries(SERVICES.map((s) => [s.id, s.name]));

const PRIORITY_ICON: Record<Finding['priority'], string> = {
  high: 'warning',
  improve: 'warning-circle',
  investigate: 'info',
  opportunity: 'lightbulb',
};
const STATUS_ICON: Record<DimensionStatus, string> = {
  strong: 'check-circle',
  review: 'info',
  priority: 'warning-circle',
  significant: 'warning',
};

/* -------------------------------------------------------------------------- */
/* Controller                                                                  */
/* -------------------------------------------------------------------------- */

export function mount(config: DiagnosticConfig, root = document.querySelector<HTMLElement>('[data-dx]')) {
  if (!root) return;
  const KEY = `lumko-diag:${config.id}:v${config.version}`;
  const landing = document.querySelectorAll<HTMLElement>('[data-dx-landing]');
  const stage = root.querySelector<HTMLElement>('[data-dx-stage]')!;
  const live = root.querySelector<HTMLElement>('[data-dx-live]')!;
  const progress = root.querySelector<HTMLElement>('[data-dx-progress]')!;
  const progressText = root.querySelector<HTMLElement>('[data-dx-progress-text]')!;
  const progressFill = root.querySelector<HTMLElement>('[data-dx-progress-fill]')!;
  const dialog = root.querySelector<HTMLDialogElement>('[data-dx-confirm]');
  const leadTpl = root.querySelector<HTMLTemplateElement>('[data-dx-lead-template]');

  /** Clone a server-rendered <Button> (keeps its scoped styles) and relabel it. */
  const btn = (kind: 'back' | 'next' | 'cta', label: string) => {
    const t = root.querySelector<HTMLTemplateElement>(`template[data-dx-btn="${kind}"]`);
    const el = (t?.content.firstElementChild?.cloneNode(true) as HTMLElement | undefined) ?? h('button', { type: 'button' }, h('span', { class: 'btn__label' }));
    const lab = el.querySelector('.btn__label');
    if (lab) lab.textContent = label;
    else el.textContent = label;
    el.classList.add(`dx-${kind}`);
    return el;
  };

  const icon = (name: string, cls = 'dx-icon') => {
    const t = root.querySelector<HTMLTemplateElement>(`template[data-dx-icon="${name}"]`);
    const svg = t?.content.firstElementChild?.cloneNode(true) as SVGElement | undefined;
    if (!svg) return null;
    svg.setAttribute('class', cls);
    svg.setAttribute('aria-hidden', 'true');
    return svg;
  };

  /* ---- state ---------------------------------------------------------------- */
  let state: State = { answers: {}, phase: 'intro', stepId: null, submitted: false };
  try {
    const raw = sessionStorage.getItem(KEY);
    if (raw) {
      const saved = JSON.parse(raw) as State;
      if (saved && typeof saved === 'object' && saved.answers) state = { ...state, ...saved, notice: undefined };
    }
  } catch {
    /* corrupted or unavailable storage: start fresh */
  }
  const save = () => {
    try {
      const { notice: _n, ...persist } = state;
      sessionStorage.setItem(KEY, JSON.stringify(persist));
    } catch {
      /* storage full or disabled: the session still works in memory */
    }
  };
  const announce = (msg: string) => {
    live.textContent = '';
    window.setTimeout(() => (live.textContent = msg), 50);
  };

  const steps = () => visibleSteps(config, state.answers);
  const rawStep = (id: string | null) => config.steps.find((s) => s.id === id) ?? null;

  /* ---- landing / start ---------------------------------------------------- */
  const showLanding = (show: boolean) => landing.forEach((el) => (el.hidden = !show));

  document.querySelectorAll<HTMLButtonElement>('[data-dx-start]').forEach((btn) =>
    btn.addEventListener('click', () => {
      const first = steps().steps[0];
      const resuming = state.phase !== 'intro' && Object.keys(state.answers).length > 0;
      if (!resuming) {
        state = { answers: {}, phase: 'questions', stepId: first.id, submitted: false };
        track('diagnostic_start', { diagnostic: config.id });
      } else if (state.phase === 'intro') state.phase = 'questions';
      save();
      render(true);
    }),
  );

  const restart = () => {
    state = { answers: {}, phase: 'intro', stepId: null, submitted: false };
    try {
      sessionStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
    track('diagnostic_restart', { diagnostic: config.id });
    render(true);
  };

  const confirmRestart = () => {
    if (dialog && typeof dialog.showModal === 'function') {
      dialog.showModal();
      dialog.querySelector<HTMLButtonElement>('[data-dx-cancel]')?.focus();
    } else if (window.confirm('Start over? Your answers in this browser will be cleared.')) restart();
  };
  dialog?.addEventListener('close', () => {
    if (dialog.returnValue === 'confirm') restart();
  });

  // Abandon: leaving mid-questions. Only the step number is sent.
  window.addEventListener('pagehide', () => {
    if (state.phase === 'questions') {
      const s = steps().steps;
      track('diagnostic_abandon', { diagnostic: config.id, step: Math.max(0, s.findIndex((x) => x.id === state.stepId)) + 1, total: s.length });
    }
  });

  /* ---- render dispatcher ---------------------------------------------------- */
  function render(moveFocus: boolean) {
    const inAssessment = state.phase !== 'intro';
    showLanding(!inAssessment);
    root!.hidden = !inAssessment;
    // Start buttons double as "Continue" when there is saved progress.
    const hasProgress = Object.keys(state.answers).length > 0;
    document.querySelectorAll<HTMLElement>('[data-dx-start-label]').forEach((el) => {
      el.textContent = hasProgress ? 'Continue where you left off' : el.dataset.dxStartLabel || 'Start the diagnostic';
    });
    document.querySelectorAll<HTMLElement>('[data-dx-resume-hint]').forEach((el) => (el.hidden = !hasProgress));
    if (!inAssessment) {
      stage.replaceChildren();
      if (moveFocus) document.querySelector<HTMLElement>('[data-dx-start]')?.focus();
      return;
    }
    stage.classList.remove('dx-enter');
    void stage.offsetWidth;
    stage.classList.add('dx-enter');
    if (state.phase === 'questions') renderStep(moveFocus);
    else renderResult(moveFocus);
  }

  /* ---- progress ------------------------------------------------------------ */
  function setProgress(index: number, total: number, title: string) {
    progress.hidden = false;
    const pct = Math.round(((index + 1) / (total + 1)) * 100);
    progressFill.style.width = `${pct}%`;
    progressText.textContent = `Step ${index + 1} of ${total}: ${title}`;
  }

  /* ---- question rendering -------------------------------------------------- */
  function renderStep(moveFocus: boolean) {
    const { steps: list } = steps();
    let index = list.findIndex((s) => s.id === state.stepId);
    if (index < 0) index = 0;
    const visible = list[index];
    state.stepId = visible.id;
    const step = rawStep(visible.id)!;
    setProgress(index, list.length, step.title);

    const summary = h('div', { class: 'dx-errors', role: 'alert', tabindex: -1, hidden: true });
    const heading = h('h2', { class: 'dx-step__title', tabindex: -1 }, step.title);
    const form = h(
      'form',
      { class: 'dx-step', novalidate: true, 'aria-labelledby': 'dx-step-title' },
      h('header', { class: 'dx-step__head' }, h('p', { class: 'index-label' }, `${config.shortTitle}`), heading, step.intro ? h('p', { class: 'dx-step__intro' }, step.intro) : null),
      summary,
    );
    heading.id = 'dx-step-title';

    for (const q of step.questions) form.append(renderQuestion(q));

    const back = btn('back', index === 0 ? 'Back to introduction' : 'Back');
    const next = btn('next', index === list.length - 1 ? 'See my results' : 'Continue');
    const startOver = h('button', { type: 'button', class: 'dx-link' }, 'Start over');
    form.append(h('div', { class: 'dx-nav' }, back, next, startOver));

    back.addEventListener('click', () => {
      collect(form, step);
      if (index === 0) state.phase = 'intro';
      else state.stepId = list[index - 1].id;
      save();
      render(true);
    });
    startOver.addEventListener('click', confirmRestart);

    form.addEventListener('change', (e) => {
      const target = e.target as HTMLInputElement;
      enforceExclusive(form, target);
      collect(form, step);
      syncVisibility(form, step);
      save();
    });
    form.addEventListener('input', (e) => {
      const t = e.target as HTMLInputElement;
      if (t.type === 'text' || t.type === 'number') {
        collect(form, step);
        save();
      }
    });

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      collect(form, step);
      const errors = validate(form, step);
      if (errors.length) {
        summary.replaceChildren(
          h('p', {}, errors.length === 1 ? 'Please answer one more question before continuing:' : `Please answer ${errors.length} more questions before continuing:`),
          h('ul', {}, ...errors.map((er) => {
            const a = h('a', { href: `#${er.focusId}` }, er.msg);
            a.addEventListener('click', (ev) => {
              ev.preventDefault();
              document.getElementById(er.focusId)?.focus();
            });
            return h('li', {}, a);
          })),
        );
        summary.hidden = false;
        summary.focus();
        return;
      }
      save();
      track('diagnostic_step_complete', { diagnostic: config.id, step: index + 1, section: step.id });
      const after = steps();
      const pos = after.steps.findIndex((s) => s.id === step.id);
      const nextStep = after.steps[pos + 1];
      if (!nextStep) {
        state.phase = state.submitted ? 'report' : 'summary';
        track('diagnostic_complete', { diagnostic: config.id });
      } else state.stepId = nextStep.id;
      save();
      render(true);
    });

    stage.replaceChildren(form);
    syncVisibility(form, step);
    if (state.notice) {
      form.prepend(h('p', { class: 'dx-notice', role: 'status' }, state.notice));
      state.notice = undefined;
    }
    if (moveFocus) {
      heading.focus({ preventScroll: true });
      root!.scrollIntoView({ block: 'start', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
      announce(progressText.textContent || step.title);
    }
  }

  function renderQuestion(q: Question): HTMLElement {
    const qid = `dxq-${q.id}`;
    const helpId = q.help ? `${qid}-help` : undefined;
    const errId = `${qid}-error`;
    const describedBy = [helpId, errId].filter(Boolean).join(' ');
    const optionalTag = q.optional ? h('span', { class: 'dx-q__optional' }, ' (optional)') : null;
    const help = q.help ? h('p', { class: 'dx-q__help', id: helpId }, q.help) : null;
    const why = q.why ? h('details', { class: 'dx-why' }, h('summary', {}, 'Why we ask'), h('p', {}, q.why)) : null;
    const obs = h('div', { class: 'dx-obs', 'data-obs': q.id, role: 'status', hidden: true });
    const err = h('p', { class: 'dx-q__error', id: errId, hidden: true });
    const value = state.answers[q.id];

    if (q.type === 'text') {
      let v = typeof value === 'string' ? value : '';
      if (!isAnswered(value) && q.prefillFrom) {
        const src = findQuestion(config, q.prefillFrom);
        if (src && (src.type === 'single' || src.type === 'multi')) {
          const opt = resolveOptions(config, src, state.answers).find((o) => o.value === state.answers[q.prefillFrom!]);
          if (opt) v = opt.label;
        }
      }
      const input = h('input', {
        type: 'text',
        id: qid,
        name: q.id,
        value: v,
        maxlength: q.maxLength ?? 120,
        placeholder: q.placeholder,
        autocomplete: 'off',
        'aria-describedby': describedBy,
        class: 'dx-input',
      });
      return h('div', { class: 'dx-q', 'data-q': q.id }, h('label', { for: qid, class: 'dx-q__legend' }, q.prompt, optionalTag), help, input, err, why, obs);
    }

    const fs = h('fieldset', { class: 'dx-q', 'data-q': q.id, 'aria-describedby': describedBy });
    fs.append(h('legend', { class: 'dx-q__legend' }, q.prompt, optionalTag));
    if (help) fs.append(help);

    if (q.type === 'single' || q.type === 'multi') {
      const opts = resolveOptions(config, q, state.answers);
      const selected = Array.isArray(value) ? value : typeof value === 'string' ? [value] : [];
      const wrap = h('div', { class: `dx-opts${opts.length > 8 ? ' dx-opts--cols' : ''}` });
      opts.forEach((o, i) => {
        const id = `${qid}-${i}`;
        const input = h('input', {
          type: q.type === 'single' ? 'radio' : 'checkbox',
          id,
          name: q.id,
          value: o.value,
          checked: selected.includes(o.value),
          'data-exclusive': o.exclusive ? 'true' : undefined,
        });
        wrap.append(h('label', { class: `dx-opt${o.exclusive ? ' dx-opt--exclusive' : ''}`, for: id }, input, h('span', {}, o.label)));
      });
      fs.append(wrap);
    } else {
      fs.append(renderNumber(q, qid, value as NumberAnswer | undefined));
    }
    fs.append(err);
    if (why) fs.append(why);
    fs.append(obs);
    return fs;
  }

  function renderNumber(q: NumberQuestion, qid: string, v: NumberAnswer | undefined): HTMLElement {
    const state_ = v?.state;
    const input = h('input', {
      type: 'number',
      id: qid,
      name: `${q.id}__value`,
      inputmode: 'decimal',
      min: q.min ?? 0,
      max: q.max,
      step: q.step ?? 'any',
      value: typeof v?.value === 'number' && !state_ ? v.value : undefined,
      placeholder: q.placeholder,
      class: 'dx-input dx-input--num',
      disabled: !!state_,
    });
    const numLabel = h('label', { for: qid, class: 'visually-hidden' }, q.units ? 'Number' : q.suffix ?? 'Number');
    const row = h('div', { class: 'dx-num' }, numLabel, q.prefix ? h('span', { class: 'dx-num__affix', 'aria-hidden': 'true' }, q.prefix) : null, input);
    if (q.units) {
      const sel = h('select', { id: `${qid}-unit`, name: `${q.id}__unit`, class: 'dx-input dx-select', disabled: !!state_ }, h('option', { value: '' }, 'Choose…'));
      for (const u of q.units) sel.append(h('option', { value: u.value, selected: v?.unit === u.value }, u.label));
      row.append(h('label', { for: `${qid}-unit`, class: 'visually-hidden' }, q.unitLabel ?? 'Unit'), sel);
    } else if (q.suffix) row.append(h('span', { class: 'dx-num__affix' }, q.suffix));
    const out = h('div', { class: 'dx-numwrap' }, row);
    const alts = h('div', { class: 'dx-num__alts' });
    if (q.noneLabel) alts.append(checkboxAlt(`${qid}-none`, `${q.id}__none`, q.noneLabel, state_ === 'none'));
    if (q.allowUnsure) alts.append(checkboxAlt(`${qid}-unsure`, `${q.id}__unsure`, q.unsureLabel ?? 'Not sure', state_ === 'unsure'));
    if (alts.childElementCount) out.append(alts);
    return out;
  }

  const checkboxAlt = (id: string, name: string, label: string, checked: boolean) =>
    h('label', { class: 'dx-opt dx-opt--inline', for: id }, h('input', { type: 'checkbox', id, name, checked, 'data-num-alt': 'true' }), h('span', {}, label));

  /** Multi-select exclusivity and number alternatives ("Not sure" / "None"). */
  function enforceExclusive(form: HTMLFormElement, t: HTMLInputElement) {
    if (t.type !== 'checkbox' || !t.checked) return;
    if (t.dataset.numAlt) {
      const base = t.name.replace(/__(none|unsure)$/, '');
      form.querySelectorAll<HTMLInputElement>(`input[name^="${base}__"][data-num-alt]`).forEach((o) => o !== t && (o.checked = false));
      return;
    }
    const group = form.querySelectorAll<HTMLInputElement>(`input[type=checkbox][name="${CSS.escape(t.name)}"]`);
    if (t.dataset.exclusive) group.forEach((o) => o !== t && (o.checked = false));
    else group.forEach((o) => o.dataset.exclusive && (o.checked = false));
  }

  /** Read the step's form controls into state.answers. */
  function collect(form: HTMLFormElement, step: Step) {
    for (const q of step.questions) {
      const wrap = form.querySelector<HTMLElement>(`[data-q="${q.id}"]`);
      if (!wrap || wrap.hidden) continue;
      if (q.type === 'single') {
        const c = wrap.querySelector<HTMLInputElement>('input:checked');
        if (c) state.answers[q.id] = c.value;
        else delete state.answers[q.id];
      } else if (q.type === 'multi') {
        const vals = [...wrap.querySelectorAll<HTMLInputElement>('input:checked')].map((i) => i.value);
        if (vals.length) state.answers[q.id] = vals;
        else delete state.answers[q.id];
      } else if (q.type === 'text') {
        const v = wrap.querySelector<HTMLInputElement>('input')!.value.trim();
        if (v) state.answers[q.id] = v;
        else delete state.answers[q.id];
      } else {
        const num = wrap.querySelector<HTMLInputElement>(`input[name="${q.id}__value"]`)!;
        const unit = wrap.querySelector<HTMLSelectElement>(`select[name="${q.id}__unit"]`);
        const none = wrap.querySelector<HTMLInputElement>(`input[name="${q.id}__none"]`)?.checked;
        const unsure = wrap.querySelector<HTMLInputElement>(`input[name="${q.id}__unsure"]`)?.checked;
        num.disabled = !!(none || unsure);
        if (unit) unit.disabled = !!(none || unsure);
        const a: NumberAnswer = {};
        if (none) a.state = 'none';
        else if (unsure) a.state = 'unsure';
        else {
          const n = num.value.trim() === '' ? NaN : Number(num.value);
          if (Number.isFinite(n)) a.value = n;
          if (unit?.value) a.unit = unit.value;
        }
        if (a.state || a.value !== undefined || a.unit) state.answers[q.id] = a;
        else delete state.answers[q.id];
      }
    }
  }

  /** Show/hide in-step conditional questions and inline observations. */
  function syncVisibility(form: HTMLFormElement, step: Step) {
    for (const q of step.questions) {
      const wrap = form.querySelector<HTMLElement>(`[data-q="${q.id}"]`);
      if (!wrap) continue;
      const vis = isQuestionVisible(q, state.answers);
      wrap.hidden = !vis;
      wrap.querySelectorAll<HTMLInputElement>('input, select').forEach((el) => {
        if (!vis) el.disabled = true;
        else if (!el.matches(`[name$="__value"], [name$="__unit"]`)) el.disabled = false;
      });
      const obs = wrap.querySelector<HTMLElement>('[data-obs]');
      if (obs && q.observation) {
        const show = vis && evaluate(q.observation.when, { answers: state.answers });
        if (show && obs.hidden) {
          obs.replaceChildren(icon('warning-circle') ?? '', h('div', {}, h('strong', {}, q.observation.title), ' ', q.observation.body));
        }
        obs.hidden = !show;
      }
    }
  }

  function validate(form: HTMLFormElement, step: Step): { focusId: string; msg: string }[] {
    const errors: { focusId: string; msg: string }[] = [];
    for (const q of step.questions) {
      const wrap = form.querySelector<HTMLElement>(`[data-q="${q.id}"]`)!;
      const err = wrap.querySelector<HTMLElement>('.dx-q__error')!;
      let msg = '';
      const v = state.answers[q.id];
      if (!wrap.hidden) {
        if (q.type === 'number') {
          const n = isNumberAnswer(v) ? v : undefined;
          const raw = form.querySelector<HTMLInputElement>(`input[name="${q.id}__value"]`)!.value.trim();
          if (n?.state) msg = '';
          else if (raw !== '' && n?.value === undefined) msg = 'Enter a number, using digits only.';
          else if (n?.value !== undefined && ((q.min !== undefined && n.value < q.min) || (q.max !== undefined && n.value > q.max)))
            msg = `Enter a number between ${formatNumber(q.min ?? 0)} and ${formatNumber(q.max ?? 0)}.`;
          else if (!q.optional && n?.value === undefined) msg = q.allowUnsure ? 'Enter an approximate number, or tick “Not sure”.' : 'Enter a number.';
          else if (q.units && n?.value !== undefined && !n.unit) msg = 'Choose how often (the period).';
        } else if (!q.optional && !isAnswered(v)) {
          msg = q.type === 'multi' ? 'Choose at least one option.' : q.type === 'single' ? 'Choose an option.' : 'Enter an answer.';
        }
      }
      err.textContent = msg;
      err.hidden = !msg;
      wrap.classList.toggle('dx-q--invalid', !!msg);
      const first = wrap.querySelector<HTMLElement>('input:not([disabled]), select:not([disabled])');
      if (first) {
        if (msg) first.setAttribute('aria-invalid', 'true');
        else first.removeAttribute('aria-invalid');
      }
      if (msg) {
        const unitMissing = msg.startsWith('Choose how often');
        const focusId = unitMissing ? `dxq-${q.id}-unit` : first?.id || `dxq-${q.id}`;
        errors.push({ focusId, msg: `${q.short}: ${msg}` });
      }
    }
    return errors;
  }

  /* ---- results -------------------------------------------------------------- */
  function chip(label: string, iconName: string, tone: string) {
    return h('span', { class: `dx-chip dx-chip--${tone}` }, icon(iconName) ?? '', h('span', {}, label));
  }

  function metricCard(label: string, value: string, note?: string) {
    return h('div', { class: 'dx-metric' }, h('dt', {}, label), h('dd', {}, h('span', { class: 'dx-metric__value' }, value), note ? h('span', { class: 'dx-metric__note' }, note) : null));
  }

  function processSummary(r: DiagnosticResult): HTMLElement | null {
    const p = r.process;
    if (!p || r.endedEarly) return null;
    const ans = state.answers;
    const label = (id: string) => {
      const q = findQuestion(config, id);
      return q && isAnswered(ans[id]) && isQuestionVisible(q, ans) ? answerText(q) : '';
    };
    const dl = h('dl', { class: 'dx-metrics' });
    dl.append(
      metricCard(
        'Estimated annual administrative load',
        p.estimatedAdminHours !== null ? `${formatNumber(p.estimatedAdminHours)} hours` : 'Not enough data',
        p.estimatedAdminHours !== null
          ? `${p.adminLoadLabel} load${p.fte && p.fte >= 0.3 ? `, roughly ${formatNumber(p.fte)} full-time staff equivalent` : ''}${p.partial ? '. Excludes reporting time, which was not known' : ''}`
          : 'Volume or staff time was not known',
      ),
      metricCard('Monthly volume', p.monthlyVolume !== null ? `About ${formatNumber(p.monthlyVolume)}` : 'Not known'),
      metricCard('Digitisation opportunity', r.outcomes.opportunity?.label ?? 'Not assessed'),
    );
    if (p.costLow !== null && p.costHigh !== null)
      dl.append(metricCard('Indicative administrative labour cost', `R${formatNumber(p.costLow)} to R${formatNumber(p.costHigh)} a year`, 'Indicative administrative labour cost based on the figures you supplied. Not a saving.'));
    const extra = [
      ['People handling each item', label('a4_1')],
      ['Manual re-entry', label('a4_2')],
      ['Typical approval time', label('a6_5')],
      ['Management visibility', label('a7_1')],
      ['Retrieval time (18-month-old record)', label('a8_2')],
      ['Master record', label('a9_1')],
      ['If the key person left', label('a10_1')],
      ['Pseudo-digital signal', r.outcomes.pseudo_signal?.label ?? ''],
    ].filter(([, v]) => v);
    return h(
      'section',
      { class: 'dx-block', 'aria-labelledby': 'dx-proc-h' },
      h('h3', { id: 'dx-proc-h' }, `Process assessed: ${p.name || p.typeLabel}`),
      dl,
      extra.length ? h('dl', { class: 'dx-facts' }, ...extra.map(([k, v]) => h('div', {}, h('dt', {}, k), h('dd', {}, v)))) : null,
    );
  }

  const answerText = (q: Question) => {
    const v = state.answers[q.id];
    if (q.type === 'text') return String(v ?? '');
    if (q.type === 'number') {
      if (!isNumberAnswer(v)) return '';
      if (v.state === 'unsure') return 'Not sure';
      if (v.state === 'none') return q.noneLabel ?? 'None';
      const unit = q.units?.find((u) => u.value === v.unit)?.label ?? q.suffix ?? '';
      return `${q.prefix ?? ''}${formatNumber(v.value ?? 0)} ${unit}`.trim();
    }
    const opts = resolveOptions(config, q, state.answers);
    const vals = Array.isArray(v) ? v : [String(v)];
    return vals.map((x) => opts.find((o) => o.value === x)?.label ?? x).join('; ');
  };

  function prioritiesList(r: DiagnosticResult, detailed: boolean): HTMLElement | null {
    if (!r.priorities.length) return null;
    const list = h('ol', { class: 'dx-priorities' });
    r.priorities.forEach((f) =>
      list.append(
        h(
          'li',
          {},
          detailed ? h('a', { href: `#dx-f-${f.id}` }, f.title) : h('span', { class: 'dx-priorities__t' }, f.title),
          chip(f.priorityLabel, PRIORITY_ICON[f.priority], f.priority),
        ),
      ),
    );
    return h('section', { class: 'dx-block', 'aria-labelledby': 'dx-pri-h' }, h('h3', { id: 'dx-pri-h' }, r.priorities.length === 1 ? 'Your first priority' : `Your top ${r.priorities.length} priorities`), list);
  }

  function dimensionsList(r: DiagnosticResult): HTMLElement | null {
    if (r.endedEarly || !r.dimensions.length) return null;
    const ul = h('ul', { class: 'dx-dims', role: 'list' });
    r.dimensions.forEach((d) =>
      ul.append(
        h(
          'li',
          {},
          h('div', { class: 'dx-dims__name' }, h('strong', {}, d.label), h('span', {}, d.description)),
          chip(d.statusLabel, STATUS_ICON[d.status], d.status),
          state.phase === 'report' && d.flags.length
            ? h('p', { class: 'dx-dims__why' }, `Based on: ${d.flags.filter((f) => f.kind === 'risk').map((f) => (f.confirmed ? f.label : `${f.label} (uncertain)`)).join('; ')}`)
            : null,
        ),
      ),
    );
    return h('section', { class: 'dx-block', 'aria-labelledby': 'dx-dim-h' }, h('h3', { id: 'dx-dim-h' }, 'By area'), ul);
  }

  function findingCard(f: Finding): HTMLElement {
    const service = SERVICE_NAME[f.service];
    return h(
      'article',
      { class: `dx-finding dx-finding--${f.priority}`, id: `dx-f-${f.id}`, 'aria-labelledby': `dx-f-${f.id}-h` },
      h('header', {}, chip(f.priorityLabel, PRIORITY_ICON[f.priority], f.priority), h('h4', { id: `dx-f-${f.id}-h` }, f.title)),
      h('p', { class: 'dx-finding__lead' }, f.finding, !f.confirmed ? ' Some of this is based on “Not sure” answers, which usually means the information is not readily visible.' : ''),
      f.evidence.length ? h('div', { class: 'dx-finding__ev' }, h('p', { class: 'dx-finding__label' }, 'From your answers'), h('ul', {}, ...f.evidence.map((e) => h('li', {}, e)))) : null,
      h('div', { class: 'dx-finding__grid' },
        h('div', {}, h('p', { class: 'dx-finding__label' }, 'Why it matters'), h('p', {}, f.why)),
        h('div', {}, h('p', { class: 'dx-finding__label' }, 'Practical next step'), h('p', {}, f.nextStep)),
      ),
      h('p', { class: 'dx-finding__cap' }, h('span', { class: 'dx-finding__label' }, 'Relevant Lumko capability: '), `${f.capability}`, service ? ' · ' : '', service ? h('a', { href: `/what-we-do#${f.service}` }, service) : null),
    );
  }

  function ctaBlock(): HTMLElement {
    const talk = btn('cta', config.cta.label);
    talk.dataset.analytics = 'diagnostic_contact_click';
    talk.dataset.analyticsDiagnostic = config.id;
    talk.dataset.analyticsCta = 'contact';
    const book = h('a', { href: CONTACT.calendlyUrl, rel: 'noopener', class: 'link-arrow', 'data-analytics': 'diagnostic_contact_click', 'data-analytics-diagnostic': config.id, 'data-analytics-cta': 'calendly' }, h('span', {}, 'Or book a 30-minute call'));
    return h('section', { class: 'dx-cta', 'aria-labelledby': 'dx-cta-h' }, h('h3', { id: 'dx-cta-h' }, 'Discuss this result'), h('p', {}, config.cta.body), h('div', { class: 'dx-cta__actions' }, talk, book));
  }

  function renderResult(moveFocus: boolean) {
    const r = computeResult(config, state.answers);
    const report = state.phase === 'report';
    progress.hidden = true;

    const heading = h('h2', { class: 'dx-result__title', tabindex: -1 }, r.headline.title);
    const framing = r.outcomes.framing && r.outcomes.framing.value === 'invoicing' ? h('p', { class: 'dx-note' }, r.outcomes.framing.body) : null;
    const out = h(
      'div',
      { class: 'dx-result' },
      h('header', { class: 'dx-result__head' },
        h('p', { class: 'index-label' }, report ? config.reportName : `Summary · ${config.reportName}`),
        heading,
        h('p', { class: 'dx-result__body' }, r.headline.body),
        framing,
      ),
    );
    const notice = state.notice ? h('p', { class: 'dx-notice', role: 'status' }, state.notice) : null;
    if (notice) out.prepend(notice);
    state.notice = undefined;

    const proc = processSummary(r);
    if (proc) out.append(proc);

    if (r.endedEarly) {
      out.append(
        h('section', { class: 'dx-block' },
          h('h3', {}, 'Where to look instead'),
          h('p', {}, 'The Paper & Process Diagnostic looks at one manual process in depth. If none stands out, these may be more useful:'),
          h('ul', { class: 'dx-list' },
            h('li', {}, h('a', { href: '/diagnostics/digital-tax' }, 'Digital Tax & E-Invoicing'), ': how transaction data flows between systems.'),
            h('li', {}, h('a', { href: '/diagnostics/data' }, 'Data Exposure & POPIA'), ': where information lives and who can reach it.'),
            h('li', {}, h('a', { href: '/what-we-do#data-intelligence' }, 'Data & Intelligence'), ': reporting and integration across existing systems.'),
          ),
        ),
      );
    }

    const pri = prioritiesList(r, report);
    if (pri) out.append(pri);
    if (!r.priorities.length && !r.endedEarly)
      out.append(h('section', { class: 'dx-block' }, h('h3', {}, 'No priority gaps identified'), h('p', {}, 'Based on your answers, nothing stood out as needing urgent attention. The full report shows how each area was assessed.')));
    const dims = dimensionsList(r);
    if (dims) out.append(dims);

    if (!report) {
      // ---- Gate: the full report unlocks after professional details ----
      const gate = h('section', { class: 'dx-gate', 'aria-labelledby': 'dx-gate-h' },
        h('h3', { id: 'dx-gate-h' }, 'Get the full report'),
        h('p', {}, 'The full report explains each finding: the evidence from your answers, why it matters operationally, a practical next step and the relevant Lumko capability. A member of the Lumko team will review it and may contact you to discuss it.'),
      );
      const formFrag = leadTpl?.content.cloneNode(true) as DocumentFragment | undefined;
      if (formFrag) gate.append(formFrag);
      out.append(gate);
      const reviewBtn = h('button', { type: 'button', class: 'dx-link' }, 'Review my answers');
      const startOver = h('button', { type: 'button', class: 'dx-link' }, 'Start over');
      reviewBtn.addEventListener('click', () => {
        state.phase = 'questions';
        state.stepId = steps().steps.at(-1)!.id;
        save();
        render(true);
      });
      startOver.addEventListener('click', confirmRestart);
      out.append(h('div', { class: 'dx-result__tools' }, reviewBtn, startOver));
      stage.replaceChildren(out);
      wireLeadForm(r);
    } else {
      const risks = r.findings.filter((f) => f.kind !== 'opportunity');
      if (risks.length) {
        out.append(h('section', { class: 'dx-block', 'aria-labelledby': 'dx-find-h' }, h('h3', { id: 'dx-find-h' }, 'Findings'), ...risks.map(findingCard)));
      }
      if (r.opportunities.length) {
        out.append(h('section', { class: 'dx-block', 'aria-labelledby': 'dx-opp-h' }, h('h3', { id: 'dx-opp-h' }, 'Opportunities'), ...r.opportunities.map(findingCard)));
      }
      out.append(method(r));
      if (config.disclaimer) out.append(h('p', { class: 'dx-disclaimer' }, config.disclaimer));
      out.append(ctaBlock());
      const print = h('button', { type: 'button', class: 'dx-link' }, 'Print or save as PDF');
      print.addEventListener('click', () => window.print());
      const review = h('button', { type: 'button', class: 'dx-link' }, 'Review my answers');
      review.addEventListener('click', () => {
        state.phase = 'questions';
        state.stepId = steps().steps.at(-1)!.id;
        save();
        render(true);
      });
      const startOver = h('button', { type: 'button', class: 'dx-link' }, 'Start over');
      startOver.addEventListener('click', confirmRestart);
      out.append(h('div', { class: 'dx-result__tools' }, print, review, startOver));
      stage.replaceChildren(out);
    }

    if (moveFocus) {
      heading.focus({ preventScroll: true });
      root!.scrollIntoView({ block: 'start', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
      announce(report ? `Your full report is ready. ${r.headline.title}` : `Your summary is ready. ${r.headline.title}`);
    }
  }

  function method(r: DiagnosticResult): HTMLElement {
    const items: Child[] = [
      h('li', {}, 'Findings come from your own answers. Nothing is inferred about your organisation beyond what you told us.'),
      h('li', {}, '“Not sure” answers are treated as a visibility gap: relevant, but weighted lower than a confirmed issue.'),
      h('li', {}, 'Areas are labelled Strong foundation, Worth reviewing, Priority area or Significant operational exposure, according to how many issues were raised and how serious they are. High-severity issues outweigh several minor ones.'),
    ];
    if (r.process && !r.endedEarly)
      items.push(
        h('li', {}, 'Administrative hours = annual volume × active staff-minutes per item ÷ 60, plus recurring reporting time. “Per working day” volumes assume 250 working days a year. Waiting time is not counted as staff time.'),
        h('li', {}, 'A cost range is only shown if you supplied an hourly rate (±20% around the estimate). It is not a saving: not all administrative time disappears after a process is digitised.'),
      );
    return h('details', { class: 'dx-method' }, h('summary', {}, 'How these results were worked out'), h('ul', {}, ...items));
  }

  /* ---- lead form ------------------------------------------------------------ */
  function wireLeadForm(r: DiagnosticResult) {
    const form = stage.querySelector<HTMLFormElement>('[data-dx-lead]');
    if (!form) return;
    const errors = form.querySelector<HTMLElement>('[data-dx-lead-errors]')!;
    const status = form.querySelector<HTMLElement>('[data-dx-lead-status]')!;
    const submitBtn = form.querySelector<HTMLButtonElement>('button[type=submit]')!;
    const ts = Math.floor(Date.now() / 1000);

    // Prefill organisation context answered in the diagnostic itself.
    for (const k of ['org_type', 'industry', 'org_size']) {
      const v = state.answers[k];
      const sel = form.elements.namedItem(k) as HTMLSelectElement | null;
      if (sel && typeof v === 'string') sel.value = v;
    }

    const messages: Record<string, string> = {
      name: 'Enter your full name.',
      email: 'Enter a valid work email address, like name@organisation.co.za.',
      organisation: 'Enter your organisation’s name.',
      role: 'Enter your role or title.',
      org_type: 'Choose the type of organisation.',
      industry: 'Choose a sector.',
      org_size: 'Choose the organisation size.',
      contact_consent: 'Confirm that Lumko may use your details and answers to contact you about this assessment.',
    };

    const setErr = (el: HTMLInputElement | HTMLSelectElement, msg: string | null) => {
      const wrap = el.closest<HTMLElement>('.field') ?? el.parentElement!;
      const id = `${el.id}-error`;
      let p = wrap.querySelector<HTMLElement>(`#${CSS.escape(id)}`);
      const described = (el.getAttribute('aria-describedby') || '').split(' ').filter((x) => x && x !== id);
      if (msg) {
        if (!p) {
          p = h('p', { class: 'field__error', id });
          wrap.append(p);
        }
        p.textContent = msg;
        el.setAttribute('aria-invalid', 'true');
        el.setAttribute('aria-describedby', [...described, id].join(' '));
        wrap.classList.add('field--invalid');
      } else {
        p?.remove();
        el.removeAttribute('aria-invalid');
        if (described.length) el.setAttribute('aria-describedby', described.join(' '));
        else el.removeAttribute('aria-describedby');
        wrap.classList.remove('field--invalid');
      }
    };

    const check = (el: HTMLInputElement | HTMLSelectElement): string | null => {
      const v = el instanceof HTMLInputElement && el.type === 'checkbox' ? el.checked : el.value.trim();
      if (el.required && !v) return messages[el.name] ?? 'This field is required.';
      if (el.name === 'email' && v && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v))) return messages.email;
      if (el.name === 'phone' && v && !/^[+()\d\s-]{7,20}$/.test(String(v))) return 'Enter a phone number using digits, spaces or +.';
      return null;
    };

    const controls = () => [...form.querySelectorAll<HTMLInputElement | HTMLSelectElement>('input:not([type=hidden]):not([tabindex="-1"]), select')];

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const problems: { id: string; msg: string }[] = [];
      controls().forEach((el) => {
        const m = check(el);
        setErr(el, m);
        if (m) problems.push({ id: el.id, msg: m });
      });
      if (problems.length) {
        errors.replaceChildren(
          h('p', {}, problems.length === 1 ? 'Please fix one thing before continuing:' : `Please fix ${problems.length} things before continuing:`),
          h('ul', {}, ...problems.map((p) => {
            const a = h('a', { href: `#${p.id}` }, p.msg);
            a.addEventListener('click', (ev) => {
              ev.preventDefault();
              document.getElementById(p.id)?.focus();
            });
            return h('li', {}, a);
          })),
        );
        errors.hidden = false;
        errors.focus();
        return;
      }
      errors.hidden = true;
      const val = (n: string) => ((form.elements.namedItem(n) as HTMLInputElement | null)?.value ?? '').trim();
      const contact: LeadContact = {
        name: val('name'),
        email: val('email'),
        phone: val('phone'),
        organisation: val('organisation'),
        role: val('role'),
        org_type: val('org_type'),
        industry: val('industry'),
        org_size: val('org_size'),
        region: val('region'),
        contact_consent: (form.elements.namedItem('contact_consent') as HTMLInputElement).checked,
        marketing_consent: (form.elements.namedItem('marketing_consent') as HTMLInputElement).checked,
      };
      const payload = buildPayload(config, state.answers, r, contact, {
        attribution: getAttribution(),
        website: val('website'),
        ts,
        page: location.pathname,
      });

      submitBtn.disabled = true;
      status.textContent = 'Sending…';
      let outcome: 'ok' | 'fields' | 'unavailable' = 'unavailable';
      let fields: string[] = [];
      try {
        const res = await fetch('/diagnostic.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(payload),
          credentials: 'same-origin',
        });
        const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; fields?: string[] };
        if (res.ok && data.ok) outcome = 'ok';
        else if (data.error === 'fields') {
          outcome = 'fields';
          fields = data.fields ?? [];
        }
      } catch {
        outcome = 'unavailable';
      }
      submitBtn.disabled = false;
      status.textContent = '';

      if (outcome === 'fields') {
        const list = fields.map((f) => ({ id: `lead-${f}`, msg: messages[f] ?? 'Check this field.' }));
        list.forEach((p) => {
          const el = document.getElementById(p.id) as HTMLInputElement | null;
          if (el) setErr(el, p.msg);
        });
        errors.replaceChildren(h('p', {}, 'Some details need another look:'), h('ul', {}, ...list.map((p) => h('li', {}, p.msg))));
        errors.hidden = false;
        errors.focus();
        return;
      }

      track('diagnostic_lead_submit', { diagnostic: config.id });
      state.submitted = true;
      state.phase = 'report';
      state.notice =
        outcome === 'ok'
          ? 'Thank you. Your details and results have been sent to the Lumko team. Your full report is below.'
          : `Your full report is below. We couldn’t send your details to Lumko just now; if you would like to discuss the result, email ${CONTACT.email}.`;
      save();
      render(true);
    });
  }

  /* ---- boot ------------------------------------------------------------------ */
  if (state.phase !== 'intro') {
    // Don't let the browser restore the old scroll position over the resumed step.
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    if (state.phase === 'questions') state.notice = 'Resuming where you left off. Your answers are kept in this browser tab only.';
    render(true);
  } else render(false);
}

const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
