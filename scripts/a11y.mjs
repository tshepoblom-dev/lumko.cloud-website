/**
 * Dev-only: run axe-core against every route and report violations.
 * Requires the preview server running on :4321.
 *
 *   npx astro preview &
 *   node scripts/a11y.mjs
 */
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const axeSource = await fs.readFile(require.resolve('axe-core/axe.min.js'), 'utf8');

const BASE = process.env.BASE_URL || 'http://localhost:4321';
const ROUTES = process.env.ROUTES?.split(',') || [
  '/', '/what-we-do', '/industries', '/work', '/about', '/contact', '/privacy', '/thank-you', '/404',
  '/work/jtg-bursary-platform', '/work/gregbev-inspection-platform', '/work/ttmk-lending-platform',
  '/work/municipal-service-delivery', '/work/ifalcontrace', '/work/shearflow',
];
const WIDTHS = (process.env.WIDTHS?.split(',').map(Number)) || [1280, 390];

const browser = await chromium.launch();
let serious = 0;
for (const route of ROUTES) {
  for (const width of WIDTHS) {
    const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
    await page.goto(BASE + route, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.querySelectorAll('[data-reveal]').forEach((e) => e.classList.add('is-in')));
    await page.addScriptTag({ content: axeSource });
    const result = await page.evaluate(async () =>
      // @ts-ignore
      await window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice'] }),
    );
    const v = result.violations;
    const bad = v.filter((x) => x.impact === 'serious' || x.impact === 'critical');
    serious += bad.length;
    console.log(`${v.length ? '!!' : 'ok'} ${route} @${width}: ${v.length} violation(s)`);
    for (const x of v) {
      console.log(`   [${x.impact}] ${x.id}: ${x.help}`);
      x.nodes.slice(0, 3).forEach((n) => console.log(`      ${n.target.join(' ')}`));
    }
    await page.close();
  }
}
await browser.close();
console.log(serious ? `\n${serious} serious/critical violation group(s).` : '\nNo serious or critical violations.');
process.exit(serious ? 1 : 0);
