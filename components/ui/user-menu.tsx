"use client";

import { LogOut } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";

export function UserMenu({ email }: { email: string }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  const initials = email.slice(0, 2).toUpperCase();

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex h-8 w-8 items-center justify-center rounded-full bg-(--color-accent-subtle) text-sm font-semibold text-(--color-accent) hover:bg-(--color-accent)/15"
      >
        {initials}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-10 z-50 w-56 rounded-xl border border-(--color-line) bg-(--color-surface-raised) p-1 shadow-lg">
            <div className="flex items-center gap-2.5 px-3 py-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-(--color-accent-subtle) text-sm font-semibold text-(--color-accent)">
                {initials}
              </div>
              <p className="min-w-0 text-sm">
                <span className="block truncate font-medium">{email}</span>
              </p>
            </div>

            <div className="my-1 h-px bg-(--color-line)" />

            <button
              onClick={signOut}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-(--color-ink-muted) hover:bg-(--color-surface-subtle) hover:text-(--color-ink)"
            >
              <LogOut size={14} />
              Sign out
            </button>
          </div>
        </>
      )}
    </div>
  );
}
