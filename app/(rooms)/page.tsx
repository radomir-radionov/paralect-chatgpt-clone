import { GuestChat } from "@domains/chat/components/GuestChat";
import { NewRoomComposer } from "@domains/chat/components/NewRoomComposer";
import { getMe } from "@domains/auth/api/getMe";

export default async function RoomsIndexPage() {
  const user = await getMe();

  if (user == null) {
    return <GuestChat />;
  }

  return <NewRoomComposer />;
}
