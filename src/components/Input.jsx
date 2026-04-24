export function Field({ label, error, hint, children }) {
  return (
    <label className="block">
      {label && <span className="mb-1 block text-xs font-medium text-slate-700">{label}</span>}
      {children}
      {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
      {!error && hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  );
}

export function Input({ className = '', ...rest }) {
  return (
    <input
      {...rest}
      className={`block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500 disabled:bg-slate-50 ${className}`}
    />
  );
}

export function Select({ className = '', children, ...rest }) {
  return (
    <select
      {...rest}
      className={`block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500 disabled:bg-slate-50 ${className}`}
    >
      {children}
    </select>
  );
}
