insert into public.libraries (name, scope, team_id, created_by_user_id)
select 'Shared prompts', 'team', team.id, team.created_by_user_id
from public.teams team
where not exists (
  select 1
  from public.libraries library
  where library.team_id = team.id
    and library.scope = 'team'
);

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

  insert into public.libraries (name, scope, team_id, created_by_user_id)
  values ('Shared prompts', 'team', new.id, new.created_by_user_id)
  on conflict do nothing;

  return new;
end;
$$;
