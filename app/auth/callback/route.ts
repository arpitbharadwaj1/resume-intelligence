/**
 * Supabase auth callback — exchanges the one-time code for a session.
 *
 * When a user clicks a magic link, Supabase redirects to this URL with a
 * `code` query parameter. We exchange it for a session (writing the session
 * cookies), then redirect the user to wherever they were trying to go.
 *
 * The `next` param is validated to be a relative path — an absolute URL here
 * would be an open redirect vulnerability.
 */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { createServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const rawNext = searchParams.get("next") ?? "/analyze/upload";

  // Validate next is a relative path to prevent open redirect.
  const next = rawNext.startsWith("/") ? rawNext : "/dashboard";

  if (code) {
    const supabase = await createServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Code missing or exchange failed — redirect to login with an error flag.
  return NextResponse.redirect(`${origin}/auth/login?error=auth_failed`);
}
