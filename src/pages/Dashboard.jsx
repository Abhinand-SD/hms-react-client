import { useAuth } from '../lib/auth';
import { RoleBadge } from '../components/Badge';
import { AppShell } from '../components/AppShell';

export default function Dashboard() {
  const { user } = useAuth();

  return (
    <AppShell>
      <main className="flex-1 px-8 py-10">
        <div className="max-w-2xl">
          <div className="rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold text-slate-900">
                Welcome, {user?.fullName?.split(' ')[0]}
              </h1>
              {user?.role && <RoleBadge role={user.role} />}
            </div>
            <p className="mt-3 text-sm text-slate-600">
              Use the sidebar to navigate. Appointments, Patients, and Billing are coming in the next phase.
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
        </div>
      </main>
    </AppShell>
  );
}
