import { redirect } from "next/navigation";
import type { Route } from "next";

import { LoginForm } from "./login-form";
import { createServerClient } from "@/lib/supabase/server";

export const metadata = { title: "Sign in — Resume Intelligence" };

interface Props {
  searchParams: Promise<{ next?: string; error?: string }>;
}

export default async function LoginPage({ searchParams }: Props) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Already signed in — send them where they were going.
  if (user) {
    const { next } = await searchParams;
    redirect((next?.startsWith("/") ? next : "/dashboard") as Route);
  }

  const { error } = await searchParams;

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6 py-16">
      <div className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
        <p className="mt-2 text-sm text-(--color-ink-muted)">
          Enter your email and we&rsquo;ll send you a sign-in link. No password needed.
        </p>
      </div>

      {error === "auth_failed" && (
        <p className="mt-4 rounded-md bg-(--color-bad)/10 px-4 py-3 text-center text-sm text-(--color-bad)">
          That link has expired or already been used. Request a new one below.
        </p>
      )}

      <div className="mt-8">
        <LoginForm />
      </div>

      <p className="mt-8 text-center text-xs text-(--color-ink-muted)">
        Your resume is stored privately and only visible to you.
      </p>
    </main>
  );
}
