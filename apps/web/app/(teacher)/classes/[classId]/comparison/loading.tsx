export default function ComparisonLoading(): React.JSX.Element {
  return (
    <div className="space-y-6">
      <div className="h-9 w-52 animate-pulse rounded bg-muted" />
      <div className="grid grid-cols-2 gap-4">
        {[1, 2].map((n) => (
          <div key={n} className="h-48 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
      <div className="h-64 animate-pulse rounded-lg bg-muted" />
    </div>
  );
}
