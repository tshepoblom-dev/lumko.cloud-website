---
title: >-
  Bursary management platform
headline: >-
  One governed platform for a development trust’s bursaries, from application to payout
client: >-
  John Taolo Gaetsewe Developmental Trust
clientNamed: true
sector: Development sector
location: Northern Cape
year: '2026'
status: delivered
statusNote: >-
  Provisionally accepted. Go-live and training for the Trust’s own staff form the final phase.
summary: >-
  A multi-portal platform that takes a bursary from application, verification and committee review through to awards, signed contracts, tranche payments and audit.
challenge: >-
  The Trust supports students across the John Taolo Gaetsewe district. Running bursaries means many hands on each application, including applicants, verifiers, reviewers, a committee, sponsors and finance. Every decision and every rand has to be traceable. Doing that across documents, spreadsheets and email makes consistency, conflict management and financial control hard to guarantee.
approach: >-
  We designed one platform with multiple portals for administration and finance, review committees, verification, sponsors and learners. Applications follow configurable forms and eligibility rules. Reviewers score against weighted rubrics and declare conflicts of interest, which trigger automatic recusal. Awards generate contracts that learners accept digitally. Finance allocates funds and pays in tranches through a maker-checker requisition workflow, Requested → Approved → Paid → Receipted. POPIA consent, data-subject requests and a full audit log run underneath.
result: >-
  The Trust’s bursary process, from first application to final receipt, now sits in one system with clear roles and an audit trail behind every decision. Finance exports a ledger in a format ready to import into its accounting system. The same relationship has continued into a supplier registration and procurement platform for the Trust, now in development.
capabilities:
  - Custom software development
  - Workflow automation
  - Finance and reporting
  - POPIA compliance
  - Systems integration
stack:
  - Laravel 
  - MySQL
  - Tailwind / Alpine.js
  - Real-time notifications (Reverb)
  - PDF and Excel generation
featured: true
order: 1
system:
  users:
    - Learners and applicants
    - Document verifiers
    - Reviewers and committee
    - Sponsors
    - Programme and finance administrators
  modules:
    - Applications and eligibility
    - Document verification
    - Rubric scoring with conflict-of-interest recusal
    - Awards, contracts and e-signature
    - Fund allocation and tranche payments
    - POPIA consent and audit log
  outputs:
    - Committee decisions with a full audit trail
    - Signed bursary contracts
    - Approved, paid and receipted disbursements
    - Ledger export for the accounting system
facts:
  - label: Role-based portals
    value: '5'
 # - label: Automated regression tests
  #  value: '630'
  - label: Sign-in
    value: Two-factor, enforced
image: ../../assets/work/jtg-finance-dashboard.png
imageAlt: >-
  Financial dashboard showing the total fund pool, allocated and remaining amounts, and budget against actual spend for each bursary programme.
imageCaption: >-
  Finance dashboard, shown with demonstration data.
seoDescription: >-
  How Lumko built a five-portal bursary management platform for the John Taolo Gaetsewe Developmental Trust in the Northern Cape, covering applications, committee review, contracts, tranche payments and POPIA compliance.
---

## A process with many hands on it

A bursary passes through many people. An applicant submits documents. A verifier checks them. Reviewers score the application, and a committee decides. A sponsor approves funding. Finance pays tuition, accommodation and other costs in separate tranches, and later reconciles receipts. Each step needs the right person, the right information and a record of what was decided and why.

## How the platform is organised

Instead of one large admin screen, the platform gives each role its own portal and only what that role needs. That keeps sensitive information contained and makes the workflow easier to follow for occasional users such as committee members and sponsors.

The financial side was designed with the same care as the application side. Requisitions use separate maker and checker steps. Tranches are itemised per learner, with budget caps for accommodation and textbooks. Every financial action is logged and attributed.

## Built to be handed over

The final phase covers go-live, the transfer of source code and documentation, and technical training for the Trust’s own staff, so the organisation can run and extend the system itself. That is how we prefer to work: build it properly, hand it over properly, and stay available.
