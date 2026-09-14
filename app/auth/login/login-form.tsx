"use client";

import { useState } from "react";

import { createClient } from "@/lib/supabase/client";

type State = "idle" | "loading" | "sent" | "error";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<State>("idle");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setState("loading");

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    setState(error ? "error" : "sent");
  }

  if (state === "sent") {
    return (
      <div className="rounded-lg border border-(--color-line) bg-(--color-surface-raised) p-5 text-center">
        <p className="font-medium">Check your email</p>
        <p className="mt-2 text-sm text-(--color-ink-muted)">
          We sent a sign-in link to <strong>{email}</strong>. Click it to continue.
        </p>
        <button
          onClick={() => setState("idle")}
          className="mt-4 text-xs text-(--color-accent) hover:underline"
        >
          Use a different email
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="email" className="block text-sm font-medium">
          Email address
        </label>
        <input
          id="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="mt-1.5 block w-full rounded-lg border border-(--color-line) bg-(--color-surface-raised) px-3.5 py-2.5 text-sm outline-none focus:border-(--color-accent) focus:ring-2 focus:ring-(--color-accent)/20"
        />
      </div>

      {state === "error" && (
        <p className="text-sm text-(--color-bad)">Something went wrong. Please try again.</p>
      )}

      <button
        type="submit"
        disabled={state === "loading"}
        className="w-full rounded-lg bg-(--color-accent) px-4 py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
      >
        {state === "loading" ? "Sending…" : "Send sign-in link"}
      </button>
    </form>
  );
}
