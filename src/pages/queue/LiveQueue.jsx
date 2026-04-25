import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../../lib/auth';
import { extractError } from '../../lib/api';
import { api } from '../../lib/api';
import { listVisits, updateQueueStatus, updateVitals } from '../../api/visits.api';
import { AppShell } from '../../components/AppShell';
import { Button } from '../../components/Button';
import { Modal } from '../../components/Modal';
import { RegisterVisitModal } from './RegisterVisitModal';

// ─── Constants ────────────────────────────────────────────────────────────────

const REFRESH_INTERVAL = 30_000; // 30 s

const INP = 'block w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20';

function FF({ label, hint, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold text-slate-600">{label}</label>
      {children}
      {hint && <p className="text-[11px] text-slate-400">{hint}</p>}
    </div>
  );
}

// RBAC: which next-statuses each role may trigger
const ROLE_CAN = {
  ADMIN:        ['IN_CONSULTATION', 'DONE', 'CANCELLED', 'TRANSFERRED'],
  DOCTOR:       ['IN_CONSULTATION', 'DONE'],
  RECEPTIONIST: ['CANCELLED'],
};

// ─── Utility ─────────────────────────────────────────────────────────────────

function todayStr() { return new Date().toISOString().split('T')[0]; }

function fmtDateHeader(d) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-IN', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
  });
}

function elapsedStr(iso) {
  const mins = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return '< 1m';
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60), m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function fmtTime(iso) {
  return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

// ─── Vitals Update Modal ──────────────────────────────────────────────────────

function VitalsModal({ visit, onClose }) {
  const [form, setForm] = useState({
    bloodPressure: '', pulse: '', spo2: '', temperature: '', weight: '',
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  // Pre-fill when visit changes
  useEffect(() => {
    if (!visit) return;
    setForm({
      bloodPressure: visit.bloodPressure ?? '',
      pulse:         visit.pulse != null ? String(visit.pulse) : '',
      spo2:          visit.spo2  != null ? String(visit.spo2)  : '',
      temperature:   visit.temperature != null ? String(visit.temperature) : '',
      weight:        visit.weight != null ? String(visit.weight) : '',
    });
    setErr('');
  }, [visit]);

  async function save() {
    const payload = {};
    if (form.bloodPressure.trim()) payload.bloodPressure = form.bloodPressure.trim();
    if (form.pulse)       payload.pulse       = parseInt(form.pulse, 10);
    if (form.spo2)        payload.spo2        = parseInt(form.spo2, 10);
    if (form.temperature) payload.temperature = parseFloat(form.temperature);
    if (form.weight)      payload.weight      = parseFloat(form.weight);

    if (!Object.keys(payload).length) { setErr('Enter at least one vital sign.'); return; }
    setBusy(true);
    try {
      await updateVitals(visit.id, payload);
      onClose(true);
    } catch (e) {
      setErr(extractError(e));
    } finally {
      setBusy(false);
    }
  }

  const patName = visit
    ? `${visit.patient?.firstName ?? ''}${visit.patient?.lastName ? ` ${visit.patient.lastName}` : ''}`
    : '';

  return (
    <Modal open={!!visit} onClose={() => onClose(false)} title="Record Vitals" size="sm"
      footer={
        <>
          <Button variant="secondary" size="md" onClick={() => onClose(false)} disabled={busy}>Cancel</Button>
          <button onClick={save} disabled={busy}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 transition">
            {busy ? <SpinnerIcon /> : null}{busy ? 'Saving…' : 'Save Vitals'}
          </button>
        </>
      }
    >
      <p className="mb-4 text-xs font-semibold text-slate-500">
        Patient: <span className="text-slate-800">{patName}</span>
        {visit?.opNumber && <> · <span className="font-mono text-blue-700">{visit.opNumber}</span></>}
      </p>
      <div className="grid grid-cols-2 gap-3">
        <FF label='Blood Pressure' hint='"120/80"'>
          <input className={INP} value={form.bloodPressure} placeholder="120/80"
            onChange={(e) => setForm((f) => ({ ...f, bloodPressure: e.target.value }))} />
        </FF>
        <FF label="Pulse (bpm)">
          <input type="number" min="20" max="300" className={INP} value={form.pulse} placeholder="72"
            onChange={(e) => setForm((f) => ({ ...f, pulse: e.target.value }))} />
        </FF>
        <FF label="SpO₂ (%)">
          <input type="number" min="0" max="100" className={INP} value={form.spo2} placeholder="98"
            onChange={(e) => setForm((f) => ({ ...f, spo2: e.target.value }))} />
        </FF>
        <FF label="Temperature (°C)">
          <input type="number" step="0.1" min="30" max="45" className={INP} value={form.temperature} placeholder="37.0"
            onChange={(e) => setForm((f) => ({ ...f, temperature: e.target.value }))} />
        </FF>
        <FF label="Weight (kg)">
          <input type="number" step="0.1" min="0" max="500" className={INP} value={form.weight} placeholder="65.0"
            onChange={(e) => setForm((f) => ({ ...f, weight: e.target.value }))} />
        </FF>
      </div>
      {err && <p className="mt-3 text-xs font-medium text-red-600">⚠ {err}</p>}
    </Modal>
  );
}

// ─── Vital pill ───────────────────────────────────────────────────────────────

function VitalPill({ label, value }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
      <span className="text-slate-400">{label}</span> {value}
    </span>
  );
}

// ─── Visit card ───────────────────────────────────────────────────────────────

const CARD_ACCENT = {
  WAITING:         'border-l-4 border-l-amber-400',
  IN_CONSULTATION: 'border-l-4 border-l-violet-500',
  DONE:            'border-l-4 border-l-emerald-400',
  TRANSFERRED:     'border-l-4 border-l-sky-400',
};

function VisitCard({ visit, userRole, onStatusChange, onVitals, busy }) {
  const { queueStatus: status, patient, doctor } = visit;
  const allowedNext = ROLE_CAN[userRole] ?? [];

  const canStart    = status === 'WAITING'         && allowedNext.includes('IN_CONSULTATION');
  const canComplete = status === 'IN_CONSULTATION'  && allowedNext.includes('DONE');
  const canVitals   = status === 'WAITING'         && (userRole === 'ADMIN' || userRole === 'RECEPTIONIST');
  const canCancel   = status === 'WAITING'         && allowedNext.includes('CANCELLED');
  const canTransfer = status === 'WAITING'         && allowedNext.includes('TRANSFERRED');

  const elapsed = status === 'IN_CONSULTATION'
    ? elapsedStr(visit.updatedAt)
    : elapsedStr(visit.createdAt);
  const elapsedLabel = status === 'IN_CONSULTATION' ? 'consulting' : 'waiting';

  const fullName = `${patient?.firstName ?? ''}${patient?.lastName ? ` ${patient.lastName}` : ''}`;

  return (
    <div className={`rounded-xl bg-white shadow-sm transition-all hover:shadow-md ${CARD_ACCENT[status] ?? 'border-l-4 border-l-slate-200'} ${busy ? 'opacity-50 pointer-events-none' : ''}`}>
      <div className="p-3.5">
        {/* Header: OP number + timer */}
        <div className="mb-2.5 flex items-start justify-between gap-2">
          <span className="inline-block rounded-md bg-blue-50 px-2 py-0.5 font-mono text-xs font-bold text-blue-700">
            {visit.opNumber}
          </span>
          <span className="shrink-0 text-[11px] text-slate-400 tabular-nums">
            ⏱ {elapsed} {elapsedLabel}
          </span>
        </div>

        {/* Patient identity */}
        <div className="mb-0.5 text-sm font-bold text-slate-900 leading-snug">{fullName}</div>
        <div className="mb-2 text-[11px] font-mono text-slate-400 leading-snug">
          {patient?.uhid} · {patient?.gender?.[0]} · {patient?.age ?? '?'}y · {patient?.mobile}
        </div>

        {/* Doctor (for admin/receptionist board — shows which doctor) */}
        {(userRole === 'ADMIN' || userRole === 'RECEPTIONIST') && doctor && (
          <div className="mb-2 flex items-center gap-1 text-[11px] text-slate-500">
            <StethIcon />
            <span className="font-medium">{doctor.name}</span>
            {doctor.roomNo && <span className="text-slate-400">· {doctor.roomNo}</span>}
          </div>
        )}

        {/* Chief complaint */}
        {visit.chiefComplaint && (
          <p className="mb-2 line-clamp-2 text-xs italic text-slate-500">
            &ldquo;{visit.chiefComplaint}&rdquo;
          </p>
        )}

        {/* Vitals pills */}
        {(visit.bloodPressure || visit.pulse || visit.spo2 || visit.temperature || visit.weight) && (
          <div className="mb-3 flex flex-wrap gap-1">
            {visit.bloodPressure && <VitalPill label="BP"   value={visit.bloodPressure} />}
            {visit.pulse         && <VitalPill label="♥"    value={`${visit.pulse}bpm`} />}
            {visit.spo2          && <VitalPill label="SpO₂" value={`${visit.spo2}%`} />}
            {visit.temperature   && <VitalPill label="T"    value={`${visit.temperature}°C`} />}
            {visit.weight        && <VitalPill label="W"    value={`${visit.weight}kg`} />}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex flex-wrap items-center gap-1.5">
          {busy && <SpinnerIcon />}

          {!busy && canVitals && (
            <button onClick={() => onVitals(visit)}
              className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700">
              {(visit.bloodPressure || visit.pulse) ? '✏ Vitals' : '+ Vitals'}
            </button>
          )}

          {!busy && canStart && (
            <button onClick={() => onStatusChange(visit.id, 'IN_CONSULTATION')}
              className="rounded-md bg-violet-600 px-2.5 py-1 text-xs font-bold text-white shadow-sm transition hover:bg-violet-700">
              ▶ Start
            </button>
          )}

          {!busy && canComplete && (
            <button onClick={() => onStatusChange(visit.id, 'DONE')}
              className="rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-bold text-white shadow-sm transition hover:bg-emerald-700">
              ✓ Done
            </button>
          )}

          {!busy && canTransfer && (
            <button onClick={() => onStatusChange(visit.id, 'TRANSFERRED')}
              className="rounded-md border border-sky-200 px-2.5 py-1 text-xs font-semibold text-sky-700 transition hover:bg-sky-50">
              ↗ Transfer
            </button>
          )}

          {!busy && canCancel && (
            <button onClick={() => onStatusChange(visit.id, 'CANCELLED')}
              className="ml-auto rounded-md px-1.5 py-1 text-xs font-semibold text-slate-400 transition hover:bg-red-50 hover:text-red-600"
              title="Cancel visit">
              ✕
            </button>
          )}
        </div>

        {/* DONE/TRANSFERRED: show completion metadata */}
        {(status === 'DONE' || status === 'TRANSFERRED') && (
          <div className="mt-2 flex items-center gap-1 text-[11px] text-slate-400">
            <span>{status === 'DONE' ? '✓ Completed' : '↗ Transferred'}</span>
            <span>at {fmtTime(visit.updatedAt)}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Kanban column ────────────────────────────────────────────────────────────

const COL_CFG = {
  WAITING:         { label: 'Waiting',         dot: 'bg-amber-500',   header: 'bg-amber-50 border-amber-100',   count: 'text-amber-700 bg-amber-100' },
  IN_CONSULTATION: { label: 'In Consultation', dot: 'bg-violet-500',  header: 'bg-violet-50 border-violet-100', count: 'text-violet-700 bg-violet-100' },
  DONE:            { label: 'Completed',       dot: 'bg-emerald-500', header: 'bg-emerald-50 border-emerald-100', count: 'text-emerald-700 bg-emerald-100' },
};

function KanbanColumn({ status, visits, userRole, onStatusChange, onVitals, busyMap }) {
  const cfg = COL_CFG[status];

  return (
    <div className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 shadow-sm">
      {/* Column header */}
      <div className={`flex items-center justify-between border-b px-4 py-3 ${cfg.header}`}>
        <div className="flex items-center gap-2">
          <span className={`h-2.5 w-2.5 rounded-full ${cfg.dot}`} />
          <h3 className="text-sm font-bold text-slate-700">{cfg.label}</h3>
        </div>
        <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${cfg.count}`}>
          {visits.length}
        </span>
      </div>

      {/* Scrollable card list */}
      <div className="flex-1 space-y-3 overflow-y-auto p-3">
        {visits.length === 0 ? (
          <div className="flex flex-col items-center gap-1.5 py-12 text-center">
            <span className="text-2xl opacity-30">
              {status === 'WAITING' ? '🪑' : status === 'IN_CONSULTATION' ? '🩺' : '✅'}
            </span>
            <p className="text-xs font-medium text-slate-400">
              {status === 'WAITING' ? 'No patients waiting' :
               status === 'IN_CONSULTATION' ? 'No active consultations' :
               'No completed visits yet'}
            </p>
          </div>
        ) : (
          visits.map((v) => (
            <VisitCard
              key={v.id}
              visit={v}
              userRole={userRole}
              onStatusChange={onStatusChange}
              onVitals={onVitals}
              busy={!!busyMap[v.id]}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function LiveQueue() {
  const { user: me } = useAuth();
  const isDoctor  = me?.role === 'DOCTOR';
  const canWrite  = me?.role === 'ADMIN' || me?.role === 'RECEPTIONIST';

  const [date, setDate]             = useState(todayStr);
  const [doctorFilter, setDoctorFilter] = useState('');
  const [doctors, setDoctors]       = useState([]);
  const [visits, setVisits]         = useState([]);
  const [loading, setLoading]       = useState(true);
  const [err, setErr]               = useState('');
  const [busyMap, setBusyMap]       = useState({});
  const [lastRefresh, setLastRefresh] = useState(null);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [vitalsTarget, setVitalsTarget] = useState(null);
  const timerRef = useRef(null);

  const isToday = date === todayStr();

  // Load active doctors for filter dropdown (non-doctor roles)
  useEffect(() => {
    if (isDoctor) return;
    api.get('/doctors', { params: { pageSize: 100, isActive: 'true' } })
      .then(({ data }) => setDoctors(data.data.items))
      .catch(() => {});
  }, [isDoctor]);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setErr('');
    try {
      const params = { date, limit: 100 };
      if (!isDoctor && doctorFilter) params.doctorId = doctorFilter;
      const { data } = await listVisits(params);
      setVisits(data.data.visits);
      setLastRefresh(new Date());
    } catch (e) {
      setErr(extractError(e));
    } finally {
      if (!silent) setLoading(false);
    }
  }, [date, doctorFilter, isDoctor]);

  // Initial load + filter changes
  useEffect(() => { load(); }, [load]);

  // Auto-refresh every 30s only for today's view
  useEffect(() => {
    if (!isToday) { clearInterval(timerRef.current); return; }
    timerRef.current = setInterval(() => load(true), REFRESH_INTERVAL);
    return () => clearInterval(timerRef.current);
  }, [isToday, load]);

  // ── Optimistic status update ─────────────────────────────────────────────
  async function onStatusChange(visitId, nextStatus) {
    const original = visits.find((v) => v.id === visitId);
    if (!original) return;

    // Optimistic: move card immediately
    setBusyMap((b) => ({ ...b, [visitId]: true }));
    setVisits((prev) => prev.map((v) => v.id === visitId ? { ...v, queueStatus: nextStatus, updatedAt: new Date().toISOString() } : v));

    try {
      await updateQueueStatus(visitId, { queueStatus: nextStatus });
    } catch (e) {
      // Revert on failure
      setVisits((prev) => prev.map((v) => v.id === visitId ? original : v));
      setErr(extractError(e));
    } finally {
      setBusyMap((b) => ({ ...b, [visitId]: false }));
    }
  }

  function handleVitalsClose(refreshed) {
    setVitalsTarget(null);
    if (refreshed) {
      // Optimistically update vitals on the card by re-fetching just the changed visit
      load(true);
    }
  }

  // ── Split into columns ───────────────────────────────────────────────────
  const waiting        = visits.filter((v) => v.queueStatus === 'WAITING').sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  const inConsultation = visits.filter((v) => v.queueStatus === 'IN_CONSULTATION').sort((a, b) => new Date(a.updatedAt) - new Date(b.updatedAt));
  const done           = visits.filter((v) => ['DONE', 'TRANSFERRED'].includes(v.queueStatus)).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  const cancelledCount = visits.filter((v) => v.queueStatus === 'CANCELLED').length;

  return (
    <AppShell>
      <div className="flex flex-1 flex-col overflow-hidden bg-slate-100">

        {/* ── Sticky header ── */}
        <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 backdrop-blur-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-3.5">
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-lg font-bold text-slate-900">Live Queue</h1>
                {isToday && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700 ring-1 ring-emerald-200">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" /> LIVE
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-xs text-slate-500">
                {fmtDateHeader(date)}
                {lastRefresh && isToday && (
                  <span className="ml-2 text-slate-400">· updated {fmtTime(lastRefresh.toISOString())}</span>
                )}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {/* Date picker */}
              <input type="date" value={date} max={todayStr()}
                onChange={(e) => setDate(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20" />

              {/* Doctor filter — hidden for DOCTOR role */}
              {!isDoctor && doctors.length > 0 && (
                <select value={doctorFilter} onChange={(e) => setDoctorFilter(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20">
                  <option value="">All Doctors</option>
                  {doctors.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              )}

              {/* Stats summary */}
              {!loading && (
                <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold">
                  <span className="text-amber-700">{waiting.length} waiting</span>
                  <span className="text-slate-300">|</span>
                  <span className="text-violet-700">{inConsultation.length} consulting</span>
                  <span className="text-slate-300">|</span>
                  <span className="text-emerald-700">{done.length} done</span>
                  {cancelledCount > 0 && <><span className="text-slate-300">|</span><span className="text-slate-400">{cancelledCount} cancelled</span></>}
                </div>
              )}

              {/* Manual refresh */}
              <button onClick={() => load()}
                className="rounded-lg border border-slate-200 bg-white p-2 text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
                title="Refresh">
                <RefreshIcon />
              </button>

              {/* Register walk-in button — today only, ADMIN/RECEPTIONIST */}
              {canWrite && isToday && (
                <button onClick={() => setRegisterOpen(true)}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <PlusIcon /> Register Walk-in
                </button>
              )}
            </div>
          </div>
        </header>

        {/* ── Body ── */}
        <main className="flex flex-1 flex-col overflow-hidden px-5 py-5">
          {err && (
            <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              <WarnIcon /> {err}
            </div>
          )}

          {loading ? (
            <div className="flex flex-1 items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-slate-200 border-t-blue-600" />
            </div>
          ) : (
            <div className="grid flex-1 grid-cols-1 gap-4 overflow-hidden md:grid-cols-3">
              <KanbanColumn
                status="WAITING"
                visits={waiting}
                userRole={me?.role}
                onStatusChange={onStatusChange}
                onVitals={setVitalsTarget}
                busyMap={busyMap}
              />
              <KanbanColumn
                status="IN_CONSULTATION"
                visits={inConsultation}
                userRole={me?.role}
                onStatusChange={onStatusChange}
                onVitals={setVitalsTarget}
                busyMap={busyMap}
              />
              <KanbanColumn
                status="DONE"
                visits={done}
                userRole={me?.role}
                onStatusChange={onStatusChange}
                onVitals={setVitalsTarget}
                busyMap={busyMap}
              />
            </div>
          )}
        </main>
      </div>

      {/* ── Modals ── */}
      <RegisterVisitModal
        open={registerOpen}
        onClose={(refreshed) => { setRegisterOpen(false); if (refreshed) load(); }}
      />
      <VitalsModal
        visit={vitalsTarget}
        onClose={handleVitalsClose}
      />
    </AppShell>
  );
}

// ─── Micro icons ─────────────────────────────────────────────────────────────

function PlusIcon() {
  return <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 3v10M3 8h10" /></svg>;
}
function RefreshIcon() {
  return <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M13.5 8A5.5 5.5 0 1 1 8 2.5" /><path d="M8 1v3h3" /></svg>;
}
function WarnIcon() {
  return <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor"><path d="M8 1a.5.5 0 0 1 .44.26l6.5 12A.5.5 0 0 1 14.5 14H1.5a.5.5 0 0 1-.44-.74l6.5-12A.5.5 0 0 1 8 1zm0 4.5a.75.75 0 0 0-.75.75v3a.75.75 0 0 0 1.5 0v-3A.75.75 0 0 0 8 5.5zm0 6.5a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5z" /></svg>;
}
function SpinnerIcon() {
  return <svg width="14" height="14" viewBox="0 0 16 16" className="animate-spin" fill="none"><circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" strokeDasharray="18 20" strokeLinecap="round" /></svg>;
}
function StethIcon() {
  return <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="2"/><path d="M4 2v6a4 4 0 0 0 4 4h2"/><path d="M4 2H2M4 2H6"/></svg>;
}
