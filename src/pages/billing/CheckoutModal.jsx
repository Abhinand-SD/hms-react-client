import { useEffect, useRef, useState } from 'react';
import { api, extractError } from '../../lib/api';
import { Modal } from '../../components/Modal';
import { Button } from '../../components/Button';
import { InvoicePrintView } from '../../components/InvoicePrintView';
import { listServices } from '../../api/services.api';
import { checkoutVisit, getInvoiceById } from '../../api/billing.api';

// ─── Constants ────────────────────────────────────────────────────────────────

const INP = 'block w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:bg-slate-50 disabled:text-slate-400';

const STAGE = {
  LOADING:     'loading',
  SELECT:      'select',
  STAGING:     'staging',
  READY:       'ready',
  POS_WAITING: 'pos_waiting',
  SUCCESS:     'success',
  ERROR:       'error',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtCurrency(amount) {
  return `₹${Number(amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

function calcRemaining(invoice) {
  if (!invoice) return 0;
  const paid = invoice.payments.reduce((s, p) => s + Number(p.amountPaid), 0);
  return Math.max(0, Number(invoice.netAmount) - paid);
}

function pickModes(modeList) {
  const cashMode =
    modeList.find((m) => m.code === 'CASH') ??
    modeList.find((m) => /cash/i.test(m.code) || /cash/i.test(m.name)) ??
    modeList[0];

  const posMode =
    modeList.find(
      (m) =>
        m.id !== cashMode?.id &&
        (/card|upi|online|pos|digital|net.?bank/i.test(m.code) ||
          /card|upi|online|pos|digital|net.?bank/i.test(m.name)),
    ) ??
    modeList.find((m) => m.id !== cashMode?.id) ??
    modeList[0];

  return { cashMode, posMode };
}

// ─── Service selection stage ──────────────────────────────────────────────────

function SelectServicesStage({ visit, services, selected, onToggle, onProceed, busy }) {
  const consultFee = Number(
    visit?.appointment?.consultationFee ?? visit?.doctor?.consultationFee ?? 0,
  );
  const selectedServices = services.filter((s) => selected.has(s.id));
  const testTotal    = selectedServices.reduce((sum, s) => sum + Number(s.price), 0);
  const grandTotal   = consultFee + testTotal;

  return (
    <div className="space-y-4">
      {/* Patient card */}
      <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
        <p className="text-sm font-bold text-slate-900">
          {visit?.patient?.firstName} {visit?.patient?.lastName ?? ''}
        </p>
        <p className="font-mono text-[11px] text-slate-500">
          {visit?.patient?.uhid} · {visit?.opNumber}
        </p>
        {visit?.doctor?.name && (
          <p className="mt-0.5 text-xs text-slate-600">Dr. {visit.doctor.name}</p>
        )}
      </div>

      {/* Tests selection */}
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
          Select Prescribed Tests
        </p>
        {services.length === 0 ? (
          <p className="text-sm text-slate-400 italic">No active tests configured.</p>
        ) : (
          <div className="space-y-1.5">
            {services.map((svc) => (
              <label
                key={svc.id}
                className={`flex cursor-pointer items-center justify-between rounded-lg border px-3 py-2.5 transition
                  ${selected.has(svc.id)
                    ? 'border-blue-300 bg-blue-50 ring-1 ring-blue-300'
                    : 'border-slate-200 bg-white hover:bg-slate-50'}`}
              >
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={selected.has(svc.id)}
                    onChange={() => onToggle(svc.id)}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-slate-800">{svc.serviceName}</span>
                </div>
                <span className="text-sm font-semibold text-slate-700">{fmtCurrency(svc.price)}</span>
              </label>
            ))}
          </div>
        )}
      </div>

      {/* Live billing summary */}
      <div className="rounded-xl border border-slate-200 bg-white divide-y divide-slate-100">
        <div className="flex justify-between px-4 py-2.5 text-sm">
          <span className="text-slate-500">Consultation Fee</span>
          <span className="font-semibold text-slate-800">{fmtCurrency(consultFee)}</span>
        </div>
        {selectedServices.map((s) => (
          <div key={s.id} className="flex justify-between px-4 py-2.5 text-sm">
            <span className="text-slate-500">{s.serviceName}</span>
            <span className="font-semibold text-slate-800">{fmtCurrency(s.price)}</span>
          </div>
        ))}
        <div className="flex justify-between px-4 py-3">
          <span className="text-sm font-bold text-slate-900">Total</span>
          <span className="text-lg font-bold text-blue-700">{fmtCurrency(grandTotal)}</span>
        </div>
      </div>

      <button
        onClick={onProceed}
        disabled={busy}
        className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {busy ? <SpinnerIcon /> : <ArrowRightIcon />}
        {busy ? 'Creating invoice…' : 'Proceed to Payment'}
      </button>
    </div>
  );
}

// ─── Mode badge ───────────────────────────────────────────────────────────────

function ModeBadge({ name, icon: Icon }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5">
      <span className="text-xs font-semibold text-slate-500">Payment Mode</span>
      <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700">
        <Icon /> {name}
      </span>
    </div>
  );
}

// ─── Payment tabs ─────────────────────────────────────────────────────────────

function CashTab({ modeName, cashAmt, setCashAmt, remaining, busy, onPay }) {
  const valid = Number(cashAmt) > 0 && Number(cashAmt) <= remaining + 0.01;
  return (
    <div className="space-y-3.5">
      <ModeBadge name={modeName} icon={CashIcon} />
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-semibold text-slate-600">Amount</label>
        <div className="relative">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-500">₹</span>
          <input
            type="number" min="0.01" step="0.01"
            value={cashAmt}
            onChange={(e) => setCashAmt(e.target.value)}
            className={`${INP} pl-8`}
          />
        </div>
      </div>
      <button
        onClick={onPay}
        disabled={!valid || busy}
        className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {busy ? <SpinnerIcon /> : <CheckCircleIcon />}
        {busy ? 'Recording…' : 'Record Payment & Generate Bill'}
      </button>
    </div>
  );
}

function PosTab({ modeName, remaining, busy, onSend }) {
  return (
    <div className="space-y-3.5">
      <ModeBadge name={modeName} icon={CardIcon} />
      <div className="rounded-xl bg-blue-50 border border-blue-100 px-4 py-3 flex items-center justify-between">
        <span className="text-sm text-blue-700 font-medium">Amount to charge</span>
        <span className="text-xl font-bold text-blue-900">{fmtCurrency(remaining)}</span>
      </div>
      <div className="rounded-lg bg-amber-50 border border-amber-100 px-3 py-2.5 text-xs text-amber-700">
        <span className="font-semibold">Cloud-to-POS:</span> Clicking below pushes the payment
        request to the Pine Labs terminal. The customer taps / swipes on the hardware device.
      </div>
      <button
        onClick={onSend}
        disabled={busy}
        className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {busy ? <SpinnerIcon /> : <TerminalIcon />}
        {busy ? 'Connecting…' : 'Send to POS Terminal'}
      </button>
    </div>
  );
}

function SplitTab({ cashModeName, nonCashModes, splitCashAmt, setSplitCashAmt, splitPosModeId, setSplitPosModeId, remaining, busy, onPay }) {
  const cashNum   = Number(splitCashAmt) || 0;
  const onlineAmt = Math.max(0, remaining - cashNum);
  const valid = splitPosModeId && cashNum > 0 && cashNum < remaining && onlineAmt > 0;

  return (
    <div className="space-y-3.5">
      <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-2.5">
        <div className="flex justify-between text-xs font-semibold text-slate-500">
          <span>Total remaining</span>
          <span className="text-slate-900">{fmtCurrency(remaining)}</span>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 p-3.5 space-y-2.5">
        <p className="text-xs font-bold text-slate-700 uppercase tracking-wide">Cash Portion</p>
        <ModeBadge name={cashModeName} icon={CashIcon} />
        <div className="relative">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-500">₹</span>
          <input
            type="number" min="0.01" step="0.01" placeholder="0.00"
            value={splitCashAmt}
            onChange={(e) => setSplitCashAmt(e.target.value)}
            className={`${INP} pl-8`}
          />
        </div>
      </div>

      <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-3.5 space-y-2.5">
        <p className="text-xs font-bold text-blue-700 uppercase tracking-wide">Online / Card Portion</p>
        <select
          value={splitPosModeId}
          onChange={(e) => setSplitPosModeId(e.target.value)}
          className={INP}
        >
          <option value="">— Select online / card mode —</option>
          {nonCashModes.map((m) => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>
        <div className="flex items-center rounded-lg border border-blue-100 bg-white px-3.5 py-2.5">
          <span className="text-sm font-semibold text-slate-500 mr-1">₹</span>
          <span className="text-sm font-bold text-slate-900">{onlineAmt.toFixed(2)}</span>
          <span className="ml-auto text-[11px] text-slate-400">auto-calculated</span>
        </div>
      </div>

      {cashNum > 0 && onlineAmt === 0 && (
        <p className="text-xs text-red-500 font-medium">Online amount must be greater than zero.</p>
      )}

      <button
        onClick={() => onPay(cashNum, onlineAmt)}
        disabled={!valid || busy}
        className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-700 disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {busy ? <SpinnerIcon /> : <SplitPayIcon />}
        {busy ? 'Processing…' : 'Process Split Payment'}
      </button>
    </div>
  );
}

// ─── POS Waiting screen ───────────────────────────────────────────────────────

function PosWaitingScreen({ ptrn, remaining, modeName }) {
  return (
    <div className="flex flex-col items-center gap-5 py-6 text-center">
      <div className="relative inline-flex">
        <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-slate-800 shadow-xl">
          <PosTerminalLargeIcon />
        </div>
        <span className="absolute -right-1 -top-1 flex h-4 w-4">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
          <span className="relative inline-flex h-4 w-4 rounded-full bg-green-500 border-2 border-white" />
        </span>
      </div>
      <div>
        <p className="text-base font-bold text-slate-900">Waiting for customer to tap card…</p>
        <p className="mt-1 text-sm text-slate-500">Polling terminal — do not close this window</p>
      </div>
      <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm">
        <span className="text-xs font-semibold text-slate-500">Terminal Ref</span>
        <span className="font-mono font-bold text-slate-900 tracking-wider">{ptrn}</span>
      </div>
      <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-slate-200 border-t-blue-600" />
      <p className="text-sm font-bold text-blue-700">{fmtCurrency(remaining)} · {modeName}</p>
    </div>
  );
}

// ─── Success screen ───────────────────────────────────────────────────────────

function SuccessScreen({ data, onClose, onPrint }) {
  return (
    <div className="flex flex-col items-center gap-5 py-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 ring-4 ring-emerald-50">
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
          <path d="M6 16l7 7L26 9" stroke="#059669" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>

      <div>
        <p className="text-lg font-bold text-slate-900">{data.note || 'Payment Successful!'}</p>
        <p className="mt-1 font-mono text-sm font-semibold text-blue-700">{data.invoiceNumber}</p>
      </div>

      <div className="w-full divide-y divide-slate-100 rounded-xl border border-slate-200 text-sm">
        {data.amountPaid != null && (
          <div className="flex justify-between px-4 py-2.5">
            <span className="text-slate-500">Amount Paid</span>
            <span className="font-bold text-slate-900">{fmtCurrency(data.amountPaid)}</span>
          </div>
        )}
        {data.paymentMode && (
          <div className="flex justify-between px-4 py-2.5">
            <span className="text-slate-500">Method</span>
            <span className="font-semibold text-slate-700">{data.paymentMode}</span>
          </div>
        )}
        {data.txRef && (
          <div className="flex justify-between px-4 py-2.5">
            <span className="text-slate-500">Reference</span>
            <span className="font-mono text-xs font-semibold text-slate-700 tracking-wider">{data.txRef}</span>
          </div>
        )}
      </div>

      <div className="flex w-full gap-2">
        <button
          onClick={onPrint}
          className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
        >
          <PrintIcon /> Print A5 Receipt
        </button>
        <button
          onClick={onClose}
          className="flex-1 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
        >
          Close
        </button>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function CheckoutModal({ open, onClose, visit }) {
  const [stage, setStage]       = useState(STAGE.LOADING);
  const [invoice, setInvoice]   = useState(null);
  const [services, setServices] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [modes, setModes]       = useState([]);
  const [payTab, setPayTab]     = useState('cash');

  const [cashModeId, setCashModeId] = useState('');
  const [posModeId, setPosModeId]   = useState('');
  const [cashAmt, setCashAmt]       = useState('');
  const [ptrn, setPtrn]             = useState(null);
  const [splitCashAmt, setSplitCashAmt]     = useState('');
  const [splitPosModeId, setSplitPosModeId] = useState('');

  const [busy, setBusy]         = useState(false);
  const [err, setErr]           = useState('');
  const [successData, setSuccessData] = useState(null);
  const [retryKey, setRetryKey] = useState(0);

  const pollIntervalRef = useRef(null);

  // ── Load services and check for existing invoice on open ──────────────────
  useEffect(() => {
    if (!open || !visit) return;

    setStage(STAGE.LOADING);
    setInvoice(null);
    setServices([]);
    setSelected(new Set());
    setModes([]);
    setPayTab('cash');
    setBusy(false);
    setErr('');
    setSuccessData(null);
    setPtrn(null);
    clearInterval(pollIntervalRef.current);

    Promise.all([
      listServices({ isActive: 'true' }),
      api.get('/payment-modes', { params: { limit: 100, isActive: 'true' } }),
    ])
      .then(([{ data: svcData }, { data: pmData }]) => {
        const svcList  = svcData.data.services ?? [];
        const modeList = pmData.data.items ?? [];
        setServices(svcList);
        setModes(modeList);

        if (modeList.length > 0) {
          const { cashMode, posMode } = pickModes(modeList);
          setCashModeId(cashMode.id);
          setPosModeId(posMode.id);
          setSplitPosModeId(posMode.id);
        }

        setStage(STAGE.SELECT);
      })
      .catch((e) => {
        setErr(extractError(e));
        setStage(STAGE.ERROR);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, visit, retryKey]);

  useEffect(() => () => { clearInterval(pollIntervalRef.current); }, []);

  // ── Toggle service selection ──────────────────────────────────────────────
  function toggleService(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  // ── Create invoice with selected services ─────────────────────────────────
  async function proceedToPayment() {
    setBusy(true);
    setErr('');
    try {
      let inv;
      try {
        const { data } = await checkoutVisit(visit.id, [...selected]);
        inv = data.data.invoice;
      } catch (e) {
        if (e.response?.status === 409) {
          const invoiceId = e.response?.data?.error?.details?.invoiceId;
          if (invoiceId) {
            const { data } = await getInvoiceById(invoiceId);
            inv = data.data.invoice;
          } else throw e;
        } else throw e;
      }

      setInvoice(inv);
      const remaining = calcRemaining(inv);
      setCashAmt(remaining.toFixed(2));
      setSplitCashAmt('');

      if (inv.paymentStatus === 'PAID') {
        setSuccessData({
          invoiceNumber: inv.invoiceNumber,
          note: 'This invoice is already fully paid.',
        });
        setStage(STAGE.SUCCESS);
      } else {
        setStage(STAGE.READY);
      }
    } catch (e) {
      setErr(extractError(e));
    } finally {
      setBusy(false);
    }
  }

  // ── Payment handlers ──────────────────────────────────────────────────────

  async function payCash() {
    setBusy(true);
    setErr('');
    try {
      await api.post('/payments', {
        invoiceId:     invoice.id,
        paymentModeId: cashModeId,
        amountPaid:    Number(cashAmt),
        paymentDate:   todayStr(),
      });
      // Refresh invoice to get updated payments for print view
      const { data } = await getInvoiceById(invoice.id);
      setInvoice(data.data.invoice);

      setSuccessData({
        invoiceNumber: invoice.invoiceNumber,
        amountPaid:    Number(cashAmt),
        paymentMode:   modes.find((m) => m.id === cashModeId)?.name ?? 'Cash',
      });
      setStage(STAGE.SUCCESS);
    } catch (e) {
      setErr(extractError(e));
    } finally {
      setBusy(false);
    }
  }

  async function sendToPos() {
    clearInterval(pollIntervalRef.current);
    const remaining = calcRemaining(invoice);
    const modeName  = modes.find((m) => m.id === posModeId)?.name ?? 'Online / Card';

    setBusy(true);
    setErr('');

    let ptrnValue;
    try {
      const { data } = await api.post('/billing/pos/push', {
        invoiceId:     invoice.id,
        amount:        remaining,
        paymentModeId: posModeId,
      });
      ptrnValue = data.PlutusTransactionReferenceID;
      setPtrn(ptrnValue);
      setStage(STAGE.POS_WAITING);
    } catch (e) {
      setErr(extractError(e));
      setStage(STAGE.ERROR);
      setBusy(false);
      return;
    }
    setBusy(false);

    pollIntervalRef.current = setInterval(async () => {
      try {
        const { data: statusData } = await api.get(`/billing/pos/status/${ptrnValue}`);
        if (statusData.ResponseCode === 0) {
          clearInterval(pollIntervalRef.current);
          // Refresh invoice for print view
          const { data } = await getInvoiceById(invoice.id);
          setInvoice(data.data.invoice);
          const txRef = statusData.TransactionData?.map((t) => t.Value).join(' · ') ?? String(ptrnValue);
          setSuccessData({
            invoiceNumber: invoice.invoiceNumber,
            amountPaid:    remaining,
            paymentMode:   modeName,
            txRef,
          });
          setStage(STAGE.SUCCESS);
        } else if (statusData.ResponseCode !== 1001) {
          clearInterval(pollIntervalRef.current);
          setErr(`POS terminal: ${statusData.ResponseMessage}`);
          setStage(STAGE.ERROR);
        }
      } catch (pollErr) {
        clearInterval(pollIntervalRef.current);
        setErr(extractError(pollErr));
        setStage(STAGE.ERROR);
      }
    }, 1500);
  }

  async function paySplit(cashNum, onlineNum) {
    setBusy(true);
    setErr('');
    try {
      await api.post('/payments', {
        invoiceId:     invoice.id,
        paymentModeId: cashModeId,
        amountPaid:    cashNum,
        paymentDate:   todayStr(),
      });
      await api.post('/payments', {
        invoiceId:     invoice.id,
        paymentModeId: splitPosModeId,
        amountPaid:    onlineNum,
        paymentDate:   todayStr(),
      });
      // Refresh invoice for print view
      const { data } = await getInvoiceById(invoice.id);
      setInvoice(data.data.invoice);

      setSuccessData({
        invoiceNumber: invoice.invoiceNumber,
        amountPaid:    calcRemaining(invoice),
        paymentMode:   'Split (Cash + Online)',
      });
      setStage(STAGE.SUCCESS);
    } catch (e) {
      setErr(extractError(e));
    } finally {
      setBusy(false);
    }
  }

  // ── Print handler ─────────────────────────────────────────────────────────

  function handlePrint() {
    window.print();
  }

  // ── Modal close guard ─────────────────────────────────────────────────────

  function handleClose() {
    if (stage === STAGE.POS_WAITING) return;
    clearInterval(pollIntervalRef.current);
    onClose(stage === STAGE.SUCCESS);
  }

  // ── Derived state ─────────────────────────────────────────────────────────

  const remaining    = calcRemaining(invoice);
  const cashModeName = modes.find((m) => m.id === cashModeId)?.name ?? 'Cash';
  const posModeName  = modes.find((m) => m.id === posModeId)?.name  ?? 'Online / Card';
  const nonCashModes = modes.filter((m) => m.id !== cashModeId);

  const PAY_TABS = [
    { id: 'cash',  label: 'Cash',        Icon: CashIcon },
    { id: 'pos',   label: 'Online / POS', Icon: CardIcon },
    { id: 'split', label: 'Split',        Icon: SplitIcon },
  ];

  const modalTitle =
    stage === STAGE.SUCCESS     ? 'Receipt' :
    stage === STAGE.POS_WAITING ? 'POS Terminal' :
    stage === STAGE.SELECT      ? 'Select Tests & Generate Bill' :
    'Collect Payment';

  return (
    <>
      <Modal open={open} onClose={handleClose} title={modalTitle} size="md">
        {/* LOADING */}
        {stage === STAGE.LOADING && (
          <div className="flex flex-col items-center gap-3 py-10">
            <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-slate-200 border-t-blue-600" />
            <p className="text-sm text-slate-500">Loading…</p>
          </div>
        )}

        {/* SELECT TESTS */}
        {stage === STAGE.SELECT && (
          <>
            {err && (
              <p className="mb-3 rounded-lg bg-red-50 border border-red-200 px-3 py-2.5 text-sm font-medium text-red-700">
                ⚠ {err}
              </p>
            )}
            <SelectServicesStage
              visit={visit}
              services={services}
              selected={selected}
              onToggle={toggleService}
              onProceed={proceedToPayment}
              busy={busy}
            />
          </>
        )}

        {/* STAGING (creating invoice) */}
        {stage === STAGE.STAGING && (
          <div className="flex flex-col items-center gap-3 py-10">
            <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-slate-200 border-t-blue-600" />
            <p className="text-sm text-slate-500">Staging invoice…</p>
          </div>
        )}

        {/* POS WAITING */}
        {stage === STAGE.POS_WAITING && (
          <PosWaitingScreen ptrn={ptrn} remaining={remaining} modeName={posModeName} />
        )}

        {/* SUCCESS */}
        {stage === STAGE.SUCCESS && successData && (
          <SuccessScreen
            data={successData}
            onClose={handleClose}
            onPrint={handlePrint}
          />
        )}

        {/* ERROR */}
        {stage === STAGE.ERROR && (
          <div className="flex flex-col items-center gap-4 py-8 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-100">
              <WarnLargeIcon />
            </div>
            <div>
              <p className="font-semibold text-slate-900">Something went wrong</p>
              <p className="mt-1 text-sm text-red-600">{err}</p>
            </div>
            <Button onClick={() => setRetryKey((k) => k + 1)}>Try Again</Button>
          </div>
        )}

        {/* READY — payment tabs */}
        {stage === STAGE.READY && invoice && (
          <div className="space-y-4">
            {/* Invoice summary */}
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-mono text-xs font-semibold text-blue-700">{invoice.invoiceNumber}</p>
                  <p className="mt-0.5 text-base font-bold text-slate-900">
                    {visit?.patient?.firstName} {visit?.patient?.lastName ?? ''}
                  </p>
                  <p className="text-[11px] text-slate-500 font-mono">
                    {visit?.patient?.uhid} · {visit?.opNumber}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs text-slate-500">Net Amount</p>
                  <p className="text-2xl font-bold text-slate-900">{fmtCurrency(invoice.netAmount)}</p>
                  {remaining < Number(invoice.netAmount) && (
                    <p className="mt-0.5 text-xs font-semibold text-amber-600">
                      Remaining: {fmtCurrency(remaining)}
                    </p>
                  )}
                </div>
              </div>
              <div className="mt-3 space-y-1 border-t border-slate-200 pt-3">
                {invoice.items.map((item) => (
                  <div key={item.id} className="flex justify-between text-sm">
                    <span className="text-slate-600">{item.description}</span>
                    <span className="font-semibold text-slate-800">{fmtCurrency(item.amount)}</span>
                  </div>
                ))}
                {Number(invoice.discountAmount) > 0 && (
                  <div className="flex justify-between text-sm text-emerald-700">
                    <span>Discount</span>
                    <span className="font-semibold">−{fmtCurrency(invoice.discountAmount)}</span>
                  </div>
                )}
                {invoice.payments.length > 0 && (
                  <div className="mt-2 border-t border-dashed border-slate-200 pt-2 space-y-1">
                    {invoice.payments.map((p) => (
                      <div key={p.id} className="flex justify-between text-xs text-emerald-700">
                        <span>Paid via {p.paymentMode?.name}</span>
                        <span className="font-semibold">{fmtCurrency(p.amountPaid)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {err && (
              <p className="rounded-lg bg-red-50 border border-red-200 px-3 py-2.5 text-sm font-medium text-red-700">
                ⚠ {err}
              </p>
            )}

            {/* Payment type tabs */}
            <div className="flex overflow-hidden rounded-xl border border-slate-200">
              {PAY_TABS.map((tab, i) => {
                const Icon = tab.Icon;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => { setPayTab(tab.id); setErr(''); }}
                    className={`flex flex-1 items-center justify-center gap-1.5 py-2.5 text-sm font-medium transition-colors
                      ${i > 0 ? 'border-l border-slate-200' : ''}
                      ${payTab === tab.id
                        ? 'bg-slate-900 text-white'
                        : 'bg-white text-slate-600 hover:bg-slate-50'}`}
                  >
                    <Icon /> {tab.label}
                  </button>
                );
              })}
            </div>

            {payTab === 'cash' && (
              <CashTab
                modeName={cashModeName}
                cashAmt={cashAmt} setCashAmt={setCashAmt}
                remaining={remaining}
                busy={busy} onPay={payCash}
              />
            )}
            {payTab === 'pos' && (
              <PosTab
                modeName={posModeName}
                remaining={remaining}
                busy={busy} onSend={sendToPos}
              />
            )}
            {payTab === 'split' && (
              <SplitTab
                cashModeName={cashModeName}
                nonCashModes={nonCashModes}
                splitCashAmt={splitCashAmt} setSplitCashAmt={setSplitCashAmt}
                splitPosModeId={splitPosModeId} setSplitPosModeId={setSplitPosModeId}
                remaining={remaining}
                busy={busy} onPay={paySplit}
              />
            )}
          </div>
        )}
      </Modal>

      {/* A5 print view — rendered as a portal into document.body, hidden on screen */}
      {stage === STAGE.SUCCESS && invoice && (
        <InvoicePrintView invoice={invoice} visit={visit} />
      )}
    </>
  );
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function ArrowRightIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 8h10M9 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PrintIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M4 5V2.5h8V5" />
      <rect x="1.5" y="5" width="13" height="7" rx="1.5" />
      <path d="M4 12.5h8v1H4z" fill="currentColor" stroke="none" />
      <circle cx="3.5" cy="8" r="0.75" fill="currentColor" stroke="none" />
    </svg>
  );
}

function CashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="1" y="4.5" width="14" height="8" rx="1.5" />
      <circle cx="8" cy="8.5" r="2" />
      <path d="M4 4.5V3.5M12 4.5V3.5" />
    </svg>
  );
}

function CardIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="1" y="3.5" width="14" height="10" rx="1.5" />
      <path d="M1 6.5h14" />
      <rect x="3" y="9.5" width="4" height="1.5" rx="0.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

function SplitIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M8 2v12M2 8h12" />
      <path d="M4 4l4-2 4 2M4 12l4 2 4-2" />
    </svg>
  );
}

function TerminalIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="2" y="1.5" width="12" height="9" rx="1.5" />
      <path d="M5 4.5h6M5 7h4" />
      <rect x="4" y="12.5" width="8" height="2" rx="1" fill="currentColor" stroke="none" />
      <path d="M8 10.5v2" />
    </svg>
  );
}

function PosTerminalLargeIcon() {
  return (
    <svg width="36" height="36" viewBox="0 0 36 36" fill="none" stroke="white" strokeWidth="1.8">
      <rect x="5" y="4" width="26" height="20" rx="3" />
      <path d="M11 10h14M11 15h9" />
      <rect x="9" y="27" width="18" height="5" rx="2" fill="white" stroke="none" opacity="0.3" />
      <path d="M18 24v3" />
    </svg>
  );
}

function CheckCircleIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="8" cy="8" r="6.5" />
      <path d="M5 8l2 2 4-4" />
    </svg>
  );
}

function SplitPayIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M8 1v14M1 8h14" strokeLinecap="round" />
    </svg>
  );
}

function WarnLargeIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
      <path d="M14 3L26 24H2L14 3Z" fill="#FEE2E2" stroke="#EF4444" strokeWidth="1.5" />
      <path d="M14 11v5" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" />
      <circle cx="14" cy="19" r="1" fill="#EF4444" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" className="animate-spin" fill="none">
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" strokeDasharray="18 20" strokeLinecap="round" />
    </svg>
  );
}
