/* Create a user profile row when a new auth user is created. */

create or replace function public.handle_new_auth_user_create_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_table regclass;
  profile_name text;
  profile_image_url text;
begin
  /*
    Prefer `public.user_profiles` (plural) if present, but also support an
    existing `public.user_profile` (singular) table (seen in generated types).
  */
  target_table := to_regclass('public.user_profiles');
  if target_table is null then
    target_table := to_regclass('public.user_profile');
  end if;

  if target_table is null then
    raise exception 'Neither public.user_profiles nor public.user_profile exists';
  end if;

  profile_name :=
    coalesce(
      new.raw_user_meta_data ->> 'name',
      new.raw_user_meta_data ->> 'full_name',
      new.email,
      ''
    );

  profile_image_url :=
    coalesce(
      new.raw_user_meta_data ->> 'avatar_url',
      new.raw_user_meta_data ->> 'picture',
      ''
    );

  execute format(
    'insert into %s (id, name, image_url) values ($1, $2, $3) on conflict (id) do nothing',
    target_table
  )
  using new.id, profile_name, profile_image_url;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_create_profile on auth.users;

create trigger on_auth_user_created_create_profile
after insert on auth.users
for each row
execute function public.handle_new_auth_user_create_profile();

