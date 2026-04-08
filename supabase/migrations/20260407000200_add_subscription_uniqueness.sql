create unique index if not exists uq_individual_subscriptions_profile
  on public.subscriptions(scope, profile_id)
  where scope = 'individual' and profile_id is not null;

create unique index if not exists uq_team_subscriptions_team
  on public.subscriptions(scope, team_id)
  where scope = 'team' and team_id is not null;

