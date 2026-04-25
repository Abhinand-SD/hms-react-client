import { useEffect, useState } from 'react';
import { api, extractError } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { AppShell } from '../../components/AppShell';
import { Button } from '../../components/Button';
import { Input, Select, Field } from '../../components/Input';
import { Modal } from '../../components/Modal';

const PAGE_SIZE = 20;

const WARD_TYPES = ['GENERAL', 'SEMI_PRIVATE', 'PRIVATE', 'ICU'];

const TYPE_TONE = {
  GENERAL: 'bg-blue-50 text-blue-700 ring-blue-200',
  SEMI_PRIVATE: 'bg-teal-50 text-teal-700 ring-teal-200',
  PRIVATE: 'bg-purple-50 text-purple-700 ring-purple-200',
  ICU: 'bg-red-50 text-red-700 ring-red-200',
};

function WardTypeBadge({ wardType }) {
  const label = wardType.replace('_', ' ');
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${TYPE_TONE[wardType] || 'bg-slate-100 text-slate-600 ring-slate-200'}`}>
      {label}
    </span>
  );
}

function ActiveBadge({ active }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${active ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-slate-100 text-slate-600 ring-slate-200'}`}>
      <span className={`mr-1 h-1.5 w-1.5 rounded-full ${active ? 'bg-emerald-500' : 'bg-slate-400'}`} />
      {active ? 'Active' : 'Inactive'}
    </span>
  );
}

function fmtCurrency(val) {
  const n = parseFloat(val);
  return isNaN(n) ? '—' : `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
}

function WardFormModal({ open, onClose, initial }) {
  const isEdit = !!initial;
  const empty = { name: '', wardType: 'GENERAL', bedCount: '', dailyRate: '', nursingCharge: '0' };
  const [form, setForm] = useState(empty);
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(initial
        ? { name: initial.name, wardType: initial.wardType, bedCount: String(initial.bedCount), dailyRate: initial.dailyRate, nursingCharge: initial.nursingCharge }
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
        wardType: form.wardType,
        bedCount: parseInt(form.bedCount, 10),
        dailyRate: parseFloat(form.dailyRate),
        nursingCharge: parseFloat(form.nursingCharge),
      };
      if (isEdit) {
        await api.patch(`/wards/${initial.id}`, payload);
      } else {
        await api.post('/wards', payload);
      }
      onClose(true);
    } catch (e) {
      setErr(extractError(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={() => onClose(false)} title={isEdit ? 'Edit Ward' : 'New Ward'} size="md"
      footer={
        <>
          <Button variant="secondary" size="md" type="button" onClick={() => onClose(false)}>Cancel</Button>
          <Button size="md" type="submit" form="ward-form" disabled={saving}>
            {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create ward'}
          </Button>
        </>
      }
    >
      <form id="ward-form" onSubmit={submit} className="space-y-3">
        {err && <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-600">{err}</p>}
        <Field label="Ward name *">
          <Input value={form.name} onChange={(e) => set('name', e.target.value)} required placeholder="General Ward A" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Ward type *">
            <Select value={form.wardType} onChange={(e) => set('wardType', e.target.value)}>
              {WARD_TYPES.map((t) => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
            </Select>
          </Field>
          <Field label="Bed count *">
            <Input type="number" min="1" value={form.bedCount} onChange={(e) => set('bedCount', e.target.value)} required placeholder="20" />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Daily rate (₹) *">
            <Input type="number" min="0" step="0.01" value={form.dailyRate} onChange={(e) => set('dailyRate', e.target.value)} required placeholder="1000" />
          </Field>
          <Field label="Nursing charge (₹/day)">
            <Input type="number" min="0" step="0.01" value={form.nursingCharge} onChange={(e) => set('nursingCharge', e.target.value)} placeholder="0" />
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

export default function Wards() {
  const { user: me } = useAuth();
  const isAdmin = me?.role === 'ADMIN';

  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [q, setQ] = useState('');
  const [wardType, setWardType] = useState('');
  const [isActive, setIsActive] = useState('');
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState({ kind: null, ward: null });

  async function load() {
    setLoading(true);
    setErr('');
    try {
      const params = { page, pageSize: PAGE_SIZE };
      if (q.trim()) params.q = q.trim();
      if (wardType) params.wardType = wardType;
      if (isActive !== '') params.isActive = isActive;
      const { data } = await api.get('/wards', { params });
      setRows(data.data.items);
      setPagination(data.data.pagination);
    } catch (e) {
      setErr(extractError(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [page, wardType, isActive]);

  function onSearchSubmit(e) {
    e.preventDefault();
    if (page !== 1) setPage(1);
    else load();
  }

  function closeModal(refreshed) {
    setModal({ kind: null, ward: null });
    if (refreshed) load();
  }

  return (
    <AppShell>
      <main className="flex-1 px-8 py-8">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Ward Master</h1>
            <p className="mt-1 text-sm text-slate-500">Manage ward types, bed counts, and daily rates.</p>
          </div>
          {isAdmin && (
            <Button onClick={() => setModal({ kind: 'form', ward: null })}>
              <PlusIcon /> New ward
            </Button>
          )}
        </div>

        <div className="rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
          <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 px-4 py-3">
            <form onSubmit={onSearchSubmit} className="flex flex-1 min-w-[200px] items-center gap-2">
              <Input placeholder="Search ward name" value={q} onChange={(e) => setQ(e.target.value)} className="flex-1" />
              <Button type="submit" variant="secondary" size="md">Search</Button>
            </form>
            <Select value={wardType} onChange={(e) => { setWardType(e.target.value); setPage(1); }} className="w-40">
              <option value="">All types</option>
              {WARD_TYPES.map((t) => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
            </Select>
            <Select value={isActive} onChange={(e) => { setIsActive(e.target.value); setPage(1); }} className="w-32">
              <option value="">All statuses</option>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </Select>
            {(q || wardType || isActive !== '') && (
              <Button variant="ghost" size="sm" onClick={() => { setQ(''); setWardType(''); setIsActive(''); setPage(1); }}>Clear</Button>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr className="text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3">Ward Name</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Beds</th>
                  <th className="px-4 py-3">Daily Rate</th>
                  <th className="px-4 py-3">Nursing Charge</th>
                  <th className="px-4 py-3">Status</th>
                  {isAdmin && <th className="px-4 py-3 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white text-sm">
                {loading && <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-500">Loading…</td></tr>}
                {!loading && err && <tr><td colSpan={7} className="px-4 py-10 text-center text-red-600">{err}</td></tr>}
                {!loading && !err && rows.length === 0 && <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-500">No wards found.</td></tr>}
                {!loading && !err && rows.map((w) => (
                  <tr key={w.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900">{w.name}</td>
                    <td className="px-4 py-3"><WardTypeBadge wardType={w.wardType} /></td>
                    <td className="px-4 py-3 tabular-nums text-slate-700">{w.bedCount}</td>
                    <td className="px-4 py-3 tabular-nums text-slate-700">{fmtCurrency(w.dailyRate)}</td>
                    <td className="px-4 py-3 tabular-nums text-slate-600">{fmtCurrency(w.nursingCharge)}</td>
                    <td className="px-4 py-3"><ActiveBadge active={w.isActive} /></td>
                    {isAdmin && (
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Button size="sm" variant="ghost" onClick={() => setModal({ kind: 'form', ward: w })}>Edit</Button>
                          {w.isActive ? (
                            <Button size="sm" variant="ghost" onClick={() => setModal({ kind: 'deactivate', ward: w })} className="text-red-600 hover:bg-red-50">Deactivate</Button>
                          ) : (
                            <Button size="sm" onClick={() => setModal({ kind: 'activate', ward: w })} className="bg-emerald-600 text-white hover:bg-emerald-700">Activate</Button>
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
            <div>{pagination.total > 0 ? `Page ${pagination.page} of ${pagination.totalPages} — ${pagination.total} ward${pagination.total === 1 ? '' : 's'}` : '—'}</div>
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" disabled={page <= 1 || loading} onClick={() => setPage((p) => p - 1)}>Previous</Button>
              <Button size="sm" variant="secondary" disabled={page >= pagination.totalPages || loading} onClick={() => setPage((p) => p + 1)}>Next</Button>
            </div>
          </div>
        </div>
      </main>

      <WardFormModal open={modal.kind === 'form'} onClose={closeModal} initial={modal.ward} />
      <ConfirmModal
        open={modal.kind === 'deactivate'}
        onClose={closeModal}
        title="Deactivate ward"
        message={`Deactivate "${modal.ward?.name}"?`}
        confirmLabel="Deactivate"
        onConfirm={() => api.patch(`/wards/${modal.ward?.id}/deactivate`)}
      />
      <ConfirmModal
        open={modal.kind === 'activate'}
        onClose={closeModal}
        title="Activate ward"
        message={`Reactivate "${modal.ward?.name}"?`}
        confirmLabel="Activate"
        confirmVariant="primary"
        onConfirm={() => api.patch(`/wards/${modal.ward?.id}/activate`)}
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
