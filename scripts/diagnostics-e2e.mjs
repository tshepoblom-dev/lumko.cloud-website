/**
 * Dev-only: end-to-end tests for the diagnostics against the built site
 * served by PHP (so /diagnostic.php and /contact.php run for real, in dry-run).
 *
 *   npm run build
 *   LUMKO_CONTACT_DRYRUN=1 php -S localhost:8090 -t dist "$PWD/scripts/test-server.php"
 *   node scripts/diagnostics-e2e.mjs
 *
 * Covers: all four diagnostics, branching, back navigation, refresh/resume,
 * restart, validation, mobile viewport, lead submission with server-side
 * recalculation, endpoint hardening, the existing contact form, URLs and
 * analytics never containing answers, and console errors.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execSync } from 'node:child_process';

const BASE = process.env.BASE_URL || 'http://localhost:8090';
let failures = 0;
const ok = (cond, msg) => {
  console.log(`${cond ? 'ok  ' : 'FAIL'} ${msg}`);
  if (!cond) failures++;
};

// PHP's temp dir: dry-run mail output and rate-limit files live here.
let TMP = os.tmpdir();
try {
  TMP = execSync('php -r "echo sys_get_temp_dir();"').toString().trim() || TMP;
} catch {
  /* fall back to Node's temp dir */
}
const DRYRUN_FILE = path.join(TMP, 'lumko-diagnostic-last.txt');
for (const f of fs.readdirSync(TMP)) if (/^lumko-(diag|contact)-[0-9a-f]{64}\.json$/.test(f)) fs.rmSync(path.join(TMP, f));

const SENSITIVE = ['Field inspection approval', 'test.person@example.co.za', 'Example Municipality', 'Thandi'];
const ALLOWED_EVENT_KEYS = new Set(['event', 'diagnostic', 'step', 'section', 'total', 'cta']);

const browser = await chromium.launch();

async function newPage(width = 1280) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => m.type() === 'error' && !/diagnostic\.php/.test(m.text()) && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(() => {
    window.__events = JSON.parse(sessionStorage.getItem('__events') || '[]');
    window.addEventListener('lumko:analytics', (e) => {
      window.__events.push(e.detail);
      sessionStorage.setItem('__events', JSON.stringify(window.__events));
    });
  });
  return { ctx, page, errors };
}

/** Answer the visible questions of the current step using `plan`, then continue. */
async function answerStep(page, plan) {
  const done = new Set();
  for (;;) {
    const ids = await page.$$eval('.dx-step [data-q]:not([hidden])', (els) => els.map((e) => e.getAttribute('data-q')));
    const id = ids.find((x) => !done.has(x));
    if (!id) break;
    done.add(id);
    const wrap = `.dx-step [data-q="${id}"]`;
    const v = plan[id];
    if (await page.$(`${wrap} input[type=radio]`)) {
      const sel = v ? `${wrap} input[value="${v}"]` : `${wrap} input[type=radio]`;
      await page.locator(sel).first().check();
    } else if (await page.$(`${wrap} input[type=checkbox]:not([data-num-alt])`)) {
      const vals = v ?? [await page.locator(`${wrap} input[type=checkbox]`).first().getAttribute('value')];
      for (const x of vals) await page.locator(`${wrap} input[value="${x}"]`).check();
    } else if (await page.$(`${wrap} input[type=number]`)) {
      if (v === 'unsure' || v === 'none') await page.locator(`${wrap} input[name$="__${v}"]`).check();
      else if (v === 'skip') {
        /* optional: leave blank */
      } else {
        await page.fill(`${wrap} input[type=number]`, String(v?.value ?? 10));
        if (await page.$(`${wrap} select`)) await page.selectOption(`${wrap} select`, v?.unit ?? { index: 1 });
      }
    } else if (await page.$(`${wrap} input[type=text]`)) {
      if (v !== undefined) await page.fill(`${wrap} input[type=text]`, v);
    }
  }
  await page.click('.dx-step button[type=submit]');
  await page.waitForTimeout(60);
}

/** Answer steps until the summary appears. Returns the step ids visited. */
async function runThrough(page, plan, guard = 30) {
  const visited = [];
  while (guard-- > 0) {
    if (await page.$('.dx-result')) return visited;
    const title = await page.textContent('.dx-step__title');
    visited.push(title);
    if (page.url() !== page.url().split(/[?#]/)[0]) ok(false, `URL changed during steps: ${page.url()}`);
    await answerStep(page, plan);
    const err = await page.$('.dx-errors:not([hidden])');
    if (err) {
      ok(false, `validation blocked "${title}": ${await err.textContent()}`);
      return visited;
    }
  }
  return visited;
}

async function start(page, slug) {
  await page.goto(`${BASE}/diagnostics/${slug}`, { waitUntil: 'networkidle' });
  await page.click('[data-dx-start]');
  await page.waitForSelector('.dx-step');
}

async function fillLead(page, overrides = {}) {
  const v = {
    name: 'Thandi Example',
    email: 'test.person@example.co.za',
    organisation: 'Example Municipality',
    role: 'Operations manager',
    ...overrides,
  };
  for (const [k, val] of Object.entries(v)) await page.fill(`#lead-${k}`, val);
  for (const k of ['org_type', 'industry', 'org_size']) {
    const cur = await page.$eval(`#lead-${k}`, (s) => s.value);
    if (!cur) await page.selectOption(`#lead-${k}`, { index: 1 });
  }
  await page.check('#lead-contact_consent');
}

async function checkEvents(page, label) {
  const events = await page.evaluate(() => window.__events || []);
  const blob = JSON.stringify(events);
  ok(events.every((e) => Object.keys(e).every((k) => ALLOWED_EVENT_KEYS.has(k))), `${label}: analytics events only use whitelisted keys`);
  ok(!SENSITIVE.some((s) => blob.includes(s)), `${label}: analytics events contain no answers or contact details`);
  return events;
}

const MANUAL = {
  org_type: 'municipality',
  industry: 'government_and_municipalities',
  org_size: '201_500',
  a2_1: ['inspections', 'approvals'],
  a2_2: 'inspections',
  a2_3: 'Field inspection approval',
  a3_1: ['paper', 'whatsapp'],
  a3_2: 'frequently',
  a3_3: 'usually',
  a4_1: '5plus',
  a4_2: 'twice',
  a4_3: ['spreadsheet'],
  a4_4: 'frequently',
  a5_1: { value: 40, unit: 'day' },
  a5_2: { value: 30 },
  a5_4: { value: 8, unit: 'week' },
  a5_5: { value: 300 },
  a6_1: 'two_three',
  a6_2: ['physical', 'email'],
  a6_3: 'no',
  a6_4: ['phone', 'forgotten'],
  a6_5: 'week_plus',
  a7_1: 'report_only',
  a7_2: 'rarely',
  a7_3: 'frequently',
  a8_1: ['shared_folders', 'email', 'physical'],
  a8_2: 'hour_plus',
  a8_3: 'no',
  a9_1: 'multiple',
  a9_2: 'no',
  a10_1: 'depends',
  a10_2: 'no',
  a11_1: 'weekly',
  a11_2: ['capture_error'],
  a12_1: ['print_sign', 'scan_back', 'excel_bridge', 'whatsapp'],
};

/* ---------------------------------------------------------------- Process */
{
  console.log('\n# Paper & Process: full path, back, resume, lead submit');
  const { ctx, page, errors } = await newPage();
  await start(page, 'process');

  // Validation: empty step is blocked with an announced summary.
  await page.click('.dx-step button[type=submit]');
  ok(await page.isVisible('.dx-errors'), 'empty step shows the error summary');
  ok((await page.evaluate(() => document.activeElement?.className)) === 'dx-errors', 'focus moves to the error summary');

  await answerStep(page, MANUAL); // context
  await answerStep(page, MANUAL); // discovery
  // Back keeps answers.
  await page.click('.dx-step .dx-back');
  ok(await page.isChecked('input[name="a2_1"][value="inspections"]'), 'back navigation keeps answers');
  await page.click('.dx-step button[type=submit]');
  // Choose step: options built from A2.1, name prefilled.
  const opts = await page.$$eval('input[name="a2_2"]', (els) => els.map((e) => e.value));
  ok(opts.join() === 'inspections,approvals', 'A2.2 options come from A2.1 selections');
  await page.check('input[name="a2_2"][value="inspections"]');
  await page.click('.dx-step button[type=submit]');
  await page.click('.dx-step .dx-back');
  ok((await page.inputValue('#dxq-a2_3')) === 'Inspections', 'A2.3 is prefilled from the selected process');
  await answerStep(page, MANUAL);

  // Inline observation on the entry step.
  await page.check('input[name="a3_2"][value="frequently"]');
  await page.check('input[name="a3_3"][value="usually"]');
  ok(await page.isVisible('[data-obs="a3_3"]'), 'inline observation appears for the digital paper loop');
  await answerStep(page, MANUAL);

  // A4.3 appears only after recapture is reported.
  ok(!(await page.isVisible('[data-q="a4_3"]')), 'A4.3 hidden before recapture is answered');
  await page.check('input[name="a4_2"][value="twice"]');
  ok(await page.isVisible('[data-q="a4_3"]'), 'A4.3 shown once recapture is reported');
  await answerStep(page, MANUAL);

  // Invalid number input.
  await page.fill('#dxq-a5_1', '-5');
  await page.selectOption('#dxq-a5_1-unit', 'day');
  await page.click('.dx-step button[type=submit]');
  ok((await page.textContent('[data-q="a5_1"] .dx-q__error'))?.includes('between'), 'out-of-range number is rejected with a message');

  // Refresh mid-way: resume at the same step with answers kept.
  await page.reload({ waitUntil: 'networkidle' });
  ok(await page.isVisible('.dx-step'), 'refresh resumes the assessment');
  ok((await page.textContent('.dx-notice'))?.includes('Resuming'), 'resume notice shown');
  ok((await page.textContent('.dx-step__title')) === 'Volume and staff time', 'resumed on the same step');

  const visited = await runThrough(page, MANUAL);
  ok(visited.includes('When approvals wait'), 'approval detail steps shown when approvals are required');
  ok(page.url() === `${BASE}/diagnostics/process`, 'URL never carries answers');

  // Summary
  const summary = await page.textContent('.dx-result');
  ok(summary.includes('This process is a strong candidate for digitisation.'), 'headline: strong candidate');
  ok(summary.includes('Field inspection approval'), 'headline quotes the process name');
  ok(summary.includes('5') && /5[\s ]?400 hours/.test(summary), 'summary shows ~5,400 estimated annual hours');
  ok(summary.includes('High digitisation opportunity'), 'opportunity level shown');
  ok(!summary.includes('Why it matters'), 'full report detail is gated');
  ok((await page.$$('.dx-priorities li')).length === 3, 'summary names three priorities');

  // Lead form validation then submit.
  await page.click('.leadf button[type=submit]');
  ok(await page.isVisible('[data-dx-lead-errors]'), 'lead form requires details');
  ok(!(await page.isChecked('#lead-marketing_consent')), 'marketing consent is not pre-ticked');
  ok(!(await page.isChecked('#lead-contact_consent')), 'contact consent is not pre-ticked');
  ok((await page.inputValue('#lead-org_size')) === '201_500', 'organisation size prefilled from the diagnostic');
  if (fs.existsSync(DRYRUN_FILE)) fs.rmSync(DRYRUN_FILE);
  await page.waitForTimeout(4200); // server rejects forms submitted faster than a person could
  await fillLead(page);
  const [resp] = await Promise.all([
    page.waitForResponse((r) => r.url().endsWith('/diagnostic.php')),
    page.click('.leadf button[type=submit]'),
  ]);
  const body = await resp.json();
  ok(resp.status() === 200 && body.ok && /^LD-/.test(body.ref), `lead accepted by server (${resp.status()} ${body.ref ?? body.error})`);
  await page.waitForSelector('.dx-finding');
  const report = await page.textContent('.dx-result');
  ok(report.includes('Why it matters') && report.includes('Practical next step') && report.includes('Relevant Lumko capability'), 'full report shows finding detail');
  ok(report.includes('From your answers'), 'findings quote evidence from the answers');
  ok(report.includes('Thank you'), 'confirmation shown');

  const mail = fs.existsSync(DRYRUN_FILE) ? fs.readFileSync(DRYRUN_FILE, 'utf8') : '';
  ok(mail.includes('Est. admin hours:  5 400 a year'), 'server recalculated the admin hours');
  ok(mail.includes('Project relevance: High'), 'internal lead qualification computed');
  ok(mail.includes('Process:           Field inspection approval'), 'process name included');
  ok(!mail.includes('browser result differed'), 'client and server results agree');
  ok(mail.includes('"ref": "LD-'), 'machine-readable JSON included');

  // Report survives refresh; restart clears.
  await page.reload({ waitUntil: 'networkidle' });
  ok(await page.isVisible('.dx-finding'), 'report survives a refresh');
  await page.click('.dx-result__tools button:has-text("Start over")');
  ok(await page.isVisible('[data-dx-confirm]'), 'start over asks for confirmation');
  await page.click('[data-dx-confirm] button[value="confirm"]');
  await page.waitForTimeout(100);
  ok(await page.isVisible('[data-dx-start]'), 'restart returns to the introduction');
  ok((await page.evaluate(() => Object.keys(sessionStorage).filter((k) => k.startsWith('lumko-diag')).length)) === 0, 'restart clears stored answers');

  const events = await checkEvents(page, 'process');
  for (const e of ['diagnostic_start', 'diagnostic_step_complete', 'diagnostic_complete', 'diagnostic_lead_submit', 'diagnostic_restart'])
    ok(events.some((x) => x.event === e), `analytics: ${e} fired`);
  ok(errors.length === 0, `no console errors (${errors.join(' | ')})`);
  await ctx.close();
}

/* ----------------------------------------------------- Process early exit */
{
  console.log('\n# Paper & Process: no manual process (early exit)');
  const { ctx, page, errors } = await newPage();
  await start(page, 'process');
  await answerStep(page, {});
  await page.check('input[name="a2_1"][value="inspections"]');
  await page.check('input[name="a2_1"][value="none"]');
  ok(!(await page.isChecked('input[name="a2_1"][value="inspections"]')), '"None of these" clears other selections');
  ok(await page.isVisible('[data-q="a2_1b"]'), 'A2.1b appears when no process is selected');
  await answerStep(page, { a2_1: ['none'], a2_1b: 'no' });
  await page.waitForSelector('.dx-result');
  const t = await page.textContent('.dx-result');
  ok(t.includes('No obvious manual process stood out.'), 'early-exit result shown');
  ok(t.includes('Where to look instead'), 'early exit recommends other diagnostics');
  ok(errors.length === 0, 'no console errors');
  await ctx.close();
}

/* ------------------------------------------------------------- Data (mobile) */
{
  console.log('\n# Data Exposure (390px mobile viewport)');
  const { ctx, page, errors } = await newPage(390);
  await start(page, 'data');
  const plan = { b1_1: ['health', 'customer'], b2_1: 'no', b2_2: ['whatsapp', 'email'], b3_2: 'not_reviewed', b4_1: 'no', b5_1: 'probably_not', b6_2: 'never' };
  const visited = await runThrough(page, plan);
  ok(!visited.includes('Third parties') || !(await page.$('[data-q="b4_2"]')), 'B4.2 skipped when no providers');
  const t = await page.textContent('.dx-result');
  ok(t.includes('knowing where information is'), 'data headline: inventory is the largest exposure');
  ok(t.includes('Significant operational exposure') || t.includes('Priority area'), 'dimension status labels shown as text');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  ok(!overflow, 'no horizontal overflow on mobile');
  await page.screenshot({ path: '.shots/e2e_data_mobile_summary.png', fullPage: true });
  ok(errors.length === 0, 'no console errors');
  await ctx.close();
}

/* -------------------------------------------------------------- Digital tax */
{
  console.log('\n# Digital Tax & E-Invoicing');
  const { ctx, page, errors } = await newPage();
  await start(page, 'digital-tax');
  await runThrough(page, { c1_1: 'no', c2_1: 'accounting_erp', c2_2: 'frequently', c4_2: 'sometimes', c6_1: 'api', c6_2: 'no' });
  const t = await page.textContent('.dx-result');
  ok(t.includes('Your invoicing is digital, but the underlying data flow is still manual.'), 'tax headline');
  ok(t.includes('invoicing-system readiness'), 'non-VAT framing shown');
  await page.waitForTimeout(4200);
  await fillLead(page, { email: 'finance@example.co.za' });
  await page.click('.leadf button[type=submit]');
  await page.waitForSelector('.dx-finding');
  const r = await page.textContent('.dx-result');
  ok(r.includes('Opportunities') && r.includes('not tax advice'), 'report shows opportunity and the tax disclaimer');
  ok(errors.length === 0, 'no console errors');
  await ctx.close();
}

/* ------------------------------------------------------------------------ AI */
{
  console.log('\n# AI Exposure & Governance');
  const { ctx, page, errors } = await newPage();
  await start(page, 'ai');
  const visited = await runThrough(page, {
    d1_1: 'informal', d1_2: ['chatgpt'], d2_1: 'personal', d3_1: ['customer', 'spreadsheets'], d3_2: 'frequently',
    d4_1: ['drafting', 'hr'], d5_1: 'sometimes', d5_2: 'no', d6_1: 'no', d6_2: 'no', d7_1: 'nobody',
    d8_1: ['drafting', 'reports', 'search'], d8_2: 'partially',
  });
  ok(visited.length >= 7, 'usage questions shown when AI is in use');
  const t = await page.textContent('.dx-result');
  ok(t.includes('adoption is ahead of governance'), 'AI headline balances value and governance');

  // No-use path skips usage questions.
  await page.click('.dx-result__tools button:has-text("Start over")');
  await page.click('[data-dx-confirm] button[value="confirm"]');
  await page.click('[data-dx-start]');
  const v2 = await runThrough(page, { d1_1: 'no' });
  ok(!v2.includes('Accounts and control') && !v2.includes('Information shared with AI'), 'no-use path skips account and exposure steps');
  ok(errors.length === 0, 'no console errors');
  await ctx.close();
}

/* ----------------------------------------------------- Endpoint hardening */
{
  console.log('\n# /diagnostic.php hardening');
  const post = (body, headers = {}) =>
    fetch(`${BASE}/diagnostic.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: BASE, ...headers },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    });
  const base = {
    diagnostic: { id: 'data', version: 1 },
    contact: { name: 'A Person', email: 'a@example.co.za', organisation: 'Org', role: 'CIO', org_type: 'private', industry: 'mining', org_size: '51_200' },
    consent: { contact: true, marketing: false },
    answers: { b2_1: 'no', b1_1: ['health', 'not-a-real-option'], zz_unknown: 'x' },
    result: { flags: [] },
    website: '',
    ts: Math.floor(Date.now() / 1000) - 60,
  };
  ok((await fetch(`${BASE}/diagnostic.php`)).status === 405, 'GET rejected (405)');
  ok((await post(base, { 'Content-Type': 'text/plain' })).status === 415, 'non-JSON rejected (415)');
  ok((await post(base, { Origin: 'https://evil.example' })).status === 403, 'cross-origin rejected (403)');
  ok((await post('{not json')).status === 400, 'malformed JSON rejected (400)');
  const bad = await post({ ...base, contact: { ...base.contact, email: 'nope' }, consent: { contact: false } });
  const badBody = await bad.json();
  ok(bad.status === 422 && badBody.fields.includes('email') && badBody.fields.includes('contact_consent'), 'invalid fields reported (422)');
  ok((await post({ ...base, diagnostic: { id: 'data', version: 99 } })).status === 409, 'stale diagnostic version rejected (409)');
  const good = await post(base);
  ok(good.status === 200, 'tampered answers accepted after sanitising');
  const mail = fs.readFileSync(DRYRUN_FILE, 'utf8');
  ok(!mail.includes('not-a-real-option') && !mail.includes('zz_unknown'), 'unknown questions/options dropped server-side');
  ok(mail.includes('browser result differed'), 'server ignores client flags and notes the mismatch');
  ok(mail.includes('Data inventory gap'), 'server recalculated findings from answers');
  const bot = await post({ ...base, website: 'http://spam' });
  ok(bot.status === 200 && (await bot.json()).ref === 'LD-0', 'honeypot silently discarded');
}

/* ------------------------------------------------- Existing contact form */
{
  console.log('\n# Existing contact form');
  const form = new URLSearchParams({
    enquiry_type: 'project', name: 'Contact Test', organisation: 'Org', email: 'c@example.co.za',
    message: 'We need help with a reporting problem.', contact_pref: 'Email', consent: 'yes', website: '',
    ts: String(Math.floor(Date.now() / 1000) - 30),
  });
  const r = await fetch(`${BASE}/contact.php`, { method: 'POST', body: form, redirect: 'manual' });
  ok(r.status === 303 && r.headers.get('location') === '/thank-you', `contact.php still redirects to /thank-you (${r.status} ${r.headers.get('location')})`);
  const { ctx, page, errors } = await newPage();
  await page.goto(`${BASE}/contact`, { waitUntil: 'networkidle' });
  ok(await page.isVisible('form[data-cform]'), 'contact page renders its form');
  ok(errors.length === 0, 'no console errors on contact');
  await ctx.close();
}

/* ------------------------------------------------------------ Hub & home */
{
  console.log('\n# Hub and homepage');
  const { ctx, page, errors } = await newPage();
  await page.goto(`${BASE}/diagnostics`, { waitUntil: 'networkidle' });
  ok((await page.$$('.dxc__card')).length === 4, 'hub lists four diagnostics');
  const ev = await page.evaluate(() => window.__events || []);
  ok(ev.some((e) => e.event === 'diagnostic_hub_view'), 'analytics: diagnostic_hub_view fired');
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  ok((await page.textContent('h1'))?.includes('Find the problems hiding inside your operations.'), 'homepage hero updated');
  ok((await page.getAttribute('.hero__actions a.btn', 'href')) === '/diagnostics', 'hero primary CTA goes to diagnostics');
  ok((await page.$$('.ledger__list li')).length >= 6, 'case-study ledger kept');
  ok(errors.length === 0, 'no console errors');
  await ctx.close();
}

await browser.close();
console.log(failures ? `\n${failures} failure(s).` : '\nAll diagnostics checks passed.');
process.exit(failures ? 1 : 0);
