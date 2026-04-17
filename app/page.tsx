import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@shared/lib/supabase/server";
import { ChatLayout } from "@domains/chat/components/ChatLayout";

export default async function HomePage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    redirect("/login");
  }

  return <ChatLayout user={{ id: user.id, email: user.email }} />;
}
