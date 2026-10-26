/**
 * Site-wide constants. Single source of truth for identity, contact details,
 * navigation and the data used to build structured data (JSON-LD).
 *
 * NOTE (to confirm with Lumko before launch):
 *  - primary email: using info@lumko.cloud (the old live site still shows
 *    admin@lumko.cloud). Confirm the correct inbox — contact.php sends here.
 *  - LinkedIn handle: /company/lumko-cloud was used pre-rebrand. Confirm it
 *    still resolves.
 *  - no street address is published until Lumko provides one.
 */

export const SITE = {
  name: 'Lumko',
  descriptor: 'Business Technology Partners',
  /** Name + descriptor, for footer, schema and OG site_name. */
  fullName: 'Lumko Business Technology Partners',
  tagline: 'Your partner in tech',
  /** Used for <title> suffixes. */
  titleSuffix: 'Lumko',
  origin: 'https://lumko.cloud',
  locale: 'en_ZA',
  lang: 'en-ZA',
} as const;

export const CONTACT = {
  email: 'info@lumko.cloud',
  /** E.164, no spaces, for tel: and wa.me links. */
  phoneE164: '+27834328499',
  /** Human-readable, for display. */
  phoneDisplay: '+27 83 432 8499',
  whatsappUrl: 'https://wa.me/27834328499',
  calendlyUrl: 'https://calendly.com/lumkotech/30min',
  locality: 'Bloemfontein',
  region: 'Free State',
  country: 'South Africa',
  countryCode: 'ZA',
  /** Geo point for schema (Bloemfontein city centre). */
  geo: { lat: -29.0852, lng: 26.1596 },
  /** Territory served, in display order. Keep this modest and true. */
  serviceArea: ['South Africa', 'Lesotho', 'Namibia', 'Botswana'],
} as const;

export const SOCIAL = {
  linkedin: 'https://www.linkedin.com/company/lumko-cloud',
} as const;

/** Lumko Seminars — the gateway many visitors arrive through. */
export const SEMINAR = {
  url: 'https://seminar.lumko.cloud',
  name: 'Lumko Seminars',
  /** Next event. Hidden automatically once `date` has passed (build time). */
  next: {
    title: 'The Power of Data',
    subtitle: 'How digital transformation and applied data science drive organisations forward',
    date: '2026-11-13',
    dateDisplay: '13 November 2026',
    city: 'Bloemfontein',
  },
} as const;

export type NavItem = {
  label: string;
  href: string;
  external?: boolean;
};

export const PRIMARY_NAV: NavItem[] = [
  { label: 'What We Do', href: '/what-we-do' },
  { label: 'Industries', href: '/industries' },
  { label: 'Our Work', href: '/work' },
  { label: 'About', href: '/about' },
  { label: 'Seminars', href: SEMINAR.url, external: true },
];

/** One label per intent, used everywhere: contact, and the work index. */
export const PRIMARY_CTA = { label: 'Talk to Lumko', href: '/contact' } as const;
export const SECONDARY_CTA = { label: 'See our work', href: '/work' } as const;
/** For ICT professionals applying to work with Lumko (opens the contact form in network mode). */
export const NETWORK_CTA = { label: 'Join the Lumko network', href: '/contact?type=network#form' } as const;

export const FOOTER_NAV: { heading: string; links: NavItem[] }[] = [
  {
    heading: 'Lumko',
    links: [
      { label: 'What We Do', href: '/what-we-do' },
      { label: 'Industries', href: '/industries' },
      { label: 'Our Work', href: '/work' },
      { label: 'About', href: '/about' },
      { label: 'Talk to Lumko', href: '/contact' },
    ],
  },
  {
    heading: 'Elsewhere',
    links: [
      { label: 'Lumko Seminars', href: SEMINAR.url, external: true },
      { label: 'Join the Lumko network', href: '/contact?type=network#form' },
      { label: 'LinkedIn', href: SOCIAL.linkedin, external: true },
      { label: 'Privacy', href: '/privacy' },
    ],
  },
];
