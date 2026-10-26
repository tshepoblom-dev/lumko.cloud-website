/**
 * Dev-only: screenshot a list of routes at several widths and report any
 * horizontal overflow.  Requires the preview server running on :4321.
 *
 *   npm run preview &   (or: npx astro preview)
 *   node scripts/shots.mjs [outDir]
 */
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';

const BASE = process.env.BASE_URL || 'http://localhost:4321';
const OUT = process.argv[2] || path.join(process.cwd(), '.shots');
const ROUTES = process.env.ROUTES?.split(',') || ['/', '/styleguide'];
const WIDTHS = (process.env.WIDTHS?.split(',').map(Number)) || [375, 768, 1280];

await fs.mkdir(OUT, { recursive: true });
const browser = await chromium.launch();
let problems = 0;

for (const route of ROUTES) {
  for (const width of WIDTHS) {
    const page = await browser.newPage({ viewport: { width, height: 900 }, deviceScaleFactor: 1 });
    const res = await page.goto(BASE + route, { waitUntil: 'networkidle' });
    if (!res || !res.ok()) console.log(`  !! ${route} -> ${res && res.status()}`);
    await page.waitForTimeout(150);
    const m = await page.evaluate(() => ({
      scrollW: document.documentElement.scrollWidth,
      clientW: document.documentElement.clientWidth,
      offenders: [...document.querySelectorAll('body *')]
        .filter((el) => el.getBoundingClientRect().right > document.documentElement.clientWidth + 1)
        .slice(0, 8)
        .map((el) => `${el.tagName.toLowerCase()}.${(el.className || '').toString().split(' ').filter(Boolean).join('.')} (right=${Math.round(el.getBoundingClientRect().right)})`),
    }));
    const overflow = m.scrollW > m.clientW + 1;
    if (overflow) {
      problems++;
      console.log(`OVERFLOW  ${route} @${width}  scrollW=${m.scrollW} clientW=${m.clientW}`);
      m.offenders.forEach((o) => console.log('   ' + o));
    } else {
      console.log(`ok        ${route} @${width}`);
    }
    const name = `${route.replace(/[^\w]+/g, '_') || 'home'}__${width}.png`;
    await page.screenshot({ path: path.join(OUT, name), fullPage: true });
    await page.close();
  }
}

await browser.close();
console.log(problems ? `\n${problems} overflow issue(s).` : '\nNo overflow. All good.');
process.exit(problems ? 1 : 0);
