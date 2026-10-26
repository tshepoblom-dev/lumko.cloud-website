import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

/**
 * Case studies. Copy rule: no metric appears unless it is documented in the
 * project's own records. Clients are named only with permission
 * (`clientNamed`); otherwise `client` is a sector description.
 */
const work = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/work' }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      /** Short outcome-led headline used on cards. */
      headline: z.string(),
      client: z.string(),
      clientNamed: z.boolean(),
      sector: z.string(),
      location: z.string(),
      year: z.string(),
      status: z.enum(['delivered', 'in-progress', 'product']),
      statusNote: z.string().optional(),
      summary: z.string(),
      challenge: z.string(),
      approach: z.string(),
      result: z.string(),
      capabilities: z.array(z.string()),
      stack: z.array(z.string()),
      featured: z.boolean().default(false),
      order: z.number(),
      /** Schematic: who uses it → what the platform does → what it produces. */
      system: z.object({
        users: z.array(z.string()),
        modules: z.array(z.string()),
        outputs: z.array(z.string()),
      }),
      /** Documented facts, shown as a small ledger. Never invented. */
      facts: z.array(z.object({ label: z.string(), value: z.string() })).default([]),
      image: image().optional(),
      imageAlt: z.string().optional(),
      imageCaption: z.string().optional(),
      seoDescription: z.string(),
    }),
});

export const collections = { work };
