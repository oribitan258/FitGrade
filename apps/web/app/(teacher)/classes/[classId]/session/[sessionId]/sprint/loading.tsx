export default function SprintLoading(): React.JSX.Element {
  return (
    <div className="space-y-6">
      <div className="h-9 w-44 animate-pulse rounded bg-muted" />
      <div className="h-28 animate-pulse rounded-xl bg-muted" />
      <div className="space-y-2">
        {[1, 2, 3, 4, 5, 6].map((n) => (
          <div key={n} className="h-14 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
    </div>
  );
}
