import { useEffect, useState } from 'react';
import { api, extractError } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { AppShell } from '../../components/AppShell';
import { Button } from '../../components/Button';
import { Input, Field } from '../../components/Input';
import { Modal } from '../../components/Modal';

const PAGE_SIZE = 50;

function ActiveBadge({ active }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${active ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-slate-100 text-slate-600 ring-slate-200'}`}>
      <span className={`mr-1 h-1.5 w-1.5 rounded-full ${active ? 'bg-emerald-500' : 'bg-slate-400'}`} />
      {active ? 'Active' : 'Inactive'}
    </span>
  );
}

function PaymentModeFormModal({ open, onClose, initial }) {
  const isEdit = !!initial;
  const empty = { code: '', name: '', sortOrder: '0' };
  const [form, setForm] = useState(empty);
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(initial
        ? { code: initial.code, name: initial.name, sortOrder: String(initial.sortOrder) }
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
        sortOrder: parseInt(form.sortOrder, 10),
        ...(isEdit ? {} : { code: form.code }),
      };
      if (isEdit) {
        await api.patch(`/payment-modes/${initial.id}`, payload);
      } else {
        await api.post('/payment-modes', payload);
      }
      onClose(true);
    } catch (e) {
      setErr(extractError(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={() => onClose(false)} title={isEdit ? 'Edit Payment Mode' : 'New Payment Mode'} size="sm"
      footer={
        <>
          <Button variant="secondary" size="md" type="button" onClick={() => onClose(false)}>Cancel</Button>
          <Button size="md" type="submit" form="pm-form" disabled={saving}>
            {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create'}
          </Button>
        </>
      }
    >
      <form id="pm-form" onSubmit={submit} className="space-y-3">
        {err && <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-600">{err}</p>}
        {!isEdit && (
          <Field label="Code *" hint="Uppercase letters, digits, underscore. E.g. CASH, UPI, CARD.">
            <Input value={form.code} onChange={(e) => set('code', e.target.value.toUpperCase())} required placeholder="CASH" />
          </Field>
        )}
        <Field label="Display name *">
          <Input value={form.name} onChange={(e) => set('name', e.target.value)} required placeholder="Cash" />
        </Field>
        <Field label="Sort order" hint="Lower = appears first in lists.">
          <Input type="number" min="0" value={form.sortOrder} onChange={(e) => set('sortOrder', e.target.value)} />
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

export default function PaymentModes() {
  const { user: me } = useAuth();
  const isAdmin = me?.role === 'ADMIN';

  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [isActive, setIsActive] = useState('');
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState({ kind: null, pm: null });

  async function load() {
    setLoading(true);
    setErr('');
    try {
      const params = { page, pageSize: PAGE_SIZE };
      if (isActive !== '') params.isActive = isActive;
      const { data } = await api.get('/payment-modes', { params });
      setRows(data.data.items);
      setPagination(data.data.pagination);
    } catch (e) {
      setErr(extractError(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [page, isActive]);

  function closeModal(refreshed) {
    setModal({ kind: null, pm: null });
    if (refreshed) load();
  }

  return (
    <AppShell>
      <main className="flex-1 px-8 py-8">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Payment Modes</h1>
            <p className="mt-1 text-sm text-slate-500">Configure accepted payment methods (cash, card, UPI, etc.).</p>
          </div>
          {isAdmin && (
            <Button onClick={() => setModal({ kind: 'form', pm: null })}>
              <PlusIcon /> New mode
            </Button>
          )}
        </div>

        <div className="max-w-2xl rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
          <div className="flex items-center gap-3 border-b border-slate-200 px-4 py-3">
            <select
              value={isActive}
              onChange={(e) => { setIsActive(e.target.value); setPage(1); }}
              className="block rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
            >
              <option value="">All statuses</option>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
            {isActive !== '' && (
              <Button variant="ghost" size="sm" onClick={() => { setIsActive(''); setPage(1); }}>Clear</Button>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr className="text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3">Code</th>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Order</th>
                  <th className="px-4 py-3">Status</th>
                  {isAdmin && <th className="px-4 py-3 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white text-sm">
                {loading && <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-500">Loading…</td></tr>}
                {!loading && err && <tr><td colSpan={5} className="px-4 py-10 text-center text-red-600">{err}</td></tr>}
                {!loading && !err && rows.length === 0 && <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-500">No payment modes yet.</td></tr>}
                {!loading && !err && rows.map((pm) => (
                  <tr key={pm.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono text-xs text-slate-700">{pm.code}</td>
                    <td className="px-4 py-3 font-medium text-slate-900">{pm.name}</td>
                    <td className="px-4 py-3 tabular-nums text-slate-500">{pm.sortOrder}</td>
                    <td className="px-4 py-3"><ActiveBadge active={pm.isActive} /></td>
                    {isAdmin && (
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Button size="sm" variant="ghost" onClick={() => setModal({ kind: 'form', pm })}>Edit</Button>
                          {pm.isActive ? (
                            <Button size="sm" variant="ghost" onClick={() => setModal({ kind: 'deactivate', pm })} className="text-red-600 hover:bg-red-50">Deactivate</Button>
                          ) : (
                            <Button size="sm" onClick={() => setModal({ kind: 'activate', pm })} className="bg-emerald-600 text-white hover:bg-emerald-700">Activate</Button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {pagination.total > PAGE_SIZE && (
            <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-sm text-slate-600">
              <div>Page {pagination.page} of {pagination.totalPages}</div>
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" disabled={page <= 1 || loading} onClick={() => setPage((p) => p - 1)}>Previous</Button>
                <Button size="sm" variant="secondary" disabled={page >= pagination.totalPages || loading} onClick={() => setPage((p) => p + 1)}>Next</Button>
              </div>
            </div>
          )}
        </div>
      </main>

      <PaymentModeFormModal open={modal.kind === 'form'} onClose={closeModal} initial={modal.pm} />
      <ConfirmModal
        open={modal.kind === 'deactivate'}
        onClose={closeModal}
        title="Deactivate payment mode"
        message={`Deactivate "${modal.pm?.name}"? It will no longer appear at billing time.`}
        confirmLabel="Deactivate"
        onConfirm={() => api.patch(`/payment-modes/${modal.pm?.id}/deactivate`)}
      />
      <ConfirmModal
        open={modal.kind === 'activate'}
        onClose={closeModal}
        title="Activate payment mode"
        message={`Reactivate "${modal.pm?.name}"?`}
        confirmLabel="Activate"
        confirmVariant="primary"
        onConfirm={() => api.patch(`/payment-modes/${modal.pm?.id}/activate`)}
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
