# Prompt Dock Architecture

This document defines the target architecture for the first production build of Prompt Dock. The product is extension-first, but it still requires a small hosted backend layer for sync, billing, invites, and other secure server-side responsibilities.

## System Overview

Prompt Dock has four core runtime pieces:

1. A Chromium browser extension
2. A minimal Next.js support app and server routes
3. Supabase for auth, database, and authorization
4. Stripe and Resend for billing and email workflows

The extension is the primary interface. The support app exists to back the extension, not to become a separate full dashboard product.

## 1. Browser Extension

The extension should use Manifest V3 and include these main parts:

- Popup UI built with React, TypeScript, Tailwind, and shared product components
- Content scripts for ChatGPT, Claude, Gemini, and Perplexity
- A background service worker for message routing, auth handoff, sync coordination, and upgrade flows
- Local extension storage for free-tier data and fast cached reads

### Extension Responsibilities

- Show personal and team prompt libraries
- Manage folders, tags, search, and prompt CRUD
- Attempt direct DOM injection into supported AI interfaces
- Fall back to clipboard copy when direct injection fails
- Cache authenticated data locally for fast reads
- Surface upgrade, invite, and account actions without forcing users into a full web dashboard

### Injection Strategy

Prompt insertion should use a layered strategy:

1. Detect the active supported site
2. Use a site-specific adapter to locate the input element
3. Insert the prompt text and dispatch the events needed for the page to recognize the change
4. If the adapter fails, copy the prompt to the clipboard and show a clear fallback state

Each supported surface should have its own isolated adapter logic so breakage on one site does not affect the others.

## 2. Next.js Support App

Prompt Dock will reuse the Swift Slots web stack, but only for the pieces this product needs. The hosted Next.js app should remain thin.

### Support App Responsibilities

- Provide secure server-side endpoints for team creation, invites, and role-sensitive writes
- Create Stripe checkout sessions and billing portal sessions
- Process Stripe webhooks and persist subscription state
- Handle invite acceptance pages and related auth-support flows
- Trigger Resend emails for invites and important account notifications

### What The Support App Should Not Become

- not the primary user experience
- not a full prompt management dashboard by default
- not a place for product features that belong inside the extension

If a future requirement genuinely needs a web surface, it should be added deliberately rather than assumed.

## 3. Supabase Backend

Supabase is the system of record for authenticated users, paid features, teams, and synced prompt data.

### Core Responsibilities

- Auth for paid individual and team accounts
- Postgres persistence
- Row Level Security for personal and team data
- migrations-first schema management
- server-enforced permissions through route handlers where client writes should not be trusted

### Planned Data Model

The first build should stay close to the smallest model that supports the required product scope:

- `profiles`
  - one row per authenticated user
  - stores core account metadata and plan state references
- `teams`
  - shared workspace record for paid teams
- `team_memberships`
  - links users to teams with roles such as `owner`, `admin`, and `member`
- `team_invites`
  - pending invite records and acceptance state
- `libraries`
  - personal or team-scoped prompt libraries
- `folders`
  - folder structure within a library
- `prompts`
  - prompt records with title, body, description, tags, folder reference, and library reference
- `subscriptions`
  - Stripe-linked subscription state needed for plan gating

The schema should stay simple. Tags can start as a text array on `prompts` unless a more complex tagging model is clearly required.

### Authorization Model

- Free local-only users do not need cloud records
- Paid individuals can access only their own personal library data
- Team owners and admins can manage team libraries according to role rules
- Team members can access only the team data granted by membership
- Sensitive billing and invite operations should use server-owned writes rather than trusting direct client access

## 4. Billing And Email Integrations

### Stripe

Stripe is in scope for the first build because plan gating is part of the product model.

Billing should support:

- free local-only usage
- paid individual upgrades for auth and cloud sync
- team subscriptions for shared libraries, roles, and invites
- webhook-driven subscription state updates

### Resend

Resend is in scope for:

- team invite emails
- important account notifications tied to billing or membership changes

Avoid turning email into a large notification platform. Keep it limited to the flows needed for the MVP.

## Data Flow

### Free Local Mode

1. User installs the extension
2. Prompts, folders, tags, and search state live only in extension storage
3. Injection works without any account requirement
4. Upgrade entry points are available inside the extension

### Paid Auth And Sync

1. User upgrades or signs in to a paid account
2. The extension authenticates with Supabase
3. Personal library data syncs to Supabase and remains cached locally for responsiveness
4. The extension reads from local cache first and syncs changes in the background

### Team Libraries

1. A team owner or admin creates a team and invites users by email
2. A secure server flow stores the invite and sends email via Resend
3. The invited user accepts and joins the team through an authenticated flow
4. Team libraries appear inside the extension based on membership and role

### Prompt Injection

1. User opens the extension on a supported AI site
2. User selects a prompt
3. The extension attempts site-specific direct injection
4. If direct injection fails, the prompt is copied to the clipboard as a fallback

## Security And Privacy

- All synced data must be protected by Row Level Security
- Service role keys must never be exposed to the extension
- The extension should store only the tokens and cached data it actually needs
- Prompt Dock should not capture or store AI conversation content
- Site adapter logic should be isolated and reviewed carefully because DOM changes are a reliability risk
- Plan enforcement must not rely only on client-side checks

## Deployment

The intended production deployment model matches Swift Slots where it makes sense:

- Vercel for the Next.js support app
- hosted Supabase for auth and database
- Stripe for billing
- Resend for email
- Chrome Web Store for extension distribution

## Local Development

Local development should use:

- Next.js for the hosted support app
- Supabase CLI for database and auth
- local migrations for schema work
- extension development against local backend services

The product should be tested against all four supported AI surfaces as early as possible because injection reliability is one of the highest product risks.
