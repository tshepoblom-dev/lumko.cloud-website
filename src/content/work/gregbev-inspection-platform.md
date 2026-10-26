---
title: >-
  Lifting-equipment inspection and certification
headline: >-
  Field inspections, compliance records and certificates for heavy lifting equipment
client: >-
  GregBev Enterprise
clientNamed: true
sector: Mining & industrial safety
location: Kuruman, Northern Cape
year: '2023'
status: delivered
statusNote: >-
  First platform delivered in 2023. A next-generation platform is in development.
summary: >-
  An inspection platform that takes inspectors from equipment on site to a certificate the client can rely on, built for sites where connectivity can’t be assumed.
challenge: >-
  GregBev inspects and load-tests cranes, lifting machinery and related equipment for industrial and mining clients. The work is regulated under the Occupational Health and Safety Act and SANS 10375. Each inspection involves long technical checklists, measurements, defects and sign-offs, often captured far from reliable connectivity. Paper forms and manually compiled reports made it slow to turn an inspection into a certificate, and hard to keep a defensible history for every item of equipment.
approach: >-
  We built a mobile inspection app for the field team and a central system behind it. Inspectors work through structured checklists on a tablet, recording results, measurements and defects against each piece of equipment. The central system manages clients, equipment and inspection history and generates the reports. Access is scoped by role, so inspectors, clients and management each see what they should. The next-generation platform adds admin-configured inspection templates, offline-first sync, QR equipment tagging, and certificates that are cryptographically hashed so tampering can be detected.
result: >-
  Inspections are captured digitally at the equipment, and reports are generated from the same record rather than retyped. Every item of equipment carries its own inspection and certification history, so GregBev can answer a client’s or an auditor’s question from the system rather than from a filing cabinet.
capabilities:
  - Mobile field systems
  - Offline-first data capture
  - Compliance and certification
  - Reporting
  - Integrated technology
stack:
  - .NET (ASP.NET Core)
  - .NET MAUI / Flutter
  - SQL Server
  - PDF generation
  - Background job scheduling
featured: true
order: 2
system:
  users:
    - Field inspectors on site
    - Client representatives
    - GregBev management
  modules:
    - Equipment and client registers
    - Structured inspection checklists
    - Defects, measurements and sign-off
    - Offline capture and sync
    - Report and certificate generation
  outputs:
    - Inspection reports
    - Tamper-evident certificates
    - Equipment inspection history
    - Expiry tracking for re-inspection
facts:
  - label: Regulatory frame
    value: OHS Act 85 of 1993 · SANS 10375
  - label: Field capture
    value: Tablet, offline-capable
seoDescription: >-
  How Lumko built a mobile inspection and certification platform for GregBev Enterprise, a lifting-equipment inspection company serving mining and industrial clients in the Northern Cape.
---

## Technology that has to work on site

Inspection work happens next to the equipment: on a crane gantry, in a workshop, at a mine. The software has to suit how inspectors actually work. That means checklists that follow the physical order of the inspection, capture that works without a signal, and data that reaches the central system once the device reconnects.

## A record that holds up

In regulated industries, the certificate is only as good as the record behind it. The platform ties every result, defect and sign-off to a specific item of equipment and a specific inspector. The newer generation adds a hash to each certificate, so any alteration after issue can be detected.

## A relationship, not a single release

The first platform went into use in 2023. As GregBev’s needs grew, the work continued into a re-architected platform: configurable templates, stronger offline sync and expiry alerts for re-inspection.
