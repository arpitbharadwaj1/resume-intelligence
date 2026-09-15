export default function ResultsLoading() {
  return (
    <div className="min-h-screen bg-(--color-surface)">
      <div className="border-b border-(--color-line) bg-(--color-surface-raised)">
        <div className="mx-auto max-w-6xl px-4 py-3">
          <div className="h-4 w-24 animate-pulse rounded bg-(--color-line)" />
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
          {/* Left column skeleton */}
          <div className="space-y-4">
            <div className="rounded-2xl border border-(--color-line) bg-(--color-surface-raised) p-6">
              <div className="mx-auto h-3 w-32 animate-pulse rounded bg-(--color-line)" />
              <div className="mx-auto mt-6 h-28 w-28 animate-pulse rounded-full bg-(--color-line)" />
              <div className="mx-auto mt-4 h-3 w-48 animate-pulse rounded bg-(--color-line)" />
            </div>
            <div className="rounded-2xl border border-(--color-line) bg-(--color-surface-raised) p-5">
              <div className="space-y-4">
                {Array.from({ length: 7 }).map((_, i) => (
                  <div key={i} className="space-y-1.5">
                    <div className="h-3 w-3/4 animate-pulse rounded bg-(--color-line)" />
                    <div className="h-2 w-full animate-pulse rounded-full bg-(--color-line)" />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right column skeleton */}
          <div className="space-y-4">
            <div className="rounded-2xl border border-(--color-line) bg-(--color-surface-raised) p-5">
              <div className="h-4 w-24 animate-pulse rounded bg-(--color-line)" />
              <div className="mt-4 space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-14 animate-pulse rounded-xl bg-(--color-line)" />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
