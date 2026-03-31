create extension if not exists pgcrypto;

create type public.team_role as enum ('owner', 'admin', 'member');
create type public.library_scope as enum ('personal', 'team');
create type public.subscription_scope as enum ('individual', 'team');
create type public.subscription_plan as enum ('individual', 'team');
create type public.subscription_status as enum (
  'trialing',
  'active',
  'past_due',
  'canceled',
  'incomplete',
  'incomplete_expired',
  'unpaid'
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) > 0),
  slug text not null unique check (char_length(btrim(slug)) > 2),
  created_by_user_id uuid not null references public.profiles(id) on delete restrict,
  stripe_customer_id text unique,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.team_memberships (
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.team_role not null,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (team_id, user_id)
);

create table public.team_invites (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  email text not null,
  role public.team_role not null,
  token text not null unique,
  invited_by_user_id uuid references public.profiles(id) on delete set null,
  accepted_at timestamptz,
  expires_at timestamptz not null default timezone('utc', now()) + interval '7 days',
  created_at timestamptz not null default timezone('utc', now())
);

create table public.libraries (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) > 0),
  scope public.library_scope not null,
  owner_user_id uuid references public.profiles(id) on delete cascade,
  team_id uuid references public.teams(id) on delete cascade,
  created_by_user_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint libraries_scope_check check (
    (scope = 'personal' and owner_user_id is not null and team_id is null) or
    (scope = 'team' and owner_user_id is null and team_id is not null)
  )
);

create table public.folders (
  id uuid primary key default gen_random_uuid(),
  library_id uuid not null references public.libraries(id) on delete cascade,
  name text not null check (char_length(btrim(name)) > 0),
  position integer not null default 0,
  created_by_user_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.prompts (
  id uuid primary key default gen_random_uuid(),
  library_id uuid not null references public.libraries(id) on delete cascade,
  folder_id uuid references public.folders(id) on delete set null,
  title text not null check (char_length(btrim(title)) > 0),
  description text not null default '',
  body text not null check (char_length(btrim(body)) > 0),
  tags text[] not null default '{}',
  position integer not null default 0,
  created_by_user_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  scope public.subscription_scope not null,
  plan_key public.subscription_plan not null,
  profile_id uuid references public.profiles(id) on delete cascade,
  team_id uuid references public.teams(id) on delete cascade,
  stripe_customer_id text,
  stripe_subscription_id text unique,
  stripe_price_id text,
  status public.subscription_status not null default 'incomplete',
  current_period_end timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint subscriptions_scope_check check (
    (scope = 'individual' and profile_id is not null and team_id is null and plan_key = 'individual') or
    (scope = 'team' and profile_id is null and team_id is not null and plan_key = 'team')
  )
);

create index idx_team_memberships_user_id on public.team_memberships(user_id);
create index idx_team_invites_team_id on public.team_invites(team_id);
create index idx_libraries_owner_user_id on public.libraries(owner_user_id);
create index idx_libraries_team_id on public.libraries(team_id);
create index idx_folders_library_id on public.folders(library_id);
create index idx_prompts_library_id on public.prompts(library_id);
create index idx_prompts_folder_id on public.prompts(folder_id);
create index idx_prompts_tags on public.prompts using gin(tags);
create index idx_subscriptions_profile_id on public.subscriptions(profile_id);
create index idx_subscriptions_team_id on public.subscriptions(team_id);

create unique index uq_personal_library_names
  on public.libraries(owner_user_id, lower(name))
  where owner_user_id is not null;

create unique index uq_team_library_names
  on public.libraries(team_id, lower(name))
  where team_id is not null;

create unique index uq_open_team_invite_email
  on public.team_invites(team_id, lower(email))
  where accepted_at is null;

create or replace function public.is_team_member(target_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.team_memberships team_membership
    where team_membership.team_id = target_team_id
      and team_membership.user_id = auth.uid()
  );
$$;

create or replace function public.is_team_admin(target_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.team_memberships team_membership
    where team_membership.team_id = target_team_id
      and team_membership.user_id = auth.uid()
      and team_membership.role in ('owner', 'admin')
  );
$$;

create or replace function public.can_access_library(target_library_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.libraries library
    where library.id = target_library_id
      and (
        (library.scope = 'personal' and library.owner_user_id = auth.uid()) or
        (library.scope = 'team' and public.is_team_member(library.team_id))
      )
  );
$$;

create or replace function public.can_manage_library(target_library_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.libraries library
    where library.id = target_library_id
      and (
        (library.scope = 'personal' and library.owner_user_id = auth.uid()) or
        (library.scope = 'team' and public.is_team_admin(library.team_id))
      )
  );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  personal_library_name text := 'My prompts';
begin
  insert into public.profiles (id, email)
  values (new.id, coalesce(new.email, ''));

  insert into public.libraries (name, scope, owner_user_id, created_by_user_id)
  values (personal_library_name, 'personal', new.id, new.id);

  return new;
end;
$$;

create or replace function public.handle_new_team()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.team_memberships (team_id, user_id, role)
  values (new.id, new.created_by_user_id, 'owner')
  on conflict (team_id, user_id) do nothing;

  return new;
end;
$$;

create trigger set_profiles_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

create trigger set_teams_updated_at
before update on public.teams
for each row
execute function public.set_updated_at();

create trigger set_libraries_updated_at
before update on public.libraries
for each row
execute function public.set_updated_at();

create trigger set_folders_updated_at
before update on public.folders
for each row
execute function public.set_updated_at();

create trigger set_prompts_updated_at
before update on public.prompts
for each row
execute function public.set_updated_at();

create trigger set_subscriptions_updated_at
before update on public.subscriptions
for each row
execute function public.set_updated_at();

create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();

create trigger on_team_created
after insert on public.teams
for each row
execute function public.handle_new_team();

alter table public.profiles enable row level security;
alter table public.teams enable row level security;
alter table public.team_memberships enable row level security;
alter table public.team_invites enable row level security;
alter table public.libraries enable row level security;
alter table public.folders enable row level security;
alter table public.prompts enable row level security;
alter table public.subscriptions enable row level security;

create policy "profiles_select_own"
  on public.profiles
  for select
  to authenticated
  using (auth.uid() = id);

create policy "profiles_update_own"
  on public.profiles
  for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "teams_select_members"
  on public.teams
  for select
  to authenticated
  using (public.is_team_member(id));

create policy "teams_insert_own"
  on public.teams
  for insert
  to authenticated
  with check (auth.uid() = created_by_user_id);

create policy "teams_update_admins"
  on public.teams
  for update
  to authenticated
  using (public.is_team_admin(id))
  with check (public.is_team_admin(id));

create policy "team_memberships_select_members"
  on public.team_memberships
  for select
  to authenticated
  using (user_id = auth.uid() or public.is_team_member(team_id));

create policy "team_invites_select_admins"
  on public.team_invites
  for select
  to authenticated
  using (public.is_team_admin(team_id));

create policy "team_invites_insert_admins"
  on public.team_invites
  for insert
  to authenticated
  with check (public.is_team_admin(team_id) and invited_by_user_id = auth.uid());

create policy "team_invites_update_admins"
  on public.team_invites
  for update
  to authenticated
  using (public.is_team_admin(team_id))
  with check (public.is_team_admin(team_id));

create policy "libraries_select_members"
  on public.libraries
  for select
  to authenticated
  using (public.can_access_library(id));

create policy "libraries_insert_managers"
  on public.libraries
  for insert
  to authenticated
  with check (
    created_by_user_id = auth.uid() and (
      (scope = 'personal' and owner_user_id = auth.uid() and team_id is null) or
      (scope = 'team' and owner_user_id is null and team_id is not null and public.is_team_admin(team_id))
    )
  );

create policy "libraries_update_managers"
  on public.libraries
  for update
  to authenticated
  using (public.can_manage_library(id))
  with check (public.can_manage_library(id));

create policy "libraries_delete_managers"
  on public.libraries
  for delete
  to authenticated
  using (public.can_manage_library(id));

create policy "folders_select_members"
  on public.folders
  for select
  to authenticated
  using (public.can_access_library(library_id));

create policy "folders_insert_managers"
  on public.folders
  for insert
  to authenticated
  with check (public.can_manage_library(library_id));

create policy "folders_update_managers"
  on public.folders
  for update
  to authenticated
  using (public.can_manage_library(library_id))
  with check (public.can_manage_library(library_id));

create policy "folders_delete_managers"
  on public.folders
  for delete
  to authenticated
  using (public.can_manage_library(library_id));

create policy "prompts_select_members"
  on public.prompts
  for select
  to authenticated
  using (public.can_access_library(library_id));

create policy "prompts_insert_managers"
  on public.prompts
  for insert
  to authenticated
  with check (public.can_manage_library(library_id) and created_by_user_id = auth.uid());

create policy "prompts_update_managers"
  on public.prompts
  for update
  to authenticated
  using (public.can_manage_library(library_id))
  with check (public.can_manage_library(library_id));

create policy "prompts_delete_managers"
  on public.prompts
  for delete
  to authenticated
  using (public.can_manage_library(library_id));

create policy "subscriptions_select_authorized"
  on public.subscriptions
  for select
  to authenticated
  using (
    (scope = 'individual' and profile_id = auth.uid()) or
    (scope = 'team' and public.is_team_admin(team_id))
  );
