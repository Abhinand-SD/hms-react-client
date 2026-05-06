import { useEffect, useState } from 'react';
import { api, extractError } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { AppShell } from '../../components/AppShell';
import { Button } from '../../components/Button';
import { Input, Select, Field } from '../../components/Input';
import { Modal } from '../../components/Modal';

const PAGE_SIZE = 20;

function fmtCurrency(val) {
  const n = parseFloat(val);
  return isNaN(n) ? '—' : `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
}

function ActiveBadge({ active }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${active ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-slate-100 text-slate-600 ring-slate-200'}`}>
      <span className={`mr-1 h-1.5 w-1.5 rounded-full ${active ? 'bg-emerald-500' : 'bg-slate-400'}`} />
      {active ? 'Active' : 'Inactive'}
    </span>
  );
}

function DoctorFormModal({ open, onClose, initial }) {
  const isEdit = !!initial;
  const empty = { name: '', specialization: '', code: '', qualification: '', consultationFee: '', followUpFee: '', followUpValidityDays: '30', roomNo: '' };
  const [form, setForm] = useState(empty);
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(initial
        ? {
            name: initial.name,
            specialization: initial.specialization,
            code: initial.code ?? '',
            qualification: initial.qualification ?? '',
            consultationFee: initial.consultationFee,
            followUpFee: initial.followUpFee,
            followUpValidityDays: String(initial.followUpValidityDays),
            roomNo: initial.roomNo ?? '',
          }
        : empty);
      setErr('');
    }
  }, [open, initial]);

  function set(k, v) { setForm((f) => ({ ...f, [k]: v })); }

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setErr('');
    try {
      const payload = {
        name: form.name,
        specialization: form.specialization,
        code: form.code || undefined,
        qualification: form.qualification || undefined,
        consultationFee: parseFloat(form.consultationFee),
        followUpFee: parseFloat(form.followUpFee),
        followUpValidityDays: parseInt(form.followUpValidityDays, 10),
        roomNo: form.roomNo || undefined,
      };
      if (isEdit) {
        await api.patch(`/doctors/${initial.id}`, payload);
      } else {
        await api.post('/doctors', payload);
      }
      onClose(true);
    } catch (e) {
      setErr(extractError(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={() => onClose(false)} title={isEdit ? 'Edit Doctor' : 'New Doctor'} size="lg"
      footer={
        <>
          <Button variant="secondary" size="md" type="button" onClick={() => onClose(false)}>Cancel</Button>
          <Button size="md" type="submit" form="doctor-form" disabled={saving}>
            {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create doctor'}
          </Button>
        </>
      }
    >
      <form id="doctor-form" onSubmit={submit} className="space-y-3">
        {err && <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-600">{err}</p>}
        <div className="grid grid-cols-3 gap-3">
          <Field label="Full name *">
            <Input value={form.name} onChange={(e) => set('name', e.target.value)} required placeholder="Dr. Priya Sharma" />
          </Field>
          <Field label="Specialization *">
            <Input value={form.specialization} onChange={(e) => set('specialization', e.target.value)} required placeholder="Cardiology" />
          </Field>
          <Field label="OP Prefix Code *">
            <Input value={form.code} onChange={(e) => set('code', e.target.value)} required placeholder="DR01" />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Qualification">
            <Input value={form.qualification} onChange={(e) => set('qualification', e.target.value)} placeholder="MBBS, MD" />
          </Field>
          <Field label="Room / OPD No.">
            <Input value={form.roomNo} onChange={(e) => set('roomNo', e.target.value)} placeholder="OPD-1" />
          </Field>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Consultation fee (₹) *">
            <Input type="number" min="0" step="0.01" value={form.consultationFee} onChange={(e) => set('consultationFee', e.target.value)} required placeholder="500" />
          </Field>
          <Field label="Follow-up fee (₹) *">
            <Input type="number" min="0" step="0.01" value={form.followUpFee} onChange={(e) => set('followUpFee', e.target.value)} required placeholder="300" />
          </Field>
          <Field label="Follow-up validity (days)">
            <Input type="number" min="1" max="365" value={form.followUpValidityDays} onChange={(e) => set('followUpValidityDays', e.target.value)} required />
          </Field>
        </div>
      </form>
    </Modal>
  );
}

function ConfirmModal({ open, onClose, title, message, confirmLabel, confirmVariant = 'danger', onConfirm }) {
  const [loading, setLoading] = useState(false);

  async function handle() {
    setLoading(true);
    try { await onConfirm(); onClose(true); }
    catch { onClose(false); }
    finally { setLoading(false); }
  }

  return (
    <Modal open={open} onClose={() => onClose(false)} title={title}
      footer={
        <>
          <Button variant="secondary" size="md" onClick={() => onClose(false)}>Cancel</Button>
          <Button variant={confirmVariant} size="md" onClick={handle} disabled={loading}>
            {loading ? 'Please wait…' : confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-sm text-slate-600">{message}</p>
    </Modal>
  );
}

export default function Doctors() {
  const { user: me } = useAuth();
  const isAdmin = me?.role === 'ADMIN';

  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [q, setQ] = useState('');
  const [isActive, setIsActive] = useState('');
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState({ kind: null, doctor: null });

  async function load() {
    setLoading(true);
    setErr('');
    try {
      const params = { page, pageSize: PAGE_SIZE };
      if (q.trim()) params.q = q.trim();
      if (isActive !== '') params.isActive = isActive;
      const { data } = await api.get('/doctors', { params });
      setRows(data.data.items);
      setPagination(data.data.pagination);
    } catch (e) {
      setErr(extractError(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [page, isActive]);

  function onSearchSubmit(e) {
    e.preventDefault();
    if (page !== 1) setPage(1);
    else load();
  }

  function closeModal(refreshed) {
    setModal({ kind: null, doctor: null });
    if (refreshed) load();
  }

  return (
    <AppShell>
      <main className="flex-1 px-8 py-8">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Doctors</h1>
            <p className="mt-1 text-sm text-slate-500">Manage doctor profiles, fees, and follow-up settings.</p>
          </div>
          {isAdmin && (
            <Button onClick={() => setModal({ kind: 'form', doctor: null })}>
              <PlusIcon /> New doctor
            </Button>
          )}
        </div>

        <div className="rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
          <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 px-4 py-3">
            <form onSubmit={onSearchSubmit} className="flex flex-1 min-w-[220px] items-center gap-2">
              <Input placeholder="Search name or specialization" value={q} onChange={(e) => setQ(e.target.value)} className="flex-1" />
              <Button type="submit" variant="secondary" size="md">Search</Button>
            </form>
            <Select value={isActive} onChange={(e) => { setIsActive(e.target.value); setPage(1); }} className="w-36">
              <option value="">All statuses</option>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </Select>
            {(q || isActive !== '') && (
              <Button variant="ghost" size="sm" onClick={() => { setQ(''); setIsActive(''); setPage(1); }}>Clear</Button>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr className="text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Specialization</th>
                  <th className="px-4 py-3">Consult Fee</th>
                  <th className="px-4 py-3">Follow-up Fee</th>
                  <th className="px-4 py-3">Room</th>
                  <th className="px-4 py-3">Status</th>
                  {isAdmin && <th className="px-4 py-3 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white text-sm">
                {loading && <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-slate-500">Loading…</td></tr>}
                {!loading && err && <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-red-600">{err}</td></tr>}
                {!loading && !err && rows.length === 0 && <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-slate-500">No doctors found.</td></tr>}
                {!loading && !err && rows.map((d) => (
                  <tr key={d.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{d.name}</div>
                      {d.qualification && <div className="text-xs text-slate-500">{d.qualification}</div>}
                    </td>
                    <td className="px-4 py-3 text-slate-700">{d.specialization}</td>
                    <td className="px-4 py-3 tabular-nums text-slate-700">{fmtCurrency(d.consultationFee)}</td>
                    <td className="px-4 py-3 tabular-nums text-slate-700">{fmtCurrency(d.followUpFee)} <span className="text-xs text-slate-400">/{d.followUpValidityDays}d</span></td>
                    <td className="px-4 py-3 text-slate-500">{d.roomNo || '—'}</td>
                    <td className="px-4 py-3"><ActiveBadge active={d.isActive} /></td>
                    {isAdmin && (
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Button size="sm" variant="ghost" onClick={() => setModal({ kind: 'form', doctor: d })}>Edit</Button>
                          {d.isActive ? (
                            <Button size="sm" variant="ghost" onClick={() => setModal({ kind: 'deactivate', doctor: d })} className="text-red-600 hover:bg-red-50">Deactivate</Button>
                          ) : (
                            <Button size="sm" onClick={() => setModal({ kind: 'activate', doctor: d })} className="bg-emerald-600 text-white hover:bg-emerald-700">Activate</Button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-sm text-slate-600">
            <div>{pagination.total > 0 ? `Page ${pagination.page} of ${pagination.totalPages} — ${pagination.total} doctor${pagination.total === 1 ? '' : 's'}` : '—'}</div>
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" disabled={page <= 1 || loading} onClick={() => setPage((p) => p - 1)}>Previous</Button>
              <Button size="sm" variant="secondary" disabled={page >= pagination.totalPages || loading} onClick={() => setPage((p) => p + 1)}>Next</Button>
            </div>
          </div>
        </div>
      </main>

      <DoctorFormModal open={modal.kind === 'form'} onClose={closeModal} initial={modal.doctor} />
      <ConfirmModal
        open={modal.kind === 'deactivate'}
        onClose={closeModal}
        title="Deactivate doctor"
        message={`Deactivate ${modal.doctor?.name}? They will no longer appear in appointment booking.`}
        confirmLabel="Deactivate"
        onConfirm={() => api.patch(`/doctors/${modal.doctor?.id}/deactivate`)}
      />
      <ConfirmModal
        open={modal.kind === 'activate'}
        onClose={closeModal}
        title="Activate doctor"
        message={`Reactivate ${modal.doctor?.name}?`}
        confirmLabel="Activate"
        confirmVariant="primary"
        onConfirm={() => api.patch(`/doctors/${modal.doctor?.id}/activate`)}
      />
    </AppShell>
  );
}

function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M8 3v10M3 8h10" />
    </svg>
  );
}
