import Link from "next/link";
import { FileText } from "lucide-react";

import { createServerClient } from "@/lib/supabase/server";
import { UserMenu } from "./user-menu";

export async function Navbar() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <header className="sticky top-0 z-40 border-b border-(--color-line) bg-(--color-surface-raised)/80 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-(--color-accent) text-white">
            <FileText size={14} />
          </div>
          <span className="hidden sm:block">Resume Intelligence</span>
          <span className="sm:hidden">RI</span>
        </Link>

        {/* Nav */}
        {user && (
          <nav className="flex items-center gap-1 text-sm">
            <Link
              href="/dashboard"
              className="rounded-md px-3 py-1.5 text-(--color-ink-muted) transition-colors hover:bg-(--color-surface-subtle) hover:text-(--color-ink)"
            >
              History
            </Link>
            <Link
              href="/analyze/upload"
              className="rounded-md px-3 py-1.5 text-(--color-ink-muted) transition-colors hover:bg-(--color-surface-subtle) hover:text-(--color-ink)"
            >
              Upload
            </Link>
          </nav>
        )}

        {/* Right side */}
        <div className="ml-auto flex items-center gap-3">
          {user ? (
            <UserMenu email={user.email ?? ""} />
          ) : (
            <Link
              href="/auth/login"
              className="rounded-lg bg-(--color-accent) px-3.5 py-1.5 text-sm font-medium text-white hover:opacity-90"
            >
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
