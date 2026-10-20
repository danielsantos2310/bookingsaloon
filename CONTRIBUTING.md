# Contributing

This is a solo project with AI assistance. The process is kept light, but it is written down so it stays consistent, and so anyone joining later (including future you) can pick it up quickly.

Read [README.md](README.md) for what the system is and [ARCHITECTURE.md](ARCHITECTURE.md) for how it is built before changing anything significant.

## 1. Principles

- **`main` is always deployable.** Staging deploys from it. Production deploys from it after staging passes.
- **Small, short-lived branches.** Aim to merge within a day or two. Split large work into several pull requests.
- **Docs move with code.** A change to behaviour, structure or a significant decision updates the relevant doc in the same pull request.
- **Decide once, record it.** Significant decisions get an ADR so they are not re-debated later.

## 2. Setup

Follow the setup section in [README.md](README.md). Once the project exists, `.env.example` lists every environment variable with a description. Never commit a real `.env` file.

## 3. Branches

Create a branch from an up-to-date `main`:

```
feat/<short-description>     new behaviour
fix/<short-description>      bug fix
docs/<short-description>     documentation only
chore/<short-description>    tooling, dependencies, housekeeping
db/<short-description>       schema or migration change
```

Use lowercase and hyphens. Example: `feat/staff-time-off`.

## 4. Commits

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<optional scope>): <short summary in the imperative>

<optional body explaining why>
```

Types: `feat`, `fix`, `docs`, `chore`, `refactor`, `test`, `db`.

Examples:

```
feat(booking): hold slot for 15 minutes during payment
fix(availability): respect buffer when computing free windows
db: add exclusion constraint against double booking
docs(design): clarify reschedule rules
```

Keep commits focused. A commit should build and pass tests on its own where practical.

## 5. Pull requests

Every change goes through a pull request, even when working alone. This gives a clean history, a place for the checklist, and a preview deployment to check.

Title follows the same format as a commit message. The description says what changed, why, and how it was tested.

### Pull request checklist

- [ ] CI passes (lint, type check, unit, database, end-to-end)
- [ ] Behaviour changes are reflected in DESIGN.md
- [ ] Structural changes are reflected in ARCHITECTURE.md
- [ ] Significant decisions have an ADR in `docs/adr/`
- [ ] User-visible changes are listed under Unreleased in CHANGELOG.md
- [ ] No secrets, personal data or real customer data in the diff, screenshots or test fixtures
- [ ] New database tables have row-level security policies
- [ ] Booking-related changes have a test covering the edge case (buffers, time zones, concurrency)
- [ ] Checked the preview deployment on a phone-sized screen

## 6. Code standards

- **TypeScript strict mode** on. No `any` without a comment explaining why.
- **ESLint and Prettier** run on save and in CI. Do not disable rules without a reason in the code.
- **Money** is integer pence. Never use floating point for prices.
- **Time** is stored in UTC. Convert to Europe/London only when displaying or accepting local input. Use a single helper for this, never ad hoc conversions.
- **Pure logic in `lib/`**, no database or network calls in availability and price calculations. This keeps them easy to test.
- **Business rules in the database** where they can be expressed there (constraints, row-level security). Application code must not be the only guard.
- **Errors** are typed. User-facing messages come from the copy in DESIGN.md, not from exception text.
- **Logging** never includes personal data. Use booking and event IDs.

## 7. Database migrations

- Migrations live in `supabase/migrations` and are generated with the Supabase CLI.
- **Forward only.** Never edit a migration that has been applied to staging or production. Write a new one to fix it.
- Each migration is small and does one thing.
- Destructive changes (dropping columns or tables) happen in two steps: stop using the column in code first, then remove it in a later release.
- Every migration is tested locally against seed data before the pull request is opened.
- Seed data contains no real personal information.

## 8. Testing

Run before pushing:

```
npm run lint
npm run typecheck
npm run test          # unit
npm run test:db       # pgTAP against local Supabase
npm run test:e2e      # Playwright, optional locally, required in CI
```

Coverage is not a target in itself. Priorities are:

1. Availability and booking conflicts
2. Payment webhook handling, including duplicate events
3. Time zone edge cases around the March and October clock changes
4. Row-level security rules
5. The main booking flow end to end

A bug fix includes a test that fails before the fix and passes after.

## 9. Definition of done

A change is done when:

- The checklist in section 5 is complete
- It works on the preview deployment
- It is merged to `main` with a squash commit
- Staging has been deployed and checked, including any migrations
- CHANGELOG.md is updated if it is user-visible

## 10. Releases

Versions follow Semantic Versioning:

- **MAJOR:** breaking changes for the salon or customers (rare, e.g. replacing the booking flow)
- **MINOR:** new features
- **PATCH:** fixes and small improvements

To release:

1. Move Unreleased entries in CHANGELOG.md under a new version and date.
2. Update the version in `package.json`.
3. Merge to `main`, then tag: `git tag -a vX.Y.Z -m "vX.Y.Z" && git push --tags`.
4. Deploy to production and run the smoke test below.

### Smoke test (after every production deploy)

- [ ] Booking page loads on a phone
- [ ] A test booking can be made and cancelled (use a staff test account, with payment in Stripe test mode on staging only)
- [ ] Admin login works
- [ ] A test reminder is sent to the test address
- [ ] Error tracking shows no new errors in the last 15 minutes

## 11. Architecture decision records

Use an ADR when a decision is hard to reverse, affects several parts of the system, or involves a trade-off you would want to remember.

1. Copy the template below to `docs/adr/NNNN-short-title.md`, using the next number.
2. Fill it in and set the status to `Proposed`.
3. Set it to `Accepted` when the change is merged.
4. If a decision is later replaced, do not delete the old ADR. Set its status to `Superseded by NNNN`.

```markdown
# NNNN. Title

Date: YYYY-MM-DD
Status: Proposed | Accepted | Superseded by NNNN

## Context
What problem are we solving, and what constraints apply?

## Decision
What we decided.

## Alternatives considered
What else we looked at, and why it was not chosen.

## Consequences
What becomes easier, what becomes harder, and what we need to watch.
```

## 12. Security

- Never commit secrets. Use environment variables. Production secrets are stored in Vercel and Supabase, not in the repository.
- Rotate any key that was exposed, even briefly.
- Dependencies are updated at least monthly. Security alerts from GitHub are handled within a week.
- Report a vulnerability privately to the repository owner. Do not open a public issue.
- Customer data is personal data under UK GDPR. Do not copy production data to local machines. Use the anonymised staging data.

## 13. Working with AI assistance

- Give the assistant the relevant doc sections (DESIGN.md for behaviour, ARCHITECTURE.md for structure) at the start of a task.
- Review every generated change as you would a colleague's pull request. Check it against the checklist.
- Do not paste real customer data into a conversation.
