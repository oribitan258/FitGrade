export default function LiveSessionLoading(): React.JSX.Element {
  return (
    <div className="flex flex-col items-center gap-6">
      <div className="h-24 w-64 animate-pulse rounded-xl bg-muted" />
      <div className="w-full space-y-2">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
          <div key={n} className="h-16 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
    </div>
  );
}
