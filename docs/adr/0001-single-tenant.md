# 0001. Single-tenant system

Date: 2026-10-20
Status: Proposed

## Context

The system is built for one salon with about 100 bookings a week. The owner has no plans for multiple locations in v1. Multi-tenant designs add a `salon_id` to every table, every query and every policy, which adds complexity to a solo project.

## Decision

Build a single-tenant system. One set of settings, services, staff and bookings. No `salon_id` columns.

## Alternatives considered

- **Multi-tenant from day one.** Makes a future SaaS or second salon easier, but adds a column to every table, a tenancy check to every row-level security policy, and a larger test matrix. Not justified by current scope.
- **Multi-tenant later, single-tenant now, with a `salon_id` column reserved.** Keeps the option open but still adds the column and its indexes. Rejected for now, revisit if a second salon is confirmed.

## Consequences

- Simpler schema, policies and queries.
- Settings are a single row.
- Adding a second salon later requires a migration to introduce tenancy. This is acceptable given the scope, and the decision should be revisited before any second customer is onboarded.
