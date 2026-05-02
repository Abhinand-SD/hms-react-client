import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../lib/auth';
import { extractError } from '../../lib/api';
import { api } from '../../lib/api';
import { listAppointments, updateStatus, cancelAppointment, checkInAppointment } from '../../api/appointments.api';
import { listVisits, updateQueueStatus } from '../../api/visits.api';
import { AppShell } from '../../components/AppShell';
import { Button } from '../../components/Button';
import { Modal } from '../../components/Modal';
import { BookAppointment } from './BookAppointment';
import { WalkInModal } from './WalkInModal';
import { ConsultationModal } from '../billing/ConsultationModal';

// ─── Design tokens ────────────────────────────────────────────────────────────

const STATUS_CFG = {
  SCHEDULED:       { label: 'Scheduled',    dot: 'bg-blue-500',    tone: 'bg-blue-50 text-blue-700 ring-blue-200' },
  CHECKED_IN:      { label: 'Checked In',   dot: 'bg-amber-500',   tone: 'bg-amber-50 text-amber-700 ring-amber-200' },
  IN_CONSULTATION: { label: 'In Consult',   dot: 'bg-violet-500',  tone: 'bg-violet-50 text-violet-700 ring-violet-200' },
  COMPLETED:       { label: 'Completed',    dot: 'bg-emerald-500', tone: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  NO_SHOW:         { label: 'Missed',       dot: 'bg-orange-500',  tone: 'bg-orange-50 text-orange-700 ring-orange-200' },
  CANCELLED:       { label: 'Cancelled',    dot: 'bg-slate-400',   tone: 'bg-slate-100 text-slate-500 ring-slate-200' },
};

const TYPE_CFG = {
  BOOKED:  { label: 'Pre-booked', tone: 'bg-sky-50 text-sky-700 ring-sky-200' },
  WALK_IN: { label: 'Walk-in',    tone: 'bg-amber-50 text-amber-700 ring-amber-200' },
};

// Per-status next actions (backend enforces validity)
const ACTIONS = {
  SCHEDULED:       [
    { label: 'Check In', next: 'CHECKED_IN', cls: 'text-blue-700 hover:bg-blue-50 border-blue-200' },
    { label: 'Missed',   next: 'NO_SHOW',    cls: 'text-orange-600 hover:bg-orange-50 border-orange-200' },
    { label: 'Cancel',   next: 'CANCELLED',  cls: 'text-red-600 hover:bg-red-50 border-red-200', needsReason: true },
  ],
  CHECKED_IN:      [
    { label: 'Cancel', next: 'CANCELLED', cls: 'text-red-600 hover:bg-red-50 border-red-200', needsReason: true },
  ],
  IN_CONSULTATION: [],
  COMPLETED: [], NO_SHOW: [], CANCELLED: [],
};

const ROLE_ALLOWED = {
  ADMIN:        ['CHECKED_IN', 'IN_CONSULTATION', 'COMPLETED', 'NO_SHOW', 'CANCELLED'],
  RECEPTIONIST: ['CHECKED_IN', 'CANCELLED', 'NO_SHOW'],
  DOCTOR:       ['IN_CONSULTATION', 'COMPLETED', 'NO_SHOW'],
};

// ─── Utility ─────────────────────────────────────────────────────────────────

function today() { return new Date().toISOString().split('T')[0]; }

function fmtDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ status }) {
  const cfg = STATUS_CFG[status] || STATUS_CFG.SCHEDULED;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${cfg.tone}`}>
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

function TypeBadge({ type }) {
  const cfg = TYPE_CFG[type] || TYPE_CFG.BOOKED;
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${cfg.tone}`}>
      {cfg.label}
    </span>
  );
}

function StatCard({ label, value, tone, icon }) {
  return (
    <div className={`flex items-center gap-4 rounded-xl border px-5 py-4 ${tone}`}>
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/60 text-inherit shadow-sm">
        {icon}
      </div>
      <div>
        <div className="text-2xl font-bold tabular-nums">{value}</div>
        <div className="text-xs font-semibold opacity-70 uppercase tracking-wide">{label}</div>
      </div>
    </div>
  );
}

function SkeletonRow() {
  return (
    <tr>
      {[120, 110, 80, 80, 90, 60, 100].map((w, i) => (
        <td key={i} className="px-4 py-3.5">
          <div className="h-3.5 animate-pulse rounded bg-slate-100" style={{ width: w }} />
        </td>
      ))}
    </tr>
  );
}

// ─── Cancel-reason modal ──────────────────────────────────────────────────────

function CancelModal({ appointment, onClose }) {
  const [reason, setReason] = useState('');
  const [busy, setBusy]     = useState(false);
  const [err, setErr]       = useState('');

  useEffect(() => { setReason(''); setErr(''); }, [appointment]);

  async function confirm() {
    if (!reason.trim()) { setErr('Please provide a reason.'); return; }
    setBusy(true);
    try {
      await cancelAppointment(appointment.id, { cancelReason: reason.trim() });
      onClose(true);
    } catch (e) { setErr(extractError(e)); }
    finally { setBusy(false); }
  }

  const patName = appointment
    ? `${appointment.patient?.firstName ?? ''}${appointment.patient?.lastName ? ` ${appointment.patient.lastName}` : ''}`
    : '';

  return (
    <Modal open={!!appointment} onClose={() => onClose(false)} title="Cancel Appointment" size="sm"
      footer={
        <>
          <Button variant="secondary" size="md" onClick={() => onClose(false)} disabled={busy}>Keep</Button>
          <button onClick={confirm} disabled={busy}
            className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60 transition">
            {busy ? 'Cancelling…' : 'Confirm Cancel'}
          </button>
        </>
      }
    >
      <p className="mb-4 text-sm text-slate-600">
        Cancel appointment for <span className="font-semibold text-slate-800">{patName}</span>?
      </p>
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-semibold text-slate-600">Reason <span className="text-red-500">*</span></label>
        <textarea rows={3} value={reason}
          onChange={(e) => { setReason(e.target.value); setErr(''); }}
          placeholder="e.g. Patient requested cancellation"
          className="block w-full resize-none rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm placeholder:text-slate-400 focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-400/20" />
        {err && <p className="text-xs font-medium text-red-600">⚠ {err}</p>}
      </div>
    </Modal>
  );
}

// ─── Complete Profile modal (shown before check-in for pre-booked patients) ───

const INP = 'block w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20';

function CompleteProfileModal({ appointment, onClose }) {
  const [form, setForm] = useState({ age: '', gender: 'MALE', city: '', mobile: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr]   = useState('');

  useEffect(() => {
    if (!appointment) return;
    const p = appointment.patient ?? {};
    setForm({
      age:    p.age    != null ? String(p.age) : '',
      gender: p.gender || 'MALE',
      city:   p.city   || '',
      mobile: p.mobile || '',
    });
    setErr('');
  }, [appointment]);

  function set(k, v) { setForm((f) => ({ ...f, [k]: v })); }

  async function confirm() {
    if (!form.gender) { setErr('Gender is required.'); return; }
    setBusy(true);
    setErr('');
    try {
      const patientData = { gender: form.gender };
      if (form.age)           patientData.age    = parseInt(form.age, 10);
      if (form.city.trim())   patientData.city   = form.city.trim();
      if (form.mobile.trim()) patientData.mobile = form.mobile.trim();

      const { data } = await checkInAppointment(appointment.id, { patientData });
      onClose(true, data.data.visit);
    } catch (e) {
      setErr(extractError(e));
    } finally {
      setBusy(false);
    }
  }

  const patName = appointment
    ? `${appointment.patient?.firstName ?? ''}${appointment.patient?.lastName ? ` ${appointment.patient.lastName}` : ''}`
    : '';

  return (
    <Modal open={!!appointment} onClose={() => !busy && onClose(false)} title="Check-in Details" size="sm"
      footer={
        <>
          <Button variant="secondary" size="md" onClick={() => onClose(false)} disabled={busy}>Cancel</Button>
          <button onClick={confirm} disabled={busy}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 transition">
            {busy ? 'Checking in…' : 'Confirm & Check In'}
          </button>
        </>
      }
    >
      <p className="mb-4 text-sm text-slate-500">
        Confirm or update details for{' '}
        <span className="font-semibold text-slate-800">{patName}</span> before checking in.
      </p>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-slate-600">Gender <span className="text-red-500">*</span></label>
            <select className={`mt-1.5 ${INP}`} value={form.gender} onChange={(e) => set('gender', e.target.value)}>
              <option value="MALE">Male</option>
              <option value="FEMALE">Female</option>
              <option value="OTHER">Other</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600">Age (years)</label>
            <input type="number" min="0" max="150" className={`mt-1.5 ${INP}`} value={form.age}
              onChange={(e) => set('age', e.target.value)} placeholder="35" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-slate-600">Mobile</label>
            <input type="tel" className={`mt-1.5 ${INP}`} value={form.mobile}
              onChange={(e) => set('mobile', e.target.value)} placeholder="9876543210" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600">City</label>
            <input className={`mt-1.5 ${INP}`} value={form.city}
              onChange={(e) => set('city', e.target.value)} placeholder="Kochi" />
          </div>
        </div>
        {appointment?.opNumber && (
          <div className="flex items-center gap-2 rounded-lg border border-blue-100 bg-blue-50 px-3.5 py-2.5">
            <span className="text-xs text-slate-500">Token:</span>
            <span className="font-mono text-sm font-bold text-blue-700">
              {parseInt(appointment.opNumber.split('-').pop(), 10)}
            </span>
          </div>
        )}
      </div>
      {err && <p className="mt-3 text-xs font-medium text-red-600">⚠ {err}</p>}
    </Modal>
  );
}

// ─── Main dashboard ───────────────────────────────────────────────────────────

export default function AppointmentsDashboard() {
  const { user: me } = useAuth();
  const isDoctor  = me?.role === 'DOCTOR';
  const canWrite  = me?.role === 'ADMIN' || me?.role === 'RECEPTIONIST';

  const [date, setDate]               = useState(today);
  const [doctorFilter, setDoctorFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [doctors, setDoctors]         = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading]         = useState(true);
  const [err, setErr]                 = useState('');
  const [busy, setBusy]               = useState({});
  const [bookOpen, setBookOpen]       = useState(false);
  const [walkInOpen, setWalkInOpen]   = useState(false);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [checkInTarget, setCheckInTarget] = useState(null); // appointment for CompleteProfileModal
  const [consultationVisit, setConsultationVisit] = useState(null);
  const [doneApptIds, setDoneApptIds] = useState(() => new Set());
  const [visitsByApptId, setVisitsByApptId] = useState({});
  const [printTarget, setPrintTarget] = useState(null);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [allDailyAppts, setAllDailyAppts] = useState([]);

  useEffect(() => {
    if (isDoctor) return;
    api.get('/doctors', { params: { pageSize: 100, isActive: 'true' } })
      .then(({ data }) => setDoctors(data.data.items))
      .catch(() => {});
  }, [isDoctor]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  async function load() {
    setLoading(true);
    setErr('');
    try {
      const baseParams = { date, limit: 100 };
      if (!isDoctor && doctorFilter)  baseParams.doctorId = doctorFilter;
      if (statusFilter)               baseParams.status   = statusFilter;

      const visitParams = { date, limit: 100 };
      if (!isDoctor && doctorFilter) visitParams.doctorId = doctorFilter;

      const isSearching = !!debouncedSearch.trim();
      const apptParams  = isSearching
        ? { ...baseParams, search: debouncedSearch.trim() }
        : baseParams;

      // When searching: fetch unfiltered base (for stats) + filtered (for table) in parallel.
      // When not searching: one call serves both.
      const fetches = isSearching
        ? [listAppointments(baseParams), listVisits(visitParams), listAppointments(apptParams)]
        : [listAppointments(baseParams), listVisits(visitParams)];

      const results       = await Promise.all(fetches);
      const baseAppts     = results[0].data.data.appointments;
      const visitList     = results[1].data.data.visits ?? [];
      const filteredAppts = results[2] ? results[2].data.data.appointments : baseAppts;

      setAllDailyAppts(baseAppts);
      setAppointments(filteredAppts);

      const vMap  = {};
      const idSet = new Set();
      visitList.forEach((v) => {
        if (v.appointment?.id) {
          vMap[v.appointment.id] = v;
          idSet.add(v.appointment.id);
        }
      });
      setVisitsByApptId(vMap);
      setDoneApptIds(idSet);
    } catch (e) {
      setErr(extractError(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [date, doctorFilter, statusFilter, debouncedSearch]);

  async function doStatusUpdate(apptId, nextStatus) {
    setBusy((b) => ({ ...b, [apptId]: true }));
    try {
      await updateStatus(apptId, { status: nextStatus });
      setAppointments((prev) =>
        prev.map((a) => (a.id === apptId ? { ...a, status: nextStatus } : a)),
      );
    } catch (e) {
      setErr(extractError(e));
    } finally {
      setBusy((b) => ({ ...b, [apptId]: false }));
    }
  }

  function handleCancelClose(refreshed) {
    setCancelTarget(null);
    if (refreshed) load();
  }

  function handleCompleteProfileClose(refreshed, visit) {
    const apptId = checkInTarget?.id; // capture before clearing
    setCheckInTarget(null);
    if (refreshed && visit) {
      setAppointments((prev) =>
        prev.map((a) => (a.id === apptId ? { ...a, status: 'COMPLETED' } : a)),
      );
      setConsultationVisit(visit);
    } else if (refreshed) {
      load();
    }
  }

  const stats = {
    total:     allDailyAppts.length,
    pending:   allDailyAppts.filter((a) => a.status === 'SCHEDULED').length,
    completed: allDailyAppts.filter((a) => a.status === 'COMPLETED' || doneApptIds.has(a.id)).length,
    absent:    allDailyAppts.filter((a) => ['CANCELLED', 'NO_SHOW'].includes(a.status)).length,
  };

  const allowedNextStatuses = ROLE_ALLOWED[me?.role] ?? [];

  return (
    <AppShell>
      <div className="flex flex-1 flex-col bg-slate-50">

        {/* ── Sticky header ── */}
        <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur-sm">
          <div className="flex flex-wrap items-center justify-between gap-4 px-8 py-4">
            <div>
              <h1 className="text-lg font-bold text-slate-900">Appointments</h1>
              <p className="text-xs text-slate-500">{fmtDate(date)}</p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <input type="date" value={date}
                onChange={(e) => setDate(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20" />

              {!isDoctor && doctors.length > 0 && (
                <select value={doctorFilter} onChange={(e) => setDoctorFilter(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20">
                  <option value="">All Doctors</option>
                  {doctors.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              )}

              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20">
                <option value="">All Statuses</option>
                {Object.entries(STATUS_CFG).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>

              {canWrite && (
                <>
                  {/* Walk-in — prominent green button */}
                  <button onClick={() => setWalkInOpen(true)}
                    className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500">
                    <UserPlusIcon /> Walk-in
                  </button>

                  {/* Book Appointment */}
                  <button onClick={() => setBookOpen(true)}
                    className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <PlusIcon /> Book Appointment
                  </button>
                </>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-auto px-8 py-6">

          {/* ── Stats strip — always visible, never hidden by search or loading ── */}
          {!err && (
            <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
              <StatCard label="Total"    value={stats.total}     tone="border-slate-200 bg-white text-slate-700"        icon={<CalendarMiniIcon />} />
              <StatCard label="Balance Check-in"  value={stats.pending}   tone="border-blue-200 bg-blue-50 text-blue-800"       icon={<ClockIcon />} />
              <StatCard label="Completed" value={stats.completed} tone="border-emerald-200 bg-emerald-50 text-emerald-800" icon={<CheckIcon />} />
              <StatCard label="Cancelled / Missed" value={stats.absent} tone="border-slate-200 bg-slate-100 text-slate-600" icon={<XCircleIcon />} />
            </div>
          )}

          {/* ── Search bar ── */}
          <div className="mb-5 relative">
            <div className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center">
              <SearchIcon />
            </div>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by patient name, mobile number, or UHID…"
              className="block w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-10 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
            {search && (
              <button onClick={() => setSearch('')}
                className="absolute inset-y-0 right-3.5 flex items-center text-slate-400 hover:text-slate-700">
                <XSmallIcon />
              </button>
            )}
          </div>

          {err && (
            <div className="mb-5 flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3.5 text-sm font-medium text-red-700">
              <WarnIcon /> {err}
            </div>
          )}

          {/* ── Appointments table ── */}
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-100">
                <thead>
                  <tr className="bg-slate-50/80 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <th className="px-4 py-3.5">Patient</th>
                    {!isDoctor && <th className="px-4 py-3.5">Doctor</th>}
                    <th className="px-4 py-3.5">OP No.</th>
                    <th className="px-4 py-3.5">Type</th>
                    <th className="px-4 py-3.5">Status</th>
                    <th className="px-4 py-3.5 text-right">Fee</th>
                    <th className="px-4 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white text-sm">
                  {loading && Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)}

                  {!loading && !err && appointments.length === 0 && (
                    <tr>
                      <td colSpan={isDoctor ? 6 : 7} className="py-16 text-center">
                        <div className="flex flex-col items-center gap-3">
                          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                            <CalendarMiniIcon size={28} />
                          </span>
                          <p className="text-sm font-semibold text-slate-500">No appointments for this date</p>
                          {canWrite && (
                            <div className="flex gap-2 mt-1">
                              <button onClick={() => setWalkInOpen(true)}
                                className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 transition">
                                + Walk-in
                              </button>
                              <button onClick={() => setBookOpen(true)}
                                className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 transition">
                                + Book appointment
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}

                  {!loading && !err && appointments.map((appt) => {
                    const rowBusy    = !!busy[appt.id];
                    const rowActions = (ACTIONS[appt.status] ?? [])
                      .filter((a) => allowedNextStatuses.includes(a.next));

                    return (
                      <tr key={appt.id} className="group hover:bg-slate-50/60 transition-colors">

                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-2.5">
                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-200 text-[11px] font-bold text-slate-600">
                              {(appt.patient?.firstName?.[0] ?? '?').toUpperCase()}
                            </div>
                            <div>
                              <div className="font-semibold text-slate-900">
                                {appt.patient?.firstName}{appt.patient?.lastName ? ` ${appt.patient.lastName}` : ''}
                              </div>
                              <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                                <span className="font-mono">{appt.patient?.uhid}</span>
                                <span>·</span>
                                <span>{appt.patient?.mobile}</span>
                              </div>
                            </div>
                          </div>
                        </td>

                        {!isDoctor && (
                          <td className="px-4 py-3.5">
                            <div className="font-medium text-slate-800">{appt.doctor?.name}</div>
                            <div className="text-[11px] text-slate-400">{appt.doctor?.specialization}</div>
                          </td>
                        )}

                        {/* OP Number */}
                        <td className="px-4 py-3.5">
                          {appt.opNumber
                            ? <span className="inline-block rounded-md bg-blue-50 px-2 py-0.5 font-mono text-xs font-bold text-blue-700">{appt.opNumber}</span>
                            : <span className="text-[11px] italic text-slate-300">—</span>
                          }
                        </td>

                        <td className="px-4 py-3.5">
                          <TypeBadge type={appt.type} />
                          {appt.isFollowUp && (
                            <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-500">
                              Follow-up
                            </div>
                          )}
                        </td>

                        <td className="px-4 py-3.5">
                          <StatusBadge status={appt.status} />
                        </td>

                        <td className="px-4 py-3.5 text-right">
                          <span className="font-mono text-sm font-semibold text-slate-700">
                            ₹{parseFloat(appt.consultationFee).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </span>
                        </td>

                        <td className="px-4 py-3.5">
                          <div className="flex items-center justify-end gap-1.5">
                            {rowBusy ? (
                              <SpinnerIcon />
                            ) : (
                              <>
                                {rowActions.map((action) => (
                                  <button key={action.next} disabled={rowBusy}
                                    onClick={() => {
                                      if (action.needsReason) return setCancelTarget(appt);
                                      // Check-in: open Complete Profile modal first
                                      if (action.next === 'CHECKED_IN') return setCheckInTarget(appt);
                                      doStatusUpdate(appt.id, action.next);
                                    }}
                                    className={`rounded-md border px-2.5 py-1 text-xs font-semibold transition focus:outline-none ${action.cls}`}>
                                    {action.label}
                                  </button>
                                ))}
                                {visitsByApptId[appt.id] && appt.status === 'COMPLETED' && (
                                  <button
                                    onClick={() => setPrintTarget(visitsByApptId[appt.id])}
                                    title="Reprint Bill"
                                    className="rounded-md border border-slate-200 px-2 py-1 text-slate-500 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700">
                                    <PrintIcon />
                                  </button>
                                )}
                                {rowActions.length === 0 && !visitsByApptId[appt.id] && (
                                  <span className="text-[11px] italic text-slate-300">—</span>
                                )}
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>

      {/* ── Modals ── */}
      <BookAppointment
        open={bookOpen}
        initialDate={date}
        onClose={(refreshed) => { setBookOpen(false); if (refreshed) load(); }}
      />

      <WalkInModal
        open={walkInOpen}
        onClose={(refreshed, visit) => {
          setWalkInOpen(false);
          if (refreshed) {
            load();
            if (visit) setConsultationVisit(visit);
          }
        }}
      />

      <CancelModal
        appointment={cancelTarget}
        onClose={handleCancelClose}
      />

      <CompleteProfileModal
        appointment={checkInTarget}
        onClose={handleCompleteProfileClose}
      />

      <ConsultationModal
        open={!!consultationVisit}
        visit={consultationVisit}
        onClose={async (paid) => {
          const visitToQueue = consultationVisit;
          setConsultationVisit(null);
          if (paid && visitToQueue?.id && visitToQueue.queueStatus !== 'WAITING') {
            try {
              await updateQueueStatus(visitToQueue.id, { queueStatus: 'WAITING' });
            } catch { /* already in queue or backend rejection — ignore */ }
          }
          load();
        }}
      />

      <ConsultationModal
        open={!!printTarget}
        visit={printTarget}
        onClose={() => setPrintTarget(null)}
      />
    </AppShell>
  );
}

// ─── Micro icons ─────────────────────────────────────────────────────────────

function PlusIcon() {
  return <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 3v10M3 8h10" /></svg>;
}
function UserPlusIcon() {
  return <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="6" cy="5" r="3" /><path d="M1 14c0-3 2.2-5 5-5" /><path d="M12 9v6M9 12h6" /></svg>;
}
function CalendarMiniIcon({ size = 18 }) {
  return <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="1.5" y="2.5" width="13" height="12" rx="1.5" /><path d="M1.5 6.5h13M5 1.5v2M11 1.5v2" /></svg>;
}
function ClockIcon() {
  return <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="8" cy="8" r="6.5" /><path d="M8 5v3.5l2.5 1.5" /></svg>;
}
function CheckIcon() {
  return <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 8l3.5 3.5L13 5" /></svg>;
}
function XCircleIcon() {
  return <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="8" cy="8" r="6.5" /><path d="M5.5 5.5l5 5M10.5 5.5l-5 5" /></svg>;
}
function WarnIcon() {
  return <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor"><path d="M8 1a.5.5 0 0 1 .44.26l6.5 12A.5.5 0 0 1 14.5 14H1.5a.5.5 0 0 1-.44-.74l6.5-12A.5.5 0 0 1 8 1zm0 4.5a.75.75 0 0 0-.75.75v3a.75.75 0 0 0 1.5 0v-3A.75.75 0 0 0 8 5.5zm0 6.5a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5z" /></svg>;
}
function SpinnerIcon() {
  return <svg width="16" height="16" viewBox="0 0 16 16" className="animate-spin text-slate-400" fill="none"><circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" strokeDasharray="18 20" strokeLinecap="round" /></svg>;
}
function PrintIcon() {
  return <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 5V2.5h8V5" /><rect x="1.5" y="5" width="13" height="7" rx="1.5" /><path d="M4 12.5h8v1H4z" fill="currentColor" stroke="none" /></svg>;
}
function SearchIcon() {
  return <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" className="text-slate-400"><circle cx="6.5" cy="6.5" r="4.5" /><path d="M10 10l3.5 3.5" strokeLinecap="round" /></svg>;
}
function XSmallIcon() {
  return <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4l8 8M12 4l-8 8" strokeLinecap="round" /></svg>;
}
