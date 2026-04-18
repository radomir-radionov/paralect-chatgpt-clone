do $$
declare
  target_table regclass;
begin
  target_table := to_regclass('public.user_profiles');
  if target_table is null then
    target_table := to_regclass('public.user_profile');
  end if;

  if target_table is null then
    raise exception 'Neither public.user_profiles nor public.user_profile exists';
  end if;

  execute format(
    'alter table %s alter column image_url drop not null',
    target_table
  );

  execute format(
    'update %s set image_url = null where btrim(image_url) = ''''',
    target_table
  );
end;
$$;

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
    nullif(
      coalesce(
        new.raw_user_meta_data ->> 'avatar_url',
        new.raw_user_meta_data ->> 'picture',
        ''
      ),
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
