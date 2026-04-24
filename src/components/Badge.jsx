const roleTone = {
  ADMIN: 'bg-purple-50 text-purple-700 ring-purple-200',
  DOCTOR: 'bg-blue-50 text-blue-700 ring-blue-200',
  RECEPTIONIST: 'bg-amber-50 text-amber-700 ring-amber-200',
};

const statusTone = {
  ACTIVE: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  INACTIVE: 'bg-slate-100 text-slate-600 ring-slate-200',
  LOCKED: 'bg-red-50 text-red-700 ring-red-200',
};

export function RoleBadge({ role }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${roleTone[role] || 'bg-slate-100 text-slate-700 ring-slate-200'}`}>
      {role}
    </span>
  );
}

export function StatusBadge({ status }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${statusTone[status] || 'bg-slate-100 text-slate-700 ring-slate-200'}`}>
      <span className={`mr-1 h-1.5 w-1.5 rounded-full ${status === 'ACTIVE' ? 'bg-emerald-500' : status === 'LOCKED' ? 'bg-red-500' : 'bg-slate-400'}`} />
      {status}
    </span>
  );
}
