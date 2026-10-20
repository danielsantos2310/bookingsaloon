# Changelog

All notable changes to this project are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Entries are added under **Unreleased** as work is merged. When a release is cut, move them under a new version heading with the date.

## [Unreleased]

### Added
- Project documentation: README, ARCHITECTURE, DESIGN, CHANGELOG, CONTRIBUTING.
- Architecture decision records 0001 to 0005 and their index in `docs/adr/`.
- `.env.example` listing every planned environment variable, without secret values.
- `.nvmrc` pinning Node.js 20 and `.editorconfig` for consistent formatting.
- Pull request template with the review checklist.
- CI workflow for lint, type check and tests, and database tests. Each job runs only once its project files exist.
- Roadmap in README.md.
- `docs/salon-defaults.md`: starting values for business details, opening hours, services, staff, booking rules and reminders. All are editable in the admin area.

- `docs/brand.md`: three brand directions with palettes checked for WCAG contrast, typography and logo approach. Flags that the working name "Bellabooking" is close to an existing salon booking product and needs checking.
- `docs/screens.md`: the full list of 45 screens (customer, staff, owner, system) with contents, actions and milestone for each.

### Changed
- DESIGN.md: booking rules are now marked **Default** (editable) or **Fixed** (v1 rule). The "(assumed)" markers are removed, and open questions are reduced to the points that still need an answer before launch.
