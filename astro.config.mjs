// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import mdx from '@astrojs/mdx';
import icon from 'astro-icon';

// Canonical production origin. Every canonical URL, sitemap entry and OG URL
// is built against this. Confirmed with the client: https://lumko.cloud
const SITE = 'https://lumko.cloud';

export default defineConfig({
  site: SITE,
  output: 'static',
  trailingSlash: 'never',
  build: {
    // Emit /about.html rather than /about/index.html so clean URLs work on
    // plain Apache without extra rewrite rules.
    format: 'file',
    inlineStylesheets: 'auto',
  },
  integrations: [
    icon({ iconDir: 'src/icons' }),
    mdx(),
    sitemap({
      filter: (page) =>
        !page.includes('/styleguide') && !page.includes('/thank-you'),
    }),
  ],
  image: {
    // Local sharp service; generates WebP/AVIF at build time.
    responsiveStyles: true,
  },
  prefetch: {
    prefetchAll: false,
    defaultStrategy: 'hover',
  },
});
