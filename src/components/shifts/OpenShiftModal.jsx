import { useState } from 'react';
import { Modal } from '../Modal';
import { Button } from '../Button';
import { Field, Input } from '../Input';
import { extractError } from '../../lib/api';
import { useShift } from '../../lib/shift';

export function OpenShiftModal({ open, onClose, onOpened, dismissible = true }) {
  const { open: openShift } = useShift();
  const [openingBalance, setOpeningBalance] = useState('0');
  const [notes, setNotes]   = useState('');
  const [busy, setBusy]     = useState(false);
  const [err, setErr]       = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setErr('');
    setBusy(true);
    try {
      const shift = await openShift(Number(openingBalance), notes || null);
      onOpened?.(shift);
      onClose?.();
    } catch (e) {
      setErr(extractError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={dismissible ? onClose : undefined}
      title="Open Shift"
      size="sm"
      footer={
        <>
          {dismissible && (
            <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
          )}
          <Button type="submit" form="open-shift-form" disabled={busy}>
            {busy ? 'Opening…' : 'Open Shift'}
          </Button>
        </>
      }
    >
      <form id="open-shift-form" onSubmit={handleSubmit} className="space-y-3">
        <p className="text-xs text-slate-500">
          Enter the cash you currently have in the till. All cash collected during this shift
          will be reconciled against this opening balance when you close the shift.
        </p>
        <Field label="Opening cash balance (₹)">
          <Input
            type="number"
            min="0"
            step="0.01"
            value={openingBalance}
            onChange={(e) => setOpeningBalance(e.target.value)}
            required
            autoFocus
          />
        </Field>
        <Field label="Notes (optional)">
          <Input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. petty cash carry-forward"
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
