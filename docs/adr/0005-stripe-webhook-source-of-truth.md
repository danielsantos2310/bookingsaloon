# 0005. Stripe webhook as the source of truth for payments

Date: 2026-10-20
Status: Proposed

## Context

When a customer pays online, the browser may be redirected back to the salon site before the payment is final, or the redirect may never happen if the customer closes the tab. Trusting the redirect would confirm bookings that were never paid, or leave paid bookings unconfirmed.

## Decision

Stripe's `checkout.session.completed` webhook is the only event that moves a `pay_now` booking from `pending_payment` to `confirmed` and writes a `payment` row as paid. Webhook handling verifies the Stripe signature and is idempotent, storing processed event IDs. The success page only displays status and polls until the webhook has been processed.

## Alternatives considered

- **Confirm on redirect.** Simple, but unreliable and open to confirming unpaid bookings. Rejected.
- **Poll Stripe from the success page.** Works, but duplicates what the webhook already does and adds API calls per visit. Rejected.

## Consequences

- Payment state is correct even if the customer never returns to the site.
- Requires the webhook endpoint to be reachable in every environment, tested with the Stripe CLI locally.
- Duplicate or out-of-order events must be handled. Idempotency keys and stored event IDs cover this.
- The 15-minute pending hold (DESIGN.md section 4) releases slots if no webhook arrives.
