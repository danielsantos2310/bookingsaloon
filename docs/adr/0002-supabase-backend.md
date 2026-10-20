# 0002. Supabase as the backend

Date: 2026-10-20
Status: Proposed

## Context

The system needs a relational database, authentication for staff and the owner, row-level access rules, and scheduled jobs for reminders. It has one developer and a modest load. Running a custom API server, auth service and job runner would mean maintaining three pieces of infrastructure alone.

## Decision

Use Supabase for Postgres, authentication, row-level security, storage and scheduled jobs (`pg_cron` with Edge Functions). The Next.js app talks to Supabase directly from server code, and uses the browser client only where row-level security makes that safe.

## Alternatives considered

- **Custom Node API with Postgres (e.g. Prisma, Drizzle) and a separate auth provider.** Full control, but more to build, secure and operate.
- **Firebase.** Document database makes the exclusion constraint and relational reporting harder. Rejected.
- **PlanetScale or Neon with Auth.js.** Solid choices, but we would assemble auth, policies and jobs ourselves.

## Consequences

- Less infrastructure to run. Backups and point-in-time recovery depend on the Supabase plan.
- Business rules that matter most (no double booking, who can see what) live in the database, which is where they are most reliable.
- We are tied to Supabase's auth and job model. Moving away would be a significant migration, so keep application logic in `lib/` rather than in database functions where practical.
- Need to confirm the Supabase plan supports the required backups and `pg_cron` usage before launch.
