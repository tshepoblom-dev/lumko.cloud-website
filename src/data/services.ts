/**
 * The five capability areas. Shared by the homepage index and /what-we-do,
 * so the wording stays in one place.
 */
export type Service = {
  id: string;
  number: string;
  name: string;
  /** One line for the homepage index. */
  summary: string;
  /** Short paragraph(s) for /what-we-do. */
  body: string[];
  capabilities: string[];
  /** What an engagement in this area typically looks like. */
  typically: string;
};

export const SERVICES: Service[] = [
  {
    id: 'software-systems',
    number: '01',
    name: 'Software & Systems',
    summary:
      'Business systems, platforms and applications built around how your organisation actually operates.',
    body: [
      'When off-the-shelf software no longer fits, we design and build the system the organisation needs: web platforms, mobile applications and the internal tools that hold operations together.',
      'We build for the people, approvals, records and exceptions that make your work specific, and we integrate with the systems you already depend on.',
    ],
    capabilities: [
      'Custom software development',
      'Web applications',
      'Mobile and offline-first field apps',
      'Business and enterprise systems',
      'Workflow automation',
      'API and systems integration',
    ],
    typically:
      'A multi-portal platform replacing paper, spreadsheets and email with one governed workflow.',
  },
  {
    id: 'infrastructure-ict',
    number: '02',
    name: 'Infrastructure & ICT',
    summary:
      'The servers, networks, cloud and support that systems run on, planned and run properly.',
    body: [
      'Good software fails on weak foundations. We assess, plan and implement the infrastructure behind your systems, from hosting and cloud environments to networks, servers and access control.',
      'Where you need it, we stay on to administer and support that environment so it remains secure and dependable.',
    ],
    capabilities: [
      'IT infrastructure consulting',
      'Cloud and hosting environments',
      'Servers and networks',
      'Security and access control',
      'Systems administration',
      'Ongoing technical support',
    ],
    typically:
      'Moving a business-critical system onto secure, monitored hosting with a clear support arrangement.',
  },
  {
    id: 'data-intelligence',
    number: '03',
    name: 'Data & Intelligence',
    summary:
      'Turning operational records into reporting, dashboards and analysis people use to decide.',
    body: [
      'Most organisations already hold the data they need. It sits in separate systems, spreadsheets and paper files. We bring it together, structure it, and put it in front of the people who make decisions.',
      'That can mean management dashboards and reporting, financial exports that feed your accounting system, or applied data science on a specific operational question.',
    ],
    capabilities: [
      'Data analytics',
      'Dashboards and reporting',
      'Data engineering and integration',
      'Business intelligence',
      'Applied data science',
    ],
    typically:
      'A finance and programme dashboard drawn from live operational data rather than monthly spreadsheets.',
  },
  {
    id: 'integrated-technology',
    number: '04',
    name: 'Integrated Technology',
    summary:
      'Where software meets the physical world: devices, sensors, tracking and field systems.',
    body: [
      'Some problems start with something physical: a vehicle, a machine, a field, a piece of equipment that needs inspecting. We connect the devices and people in the field to the platforms and data behind them.',
      'That runs from tracking hardware and remote commands to offline field capture, connectivity, backend systems, alerts and reporting.',
    ],
    capabilities: [
      'Hardware and software integration',
      'IoT and sensor data',
      'Asset and vehicle tracking',
      'Monitoring and alerts',
      'Field and offline systems',
      'Operational technology',
    ],
    typically:
      'GPS trackers feeding a platform that shows live position, trip history and lets operators act remotely.',
  },
  {
    id: 'technology-consulting',
    number: '05',
    name: 'Technology Consulting',
    summary:
      'Independent advice on what to build, buy, fix or leave alone, before money is committed.',
    body: [
      'Before any build, we help you understand the problem properly. We look at processes, existing systems, constraints and risks, then recommend a practical route and a realistic plan.',
      'Sometimes the right answer is a small change rather than a new system. We will tell you that too.',
    ],
    capabilities: [
      'Technology strategy',
      'Digital transformation planning',
      'Systems architecture and solution design',
      'Technology assessments',
      'Business process analysis',
      'Implementation planning',
    ],
    typically:
      'A technology assessment and phased roadmap a board or executive committee can approve.',
  },
];

/** Disciplines Lumko draws on (the About page diagram, network form options). */
export const DISCIPLINES = [
  'Software engineering',
  'Infrastructure',
  'Data & analytics',
  'Cloud',
  'Cybersecurity',
  'Networks',
  'Hardware & IoT',
  'Telecommunications',
  'Consulting',
] as const;

/** Partnership lifecycle. */
export const LIFECYCLE = [
  {
    name: 'Discover',
    body: 'Understand the organisation, the people involved and the real problem.',
  },
  {
    name: 'Design',
    body: 'Agree the solution, the architecture and what belongs in each phase.',
  },
  {
    name: 'Build',
    body: 'Deliver in reviewable stages, so you see progress and steer it.',
  },
  {
    name: 'Integrate',
    body: 'Connect to your systems, data, devices and infrastructure.',
  },
  {
    name: 'Support',
    body: 'Keep it running, secure and in the hands of trained people.',
  },
  {
    name: 'Improve',
    body: 'Extend and refine it as the organisation and its needs change.',
  },
] as const;
