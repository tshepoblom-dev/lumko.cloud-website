---
title: >-
  ShearFlow field operations
headline: >-
  Jobs, crews, tallies, wages and invoicing for shearing teams working across farms
client: >-
  ShearFlow (a Lumko product)
clientNamed: true
sector: Agriculture
location: South Africa
year: '2025'
status: product
statusNote: >-
  A Lumko product, developed with shearing contractors as early users.
summary: >-
  An offline-first field operations platform for shearing contractors, covering farm jobs, crew assignment, sheep tallies, per-head wages, VAT invoicing, payments and expenses.
challenge: >-
  Shearing contractors run crews across many farms in a season, often far from mobile coverage. Tallies are counted per shearer and wages calculated per sheep. The farmer then has to be invoiced accurately. Doing this in notebooks and spreadsheets leads to disputes, delayed payments and little visibility of how the season is going.
approach: >-
  We built a mobile app that works fully offline in the shearing shed, backed by a central platform. Contractors create jobs at client farms and assign crews. They record tallies per shearer as the work happens and sync when they reach coverage. Wages are calculated from the tallies, VAT invoices are generated for the farmer, and payments, proof of payment and expenses are tracked against each job.
result: >-
  Contractors get one record of each job, from the tally in the shed to the invoice and payment, which reduces disputes and gives them a clear view of the season. It shows how we approach agricultural technology: start with the field, then build up to the data.
capabilities:
  - Offline-first field systems
  - Workflow automation
  - Invoicing and payments
  - Operational reporting
stack:
  - ASP.NET (API)
  - Flutter (offline-first)
  - SQL database
  - Excel export
featured: false
order: 6
system:
  users:
    - Shearing contractors
    - Crew leaders
    - Farm clients
  modules:
    - Farm jobs and crew assignment
    - Per-shearer tallies (offline)
    - Wage calculation
    - VAT invoicing and payments
    - Expenses
  outputs:
    - Crew wages per job
    - Farmer invoices
    - Season reporting
facts:
  - label: Connectivity
    value: Works fully offline
seoDescription: >-
  ShearFlow is Lumko’s offline-first field operations platform for shearing contractors, covering farm jobs, crew tallies, wages, VAT invoicing and payments.
---

## Built in the shed, not the office

The defining constraint is the environment: a shearing shed on a farm, often without signal, with work moving fast. Everything a crew leader needs works offline, and the app syncs when it can.

## From tally to invoice

The tally is the single source of truth for both the shearers’ wages and the farmer’s invoice. Capturing it once, at the point of work, removes the re-counting and reconciliation that otherwise follows every job.
