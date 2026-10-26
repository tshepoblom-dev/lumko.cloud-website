---
title: >-
  Municipal service-delivery and household data platform
headline: >-
  Household profiling, incident reporting and indigent approvals for local government
client: >-
  Developed for local government
clientNamed: false
sector: Government & municipalities
location: Free State
year: '2025'
status: product
statusNote: >-
  A Lumko-developed platform for municipalities.
summary: >-
  A web and mobile platform that lets municipal teams capture household and service-delivery data in the field, take incident reports, and route indigent-subsidy applications through formal approval.
challenge: >-
  Municipalities need accurate, current information about the households they serve. That covers housing, water, electricity and sanitation, and who qualifies for indigent support. That information is often collected on paper, held in separate registers and approved through slow manual sign-off chains. Field teams frequently work in wards with poor connectivity.
approach: >-
  We designed a platform around the municipality’s own structure of province, municipality and ward. Field workers capture household profiles and incident reports on a mobile app that works offline and syncs in batches when connected, including GPS location. Indigent-subsidy applications move through a defined approval chain of ward councillor, municipal manager and finance, with each step recorded. Administrators see submissions arrive in real time.
result: >-
  The platform gives a municipality one structured source of household and service-delivery data, gathered at the doorstep and approved through a visible, accountable process instead of paper registers.
capabilities:
  - Mobile field systems
  - Offline-first data capture
  - Workflow and approvals
  - Real-time dashboards
  - Geolocation
stack:
  - .NET (ASP.NET Core)
  - .NET MAUI
  - SignalR (real time)
  - SQL Server
featured: false
order: 4
system:
  users:
    - Field workers and ward teams
    - Ward councillors
    - Municipal manager and finance
    - Administrators
  modules:
    - Household profiling (housing, water, electricity, sanitation)
    - Incident reporting with GPS
    - Indigent-subsidy applications and approvals
    - Offline capture and batch sync
  outputs:
    - Ward-level household data
    - Approved indigent register
    - Live incident and submission feed
facts: []
seoDescription: >-
  A Lumko-developed municipal platform for household profiling, incident reporting and indigent-subsidy approvals, with offline mobile field capture for ward teams.
---

## Built around the way a municipality is organised

The data model follows the structure the municipality already works in: province, municipality, ward, household. Reports, approvals and access all follow the same lines, so the system makes sense to councillors and officials without retraining them in a new vocabulary.

## Field-first

Much of this work happens at the doorstep, in areas where mobile data is unreliable. The mobile app is built to work offline and sync in batches, so field teams are never stopped by a missing signal.
