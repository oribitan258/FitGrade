export default function ScheduleLoading(): React.JSX.Element {
  return (
    <div className="space-y-4">
      <div className="h-9 w-36 animate-pulse rounded bg-muted" />
      <div className="grid grid-cols-5 gap-2">
        {Array.from({ length: 25 }).map((_, i) => (
          <div key={i} className="h-20 animate-pulse rounded-md bg-muted" />
        ))}
      </div>
    </div>
  );
}
