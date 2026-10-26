/**
 * Sectors. The three strategic markets get full treatment; the rest are
 * listed more quietly so the site doesn't read as mining-only.
 */
export type Industry = {
  id: string;
  name: string;
  /** One sentence for the homepage. */
  summary: string;
  /** Longer copy for /industries. */
  body: string;
  needs: string[];
};

export const STRATEGIC_INDUSTRIES: Industry[] = [
  {
    id: 'mining',
    name: 'Mining & industrial',
    summary:
      'Inspection, compliance, asset tracking and field systems that keep working when the connection doesn’t.',
    body: 'Mining and industrial operations run on equipment, inspections and people spread across large sites, often with unreliable connectivity. We build the systems that capture work in the field, keep compliance records defensible, track assets and bring operational data into dashboards that management can act on.',
    needs: [
      'Inspection and certification systems',
      'Asset and equipment tracking',
      'Offline field data capture',
      'Workforce and contractor systems',
      'Monitoring, alerts and dashboards',
      'Hardware and software integration',
    ],
  },
  {
    id: 'financial-services',
    name: 'Financial services',
    summary:
      'Lending, collections, reporting and secure internal systems with the audit trail regulators expect.',
    body: 'Financial services organisations need systems that are accurate, auditable and secure. We build and integrate the platforms behind lending, collections, client records and reporting, and automate the workflows that otherwise run on spreadsheets and email.',
    needs: [
      'Loan and client management',
      'Collections and debit-order reconciliation',
      'Workflow and approvals automation',
      'Reporting and financial exports',
      'Integrations with banking and accounting systems',
      'Secure infrastructure and access control',
    ],
  },
  {
    id: 'agriculture',
    name: 'Agriculture',
    summary:
      'Field data, crew and job management, monitoring and analytics for operations spread across farms.',
    body: 'Agricultural work happens far from the office, across farms, seasons and teams. We build offline-first field systems, connect sensors and equipment where it makes sense, and give operators clear records of jobs, people, assets and money.',
    needs: [
      'Offline-first field operations',
      'Crew, job and tally management',
      'Asset management',
      'IoT and sensor monitoring',
      'Invoicing and payments',
      'Operational analytics',
    ],
  },
];

export const OTHER_INDUSTRIES = [
  { name: 'Government & municipalities', note: 'Service delivery, household and indigent data, incident reporting' },
  { name: 'Development organisations', note: 'Bursaries, grants, beneficiary and fund management' },
  { name: 'Education', note: 'Student platforms, applications and learning tools' },
  { name: 'Healthcare', note: 'Operational systems, records and bookings' },
  { name: 'Logistics', note: 'Fleet tracking, trips and field operations' },
  { name: 'Professional services', note: 'Client, workflow and document systems' },
] as const;
