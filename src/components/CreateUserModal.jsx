import { useEffect, useState } from 'react';
import { api, extractError } from '../lib/api';
import { Modal } from './Modal';
import { Button } from './Button';
import { Field, Input, Select } from './Input';

const EMPTY = {
  username: '',
  employeeId: '',
  fullName: '',
  role: 'RECEPTIONIST',
  email: '',
  mobile: '',
  pin: '',
};

export function CreateUserModal({ open, onClose }) {
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (open) {
      setForm(EMPTY);
      setErr('');
    }
  }, [open]);

  function set(k, v) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function onSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setErr('');
    try {
      const payload = { ...form };
      if (!payload.email) delete payload.email;
      if (!payload.mobile) delete payload.mobile;
      await api.post('/users', payload);
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
      onClose={() => !busy && onClose(false)}
      title="Create user"
      size="lg"
      footer={
        <>
          <Button variant="secondary" size="md" onClick={() => onClose(false)} disabled={busy}>
            Cancel
          </Button>
          <Button size="md" form="create-user-form" type="submit" disabled={busy}>
            {busy ? 'Creating…' : 'Create user'}
          </Button>
        </>
      }
    >
      <form id="create-user-form" onSubmit={onSubmit} className="grid grid-cols-2 gap-4">
        <Field label="Full name">
          <Input value={form.fullName} onChange={(e) => set('fullName', e.target.value)} required />
        </Field>
        <Field label="Employee ID">
          <Input value={form.employeeId} onChange={(e) => set('employeeId', e.target.value)} required />
        </Field>
        <Field label="Username" hint="3–64 chars · letters, digits, . _ -">
          <Input value={form.username} onChange={(e) => set('username', e.target.value)} required />
        </Field>
        <Field label="Role">
          <Select value={form.role} onChange={(e) => set('role', e.target.value)}>
            <option value="RECEPTIONIST">Receptionist</option>
            <option value="DOCTOR">Doctor</option>
            <option value="ADMIN">Admin</option>
          </Select>
        </Field>
        <Field label="Email (optional)">
          <Input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} />
        </Field>
        <Field label="Mobile (optional)">
          <Input value={form.mobile} onChange={(e) => set('mobile', e.target.value)} />
        </Field>
        <Field label="Initial PIN" hint="4–6 digits · user must change on first login">
          <Input
            type="password"
            inputMode="numeric"
            pattern="\d{4,6}"
            value={form.pin}
            onChange={(e) => set('pin', e.target.value)}
            required
          />
        </Field>
        {err && (
          <div className="col-span-2 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700 ring-1 ring-red-200">
            {err}
          </div>
        )}
      </form>
    </Modal>
  );
}
