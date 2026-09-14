/**
 * Next.js middleware — session refresh and route protection.
 *
 * Runs on every request that matches the config below. Two jobs:
 *
 *   1. Refresh the Supabase session cookie so it does not expire mid-visit.
 *      Without this, a user who stays on a page longer than the token TTL gets
 *      silently signed out on the next navigation.
 *
 *   2. Redirect unauthenticated users away from protected routes. The protected
 *      set is intentionally narrow: /dashboard and /analyze (not /results, which
 *      has its own server-component auth check per the spec's anonymous-user
 *      consideration).
 *
 * IMPORTANT: cookies() is readable but not writable in middleware unless we use
 * the response object. The pattern below is the one Supabase SSR documents for
 * Next.js — any deviation breaks cookie refresh silently.
 */
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PROTECTED_PREFIXES = ["/analyze", "/dashboard"];

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // Refresh the session — must await to ensure cookies are written before
  // the redirect decision, otherwise the redirect races the cookie write.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isProtected = PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));

  if (isProtected && !user) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/auth/login";
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match everything except:
     *   - _next/static  (static files)
     *   - _next/image   (image optimisation)
     *   - favicon.ico
     *   - public files with a known extension
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
