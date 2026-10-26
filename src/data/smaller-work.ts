/**
 * Smaller engagements: websites, online stores and business tools for growing
 * businesses. Shown quietly on /work (#smaller) so smaller organisations can
 * see we help them too, without competing with the main case studies.
 * Facts from the project register (lumko.cloud/projects.js). No metrics.
 * No outbound links: several client sites are not reliably online.
 */
import type { ImageMetadata } from 'astro';
import kns from '@/assets/work/smaller/kns-diamonds.jpg';
import heiwes from '@/assets/work/smaller/heiwes-glamwear.jpg';
import onolo from '@/assets/work/smaller/onolo.jpg';
import ipzotic from '@/assets/work/smaller/ipzotic-luxury.jpg';

export type SmallerProject = {
  client: string;
  what: string;
  kind: string;
  place: string;
  year: string;
  image?: ImageMetadata;
  imageAlt?: string;
};

export const SMALLER_WORK: SmallerProject[] = [
  {
    client: 'Ipzotic Luxury',
    kind: 'Online bookings',
    what: 'A showcase website for a spa and beauty business, with an online appointment calendar clients book from directly.',
    place: 'Kimberley',
    year: '2026',
    image: ipzotic,
    imageAlt: 'Ipzotic Luxury appointment page with a booking form beside a weekly availability calendar.',
  },
  {
    client: 'KnS Diamonds',
    kind: 'Brand website',
    what: 'A website presenting custom jewellery and diamond work, designed to bring in enquiries.',
    place: 'Kimberley',
    year: '2024',
    image: kns,
    imageAlt: 'KnS Diamonds website showing the brand’s promises and a row of signature rings.',
  },
  {
    client: 'Heiwes Glamwear',
    kind: 'Online store',
    what: 'An online store for formal menswear, with product categories, cart and checkout.',
    place: 'Pretoria',
    year: '2023',
    image: heiwes,
    imageAlt: 'Heiwes Glamwear online store with search, navigation and formal shoe and suit categories.',
  },
  {
    client: 'Onolo Financial Services',
    kind: 'Website and onboarding',
    what: 'A website for a funeral cover provider, with online applications for new members.',
    place: 'Kuruman',
    year: '2023',
    image: onolo,
    imageAlt: 'Onolo Financial Services website hero with Apply Now and Contact Us buttons.',
  },
  {
    client: 'JBC Performance',
    kind: 'Business system',
    what: 'A client, inventory and invoicing system for a vehicle workshop, set up and configured for how the team works.',
    place: 'Bainsvlei',
    year: '2023',
  },
];
