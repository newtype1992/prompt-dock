# Prompt Dock Next Sprint Plan

Date: 2026-04-05

## Sprint Goal

Ship the first authenticated personal sync slice for Prompt Dock without expanding into billing or team workflows yet.

This sprint should turn the current local-only extension into a product that can:

- authenticate an individual user
- keep using the existing local library for free mode
- load a personal cloud library for authenticated mode
- sync prompt and folder changes to Supabase while preserving a local cache

## Non-Goals

- Stripe checkout, billing portal, or paid plan enforcement
- team creation, team libraries, invites, or Resend flows
- advanced conflict resolution beyond a simple cache refresh model
- broad redesign of the hosted support app

## Tickets

### PD-101: Align Supported Surface Coverage

Status: Planned

Scope:

- align extension manifest host permissions with the supported site definitions
- make local and hosted Supabase origins reachable from the extension runtime
- remove obvious support-surface drift between detection and actual injection coverage

Acceptance criteria:

- the extension manifest covers every supported AI hostname defined in code
- the extension can reach local Supabase and hosted Supabase origins
- no supported hostname is listed in site detection without corresponding manifest coverage

### PD-102: Add Extension Cloud Runtime Foundations

Status: Planned

Scope:

- expose Supabase public env vars to the extension build
- add a browser-safe Supabase client for the popup runtime
- add shared auth and sync state types for extension usage

Acceptance criteria:

- the extension can read Supabase config from the existing env model
- the popup can initialize a Supabase client without breaking local-only mode
- missing env vars degrade gracefully instead of crashing the popup

### PD-103: Add Popup Account Authentication

Status: Planned

Scope:

- add sign up, sign in, and sign out flows in the popup
- surface current account status and cloud-sync availability
- keep free local mode usable when the user is signed out

Acceptance criteria:

- a user can create or sign in to an account from the popup
- a signed-in user sees their account state in the extension
- a signed-out user returns to the local-only library flow

### PD-104: Add Personal Cloud Library Sync

Status: Planned

Scope:

- load the authenticated user's personal library from Supabase
- seed an empty personal cloud library from the existing local library on first sync
- sync prompt and folder CRUD to Supabase for authenticated users
- keep a local cache of the cloud library for fast popup reads

Acceptance criteria:

- authenticated users load their personal prompts and folders from Supabase
- if the remote library is empty, the existing local library is imported once
- create, update, duplicate, and delete prompt flows persist to Supabase
- folder creation persists to Supabase
- local cache is refreshed after remote mutations

### PD-105: Add Validation And Sprint Documentation

Status: Planned

Scope:

- add tests for the new cloud-sync mapping and config behavior
- document the new auth and sync setup requirements
- verify web and extension production builds still pass

Acceptance criteria:

- automated coverage exists for core sync/config helpers
- README and env guidance reflect the new extension sync capability
- lint, tests, Next.js build, and extension build all pass

## Implementation Order

1. PD-101: align manifest and runtime coverage first
2. PD-102: land extension Supabase foundations
3. PD-103: add popup auth state and account actions
4. PD-104: connect popup CRUD to personal cloud sync
5. PD-105: tighten docs, tests, and verification

## Definition Of Done

The sprint is done when a developer can:

1. start local Supabase and the app
2. sign up or sign in from the extension popup
3. see the personal library switch from local-only mode to cloud-backed mode
4. create or edit prompts and folders and have those changes persist through a popup reload
5. sign out and keep using the local-only library without losing the free local dataset
