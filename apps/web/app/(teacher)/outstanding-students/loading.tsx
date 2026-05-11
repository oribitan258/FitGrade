export default function OutstandingStudentsLoading(): React.JSX.Element {
  return (
    <div className="space-y-6">
      <div className="h-9 w-52 animate-pulse rounded bg-muted" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map((n) => (
          <div key={n} className="h-28 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
    </div>
  );
}
