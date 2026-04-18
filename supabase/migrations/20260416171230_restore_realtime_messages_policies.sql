alter table realtime.messages enable row level security;

create policy "Authenticated room members can receive broadcasts and presence"
on realtime.messages
for select
to authenticated
using (
  topic like 'room:%:messages'
  and split_part(topic, ':', 2) in (
    select chat_room_id::text
    from public.chat_room_member
    where member_id = (select auth.uid())
  )
);

create policy "Authenticated room members can publish broadcasts and presence"
on realtime.messages
for insert
to authenticated
with check (
  topic like 'room:%:messages'
  and split_part(topic, ':', 2) in (
    select chat_room_id::text
    from public.chat_room_member
    where member_id = (select auth.uid())
  )
);
