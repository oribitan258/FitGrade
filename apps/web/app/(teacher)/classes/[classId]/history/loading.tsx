export default function HistoryLoading(): React.JSX.Element {
  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 pb-16 pt-6 sm:px-6 lg:px-8">
      <div className="h-8 w-56 animate-pulse rounded-lg bg-muted" />
      <div className="h-5 w-32 animate-pulse rounded bg-muted" />
      <div className="space-y-6">
        {[1, 2].map((g) => (
          <div key={g} className="space-y-2">
            <div className="h-4 w-28 animate-pulse rounded bg-muted" />
            <div className="overflow-hidden rounded-3xl border border-slate-100 bg-white/60">
              {[1, 2, 3].map((r) => (
                <div
                  key={r}
                  className="flex items-center gap-3 border-b border-slate-100/80 px-4 py-4 last:border-0"
                >
                  <div className="h-10 w-10 animate-pulse rounded-xl bg-muted" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-4 w-40 animate-pulse rounded bg-muted" />
                    <div className="h-3 w-24 animate-pulse rounded bg-muted" />
                  </div>
                  <div className="h-3 w-12 animate-pulse rounded bg-muted" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
