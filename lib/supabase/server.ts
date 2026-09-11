/**
 * Server Supabase clients.
 *
 * Two distinct clients, deliberately separated:
 *
 *   createServerClient()  — acts as the signed-in user, bound to their cookies,
 *                           constrained by row-level security. Use this for
 *                           almost everything.
 *
 *   createAdminClient()   — uses the service-role key and BYPASSES row-level
 *                           security entirely. Use only where there is no user
 *                           to act as: retention cleanup, migrations, scheduled
 *                           jobs. Every call site must establish authorization
 *                           itself, because the database will not.
 */
import { createServerClient as createSSRClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

import { clientEnv, serverEnv } from "@/lib/env";

/** Request-scoped client acting as the signed-in user. RLS applies. */
export async function createServerClient() {
  const cookieStore = await cookies();
  const env = clientEnv();

  return createSSRClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component, where cookies are read-only.
          // Session refresh is handled by middleware; ignoring this is correct.
        }
      },
    },
  });
}

/**
 * Service-role client. Bypasses RLS — there is no user context and no policy
 * enforcement. Never expose the result of a query made with this client without
 * checking ownership in application code first.
 */
export function createAdminClient() {
  const env = clientEnv();
  const secrets = serverEnv();

  return createSupabaseClient(env.NEXT_PUBLIC_SUPABASE_URL, secrets.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
