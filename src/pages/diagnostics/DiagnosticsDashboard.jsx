import { useCallback, useEffect, useState } from 'react';
import { AppShell } from '../../components/AppShell';
import { extractError } from '../../lib/api';
import { api } from '../../lib/api';
import { listVisits } from '../../api/visits.api';
import { listServices } from '../../api/services.api';
import { createExternalServicesInvoice } from '../../api/billing.api';
import { TestsBillingModal } from '../billing/TestsBillingModal';
import { ComprehensivePatientForm } from '../../components/ComprehensivePatientForm';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

function fmtDateHeader(d) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-IN', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
  });
}

function fmtCurrency(v) {
  return `₹${Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtTime(iso) {
  return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function patientName(p) {
  if (!p) return '—';
  return `${p.firstName}${p.lastName ? ` ${p.lastName}` : ''}`;
}

function servicesTotal(visit) {
  return visit.invoices
    ?.filter((i) => i.invoiceType === 'SERVICES')
    .reduce((s, i) => s + Number(i.netAmount), 0) ?? 0;
}

// ─── Queue status pill ────────────────────────────────────────────────────────

const QUEUE_CFG = {
  WAITING:         { label: 'Waiting',     cls: 'bg-amber-50 text-amber-700 ring-amber-200' },
  IN_CONSULTATION: { label: 'In Consult',  cls: 'bg-violet-50 text-violet-700 ring-violet-200' },
  DONE:            { label: 'Done',        cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  TRANSFERRED:     { label: 'Transferred', cls: 'bg-sky-50 text-sky-700 ring-sky-200' },
};

function QueueBadge({ status }) {
  const cfg = QUEUE_CFG[status] ?? { label: status, cls: 'bg-slate-100 text-slate-500 ring-slate-200' };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}

// ─── Table row ────────────────────────────────────────────────────────────────

function VisitRow({ visit, onAddTests }) {
  const svcInvoices = visit.invoices?.filter((i) => i.invoiceType === 'SERVICES') ?? [];
  const svcTotal    = svcInvoices.reduce((s, i) => s + Number(i.netAmount), 0);
  const svcPaid     = svcInvoices.filter((i) => i.paymentStatus === 'PAID').length;

  return (
    <tr className="group hover:bg-slate-50 transition-colors">
      {/* Time */}
      <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500 tabular-nums">
        {fmtTime(visit.createdAt)}
      </td>

      {/* OP # */}
      <td className="whitespace-nowrap px-4 py-3">
        <span className="font-mono text-xs font-bold text-blue-700">{visit.opNumber}</span>
      </td>

      {/* Patient */}
      <td className="px-4 py-3">
        <div className="text-sm font-semibold text-slate-900 leading-snug">{patientName(visit.patient)}</div>
        <div className="font-mono text-[11px] text-slate-400">{visit.patient?.uhid}</div>
      </td>

      {/* Doctor */}
      <td className="px-4 py-3 text-sm text-slate-600">{visit.doctor?.name ?? '—'}</td>

      {/* Queue status — so lab staff can see where the patient currently is */}
      <td className="whitespace-nowrap px-4 py-3">
        <QueueBadge status={visit.queueStatus} />
      </td>

      {/* Tests billed */}
      <td className="whitespace-nowrap px-4 py-3">
        {svcInvoices.length === 0 ? (
          <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-500 ring-1 ring-inset ring-slate-200">
            None yet
          </span>
        ) : (
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-bold text-teal-700">{fmtCurrency(svcTotal)}</span>
            <span className="text-[11px] text-slate-400">
              {svcPaid}/{svcInvoices.length} invoice{svcInvoices.length !== 1 ? 's' : ''} paid
            </span>
          </div>
        )}
      </td>

      {/* Action */}
      <td className="whitespace-nowrap px-4 py-3 text-right">
        <button
          type="button"
          onClick={() => onAddTests(visit)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-teal-300 bg-teal-50 px-3 py-1.5 text-xs font-semibold text-teal-700 shadow-sm transition hover:bg-teal-100"
        >
          <FlaskIcon />
          {svcInvoices.length === 0 ? 'Bill Tests' : 'Add More Tests'}
        </button>
      </td>
    </tr>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

// ─── External patient billing panel ──────────────────────────────────────────

const EMPTY_EXT = {
  firstName: '', lastName: '', gender: 'MALE', dob: '', age: '',
  mobile: '', altMobile: '', email: '',
  address: '', city: '', state: '', pincode: '',
  emergencyContactName: '', emergencyContactMobile: '',
};

function ExternalPatientPanel({ onDone }) {
  const [patientForm, setPatientForm] = useState(EMPTY_EXT);
  const [services, setServices]       = useState([]);
  const [selected, setSelected]       = useState(new Set());
  const [step, setStep]               = useState('form'); // 'form' | 'tests' | 'success'
  const [busy, setBusy]               = useState(false);
  const [err, setErr]                 = useState('');
  const [result, setResult]           = useState(null);
  const [formErrors, setFormErrors]   = useState({});

  useEffect(() => {
    listServices({ isActive: 'true' })
      .then(({ data }) => setServices(data.data.services ?? []))
      .catch(() => {});
  }, []);

  function handleChange(key, value) {
    setPatientForm((f) => ({ ...f, [key]: value }));
    setFormErrors((e) => ({ ...e, [key]: '' }));
  }

  function validateForm() {
    const e = {};
    if (!patientForm.firstName.trim())    e.firstName = 'First name is required.';
    if (!patientForm.mobile.trim())       e.mobile    = 'Mobile is required.';
    if (!patientForm.gender)              e.gender    = 'Select gender.';
    if (!patientForm.age && patientForm.age !== 0) e.age = 'Age is required.';
    return e;
  }

  function goToTests() {
    const errs = validateForm();
    if (Object.keys(errs).length) { setFormErrors(errs); return; }
    setStep('tests');
  }

  async function submit() {
    if (selected.size === 0) { setErr('Select at least one test.'); return; }
    setBusy(true); setErr('');
    try {
      // Convert empty strings to null so Zod's email/date validators don't choke.
      const payload = { ...patientForm };
      if (payload.email === '')                  payload.email                  = null;
      if (payload.dob === '')                    payload.dob                    = null;
      if (payload.altMobile === '')              payload.altMobile              = null;
      if (payload.address === '')                payload.address                = null;
      if (payload.city === '')                   payload.city                   = null;
      if (payload.state === '')                  payload.state                  = null;
      if (payload.pincode === '')                payload.pincode                = null;
      if (payload.emergencyContactName === '')   payload.emergencyContactName   = null;
      if (payload.emergencyContactMobile === '') payload.emergencyContactMobile = null;

      const { data } = await createExternalServicesInvoice(payload, [...selected]);
      setResult(data.data);
      setStep('success');
    } catch (e) {
      setErr(extractError(e));
    } finally {
      setBusy(false);
    }
  }

  function toggleService(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const selectedSvcs = services.filter((s) => selected.has(s.id));
  const testsTotal   = selectedSvcs.reduce((sum, s) => sum + Number(s.price), 0);

  if (step === 'success' && result) {
    return (
      <div className="flex flex-col items-center gap-5 py-10 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-teal-100 ring-4 ring-teal-50">
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
            <path d="M6 16l7 7L26 9" stroke="#0d9488" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div>
          <p className="text-lg font-bold text-slate-900">Invoice Created!</p>
          {result.isNewPatient && (
            <p className="mt-0.5 text-xs font-medium text-amber-600">New patient record created</p>
          )}
          <p className="mt-1 font-mono text-sm font-semibold text-teal-700">{result.invoice?.invoiceNumber}</p>
          <p className="mt-0.5 text-sm text-slate-500">
            {result.invoice?.patient?.firstName} {result.invoice?.patient?.lastName ?? ''} ·{' '}
            {fmtCurrency(result.invoice?.netAmount ?? 0)} pending payment
          </p>
        </div>
        <button onClick={onDone}
          className="rounded-lg bg-teal-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-700">
          Done
        </button>
      </div>
    );
  }

  if (step === 'tests') {
    return (
      <div className="space-y-4 max-w-2xl mx-auto py-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-slate-900">
              {patientForm.firstName} {patientForm.lastName}
            </p>
            <p className="text-xs text-slate-500">{patientForm.mobile}</p>
          </div>
          <button type="button" onClick={() => setStep('form')}
            className="text-xs font-semibold text-blue-600 hover:text-blue-800">
            ← Edit patient
          </button>
        </div>

        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Select Tests</p>
        {services.length === 0 ? (
          <p className="text-sm italic text-slate-400">No active tests configured.</p>
        ) : (
          <div className="space-y-1.5">
            {services.map((svc) => (
              <label key={svc.id}
                className={`flex cursor-pointer items-center justify-between rounded-lg border px-3 py-2.5 transition
                  ${selected.has(svc.id) ? 'border-teal-300 bg-teal-50 ring-1 ring-teal-300' : 'border-slate-200 bg-white hover:bg-slate-50'}`}>
                <div className="flex items-center gap-3">
                  <input type="checkbox" checked={selected.has(svc.id)} onChange={() => toggleService(svc.id)}
                    className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500" />
                  <span className="text-sm font-medium text-slate-800">{svc.serviceName}</span>
                </div>
                <span className="text-sm font-semibold text-slate-700">{fmtCurrency(svc.price)}</span>
              </label>
            ))}
          </div>
        )}

        <div className="flex justify-between rounded-xl border border-slate-200 bg-white px-4 py-3">
          <span className="text-sm font-bold text-slate-900">Tests Total</span>
          <span className={`text-lg font-bold ${selected.size > 0 ? 'text-teal-700' : 'text-slate-400'}`}>
            {fmtCurrency(testsTotal)}
          </span>
        </div>

        {err && <p className="rounded-lg bg-red-50 border border-red-200 px-3 py-2.5 text-sm text-red-700">⚠ {err}</p>}

        <button onClick={submit} disabled={busy || selected.size === 0}
          className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-teal-700 disabled:opacity-60 disabled:cursor-not-allowed transition">
          {busy ? 'Creating invoice…' : `Generate Test Bill (${fmtCurrency(testsTotal)})`}
        </button>
      </div>
    );
  }

  return (
    <div className="py-2">
      <ComprehensivePatientForm
        formData={patientForm}
        onChange={handleChange}
        errors={formErrors}
        autoSearch={true}
        hideFields={['email', 'dob']}
        requiredFields={['age']}
        onPatientSelect={(p) => {
          setPatientForm({
            firstName:              p.firstName              || '',
            lastName:               p.lastName               || '',
            gender:                 p.gender                 || 'MALE',
            dob:                    p.dob ? new Date(p.dob).toISOString().split('T')[0] : '',
            age:                    p.age != null ? String(p.age) : '',
            mobile:                 p.mobile                 || '',
            altMobile:              p.altMobile              || '',
            email:                  p.email                  || '',
            address:                p.address                || '',
            city:                   p.city                   || '',
            state:                  p.state                  || '',
            pincode:                p.pincode                || '',
            emergencyContactName:   p.emergencyContactName   || '',
            emergencyContactMobile: p.emergencyContactMobile || '',
          });
          setFormErrors({});
        }}
      />
      <div className="px-5 pt-4">
        <button onClick={goToTests}
          className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-500/50">
          Next: Select Tests →
        </button>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function DiagnosticsDashboard() {
  const [tab, setTab]       = useState('patients'); // 'patients' | 'external'
  const [date, setDate]     = useState(todayStr);
  const [visits, setVisits] = useState([]);    // eligible (consultation paid)
  const [loading, setLoading] = useState(true);
  const [err, setErr]       = useState('');
  const [search, setSearch] = useState('');
  const [testsVisit, setTestsVisit] = useState(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setErr('');
    try {
      const { data } = await listVisits({ date, limit: 100 });
      const all = data.data.visits;
      // Show all active visits — WAITING, IN_CONSULTATION, DONE, TRANSFERRED.
      // Only exclude CANCELLED since there's nothing to bill on a cancelled visit.
      setVisits(all.filter((v) => v.queueStatus !== 'CANCELLED'));
    } catch (e) {
      setErr(extractError(e));
    } finally {
      if (!silent) setLoading(false);
    }
  }, [date]);

  useEffect(() => { load(); }, [load]);

  // Client-side filter on patient name, UHID, or OP number
  const q = search.trim().toLowerCase();
  const displayed = q
    ? visits.filter((v) => {
        const name = patientName(v.patient).toLowerCase();
        const uhid = (v.patient?.uhid ?? '').toLowerCase();
        const op   = (v.opNumber ?? '').toLowerCase();
        return name.includes(q) || uhid.includes(q) || op.includes(q);
      })
    : visits;

  const totalTestsBilled = visits.reduce((s, v) => s + servicesTotal(v), 0);
  const withTests        = visits.filter((v) => (v.invoices?.filter((i) => i.invoiceType === 'SERVICES').length ?? 0) > 0).length;

  return (
    <AppShell>
      <div className="flex flex-1 flex-col overflow-hidden bg-slate-100">

        {/* ── Sticky header ── */}
        <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 backdrop-blur-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-3.5">
            <div>
              <h1 className="text-lg font-bold text-slate-900">Diagnostic Tests</h1>
              <p className="mt-0.5 text-xs text-slate-500">{fmtDateHeader(date)}</p>
            </div>

            {/* Tab switcher */}
            <div className="flex overflow-hidden rounded-lg border border-slate-200 text-sm font-semibold">
              <button
                onClick={() => setTab('patients')}
                className={`px-4 py-2 transition-colors ${tab === 'patients' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>
                Today's Patients
              </button>
              <button
                onClick={() => setTab('external')}
                className={`border-l border-slate-200 px-4 py-2 transition-colors ${tab === 'external' ? 'bg-teal-700 text-white' : 'bg-white text-slate-600 hover:bg-teal-50 hover:text-teal-700'}`}>
                + External Patient
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {/* Quick stats */}
              {!loading && tab === 'patients' && (
                <div className="flex items-center gap-2 text-xs font-semibold">
                  <span className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-slate-600">
                    {visits.length} eligible
                  </span>
                  <span className="rounded-lg border border-teal-200 bg-teal-50 px-3 py-1.5 text-teal-700">
                    {withTests} billed · {fmtCurrency(totalTestsBilled)}
                  </span>
                </div>
              )}

              {/* Search */}
              <div className="relative">
                <SearchIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search patient, UHID, or OP#…"
                  className="rounded-lg border border-slate-200 bg-white py-2 pl-8 pr-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 w-52"
                />
                {search && (
                  <button onClick={() => setSearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    <XSmallIcon />
                  </button>
                )}
              </div>

              {/* Date picker */}
              <input
                type="date"
                value={date}
                max={todayStr()}
                onChange={(e) => setDate(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
              />

              {/* Refresh */}
              <button
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
          {tab === 'external' && (
            <div className="flex-1 overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
              <ExternalPatientPanel onDone={() => setTab('patients')} />
            </div>
          )}
          {tab === 'patients' && err && (
            <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              <WarnIcon /> {err}
            </div>
          )}

          {tab === 'patients' && loading ? (
            <div className="flex flex-1 items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-slate-200 border-t-teal-600" />
            </div>
          ) : tab === 'patients' && displayed.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-200 text-slate-400">
                <FlaskLargeIcon />
              </div>
              <div>
                <p className="font-semibold text-slate-600">
                  {q ? 'No matching patients' : 'No eligible visits'}
                </p>
                <p className="text-sm text-slate-400">
                  {q
                    ? `No results for "${search}"`
                    : 'All active visits for this date will appear here for test billing.'}
                </p>
              </div>
            </div>
          ) : tab === 'patients' ? (
            <div className="flex-1 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="overflow-x-auto overflow-y-auto h-full">
                <table className="w-full border-collapse text-left">
                  <thead className="sticky top-0 bg-slate-50 z-10">
                    <tr>
                      {['Time', 'OP #', 'Patient', 'Doctor', 'Status', 'Tests Billed', ''].map((h) => (
                        <th key={h}
                          className="border-b border-slate-200 px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {displayed.map((v) => (
                      <VisitRow
                        key={v.id}
                        visit={v}
                        onAddTests={setTestsVisit}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </main>
      </div>

      <TestsBillingModal
        open={!!testsVisit}
        visit={testsVisit}
        onClose={(refreshed) => {
          setTestsVisit(null);
          if (refreshed) load(true);
        }}
      />
    </AppShell>
  );
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function FlaskIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5.5 1.5h5M6 1.5v5L3 13h10L10 6.5V1.5" />
      <path d="M4.5 10.5h7" />
    </svg>
  );
}

function FlaskLargeIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4h10M12 4v10L6 26h20L20 14V4" />
      <path d="M9 20h14" />
    </svg>
  );
}

function SearchIcon({ className }) {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className={className}>
      <circle cx="7" cy="7" r="4.5" /><path d="M11 11l3 3" strokeLinecap="round" />
    </svg>
  );
}

function XSmallIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 4l8 8M12 4l-8 8" strokeLinecap="round" />
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
