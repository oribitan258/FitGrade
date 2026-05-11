export default function TeamBuilderLoading(): React.JSX.Element {
  return (
    <div className="space-y-6">
      <div className="h-9 w-44 animate-pulse rounded bg-muted" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[1, 2, 3, 4].map((n) => (
          <div key={n} className="h-56 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
    </div>
  );
}
