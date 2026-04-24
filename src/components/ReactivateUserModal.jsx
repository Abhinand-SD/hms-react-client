import { useEffect, useState } from 'react';
import { api, extractError } from '../lib/api';
import { Modal } from './Modal';
import { Button } from './Button';

export function ReactivateUserModal({ open, user, onClose }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (open) setErr('');
  }, [open]);

  async function onConfirm() {
    if (!user) return;
    setBusy(true);
    setErr('');
    try {
      await api.patch(`/users/${user.id}/reactivate`);
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
      title="Reactivate user"
      footer={
        <>
          <Button variant="secondary" size="md" onClick={() => onClose(false)} disabled={busy}>
            Cancel
          </Button>
          <Button
            size="md"
            onClick={onConfirm}
            disabled={busy}
            className="bg-emerald-600 text-white hover:bg-emerald-700 disabled:bg-emerald-300"
          >
            {busy ? 'Reactivating…' : 'Reactivate user'}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="rounded-md bg-emerald-50 px-3 py-2 text-xs text-emerald-800 ring-1 ring-emerald-200">
          <div className="font-medium">
            {user?.fullName} will be able to sign in again.
          </div>
          <div className="mt-1">
            Status returns to ACTIVE. Failed-attempt counters and any lockout are cleared.
          </div>
        </div>
        {err && (
          <div className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700 ring-1 ring-red-200">
            {err}
          </div>
        )}
      </div>
    </Modal>
  );
}
