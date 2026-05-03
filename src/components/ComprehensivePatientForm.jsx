// Reusable comprehensive patient registration form.
// Layout: 2-column landscape — fits on a 1080p screen without vertical scrolling.
// Props:
//   formData        — object with all patient fields
//   onChange        — (key: string, value: string) => void
//   errors          — { [fieldKey]: string } validation errors
//   autoSearch      — (optional) when true, First Name input is a live-search combobox
//   onPatientSelect — (optional) callback(patient) fired when a patient is chosen from combobox

import { useEffect, useRef, useState } from 'react';
import { searchPatients } from '../api/patients.api';

const INP = 'block w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:bg-gray-50 disabled:text-gray-400';

// ─── Field wrapper ────────────────────────────────────────────────────────────
function FF({ label, required, error, hint, children }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
        {label}{required && <span className="ml-0.5 text-red-500">*</span>}
      </label>
      {children}
      {error
        ? <p className="text-[11px] font-medium text-red-600">⚠ {error}</p>
        : hint ? <p className="text-[10px] text-gray-400">{hint}</p> : null}
    </div>
  );
}

// ─── Section label ────────────────────────────────────────────────────────────
function SL({ icon, text }) {
  return (
    <div className="flex items-center gap-2 pb-2 border-b border-blue-100">
      <span className="text-blue-400">{icon}</span>
      <span className="text-xs font-bold uppercase tracking-widest text-blue-700">{text}</span>
    </div>
  );
}

// ─── Gender toggle ────────────────────────────────────────────────────────────
function GenderToggle({ value, onChange, error }) {
  return (
    <div className="flex gap-1.5 mt-0.5">
      {[['MALE', 'Male'], ['FEMALE', 'Female'], ['OTHER', 'Other']].map(([v, lbl]) => (
        <button key={v} type="button" onClick={() => onChange(v)}
          className={[
            'flex-1 rounded-lg py-2 text-xs font-semibold transition select-none',
            value === v
              ? 'bg-blue-600 text-white shadow-sm'
              : `bg-gray-100 text-gray-600 hover:bg-blue-50 hover:text-blue-700${error ? ' ring-1 ring-red-300' : ''}`,
          ].join(' ')}>
          {lbl}
        </button>
      ))}
    </div>
  );
}

// ─── DOB → Age ────────────────────────────────────────────────────────────────
function calcAge(dobStr) {
  if (!dobStr) return null;
  const birth = new Date(dobStr);
  if (isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age >= 0 ? age : null;
}

// ─── First Name combobox (used when autoSearch=true) ─────────────────────────
function NameCombobox({ value, onChange, onPatientSelect, error }) {
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
    onChange('firstName', v);
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
    onPatientSelect(p);
    setOpen(false);
    setResults([]);
  }

  return (
    <div ref={wrapRef} className="relative">
      <div className="relative">
        <input
          className={`${INP}${error ? ' border-red-300' : ''}`}
          value={value ?? ''}
          onChange={(e) => handleType(e.target.value)}
          placeholder="John  — type to search existing"
          autoComplete="off"
        />
        {fetching && (
          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400">
            <SpinnerIcon />
          </span>
        )}
      </div>
      {open && results.length > 0 && (
        <div className="absolute left-0 z-50 mt-1 w-[420px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
          <div className="border-b border-slate-100 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">
            Existing patients — click to autofill
          </div>
          {results.map((p) => (
            <button key={p.id} type="button" onClick={() => pick(p)}
              className="flex w-full items-center justify-between gap-3 border-b border-slate-50 px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-blue-50">
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-700">
                  {(p.firstName?.[0] ?? '?').toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-gray-900">
                    {p.firstName}{p.lastName ? ` ${p.lastName}` : ''}
                  </p>
                  <p className="truncate text-sm text-gray-500">
                    {p.uhid}
                    {p.mobile ? <> &bull; {p.mobile}</> : null}
                    {p.age != null ? <> &bull; {p.age} yrs</> : null}
                    {p.city ? <> &bull; {p.city}</> : null}
                  </p>
                </div>
              </div>
              <span className="shrink-0 rounded-md bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-600">
                Fill →
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export function ComprehensivePatientForm({
  formData,
  onChange,
  errors = {},
  autoSearch = false,
  onPatientSelect,
}) {
  function handleDobChange(value) {
    onChange('dob', value);
    const age = calcAge(value);
    if (age !== null) onChange('age', String(age));
  }

  return (
    <div className="bg-gray-50 rounded-xl p-5">
      <div className="grid grid-cols-2 gap-x-6 gap-y-0">

        {/* ── Left column: Personal + Contact ── */}
        <div className="space-y-4">

          {/* Personal Information */}
          <div>
            <SL icon={<PersonIcon />} text="Personal Information" />
            <div className="mt-3 grid grid-cols-3 gap-3">
              <FF label="First Name" required error={errors.firstName}>
                {autoSearch ? (
                  <NameCombobox
                    value={formData.firstName}
                    onChange={onChange}
                    onPatientSelect={onPatientSelect}
                    error={errors.firstName}
                  />
                ) : (
                  <input className={`${INP}${errors.firstName ? ' border-red-300' : ''}`}
                    value={formData.firstName ?? ''} placeholder="John"
                    onChange={(e) => onChange('firstName', e.target.value)}
                    autoComplete="given-name" />
                )}
              </FF>
              <FF label="Last Name" error={errors.lastName}>
                <input className={INP} value={formData.lastName ?? ''} placeholder="Smith"
                  onChange={(e) => onChange('lastName', e.target.value)}
                  autoComplete="family-name" />
              </FF>
              <FF label="Gender" required error={errors.gender}>
                <GenderToggle value={formData.gender ?? ''} onChange={(v) => onChange('gender', v)} error={errors.gender} />
              </FF>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <FF label="Date of Birth" error={errors.dob} hint="Age auto-fills on change">
                <input type="date" className={INP} value={formData.dob ?? ''}
                  onChange={(e) => handleDobChange(e.target.value)} />
              </FF>
              <FF label="Age (years)" error={errors.age}>
                <input type="number" min="0" max="150" className={INP} value={formData.age ?? ''}
                  onChange={(e) => onChange('age', e.target.value)} placeholder="35" />
              </FF>
            </div>
          </div>

          {/* Contact Details */}
          <div>
            <SL icon={<PhoneIcon />} text="Contact Details" />
            <div className="mt-3 grid grid-cols-3 gap-3">
              <FF label="Mobile" required error={errors.mobile}>
                <input type="tel" className={`${INP}${errors.mobile ? ' border-red-300' : ''}`}
                  value={formData.mobile ?? ''} placeholder="9876543210"
                  onChange={(e) => onChange('mobile', e.target.value)} autoComplete="tel" />
              </FF>
              <FF label="Alt. Mobile" error={errors.altMobile}>
                <input type="tel" className={INP} value={formData.altMobile ?? ''} placeholder="9876543211"
                  onChange={(e) => onChange('altMobile', e.target.value)} />
              </FF>
              <FF label="Email Address" error={errors.email}>
                <input type="email" className={INP} value={formData.email ?? ''} placeholder="patient@email.com"
                  onChange={(e) => onChange('email', e.target.value)} autoComplete="email" />
              </FF>
            </div>
          </div>

        </div>

        {/* ── Right column: Address + Emergency ── */}
        <div className="space-y-4">

          {/* Address */}
          <div>
            <SL icon={<LocationIcon />} text="Address" />
            <div className="mt-3 space-y-3">
              <FF label="Street Address" error={errors.address}>
                <input className={INP} value={formData.address ?? ''} placeholder="123 Main Street"
                  onChange={(e) => onChange('address', e.target.value)} autoComplete="street-address" />
              </FF>
              <div className="grid grid-cols-3 gap-3">
                <FF label="City" error={errors.city}>
                  <input className={INP} value={formData.city ?? ''} placeholder="Kochi"
                    onChange={(e) => onChange('city', e.target.value)} autoComplete="address-level2" />
                </FF>
                <FF label="Pincode" error={errors.pincode}>
                  <input className={INP} value={formData.pincode ?? ''} placeholder="682001"
                    onChange={(e) => onChange('pincode', e.target.value)} autoComplete="postal-code" />
                </FF>
                <FF label="State" error={errors.state}>
                  <input className={INP} value={formData.state ?? ''} placeholder="Kerala"
                    onChange={(e) => onChange('state', e.target.value)} autoComplete="address-level1" />
                </FF>
              </div>
            </div>
          </div>

          {/* Emergency Contact */}
          <div>
            <SL icon={<ShieldIcon />} text="Emergency Contact" />
            <div className="mt-3 grid grid-cols-2 gap-3">
              <FF label="Contact Name" error={errors.emergencyContactName}>
                <input className={INP} value={formData.emergencyContactName ?? ''}
                  placeholder="Relative or guardian name"
                  onChange={(e) => onChange('emergencyContactName', e.target.value)} />
              </FF>
              <FF label="Contact Mobile" error={errors.emergencyContactMobile}>
                <input type="tel" className={INP} value={formData.emergencyContactMobile ?? ''}
                  placeholder="9876543210"
                  onChange={(e) => onChange('emergencyContactMobile', e.target.value)} />
              </FF>
            </div>
            <div className="mt-3 flex items-start gap-2 rounded-lg border border-blue-100 bg-blue-50 p-2.5">
              <InfoIcon />
              <p className="text-[11px] leading-relaxed text-blue-700">
                Emergency contact is notified in urgent medical situations.
              </p>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

// ─── Icons ────────────────────────────────────────────────────────────────────
function PersonIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="8" cy="5" r="3" /><path d="M2 14c0-3.3 2.7-6 6-6s6 2.7 6 6" strokeLinecap="round" />
    </svg>
  );
}
function LocationIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M8 1a5 5 0 0 1 5 5c0 4-5 9-5 9S3 10 3 6a5 5 0 0 1 5-5z" /><circle cx="8" cy="6" r="1.5" />
    </svg>
  );
}
function PhoneIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M3.5 2h2l1 3-1.5 1.5a8 8 0 0 0 4.5 4.5L11 9.5l3 1v2a1 1 0 0 1-1 1A13 13 0 0 1 2 3a1 1 0 0 1 1-1z" strokeLinejoin="round" />
    </svg>
  );
}
function ShieldIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M8 1l5.5 2.5v4C13.5 11 11 13.5 8 15c-3-1.5-5.5-4-5.5-7.5v-4L8 1z" strokeLinejoin="round" />
    </svg>
  );
}
function InfoIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor" className="mt-0.5 shrink-0 text-blue-400">
      <path d="M8 1a7 7 0 1 1 0 14A7 7 0 0 1 8 1zm0 1.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11zM8 6.5a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5zm-.75 1h1.5v4h-1.5v-4z" />
    </svg>
  );
}
function SpinnerIcon() {
  return <svg width="13" height="13" viewBox="0 0 16 16" className="animate-spin" fill="none"><circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" strokeDasharray="18 20" strokeLinecap="round" /></svg>;
}
