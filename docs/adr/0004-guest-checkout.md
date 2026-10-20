# 0004. Guest checkout with optional accounts

Date: 2026-10-20
Status: Proposed

## Context

Most salon customers book once or twice a year. Requiring an account before booking adds friction and drop-off. Customers still need to change or cancel a booking later, and the salon still needs a reliable contact for reminders.

## Decision

Customers book as guests, giving name, email and phone. Each booking has a signed, expiring link (secret from `BOOKING_LINK_SECRET`) that opens the booking page to view, reschedule or cancel without logging in. Creating an account is optional and, when created, links existing bookings to the customer record.

Row-level security for guests cannot rely on `auth.uid()`. Guest access goes through a server route that verifies the signed link and uses the service role inside that route only, never from the browser.

## Alternatives considered

- **Mandatory accounts.** Simpler security model, but noticeably more drop-off for one-off bookings. Rejected.
- **Magic link at checkout for everyone.** Adds an email round trip before the booking is confirmed. Rejected for v1; can revisit if spam or fake bookings become a problem.

## Consequences

- Lower friction for customers.
- The signed-link flow needs careful handling: expiry, rotation if the secret changes, and no personal data in the URL.
- Row-level security policies for customers apply only to authenticated accounts. Guest reads and writes are restricted to the verified server route.
- Need a rate limit on booking creation to reduce abuse.
