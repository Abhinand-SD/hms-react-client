import { useEffect, useState } from 'react';
import { api, extractError } from '../lib/api';
import { Modal } from './Modal';
import { Button } from './Button';
import { Field, Input } from './Input';

export function ResetPinModal({ open, user, onClose }) {
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (open) {
      setPin('');
      setErr('');
    }
  }, [open]);

  async function onSubmit(e) {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    setErr('');
    try {
      await api.patch(`/users/${user.id}/reset-pin`, { pin });
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
      title={user ? `Reset PIN for ${user.fullName}` : 'Reset PIN'}
      footer={
        <>
          <Button variant="secondary" size="md" onClick={() => onClose(false)} disabled={busy}>
            Cancel
          </Button>
          <Button size="md" form="reset-pin-form" type="submit" disabled={busy}>
            {busy ? 'Resetting…' : 'Reset PIN'}
          </Button>
        </>
      }
    >
      <form id="reset-pin-form" onSubmit={onSubmit} className="space-y-4">
        <div className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800 ring-1 ring-amber-200">
          The user will be required to change this PIN on next login. All active sessions for this user will be revoked.
        </div>
        <Field label="New PIN" hint="4–6 digits">
          <Input
            type="password"
            inputMode="numeric"
            pattern="\d{4,6}"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            required
            autoFocus
          />
        </Field>
        {err && (
          <div className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700 ring-1 ring-red-200">
            {err}
          </div>
        )}
      </form>
    </Modal>
  );
}
