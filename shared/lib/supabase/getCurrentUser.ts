import { cache } from "react";

import { createSupabaseAuthServerClient } from "./server";

export const getCurrentUser = cache(async () => {
  const supabase = await createSupabaseAuthServerClient();
  return (await supabase.auth.getUser()).data.user;
});
