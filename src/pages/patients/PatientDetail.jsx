import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import { extractError } from '../../lib/api';
import { getPatientById, getPatientByUhid, getPatientVisits } from '../../api/patients.api';
import { AppShell } from '../../components/AppShell';
import { Button } from '../../components/Button';

// ─── Constants ────────────────────────────────────────────────────────────────

const GENDER_LABEL = { MALE: 'Male', FEMALE: 'Female', OTHER: 'Other' };

const BILL_STATUS_TONE = {
  DRAFT:    'bg-slate-100 text-slate-600 ring-slate-200',
  PARTIAL:  'bg-amber-50  text-amber-700  ring-amber-200',
  PAID:     'bg-emerald-50 text-emerald-700 ring-emerald-200',
  VOID:     'bg-red-50   text-red-700   ring-red-200',
  REFUNDED: 'bg-orange-50 text-orange-700 ring-orange-200',
};

// Deterministic avatar colour based on first char of name
const AVATAR_PALETTES = [
  'from-blue-500 to-indigo-600',
  'from-violet-500 to-purple-600',
  'from-rose-500 to-pink-600',
  'from-emerald-500 to-teal-600',
  'from-amber-500 to-orange-600',
  'from-cyan-500 to-sky-600',
];
function avatarGradient(name) {
  const code = (name || 'A').toUpperCase().charCodeAt(0) - 65;
  return AVATAR_PALETTES[Math.abs(code) % AVATAR_PALETTES.length];
}

// ─── Utility ─────────────────────────────────────────────────────────────────

function fmtDate(s) {
  if (!s) return null;
  return new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function initials(name) {
  return (name || '?')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');
}

// ─── Design primitives ────────────────────────────────────────────────────────

function SectionCard({ icon, title, children, className = '' }) {
  return (
    <div className={`overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm ${className}`}>
      <div className="flex items-center gap-3 border-b border-slate-100 bg-slate-50/70 px-5 py-3.5">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
          {icon}
        </span>
        <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function DetailField({ label, value, mono = false, span = false }) {
  return (
    <div className={span ? 'col-span-full' : ''}>
      <dt className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{label}</dt>
      <dd className={`mt-1 text-sm ${mono ? 'font-mono font-semibold' : 'font-medium'} text-slate-800`}>
        {value ?? <span className="font-normal italic text-slate-300">Not provided</span>}
      </dd>
    </div>
  );
}

function StatChip({ icon, children, color = 'slate' }) {
  const tones = {
    slate: 'bg-slate-100 text-slate-700',
    blue:  'bg-blue-50 text-blue-700',
    purple:'bg-violet-50 text-violet-700',
    green: 'bg-emerald-50 text-emerald-700',
    orange:'bg-orange-50 text-orange-700',
  };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${tones[color]}`}>
      {icon && <span className="opacity-70">{icon}</span>}
      {children}
    </span>
  );
}

// ─── Visit History sub-component ─────────────────────────────────────────────

function VisitHistory({ patientId }) {
  // ── State preserved exactly ──────────────────────────────────────────────
  const [visits, setVisits] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data } = await getPatientVisits(patientId, { page, limit: 10 });
        setVisits(data.data.visits);
        setPagination(data.data.pagination);
      } catch { /* silently fail — visits are secondary */ }
      finally { setLoading(false); }
    })();
  }, [patientId, page]);
  // ── End preserved logic ──────────────────────────────────────────────────

  return (
    <SectionCard icon={<ClockIcon />} title="Visit History">
      {loading ? (
        <div className="flex items-center justify-center py-10">
          <div className="h-6 w-6 animate-spin rounded-full border-[3px] border-slate-200 border-t-blue-500" />
        </div>
      ) : visits.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-10 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
            <ClockIcon size={22} />
          </span>
          <p className="text-sm font-medium text-slate-500">No visit history yet</p>
          <p className="text-xs text-slate-400">Visits will appear here once appointments are booked.</p>
        </div>
      ) : (
        <>
          <div className="-mx-5 -mt-5 overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100 text-sm">
              <thead>
                <tr className="bg-slate-50/70 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-5 py-3">OP No.</th>
                  <th className="px-5 py-3">Date</th>
                  <th className="px-5 py-3">Doctor</th>
                  <th className="px-5 py-3">Specialization</th>
                  <th className="px-5 py-3">Bill No.</th>
                  <th className="px-5 py-3 text-right">Amount</th>
                  <th className="px-5 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {visits.map((v) => (
                  <tr key={v.id} className="transition-colors hover:bg-slate-50/60">
                    <td className="px-5 py-3 font-mono text-xs font-semibold text-slate-500">{v.opNumber}</td>
                    <td className="px-5 py-3 text-slate-700">{fmtDate(v.appointmentDate) ?? '—'}</td>
                    <td className="px-5 py-3 font-semibold text-slate-900">{v.doctor?.name}</td>
                    <td className="px-5 py-3 text-slate-500">{v.doctor?.specialization}</td>
                    <td className="px-5 py-3 font-mono text-xs text-slate-500">{v.bill?.billNumber || '—'}</td>
                    <td className="px-5 py-3 text-right tabular-nums font-semibold text-slate-800">
                      {v.bill?.totalAmount != null
                        ? `₹${parseFloat(v.bill.totalAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
                        : '—'}
                    </td>
                    <td className="px-5 py-3">
                      {v.bill?.status
                        ? <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${BILL_STATUS_TONE[v.bill.status] || BILL_STATUS_TONE.DRAFT}`}>{v.bill.status}</span>
                        : <span className="text-slate-300">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {pagination.totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4 text-sm text-slate-500">
              <span className="text-xs">Page {pagination.page} of {pagination.totalPages}</span>
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
                <Button size="sm" variant="secondary" disabled={page >= pagination.totalPages} onClick={() => setPage(p => p + 1)}>Next</Button>
              </div>
            </div>
          )}
        </>
      )}
    </SectionCard>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function PatientDetail() {
  // ── All state and logic preserved exactly ────────────────────────────────
  const { id } = useParams();
  const navigate = useNavigate();
  const { user: me } = useAuth();
  const canWrite = me?.role === 'ADMIN' || me?.role === 'RECEPTIONIST';

  const [patient, setPatient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => {
    (async () => {
      setLoading(true); setErr('');
      try {
        const res = /^UHID/i.test(id)
          ? await getPatientByUhid(id)
          : await getPatientById(id);
        setPatient(res.data.data.patient);
      } catch (e) { setErr(extractError(e)); }
      finally { setLoading(false); }
    })();
  }, [id]);
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

  if (err || !patient) {
    return (
      <AppShell>
        <main className="flex flex-1 items-center justify-center bg-slate-50 px-8 py-12">
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-500">
              <WarnIcon size={22} />
            </span>
            <p className="mt-3 text-sm font-semibold text-slate-700">{err || 'Patient not found.'}</p>
            <button
              onClick={() => navigate('/patients')}
              className="mt-4 text-sm font-semibold text-blue-600 hover:text-blue-800"
            >
              ← Back to Patients
            </button>
          </div>
        </main>
      </AppShell>
    );
  }

  const fullName = `${patient.firstName}${patient.lastName ? ` ${patient.lastName}` : ''}`;
  const gradient = avatarGradient(patient.firstName);

  return (
    <AppShell>
      <div className="flex flex-1 flex-col bg-slate-50">

        {/* ── Breadcrumb bar ── */}
        <div className="border-b border-slate-200 bg-white px-8 py-3">
          <nav className="flex items-center gap-1.5 text-xs text-slate-400">
            <Link to="/patients" className="hover:text-blue-600 transition-colors">Patients</Link>
            <ChevronIcon />
            <span className="font-semibold text-slate-600">{fullName}</span>
          </nav>
        </div>

        <main className="flex-1 overflow-auto px-8 py-7">

          {/* ── Hero card ── */}
          <div className="mb-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            {/* Gradient accent strip */}
            <div className={`h-1.5 bg-gradient-to-r ${gradient}`} />

            <div className="p-6">
              <div className="flex items-start gap-5">
                {/* Avatar */}
                <div className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${gradient} text-xl font-black text-white shadow-lg`}>
                  {initials(fullName)}
                </div>

                {/* Identity */}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h1 className="text-2xl font-bold tracking-tight text-slate-900">{fullName}</h1>
                      <div className="mt-1.5 flex flex-wrap items-center gap-2">
                        {/* UHID chip */}
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-0.5 font-mono text-[11px] font-bold text-slate-500">
                          <span className="h-1.5 w-1.5 rounded-full bg-blue-400" />
                          {patient.uhid}
                        </span>
                        {/* Active status */}
                        {patient.isActive ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-0.5 text-[11px] font-bold text-emerald-700 ring-1 ring-inset ring-emerald-200">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-0.5 text-[11px] font-bold text-slate-500 ring-1 ring-inset ring-slate-200">
                            <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />Inactive
                          </span>
                        )}
                      </div>
                    </div>

                    {canWrite && (
                      <button
                        onClick={() => navigate(`/patients/${patient.id}/edit`)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-600 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                      >
                        <PencilIcon /> Edit
                      </button>
                    )}
                  </div>

                  {/* Quick-stats strip */}
                  <div className="mt-4 flex flex-wrap gap-2">
                    <StatChip icon={<GenderIcon />} color="blue">
                      {GENDER_LABEL[patient.gender] || patient.gender}
                    </StatChip>
                    {patient.age != null && (
                      <StatChip icon={<CakeIcon />} color="purple">
                        {patient.age} yrs
                      </StatChip>
                    )}
                    <StatChip icon={<PhoneIcon />} color="green">
                      {patient.mobile}
                    </StatChip>
                    {patient.city && (
                      <StatChip icon={<PinIcon />} color="orange">
                        {patient.city}{patient.state ? `, ${patient.state}` : ''}
                      </StatChip>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── Body grid ── */}
          <div className="grid gap-5 lg:grid-cols-3 lg:items-start">

            {/* Left 2-col span */}
            <div className="space-y-5 lg:col-span-2">

              {/* Demographics */}
              <SectionCard icon={<PersonIcon />} title="Demographics">
                <dl className="grid grid-cols-2 gap-x-8 gap-y-5 sm:grid-cols-3">
                  <DetailField label="Date of Birth" value={fmtDate(patient.dob)} />
                  <DetailField label="Age" value={patient.age != null ? `${patient.age} years` : null} />
                  <DetailField label="Gender" value={GENDER_LABEL[patient.gender] || patient.gender} />
                  <DetailField label="Mobile" value={patient.mobile} mono />
                  <DetailField label="Alt. Mobile" value={patient.altMobile} mono />
                  <DetailField label="Email" value={patient.email} />
                </dl>
              </SectionCard>

              {/* Address */}
              <SectionCard icon={<LocationIcon />} title="Address">
                <dl className="grid grid-cols-2 gap-x-8 gap-y-5 sm:grid-cols-3">
                  <DetailField label="Street Address" value={patient.address} span />
                  <DetailField label="City" value={patient.city} />
                  <DetailField label="State" value={patient.state} />
                  <DetailField label="Pincode" value={patient.pincode} mono />
                </dl>
              </SectionCard>

              {/* Visit history */}
              <VisitHistory patientId={patient.id} />
            </div>

            {/* Right sidebar */}
            <div className="space-y-5">

              {(patient.emergencyContactName || patient.emergencyContactMobile) && (
                <SectionCard icon={<HeartIcon />} title="Emergency Contact">
                  <dl className="space-y-5">
                    <DetailField label="Name" value={patient.emergencyContactName} />
                    <DetailField label="Mobile" value={patient.emergencyContactMobile} mono />
                  </dl>
                </SectionCard>
              )}

              <SectionCard icon={<InfoIcon />} title="Registration Info">
                <dl className="space-y-5">
                  <DetailField label="Registered On" value={fmtDate(patient.createdAt)} />
                  <DetailField
                    label="Registered By"
                    value={patient.createdBy?.fullName || patient.createdBy?.username}
                  />
                  {patient.updatedBy && (
                    <DetailField
                      label="Last Updated By"
                      value={patient.updatedBy?.fullName || patient.updatedBy?.username}
                    />
                  )}
                  <DetailField label="UHID" value={patient.uhid} mono />
                </dl>
              </SectionCard>

            </div>
          </div>
        </main>
      </div>
    </AppShell>
  );
}

// ─── Micro icons ─────────────────────────────────────────────────────────────

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
function InfoIcon() {
  return <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="8" cy="8" r="6.5"/><path d="M8 7v4M8 5v.5"/></svg>;
}
function ClockIcon({ size = 14 }) {
  return <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="8" cy="8" r="6.5"/><path d="M8 5v3.5l2.5 1.5"/></svg>;
}
function WarnIcon({ size = 12 }) {
  return <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor"><path d="M8 1a.5.5 0 0 1 .44.26l6.5 12A.5.5 0 0 1 14.5 14H1.5a.5.5 0 0 1-.44-.74l6.5-12A.5.5 0 0 1 8 1zm0 4.5a.75.75 0 0 0-.75.75v3a.75.75 0 0 0 1.5 0v-3A.75.75 0 0 0 8 5.5zm0 6.5a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5z"/></svg>;
}
function PencilIcon() {
  return <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M11 2l3 3-8 8H3v-3l8-8z"/><path d="M9.5 3.5l3 3"/></svg>;
}
function ChevronIcon() {
  return <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 4l4 4-4 4"/></svg>;
}
function GenderIcon() {
  return <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="8" cy="6" r="4"/><path d="M8 10v6M5 13h6"/></svg>;
}
function CakeIcon() {
  return <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="7" width="14" height="8" rx="1"/><path d="M4 7V5a4 4 0 0 1 8 0v2"/><path d="M8 3V1"/></svg>;
}
function PinIcon() {
  return <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 1A4.5 4.5 0 0 0 3.5 5.5C3.5 9 8 15 8 15s4.5-6 4.5-9.5A4.5 4.5 0 0 0 8 1z"/></svg>;
}
