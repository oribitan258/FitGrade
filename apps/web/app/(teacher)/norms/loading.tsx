export default function NormsLoading(): React.JSX.Element {
  return (
    <div className="space-y-6">
      <div className="h-9 w-44 animate-pulse rounded bg-muted" />
      <div className="flex gap-2">
        {[1, 2, 3, 4].map((n) => (
          <div key={n} className="h-9 w-24 animate-pulse rounded-full bg-muted" />
        ))}
      </div>
      <div className="space-y-2">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
          <div key={n} className="h-12 animate-pulse rounded-md bg-muted" />
        ))}
      </div>
    </div>
  );
}
