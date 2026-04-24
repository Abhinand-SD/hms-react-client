import { useAuth } from '../lib/auth';
import { Button } from '../components/Button';
import { RoleBadge } from '../components/Badge';
import hospitalLogo from '../assets/hospital_logo.png';

export default function Dashboard() {
  const { user, logout } = useAuth();

  async function onLogout() {
    await logout();
    window.location.href = '/login';
  }

  return (
    <div className="min-h-full">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-3">
            <img src={hospitalLogo} alt="HMS logo" className="h-8 w-8 rounded-lg object-cover" />
            <div className="text-sm font-semibold text-slate-900">HMS</div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-xs font-medium text-slate-800">{user?.fullName}</div>
              <div className="text-[11px] text-slate-500">{user?.role} · {user?.employeeId}</div>
            </div>
            <Button variant="secondary" size="sm" onClick={onLogout}>Sign out</Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-16">
        <div className="rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-slate-900">Welcome, {user?.fullName?.split(' ')[0]}</h1>
            {user?.role && <RoleBadge role={user.role} />}
          </div>
          <p className="mt-3 text-sm text-slate-600">
            Your workspace is being prepared. Modules for your role will appear here as they come online.
          </p>
          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {['Appointments', 'Patients', 'Billing'].map((m) => (
              <div
                key={m}
                className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-center"
              >
                <div className="text-sm font-medium text-slate-700">{m}</div>
                <div className="mt-1 text-[11px] uppercase tracking-wide text-slate-400">Coming soon</div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
