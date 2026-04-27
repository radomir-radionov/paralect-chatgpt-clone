import { GuestChat } from "@domains/chat/components/GuestChat";
import { NewRoomComposer } from "@domains/chat/components/NewRoomComposer";
import { getCurrentUser } from "@shared/lib/supabase/getCurrentUser";

export default async function RoomsIndexPage() {
  const user = await getCurrentUser();

  if (user == null) {
    return <GuestChat />;
  }

  return <NewRoomComposer />;
}
