import { useEffect, useRef, useState } from 'react';
import { extractError } from '../../lib/api';
import { searchPatients } from '../../api/patients.api';
import { walkInAppointment, getBookedTokens } from '../../api/appointments.api';
import { getInvoiceById } from '../../api/billing.api';
import { api } from '../../lib/api';
import { Modal } from '../../components/Modal';
import { Button } from '../../components/Button';
import { ComprehensivePatientForm } from '../../components/ComprehensivePatientForm';

// ─── VIP slot numbers ─────────────────────────────────────────────────────────
const VIP_SLOTS = [1, 2, 10, 15, 20];

// ─── Token grid ───────────────────────────────────────────────────────────────
function TokenGrid({ bookedTokens, selectedToken, onSelect, loading }) {
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50/60 p-3">
      {loading ? (
        <p className="flex items-center justify-center gap-2 py-4 text-xs text-slate-400">
          <SpinnerIcon /> Checking availability…
        </p>
      ) : (
        <div className="grid grid-cols-10 gap-1.5">
          {Array.from({ length: 70 }, (_, i) => i + 1).map((n) => {
            const taken    = bookedTokens.includes(n);
            const selected = selectedToken === n;
            const isVip    = VIP_SLOTS.includes(n);
            return (
              <button
                key={n}
                type="button"
                disabled={taken}
                onClick={() => onSelect(n)}
                className={[
                  'rounded py-2 text-xs font-bold transition select-none',
                  taken
                    ? 'cursor-not-allowed bg-red-500 text-white opacity-80'
                    : selected
                    ? 'bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-400 ring-offset-1'
                    : isVip
                    ? 'bg-orange-500 hover:bg-orange-600 text-white border border-orange-600 active:scale-95'
                    : 'bg-green-500 text-white hover:bg-green-600 active:scale-95',
                ].join(' ')}
              >
                {n}
              </button>
            );
          })}
        </div>
      )}
      {!loading && (
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          {bookedTokens.length > 0 && (
            <p className="text-[10px] text-slate-400">
              {bookedTokens.length} token{bookedTokens.length !== 1 ? 's' : ''} already taken today
            </p>
          )}
          <p className="ml-auto text-[10px] text-slate-400">
            <span className="inline-block h-2 w-2 rounded-sm bg-orange-500 align-middle mr-1" />
            Orange = VIP Slot
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Walk-in success — Queue Ticket style ─────────────────────────────────────
function WalkInSuccess({ opNumber, patientName, isNew, isFollowUp, fee, onDone, onPrint, canPrint }) {
  const tokenNum = parseInt(opNumber.split('-').pop(), 10);
  return (
    <div className="max-w-sm mx-auto rounded-2xl shadow-2xl bg-white p-8 text-center">
      <div className="flex justify-center mb-4">
        <div className={`flex h-16 w-16 items-center justify-center rounded-full ${isFollowUp ? 'bg-amber-100' : 'bg-emerald-100'}`}>
          <CheckCircleIcon color={isFollowUp ? '#d97706' : '#059669'} size={40} />
        </div>
      </div>

      <p className="text-xl font-bold text-slate-900">Walk-in Registered!</p>
      {isNew && (
        <p className="mt-1 text-xs font-medium text-amber-600">New patient record created</p>
      )}
      {isFollowUp && (
        <span className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
          Follow-up visit — No charge
        </span>
      )}
      <p className="mt-2 text-sm text-slate-500">
        Patient: <span className="font-semibold text-slate-800">{patientName}</span>
      </p>

      <div className="mt-4 rounded-2xl border-2 border-dashed border-emerald-300 bg-emerald-50 px-8 py-5">
        <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-400">Queue Token</p>
        <p className="text-5xl font-extrabold text-blue-600 mt-1">{tokenNum}</p>
        <p className="mt-1.5 text-[11px] text-slate-400">Share this number with the patient</p>
      </div>

      {isFollowUp || fee === 0 ? (
        <div className="mt-4 flex items-center gap-2.5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5">
          <CheckCircleIcon color="#059669" size={16} />
          <span className="text-sm font-semibold text-emerald-700">No payment required</span>
        </div>
      ) : fee != null ? (
        <div className="mt-4 flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-4 py-2.5">
          <span className="text-sm text-slate-500">Consultation Fee</span>
          <span className="font-mono text-sm font-bold text-slate-800">
            ₹{fee.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </span>
        </div>
      ) : null}

      <div className="mt-6 flex gap-3">
        <button onClick={onPrint} disabled={!canPrint}
          className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed">
          {canPrint ? <><PrintIcon /> Print Token</> : <><SpinnerIcon /> Loading…</>}
        </button>
        <button onClick={onDone}
          className="flex-1 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700">
          Done
        </button>
      </div>
    </div>
  );
}

// ─── Patient search / autofill bar ────────────────────────────────────────────
// A standalone search widget — selecting a result calls onSelect(patient).
// The patient form fields are managed separately in the parent.
function PatientSearchAutofill({ selectedPatient, onSelect }) {
  const [query, setQuery]       = useState('');
  const [results, setResults]   = useState([]);
  const [open, setOpen]         = useState(false);
  const [fetching, setFetching] = useState(false);
  const debounceRef = useRef(null);
  const wrapRef     = useRef(null);

  useEffect(() => {
    if (selectedPatient) setQuery('');
  }, [selectedPatient]);

  useEffect(() => {
    function handler(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  function handleType(v) {
    setQuery(v);
    clearTimeout(debounceRef.current);
    if (!v.trim()) { setResults([]); setOpen(false); return; }
    debounceRef.current = setTimeout(async () => {
      setFetching(true);
      try {
        const { data } = await searchPatients({ q: v.trim(), limit: 8 });
        const patients = data.data.patients;
        setResults(patients);
        setOpen(patients.length > 0);
      } catch { /* ignore */ }
      finally { setFetching(false); }
    }, 250);
  }

  function pick(p) {
    onSelect(p);
    setQuery('');
    setOpen(false);
    setResults([]);
  }

  if (selectedPatient) {
    return (
      <div className="flex items-center gap-2.5 rounded-lg border border-blue-200 bg-blue-50 px-3.5 py-2.5">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
          {(selectedPatient.firstName?.[0] ?? '?').toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-slate-900">
            {selectedPatient.firstName}{selectedPatient.lastName ? ` ${selectedPatient.lastName}` : ''}
            <span className="ml-2 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-600">Autofilled</span>
          </div>
          <div className="font-mono text-[11px] text-slate-500">
            {selectedPatient.uhid} · {selectedPatient.mobile}
          </div>
        </div>
        <button type="button" onClick={() => onSelect(null)}
          className="shrink-0 rounded p-0.5 text-slate-400 hover:bg-blue-100 hover:text-slate-700">
          <XIcon />
        </button>
      </div>
    );
  }

  return (
    <div ref={wrapRef} className="relative">
      <div className="relative">
        <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-slate-400">
          <SearchIcon />
        </span>
        <input
          className="block w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-10 text-sm text-slate-900 placeholder:text-slate-400 transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          value={query}
          onChange={(e) => handleType(e.target.value)}
          placeholder="Search existing patient by name or mobile to autofill…"
          autoComplete="off"
        />
        {fetching && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
            <SpinnerIcon />
          </span>
        )}
      </div>
      {open && results.length > 0 && (
        <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
          <div className="border-b border-slate-100 px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">
            Existing patients — select to autofill form
          </div>
          {results.map((p) => (
            <button key={p.id} type="button" onClick={() => pick(p)}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-blue-50">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">
                {(p.firstName?.[0] ?? '?').toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-slate-900">
                  {p.firstName}{p.lastName ? ` ${p.lastName}` : ''}
                </div>
                <div className="font-mono text-[11px] text-slate-400">
                  {p.uhid} · {p.mobile}{p.age != null ? ` · ${p.age} yrs` : ''}
                  {p.city ? ` · ${p.city}` : ''}
                </div>
              </div>
              <span className="shrink-0 text-[10px] font-semibold text-blue-600">Autofill →</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main modal ───────────────────────────────────────────────────────────────

const EMPTY = {
  selectedPatient:        null,
  firstName:              '',
  lastName:               '',
  dob:                    '',
  age:                    '',
  gender:                 'MALE',
  mobile:                 '',
  altMobile:              '',
  email:                  '',
  address:                '',
  city:                   '',
  state:                  '',
  pincode:                '',
  emergencyContactName:   '',
  emergencyContactMobile: '',
  doctorId:               '',
  tokenNumber:            null,
};

const INP_SM = 'block w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:bg-slate-50 disabled:text-slate-400';

export function WalkInModal({ open, onClose, onRequestPrint }) {
  const [form, setForm]                   = useState(EMPTY);
  const [step, setStep]                   = useState(1);
  const [doctors, setDoctors]             = useState([]);
  const [bookedTokens, setBookedTokens]   = useState([]);
  const [tokensLoading, setTokensLoading] = useState(false);
  const [busy, setBusy]                   = useState(false);
  const [errors, setErrors]               = useState({});
  const [globalErr, setGlobalErr]         = useState('');
  const [success, setSuccess]             = useState(null);
  const [printInvoice, setPrintInvoice]   = useState(null);

  useEffect(() => {
    if (!open) return;
    setForm(EMPTY);
    setStep(1);
    setErrors({});
    setGlobalErr('');
    setSuccess(null);
    setPrintInvoice(null);
    setBookedTokens([]);
    api.get('/doctors', { params: { pageSize: 100, isActive: 'true' } })
      .then(({ data }) => setDoctors(data.data.items))
      .catch(() => {});
  }, [open]);

  useEffect(() => {
    if (!form.doctorId) { setBookedTokens([]); return; }
    let cancelled = false;
    setTokensLoading(true);
    setForm((f) => ({ ...f, tokenNumber: null }));
    getBookedTokens({ doctorId: form.doctorId, date: today() })
      .then(({ data }) => { if (!cancelled) setBookedTokens(data.data.bookedTokens ?? []); })
      .catch(() => { if (!cancelled) setBookedTokens([]); })
      .finally(() => { if (!cancelled) setTokensLoading(false); });
    return () => { cancelled = true; };
  }, [form.doctorId]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleFormChange(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: '' }));
  }

  function handlePatientSelect(p) {
    if (!p) {
      setForm((f) => ({ ...EMPTY, doctorId: f.doctorId, tokenNumber: f.tokenNumber }));
      return;
    }
    setForm((f) => ({
      ...f,
      selectedPatient:        p,
      firstName:              p.firstName || '',
      lastName:               p.lastName  || '',
      mobile:                 p.mobile    || f.mobile,
      age:                    p.age != null ? String(p.age) : f.age,
      gender:                 p.gender    || f.gender,
      city:                   p.city      || f.city,
      address:                p.address   || f.address,
      state:                  p.state     || f.state,
      pincode:                p.pincode   || f.pincode,
      altMobile:              p.altMobile || f.altMobile,
      email:                  p.email     || f.email,
      dob:                    p.dob ? new Date(p.dob).toISOString().split('T')[0] : f.dob,
      emergencyContactName:   p.emergencyContactName   || f.emergencyContactName,
      emergencyContactMobile: p.emergencyContactMobile || f.emergencyContactMobile,
    }));
    setErrors({});
  }

  function validateStep1() {
    const e = {};
    if (!form.firstName.trim()) e.firstName = 'First name is required.';
    if (!form.mobile.trim())    e.mobile    = 'Mobile number is required.';
    if (!form.gender)           e.gender    = 'Select gender.';
    if (!form.doctorId)         e.doctorId  = 'Select a doctor.';
    return e;
  }

  function validateStep2() {
    const e = {};
    if (!form.tokenNumber) e.tokenNumber = 'Select a token number from the grid.';
    return e;
  }

  function onNext() {
    const errs = validateStep1();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});
    setStep(2);
  }

  async function onSubmit(e) {
    e.preventDefault();
    const errs = validateStep2();
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setBusy(true);
    setGlobalErr('');
    try {
      const patientName = [form.firstName.trim(), form.lastName.trim()].filter(Boolean).join(' ');
      const { data } = await walkInAppointment({
        patientName,
        mobile:                 form.mobile.trim(),
        age:                    form.age ? parseInt(form.age, 10) : undefined,
        gender:                 form.gender,
        city:                   form.city.trim()      || undefined,
        dob:                    form.dob              || undefined,
        address:                form.address.trim()   || undefined,
        state:                  form.state.trim()     || undefined,
        pincode:                form.pincode.trim()   || undefined,
        altMobile:              form.altMobile.trim() || undefined,
        email:                  form.email.trim()     || undefined,
        emergencyContactName:   form.emergencyContactName.trim()   || undefined,
        emergencyContactMobile: form.emergencyContactMobile.trim() || undefined,
        doctorId:    form.doctorId,
        tokenNumber: form.tokenNumber,
      });

      const { opNumber, isFollowUp, fee, visit, patient, isNewPatient } = data.data;
      const resolvedName = patient?.firstName
        ? `${patient.firstName}${patient.lastName ? ` ${patient.lastName}` : ''}`
        : patientName;

      if (isFollowUp || fee === 0) {
        setSuccess({ opNumber, patientName: resolvedName, isNew: isNewPatient, isFollowUp, fee, visit });
        // Fetch the full invoice (with items) so the Print Token button works.
        const consultInvoice = visit?.invoices?.find((i) => i.invoiceType === 'CONSULTATION');
        if (consultInvoice?.id) {
          getInvoiceById(consultInvoice.id)
            .then(({ data }) => setPrintInvoice(data.data.invoice))
            .catch(() => {});
        }
      } else {
        onClose(true, visit);
      }
    } catch (err) {
      setGlobalErr(extractError(err));
    } finally {
      setBusy(false);
    }
  }

  const selectedDoctor = doctors.find((d) => d.id === form.doctorId);
  const displayName    = [form.firstName, form.lastName].filter(Boolean).join(' ');

  return (
    <Modal
      open={open}
      onClose={() => !busy && onClose(false)}
      title={success ? '' : 'Walk-in Registration'}
      size={success ? 'sm' : '5xl'}
      transparent={!!success}
      footer={success ? null : step === 1 ? (
        <>
          <Button variant="secondary" size="md" type="button" onClick={() => onClose(false)} disabled={busy}>
            Cancel
          </Button>
          <button type="button" onClick={onNext}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/50">
            Next →
          </button>
        </>
      ) : (
        <>
          <button type="button" onClick={() => { setStep(1); setErrors({}); }}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50">
            ← Back
          </button>
          <button type="submit" form="walkin-form" disabled={busy}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 disabled:opacity-60">
            {busy ? <><SpinnerIcon /> Registering…</> : 'Register & Add to Queue'}
          </button>
        </>
      )}
    >
      {success ? (
        <WalkInSuccess
          opNumber={success.opNumber}
          patientName={success.patientName}
          isNew={success.isNew}
          isFollowUp={success.isFollowUp}
          fee={success.fee}
          onDone={() => onClose(true, null)}
          onPrint={() => onRequestPrint?.(printInvoice, success.visit)}
          canPrint={!!printInvoice}
        />
      ) : (
        <form id="walkin-form" onSubmit={onSubmit}>
          {globalErr && (
            <div className="mx-6 mt-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3.5 py-3 text-sm font-medium text-red-700">
              <WarnIcon /> {globalErr}
            </div>
          )}

          {step === 1 ? (
            <div className="space-y-0">
              {/* Comprehensive patient form — First Name is the search entry point */}
              <ComprehensivePatientForm
                formData={form}
                onChange={handleFormChange}
                errors={errors}
                autoSearch={true}
                onPatientSelect={handlePatientSelect}
              />

              {/* Doctor selection (visit-specific, not part of patient record) */}
              <div className="px-6 pb-4 pt-2 border-t border-gray-100">
                <p className="mb-3 text-[11px] font-bold uppercase tracking-widest text-slate-400">Visit Details</p>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-gray-600">
                    Doctor <span className="text-red-500">*</span>
                  </label>
                  <select
                    className={`${INP_SM}${errors.doctorId ? ' border-red-300' : ''}`}
                    value={form.doctorId}
                    onChange={(e) => handleFormChange('doctorId', e.target.value)}
                  >
                    <option value="">— Select doctor —</option>
                    {doctors.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} · {d.specialization}{d.roomNo ? ` (${d.roomNo})` : ''}
                      </option>
                    ))}
                  </select>
                  {errors.doctorId && (
                    <p className="text-xs font-medium text-red-600">⚠ {errors.doctorId}</p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 p-6">
              {/* ── Left: Patient summary ── */}
              <div className="rounded-xl border border-emerald-100 bg-emerald-50/30 p-5 space-y-3">
                <p className="text-[11px] font-bold uppercase tracking-widest text-emerald-600">Patient Summary</p>
                <div className="space-y-2.5">
                  {displayName   && <SummaryRow label="Name"   value={displayName} />}
                  {form.mobile   && <SummaryRow label="Mobile" value={form.mobile} />}
                  {form.gender   && <SummaryRow label="Gender" value={form.gender === 'MALE' ? 'Male' : form.gender === 'FEMALE' ? 'Female' : 'Other'} />}
                  {form.age      && <SummaryRow label="Age"    value={`${form.age} yrs`} />}
                  {form.city     && <SummaryRow label="City"   value={form.city} />}
                  {form.address  && <SummaryRow label="Address" value={form.address} />}
                  {selectedDoctor && <SummaryRow label="Doctor" value={selectedDoctor.name} />}
                </div>
                <button type="button" onClick={() => { setStep(1); setErrors({}); }}
                  className="mt-1 text-xs font-semibold text-blue-600 hover:text-blue-800 transition">
                  ← Edit patient details
                </button>
              </div>

              {/* ── Right: Token selection ── */}
              <div className="flex flex-col rounded-xl border-2 border-dashed border-emerald-200 bg-emerald-50/30 p-4">
                <p className="mb-3 text-[11px] font-bold uppercase tracking-widest text-emerald-600">
                  Step 2 of 2 — Select Queue Token
                </p>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-600">
                    Token Number <span className="text-red-500">*</span>
                  </label>
                  <TokenGrid
                    bookedTokens={bookedTokens}
                    selectedToken={form.tokenNumber}
                    onSelect={(n) => handleFormChange('tokenNumber', n)}
                    loading={tokensLoading}
                  />
                  {errors.tokenNumber && (
                    <p className="text-xs font-medium text-red-600">⚠ {errors.tokenNumber}</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </form>
      )}
    </Modal>
  );
}

// ─── Summary row ──────────────────────────────────────────────────────────────
function SummaryRow({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-4 text-sm">
      <span className="shrink-0 text-slate-500">{label}</span>
      <span className="text-right font-semibold text-slate-800">{value}</span>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function today() {
  return new Date().toISOString().split('T')[0];
}

function XIcon() {
  return <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3l10 10M13 3L3 13" /></svg>;
}
function WarnIcon() {
  return <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M8 1a.5.5 0 0 1 .44.26l6.5 12A.5.5 0 0 1 14.5 14H1.5a.5.5 0 0 1-.44-.74l6.5-12A.5.5 0 0 1 8 1zm0 4.5a.75.75 0 0 0-.75.75v3a.75.75 0 0 0 1.5 0v-3A.75.75 0 0 0 8 5.5zm0 6.5a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5z" /></svg>;
}
function SearchIcon() {
  return <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="6.5" cy="6.5" r="4.5" /><path d="M10 10l3.5 3.5" strokeLinecap="round" /></svg>;
}
function PrintIcon() {
  return <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 5V2.5h8V5" /><rect x="1.5" y="5" width="13" height="7" rx="1.5" /><path d="M4 12.5h8v1H4z" fill="currentColor" stroke="none" /></svg>;
}
function SpinnerIcon() {
  return <svg width="14" height="14" viewBox="0 0 16 16" className="animate-spin" fill="none"><circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" strokeDasharray="18 20" strokeLinecap="round" /></svg>;
}
function CheckCircleIcon({ color = '#059669', size = 36 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><path d="M7 13l3 3 7-7" /></svg>;
}
