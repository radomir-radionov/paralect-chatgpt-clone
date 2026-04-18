/* Backfill user_profile rows for any auth users created before the trigger existed. */

insert into public.user_profile (id, name, image_url)
select
  u.id,
  coalesce(
    u.raw_user_meta_data ->> 'name',
    u.raw_user_meta_data ->> 'full_name',
    u.email,
    ''
  ) as name,
  nullif(
    coalesce(
      u.raw_user_meta_data ->> 'avatar_url',
      u.raw_user_meta_data ->> 'picture',
      ''
    ),
    ''
  ) as image_url
from auth.users u
on conflict (id) do nothing;
