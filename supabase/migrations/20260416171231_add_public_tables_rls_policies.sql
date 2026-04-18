-- chat_room_member: users can see memberships for rooms they belong to
create policy "Authenticated users can view memberships in their rooms"
on public.chat_room_member
for select
to authenticated
using (
  member_id = (select auth.uid())
);

-- message: room members can read messages in their rooms
create policy "Authenticated room members can read messages"
on public.message
for select
to authenticated
using (
  chat_room_id in (
    select chat_room_id
    from public.chat_room_member
    where member_id = (select auth.uid())
  )
);

-- chat_room: authenticated room members can view their rooms
create policy "Authenticated room members can view their rooms"
on public.chat_room
for select
to authenticated
using (
  id in (
    select chat_room_id
    from public.chat_room_member
    where member_id = (select auth.uid())
  )
);

-- user_profile: authenticated users can view any profile
create policy "Authenticated users can view profiles"
on public.user_profile
for select
to authenticated
using ( true );
