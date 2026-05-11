export default function SettingsLoading(): React.JSX.Element {
  return (
    <div className="space-y-6 max-w-2xl">
      <div className="h-9 w-36 animate-pulse rounded bg-muted" />
      {[1, 2, 3].map((n) => (
        <div key={n} className="space-y-3 rounded-lg border p-6">
          <div className="h-5 w-40 animate-pulse rounded bg-muted" />
          <div className="h-10 w-full animate-pulse rounded-md bg-muted" />
          <div className="h-10 w-full animate-pulse rounded-md bg-muted" />
        </div>
      ))}
    </div>
  );
}
