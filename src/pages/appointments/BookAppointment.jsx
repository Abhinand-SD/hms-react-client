import { useEffect, useRef, useState } from 'react';
import { extractError } from '../../lib/api';
import { searchPatients } from '../../api/patients.api';
import { bookAppointment, quickBookAppointment } from '../../api/appointments.api';
import { api } from '../../lib/api';
import { Modal } from '../../components/Modal';
import { Button } from '../../components/Button';

const INP = 'block w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:bg-slate-50 disabled:text-slate-400';

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
  const [results, setResults] = useState([]);
  const [open, setOpen]       = useState(false);
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

  function pick(p) {
    onSelect(p);
    setOpen(false);
    setResults([]);
  }

  function clear() {
    onSelect(null);
    setOpen(false);
    setResults([]);
  }

  // ── Selected chip ──────────────────────────────────────────────────────────
  if (selectedPatient) {
    return (
      <div className={`flex items-center gap-2.5 rounded-lg border px-3.5 py-2.5 ${error ? 'border-red-300 bg-red-50' : 'border-blue-200 bg-blue-50'}`}>
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
          {(selectedPatient.firstName?.[0] ?? '?').toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-slate-900 truncate">
            {selectedPatient.firstName}{selectedPatient.lastName ? ` ${selectedPatient.lastName}` : ''}
          </div>
          <div className="text-[11px] font-mono text-slate-500">
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

  // ── Search input + dropdown ────────────────────────────────────────────────
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
                <div className="text-sm font-semibold text-slate-900 truncate">
                  {p.firstName}{p.lastName ? ` ${p.lastName}` : ''}
                </div>
                <div className="text-[11px] font-mono text-slate-400">
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

// ─── OP Number success overlay ────────────────────────────────────────────────

function OpNumberSuccess({ opNumber, patientName, isNew, onClose }) {
  return (
    <div className="flex flex-col items-center gap-5 py-4 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-100">
        <CheckCircleIcon />
      </div>
      <div>
        <p className="text-lg font-bold text-slate-900">Appointment Booked!</p>
        {isNew && (
          <p className="mt-0.5 text-xs font-medium text-amber-600">New patient record created</p>
        )}
        <p className="mt-2 text-sm text-slate-500">
          Patient: <span className="font-semibold text-slate-800">{patientName}</span>
        </p>
      </div>
      <div className="rounded-2xl border-2 border-dashed border-blue-300 bg-blue-50 px-8 py-4">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-blue-500">OP Number</p>
        <p className="mt-1 font-mono text-3xl font-black tracking-wider text-blue-700">{opNumber}</p>
        <p className="mt-1 text-[11px] text-slate-400">Share this number with the patient</p>
      </div>
      <button onClick={onClose}
        className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700">
        Done
      </button>
    </div>
  );
}

// ─── Main modal ───────────────────────────────────────────────────────────────

const EMPTY = {
  // Patient state
  selectedPatient: null,  // full patient object when autofilled from search
  patientName: '',        // typed text (becomes patientName for new-patient path)
  mobile: '',             // autofills from selectedPatient, stays editable
  city: '',               // autofills from selectedPatient, stays editable
  // Visit
  doctorId: '',
  appointmentDate: '',
  isFollowUp: false,
  notes: '',
};

export function BookAppointment({ open, onClose, initialDate = '' }) {
  const [form, setForm]       = useState({ ...EMPTY, appointmentDate: initialDate || today() });
  const [doctors, setDoctors] = useState([]);
  const [busy, setBusy]       = useState(false);
  const [errors, setErrors]   = useState({});
  const [globalErr, setGlobalErr] = useState('');
  const [success, setSuccess] = useState(null); // { opNumber, patientName, isNew }

  useEffect(() => {
    if (!open) return;
    setForm({ ...EMPTY, appointmentDate: initialDate || today() });
    setErrors({});
    setGlobalErr('');
    setSuccess(null);
    api.get('/doctors', { params: { pageSize: 100, isActive: 'true' } })
      .then(({ data }) => setDoctors(data.data.items))
      .catch(() => {});
  }, [open, initialDate]);

  function set(k, v) {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => ({ ...e, [k]: '' }));
  }

  // Called when a patient is selected from the autocomplete dropdown
  function handlePatientSelect(p) {
    if (!p) {
      // Clear selection — reset autofilled fields
      setForm((f) => ({ ...f, selectedPatient: null, patientName: '', mobile: '', city: '' }));
    } else {
      // Autofill from selected patient
      const displayName = `${p.firstName}${p.lastName ? ` ${p.lastName}` : ''}`;
      setForm((f) => ({
        ...f,
        selectedPatient: p,
        patientName:     displayName,
        mobile:          p.mobile  || f.mobile,
        city:            p.city    || f.city,
      }));
    }
    setErrors((e) => ({ ...e, patientName: '', mobile: '' }));
  }

  function selectedDoctor() {
    return doctors.find((d) => d.id === form.doctorId);
  }

  function previewFee() {
    const d = selectedDoctor();
    if (!d) return null;
    const fee = form.isFollowUp ? d.followUpFee : d.consultationFee;
    return `₹${parseFloat(fee).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
  }

  function validate() {
    const e = {};
    if (!form.selectedPatient && !form.patientName.trim()) {
      e.patientName = 'Enter a patient name or select from search.';
    }
    if (!form.mobile.trim()) e.mobile = 'Mobile number is required.';
    if (!form.doctorId)      e.doctorId = 'Select a doctor.';
    if (!form.appointmentDate) e.appointmentDate = 'Date is required.';
    return e;
  }

  async function onSubmit(e) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setBusy(true);
    setGlobalErr('');
    try {
      let opNumber, patientName, isNew = false;

      if (form.selectedPatient) {
        // ── Existing patient path ──────────────────────────────────────────
        const { data } = await bookAppointment({
          patientId:       form.selectedPatient.id,
          doctorId:        form.doctorId,
          appointmentDate: form.appointmentDate,
          isFollowUp:      form.isFollowUp,
          notes:           form.notes?.trim() || undefined,
        });
        opNumber    = data.data.appointment.opNumber;
        patientName = form.patientName;
      } else {
        // ── New patient path (find-or-create by mobile) ────────────────────
        const { data } = await quickBookAppointment({
          patientName:     form.patientName.trim(),
          mobile:          form.mobile.trim(),
          city:            form.city?.trim() || undefined,
          doctorId:        form.doctorId,
          appointmentDate: form.appointmentDate,
          isFollowUp:      form.isFollowUp,
        });
        opNumber    = data.data.opNumber;
        patientName = data.data.patient?.firstName
          ? `${data.data.patient.firstName}${data.data.patient.lastName ? ` ${data.data.patient.lastName}` : ''}`
          : form.patientName.trim();
        isNew = data.data.isNewPatient;
      }

      setSuccess({ opNumber, patientName, isNew });
    } catch (err) {
      setGlobalErr(extractError(err));
    } finally {
      setBusy(false);
    }
  }

  const doc = selectedDoctor();

  return (
    <Modal
      open={open}
      onClose={() => !busy && onClose(false)}
      title="Book Appointment"
      size="lg"
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
          onClose={() => onClose(true)}
        />
      ) : (
        <form id="book-appt-form" onSubmit={onSubmit} className="space-y-4">
          {globalErr && (
            <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3.5 py-3 text-sm font-medium text-red-700">
              <WarnIcon /> {globalErr}
            </div>
          )}

          {/* ── Patient (smart autocomplete) ── */}
          <FF label="Patient" required error={errors.patientName}>
            <PatientAutocomplete
              selectedPatient={form.selectedPatient}
              inputValue={form.patientName}
              onInputChange={(v) => set('patientName', v)}
              onSelect={handlePatientSelect}
              error={errors.patientName}
            />
          </FF>

          {/* Mobile + City — visible always; autofill from selection */}
          <div className="grid grid-cols-2 gap-3">
            <FF label="Mobile Number" required error={errors.mobile}>
              <input className={INP} value={form.mobile} type="tel"
                onChange={(e) => set('mobile', e.target.value)}
                placeholder="9876543210" />
            </FF>
            <FF label="City / Place">
              <input className={INP} value={form.city}
                onChange={(e) => set('city', e.target.value)}
                placeholder="e.g. Kochi" />
            </FF>
          </div>

          {/* ── Doctor ── */}
          <FF label="Doctor" required error={errors.doctorId}>
            <select className={INP} value={form.doctorId} onChange={(e) => set('doctorId', e.target.value)}>
              <option value="">— Select doctor —</option>
              {doctors.map((d) => (
                <option key={d.id} value={d.id}>{d.name} · {d.specialization}</option>
              ))}
            </select>
          </FF>

          {/* ── Date ── */}
          <FF label="Date" required error={errors.appointmentDate}>
            <input type="date" className={INP} value={form.appointmentDate} min={today()}
              onChange={(e) => set('appointmentDate', e.target.value)} />
          </FF>

          {/* ── Follow-up + Fee preview ── */}
          <div className="flex items-center justify-between gap-4">
            <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-100 bg-slate-50/60 px-4 py-3 flex-1">
              <input type="checkbox" checked={form.isFollowUp}
                onChange={(e) => set('isFollowUp', e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
              <div>
                <div className="text-sm font-semibold text-slate-700">Follow-up visit</div>
                <div className="text-[11px] text-slate-400">Uses follow-up fee</div>
              </div>
            </label>
            {doc && (
              <div className="shrink-0 text-right">
                <span className="block text-[11px] font-semibold uppercase tracking-wide text-slate-400">Fee</span>
                <span className="font-mono text-base font-bold text-slate-700">{previewFee()}</span>
                <span className="block text-[10px] text-slate-400">{form.isFollowUp ? 'follow-up' : 'consultation'}</span>
              </div>
            )}
          </div>

          {/* ── Notes (for existing patients only makes sense, but available always) ── */}
          <FF label="Notes">
            <textarea className={`${INP} resize-none`} rows={2}
              value={form.notes} onChange={(e) => set('notes', e.target.value)}
              placeholder="Any relevant notes…" />
          </FF>
        </form>
      )}
    </Modal>
  );
}

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
function CheckCircleIcon() {
  return <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><path d="M7 13l3 3 7-7" /></svg>;
}
