import { useEffect, useRef, useState } from 'react';
import { extractError } from '../../lib/api';
import { searchPatients } from '../../api/patients.api';
import { bookAppointment } from '../../api/appointments.api';
import { api } from '../../lib/api';
import { Modal } from '../../components/Modal';
import { Button } from '../../components/Button';

// ─── Shared input class (blue focus ring, consistent height) ──────────────────
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

// ─── Patient typeahead ────────────────────────────────────────────────────────

function PatientSearch({ value, onChange }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [fetching, setFetching] = useState(false);
  const debounceRef = useRef(null);
  const wrapRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handler(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  function handleInput(v) {
    setQ(v);
    clearTimeout(debounceRef.current);
    if (!v.trim()) { setResults([]); setOpen(false); return; }
    debounceRef.current = setTimeout(async () => {
      setFetching(true);
      try {
        const { data } = await searchPatients({ q: v.trim(), limit: 10 });
        setResults(data.data.patients);
        setOpen(true);
      } catch { /* ignore */ }
      finally { setFetching(false); }
    }, 280);
  }

  function selectPatient(p) {
    onChange(p);
    setQ('');
    setOpen(false);
    setResults([]);
  }

  function clear() { onChange(null); setQ(''); setResults([]); setOpen(false); }

  if (value) {
    return (
      <div className="flex items-center gap-2.5 rounded-lg border border-blue-200 bg-blue-50 px-3.5 py-2.5">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
          {(value.firstName?.[0] ?? '?').toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-slate-900 truncate">
            {value.firstName}{value.lastName ? ` ${value.lastName}` : ''}
          </div>
          <div className="text-[11px] text-slate-500 font-mono">{value.uhid} · {value.mobile}</div>
        </div>
        <button type="button" onClick={clear} className="shrink-0 rounded p-0.5 text-slate-400 hover:bg-blue-100 hover:text-slate-700">
          <XIcon />
        </button>
      </div>
    );
  }

  return (
    <div ref={wrapRef} className="relative">
      <div className="relative">
        <input
          className={INP}
          value={q}
          onChange={(e) => handleInput(e.target.value)}
          placeholder="Search by name, mobile, or UHID…"
          autoComplete="off"
        />
        {fetching && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2">
            <SpinnerIcon />
          </span>
        )}
      </div>
      {open && results.length > 0 && (
        <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
          {results.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => selectPatient(p)}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-blue-50 transition-colors"
            >
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-bold text-slate-600">
                {(p.firstName?.[0] ?? '?').toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-slate-900 truncate">
                  {p.firstName}{p.lastName ? ` ${p.lastName}` : ''}
                </div>
                <div className="text-[11px] text-slate-400 font-mono">{p.uhid} · {p.mobile} · {p.age ?? '?'} yrs</div>
              </div>
            </button>
          ))}
        </div>
      )}
      {open && results.length === 0 && !fetching && q.trim().length >= 2 && (
        <div className="absolute z-30 mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-xl text-sm text-slate-500">
          No patients found.
        </div>
      )}
    </div>
  );
}

// ─── Main modal ───────────────────────────────────────────────────────────────

const EMPTY = {
  patient: null,
  doctorId: '',
  appointmentDate: '',
  appointmentTime: '',
  type: 'BOOKED',
  isFollowUp: false,
  notes: '',
};

export function BookAppointment({ open, onClose, initialDate = '' }) {
  const [form, setForm] = useState({ ...EMPTY, appointmentDate: initialDate || today() });
  const [doctors, setDoctors] = useState([]);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState({});
  const [globalErr, setGlobalErr] = useState('');

  // Fetch active doctors once when modal opens
  useEffect(() => {
    if (!open) return;
    setForm({ ...EMPTY, appointmentDate: initialDate || today() });
    setErrors({});
    setGlobalErr('');
    api.get('/doctors', { params: { pageSize: 100, isActive: 'true' } })
      .then(({ data }) => setDoctors(data.data.items))
      .catch(() => {});
  }, [open, initialDate]);

  function set(k, v) {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => ({ ...e, [k]: '' }));
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
    if (!form.patient) e.patient = 'Select a patient.';
    if (!form.doctorId) e.doctorId = 'Select a doctor.';
    if (!form.appointmentDate) e.appointmentDate = 'Date is required.';
    if (!form.appointmentTime) e.appointmentTime = 'Time is required.';
    return e;
  }

  async function onSubmit(e) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setBusy(true);
    setGlobalErr('');
    try {
      await bookAppointment({
        patientId:       form.patient.id,
        doctorId:        form.doctorId,
        appointmentDate: form.appointmentDate,
        appointmentTime: form.appointmentTime,
        type:            form.type,
        isFollowUp:      form.isFollowUp,
        notes:           form.notes.trim() || undefined,
      });
      onClose(true);
    } catch (err) {
      setGlobalErr(extractError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => !busy && onClose(false)}
      title="Book Appointment"
      size="lg"
      footer={
        <>
          <Button variant="secondary" size="md" type="button" onClick={() => onClose(false)} disabled={busy}>
            Cancel
          </Button>
          <button
            type="submit"
            form="book-appt-form"
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500/50 disabled:opacity-60"
          >
            {busy ? <><SpinnerIcon /> Booking…</> : 'Book Appointment'}
          </button>
        </>
      }
    >
      <form id="book-appt-form" onSubmit={onSubmit} className="space-y-4">
        {globalErr && (
          <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3.5 py-3 text-sm font-medium text-red-700">
            <WarnIcon /> {globalErr}
          </div>
        )}

        {/* Patient */}
        <FF label="Patient" required error={errors.patient}>
          <PatientSearch value={form.patient} onChange={(p) => set('patient', p)} />
        </FF>

        <div className="grid grid-cols-3 gap-3">
          {/* Doctor */}
          <div className="col-span-3">
            <FF label="Doctor" required error={errors.doctorId}>
              <select
                className={INP}
                value={form.doctorId}
                onChange={(e) => set('doctorId', e.target.value)}
              >
                <option value="">— Select doctor —</option>
                {doctors.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} · {d.specialization}
                  </option>
                ))}
              </select>
            </FF>
          </div>

          {/* Date */}
          <div className="col-span-2">
            <FF label="Date" required error={errors.appointmentDate}>
              <input
                type="date"
                className={INP}
                value={form.appointmentDate}
                min={today()}
                onChange={(e) => set('appointmentDate', e.target.value)}
              />
            </FF>
          </div>

          {/* Time */}
          <FF label="Time" required error={errors.appointmentTime}>
            <input
              type="time"
              className={INP}
              value={form.appointmentTime}
              onChange={(e) => set('appointmentTime', e.target.value)}
            />
          </FF>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {/* Type */}
          <FF label="Type">
            <select className={INP} value={form.type} onChange={(e) => set('type', e.target.value)}>
              <option value="BOOKED">Pre-Booked</option>
              <option value="WALK_IN">Walk-in</option>
            </select>
          </FF>

          {/* Fee preview */}
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-slate-600">Fee Snapshot</span>
            <div className="flex h-[42px] items-center gap-2 rounded-lg border border-slate-100 bg-slate-50 px-3.5">
              <span className="text-sm font-bold text-slate-700">
                {previewFee() ?? <span className="font-normal text-slate-400">Select doctor</span>}
              </span>
              {selectedDoctor() && (
                <span className="text-[11px] text-slate-400">
                  {form.isFollowUp ? '(follow-up)' : '(consultation)'}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Follow-up toggle */}
        <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-100 bg-slate-50/60 px-4 py-3">
          <input
            type="checkbox"
            checked={form.isFollowUp}
            onChange={(e) => set('isFollowUp', e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
          />
          <div>
            <div className="text-sm font-semibold text-slate-700">Follow-up visit</div>
            <div className="text-[11px] text-slate-400">Uses follow-up fee instead of consultation fee</div>
          </div>
        </label>

        {/* Notes */}
        <FF label="Notes">
          <textarea
            className={`${INP} resize-none`}
            rows={2}
            value={form.notes}
            onChange={(e) => set('notes', e.target.value)}
            placeholder="Any relevant notes…"
          />
        </FF>
      </form>
    </Modal>
  );
}

// ─── Tiny helpers ─────────────────────────────────────────────────────────────

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
