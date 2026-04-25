import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../lib/auth';
import { extractError } from '../../lib/api';
import { api } from '../../lib/api';
import { listAppointments, updateStatus, cancelAppointment } from '../../api/appointments.api';
import { AppShell } from '../../components/AppShell';
import { Button } from '../../components/Button';
import { Modal } from '../../components/Modal';
import { BookAppointment } from './BookAppointment';

// ─── Design tokens ────────────────────────────────────────────────────────────

const STATUS_CFG = {
  SCHEDULED:       { label: 'Scheduled',    dot: 'bg-blue-500',    tone: 'bg-blue-50 text-blue-700 ring-blue-200' },
  CHECKED_IN:      { label: 'Checked In',   dot: 'bg-amber-500',   tone: 'bg-amber-50 text-amber-700 ring-amber-200' },
  IN_CONSULTATION: { label: 'In Consult',   dot: 'bg-violet-500',  tone: 'bg-violet-50 text-violet-700 ring-violet-200' },
  COMPLETED:       { label: 'Completed',    dot: 'bg-emerald-500', tone: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  NO_SHOW:         { label: 'No Show',      dot: 'bg-orange-500',  tone: 'bg-orange-50 text-orange-700 ring-orange-200' },
  CANCELLED:       { label: 'Cancelled',    dot: 'bg-slate-400',   tone: 'bg-slate-100 text-slate-500 ring-slate-200' },
};

const TYPE_CFG = {
  BOOKED:  { label: 'Pre-booked', tone: 'bg-sky-50 text-sky-700 ring-sky-200' },
  WALK_IN: { label: 'Walk-in',    tone: 'bg-amber-50 text-amber-700 ring-amber-200' },
};

// Per-status next actions — backend state machine enforces validity
const ACTIONS = {
  SCHEDULED:       [
    { label: 'Check In',     next: 'CHECKED_IN',      cls: 'text-blue-700 hover:bg-blue-50 border-blue-200' },
    { label: 'No Show',      next: 'NO_SHOW',          cls: 'text-orange-600 hover:bg-orange-50 border-orange-200' },
    { label: 'Cancel',       next: 'CANCELLED',        cls: 'text-red-600 hover:bg-red-50 border-red-200', needsReason: true },
  ],
  CHECKED_IN:      [
    { label: 'Start Consult',next: 'IN_CONSULTATION',  cls: 'text-violet-700 hover:bg-violet-50 border-violet-200' },
    { label: 'Cancel',       next: 'CANCELLED',        cls: 'text-red-600 hover:bg-red-50 border-red-200', needsReason: true },
  ],
  IN_CONSULTATION: [
    { label: 'Complete',     next: 'COMPLETED',        cls: 'text-emerald-700 hover:bg-emerald-50 border-emerald-200' },
  ],
  COMPLETED: [], NO_SHOW: [], CANCELLED: [],
};

// Role-based action filtering
const ROLE_ALLOWED = {
  ADMIN:        ['CHECKED_IN', 'IN_CONSULTATION', 'COMPLETED', 'NO_SHOW', 'CANCELLED'],
  RECEPTIONIST: ['CHECKED_IN', 'CANCELLED'],
  DOCTOR:       ['IN_CONSULTATION', 'COMPLETED', 'NO_SHOW'],
};

// ─── Utility ─────────────────────────────────────────────────────────────────

function today() {
  return new Date().toISOString().split('T')[0];
}

function fmtTime(t) {
  if (!t) return '—';
  const [h, m] = t.split(':');
  const hour = parseInt(h, 10);
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const display = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  return `${display}:${m} ${suffix}`;
}

function fmtDate(d) {
  if (!d) return '';
  const dt = new Date(d);
  return dt.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
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
      {[40, 120, 110, 80, 90, 60, 100].map((w, i) => (
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
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

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
    <Modal
      open={!!appointment}
      onClose={() => onClose(false)}
      title="Cancel Appointment"
      size="sm"
      footer={
        <>
          <Button variant="secondary" size="md" onClick={() => onClose(false)} disabled={busy}>Keep</Button>
          <button
            onClick={confirm}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60 transition"
          >
            {busy ? 'Cancelling…' : 'Confirm Cancel'}
          </button>
        </>
      }
    >
      <p className="mb-4 text-sm text-slate-600">
        Cancel appointment for <span className="font-semibold text-slate-800">{patName}</span> at{' '}
        <span className="font-semibold">{fmtTime(appointment?.appointmentTime)}</span>?
      </p>
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-semibold text-slate-600">
          Reason <span className="text-red-500">*</span>
        </label>
        <textarea
          rows={3}
          value={reason}
          onChange={(e) => { setReason(e.target.value); setErr(''); }}
          placeholder="e.g. Patient requested cancellation"
          className="block w-full resize-none rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm placeholder:text-slate-400 focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-400/20"
        />
        {err && <p className="text-xs font-medium text-red-600">⚠ {err}</p>}
      </div>
    </Modal>
  );
}

// ─── Main dashboard ───────────────────────────────────────────────────────────

export default function AppointmentsDashboard() {
  const { user: me } = useAuth();
  const isDoctor       = me?.role === 'DOCTOR';
  const canWrite       = me?.role === 'ADMIN' || me?.role === 'RECEPTIONIST';

  const [date, setDate]               = useState(today);
  const [doctorFilter, setDoctorFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [doctors, setDoctors]         = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading]         = useState(true);
  const [err, setErr]                 = useState('');
  const [busy, setBusy]               = useState({}); // { [apptId]: true }
  const [bookOpen, setBookOpen]       = useState(false);
  const [cancelTarget, setCancelTarget] = useState(null);

  // Load doctors for filter dropdown (Admin/Receptionist only)
  useEffect(() => {
    if (isDoctor) return;
    api.get('/doctors', { params: { pageSize: 100, isActive: 'true' } })
      .then(({ data }) => setDoctors(data.data.items))
      .catch(() => {});
  }, [isDoctor]);

  async function load() {
    setLoading(true);
    setErr('');
    try {
      const params = { date, limit: 200 };
      if (!isDoctor && doctorFilter) params.doctorId = doctorFilter;
      if (statusFilter) params.status = statusFilter;
      const { data } = await listAppointments(params);
      setAppointments(data.data.appointments);
    } catch (e) {
      setErr(extractError(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [date, doctorFilter, statusFilter]);

  // ── Status quick-action ──────────────────────────────────────────────────
  async function doStatusUpdate(apptId, nextStatus) {
    setBusy((b) => ({ ...b, [apptId]: true }));
    try {
      await updateStatus(apptId, { status: nextStatus });
      // Optimistically update the row so the UI responds instantly
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

  // ── Derived stats ────────────────────────────────────────────────────────
  const stats = {
    total:     appointments.length,
    pending:   appointments.filter((a) => ['SCHEDULED', 'CHECKED_IN', 'IN_CONSULTATION'].includes(a.status)).length,
    completed: appointments.filter((a) => a.status === 'COMPLETED').length,
    absent:    appointments.filter((a) => ['CANCELLED', 'NO_SHOW'].includes(a.status)).length,
  };

  const allowedNextStatuses = ROLE_ALLOWED[me?.role] ?? [];

  return (
    <AppShell>
      <div className="flex flex-1 flex-col bg-slate-50">

        {/* ── Sticky header ── */}
        <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur-sm">
          <div className="flex flex-wrap items-center justify-between gap-4 px-8 py-4">
            {/* Title */}
            <div>
              <h1 className="text-lg font-bold text-slate-900">Appointments</h1>
              <p className="text-xs text-slate-500">{fmtDate(date)}</p>
            </div>

            {/* Controls */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Date picker */}
              <input
                type="date"
                value={date}
                onChange={(e) => { setDate(e.target.value); }}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />

              {/* Doctor filter — hidden for DOCTOR role */}
              {!isDoctor && doctors.length > 0 && (
                <select
                  value={doctorFilter}
                  onChange={(e) => setDoctorFilter(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value="">All Doctors</option>
                  {doctors.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              )}

              {/* Status filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="">All Statuses</option>
                {Object.entries(STATUS_CFG).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>

              {/* Book button */}
              {canWrite && (
                <button
                  onClick={() => setBookOpen(true)}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <PlusIcon /> Book Appointment
                </button>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-auto px-8 py-6">

          {/* ── Stats strip ── */}
          {!loading && !err && (
            <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
              <StatCard
                label="Total"
                value={stats.total}
                tone="border-slate-200 bg-white text-slate-700"
                icon={<CalendarMiniIcon />}
              />
              <StatCard
                label="Pending"
                value={stats.pending}
                tone="border-blue-200 bg-blue-50 text-blue-800"
                icon={<ClockIcon />}
              />
              <StatCard
                label="Completed"
                value={stats.completed}
                tone="border-emerald-200 bg-emerald-50 text-emerald-800"
                icon={<CheckIcon />}
              />
              <StatCard
                label="Cancelled / No-show"
                value={stats.absent}
                tone="border-slate-200 bg-slate-100 text-slate-600"
                icon={<XCircleIcon />}
              />
            </div>
          )}

          {/* ── Error banner ── */}
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
                    <th className="px-4 py-3.5 w-24">Time</th>
                    <th className="px-4 py-3.5">Patient</th>
                    {!isDoctor && <th className="px-4 py-3.5">Doctor</th>}
                    <th className="px-4 py-3.5">Type</th>
                    <th className="px-4 py-3.5">Status</th>
                    <th className="px-4 py-3.5 text-right">Fee</th>
                    <th className="px-4 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white text-sm">
                  {loading &&
                    Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)}

                  {!loading && !err && appointments.length === 0 && (
                    <tr>
                      <td colSpan={isDoctor ? 6 : 7} className="py-16 text-center">
                        <div className="flex flex-col items-center gap-3">
                          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                            <CalendarMiniIcon size={28} />
                          </span>
                          <p className="text-sm font-semibold text-slate-500">No appointments for this date</p>
                          {canWrite && (
                            <button
                              onClick={() => setBookOpen(true)}
                              className="mt-1 rounded-lg border border-blue-200 bg-blue-50 px-4 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 transition"
                            >
                              + Book first appointment
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}

                  {!loading && !err && appointments.map((appt) => {
                    const rowBusy = !!busy[appt.id];
                    const rowActions = (ACTIONS[appt.status] ?? [])
                      .filter((a) => allowedNextStatuses.includes(a.next));

                    return (
                      <tr key={appt.id} className="group hover:bg-slate-50/60 transition-colors">

                        {/* Time */}
                        <td className="px-4 py-3.5">
                          <span className="font-mono text-sm font-semibold text-slate-800">
                            {fmtTime(appt.appointmentTime)}
                          </span>
                        </td>

                        {/* Patient */}
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

                        {/* Doctor — hidden for DOCTOR role */}
                        {!isDoctor && (
                          <td className="px-4 py-3.5">
                            <div className="font-medium text-slate-800">{appt.doctor?.name}</div>
                            <div className="text-[11px] text-slate-400">{appt.doctor?.specialization}</div>
                          </td>
                        )}

                        {/* Type */}
                        <td className="px-4 py-3.5">
                          <TypeBadge type={appt.type} />
                          {appt.isFollowUp && (
                            <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-500">
                              Follow-up
                            </div>
                          )}
                        </td>

                        {/* Status */}
                        <td className="px-4 py-3.5">
                          <StatusBadge status={appt.status} />
                        </td>

                        {/* Fee */}
                        <td className="px-4 py-3.5 text-right">
                          <span className="font-mono text-sm font-semibold text-slate-700">
                            ₹{parseFloat(appt.consultationFee).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3.5">
                          <div className="flex items-center justify-end gap-1.5">
                            {rowBusy ? (
                              <SpinnerIcon />
                            ) : rowActions.length > 0 ? (
                              rowActions.map((action) => (
                                <button
                                  key={action.next}
                                  disabled={rowBusy}
                                  onClick={() =>
                                    action.needsReason
                                      ? setCancelTarget(appt)
                                      : doStatusUpdate(appt.id, action.next)
                                  }
                                  className={`rounded-md border px-2.5 py-1 text-xs font-semibold transition focus:outline-none ${action.cls}`}
                                >
                                  {action.label}
                                </button>
                              ))
                            ) : (
                              <span className="text-[11px] italic text-slate-300">—</span>
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
      <CancelModal
        appointment={cancelTarget}
        onClose={handleCancelClose}
      />
    </AppShell>
  );
}

// ─── Micro icons ─────────────────────────────────────────────────────────────

function PlusIcon() {
  return <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 3v10M3 8h10" /></svg>;
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
