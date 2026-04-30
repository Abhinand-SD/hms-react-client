import { useEffect, useState } from 'react';
import { Modal } from '../Modal';
import { Button } from '../Button';
import { Field, Input } from '../Input';
import { extractError } from '../../lib/api';
import { useShift } from '../../lib/shift';

function fmtINR(n) {
  return `₹${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function CloseShiftModal({ open, onClose, onClosed }) {
  const { shift, systemExpectedCash, cashCollected, refresh, close: closeShift } = useShift();
  const [declared, setDeclared] = useState('');
  const [notes, setNotes]       = useState('');
  const [busy, setBusy]         = useState(false);
  const [err, setErr]           = useState('');

  useEffect(() => {
    if (open) {
      // Re-fetch the snapshot so the cashier sees the most up-to-date
      // expected number when the modal opens.
      refresh();
      setDeclared('');
      setNotes('');
      setErr('');
    }
  }, [open, refresh]);

  const declaredNum   = declared === '' ? null : Number(declared);
  const variance      = declaredNum == null ? null : declaredNum - Number(systemExpectedCash);
  const varianceLabel =
    variance == null ? '—'
    : variance === 0   ? 'Tally'
    : variance > 0     ? `Overage of ${fmtINR(variance)}`
    : `Shortage of ${fmtINR(Math.abs(variance))}`;
  const varianceCls =
    variance == null ? 'text-slate-500'
    : variance === 0   ? 'text-emerald-700'
    : variance > 0     ? 'text-blue-700'
    : 'text-red-700';

  async function handleSubmit(e) {
    e.preventDefault();
    if (declared === '') {
      setErr('Enter the actual cash counted.');
      return;
    }
    setErr('');
    setBusy(true);
    try {
      const result = await closeShift(Number(declared), notes || null);
      onClosed?.(result);
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
      onClose={onClose}
      title="Close Shift"
      size="md"
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" form="close-shift-form" variant="danger" disabled={busy}>
            {busy ? 'Closing…' : 'Close & Lock Shift'}
          </Button>
        </>
      }
    >
      <form id="close-shift-form" onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3 rounded-lg bg-slate-50 p-3 ring-1 ring-slate-200">
          <Stat label="Opening balance"      value={fmtINR(shift?.openingBalance ?? 0)} />
          <Stat label="Cash collected"       value={fmtINR(cashCollected)} />
          <Stat label="System expected cash" value={fmtINR(systemExpectedCash)} bold />
          <Stat label="Variance"             value={varianceLabel} className={varianceCls} bold />
        </div>

        <Field label="Declared actual cash counted (₹)">
          <Input
            type="number"
            min="0"
            step="0.01"
            value={declared}
            onChange={(e) => setDeclared(e.target.value)}
            required
            autoFocus
            placeholder="Count the till and enter the total"
          />
        </Field>
        <Field label="Notes (optional)" hint="Any explanation for shortages or overages">
          <Input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. ₹50 paid out for stationery"
          />
        </Field>

        <p className="text-[11px] text-slate-500">
          Once closed, you will be locked out of billing until you open a new shift.
        </p>

        {err && (
          <div className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700 ring-1 ring-red-200">
            {err}
          </div>
        )}
      </form>
    </Modal>
  );
}

function Stat({ label, value, bold = false, className = '' }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`text-sm ${bold ? 'font-semibold' : 'font-medium'} text-slate-800 ${className}`}>
        {value}
      </div>
    </div>
  );
}
