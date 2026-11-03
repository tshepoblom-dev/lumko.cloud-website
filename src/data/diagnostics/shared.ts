/**
 * Option lists shared across diagnostics and the lead form.
 * The industry list follows src/data/industries.ts so the site and the
 * diagnostics describe sectors the same way.
 */
import type { Option } from '../../lib/diagnostics/types.ts';
import { STRATEGIC_INDUSTRIES, OTHER_INDUSTRIES } from '../industries.ts';

export const ORG_TYPES: Option[] = [
  { value: 'private', label: 'Private business' },
  { value: 'public', label: 'Public entity / government' },
  { value: 'municipality', label: 'Municipality' },
  { value: 'education', label: 'Education / training institution' },
  { value: 'ngo', label: 'NGO / NPO' },
  { value: 'healthcare', label: 'Healthcare' },
  { value: 'other', label: 'Other' },
];

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');

export const INDUSTRIES: Option[] = [
  ...STRATEGIC_INDUSTRIES.map((i) => ({ value: slug(i.id), label: i.name })),
  { value: 'manufacturing', label: 'Manufacturing' },
  ...OTHER_INDUSTRIES.map((i) => ({ value: slug(i.name), label: i.name })),
  { value: 'retail', label: 'Retail & distribution' },
  { value: 'other', label: 'Other' },
];

export const ORG_SIZES: Option[] = [
  { value: '1_20', label: '1–20 people' },
  { value: '21_50', label: '21–50 people' },
  { value: '51_200', label: '51–200 people' },
  { value: '201_500', label: '201–500 people' },
  { value: '501_1000', label: '501–1,000 people' },
  { value: '1001_plus', label: '1,001+ people' },
  { value: 'undisclosed', label: 'Prefer not to say' },
];

export const NOT_SURE: Option = { value: 'unsure', label: 'Not sure' };

/** Standard disclaimer for legal-adjacent diagnostics. */
export const OPERATIONAL_DISCLAIMER =
  'This diagnostic is an operational technology assessment and is not legal, tax or compliance advice.';

/** Optional location on the lead form. */
export const REGIONS: Option[] = [
  'Eastern Cape', 'Free State', 'Gauteng', 'KwaZulu-Natal', 'Limpopo', 'Mpumalanga',
  'Northern Cape', 'North West', 'Western Cape', 'Lesotho', 'Namibia', 'Botswana', 'Other',
].map((r) => ({ value: r, label: r }));
