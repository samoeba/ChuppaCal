# Approved implementation plan — September 27, 2026

Approved: **5, 7, 8, 9, 10, 11, 12**. On hold: **1, 2, 3, 4, 6**.

No new parent/PIN model, private-token/photo migration, invitation redesign or archival/deletion-history redesign is included. Existing earned stars and redemption history must remain intact.

**Implementation status:** steps 1 and 3–6 have local code/migrations and automated verification. The user authorized live application of migrations 005–009 to disposable test data without a backup; they were applied and structurally verified on September 27. Matching app code was directly deployed to Vercel on September 27, but is not committed/pushed and physical/browser production acceptance in step 8 remains open. HEY/voice in step 7 need a provider/credential/product decision. See [release gate](release-2026-09-27.md) for live evidence and remaining work.

## Sequence

1. Prepare and test forward migrations on an isolated local PostgreSQL instance: transactional chore claims/redemptions, family consistency, targeted settings updates, atomic template/onboarding/default-list writes and feature metadata.
2. Verify live migration state and obtain/test a restorable backup before applying approved migrations. The API service key cannot perform arbitrary SQL; dashboard sign-in or a database connection is required. **Execution note:** the user later authorized applying 005–009 to disposable test data without this backup; see the release record.
3. Update the application to use database transactions and an explicit family timezone (default America/Chicago, pending user preference).
4. Reconcile Google calendar windows transactionally, add calendar selection, reconnect/sync health, and bounded worker behavior.
5. Build phone-friendly agenda/meals, accessible controls and a Today dashboard. Preserve the existing Robuck Rounded/National Park typography and beige/cream/ink surfaces with family colors.
6. Add meal recipe links and explicit meal-to-grocery transfer, family-scoped live invalidation with polling fallback, opt-in read-only offline view, and kiosk sleep/screensaver controls.
7. External CalDAV/voice integrations require service choice and credentials. Do not silently grant third parties access, incur paid API usage or store new secrets in the held-off credential model.
8. Verify lint/types/unit and database regressions, build and browser layouts; record actual deployment/access/hardware limitations.

## UI direction

The existing identity takes precedence over generic skill suggestions: ink `#1C1A14`, beige `#F3EFE0`, cream `#FAF6E8`, sky `#2668FD`, clover `#00B351`, sun `#FDCB40`. Display: Robuck Rounded; body: National Park; utilities: Geist Mono. Today uses a large kitchen-clock/date anchor beside the next event, followed by dinner and each child's remaining expectations. On a phone this becomes one readable column, not a shrunken time grid. Family color and name/avatar identify ownership together. Motion respects reduced-motion preferences.

## Operational limits

- Production deployment was later explicitly requested and completed directly from this checkout. No push or commit has occurred.
- Changing live schema is approved by item 7, contingent on verified targets, backup and a compatible release plan.
- Physical Pi testing cannot be claimed from browser/jsdom results.
