import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AppShell } from '../../components/AppShell';
import { extractError } from '../../lib/api';
import { getAdminDashboard } from '../../api/dashboard.api';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtINR(n) {
  return `₹${Number(n ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Group payment-mode codes for the chart bands.
const CASH_CODES    = new Set(['CASH']);
const CARD_CODES    = new Set(['CARD', 'POS']);
const UPI_CODES     = new Set(['UPI']);
function bucketise(breakdown) {
  let cash = 0, card = 0, upi = 0, other = 0;
  for (const m of breakdown ?? []) {
    const code = String(m.code).toUpperCase();
    if (CASH_CODES.has(code))      cash  += Number(m.total);
    else if (CARD_CODES.has(code)) card  += Number(m.total);
    else if (UPI_CODES.has(code))  upi   += Number(m.total);
    else                            other += Number(m.total);
  }
  return { cash, card, upi, other };
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminDashboard() {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr]         = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setErr('');
    try {
      const { data: payload } = await getAdminDashboard();
      setData(payload.data);
    } catch (e) {
      setErr(extractError(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const totals = data?.totals ?? {
    totalRevenue: 0, cashTotal: 0, digitalTotal: 0,
    patientsVisitedToday: 0, activeDoctors: 0,
  };

  const buckets = useMemo(() => bucketise(data?.revenueBreakdown), [data]);
  const totalForChart = buckets.cash + buckets.card + buckets.upi + buckets.other;

  return (
    <AppShell>
      <div className="flex flex-1 flex-col overflow-hidden bg-slate-100">
        {/* ── Header ── */}
        <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 backdrop-blur-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-3.5">
            <div>
              <h1 className="text-lg font-bold text-slate-900">Admin Dashboard</h1>
              <p className="mt-0.5 text-xs text-slate-500">
                Today's overview · {new Date().toLocaleDateString('en-IN', {
                  weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
                })}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Link
                to="/reports"
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Open Reports
              </Link>
              <button
                type="button"
                onClick={load}
                disabled={loading}
                className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:bg-slate-400"
              >
                {loading ? 'Refreshing…' : 'Refresh'}
              </button>
            </div>
          </div>
        </header>

        {/* ── Body ── */}
        <main className="flex-1 overflow-y-auto p-5 space-y-5">
          {err && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              {err}
            </div>
          )}

          {/* Top KPIs */}
          <section className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <KPI label="Today's Revenue" value={fmtINR(totals.totalRevenue)} accent="slate" sub={`Cash ${fmtINR(totals.cashTotal)} · Digital ${fmtINR(totals.digitalTotal)}`} />
            <KPI label="Patients Today"  value={totals.patientsVisitedToday} accent="blue" sub="OPD visits today" />
            <KPI label="Active Doctors"  value={totals.activeDoctors}        accent="emerald" sub="Currently active" />
          </section>

          {/* Revenue breakdown chart */}
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Revenue Breakdown — Today</h2>
                <p className="text-xs text-slate-500">By payment mode</p>
              </div>
              <div className="text-right">
                <div className="text-[10px] uppercase tracking-wide text-slate-400">Total</div>
                <div className="text-lg font-bold text-slate-900 tabular-nums">{fmtINR(totalForChart)}</div>
              </div>
            </div>

            {totalForChart === 0 ? (
              <div className="flex h-24 items-center justify-center text-sm text-slate-400">
                No collections recorded today yet.
              </div>
            ) : (
              <>
                {/* Stacked bar */}
                <div className="flex h-3 w-full overflow-hidden rounded-full bg-slate-100">
                  <Band value={buckets.cash}  total={totalForChart} cls="bg-emerald-500" />
                  <Band value={buckets.card}  total={totalForChart} cls="bg-blue-500" />
                  <Band value={buckets.upi}   total={totalForChart} cls="bg-violet-500" />
                  <Band value={buckets.other} total={totalForChart} cls="bg-slate-400" />
                </div>

                {/* Legend / breakdown */}
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <Legend cls="bg-emerald-500" label="Cash"   value={buckets.cash}  total={totalForChart} />
                  <Legend cls="bg-blue-500"    label="Card"   value={buckets.card}  total={totalForChart} />
                  <Legend cls="bg-violet-500"  label="UPI"    value={buckets.upi}   total={totalForChart} />
                  <Legend cls="bg-slate-400"   label="Other"  value={buckets.other} total={totalForChart} />
                </div>
              </>
            )}
          </section>

        </main>
      </div>
    </AppShell>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const KPI_ACCENTS = {
  slate:   'border-slate-200   bg-white       text-slate-900',
  blue:    'border-blue-200    bg-blue-50     text-blue-900',
  emerald: 'border-emerald-200 bg-emerald-50  text-emerald-900',
  amber:   'border-amber-200   bg-amber-50    text-amber-900',
};

function KPI({ label, value, sub, accent = 'slate' }) {
  return (
    <div className={`rounded-2xl border p-4 shadow-sm ${KPI_ACCENTS[accent]}`}>
      <div className="text-[11px] font-semibold uppercase tracking-wider opacity-70">{label}</div>
      <div className="mt-1 text-2xl font-bold tabular-nums">{value}</div>
      {sub && <div className="mt-0.5 text-[11px] opacity-70">{sub}</div>}
    </div>
  );
}

function Band({ value, total, cls }) {
  if (!value || !total) return null;
  const pct = (value / total) * 100;
  return <div className={cls} style={{ width: `${pct}%` }} title={fmtINR(value)} />;
}

function Legend({ cls, label, value, total }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="flex items-start gap-2">
      <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${cls}`} />
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</div>
        <div className="text-sm font-semibold text-slate-800 tabular-nums">{fmtINR(value)}</div>
        <div className="text-[10px] text-slate-400">{pct}%</div>
      </div>
    </div>
  );
}
