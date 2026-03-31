# Agent Instructions - Prompt Dock

This repository is intended to be built primarily with Codex and the Codex CLI. Before making changes, read `CONTEXT.md` and `ARCHITECTURE.md`.

## Development Rules

1. Keep the product extension-first. Do not drift into building a separate full dashboard unless the product docs are updated to require it.
2. Preserve the Swift Slots core stack by default: Next.js 15, React 19, TypeScript, Tailwind v4, shadcn/ui, Radix, Supabase, Stripe, and Resend.
3. Do not add tools or vendors that are not clearly needed. Mapbox, analytics tooling, CRM integrations, and other extras are out unless a documented requirement appears.
4. Migrations first. Never change the database schema manually. All schema changes must go through Supabase migrations.
5. Keep free versus paid behavior explicit. Free users are local-only. Paid features include auth, cloud sync, billing state, and team capabilities.
6. Model personal and team data cleanly. Shared team libraries, invites, and role-based access are core requirements for this project.
7. Treat site-specific injection as a first-class engineering concern. ChatGPT, Claude, Gemini, and Perplexity should use isolated adapters so failures stay contained.
8. Prefer direct injection with clipboard fallback, not one or the other.
9. Use Stripe only for the billing flows the MVP needs. Use Resend only for invites and important account notifications.
10. Explain architecture changes when they alter core product behavior, supported surfaces, schema shape, or billing and auth flows.
11. Prefer simple solutions. Avoid speculative abstractions, heavy infrastructure, or features that do not directly improve prompt storage, search, sharing, or insertion.
12. Validate backend work locally with Supabase and verify extension behavior on supported AI surfaces whenever practical.

## Workflow

Use a lightweight workflow by default:

1. Work directly in the current branch when that is the fastest path.
2. Keep commits focused and readable.
3. Use branches or pull requests only when they add real value.

## Safety Rules

- Never delete existing migrations.
- Never expose service role keys, Stripe secrets, Resend secrets, or `.env` contents.
- Do not assume production credentials.
- Do not move paid-only logic entirely into client-side checks.
- Do not remove supported AI surfaces from the docs or code without explicitly updating the product scope.

## Task Priorities

Suggested implementation order:

1. Repo scaffold and shared stack
   - establish the Next.js support app, extension workspace, and shared UI foundation
2. Free local-only prompt library
   - personal prompts
   - folders, tags, search
   - direct injection plus clipboard fallback
3. Paid auth and sync
   - Supabase schema
   - RLS
   - authenticated personal sync
4. Billing
   - Stripe checkout
   - subscription state
   - plan gating
5. Teams
   - shared libraries
   - roles
   - invites
   - Resend email delivery
6. Reliability hardening
   - supported-site adapter maintenance
   - fallback handling
   - sync edge cases

## Required Output After Each Task

After completing a task, respond with:

1. Summary of the work completed.
2. Files modified.
3. Manual setup steps still required.
4. Suggested next step.
