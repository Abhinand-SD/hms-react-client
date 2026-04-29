import { useEffect, useState } from 'react';
import { extractError } from '../../lib/api';
import { AppShell } from '../../components/AppShell';
import { Button } from '../../components/Button';
import { Input, Field } from '../../components/Input';
import { Modal } from '../../components/Modal';
import {
  listServices,
  createService,
  updateService,
  deactivateService,
  activateService,
} from '../../api/services.api';

function fmtCurrency(val) {
  const n = parseFloat(val);
  return isNaN(n) ? '—' : `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
}

function ActiveBadge({ active }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset
        ${active ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-slate-100 text-slate-500 ring-slate-200'}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${active ? 'bg-emerald-500' : 'bg-slate-400'}`} />
      {active ? 'Active' : 'Inactive'}
    </span>
  );
}

function ServiceFormModal({ open, onClose, initial }) {
  const isEdit  = !!initial;
  const EMPTY   = { serviceName: '', price: '' };
  const [form, setForm] = useState(EMPTY);
  const [err,  setErr]  = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(initial ? { serviceName: initial.serviceName, price: String(initial.price) } : EMPTY);
      setErr('');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial]);

  function set(k, v) { setForm((f) => ({ ...f, [k]: v })); }

  async function submit(e) {
    e.preventDefault();
    const price = parseFloat(form.price);
    if (isNaN(price) || price < 0) { setErr('Price must be a non-negative number.'); return; }

    setBusy(true);
    setErr('');
    try {
      const payload = { serviceName: form.serviceName.trim(), price };
      if (isEdit) {
        await updateService(initial.id, payload);
      } else {
        await createService(payload);
      }
      onClose(true);
    } catch (e) {
      setErr(extractError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => onClose(false)}
      title={isEdit ? 'Edit Service' : 'New Service'}
      size="sm"
      footer={
        <>
          <Button variant="secondary" size="md" type="button" onClick={() => onClose(false)}>Cancel</Button>
          <Button size="md" type="submit" form="svc-form" disabled={busy}>
            {busy ? 'Saving…' : isEdit ? 'Save changes' : 'Create service'}
          </Button>
        </>
      }
    >
      <form id="svc-form" onSubmit={submit} className="space-y-3">
        {err && <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-600">{err}</p>}
        <Field label="Service name *">
          <Input
            value={form.serviceName}
            onChange={(e) => set('serviceName', e.target.value)}
            required
            placeholder="e.g. ECG"
          />
        </Field>
        <Field label="Price (₹) *">
          <Input
            type="number"
            min="0"
            step="0.01"
            value={form.price}
            onChange={(e) => set('price', e.target.value)}
            required
            placeholder="500"
          />
        </Field>
      </form>
    </Modal>
  );
}

function ConfirmModal({ open, onClose, title, message, confirmLabel, onConfirm }) {
  const [busy, setBusy] = useState(false);
  async function handle() {
    setBusy(true);
    try { await onConfirm(); onClose(true); }
    catch { onClose(false); }
    finally { setBusy(false); }
  }
  return (
    <Modal
      open={open}
      onClose={() => onClose(false)}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="secondary" size="md" onClick={() => onClose(false)}>Cancel</Button>
          <Button variant="danger" size="md" onClick={handle} disabled={busy}>
            {busy ? 'Please wait…' : confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-sm text-slate-600">{message}</p>
    </Modal>
  );
}

export default function Services() {
  const [rows,    setRows]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [err,     setErr]     = useState('');
  const [filter,  setFilter]  = useState('');
  const [modal,   setModal]   = useState({ kind: null, svc: null });

  async function load() {
    setLoading(true);
    setErr('');
    try {
      const { data } = await listServices();
      setRows(data.data.services);
    } catch (e) {
      setErr(extractError(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function closeModal(refreshed) {
    setModal({ kind: null, svc: null });
    if (refreshed) load();
  }

  const visible = filter
    ? rows.filter((r) => r.serviceName.toLowerCase().includes(filter.toLowerCase()))
    : rows;

  return (
    <AppShell>
      <main className="flex-1 px-8 py-8">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Manage Services</h1>
            <p className="mt-1 text-sm text-slate-500">
              Cardiac test catalogue used for billing (ECG, ECHO, TMT, etc.).
            </p>
          </div>
          <Button onClick={() => setModal({ kind: 'form', svc: null })}>
            <PlusIcon /> New service
          </Button>
        </div>

        <div className="rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
          {/* Toolbar */}
          <div className="flex items-center gap-3 border-b border-slate-200 px-4 py-3">
            <Input
              placeholder="Filter by name…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="max-w-xs"
            />
            {filter && (
              <Button variant="ghost" size="sm" onClick={() => setFilter('')}>Clear</Button>
            )}
            <span className="ml-auto text-xs text-slate-400">
              {visible.length} service{visible.length !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr className="text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3">Service Name</th>
                  <th className="px-4 py-3">Price</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white text-sm">
                {loading && (
                  <tr><td colSpan={4} className="px-4 py-10 text-center text-slate-400">Loading…</td></tr>
                )}
                {!loading && err && (
                  <tr><td colSpan={4} className="px-4 py-10 text-center text-red-600">{err}</td></tr>
                )}
                {!loading && !err && visible.length === 0 && (
                  <tr><td colSpan={4} className="px-4 py-10 text-center text-slate-400">No services found.</td></tr>
                )}
                {!loading && !err && visible.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-semibold text-slate-900">{r.serviceName}</td>
                    <td className="px-4 py-3 tabular-nums text-slate-700">{fmtCurrency(r.price)}</td>
                    <td className="px-4 py-3"><ActiveBadge active={r.isActive} /></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Button size="sm" variant="ghost" onClick={() => setModal({ kind: 'form', svc: r })}>
                          Edit
                        </Button>
                        {r.isActive ? (
                          <Button
                            size="sm" variant="ghost"
                            className="text-red-600 hover:bg-red-50"
                            onClick={() => setModal({ kind: 'deactivate', svc: r })}
                          >
                            Deactivate
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            className="bg-emerald-600 text-white hover:bg-emerald-700"
                            onClick={() => setModal({ kind: 'activate', svc: r })}
                          >
                            Activate
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      <ServiceFormModal
        open={modal.kind === 'form'}
        onClose={closeModal}
        initial={modal.svc}
      />
      <ConfirmModal
        open={modal.kind === 'deactivate'}
        onClose={closeModal}
        title="Deactivate service"
        message={`Deactivate "${modal.svc?.serviceName}"? It will no longer appear in new bills.`}
        confirmLabel="Deactivate"
        onConfirm={() => deactivateService(modal.svc?.id)}
      />
      <ConfirmModal
        open={modal.kind === 'activate'}
        onClose={closeModal}
        title="Activate service"
        message={`Reactivate "${modal.svc?.serviceName}"?`}
        confirmLabel="Activate"
        onConfirm={() => activateService(modal.svc?.id)}
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
