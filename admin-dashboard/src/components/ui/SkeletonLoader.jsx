export default function SkeletonLoader({ rows = 4 }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="animate-pulse rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-slate-700" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-2/3 rounded-full bg-slate-700" />
              <div className="h-3 w-1/2 rounded-full bg-slate-800" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
