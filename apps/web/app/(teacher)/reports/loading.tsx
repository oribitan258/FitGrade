export default function ReportsLoading(): React.JSX.Element {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="h-9 w-40 animate-pulse rounded bg-muted" />
        <div className="h-10 w-32 animate-pulse rounded-md bg-muted" />
      </div>
      <div className="h-12 animate-pulse rounded-lg bg-muted" />
      <div className="space-y-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <div key={n} className="h-14 animate-pulse rounded-md bg-muted" />
        ))}
      </div>
    </div>
  );
}
