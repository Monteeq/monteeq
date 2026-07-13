export default function EmptyState({ title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-slate-900/60 px-6 py-12 text-center">
      <div className="mb-4 rounded-full border border-white/10 bg-white/5 p-3 text-slate-300">
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.7">
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 19V5a2 2 0 0 1 2-2h6l4 4v12a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2Z" />
        </svg>
      </div>
      <h3 className="text-lg font-semibold text-white">{title}</h3>
      <p className="mt-2 max-w-md text-sm text-slate-400">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
