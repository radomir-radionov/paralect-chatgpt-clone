import { createSupabaseServerClient } from "./server";

type SupabaseServerClient = Awaited<
  ReturnType<typeof createSupabaseServerClient>
>;

export async function withSupabaseServerClient<T>(
  fn: (supabase: SupabaseServerClient) => Promise<T>,
): Promise<T> {
  const supabase = await createSupabaseServerClient();
  return fn(supabase);
}
