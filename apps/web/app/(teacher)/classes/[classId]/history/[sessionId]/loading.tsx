export default function SessionDetailLoading(): React.JSX.Element {
  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 pb-16 pt-6 sm:px-6 lg:px-8">
      <div className="h-5 w-48 animate-pulse rounded bg-muted" />
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <div className="h-7 w-64 animate-pulse rounded bg-muted" />
          <div className="h-4 w-40 animate-pulse rounded bg-muted" />
        </div>
        <div className="h-10 w-32 animate-pulse rounded-lg bg-muted" />
      </div>
      <div className="overflow-hidden rounded-3xl border border-slate-100 bg-white/60">
        {[1, 2, 3, 4, 5].map((n) => (
          <div
            key={n}
            className="flex items-center gap-3 border-b border-slate-100/80 px-4 py-4 last:border-0"
          >
            <div className="h-9 w-9 animate-pulse rounded-full bg-muted" />
            <div className="flex-1">
              <div className="h-4 w-32 animate-pulse rounded bg-muted" />
            </div>
            <div className="h-8 w-16 animate-pulse rounded bg-muted" />
            <div className="h-8 w-20 animate-pulse rounded bg-muted" />
            <div className="h-8 w-8 animate-pulse rounded bg-muted" />
            <div className="h-8 w-8 animate-pulse rounded bg-muted" />
          </div>
        ))}
      </div>
    </div>
  );
}
