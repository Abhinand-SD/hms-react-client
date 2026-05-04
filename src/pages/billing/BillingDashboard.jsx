import { useCallback, useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import { AppShell } from '../../components/AppShell';
import { extractError } from '../../lib/api';
import { listVisits } from '../../api/visits.api';
import { refundInvoice } from '../../api/billing.api';
import { ConsultationModal } from './ConsultationModal';
import { InvoicePrintView } from '../../components/InvoicePrintView';
import { formatDate } from '../../utils/dateUtils';

// ─── Design tokens ────────────────────────────────────────────────────────────

const INV_STATUS = {
  PENDING:   { label: 'Pending',  cls: 'bg-amber-50 text-amber-700 ring-amber-200' },
  PARTIAL:   { label: 'Partial',  cls: 'bg-blue-50 text-blue-700 ring-blue-200' },
  PAID:      { label: 'Paid',     cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  CANCELLED: { label: 'Void',     cls: 'bg-slate-100 text-slate-500 ring-slate-200' },
  REFUNDED:  { label: 'Refunded', cls: 'bg-rose-50 text-rose-700 ring-rose-200' },
};

const UNBILLED = { label: 'Unbilled', cls: 'bg-rose-50 text-rose-600 ring-rose-200' };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

function fmtTime(iso) {
  return new Date(iso).toLocaleTimeString('en-IN', {
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
}


function fmtCurrency(amount) {
  return `₹${Number(amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function patientName(p) {
  if (!p) return '—';
  return `${p.firstName}${p.lastName ? ` ${p.lastName}` : ''}`;
}

// ─── Stat pill ────────────────────────────────────────────────────────────────

function Stat({ label, value, cls }) {
  return (
    <div className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold ${cls}`}>
      <span>{value}</span>
      <span className="font-normal opacity-75">{label}</span>
    </div>
  );
}

// ─── Invoice status badge ─────────────────────────────────────────────────────

function InvBadge({ status }) {
  const cfg = status ? (INV_STATUS[status] ?? UNBILLED) : UNBILLED;
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}

// ─── Refund modal ─────────────────────────────────────────────────────────────

function RefundModal({ invoice, onClose }) {
  const [reason, setReason] = useState('');
  const [busy, setBusy]     = useState(false);
  const [err, setErr]       = useState('');

  useEffect(() => { setReason(''); setErr(''); }, [invoice]);

  async function confirm() {
    if (!reason.trim()) { setErr('Please provide a reason for the refund.'); return; }
    setBusy(true);
    try {
      await refundInvoice(invoice.id, reason.trim());
      onClose(true);
    } catch (e) {
      setErr(extractError(e));
    } finally {
      setBusy(false);
    }
  }

  if (!invoice) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => !busy && onClose(false)} />
      <div className="relative w-full max-w-sm rounded-xl bg-white shadow-2xl ring-1 ring-slate-900/5">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="text-base font-semibold text-slate-900">Refund Invoice</h2>
          <button onClick={() => !busy && onClose(false)}
            className="rounded-md p-1 text-slate-400 hover:bg-slate-100">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M3 3l10 10M13 3L3 13" />
            </svg>
          </button>
        </div>
        <div className="px-5 py-4 space-y-4">
          <div className="rounded-lg border border-rose-100 bg-rose-50 px-4 py-3">
            <p className="text-sm font-semibold text-rose-800">{invoice.invoiceNumber}</p>
            <p className="text-xs text-rose-600 mt-0.5">
              {fmtCurrency(invoice.netAmount)} · This action cannot be undone.
            </p>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-600">
              Reason for Refund <span className="text-red-500">*</span>
            </label>
            <textarea rows={3} value={reason}
              onChange={(e) => { setReason(e.target.value); setErr(''); }}
              placeholder="e.g. Patient requested cancellation, duplicate charge…"
              className="block w-full resize-none rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm placeholder:text-slate-400 focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-400/20" />
            {err && <p className="text-xs font-medium text-red-600">⚠ {err}</p>}
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-slate-100 bg-slate-50/50 px-5 py-3 rounded-b-xl">
          <button onClick={() => onClose(false)} disabled={busy}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
            Cancel
          </button>
          <button onClick={confirm} disabled={busy}
            className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-60 transition">
            {busy ? 'Processing…' : 'Confirm Refund'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Table row ────────────────────────────────────────────────────────────────

function VisitRow({ visit, invoiceData, onPayConsultation, onRefund }) {
  const consultation = invoiceData?.consultation ?? null;
  const consultPaid  = consultation?.paymentStatus === 'PAID';
  const isRefunded   = consultation?.paymentStatus === 'REFUNDED';

  const totalAmount = invoiceData
    ? Number(consultation?.netAmount ?? 0)
    : null;

  const overallStatus = !consultation ? null : consultation.paymentStatus;

  return (
    <tr className="group hover:bg-slate-50 transition-colors">
      <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500 tabular-nums">
        {fmtTime(visit.createdAt)}
      </td>
      <td className="whitespace-nowrap px-4 py-3">
        <span className="font-mono text-xs font-bold text-blue-700">{visit.opNumber}</span>
      </td>
      <td className="px-4 py-3">
        <div className="text-sm font-semibold text-slate-900 leading-snug">
          {patientName(visit.patient)}
        </div>
        <div className="font-mono text-[11px] text-slate-400 leading-snug">
          {visit.patient?.uhid}
        </div>
      </td>
      <td className="px-4 py-3 text-sm text-slate-600">
        {visit.doctor?.name ?? '—'}
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-sm font-semibold text-slate-800">
        {totalAmount !== null ? fmtCurrency(totalAmount) : '—'}
      </td>
      <td className="whitespace-nowrap px-4 py-3">
        <InvBadge status={overallStatus} />
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-right">
        {isRefunded ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-0.5 text-[11px] font-semibold text-rose-700 ring-1 ring-inset ring-rose-200">
            ↩ Refunded
          </span>
        ) : !consultation || !consultPaid ? (
          <button
            type="button"
            onClick={() => onPayConsultation(visit)}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition shadow-sm ${
              !consultation
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-amber-500 text-white hover:bg-amber-600'
            }`}
          >
            <CashRegisterIcon />
            {!consultation ? 'Pay Consultation' : 'Complete Payment'}
          </button>
        ) : (
          <div className="flex items-center justify-end gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200">
              ✓ Paid
            </span>
            <button
              type="button"
              onClick={() => onRefund(consultation)}
              className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 text-[11px] font-semibold text-rose-700 transition hover:bg-rose-100"
            >
              <RefundIcon /> Refund
            </button>
          </div>
        )}
      </td>
    </tr>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function BillingDashboard() {
  const [date, setDate]           = useState(todayStr);
  const [visits, setVisits]       = useState([]);
  const [invoiceMap, setInvoiceMap] = useState({});
  const [loading, setLoading]     = useState(true);
  const [err, setErr]             = useState('');
  const [consultationVisit, setConsultationVisit] = useState(null);
  const [refundTarget, setRefundTarget]           = useState(null);
  const [activePrint, setActivePrint]             = useState(null);
  const [billTypeFilter, setBillTypeFilter]       = useState('all'); // 'all' | 'consultation' | 'diagnostics'

  function requestPrint(invoice, visit) {
    setActivePrint({ invoice, visit });
  }

  useEffect(() => {
    if (!activePrint) return;
    const handleAfterPrint = () => setActivePrint(null);
    window.addEventListener('afterprint', handleAfterPrint);
    window.print();
    return () => window.removeEventListener('afterprint', handleAfterPrint);
  }, [activePrint]);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setErr('');
    try {
      const { data: vData } = await listVisits({ date, limit: 100 });
      const allVisits = vData.data.visits;
      setVisits(allVisits);

      const map = {};
      for (const v of allVisits) {
        map[v.id] = {
          consultation: v.invoices?.find((i) => i.invoiceType === 'CONSULTATION') ?? null,
          services:     v.invoices?.filter((i) => i.invoiceType === 'SERVICES') ?? [],
        };
      }
      setInvoiceMap(map);
    } catch (e) {
      setErr(extractError(e));
    } finally {
      if (!silent) setLoading(false);
    }
  }, [date]);

  useEffect(() => { load(); }, [load]);

  // ── Stats ─────────────────────────────────────────────────────────────────

  const unbilled  = visits.filter((v) => !invoiceMap[v.id]?.consultation).length;
  const pending   = visits.filter((v) => {
    const m = invoiceMap[v.id];
    if (!m?.consultation) return false;
    return m.consultation.paymentStatus !== 'PAID' ||
           m.services.some((s) => s.paymentStatus !== 'PAID');
  }).length;
  const paid      = visits.filter((v) => invoiceMap[v.id]?.consultation?.paymentStatus === 'PAID').length;
  const collected = visits.reduce((sum, v) => {
    const m = invoiceMap[v.id];
    if (!m) return sum;
    let total = m.consultation?.paymentStatus === 'PAID' ? Number(m.consultation.netAmount) : 0;
    for (const si of m.services) {
      if (si.paymentStatus === 'PAID') total += Number(si.netAmount);
    }
    return sum + total;
  }, 0);

  // ── Filtered view ─────────────────────────────────────────────────────────

  const displayedVisits = visits.filter((v) => {
    const m = invoiceMap[v.id];
    if (billTypeFilter === 'consultation') return !!m?.consultation;
    if (billTypeFilter === 'diagnostics')  return (m?.services?.length ?? 0) > 0;
    return true;
  });

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <AppShell>
      <div className="flex flex-1 flex-col overflow-hidden bg-slate-100">

        {/* ── Sticky header ── */}
        <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 backdrop-blur-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-3.5">
            <div>
              <h1 className="text-lg font-bold text-slate-900">Billing & Checkout</h1>
              <p className="mt-0.5 text-xs text-slate-500">{formatDate(date)}</p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {/* Stats */}
              {!loading && (
                <div className="flex items-center gap-2">
                  <Stat value={unbilled}  label="unbilled" cls="border-rose-200 bg-rose-50 text-rose-700" />
                  <Stat value={pending}   label="pending"  cls="border-amber-200 bg-amber-50 text-amber-700" />
                  <Stat value={paid}      label="paid"     cls="border-emerald-200 bg-emerald-50 text-emerald-700" />
                  <Stat value={fmtCurrency(collected)} label="collected" cls="border-slate-200 bg-slate-50 text-slate-700" />
                </div>
              )}

              {/* Bill type filter */}
              <select
                value={billTypeFilter}
                onChange={(e) => setBillTypeFilter(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="all">All Bills</option>
                <option value="consultation">Consultation Only</option>
                <option value="diagnostics">Diagnostics Only</option>
              </select>

              {/* Date picker */}
              <input
                type="date"
                value={date}
                max={todayStr()}
                onChange={(e) => setDate(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />

              {/* Refresh */}
              <button
                type="button"
                onClick={() => load()}
                className="rounded-lg border border-slate-200 bg-white p-2 text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
                title="Refresh"
              >
                <RefreshIcon />
              </button>
            </div>
          </div>
        </header>

        {/* ── Body ── */}
        <main className="flex flex-1 flex-col overflow-hidden p-5">
          {err && (
            <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              <WarnIcon /> {err}
            </div>
          )}

          {loading ? (
            <div className="flex flex-1 items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-slate-200 border-t-blue-600" />
            </div>
          ) : displayedVisits.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-200 text-slate-400">
                <EmptyBillingIcon />
              </div>
              <div>
                <p className="font-semibold text-slate-600">No completed visits</p>
                <p className="text-sm text-slate-400">Completed OPD visits will appear here for billing.</p>
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="overflow-x-auto overflow-y-auto h-full">
                <table className="w-full border-collapse text-left">
                  <thead className="sticky top-0 bg-slate-50 z-10">
                    <tr>
                      {['Time', 'OP #', 'Patient', 'Doctor', 'Amount', 'Status', ''].map((h) => (
                        <th
                          key={h}
                          className="border-b border-slate-200 px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {displayedVisits.map((v) => (
                      <VisitRow
                        key={v.id}
                        visit={v}
                        invoiceData={invoiceMap[v.id]}
                        onPayConsultation={setConsultationVisit}
                        onRefund={setRefundTarget}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ── Phase 1: Consultation billing modal ── */}
      <ConsultationModal
        open={!!consultationVisit}
        visit={consultationVisit}
        onRequestPrint={requestPrint}
        onClose={(refreshed) => {
          setConsultationVisit(null);
          if (refreshed) load(true);
        }}
      />
      {activePrint && ReactDOM.createPortal(
        <InvoicePrintView invoice={activePrint.invoice} visit={activePrint.visit} />,
        document.body
      )}

      {/* ── Refund modal ── */}
      <RefundModal
        invoice={refundTarget}
        onClose={(refreshed) => {
          setRefundTarget(null);
          if (refreshed) load(true);
        }}
      />

    </AppShell>
  );
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function RefundIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M2 8a6 6 0 1 0 1.5-4" strokeLinecap="round" />
      <path d="M2 4v4h4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CashRegisterIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="1.5" y="6" width="13" height="8" rx="1.5" />
      <path d="M4 6V4a4 4 0 0 1 8 0v2" />
      <circle cx="8" cy="10" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M13.5 8A5.5 5.5 0 1 1 8 2.5" /><path d="M8 1v3h3" />
    </svg>
  );
}

function WarnIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 1a.5.5 0 0 1 .44.26l6.5 12A.5.5 0 0 1 14.5 14H1.5a.5.5 0 0 1-.44-.74l6.5-12A.5.5 0 0 1 8 1zm0 4.5a.75.75 0 0 0-.75.75v3a.75.75 0 0 0 1.5 0v-3A.75.75 0 0 0 8 5.5zm0 6.5a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5z" />
    </svg>
  );
}

function EmptyBillingIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="6" y="4" width="20" height="24" rx="2" />
      <path d="M11 11h10M11 16h7M11 21h5" />
    </svg>
  );
}

