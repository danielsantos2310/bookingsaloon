# Salon Booking

An online booking system for a single beauty salon. Customers book services in a few taps, staff manage their own schedules, and the owner manages services, staff and reports.

**Status:** Planning. Documentation only, no code yet.

## Who uses it

| Role | What they do |
|---|---|
| Customer | Browses services, books a time slot, pays optionally, receives reminders, reschedules or cancels |
| Staff | Views their day, manages their working hours and time off, marks bookings as completed or no-show |
| Owner (admin) | Manages services, prices, staff, opening hours, and views reports |

## Scope

**v1 includes:** service catalogue, staff schedules, online booking with time slots, optional full payment at booking, email and SMS reminders, cancellation and rescheduling, admin area for owner and staff.

**v1 excludes:** multiple locations, deposits, loyalty schemes, stock management, point-of-sale, gift vouchers, multi-language UI.

**Expected load:** about 100 bookings per week, one salon.

## Documentation

- [ARCHITECTURE.md](ARCHITECTURE.md): how the system is built and why
- [DESIGN.md](DESIGN.md): what the product does, booking rules, and terminology
- [docs/salon-defaults.md](docs/salon-defaults.md): starting values for the salon, all editable in admin
- [CHANGELOG.md](CHANGELOG.md): what changed in each release
- [CONTRIBUTING.md](CONTRIBUTING.md): how work is done in this repo
- [docs/adr/](docs/adr/): architecture decision records

## Stack (planned)

- **Frontend and server:** Next.js with TypeScript
- **Backend:** Supabase (Postgres, authentication, row-level security, scheduled jobs)
- **Payments:** Stripe
- **Email:** Resend
- **SMS:** Twilio
- **Hosting:** Vercel for the app, Supabase for data

See [ARCHITECTURE.md](ARCHITECTURE.md) for the reasoning behind these choices.

## Environments

| Environment | Purpose | Data |
|---|---|---|
| Local | Development on your machine | Local Supabase, seed data |
| Staging | Testing before release, shared with the salon for review | Separate Supabase project, fake data |
| Production | Live bookings | Real customer data |

Payment and messaging providers run in test mode in local and staging.

## Roadmap

| Milestone | Outcome |
|---|---|
| 0. Repository and documentation | Docs, ADRs, CI skeleton, environment template (this milestone) |
| 1. Project scaffold | Next.js and local Supabase running, CI green, first migration (services, staff, working hours) |
| 2. Availability and booking | Free-slot calculation, booking without payment, conflict tests |
| 3. Admin area | Owner and staff views: services, staff, hours, time off, bookings |
| 4. Online payment | Stripe Checkout for pay-now services, webhook handling |
| 5. Reminders | Email reminders, then SMS |
| 6. Salon review and launch | Staging walkthrough with the salon, data import, go-live |

## Getting started

Setup instructions will be added in Milestone 1. Expected prerequisites:

- Node.js 20 or later
- Docker (for local Supabase)
- Supabase CLI
- Stripe CLI (for webhook testing)

## Licence

Private. Not licensed for reuse.
