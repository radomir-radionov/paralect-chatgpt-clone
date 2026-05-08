import { createSupabaseAuthServerClient } from "./server";

type SupabaseAuthServerClient = Awaited<
  ReturnType<typeof createSupabaseAuthServerClient>
>;

export async function withSupabaseAuthServerClient<T>(
  fn: (supabase: SupabaseAuthServerClient) => Promise<T>,
): Promise<T> {
  const supabase = await createSupabaseAuthServerClient();
  return fn(supabase);
}
