-- Run once in the Supabase SQL Editor.
-- Supabase links identities that share an email (this cannot be disabled in settings).
-- This trigger makes the database refuse it: a user may only ever have ONE sign-in provider
-- ('email' or 'google'), so Google can't attach to a password account and vice versa.

create or replace function public.block_cross_provider_identity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1
    from auth.identities i
    where i.user_id = new.user_id
      and i.provider <> new.provider
  ) then
    raise exception 'This email is already registered with a different sign-in method.'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists block_cross_provider_identity on auth.identities;
create trigger block_cross_provider_identity
  before insert on auth.identities
  for each row execute function public.block_cross_provider_identity();
