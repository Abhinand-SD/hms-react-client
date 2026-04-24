import { useEffect, useState } from 'react';
import { api, extractError } from '../lib/api';
import { Modal } from './Modal';
import { Button } from './Button';
import { Field, Input } from './Input';

export function DeactivateUserModal({ open, user, onClose }) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (open) {
      setReason('');
      setErr('');
    }
  }, [open]);

  async function onSubmit(e) {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    setErr('');
    try {
      const body = reason.trim() ? { reason: reason.trim() } : {};
      await api.patch(`/users/${user.id}/deactivate`, body);
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
      title="Deactivate user"
      footer={
        <>
          <Button variant="secondary" size="md" onClick={() => onClose(false)} disabled={busy}>
            Cancel
          </Button>
          <Button variant="danger" size="md" form="deactivate-form" type="submit" disabled={busy}>
            {busy ? 'Deactivating…' : 'Deactivate user'}
          </Button>
        </>
      }
    >
      <form id="deactivate-form" onSubmit={onSubmit} className="space-y-4">
        <div className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700 ring-1 ring-red-200">
          <div className="font-medium">
            This will sign {user?.fullName} out and prevent future logins.
          </div>
          <div className="mt-1">All active refresh tokens for this account will be revoked.</div>
        </div>
        <Field label="Reason (optional)">
          <Input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. End of employment"
            maxLength={256}
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
