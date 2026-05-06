import { useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { AppShell } from '../../components/AppShell';
import { getDailyCollectionReport } from '../../api/reports.api';
import { extractError } from '../../lib/api';

// ─── Formatters ───────────────────────────────────────────────────────────────

const fmt = (n) =>
  Number(n ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

const pct = (part, total) =>
  total ? ((Number(part) / Number(total)) * 100).toFixed(1) : '0.0';

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DailyCollectionReport() {
  const today = new Date().toISOString().slice(0, 10);

  const [date, setDate]     = useState(today);
  const [rows, setRows]     = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState('');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const { data } = await getDailyCollectionReport({ date });
        if (!cancelled) setRows(data.data.rows ?? []);
      } catch (e) {
        if (!cancelled) setError(extractError(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [date]);

  const totals = useMemo(
    () =>
      rows.reduce(
        (acc, r) => ({
          patients:     acc.patients     + Number(r.patients),
          grossAmt:     acc.grossAmt     + Number(r.grossAmt),
          netAmt:       acc.netAmt       + Number(r.netAmt),
          cashAmt:      acc.cashAmt      + Number(r.cashAmt),
          cardUpiAmt:   acc.cardUpiAmt   + Number(r.cardUpiAmt),
          concessionAmt: acc.concessionAmt + Number(r.concessionAmt),
        }),
        { patients: 0, grossAmt: 0, netAmt: 0, cashAmt: 0, cardUpiAmt: 0, concessionAmt: 0 }
      ),
    [rows]
  );

  function exportToExcel() {
    const sheetRows = [
      ['Daily Collection Report'],
      [`Date: ${date}`],
      [],
      ['Service Type', 'Patients', 'Rate (Rs)', 'Gross Amt (Rs)', 'Net Amt (Rs)', 'Cash (Rs)', 'Card/UPI (Rs)', 'Free/Concession'],
      ...rows.map((r) => [
        r.serviceType,
        r.patients,
        r.rate,
        r.grossAmt,
        r.netAmt,
        r.cashAmt,
        r.cardUpiAmt,
        r.concessionAmt,
      ]),
      ['TOTAL', totals.patients, '', totals.grossAmt, totals.netAmt, totals.cashAmt, totals.cardUpiAmt, totals.concessionAmt],
      [],
      ['--- SUMMARY ---'],
      ['Gross Revenue',   totals.grossAmt],
      ['Net Collection',  totals.netAmt],
      ['Total Cash',      totals.cashAmt],
      ['Total Card/UPI',  totals.cardUpiAmt],
      ['Total Patients',  totals.patients],
      ['Cash %',          `${pct(totals.cashAmt,    totals.netAmt)}%`],
      ['Card/UPI %',      `${pct(totals.cardUpiAmt, totals.netAmt)}%`],
    ];

    const ws = XLSX.utils.aoa_to_sheet(sheetRows);
    ws['!cols'] = [
      { wch: 22 }, { wch: 10 }, { wch: 12 }, { wch: 16 },
      { wch: 15 }, { wch: 13 }, { wch: 15 }, { wch: 17 },
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Daily Collection');
    XLSX.writeFile(wb, `Daily_Collection_Report_${date}.xlsx`);
  }

  const summaryCards = [
    { label: 'Gross Revenue',  value: `₹${fmt(totals.grossAmt)}`,   bg: 'bg-blue-50',   border: 'border-blue-200',   vc: 'text-blue-700',   lc: 'text-blue-500',   icon: <GrossIcon /> },
    { label: 'Net Collection', value: `₹${fmt(totals.netAmt)}`,     bg: 'bg-emerald-50', border: 'border-emerald-200', vc: 'text-emerald-700', lc: 'text-emerald-500', icon: <NetIcon /> },
    { label: 'Total Cash',     value: `₹${fmt(totals.cashAmt)}`,    bg: 'bg-green-50',  border: 'border-green-200',  vc: 'text-green-700',  lc: 'text-green-500',  icon: <CashIcon /> },
    { label: 'Total Card/UPI', value: `₹${fmt(totals.cardUpiAmt)}`, bg: 'bg-violet-50', border: 'border-violet-200', vc: 'text-violet-700', lc: 'text-violet-500', icon: <CardIcon /> },
    { label: 'Total Patients', value: totals.patients,              bg: 'bg-sky-50',    border: 'border-sky-200',    vc: 'text-sky-700',    lc: 'text-sky-500',    icon: <PatientsIcon /> },
    { label: 'Cash %',         value: `${pct(totals.cashAmt,    totals.netAmt)}%`, bg: 'bg-amber-50',  border: 'border-amber-200',  vc: 'text-amber-700',  lc: 'text-amber-500',  icon: <PctIcon /> },
    { label: 'Card/UPI %',     value: `${pct(totals.cardUpiAmt, totals.netAmt)}%`, bg: 'bg-purple-50', border: 'border-purple-200', vc: 'text-purple-700', lc: 'text-purple-500', icon: <PctIcon /> },
  ];

  return (
    <AppShell>
      <div className="p-6 space-y-6 min-h-full">

        {/* Page header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Daily Collection Report</h1>
            <p className="mt-0.5 text-sm text-slate-500">Hospital-wide financial summary by service type</p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-slate-600 whitespace-nowrap">Report Date</label>
              <input
                type="date"
                value={date}
                max={today}
                onChange={(e) => setDate(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <button
              onClick={exportToExcel}
              disabled={rows.length === 0}
              className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ExcelIcon />
              Export to Excel
            </button>
          </div>
        </div>

        {/* Error banner */}
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {error}
          </div>
        )}

        {/* Main table */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-800 text-white text-left">
                  <th className="px-4 py-3 font-semibold">Service Type</th>
                  <th className="px-4 py-3 text-right font-semibold">Patients</th>
                  <th className="px-4 py-3 text-right font-semibold">Rate (&#x20b9;)</th>
                  <th className="px-4 py-3 text-right font-semibold">Gross Amt (&#x20b9;)</th>
                  <th className="px-4 py-3 text-right font-semibold">Net Amt (&#x20b9;)</th>
                  <th className="px-4 py-3 text-right font-semibold">Cash (&#x20b9;)</th>
                  <th className="px-4 py-3 text-right font-semibold">Card/UPI (&#x20b9;)</th>
                  <th className="px-4 py-3 text-right font-semibold">Free/Concession</th>
                  <th className="px-4 py-3 font-semibold">Remarks</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  // Skeleton rows while fetching
                  Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                      {Array.from({ length: 9 }).map((__, j) => (
                        <td key={j} className="px-4 py-3">
                          <div className="h-4 rounded bg-slate-200 animate-pulse" style={{ width: j === 0 ? '70%' : '55%' }} />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-10 text-center text-sm text-slate-400">
                      No invoices found for {date}.
                    </td>
                  </tr>
                ) : (
                  rows.map((row, i) => (
                    <tr
                      key={row.serviceType}
                      className={`border-b border-slate-100 transition-colors hover:bg-blue-50/40 ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/70'}`}
                    >
                      <td className="px-4 py-3 font-medium text-slate-700">{row.serviceType}</td>
                      <td className="px-4 py-3 text-right text-slate-600">{row.patients}</td>
                      <td className="px-4 py-3 text-right text-slate-600">{fmt(row.rate)}</td>
                      <td className="px-4 py-3 text-right text-slate-600">{fmt(row.grossAmt)}</td>
                      <td className="px-4 py-3 text-right text-slate-600">{fmt(row.netAmt)}</td>
                      <td className="px-4 py-3 text-right text-slate-600">{fmt(row.cashAmt)}</td>
                      <td className="px-4 py-3 text-right text-slate-600">{fmt(row.cardUpiAmt)}</td>
                      <td className="px-4 py-3 text-right">
                        {Number(row.concessionAmt) > 0 ? (
                          <span className="text-rose-600 font-medium">{fmt(row.concessionAmt)}</span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs italic text-slate-400">—</td>
                    </tr>
                  ))
                )}
              </tbody>
              {!loading && rows.length > 0 && (
                <tfoot>
                  <tr className="bg-slate-800 text-white font-bold text-sm">
                    <td className="px-4 py-3.5">TOTAL</td>
                    <td className="px-4 py-3.5 text-right">{totals.patients}</td>
                    <td className="px-4 py-3.5 text-right text-slate-400">—</td>
                    <td className="px-4 py-3.5 text-right">{fmt(totals.grossAmt)}</td>
                    <td className="px-4 py-3.5 text-right">{fmt(totals.netAmt)}</td>
                    <td className="px-4 py-3.5 text-right">{fmt(totals.cashAmt)}</td>
                    <td className="px-4 py-3.5 text-right">{fmt(totals.cardUpiAmt)}</td>
                    <td className="px-4 py-3.5 text-right">{fmt(totals.concessionAmt)}</td>
                    <td className="px-4 py-3.5 text-slate-400">—</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>

        {/* Summary cards */}
        {!loading && (
          <div>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-slate-400">Summary</h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
              {summaryCards.map((card) => (
                <div
                  key={card.label}
                  className={`rounded-xl border ${card.border} ${card.bg} p-4 flex flex-col gap-2 shadow-sm`}
                >
                  <div className={`${card.vc} opacity-60`}>{card.icon}</div>
                  <div className={`text-xl font-bold leading-tight ${card.vc}`}>{card.value}</div>
                  <div className={`text-xs font-medium ${card.lc}`}>{card.label}</div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </AppShell>
  );
}

/* ── Inline SVG icons ── */

function ExcelIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="8" y1="13" x2="16" y2="13" />
      <line x1="8" y1="17" x2="16" y2="17" />
      <line x1="8" y1="9" x2="10" y2="9" />
    </svg>
  );
}
function GrossIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="1" y="4" width="14" height="9" rx="1.5" />
      <path d="M1 7h14M5 10.5h2M9 10.5h2" />
    </svg>
  );
}
function NetIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <circle cx="8" cy="8" r="6" />
      <path d="M5.5 8h5M8 5.5v5" />
    </svg>
  );
}
function CashIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="1" y="4" width="14" height="9" rx="1.5" />
      <circle cx="8" cy="8.5" r="2" />
    </svg>
  );
}
function CardIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="1" y="3.5" width="14" height="9" rx="1.5" />
      <path d="M1 7h14" />
      <circle cx="4.5" cy="10" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}
function PatientsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="6" cy="5" r="2.5" />
      <path d="M1 14c0-3 2.2-5 5-5s5 2 5 5" />
      <path d="M11 2.5a2.5 2.5 0 0 1 0 5M15 14c0-2.5-1.5-4.5-4-5" />
    </svg>
  );
}
function PctIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <path d="M4 12L12 4" />
      <circle cx="4.5" cy="4.5" r="1.5" />
      <circle cx="11.5" cy="11.5" r="1.5" />
    </svg>
  );
}
