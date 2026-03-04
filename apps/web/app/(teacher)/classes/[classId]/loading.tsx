export default function ClassDetailLoading(): React.JSX.Element {
  return (
    <div className="space-y-6">
      <div className="h-5 w-48 animate-pulse rounded bg-muted" />
      <div className="h-32 animate-pulse rounded-lg bg-muted" />
      <div className="space-y-2">
        {[1, 2, 3, 4].map((n) => (
          <div key={n} className="h-12 animate-pulse rounded bg-muted" />
        ))}
      </div>
    </div>
  );
}
