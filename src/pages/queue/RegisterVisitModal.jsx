import { useEffect, useRef, useState } from 'react';
import { extractError } from '../../lib/api';
import { searchPatients } from '../../api/patients.api';
import { registerVisit } from '../../api/visits.api';
import { api } from '../../lib/api';
import { Modal } from '../../components/Modal';
import { Button } from '../../components/Button';

// ─── Shared styles ────────────────────────────────────────────────────────────

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
        : hint ? <p className="text-[11px] text-slate-400">{hint}</p>
        : null}
    </div>
  );
}

// ─── Patient typeahead (same pattern as BookAppointment) ──────────────────────

function PatientSearch({ value, onChange }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [fetching, setFetching] = useState(false);
  const debounceRef = useRef(null);
  const wrapRef = useRef(null);

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
      } catch { /* ignore */ } finally { setFetching(false); }
    }, 280);
  }

  function select(p) { onChange(p); setQ(''); setOpen(false); setResults([]); }
  function clear() { onChange(null); setQ(''); setResults([]); setOpen(false); }

  if (value) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 px-3.5 py-2.5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
          {(value.firstName?.[0] ?? '?').toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-slate-900 truncate">
            {value.firstName}{value.lastName ? ` ${value.lastName}` : ''}
          </div>
          <div className="text-[11px] text-slate-500 font-mono">{value.uhid} · {value.mobile}</div>
        </div>
        <button type="button" onClick={clear} className="shrink-0 text-slate-400 hover:text-slate-700 p-0.5">
          <XIcon />
        </button>
      </div>
    );
  }

  return (
    <div ref={wrapRef} className="relative">
      <div className="relative">
        <input className={INP} value={q} onChange={(e) => handleInput(e.target.value)}
          placeholder="Search name, mobile, or UHID…" autoComplete="off" />
        {fetching && <span className="absolute right-3 top-1/2 -translate-y-1/2"><SpinnerIcon /></span>}
      </div>
      {open && results.length > 0 && (
        <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
          {results.map((p) => (
            <button key={p.id} type="button" onClick={() => select(p)}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-blue-50 transition-colors">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-bold text-slate-600">
                {(p.firstName?.[0] ?? '?').toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-slate-900 truncate">
                  {p.firstName}{p.lastName ? ` ${p.lastName}` : ''}
                </div>
                <div className="text-[11px] text-slate-400 font-mono">{p.uhid} · {p.mobile} · {p.age ?? '?'}y</div>
              </div>
            </button>
          ))}
        </div>
      )}
      {open && !fetching && results.length === 0 && q.trim().length >= 2 && (
        <div className="absolute z-30 mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-xl text-sm text-slate-500">
          No patients found.
        </div>
      )}
    </div>
  );
}

// ─── Main modal ───────────────────────────────────────────────────────────────

const EMPTY = {
  patient: null, doctorId: '', visitDate: '', chiefComplaint: '',
  bloodPressure: '', pulse: '', temperature: '', weight: '', spo2: '',
};

export function RegisterVisitModal({ open, onClose }) {
  const [form, setForm] = useState(EMPTY);
  const [doctors, setDoctors] = useState([]);
  const [showVitals, setShowVitals] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState({});
  const [globalErr, setGlobalErr] = useState('');

  useEffect(() => {
    if (!open) return;
    setForm({ ...EMPTY, visitDate: todayStr() });
    setErrors({});
    setGlobalErr('');
    setShowVitals(false);
    api.get('/doctors', { params: { pageSize: 100, isActive: 'true' } })
      .then(({ data }) => setDoctors(data.data.items))
      .catch(() => {});
  }, [open]);

  function set(k, v) { setForm((f) => ({ ...f, [k]: v })); setErrors((e) => ({ ...e, [k]: '' })); }

  function validate() {
    const e = {};
    if (!form.patient) e.patient = 'Select a patient.';
    if (!form.doctorId) e.doctorId = 'Select a doctor.';
    if (!form.visitDate) e.visitDate = 'Date is required.';
    return e;
  }

  async function onSubmit(e) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setBusy(true);
    setGlobalErr('');
    try {
      const payload = {
        patientId: form.patient.id,
        doctorId: form.doctorId,
        visitDate: form.visitDate,
        chiefComplaint: form.chiefComplaint.trim() || undefined,
      };
      if (showVitals) {
        if (form.bloodPressure.trim()) payload.bloodPressure = form.bloodPressure.trim();
        if (form.pulse) payload.pulse = parseInt(form.pulse, 10);
        if (form.temperature) payload.temperature = parseFloat(form.temperature);
        if (form.weight) payload.weight = parseFloat(form.weight);
        if (form.spo2) payload.spo2 = parseInt(form.spo2, 10);
      }
      await registerVisit(payload);
      onClose(true);
    } catch (err) {
      setGlobalErr(extractError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={() => !busy && onClose(false)} title="Register OPD Visit" size="lg"
      footer={
        <>
          <Button variant="secondary" size="md" type="button" onClick={() => onClose(false)} disabled={busy}>Cancel</Button>
          <button type="submit" form="register-visit-form" disabled={busy}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500/50 disabled:opacity-60">
            {busy ? <><SpinnerIcon /> Registering…</> : 'Register Visit'}
          </button>
        </>
      }
    >
      <form id="register-visit-form" onSubmit={onSubmit} className="space-y-4">
        {globalErr && (
          <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3.5 py-3 text-sm font-medium text-red-700">
            <WarnIcon /> {globalErr}
          </div>
        )}

        <FF label="Patient" required error={errors.patient}>
          <PatientSearch value={form.patient} onChange={(p) => set('patient', p)} />
        </FF>

        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <FF label="Doctor" required error={errors.doctorId}>
              <select className={INP} value={form.doctorId} onChange={(e) => set('doctorId', e.target.value)}>
                <option value="">— Select doctor —</option>
                {doctors.map((d) => (
                  <option key={d.id} value={d.id}>{d.name} · {d.specialization}{d.roomNo ? ` (${d.roomNo})` : ''}</option>
                ))}
              </select>
            </FF>
          </div>
          <FF label="Visit date" required error={errors.visitDate}>
            <input type="date" className={INP} value={form.visitDate} max={todayStr()}
              onChange={(e) => set('visitDate', e.target.value)} />
          </FF>
          <FF label="Chief complaint">
            <input className={INP} value={form.chiefComplaint}
              onChange={(e) => set('chiefComplaint', e.target.value)} placeholder="e.g. Fever, chest pain" />
          </FF>
        </div>

        {/* Vitals toggle */}
        <div>
          <button type="button" onClick={() => setShowVitals((v) => !v)}
            className="flex items-center gap-2 text-xs font-semibold text-blue-600 hover:text-blue-800 transition">
            {showVitals ? <ChevronDownIcon /> : <ChevronRightIcon />}
            {showVitals ? 'Hide Initial Vitals' : 'Add Initial Vitals (optional)'}
          </button>

          {showVitals && (
            <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50/60 p-4 space-y-3">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">Vitals at Check-in</p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <FF label="Blood Pressure" hint='"120/80"'>
                  <input className={INP} value={form.bloodPressure} placeholder="120/80"
                    onChange={(e) => set('bloodPressure', e.target.value)} />
                </FF>
                <FF label="Pulse (bpm)">
                  <input type="number" min="20" max="300" className={INP} value={form.pulse} placeholder="72"
                    onChange={(e) => set('pulse', e.target.value)} />
                </FF>
                <FF label="SpO₂ (%)">
                  <input type="number" min="0" max="100" className={INP} value={form.spo2} placeholder="98"
                    onChange={(e) => set('spo2', e.target.value)} />
                </FF>
                <FF label="Temperature (°C)">
                  <input type="number" step="0.1" min="30" max="45" className={INP} value={form.temperature} placeholder="37.0"
                    onChange={(e) => set('temperature', e.target.value)} />
                </FF>
                <FF label="Weight (kg)">
                  <input type="number" step="0.1" min="0" max="500" className={INP} value={form.weight} placeholder="65.0"
                    onChange={(e) => set('weight', e.target.value)} />
                </FF>
              </div>
            </div>
          )}
        </div>
      </form>
    </Modal>
  );
}

function todayStr() { return new Date().toISOString().split('T')[0]; }
function XIcon() { return <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3l10 10M13 3L3 13" /></svg>; }
function WarnIcon() { return <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M8 1a.5.5 0 0 1 .44.26l6.5 12A.5.5 0 0 1 14.5 14H1.5a.5.5 0 0 1-.44-.74l6.5-12A.5.5 0 0 1 8 1zm0 4.5a.75.75 0 0 0-.75.75v3a.75.75 0 0 0 1.5 0v-3A.75.75 0 0 0 8 5.5zm0 6.5a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5z" /></svg>; }
function SpinnerIcon() { return <svg width="14" height="14" viewBox="0 0 16 16" className="animate-spin" fill="none"><circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" strokeDasharray="18 20" strokeLinecap="round" /></svg>; }
function ChevronRightIcon() { return <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 4l4 4-4 4" /></svg>; }
function ChevronDownIcon() { return <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 6l4 4 4-4" /></svg>; }
