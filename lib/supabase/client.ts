/**
 * Browser Supabase client.
 *
 * Uses the anon key and is subject to row-level security. It can only ever see
 * what the signed-in user's RLS policies permit — which is why RLS is the real
 * authorization boundary, not this file.
 */
import { createBrowserClient } from "@supabase/ssr";

import { clientEnv } from "@/lib/env";

export function createClient() {
  const env = clientEnv();
  return createBrowserClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}
