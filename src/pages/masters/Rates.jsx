import { useEffect, useState } from 'react';
import { api, extractError } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { AppShell } from '../../components/AppShell';
import { Button } from '../../components/Button';
import { Input, Select, Field } from '../../components/Input';
import { Modal } from '../../components/Modal';

const PAGE_SIZE = 20;

const CATEGORIES = ['CONSULTATION', 'PROCEDURE', 'LAB', 'WARD', 'PHARMACY', 'OTHER'];

const CAT_TONE = {
  CONSULTATION: 'bg-blue-50 text-blue-700 ring-blue-200',
  PROCEDURE: 'bg-purple-50 text-purple-700 ring-purple-200',
  LAB: 'bg-amber-50 text-amber-700 ring-amber-200',
  WARD: 'bg-teal-50 text-teal-700 ring-teal-200',
  PHARMACY: 'bg-pink-50 text-pink-700 ring-pink-200',
  OTHER: 'bg-slate-100 text-slate-600 ring-slate-200',
};

function CategoryBadge({ category }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${CAT_TONE[category] || CAT_TONE.OTHER}`}>
      {category}
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

function RateFormModal({ open, onClose, initial }) {
  const isEdit = !!initial;
  const empty = { serviceCode: '', serviceName: '', category: 'CONSULTATION', rate: '', taxPercent: '0' };
  const [form, setForm] = useState(empty);
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(initial
        ? { serviceCode: initial.serviceCode, serviceName: initial.serviceName, category: initial.category, rate: initial.rate, taxPercent: initial.taxPercent }
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
        serviceName: form.serviceName,
        category: form.category,
        rate: parseFloat(form.rate),
        taxPercent: parseFloat(form.taxPercent),
        ...(isEdit ? {} : { serviceCode: form.serviceCode }),
      };
      if (isEdit) {
        await api.patch(`/rates/${initial.id}`, payload);
      } else {
        await api.post('/rates', payload);
      }
      onClose(true);
    } catch (e) {
      setErr(extractError(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={() => onClose(false)} title={isEdit ? 'Edit Rate' : 'New Rate'} size="md"
      footer={
        <>
          <Button variant="secondary" size="md" type="button" onClick={() => onClose(false)}>Cancel</Button>
          <Button size="md" type="submit" form="rate-form" disabled={saving}>
            {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create rate'}
          </Button>
        </>
      }
    >
      <form id="rate-form" onSubmit={submit} className="space-y-3">
        {err && <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-600">{err}</p>}
        {!isEdit && (
          <Field label="Service code *" hint="Uppercase letters, digits, hyphen, underscore. Cannot be changed later.">
            <Input value={form.serviceCode} onChange={(e) => set('serviceCode', e.target.value.toUpperCase())} required placeholder="CONSULT_GENERAL" />
          </Field>
        )}
        <Field label="Service name *">
          <Input value={form.serviceName} onChange={(e) => set('serviceName', e.target.value)} required placeholder="General Consultation" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Category *">
            <Select value={form.category} onChange={(e) => set('category', e.target.value)}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </Select>
          </Field>
          <Field label="Rate (₹) *">
            <Input type="number" min="0" step="0.01" value={form.rate} onChange={(e) => set('rate', e.target.value)} required placeholder="500" />
          </Field>
        </div>
        <Field label="Tax %" hint="GST percentage, 0 if exempt.">
          <Input type="number" min="0" max="100" step="0.01" value={form.taxPercent} onChange={(e) => set('taxPercent', e.target.value)} />
        </Field>
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

export default function Rates() {
  const { user: me } = useAuth();
  const isAdmin = me?.role === 'ADMIN';

  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('');
  const [isActive, setIsActive] = useState('');
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState({ kind: null, rate: null });

  async function load() {
    setLoading(true);
    setErr('');
    try {
      const params = { page, pageSize: PAGE_SIZE };
      if (q.trim()) params.q = q.trim();
      if (category) params.category = category;
      if (isActive !== '') params.isActive = isActive;
      const { data } = await api.get('/rates', { params });
      setRows(data.data.items);
      setPagination(data.data.pagination);
    } catch (e) {
      setErr(extractError(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [page, category, isActive]);

  function onSearchSubmit(e) {
    e.preventDefault();
    if (page !== 1) setPage(1);
    else load();
  }

  function closeModal(refreshed) {
    setModal({ kind: null, rate: null });
    if (refreshed) load();
  }

  return (
    <AppShell>
      <main className="flex-1 px-8 py-8">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Rate Master</h1>
            <p className="mt-1 text-sm text-slate-500">Service codes, categories, and pricing used in billing.</p>
          </div>
          {isAdmin && (
            <Button onClick={() => setModal({ kind: 'form', rate: null })}>
              <PlusIcon /> New rate
            </Button>
          )}
        </div>

        <div className="rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
          <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 px-4 py-3">
            <form onSubmit={onSearchSubmit} className="flex flex-1 min-w-[200px] items-center gap-2">
              <Input placeholder="Search name or code" value={q} onChange={(e) => setQ(e.target.value)} className="flex-1" />
              <Button type="submit" variant="secondary" size="md">Search</Button>
            </form>
            <Select value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); }} className="w-40">
              <option value="">All categories</option>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </Select>
            <Select value={isActive} onChange={(e) => { setIsActive(e.target.value); setPage(1); }} className="w-32">
              <option value="">All statuses</option>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </Select>
            {(q || category || isActive !== '') && (
              <Button variant="ghost" size="sm" onClick={() => { setQ(''); setCategory(''); setIsActive(''); setPage(1); }}>Clear</Button>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr className="text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3">Code</th>
                  <th className="px-4 py-3">Service Name</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Rate</th>
                  <th className="px-4 py-3">Tax %</th>
                  <th className="px-4 py-3">Status</th>
                  {isAdmin && <th className="px-4 py-3 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white text-sm">
                {loading && <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-500">Loading…</td></tr>}
                {!loading && err && <tr><td colSpan={7} className="px-4 py-10 text-center text-red-600">{err}</td></tr>}
                {!loading && !err && rows.length === 0 && <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-500">No rates found.</td></tr>}
                {!loading && !err && rows.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono text-xs text-slate-700">{r.serviceCode}</td>
                    <td className="px-4 py-3 font-medium text-slate-900">{r.serviceName}</td>
                    <td className="px-4 py-3"><CategoryBadge category={r.category} /></td>
                    <td className="px-4 py-3 tabular-nums text-slate-700">{fmtCurrency(r.rate)}</td>
                    <td className="px-4 py-3 text-slate-600">{parseFloat(r.taxPercent)}%</td>
                    <td className="px-4 py-3"><ActiveBadge active={r.isActive} /></td>
                    {isAdmin && (
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Button size="sm" variant="ghost" onClick={() => setModal({ kind: 'form', rate: r })}>Edit</Button>
                          {r.isActive ? (
                            <Button size="sm" variant="ghost" onClick={() => setModal({ kind: 'deactivate', rate: r })} className="text-red-600 hover:bg-red-50">Deactivate</Button>
                          ) : (
                            <Button size="sm" onClick={() => setModal({ kind: 'activate', rate: r })} className="bg-emerald-600 text-white hover:bg-emerald-700">Activate</Button>
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
            <div>{pagination.total > 0 ? `Page ${pagination.page} of ${pagination.totalPages} — ${pagination.total} rate${pagination.total === 1 ? '' : 's'}` : '—'}</div>
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" disabled={page <= 1 || loading} onClick={() => setPage((p) => p - 1)}>Previous</Button>
              <Button size="sm" variant="secondary" disabled={page >= pagination.totalPages || loading} onClick={() => setPage((p) => p + 1)}>Next</Button>
            </div>
          </div>
        </div>
      </main>

      <RateFormModal open={modal.kind === 'form'} onClose={closeModal} initial={modal.rate} />
      <ConfirmModal
        open={modal.kind === 'deactivate'}
        onClose={closeModal}
        title="Deactivate rate"
        message={`Deactivate "${modal.rate?.serviceName}"? It will no longer appear in new bills.`}
        confirmLabel="Deactivate"
        onConfirm={() => api.patch(`/rates/${modal.rate?.id}/deactivate`)}
      />
      <ConfirmModal
        open={modal.kind === 'activate'}
        onClose={closeModal}
        title="Activate rate"
        message={`Reactivate "${modal.rate?.serviceName}"?`}
        confirmLabel="Activate"
        confirmVariant="primary"
        onConfirm={() => api.patch(`/rates/${modal.rate?.id}/activate`)}
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
