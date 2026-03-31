# Prompt Dock

Prompt Dock is an extension-first SaaS for saving, organizing, and injecting reusable AI prompts into the tools people already use. The first build targets ChatGPT, Claude, Gemini, and Perplexity, with a Chromium browser extension as the primary product surface.

This repository is being used to build the production MVP. The docs in this repo define what we are building, the stack we are using, and the constraints the implementation should follow.

## Product Direction

- Extension first. The main user experience lives inside the browser extension.
- Fast reuse over heavy management. Prompt Dock should make saving, finding, and inserting prompts materially faster than copy and paste from docs or notes.
- Personal plus team workflows. Individual users need a clean personal library, while paid teams need shared libraries, roles, and invite flows.
- Reliable insertion. The extension should attempt direct DOM injection first and fall back to clipboard copy when a target site blocks or changes.
- Paid cloud features. Free users stay local-only. Paid users unlock authentication, sync, billing, and team features.

## MVP Scope

- Personal prompt library inside the extension
- Folders, tags, and search
- Create, edit, duplicate, and delete prompt flows
- Support for ChatGPT, Claude, Gemini, and Perplexity
- Direct prompt injection into supported AI inputs
- Clipboard fallback for every insertion flow
- Supabase auth and cloud sync for paid plans
- Shared team libraries with roles
- Team invite flows by email
- Stripe billing for paid plans
- Email invites and important account notifications

## Roles

- Free user: local-only personal library with no required cloud account
- Paid individual: authenticated user with cloud sync for personal prompts
- Team owner: manages billing, invites, and shared libraries
- Team admin: manages team folders and prompts
- Team member: uses shared team libraries and any granted permissions

## Pricing Model

- Free: local storage only
- Paid individual: authenticated account plus cloud sync
- Team: shared libraries, team roles, invites, and centralized billing

## Supported AI Surfaces For MVP

- ChatGPT
- Claude
- Gemini
- Perplexity

## Tech Stack

Prompt Dock will use the same core stack as Swift Slots, with only the pieces this product actually needs:

- Next.js 15 App Router
- React 19
- TypeScript
- Tailwind CSS v4
- shadcn/ui plus Radix primitives
- Supabase Postgres, Auth, Row Level Security, and migrations
- Stripe for subscriptions and billing state
- Resend for invites and key account emails
- Vercel for hosted deployment
- Supabase CLI for local backend development

Prompt Dock does not need unrelated tools from other projects. Mapbox, marketplace features, analytics tooling, CRM integrations, and other extras are out unless a concrete product requirement appears.

## Architecture Summary

Prompt Dock is not a dashboard-first SaaS. The extension is the product. A small hosted Next.js support app exists only for responsibilities that should not live inside the extension itself, such as:

- secure team operations
- auth-support flows
- Stripe checkout, billing portal, and webhooks
- invite acceptance pages
- Resend-triggered email delivery

## Planned Build Order

1. Scaffold the shared stack and extension workspace.
2. Build the free local-only personal library with folders, tags, search, and injection.
3. Add Supabase schema, RLS, paid auth, and cloud sync.
4. Add Stripe-gated paid plans and upgrade flow.
5. Add team libraries, roles, invites, and Resend email delivery.
6. Harden injection behavior for ChatGPT, Claude, Gemini, and Perplexity.

## Out Of Scope For The First Build

- CRM integrations
- usage analytics dashboards
- prompt performance scoring
- native mobile apps
- non-Chromium browser support
- prompt marketplace or community sharing
- AI conversation capture or storage
- advanced approval workflows

## Local Development Direction

The repository will follow the same local development model as Swift Slots:

- `npm install`
- `supabase start`
- `supabase db push`
- `npm run dev`

Those commands describe the intended development workflow once the codebase is scaffolded. Backend changes should remain migrations-first, and the extension should be developed against local Supabase services before anything is pushed to hosted infrastructure.

## Product Principle

Prompt Dock should win on speed and reliability, not on becoming another heavy prompt management dashboard. If a feature does not make prompt storage, search, sharing, or insertion materially faster, it should stay out of scope.
