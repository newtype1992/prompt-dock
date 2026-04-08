# Prompt Dock Sprint 02 Plan

Date: 2026-04-07

## Sprint Goal

Turn personal cloud sync into a paid capability instead of an ungated authenticated feature.

This sprint should leave the repo in a state where:

- Stripe subscription events persist into Supabase
- personal cloud sync unlocks only for active individual subscriptions
- the extension clearly shows when a signed-in account is still in local-only mode because billing is inactive
- the next two workstreams are lined up behind billing: team workflows, then reliability hardening

## Workstreams

### PD-201: Stripe Subscription Ingestion

Status: In progress

Scope:

- replace the Stripe webhook stub with verified event handling
- persist subscription status, price, customer, and renewal timing to Supabase
- support the event types needed for the MVP billing model

Acceptance criteria:

- webhook signatures are verified with `STRIPE_WEBHOOK_SECRET`
- `checkout.session.completed` can persist the linked subscription when checkout metadata identifies the billing target
- `customer.subscription.created`, `customer.subscription.updated`, and `customer.subscription.deleted` upsert the matching row in `subscriptions`
- invalid or unsupported webhook events return safe non-crashing responses

### PD-202: Enforce Paid Personal Sync

Status: In progress

Scope:

- gate personal library access on an active individual subscription
- keep free and unpaid signed-in users fully functional in local mode
- prevent prompt and folder mutations from writing to cloud when the plan is inactive

Acceptance criteria:

- authenticated users without an active individual subscription stay in local mode
- authenticated users with an active individual subscription can load and mutate the personal cloud library
- plan enforcement is backed by Supabase access rules rather than only by client UI state
- fallback notices explain why cloud sync is unavailable

### PD-203: Surface Billing State In The Extension

Status: In progress

Scope:

- show the signed-in user whether their individual plan is active or inactive
- distinguish local fallback caused by billing from local fallback caused by sync failure
- keep the account page useful before checkout and billing-portal flows are added

Acceptance criteria:

- the account page shows the current billing status for signed-in users
- the refresh action re-checks billing state as well as sync state
- inactive billing states keep messaging explicit that local mode is intentional

## Next Queue

1. PD-301: Team creation, invite acceptance, and shared library switching
2. PD-401: Adapter hardening plus integration coverage for ChatGPT, Claude, Gemini, and Perplexity

## Definition Of Done

The sprint is done when a developer can:

1. receive a Stripe subscription webhook and see the matching Supabase subscription row update
2. sign in through the extension with no active plan and remain in local-only mode
3. activate an individual subscription and see the same account switch into cloud-sync mode
4. verify lint, tests, the Next build, and the extension build all pass

