import { useCallback, useEffect, useState } from 'react';
import { AppShell } from '../../components/AppShell';
import { extractError } from '../../lib/api';
import { listVisits } from '../../api/visits.api';
import { ConsultationModal } from './ConsultationModal';
import { TestsBillingModal } from './TestsBillingModal';
import { useShift } from '../../lib/shift';
import { OpenShiftModal } from '../../components/shifts/OpenShiftModal';

// ─── Design tokens ────────────────────────────────────────────────────────────

const INV_STATUS = {
  PENDING:          { label: 'Pending',       cls: 'bg-amber-50 text-amber-700 ring-amber-200' },
  PARTIAL:          { label: 'Partial',       cls: 'bg-blue-50 text-blue-700 ring-blue-200' },
  PAID:             { label: 'Paid',          cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  CANCELLED:        { label: 'Void',          cls: 'bg-slate-100 text-slate-500 ring-slate-200' },
  SERVICES_PENDING: { label: 'Tests Pending', cls: 'bg-teal-50 text-teal-700 ring-teal-200' },
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

function fmtDateHeader(d) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-IN', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
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

// ─── Table row ────────────────────────────────────────────────────────────────

function VisitRow({ visit, invoiceData, onPayConsultation, onAddTests }) {
  const consultation    = invoiceData?.consultation ?? null;
  const servicesInvs    = invoiceData?.services ?? [];
  const consultPaid     = consultation?.paymentStatus === 'PAID';
  const servicesPending = servicesInvs.some((s) => s.paymentStatus !== 'PAID');

  const totalAmount = invoiceData
    ? Number(consultation?.netAmount ?? 0) + servicesInvs.reduce((s, i) => s + Number(i.netAmount), 0)
    : null;

  const overallStatus = !consultation
    ? null
    : consultation.paymentStatus !== 'PAID'
      ? consultation.paymentStatus
      : servicesPending
        ? 'SERVICES_PENDING'
        : 'PAID';

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
        {!consultation ? (
          <button
            type="button"
            onClick={() => onPayConsultation(visit)}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition shadow-sm bg-blue-600 text-white hover:bg-blue-700"
          >
            <CashRegisterIcon /> Pay Consultation
          </button>
        ) : !consultPaid ? (
          <button
            type="button"
            onClick={() => onPayConsultation(visit)}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition shadow-sm bg-amber-500 text-white hover:bg-amber-600"
          >
            <CashRegisterIcon /> Complete Payment
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onAddTests(visit)}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition shadow-sm bg-teal-600 text-white hover:bg-teal-700"
          >
            <TestTubeIcon /> Add Tests
          </button>
        )}
      </td>
    </tr>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function BillingDashboard() {
  const { isCashHandler, isOpen: shiftIsOpen, loading: shiftLoading } = useShift();
  const [date, setDate]           = useState(todayStr);
  const [visits, setVisits]       = useState([]);
  const [invoiceMap, setInvoiceMap] = useState({});
  const [loading, setLoading]     = useState(true);
  const [err, setErr]             = useState('');
  const [consultationVisit, setConsultationVisit] = useState(null);
  const [testsVisit, setTestsVisit] = useState(null);
  const [openShiftModal, setOpenShiftModal] = useState(false);

  const billingLocked = isCashHandler && !shiftIsOpen;

  function guard(setter) {
    return (visit) => {
      if (billingLocked) {
        setOpenShiftModal(true);
        return;
      }
      setter(visit);
    };
  }

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setErr('');
    try {
      const { data: vData } = await listVisits({ date, limit: 100 });
      const allVisits = vData.data.visits;
      const filtered  = allVisits.filter((v) => ['DONE', 'TRANSFERRED'].includes(v.queueStatus));
      setVisits(filtered);

      const map = {};
      for (const v of filtered) {
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

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <AppShell>
      <div className="flex flex-1 flex-col overflow-hidden bg-slate-100">

        {/* ── Sticky header ── */}
        <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 backdrop-blur-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-3.5">
            <div>
              <h1 className="text-lg font-bold text-slate-900">Billing & Checkout</h1>
              <p className="mt-0.5 text-xs text-slate-500">{fmtDateHeader(date)}</p>
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
          {billingLocked && !shiftLoading && (
            <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
              <div className="flex items-center gap-2">
                <WarnIcon />
                <span>You must open a shift before recording any payments.</span>
              </div>
              <button
                type="button"
                onClick={() => setOpenShiftModal(true)}
                className="rounded-md bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700"
              >
                Open Shift
              </button>
            </div>
          )}
          {err && (
            <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              <WarnIcon /> {err}
            </div>
          )}

          {loading ? (
            <div className="flex flex-1 items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-slate-200 border-t-blue-600" />
            </div>
          ) : visits.length === 0 ? (
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
                    {visits.map((v) => (
                      <VisitRow
                        key={v.id}
                        visit={v}
                        invoiceData={invoiceMap[v.id]}
                        onPayConsultation={guard(setConsultationVisit)}
                        onAddTests={guard(setTestsVisit)}
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
        onClose={(refreshed) => {
          setConsultationVisit(null);
          if (refreshed) load(true);
        }}
      />

      {/* ── Phase 2: Tests billing modal ── */}
      <TestsBillingModal
        open={!!testsVisit}
        visit={testsVisit}
        onClose={(refreshed) => {
          setTestsVisit(null);
          if (refreshed) load(true);
        }}
      />

      {/* ── Open-shift gate ── */}
      <OpenShiftModal
        open={openShiftModal}
        onClose={() => setOpenShiftModal(false)}
      />
    </AppShell>
  );
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function CashRegisterIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="1.5" y="6" width="13" height="8" rx="1.5" />
      <path d="M4 6V4a4 4 0 0 1 8 0v2" />
      <circle cx="8" cy="10" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M3 8l3.5 3.5L13 5" strokeLinecap="round" strokeLinejoin="round" />
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

function TestTubeIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M5 2h6M6 2v7l-2.5 4.5a1 1 0 0 0 .9 1.5h7.2a1 1 0 0 0 .9-1.5L10 9V2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
