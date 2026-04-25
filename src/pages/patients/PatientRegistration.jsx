import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import { extractError } from '../../lib/api';
import { createPatient, getPatientById, updatePatient } from '../../api/patients.api';
import { AppShell } from '../../components/AppShell';
import { Button } from '../../components/Button';
import { Modal } from '../../components/Modal';

// ─── Constants ────────────────────────────────────────────────────────────────

const INDIAN_STATES = [
  'Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh','Goa',
  'Gujarat','Haryana','Himachal Pradesh','Jharkhand','Karnataka','Kerala',
  'Madhya Pradesh','Maharashtra','Manipur','Meghalaya','Mizoram','Nagaland',
  'Odisha','Punjab','Rajasthan','Sikkim','Tamil Nadu','Telangana','Tripura',
  'Uttar Pradesh','Uttarakhand','West Bengal',
  'Andaman and Nicobar Islands','Chandigarh','Delhi','Jammu and Kashmir',
  'Ladakh','Lakshadweep','Puducherry',
];

const EMPTY = {
  firstName: '', lastName: '', gender: '', dob: '', age: '',
  mobile: '', altMobile: '', email: '',
  address: '', city: '', state: '', pincode: '',
  emergencyContactName: '', emergencyContactMobile: '',
};

// ─── Shared input class ───────────────────────────────────────────────────────
// Applied directly to raw <input> / <textarea> / <select> so we get
// focus:ring-blue-500 instead of the base Input component's slate variant.

const CLS = {
  inp: 'block w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 transition-shadow focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400',
  inpErr: 'block w-full rounded-lg border border-red-300 bg-red-50/40 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 transition-shadow focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20',
};

// ─── Utility ─────────────────────────────────────────────────────────────────

function computeAge(dobStr) {
  if (!dobStr) return '';
  const today = new Date();
  const birth = new Date(dobStr);
  if (isNaN(birth)) return '';
  let a = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) a--;
  return a < 0 ? '0' : String(a);
}

// ─── Small design primitives ─────────────────────────────────────────────────

function FF({ label, required, hint, error, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold text-slate-600">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </label>
      {children}
      {error
        ? <p className="flex items-center gap-1 text-xs font-medium text-red-600"><WarnIcon />{error}</p>
        : hint
        ? <p className="text-[11px] text-slate-400">{hint}</p>
        : null}
    </div>
  );
}

function SectionCard({ icon, title, children }) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center gap-3 border-b border-slate-100 bg-slate-50/70 px-5 py-3.5">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
          {icon}
        </span>
        <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
      </div>
      <div className="space-y-4 p-5">{children}</div>
    </div>
  );
}

function GenderButton({ value, selected, onChange }) {
  const labels = { MALE: 'Male', FEMALE: 'Female', OTHER: 'Other' };
  const active = selected === value;
  return (
    <button
      type="button"
      onClick={() => onChange(value)}
      className={`flex-1 rounded-lg border py-2.5 text-sm font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/30 ${
        active
          ? 'border-blue-600 bg-blue-600 text-white shadow-sm'
          : 'border-slate-200 bg-white text-slate-500 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700'
      }`}
    >
      {labels[value]}
    </button>
  );
}

// ─── Duplicate-warning modal ──────────────────────────────────────────────────

function DuplicateModal({ data, onRegisterAnyway, onClose }) {
  const navigate = useNavigate();
  if (!data) return null;

  return (
    <Modal
      open
      onClose={onClose}
      title="Patient May Already Exist"
      size="lg"
      footer={
        <>
          <Button variant="secondary" size="md" onClick={onClose}>Cancel</Button>
          <Button variant="secondary" size="md" onClick={onRegisterAnyway}>
            Register as New Patient
          </Button>
        </>
      }
    >
      <div className="mb-4 flex items-start gap-3 rounded-lg bg-amber-50 p-3.5 ring-1 ring-amber-200">
        <span className="mt-0.5 shrink-0 text-amber-500"><WarnIcon size={16} /></span>
        <p className="text-sm text-amber-800">
          A patient with this name and mobile number already exists. Select an existing record
          below, or register a new patient anyway.
        </p>
      </div>

      <div className="overflow-hidden rounded-xl ring-1 ring-slate-200">
        <table className="min-w-full divide-y divide-slate-100 text-sm">
          <thead>
            <tr className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <th className="px-4 py-2.5">UHID</th>
              <th className="px-4 py-2.5">Name</th>
              <th className="px-4 py-2.5">Mobile</th>
              <th className="px-4 py-2.5">Age</th>
              <th className="px-4 py-2.5">Gender</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {data.candidates.map((c) => (
              <tr key={c.id} className={`transition-colors ${c.likelyDuplicate ? 'bg-amber-50/60' : 'hover:bg-slate-50'}`}>
                <td className="px-4 py-3 font-mono text-[11px] text-slate-500">{c.uhid}</td>
                <td className="px-4 py-3 font-semibold text-slate-900">
                  <div className="flex flex-wrap items-center gap-2">
                    {c.firstName}{c.lastName ? ` ${c.lastName}` : ''}
                    {c.likelyDuplicate && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700 ring-1 ring-amber-200">
                        <WarnIcon size={9} />Likely match
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 tabular-nums text-slate-700">{c.mobile}</td>
                <td className="px-4 py-3 text-slate-600">{c.age ?? '—'}</td>
                <td className="px-4 py-3 capitalize text-slate-600">{c.gender?.toLowerCase()}</td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => navigate(`/patients/${c.id}`)}
                    className="rounded-md px-2.5 py-1 text-xs font-semibold text-blue-600 transition hover:bg-blue-50 hover:text-blue-700"
                  >
                    Use this →
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Modal>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function PatientRegistration() {
  // ── All state and logic preserved exactly ────────────────────────────────
  const { id } = useParams();
  const isEdit = !!id;
  const navigate = useNavigate();
  const { user: me } = useAuth();
  const canWrite = me?.role === 'ADMIN' || me?.role === 'RECEPTIONIST';

  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(isEdit);
  const [busy, setBusy] = useState(false);
  const [fieldErr, setFieldErr] = useState({});
  const [globalErr, setGlobalErr] = useState('');
  const [uhid, setUhid] = useState('');
  const [dupData, setDupData] = useState(null);
  const [pendingPayload, setPendingPayload] = useState(null);

  useEffect(() => {
    if (!isEdit) return;
    (async () => {
      try {
        const { data } = await getPatientById(id);
        const p = data.data.patient;
        setUhid(p.uhid);
        setForm({
          firstName: p.firstName || '', lastName: p.lastName || '',
          gender: p.gender || '',
          dob: p.dob ? p.dob.split('T')[0] : '',
          age: p.age != null ? String(p.age) : '',
          mobile: p.mobile || '', altMobile: p.altMobile || '', email: p.email || '',
          address: p.address || '', city: p.city || '',
          state: p.state || '', pincode: p.pincode || '',
          emergencyContactName: p.emergencyContactName || '',
          emergencyContactMobile: p.emergencyContactMobile || '',
        });
      } catch (e) { setGlobalErr(extractError(e)); }
      finally { setLoading(false); }
    })();
  }, [id, isEdit]);

  function set(k, v) {
    setForm((f) => ({ ...f, [k]: v }));
    setFieldErr((e) => ({ ...e, [k]: '' }));
  }
  function onDobChange(val) { set('dob', val); if (val) set('age', computeAge(val)); }
  function onAgeChange(val) { set('age', val); if (val) set('dob', ''); }

  function buildPayload(withConfirm = false) {
    const p = {};
    if (form.firstName.trim()) p.firstName = form.firstName.trim();
    if (form.lastName.trim()) p.lastName = form.lastName.trim();
    if (form.gender) p.gender = form.gender;
    if (form.mobile.trim()) p.mobile = form.mobile.trim();
    if (form.altMobile.trim()) p.altMobile = form.altMobile.trim();
    if (form.email.trim()) p.email = form.email.trim();
    if (form.dob) p.dob = form.dob;
    if (form.age !== '') p.age = parseInt(form.age, 10);
    if (form.address.trim()) p.address = form.address.trim();
    if (form.city.trim()) p.city = form.city.trim();
    if (form.state.trim()) p.state = form.state.trim();
    if (form.pincode.trim()) p.pincode = form.pincode.trim();
    if (form.emergencyContactName.trim()) p.emergencyContactName = form.emergencyContactName.trim();
    if (form.emergencyContactMobile.trim()) p.emergencyContactMobile = form.emergencyContactMobile.trim();
    if (!isEdit && withConfirm) p.confirmDuplicate = true;
    return p;
  }

  function validate() {
    const errors = {};
    if (!form.firstName.trim()) errors.firstName = 'First name is required.';
    if (!form.gender) errors.gender = 'Please select a gender.';
    if (!form.mobile.trim()) errors.mobile = 'Mobile number is required.';
    else if (!/^[6-9]\d{9}$/.test(form.mobile.trim())) errors.mobile = 'Enter a valid 10-digit Indian mobile number.';
    if (!form.dob && form.age === '') errors.dob = 'Either date of birth or age is required.';
    if (form.age !== '' && isNaN(parseInt(form.age, 10))) errors.age = 'Age must be a number.';
    if (form.pincode && !/^\d{6}$/.test(form.pincode.trim())) errors.pincode = 'Pincode must be 6 digits.';
    if (form.altMobile && !/^[6-9]\d{9}$/.test(form.altMobile.trim())) errors.altMobile = 'Enter a valid 10-digit mobile number.';
    return errors;
  }

  async function submitPayload(payload) {
    setBusy(true); setGlobalErr('');
    try {
      if (isEdit) { await updatePatient(id, payload); navigate(`/patients/${id}`); }
      else { const { data } = await createPatient(payload); navigate(`/patients/${data.data.patient.id}`); }
    } catch (e) {
      const res = e?.response;
      if (res?.status === 409 && res?.data?.error?.details?.reason === 'LIKELY_DUPLICATE') {
        setDupData(res.data.error.details); setPendingPayload(payload);
      } else { setGlobalErr(extractError(e)); }
    } finally { setBusy(false); }
  }

  async function onSubmit(e) {
    e.preventDefault();
    const errors = validate();
    if (Object.keys(errors).length > 0) { setFieldErr(errors); return; }
    await submitPayload(buildPayload(false));
  }

  async function handleRegisterAnyway() {
    setDupData(null);
    await submitPayload({ ...pendingPayload, confirmDuplicate: true });
  }
  // ── End preserved logic ──────────────────────────────────────────────────

  if (loading) {
    return (
      <AppShell>
        <main className="flex flex-1 items-center justify-center bg-slate-50">
          <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-slate-200 border-t-blue-600" />
        </main>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="flex flex-1 flex-col bg-slate-50">

        {/* ── Sticky page header ── */}
        <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur-sm">
          <div className="flex items-center justify-between px-8 py-4">
            <div>
              <nav className="mb-0.5 flex items-center gap-1.5 text-xs text-slate-400">
                <Link to="/patients" className="hover:text-blue-600 transition-colors">Patients</Link>
                <ChevronIcon />
                <span className="font-medium text-slate-600">{isEdit ? 'Edit Record' : 'New Registration'}</span>
              </nav>
              <div className="flex items-center gap-3">
                <h1 className="text-lg font-bold text-slate-900">
                  {isEdit ? 'Edit Patient' : 'Register Patient'}
                </h1>
                {isEdit && uhid && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 font-mono text-[11px] font-bold text-blue-700">
                    <span className="h-1.5 w-1.5 rounded-full bg-blue-400" />
                    {uhid}
                  </span>
                )}
              </div>
            </div>

            {canWrite && (
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => navigate(isEdit ? `/patients/${id}` : '/patients')}
                  disabled={busy}
                  className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  form="patient-form"
                  disabled={busy}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-60"
                >
                  {busy ? (
                    <>
                      <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                      Saving…
                    </>
                  ) : isEdit ? 'Save changes' : 'Register patient'}
                </button>
              </div>
            )}
          </div>
        </header>

        {/* ── Form body ── */}
        <main className="flex-1 overflow-auto px-8 py-7">
          {globalErr && (
            <div className="mb-6 flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3.5">
              <span className="shrink-0 text-red-500"><WarnIcon size={16} /></span>
              <p className="text-sm font-medium text-red-700">{globalErr}</p>
            </div>
          )}

          <form id="patient-form" onSubmit={onSubmit} noValidate>
            <div className="grid gap-5 lg:grid-cols-2 lg:items-start">

              {/* ── Left column ── */}
              <div className="space-y-5">

                {/* Personal Information */}
                <SectionCard icon={<PersonIcon />} title="Personal Information">
                  <div className="grid grid-cols-2 gap-4">
                    <FF label="First name" required error={fieldErr.firstName}>
                      <input
                        className={fieldErr.firstName ? CLS.inpErr : CLS.inp}
                        value={form.firstName}
                        onChange={(e) => set('firstName', e.target.value)}
                        placeholder="Priya"
                        disabled={!canWrite}
                      />
                    </FF>
                    <FF label="Last name">
                      <input
                        className={CLS.inp}
                        value={form.lastName}
                        onChange={(e) => set('lastName', e.target.value)}
                        placeholder="Nair"
                        disabled={!canWrite}
                      />
                    </FF>
                  </div>

                  <FF label="Gender" required error={fieldErr.gender}>
                    <div className="flex gap-2">
                      {['MALE', 'FEMALE', 'OTHER'].map((g) => (
                        <GenderButton key={g} value={g} selected={form.gender} onChange={(v) => set('gender', v)} />
                      ))}
                    </div>
                  </FF>

                  <div className="grid grid-cols-2 gap-4">
                    <FF label="Date of birth" error={fieldErr.dob} hint="Sets age automatically">
                      <input
                        type="date"
                        className={fieldErr.dob ? CLS.inpErr : CLS.inp}
                        value={form.dob}
                        onChange={(e) => onDobChange(e.target.value)}
                        max={new Date().toISOString().split('T')[0]}
                        disabled={!canWrite}
                      />
                    </FF>
                    <FF label="Age (years)" error={fieldErr.age} hint="Or enter directly">
                      <input
                        type="number"
                        min="0"
                        max="150"
                        className={fieldErr.age ? CLS.inpErr : CLS.inp}
                        value={form.age}
                        onChange={(e) => onAgeChange(e.target.value)}
                        placeholder="34"
                        disabled={!canWrite}
                      />
                    </FF>
                  </div>
                </SectionCard>

                {/* Contact Details */}
                <SectionCard icon={<PhoneIcon />} title="Contact Details">
                  <div className="grid grid-cols-2 gap-4">
                    <FF label="Mobile" required error={fieldErr.mobile}>
                      <input
                        type="tel"
                        inputMode="numeric"
                        maxLength={10}
                        className={fieldErr.mobile ? CLS.inpErr : CLS.inp}
                        value={form.mobile}
                        onChange={(e) => set('mobile', e.target.value.replace(/\D/g, ''))}
                        placeholder="9876543210"
                        disabled={!canWrite}
                      />
                    </FF>
                    <FF label="Alt. mobile" error={fieldErr.altMobile}>
                      <input
                        type="tel"
                        inputMode="numeric"
                        maxLength={10}
                        className={fieldErr.altMobile ? CLS.inpErr : CLS.inp}
                        value={form.altMobile}
                        onChange={(e) => set('altMobile', e.target.value.replace(/\D/g, ''))}
                        placeholder="Optional"
                        disabled={!canWrite}
                      />
                    </FF>
                  </div>
                  <FF label="Email address">
                    <input
                      type="email"
                      className={CLS.inp}
                      value={form.email}
                      onChange={(e) => set('email', e.target.value)}
                      placeholder="priya@example.com"
                      disabled={!canWrite}
                    />
                  </FF>
                </SectionCard>

              </div>

              {/* ── Right column ── */}
              <div className="space-y-5">

                {/* Address */}
                <SectionCard icon={<LocationIcon />} title="Address">
                  <FF label="Street address">
                    <textarea
                      rows={2}
                      className={`${CLS.inp} resize-none`}
                      value={form.address}
                      onChange={(e) => set('address', e.target.value)}
                      placeholder="House / flat, street, area"
                      disabled={!canWrite}
                    />
                  </FF>
                  <div className="grid grid-cols-2 gap-4">
                    <FF label="City">
                      <input
                        className={CLS.inp}
                        value={form.city}
                        onChange={(e) => set('city', e.target.value)}
                        placeholder="Kochi"
                        disabled={!canWrite}
                      />
                    </FF>
                    <FF label="Pincode" error={fieldErr.pincode}>
                      <input
                        inputMode="numeric"
                        maxLength={6}
                        className={fieldErr.pincode ? CLS.inpErr : CLS.inp}
                        value={form.pincode}
                        onChange={(e) => set('pincode', e.target.value.replace(/\D/g, ''))}
                        placeholder="682001"
                        disabled={!canWrite}
                      />
                    </FF>
                  </div>
                  <FF label="State">
                    <input
                      list="states-list"
                      className={CLS.inp}
                      value={form.state}
                      onChange={(e) => set('state', e.target.value)}
                      placeholder="Kerala"
                      disabled={!canWrite}
                    />
                    <datalist id="states-list">
                      {INDIAN_STATES.map((s) => <option key={s} value={s} />)}
                    </datalist>
                  </FF>
                </SectionCard>

                {/* Emergency Contact */}
                <SectionCard icon={<HeartIcon />} title="Emergency Contact">
                  <FF label="Contact name">
                    <input
                      className={CLS.inp}
                      value={form.emergencyContactName}
                      onChange={(e) => set('emergencyContactName', e.target.value)}
                      placeholder="Rajesh Nair"
                      disabled={!canWrite}
                    />
                  </FF>
                  <FF label="Contact mobile" error={fieldErr.emergencyContactMobile}>
                    <input
                      type="tel"
                      inputMode="numeric"
                      maxLength={10}
                      className={fieldErr.emergencyContactMobile ? CLS.inpErr : CLS.inp}
                      value={form.emergencyContactMobile}
                      onChange={(e) => set('emergencyContactMobile', e.target.value.replace(/\D/g, ''))}
                      placeholder="9876500000"
                      disabled={!canWrite}
                    />
                  </FF>

                  {/* Hint banner */}
                  <div className="rounded-lg bg-blue-50 px-3.5 py-3 text-xs text-blue-700 ring-1 ring-blue-100">
                    Emergency contact is notified in case of critical situations.
                  </div>
                </SectionCard>

              </div>
            </div>

            {/* ── Required fields note ── */}
            <p className="mt-5 text-xs text-slate-400">
              Fields marked <span className="font-bold text-red-400">*</span> are required.
              {!isEdit && ' A unique UHID will be assigned on registration.'}
            </p>
          </form>
        </main>
      </div>

      <DuplicateModal
        data={dupData}
        onRegisterAnyway={handleRegisterAnyway}
        onClose={() => setDupData(null)}
      />
    </AppShell>
  );
}

// ─── Micro icons (inline SVG, no library dependency) ─────────────────────────

function PersonIcon() {
  return <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="8" cy="5" r="3"/><path d="M2 15c0-3 2.5-5 6-5s6 2 6 5"/></svg>;
}
function PhoneIcon() {
  return <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 2h3l1.5 3.5-2 1.2A8.4 8.4 0 0 0 9.3 9.5l1.2-2L14 9v3a1 1 0 0 1-1 1A11 11 0 0 1 3 3a1 1 0 0 1 1-1z"/></svg>;
}
function LocationIcon() {
  return <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M8 1.5A4.5 4.5 0 0 0 3.5 6c0 3 4.5 8.5 4.5 8.5S12.5 9 12.5 6A4.5 4.5 0 0 0 8 1.5z"/><circle cx="8" cy="6" r="1.5"/></svg>;
}
function HeartIcon() {
  return <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M8 13.5S1.5 9 1.5 5.5a3.5 3.5 0 0 1 6.5-1.8A3.5 3.5 0 0 1 14.5 5.5C14.5 9 8 13.5 8 13.5z"/></svg>;
}
function WarnIcon({ size = 12 }) {
  return <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor"><path d="M8 1a.5.5 0 0 1 .44.26l6.5 12A.5.5 0 0 1 14.5 14H1.5a.5.5 0 0 1-.44-.74l6.5-12A.5.5 0 0 1 8 1zm0 4.5a.75.75 0 0 0-.75.75v3a.75.75 0 0 0 1.5 0v-3A.75.75 0 0 0 8 5.5zm0 6.5a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5z"/></svg>;
}
function ChevronIcon() {
  return <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 4l4 4-4 4"/></svg>;
}
