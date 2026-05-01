import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AppShell } from '../../components/AppShell';
import { extractError } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { getReceptionistDashboard } from '../../api/dashboard.api';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtINR(n) {
  return `₹${Number(n ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('en-IN', {
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
}

function patientName(p) {
  if (!p) return '—';
  return `${p.firstName}${p.lastName ? ` ${p.lastName}` : ''}`;
}

const STATUS_PILL = {
  PENDING:   'bg-amber-50 text-amber-700 ring-amber-200',
  PARTIAL:   'bg-blue-50 text-blue-700 ring-blue-200',
  PAID:      'bg-emerald-50 text-emerald-700 ring-emerald-200',
  CANCELLED: 'bg-slate-100 text-slate-500 ring-slate-200',
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ReceptionistDashboard() {
  const { user } = useAuth();
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr]         = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setErr('');
    try {
      const { data: payload } = await getReceptionistDashboard();
      setData(payload.data);
    } catch (e) {
      setErr(extractError(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const recent = data?.recentBilledVisits ?? [];

  return (
    <AppShell>
      <div className="flex flex-1 flex-col overflow-hidden bg-slate-100">
        {/* ── Header ── */}
        <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 backdrop-blur-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-3.5">
            <div>
              <h1 className="text-lg font-bold text-slate-900">
                Welcome, {user?.fullName?.split(' ')[0] ?? 'there'}
              </h1>
              <p className="mt-0.5 text-xs text-slate-500">
                Reception desk · {new Date().toLocaleDateString('en-IN', {
                  weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
                })}
              </p>
            </div>
            <button
              type="button"
              onClick={load}
              disabled={loading}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              {loading ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>
        </header>

        {/* ── Body ── */}
        <main className="flex-1 overflow-y-auto p-5 space-y-5">
          {err && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              {err}
            </div>
          )}

          {/* Middle: Quick actions */}
          <section>
            <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-widest text-slate-500">
              Quick Actions
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <QuickActionCard
                to="/appointments"
                title="Book / Walk-In"
                description="Quick Book or register a walk-in patient with OP number."
                accent="bg-blue-600 hover:bg-blue-700"
                icon={<UserPlusIcon />}
              />
              <QuickActionCard
                to="/queue"
                title="View Live Queue"
                description="See who's waiting and consultation status."
                accent="bg-teal-600 hover:bg-teal-700"
                icon={<QueueIcon />}
              />
            </div>
          </section>

          {/* Bottom: Recent activity */}
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <h2 className="text-sm font-semibold text-slate-900">Recent Activity</h2>
              <span className="text-[11px] text-slate-400">Last 5 invoices you processed</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead className="bg-slate-50">
                  <tr>
                    {['Time', 'Patient', 'OP #', 'Doctor', 'Type', 'Amount', 'Status'].map((c) => (
                      <th key={c} className="border-b border-slate-100 px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading && recent.length === 0 ? (
                    <tr><td colSpan={7} className="px-4 py-6 text-center text-sm text-slate-400">Loading…</td></tr>
                  ) : recent.length === 0 ? (
                    <tr><td colSpan={7} className="px-4 py-6 text-center text-sm text-slate-400">No recent invoices yet.</td></tr>
                  ) : (
                    recent.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50">
                        <td className="px-4 py-2 text-xs text-slate-500 tabular-nums">{fmtTime(r.createdAt)}</td>
                        <td className="px-4 py-2">
                          <div className="text-sm font-medium text-slate-800">{patientName(r.patient)}</div>
                          <div className="font-mono text-[11px] text-slate-400">{r.patient?.uhid}</div>
                        </td>
                        <td className="px-4 py-2 font-mono text-xs text-blue-700">{r.opNumber ?? '—'}</td>
                        <td className="px-4 py-2 text-sm text-slate-600">{r.doctorName ?? '—'}</td>
                        <td className="px-4 py-2 text-xs text-slate-500">{r.invoiceType}</td>
                        <td className="px-4 py-2 text-sm font-semibold text-slate-800 tabular-nums">{fmtINR(r.netAmount)}</td>
                        <td className="px-4 py-2">
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${STATUS_PILL[r.paymentStatus] ?? 'bg-slate-100 text-slate-500 ring-slate-200'}`}>
                            {r.paymentStatus}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </main>
      </div>

    </AppShell>
  );
}

// ─── Quick action card ───────────────────────────────────────────────────────

function QuickActionCard({ to, title, description, accent, icon }) {
  return (
    <Link
      to={to}
      className={`group flex items-center gap-4 rounded-2xl ${accent} p-5 text-white shadow-sm transition`}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/15">
        {icon}
      </div>
      <div className="flex-1">
        <div className="text-base font-semibold">{title}</div>
        <div className="text-xs text-white/80">{description}</div>
      </div>
      <div className="opacity-70 transition group-hover:translate-x-0.5 group-hover:opacity-100">
        <ChevronIcon />
      </div>
    </Link>
  );
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function UserPlusIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20c0-3.5 3-6 6.5-6s6.5 2.5 6.5 6" />
      <path d="M18 8v6M15 11h6" strokeLinecap="round" />
    </svg>
  );
}

function QueueIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="4" cy="6"  r="1.5" fill="currentColor" stroke="none" />
      <circle cx="4" cy="12" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="4" cy="18" r="1.5" fill="currentColor" stroke="none" />
      <path d="M8 6h13M8 12h10M8 18h7" strokeLinecap="round" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
