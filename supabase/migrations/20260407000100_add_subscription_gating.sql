alter type public.subscription_status add value if not exists 'paused';

create or replace function public.has_active_individual_subscription(target_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.subscriptions subscription
    where subscription.scope = 'individual'
      and subscription.profile_id = target_profile_id
      and subscription.status in ('trialing', 'active')
  );
$$;

create or replace function public.has_active_team_subscription(target_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.subscriptions subscription
    where subscription.scope = 'team'
      and subscription.team_id = target_team_id
      and subscription.status in ('trialing', 'active')
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
        (
          library.scope = 'personal'
          and library.owner_user_id = auth.uid()
          and public.has_active_individual_subscription(library.owner_user_id)
        ) or (
          library.scope = 'team'
          and public.is_team_member(library.team_id)
          and public.has_active_team_subscription(library.team_id)
        )
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
        (
          library.scope = 'personal'
          and library.owner_user_id = auth.uid()
          and public.has_active_individual_subscription(library.owner_user_id)
        ) or (
          library.scope = 'team'
          and public.is_team_admin(library.team_id)
          and public.has_active_team_subscription(library.team_id)
        )
      )
  );
$$;
