# 0003. Availability computed on demand

Date: 2026-10-20
Status: Proposed

## Context

Customers pick a service, optionally a staff member, and a date. The system must show free start times that respect working hours, time off, existing bookings and buffers, in Europe/London time with daylight saving changes.

Two approaches are common: pre-generate slot rows for every staff member and day, or compute free times from the rules and existing bookings when needed.

## Decision

Compute availability on demand from working hours, time off, bookings and settings. Do not store generated slots. Put the calculation in pure functions in `lib/availability`, and repeat the overlap check inside the booking transaction, backed by an exclusion constraint.

## Alternatives considered

- **Pre-generated slot rows.** Simple to query, but needs regeneration whenever hours, time off or settings change, and a large table at scale. Easy to get out of sync.
- **Compute in SQL only.** Fast, but the logic becomes hard to unit test and hard to read for future changes. Rejected in favour of testable TypeScript, with SQL only for the final conflict check.

## Consequences

- Always consistent with the current rules.
- Calculation happens per request. At about 100 bookings a week this is negligible.
- Time zone handling is concentrated in one module and must be tested across the March and October clock changes.
- If load grows substantially, caching by date and service can be added without changing the model.
