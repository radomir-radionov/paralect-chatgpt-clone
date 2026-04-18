-- chat_room_member: members can remove themselves from a room
create policy "Members can leave a room"
on public.chat_room_member
for delete
to authenticated
using (
  member_id = (select auth.uid())
);
