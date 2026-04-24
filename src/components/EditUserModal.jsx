import { useEffect, useState } from 'react';
import { api, extractError } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Modal } from './Modal';
import { Button } from './Button';
import { Field, Input, Select } from './Input';

export function EditUserModal({ open, user, onClose }) {
  const { user: me } = useAuth();
  const [form, setForm] = useState({ fullName: '', email: '', mobile: '', role: 'RECEPTIONIST' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (open && user) {
      setForm({
        fullName: user.fullName ?? '',
        email: user.email ?? '',
        mobile: user.mobile ?? '',
        role: user.role,
      });
      setErr('');
    }
  }, [open, user]);

  function set(k, v) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function onSubmit(e) {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    setErr('');
    try {
      const diff = {};
      if (form.fullName !== (user.fullName ?? '')) diff.fullName = form.fullName;
      if (form.email !== (user.email ?? '')) diff.email = form.email || undefined;
      if (form.mobile !== (user.mobile ?? '')) diff.mobile = form.mobile || undefined;
      if (form.role !== user.role) diff.role = form.role;
      if (Object.keys(diff).length === 0) {
        onClose(false);
        return;
      }
      await api.patch(`/users/${user.id}`, diff);
      onClose(true);
    } catch (e) {
      setErr(extractError(e));
    } finally {
      setBusy(false);
    }
  }

  const selfEdit = user?.id === me?.id;

  return (
    <Modal
      open={open}
      onClose={() => !busy && onClose(false)}
      title={user ? `Edit ${user.fullName}` : 'Edit user'}
      size="lg"
      footer={
        <>
          <Button variant="secondary" size="md" onClick={() => onClose(false)} disabled={busy}>
            Cancel
          </Button>
          <Button size="md" form="edit-user-form" type="submit" disabled={busy}>
            {busy ? 'Saving…' : 'Save changes'}
          </Button>
        </>
      }
    >
      <form id="edit-user-form" onSubmit={onSubmit} className="grid grid-cols-2 gap-4">
        <Field label="Full name">
          <Input value={form.fullName} onChange={(e) => set('fullName', e.target.value)} required />
        </Field>
        <Field label="Role" hint={selfEdit ? 'Cannot change your own role.' : undefined}>
          <Select
            value={form.role}
            onChange={(e) => set('role', e.target.value)}
            disabled={selfEdit}
          >
            <option value="RECEPTIONIST">Receptionist</option>
            <option value="DOCTOR">Doctor</option>
            <option value="ADMIN">Admin</option>
          </Select>
        </Field>
        <Field label="Email">
          <Input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} />
        </Field>
        <Field label="Mobile">
          <Input value={form.mobile} onChange={(e) => set('mobile', e.target.value)} />
        </Field>
        <div className="col-span-2 rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-500 ring-1 ring-slate-200">
          Username <span className="font-mono text-slate-700">@{user?.username}</span> and employee ID <span className="font-mono text-slate-700">{user?.employeeId}</span> cannot be changed.
        </div>
        {err && (
          <div className="col-span-2 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700 ring-1 ring-red-200">
            {err}
          </div>
        )}
      </form>
    </Modal>
  );
}
