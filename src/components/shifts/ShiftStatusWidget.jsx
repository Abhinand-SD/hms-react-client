import { useState } from 'react';
import { useShift } from '../../lib/shift';
import { OpenShiftModal } from './OpenShiftModal';
import { CloseShiftModal } from './CloseShiftModal';

function fmtINR(n) {
  return `₹${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('en-IN', {
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
}

export function ShiftStatusWidget() {
  const { isCashHandler, shift, isOpen, systemExpectedCash, loading } = useShift();
  const [openModal, setOpenModal]   = useState(false);
  const [closeModal, setCloseModal] = useState(false);

  if (!isCashHandler) return null;

  return (
    <div className="border-t border-slate-100 px-3 py-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
          Shift
        </span>
        <span
          className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
            isOpen
              ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
              : 'bg-slate-100 text-slate-500 ring-1 ring-slate-200'
          }`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${isOpen ? 'bg-emerald-500' : 'bg-slate-400'}`} />
          {loading ? '…' : isOpen ? 'OPEN' : 'CLOSED'}
        </span>
      </div>

      {isOpen ? (
        <>
          <div className="mb-2 space-y-0.5 px-1 text-[11px] text-slate-600">
            <div>Since {fmtTime(shift.openedAt)}</div>
            <div className="font-medium text-slate-800">{fmtINR(systemExpectedCash)} expected</div>
          </div>
          <button
            type="button"
            onClick={() => setCloseModal(true)}
            className="w-full rounded-md border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100"
          >
            Close Shift
          </button>
        </>
      ) : (
        <>
          <div className="mb-2 px-1 text-[11px] text-slate-500">
            Open a shift to start collecting cash.
          </div>
          <button
            type="button"
            onClick={() => setOpenModal(true)}
            className="w-full rounded-md bg-slate-900 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
          >
            Open Shift
          </button>
        </>
      )}

      <OpenShiftModal  open={openModal}  onClose={() => setOpenModal(false)} />
      <CloseShiftModal open={closeModal} onClose={() => setCloseModal(false)} />
    </div>
  );
}
