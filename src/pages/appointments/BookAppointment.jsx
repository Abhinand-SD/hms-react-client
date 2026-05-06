import { useEffect, useRef, useState } from 'react';
import { extractError } from '../../lib/api';
import { searchPatients } from '../../api/patients.api';
import { bookAppointment, quickBookAppointment, getBookedTokens } from '../../api/appointments.api';
import { api } from '../../lib/api';
import { Modal } from '../../components/Modal';
import { Button } from '../../components/Button';

const INP = 'block w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:bg-slate-50 disabled:text-slate-400';

// ─── Field wrapper ────────────────────────────────────────────────────────────
function FF({ label, required, hint, error, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold text-slate-600">
        {label}{required && <span className="ml-0.5 text-red-500">*</span>}
      </label>
      {children}
      {error
        ? <p className="text-xs font-medium text-red-600">⚠ {error}</p>
        : hint
        ? <p className="text-[11px] text-slate-400">{hint}</p>
        : null}
    </div>
  );
}

// ─── Patient name autocomplete ────────────────────────────────────────────────
// Searches backend as the user types. Selecting a result stores the full patient
// object so the form can autofill mobile/city. Typing a name that never gets
// selected → patientId stays null and the backend will find-or-create on submit.

function PatientAutocomplete({ selectedPatient, inputValue, onInputChange, onSelect, error }) {
  const [results, setResults]   = useState([]);
  const [open, setOpen]         = useState(false);
  const [fetching, setFetching] = useState(false);
  const debounceRef = useRef(null);
  const wrapRef     = useRef(null);

  useEffect(() => {
    function handler(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  function handleType(v) {
    onInputChange(v);
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

  function pick(p) { onSelect(p); setOpen(false); setResults([]); }
  function clear()  { onSelect(null); setOpen(false); setResults([]); }

  if (selectedPatient) {
    return (
      <div className={`flex items-center gap-2.5 rounded-lg border px-3.5 py-2.5 ${error ? 'border-red-300 bg-red-50' : 'border-blue-200 bg-blue-50'}`}>
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
          {(selectedPatient.firstName?.[0] ?? '?').toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-slate-900">
            {selectedPatient.firstName}{selectedPatient.lastName ? ` ${selectedPatient.lastName}` : ''}
          </div>
          <div className="font-mono text-[11px] text-slate-500">
            {selectedPatient.uhid} · {selectedPatient.mobile}
            {selectedPatient.age != null ? ` · ${selectedPatient.age} yrs` : ''}
          </div>
        </div>
        <button type="button" onClick={clear}
          className="shrink-0 rounded p-0.5 text-slate-400 hover:bg-blue-100 hover:text-slate-700">
          <XIcon />
        </button>
      </div>
    );
  }

  return (
    <div ref={wrapRef} className="relative">
      <div className="relative">
        <input
          className={`${INP} ${error ? 'border-red-300 focus:border-red-400 focus:ring-red-400/20' : ''}`}
          value={inputValue}
          onChange={(e) => handleType(e.target.value)}
          placeholder="Type name or mobile to search, or enter a new patient name…"
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
            Existing patients — click to autofill
          </div>
          {results.map((p) => (
            <button key={p.id} type="button" onClick={() => pick(p)}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-blue-50">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">
                {(p.firstName?.[0] ?? '?').toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-slate-900">
                  {p.firstName}{p.lastName ? ` ${p.lastName}` : ''}
                </div>
                <div className="font-mono text-[11px] text-slate-400">
                  {p.uhid} · {p.mobile}{p.age != null ? ` · ${p.age} yrs` : ''}
                  {p.city ? ` · ${p.city}` : ''}
                </div>
              </div>
              <span className="shrink-0 text-[10px] font-semibold text-blue-600">Select →</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── VIP slot numbers ─────────────────────────────────────────────────────────
const VIP_SLOTS = [1, 2, 10, 15, 20];

// ─── Token grid ───────────────────────────────────────────────────────────────
// Renders tokens 1–70. Taken tokens are red/disabled. Selected is blue.
// VIP slots (available, not selected) are orange.

function TokenGrid({ bookedTokens, selectedToken, onSelect, loading, disabled }) {
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50/60 p-3">
      {loading ? (
        <p className="py-4 text-center text-xs text-slate-400">
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
                disabled={taken || disabled}
                onClick={() => onSelect(n)}
                className={[
                  'rounded py-2 text-xs font-bold transition select-none',
                  taken
                    ? 'cursor-not-allowed bg-red-500 text-white opacity-80'
                    : selected
                    ? 'bg-blue-600 text-white shadow-sm ring-2 ring-blue-400 ring-offset-1'
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
      {!loading && !disabled && (
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          {bookedTokens.length > 0 && (
            <p className="text-[10px] text-slate-400">
              {bookedTokens.length} token{bookedTokens.length !== 1 ? 's' : ''} already booked today
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

// ─── OP Number success overlay ────────────────────────────────────────────────

function OpNumberSuccess({ opNumber, patientName, isNew, isFollowUp, fee, onClose }) {
  const tokenNum = parseInt(opNumber.split('-').pop(), 10);
  return (
    <div className="max-w-sm mx-auto rounded-2xl shadow-2xl bg-white p-8 text-center">
      <div className="flex justify-center mb-4">
        <div className={`flex h-16 w-16 items-center justify-center rounded-full ${isFollowUp ? 'bg-amber-100' : 'bg-emerald-100'}`}>
          <CheckCircleIcon color={isFollowUp ? '#d97706' : '#059669'} size={40} />
        </div>
      </div>

      <p className="text-xl font-bold text-slate-900">Appointment Booked!</p>
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

      <div className="mt-4 rounded-2xl border-2 border-dashed border-blue-200 bg-blue-50 px-8 py-5">
        <p className="text-[10px] font-bold uppercase tracking-widest text-blue-400">Queue Token</p>
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
            ₹{parseFloat(fee).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </span>
        </div>
      ) : null}

      <button onClick={onClose}
        className="mt-6 w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700">
        Done
      </button>
    </div>
  );
}

// ─── Main modal ───────────────────────────────────────────────────────────────

const EMPTY = {
  selectedPatient: null,
  patientName:     '',
  mobile:          '',
  age:             '',
  city:            '',
  doctorId:        '',
  appointmentDate: '',
  tokenNumber:     null,
};

export function BookAppointment({ open, onClose, initialDate = '' }) {
  const [form, setForm]                   = useState({ ...EMPTY, appointmentDate: initialDate || today() });
  const [doctors, setDoctors]             = useState([]);
  const [bookedTokens, setBookedTokens]   = useState([]);
  const [tokensLoading, setTokensLoading] = useState(false);
  const [busy, setBusy]                   = useState(false);
  const [errors, setErrors]               = useState({});
  const [globalErr, setGlobalErr]         = useState('');
  const [success, setSuccess]             = useState(null); // { opNumber, patientName, isNew, isFollowUp, fee }

  // Reset form when modal opens
  useEffect(() => {
    if (!open) return;
    setForm({ ...EMPTY, appointmentDate: initialDate || today() });
    setErrors({});
    setGlobalErr('');
    setSuccess(null);
    setBookedTokens([]);
    api.get('/doctors', { params: { pageSize: 100, isActive: 'true' } })
      .then(({ data }) => setDoctors(data.data.items))
      .catch(() => {});
  }, [open, initialDate]);

  // Fetch booked tokens whenever doctor or date changes
  useEffect(() => {
    if (!form.doctorId || !form.appointmentDate) {
      setBookedTokens([]);
      return;
    }
    let cancelled = false;
    setTokensLoading(true);
    // Clear token selection whenever doctor or date changes
    setForm((f) => ({ ...f, tokenNumber: null }));
    getBookedTokens({ doctorId: form.doctorId, date: form.appointmentDate })
      .then(({ data }) => { if (!cancelled) setBookedTokens(data.data.bookedTokens ?? []); })
      .catch(() => { if (!cancelled) setBookedTokens([]); })
      .finally(() => { if (!cancelled) setTokensLoading(false); });
    return () => { cancelled = true; };
  }, [form.doctorId, form.appointmentDate]); // eslint-disable-line react-hooks/exhaustive-deps

  function set(k, v) {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => ({ ...e, [k]: '' }));
  }

  function handlePatientSelect(p) {
    if (!p) {
      setForm((f) => ({ ...f, selectedPatient: null, patientName: '', mobile: '', age: '', city: '' }));
    } else {
      const displayName = `${p.firstName}${p.lastName ? ` ${p.lastName}` : ''}`;
      setForm((f) => ({
        ...f,
        selectedPatient: p,
        patientName:     displayName,
        mobile:          p.mobile || f.mobile,
        age:             p.age != null ? String(p.age) : f.age,
        city:            p.city   || f.city,
      }));
    }
    setErrors((e) => ({ ...e, patientName: '', mobile: '', age: '', city: '' }));
  }

  function validate() {
    const e = {};
    if (!form.selectedPatient && !form.patientName.trim())
      e.patientName = 'Enter a patient name or select from search.';
    if (!form.mobile.trim())                    e.mobile          = 'Mobile number is required.';
    if (form.age === '' || form.age == null)    e.age             = 'Age is required.';
    if (!form.city.trim())                      e.city            = 'Place/City is required.';
    if (!form.doctorId)                         e.doctorId        = 'Select a doctor.';
    if (!form.appointmentDate)                  e.appointmentDate = 'Date is required.';
    if (!form.tokenNumber)                      e.tokenNumber     = 'Select a token number from the grid.';
    return e;
  }

  async function onSubmit(e) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setBusy(true);
    setGlobalErr('');
    try {
      let opNumber, patientName, isNew = false, isFollowUp = false, fee = null;

      if (form.selectedPatient) {
        // ── Existing patient path ──────────────────────────────────────────────
        const { data } = await bookAppointment({
          patientId:       form.selectedPatient.id,
          doctorId:        form.doctorId,
          appointmentDate: form.appointmentDate,
          tokenNumber:     form.tokenNumber,
        });
        const appt = data.data.appointment;
        opNumber    = appt.opNumber;
        patientName = form.patientName;
        isFollowUp  = appt.isFollowUp;
        fee         = parseFloat(appt.consultationFee);
      } else {
        // ── New / find-or-create patient path ─────────────────────────────────
        const { data } = await quickBookAppointment({
          patientName:     form.patientName.trim(),
          mobile:          form.mobile.trim(),
          age:             parseInt(form.age, 10),
          city:            form.city.trim(),
          doctorId:        form.doctorId,
          appointmentDate: form.appointmentDate,
          tokenNumber:     form.tokenNumber,
        });
        const appt = data.data.appointment;
        opNumber    = data.data.opNumber;
        patientName = data.data.patient?.firstName
          ? `${data.data.patient.firstName}${data.data.patient.lastName ? ` ${data.data.patient.lastName}` : ''}`
          : form.patientName.trim();
        isNew       = data.data.isNewPatient;
        isFollowUp  = appt.isFollowUp;
        fee         = parseFloat(appt.consultationFee);
      }

      setSuccess({ opNumber, patientName, isNew, isFollowUp, fee });
    } catch (err) {
      setGlobalErr(extractError(err));
    } finally {
      setBusy(false);
    }
  }

  const tokenGridReady = !!(form.doctorId && form.appointmentDate);

  return (
    <Modal
      open={open}
      onClose={() => !busy && onClose(false)}
      title={success ? '' : 'Book Appointment'}
      size={success ? 'sm' : '5xl'}
      transparent={!!success}
      footer={success ? null : (
        <>
          <Button variant="secondary" size="md" type="button" onClick={() => onClose(false)} disabled={busy}>
            Cancel
          </Button>
          <button type="submit" form="book-appt-form" disabled={busy}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500/50 disabled:opacity-60">
            {busy ? <><SpinnerIcon /> Booking…</> : 'Book Appointment'}
          </button>
        </>
      )}
    >
      {success ? (
        <OpNumberSuccess
          opNumber={success.opNumber}
          patientName={success.patientName}
          isNew={success.isNew}
          isFollowUp={success.isFollowUp}
          fee={success.fee}
          onClose={() => onClose(true)}
        />
      ) : (
        <form id="book-appt-form" onSubmit={onSubmit} className="space-y-4">
          {globalErr && (
            <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3.5 py-3 text-sm font-medium text-red-700">
              <WarnIcon /> {globalErr}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* ── Left: All form fields ── */}
            <div className="space-y-3">
              <FF label="Patient" required error={errors.patientName}>
                <PatientAutocomplete
                  selectedPatient={form.selectedPatient}
                  inputValue={form.patientName}
                  onInputChange={(v) => set('patientName', v)}
                  onSelect={handlePatientSelect}
                  error={errors.patientName}
                />
              </FF>
              <div className="grid grid-cols-3 gap-3">
                <FF label="Mobile Number" required error={errors.mobile}>
                  <input className={INP} value={form.mobile} type="tel"
                    onChange={(e) => set('mobile', e.target.value)}
                    placeholder="9876543210" />
                </FF>
                <FF label="Age (years)" required error={errors.age}>
                  <input className={INP} value={form.age} type="number" min="0" max="150"
                    onChange={(e) => set('age', e.target.value)}
                    placeholder="35" />
                </FF>
                <FF label="City / Place" required error={errors.city}>
                  <input className={INP} value={form.city}
                    onChange={(e) => set('city', e.target.value)}
                    placeholder="e.g. Kochi" />
                </FF>
              </div>
              <FF label="Doctor" required error={errors.doctorId}>
                <select className={INP} value={form.doctorId} onChange={(e) => set('doctorId', e.target.value)}>
                  <option value="">— Select doctor —</option>
                  {doctors.map((d) => (
                    <option key={d.id} value={d.id}>{d.name} · {d.specialization}</option>
                  ))}
                </select>
              </FF>
              <FF label="Date" required error={errors.appointmentDate}>
                <input type="date" className={INP} value={form.appointmentDate} min={today()}
                  onChange={(e) => set('appointmentDate', e.target.value)} />
              </FF>
            </div>

            {/* ── Right: Token selection panel ── */}
            <div className="flex flex-col rounded-xl border-2 border-dashed border-blue-200 bg-blue-50/30 p-4">
              <p className="mb-3 text-[11px] font-bold uppercase tracking-widest text-blue-600">Token Selection</p>
              <FF
                label="Select Token"
                required
                error={errors.tokenNumber}
                hint={!tokenGridReady ? 'Select a doctor and date first to see available tokens' : undefined}
              >
                <TokenGrid
                  bookedTokens={bookedTokens}
                  selectedToken={form.tokenNumber}
                  onSelect={(n) => set('tokenNumber', n)}
                  loading={tokensLoading}
                  disabled={!tokenGridReady}
                />
              </FF>
            </div>
          </div>
        </form>
      )}
    </Modal>
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
function SpinnerIcon() {
  return <svg width="14" height="14" viewBox="0 0 16 16" className="animate-spin" fill="none"><circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" strokeDasharray="18 20" strokeLinecap="round" /></svg>;
}
function CheckCircleIcon({ color = '#059669', size = 36 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><path d="M7 13l3 3 7-7" /></svg>;
}
