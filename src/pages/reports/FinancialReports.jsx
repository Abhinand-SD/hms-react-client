import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppShell } from '../../components/AppShell';
import { extractError, api } from '../../lib/api';
import { getCollectionsReport } from '../../api/reports.api';
import { formatDate } from '../../utils/dateUtils';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

function startOfMonthStr() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
    .toISOString()
    .split('T')[0];
}

function fmtINR(n) {
  return `₹${Number(n ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// All non-cash electronic modes — kept in sync with AdminDashboard bucketise()
const DIGITAL_CODES = new Set(['CARD', 'POS', 'ONLINE', 'UPI', 'NETBANKING', 'NEFT', 'RTGS', 'IMPS']);

function modeBucket(report, ...codes) {
  if (!report?.byPaymentMode) return 0;
  const set = new Set(codes.map((c) => c.toUpperCase()));
  return report.byPaymentMode
    .filter((m) => set.has(String(m.code).toUpperCase()))
    .reduce((s, m) => s + Number(m.total), 0);
}

// ─── CSV export ───────────────────────────────────────────────────────────────

function csvEscape(value) {
  const s = value == null ? '' : String(value);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function downloadCSV(filename, rows) {
  const csv = rows.map((r) => r.map(csvEscape).join(',')).join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function FinancialReports() {
  const [startDate, setStartDate] = useState(startOfMonthStr);
  const [endDate, setEndDate]     = useState(todayStr);
  const [userId, setUserId]       = useState('');
  const [users, setUsers]         = useState([]);
  const [report, setReport]       = useState(null);
  const [loading, setLoading]     = useState(false);
  const [err, setErr]             = useState('');

  // Load users list once for the filter
  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get('/users', { params: { pageSize: 100 } });
        setUsers(data.data.items ?? []);
      } catch (_e) {
        // not fatal — filter just won't be populated
      }
    })();
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setErr('');
    try {
      const params = { startDate, endDate };
      if (userId) params.userId = userId;
      const { data } = await getCollectionsReport(params);
      setReport(data.data);
    } catch (e) {
      setErr(extractError(e));
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, userId]);

  useEffect(() => { load(); }, [load]);

  const totals = report?.totals ?? { totalRevenue: 0, paymentCount: 0 };

  const cashTotal = useMemo(() => modeBucket(report, 'CASH'), [report]);

  const digitalTotal = useMemo(() => {
    if (!report?.byPaymentMode) return 0;
    return report.byPaymentMode
      .filter((m) => DIGITAL_CODES.has(String(m.code).toUpperCase()))
      .reduce((s, m) => s + Number(m.total), 0);
  }, [report]);

  const otherTotal = useMemo(() => {
    if (!report?.byPaymentMode) return 0;
    const known = new Set(['CASH', ...DIGITAL_CODES]);
    return report.byPaymentMode
      .filter((m) => !known.has(String(m.code).toUpperCase()))
      .reduce((s, m) => s + Number(m.total), 0);
  }, [report]);

  function exportPaymentModes() {
    const rows = [['Payment Mode', 'Code', 'Count', 'Total (₹)']];
    for (const r of report?.byPaymentMode ?? []) {
      rows.push([r.name, r.code, r.count, Number(r.total).toFixed(2)]);
    }
    downloadCSV(`collections-by-payment-mode_${startDate}_to_${endDate}.csv`, rows);
  }

  function exportDoctors() {
    const rows = [['Doctor', 'Consultation Count', 'Total (₹)']];
    for (const r of report?.byDoctor ?? []) {
      rows.push([r.doctorName, r.count, Number(r.total).toFixed(2)]);
    }
    downloadCSV(`collections-by-doctor_${startDate}_to_${endDate}.csv`, rows);
  }

  function exportInvoiceTypes() {
    const rows = [['Invoice Type', 'Count', 'Total (₹)']];
    for (const r of report?.byInvoiceType ?? []) {
      rows.push([r.invoiceType, r.count, Number(r.total).toFixed(2)]);
    }
    downloadCSV(`collections-by-type_${startDate}_to_${endDate}.csv`, rows);
  }

  function exportUsers() {
    const rows = [['User', 'Role', 'Count', 'Total (₹)']];
    for (const r of report?.byUser ?? []) {
      rows.push([r.fullName, r.role ?? '', r.count, Number(r.total).toFixed(2)]);
    }
    downloadCSV(`collections-by-user_${startDate}_to_${endDate}.csv`, rows);
  }

  return (
    <AppShell>
      <div className="flex flex-1 flex-col overflow-hidden bg-slate-100">
        {/* ── Header ── */}
        <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 backdrop-blur-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-3.5">
            <div>
              <h1 className="text-lg font-bold text-slate-900">Financial Reports</h1>
              <p className="mt-0.5 text-xs text-slate-500">
                {formatDate(startDate)} → {formatDate(endDate)}{userId ? ' · filtered by user' : ''}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="date"
                value={startDate}
                max={endDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
              <span className="text-xs text-slate-400">to</span>
              <input
                type="date"
                value={endDate}
                min={startDate}
                max={todayStr()}
                onChange={(e) => setEndDate(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
              <select
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="">All users</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.fullName} ({u.role})
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={load}
                disabled={loading}
                className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:bg-slate-400"
              >
                {loading ? 'Loading…' : 'Refresh'}
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

          {/* Summary cards */}
          <section className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <SummaryCard label="Total Revenue" value={fmtINR(totals.totalRevenue)} sub={`${totals.paymentCount} payments`} accent="slate" />
            <SummaryCard label="Cash"          value={fmtINR(cashTotal)}           accent="emerald" />
            <SummaryCard label="Digital / POS" value={fmtINR(digitalTotal)}        accent="blue" />
          </section>

          {otherTotal > 0 && (
            <p className="text-xs text-slate-500">
              Other payment modes total: <span className="font-semibold text-slate-700">{fmtINR(otherTotal)}</span>
            </p>
          )}

          {/* By payment mode */}
          <ReportTable
            title="By Payment Mode"
            columns={['Mode', 'Code', 'Count', 'Total']}
            rows={(report?.byPaymentMode ?? []).map((r) => [
              r.name, r.code, r.count, fmtINR(r.total),
            ])}
            onExport={exportPaymentModes}
          />

          {/* By invoice type */}
          <ReportTable
            title="By Invoice Type"
            columns={['Type', 'Count', 'Total']}
            rows={(report?.byInvoiceType ?? []).map((r) => [
              r.invoiceType, r.count, fmtINR(r.total),
            ])}
            onExport={exportInvoiceTypes}
          />

          {/* By doctor (consultation) */}
          <ReportTable
            title="By Doctor (Consultation Fees)"
            columns={['Doctor', 'Consultations', 'Total']}
            rows={(report?.byDoctor ?? []).map((r) => [
              r.doctorName, r.count, fmtINR(r.total),
            ])}
            onExport={exportDoctors}
          />

          {/* By collecting user */}
          <ReportTable
            title="By Collecting User"
            columns={['User', 'Role', 'Count', 'Total']}
            rows={(report?.byUser ?? []).map((r) => [
              r.fullName, r.role ?? '', r.count, fmtINR(r.total),
            ])}
            onExport={exportUsers}
          />
        </main>
      </div>
    </AppShell>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const ACCENTS = {
  slate:   'border-slate-200   bg-white       text-slate-900',
  emerald: 'border-emerald-200 bg-emerald-50  text-emerald-900',
  blue:    'border-blue-200    bg-blue-50     text-blue-900',
  violet:  'border-violet-200  bg-violet-50   text-violet-900',
};

function SummaryCard({ label, value, sub, accent = 'slate' }) {
  return (
    <div className={`rounded-2xl border p-4 shadow-sm ${ACCENTS[accent]}`}>
      <div className="text-[11px] font-semibold uppercase tracking-wider opacity-70">{label}</div>
      <div className="mt-1 text-2xl font-bold tabular-nums">{value}</div>
      {sub && <div className="mt-0.5 text-[11px] opacity-70">{sub}</div>}
    </div>
  );
}

function ReportTable({ title, columns, rows, onExport }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
        <button
          type="button"
          onClick={onExport}
          disabled={!rows || rows.length === 0}
          className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Export CSV
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr>
              {columns.map((c) => (
                <th
                  key={c}
                  className="border-b border-slate-100 bg-slate-50 px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500"
                >
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows && rows.length > 0 ? (
              rows.map((r, i) => (
                <tr key={i} className="hover:bg-slate-50">
                  {r.map((cell, j) => (
                    <td key={j} className="px-4 py-2 text-sm text-slate-700 tabular-nums">{cell}</td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns.length} className="px-4 py-6 text-center text-sm text-slate-400">
                  No data for the selected range.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
