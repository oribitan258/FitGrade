export default function ExemptionsLoading(): React.JSX.Element {
  return (
    <div className="space-y-6">
      <div className="h-9 w-44 animate-pulse rounded bg-muted" />
      <div className="h-12 animate-pulse rounded-lg bg-muted" />
      <div className="space-y-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <div key={n} className="h-14 animate-pulse rounded-md bg-muted" />
        ))}
      </div>
    </div>
  );
}
