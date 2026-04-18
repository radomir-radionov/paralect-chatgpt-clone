import { cache } from "react";

import { createSupabaseServerClient } from "./server";

export const getCurrentUser = cache(async () => {
  const supabase = await createSupabaseServerClient();
  return (await supabase.auth.getUser()).data.user;
});
