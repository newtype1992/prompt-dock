# Prompt Dock Context

Prompt Dock is a browser extension for people and teams who repeatedly reuse AI prompts across multiple AI tools. The product is being built now, not just evaluated. This document defines the business and product context that should guide implementation decisions.

## Build Decision

We are proceeding with the MVP build.

The core bet is that prompt reuse becomes materially more valuable when it is:

- available directly inside the AI tools people already use
- fast enough to beat copy and paste from notes or docs
- organized well enough for repeated personal use
- shareable enough for team standardization

## Problem

People who use AI heavily often save good prompts in scattered places such as notes apps, documents, chat history, or internal wikis. That creates recurring friction:

- finding the right prompt takes too long
- prompt quality becomes inconsistent across people and tools
- teams cannot reliably distribute and enforce reusable prompt patterns
- good prompts become tribal knowledge instead of reusable operating assets

## Jobs To Be Done

- Individual user: "When I am working across AI tools repeatedly, I want to reuse proven prompts instantly so I can move faster and get more consistent outputs."
- Team lead: "When my team relies on AI for repeatable work, I want everyone to use approved prompts so output quality and workflow consistency improve."

## Initial Wedge

The first product wedge is AI-heavy professional teams, especially GTM, sales, marketing, support, and operations teams that already use ChatGPT, Claude, Gemini, or Perplexity in repeatable workflows.

The product can still serve solo users, but the business upside comes from a clear upgrade path:

- free local-only individual use
- paid individual sync
- paid team libraries with shared access and roles

## Product Thesis

Prompt Dock should win by combining four things in one extension-first workflow:

1. personal prompt storage
2. fast search and retrieval
3. one-click insertion into supported AI tools
4. shared team libraries for standardization

If Prompt Dock feels like another heavy knowledge base instead of a faster execution tool, it loses.

## MVP Scope

The MVP we are building includes:

- Chromium browser extension as the main product surface
- support for ChatGPT, Claude, Gemini, and Perplexity
- personal prompt library
- folders, tags, and search
- prompt create, edit, duplicate, and delete flows
- direct injection into supported AI sites
- clipboard fallback for every injection flow
- Supabase auth and cloud sync for paid plans
- team libraries with roles
- email invite flows
- Stripe billing
- important account and team emails through Resend

## Roles

- Free user
  - local-only prompts in extension storage
  - no required cloud account
- Paid individual
  - authenticated account
  - personal cloud sync
- Team owner
  - team billing
  - invite management
  - shared library ownership
- Team admin
  - team prompt and folder management
- Team member
  - shared library usage within granted permissions

## Scope Rules

- The extension is the product. A hosted web layer exists only to support the extension.
- Free mode must work without forcing a cloud account.
- Paid features must unlock clear value, not cosmetic differences.
- Team functionality should stay focused on shared libraries, roles, and invites.
- Search, storage, and insertion speed matter more than broad feature count.

## Billing Direction

Billing is part of the MVP because the pricing model changes product behavior:

- Free plan: local storage only
- Paid individual plan: auth and cloud sync
- Team plan: shared libraries, roles, invites, and centralized billing

Stripe should be used only for the subscription and billing flows needed to support those tiers.

## Out Of Scope

The first build should not include:

- CRM integrations
- analytics dashboards
- prompt performance scoring
- native mobile apps
- non-Chromium browser support
- prompt marketplace or public template gallery
- AI conversation capture or transcript storage
- advanced approvals and enterprise workflow layers

## Risks

- Injection reliability risk: supported AI sites can change their DOM frequently.
- Behavior risk: many users may still default to notes and copy and paste.
- Installation risk: browser extensions have real adoption friction.
- Upgrade clarity risk: users need a clear reason to move from free local-only use to paid sync or team plans.
- Sync risk: local-first behavior plus cloud sync introduces merge and conflict edge cases.

## Success Criteria

The MVP is succeeding if it proves these behaviors:

- users save and reuse prompts frequently enough for the extension to become a habit
- direct injection is reliable enough that users trust it
- a meaningful share of active free users upgrade for sync or team functionality
- team owners invite other users and shared libraries become part of real workflows

## Decision Filter

When choosing what to build next, prefer the feature that most directly improves one of these outcomes:

- faster prompt retrieval
- more reliable prompt insertion
- better multi-device continuity for paid users
- clearer team standardization for paid teams

If a proposed feature does not clearly improve one of those outcomes, it is probably not MVP scope.
