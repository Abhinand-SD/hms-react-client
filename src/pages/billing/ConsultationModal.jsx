/**
 * Phase 1 — Consultation Billing Modal (streamlined)
 *
 * On open: payment modes + consultation invoice are created in parallel.
 * The user lands directly on the payment tab — no intermediate "Generate" step.
 * Pick Cash / POS / Split → click Pay → A5 "OP Consultation Receipt" prints.
 */
import { useEffect, useRef, useState } from 'react';
import { api, extractError } from '../../lib/api';
import { Modal } from '../../components/Modal';
import { Button } from '../../components/Button';
import { InvoicePrintView } from '../../components/InvoicePrintView';
import { createConsultationInvoice, getInvoiceById } from '../../api/billing.api';

// ─── Constants ────────────────────────────────────────────────────────────────

const INP = 'block w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:bg-slate-50 disabled:text-slate-400';

const STAGE = {
  LOADING:     'loading',
  READY:       'ready',
  POS_WAITING: 'pos_waiting',
  SUCCESS:     'success',
  ERROR:       'error',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtCurrency(v) {
  return `₹${Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function todayStr() { return new Date().toISOString().split('T')[0]; }

function calcRemaining(invoice) {
  if (!invoice) return 0;
  const paid = invoice.payments.reduce((s, p) => s + Number(p.amountPaid), 0);
  return Math.max(0, Number(invoice.netAmount) - paid);
}

function pickModes(list) {
  const cash =
    list.find((m) => m.code === 'CASH') ??
    list.find((m) => /cash/i.test(m.code) || /cash/i.test(m.name)) ??
    list[0];
  const pos =
    list.find((m) => m.id !== cash?.id && (/card|upi|online|pos|digital/i.test(m.code) || /card|upi|online|pos|digital/i.test(m.name))) ??
    list.find((m) => m.id !== cash?.id) ??
    list[0];
  return { cash, pos };
}

// ─── Payment sub-components ───────────────────────────────────────────────────

function ModeBadge({ name }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5">
      <span className="text-xs font-semibold text-slate-500">Payment Mode</span>
      <span className="rounded-full bg-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700">{name}</span>
    </div>
  );
}

function CashTab({ modeName, cashAmt, setCashAmt, remaining, busy, onPay }) {
  const valid = Number(cashAmt) > 0 && Number(cashAmt) <= remaining + 0.01;
  return (
    <div className="space-y-3.5">
      <ModeBadge name={modeName} />
      <div className="relative">
        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-500">₹</span>
        <input type="number" min="0.01" step="0.01" value={cashAmt}
          onChange={(e) => setCashAmt(e.target.value)} className={`${INP} pl-8`} />
      </div>
      <button onClick={onPay} disabled={!valid || busy}
        className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed transition">
        {busy ? <SpinnerIcon /> : <CheckIcon />}
        {busy ? 'Recording…' : 'Record Payment & Print Bill'}
      </button>
    </div>
  );
}

function PosTab({ modeName, remaining, busy, onSend }) {
  return (
    <div className="space-y-3.5">
      <ModeBadge name={modeName} />
      <div className="rounded-xl bg-blue-50 border border-blue-100 px-4 py-3 flex items-center justify-between">
        <span className="text-sm text-blue-700 font-medium">Amount to charge</span>
        <span className="text-xl font-bold text-blue-900">{fmtCurrency(remaining)}</span>
      </div>
      <button onClick={onSend} disabled={busy}
        className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition">
        {busy ? <SpinnerIcon /> : null}
        {busy ? 'Connecting…' : 'Send to POS Terminal'}
      </button>
    </div>
  );
}

function SplitTab({ cashModeName, onlineModeName, splitCash, setSplitCash, remaining, busy, onPay }) {
  const cn = Number(splitCash) || 0;
  const on = Math.max(0, remaining - cn);
  const valid = cn > 0 && cn < remaining && on > 0;
  return (
    <div className="space-y-3.5">
      <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-2.5 flex justify-between text-xs font-semibold text-slate-500">
        <span>Total remaining</span>
        <span className="text-slate-900">{fmtCurrency(remaining)}</span>
      </div>
      <div className="rounded-xl border border-slate-200 p-3.5 space-y-2">
        <p className="text-xs font-bold text-slate-700 uppercase tracking-wide">Cash Portion</p>
        <ModeBadge name={cashModeName} />
        <div className="relative">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-500">₹</span>
          <input type="number" min="0.01" step="0.01" placeholder="0.00" value={splitCash}
            onChange={(e) => setSplitCash(e.target.value)} className={`${INP} pl-8`} />
        </div>
      </div>
      <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-3.5 space-y-2">
        <p className="text-xs font-bold text-blue-700 uppercase tracking-wide">Online Portion</p>
        <ModeBadge name={onlineModeName} />
        <div className="flex items-center rounded-lg border border-blue-100 bg-white px-3.5 py-2.5">
          <span className="text-sm font-semibold text-slate-500 mr-1">₹</span>
          <span className="text-sm font-bold text-slate-900">{on.toFixed(2)}</span>
          <span className="ml-auto text-[11px] text-slate-400">auto-calculated</span>
        </div>
      </div>
      <button onClick={() => onPay(cn, on)} disabled={!valid || busy}
        className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-violet-700 disabled:opacity-60 disabled:cursor-not-allowed transition">
        {busy ? <SpinnerIcon /> : null}
        {busy ? 'Processing…' : 'Process Split Payment'}
      </button>
    </div>
  );
}

// ─── Success screen ───────────────────────────────────────────────────────────

function SuccessScreen({ data, onPrint, onClose }) {
  return (
    <div className="flex flex-col items-center gap-5 py-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 ring-4 ring-emerald-50">
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
          <path d="M6 16l7 7L26 9" stroke="#059669" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <div>
        <p className="text-lg font-bold text-slate-900">Consultation Fee Collected!</p>
        <p className="mt-0.5 font-mono text-sm font-semibold text-blue-700">{data.invoiceNumber}</p>
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
        {data.note && (
          <div className="px-4 py-2.5 text-slate-500">{data.note}</div>
        )}
      </div>
      <div className="flex w-full gap-2">
        <button onClick={onPrint}
          className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100 transition">
          <PrintIcon /> Print A5 Bill
        </button>
        <button onClick={onClose}
          className="flex-1 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 transition">
          Close
        </button>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ConsultationModal({ open, visit, onClose }) {
  const [stage, setStage]       = useState(STAGE.LOADING);
  const [invoice, setInvoice]   = useState(null);
  const [modes, setModes]       = useState([]);
  const [payTab, setPayTab]     = useState('cash');
  const [cashModeId, setCashModeId] = useState('');
  const [posModeId,  setPosModeId]  = useState('');
  const [cashAmt, setCashAmt]   = useState('');
  const [ptrn, setPtrn]         = useState(null);
  const [splitCash, setSplitCash]   = useState('');
  const [splitPosId, setSplitPosId] = useState('');
  const [busy, setBusy]         = useState(false);
  const [err, setErr]           = useState('');
  const [successData, setSuccessData] = useState(null);
  const [retryKey, setRetryKey] = useState(0);
  const pollRef = useRef(null);

  // ── On open: fetch payment modes + create/reuse invoice in parallel ────────
  // Skips the old "Preview → Generate → Ready" sequence.
  // The user arrives directly at payment tabs with the amount pre-filled.
  useEffect(() => {
    if (!open || !visit) return;
    setStage(STAGE.LOADING);
    setInvoice(null);
    setModes([]);
    setPayTab('cash');
    setBusy(false);
    setErr('');
    setSuccessData(null);
    setPtrn(null);
    clearInterval(pollRef.current);

    const modesP = api.get('/payment-modes', { params: { limit: 100, isActive: 'true' } });

    // Create invoice; if 409 it already exists — re-fetch by id.
    // Pass isFollowUp so the billing service can set fee = 0 for walk-in follow-ups
    // (the flag lives on the visit object returned at registration, not in the DB yet).
    const invoiceP = createConsultationInvoice(visit.id, visit?.isFollowUp ?? false).catch((e) => {
      if (e.response?.status === 409) {
        const existingId = e.response?.data?.error?.details?.invoiceId;
        if (existingId) return getInvoiceById(existingId);
      }
      throw e;
    });

    Promise.all([modesP, invoiceP])
      .then(([{ data: pmData }, invRes]) => {
        const list = pmData.data.items ?? [];
        setModes(list);
        if (list.length > 0) {
          const { cash, pos } = pickModes(list);
          setCashModeId(cash.id);
          setPosModeId(pos.id);
          setSplitPosId(pos.id);
        }

        const inv = invRes.data.data.invoice;
        setInvoice(inv);
        const rem = calcRemaining(inv);
        setCashAmt(rem.toFixed(2));
        setSplitCash('');

        if (Number(inv.netAmount) === 0) {
          setSuccessData({
            invoiceNumber: inv.invoiceNumber,
            amountPaid: 0,
            note: 'Follow-up visit — no consultation fee charged.',
          });
          setStage(STAGE.SUCCESS);
        } else if (inv.paymentStatus === 'PAID') {
          setSuccessData({ invoiceNumber: inv.invoiceNumber, note: 'This invoice is already fully paid.' });
          setStage(STAGE.SUCCESS);
        } else {
          setStage(STAGE.READY);
        }
      })
      .catch((e) => { setErr(extractError(e)); setStage(STAGE.ERROR); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, visit, retryKey]);

  useEffect(() => () => clearInterval(pollRef.current), []);

  // ── Payment handlers ──────────────────────────────────────────────────────

  async function payCash() {
    setBusy(true); setErr('');
    try {
      await api.post('/payments', {
        invoiceId: invoice.id, paymentModeId: cashModeId,
        amountPaid: Number(cashAmt), paymentDate: todayStr(),
      });
      const { data } = await getInvoiceById(invoice.id);
      setInvoice(data.data.invoice);
      setSuccessData({
        invoiceNumber: invoice.invoiceNumber,
        amountPaid:    Number(cashAmt),
        paymentMode:   modes.find((m) => m.id === cashModeId)?.name ?? 'Cash',
      });
      setStage(STAGE.SUCCESS);
    } catch (e) { setErr(extractError(e)); }
    finally { setBusy(false); }
  }

  async function sendToPos() {
    clearInterval(pollRef.current);
    const remaining = calcRemaining(invoice);
    const modeName  = modes.find((m) => m.id === posModeId)?.name ?? 'Online / Card';
    setBusy(true); setErr('');
    let ptrnValue;
    try {
      const { data } = await api.post('/billing/pos/push', {
        invoiceId: invoice.id, amount: remaining, paymentModeId: posModeId,
      });
      ptrnValue = data.PlutusTransactionReferenceID;
      setPtrn(ptrnValue);
      setStage(STAGE.POS_WAITING);
    } catch (e) { setErr(extractError(e)); setStage(STAGE.ERROR); setBusy(false); return; }
    setBusy(false);

    pollRef.current = setInterval(async () => {
      try {
        const { data: sd } = await api.get(`/billing/pos/status/${ptrnValue}`);
        if (sd.ResponseCode === 0) {
          clearInterval(pollRef.current);
          const { data } = await getInvoiceById(invoice.id);
          setInvoice(data.data.invoice);
          setSuccessData({ invoiceNumber: invoice.invoiceNumber, amountPaid: remaining, paymentMode: modeName });
          setStage(STAGE.SUCCESS);
        } else if (sd.ResponseCode !== 1001) {
          clearInterval(pollRef.current);
          setErr(`POS: ${sd.ResponseMessage}`);
          setStage(STAGE.ERROR);
        }
      } catch (pe) { clearInterval(pollRef.current); setErr(extractError(pe)); setStage(STAGE.ERROR); }
    }, 1500);
  }

  async function paySplit(cn, on) {
    setBusy(true); setErr('');
    try {
      await api.post('/payments', { invoiceId: invoice.id, paymentModeId: cashModeId, amountPaid: cn, paymentDate: todayStr() });
      await api.post('/payments', { invoiceId: invoice.id, paymentModeId: splitPosId, amountPaid: on, paymentDate: todayStr() });
      const { data } = await getInvoiceById(invoice.id);
      setInvoice(data.data.invoice);
      setSuccessData({ invoiceNumber: invoice.invoiceNumber, amountPaid: cn + on, paymentMode: 'Split (Cash + Online)' });
      setStage(STAGE.SUCCESS);
    } catch (e) { setErr(extractError(e)); }
    finally { setBusy(false); }
  }

  function handleClose() {
    if (stage === STAGE.POS_WAITING) return;
    clearInterval(pollRef.current);
    onClose(stage === STAGE.SUCCESS);
  }

  const remaining    = calcRemaining(invoice);
  const cashModeName = modes.find((m) => m.id === cashModeId)?.name ?? 'Cash';
  const posModeName  = modes.find((m) => m.id === posModeId)?.name  ?? 'Online / Card';

  const PAY_TABS = [
    { id: 'cash',  label: 'Cash'        },
    { id: 'pos',   label: 'Online / POS'},
    { id: 'split', label: 'Split'       },
  ];

  return (
    <>
      <Modal
        open={open}
        onClose={handleClose}
        title={
          stage === STAGE.SUCCESS     ? 'Payment Collected' :
          stage === STAGE.POS_WAITING ? 'POS Terminal' :
          'Consultation Billing — Phase 1'
        }
        size="md"
      >
        {/* LOADING */}
        {stage === STAGE.LOADING && (
          <div className="flex flex-col items-center gap-3 py-10">
            <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-slate-200 border-t-blue-600" />
            <p className="text-sm text-slate-500">Preparing bill…</p>
          </div>
        )}

        {/* POS WAITING */}
        {stage === STAGE.POS_WAITING && (
          <div className="flex flex-col items-center gap-5 py-6 text-center">
            <div className="relative">
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-slate-800 shadow-xl">
                <svg width="36" height="36" viewBox="0 0 36 36" fill="none" stroke="white" strokeWidth="1.8">
                  <rect x="5" y="4" width="26" height="20" rx="3" /><path d="M11 10h14M11 15h9" />
                  <rect x="9" y="27" width="18" height="5" rx="2" fill="white" stroke="none" opacity="0.3" /><path d="M18 24v3" />
                </svg>
              </div>
              <span className="absolute -right-1 -top-1 flex h-4 w-4">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex h-4 w-4 rounded-full bg-green-500 border-2 border-white" />
              </span>
            </div>
            <div>
              <p className="text-base font-bold text-slate-900">Waiting for customer…</p>
              <p className="text-sm text-slate-500 font-mono">{ptrn}</p>
            </div>
            <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-slate-200 border-t-blue-600" />
          </div>
        )}

        {/* SUCCESS */}
        {stage === STAGE.SUCCESS && successData && (
          <SuccessScreen data={successData} onPrint={() => window.print()} onClose={handleClose} />
        )}

        {/* ERROR */}
        {stage === STAGE.ERROR && (
          <div className="flex flex-col items-center gap-4 py-8 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-100">
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                <path d="M14 3L26 24H2L14 3Z" fill="#FEE2E2" stroke="#EF4444" strokeWidth="1.5" />
                <path d="M14 11v5" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" />
                <circle cx="14" cy="19" r="1" fill="#EF4444" />
              </svg>
            </div>
            <div>
              <p className="font-semibold text-slate-900">Something went wrong</p>
              <p className="mt-1 text-sm text-red-600">{err}</p>
            </div>
            <Button onClick={() => setRetryKey((k) => k + 1)}>Try Again</Button>
          </div>
        )}

        {/* READY — payment tabs (shown immediately after loading) */}
        {stage === STAGE.READY && invoice && (
          <div className="space-y-4">
            {/* Compact patient + fee banner */}
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-mono text-xs font-semibold text-blue-700">{invoice.invoiceNumber}</p>
                  <p className="mt-0.5 text-sm font-bold text-slate-900">
                    {visit?.patient?.firstName} {visit?.patient?.lastName ?? ''}
                  </p>
                  <p className="text-[11px] text-slate-500 font-mono">
                    {visit?.patient?.uhid} · {visit?.opNumber}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[11px] text-slate-400 uppercase tracking-wide">Consultation Fee</p>
                  <p className="text-2xl font-bold text-slate-900">{fmtCurrency(invoice.netAmount)}</p>
                </div>
              </div>
              {/* Line items (typically just one: "Consultation Fee — Dr. X") */}
              <div className="mt-3 space-y-1 border-t border-slate-200 pt-2">
                {invoice.items.map((item) => (
                  <div key={item.id} className="flex justify-between text-sm">
                    <span className="text-slate-500">{item.description}</span>
                    <span className="font-semibold text-slate-800">{fmtCurrency(item.amount)}</span>
                  </div>
                ))}
              </div>
            </div>

            {err && <p className="rounded-lg bg-red-50 border border-red-200 px-3 py-2.5 text-sm text-red-700">⚠ {err}</p>}

            {/* Payment method tabs */}
            <div className="flex overflow-hidden rounded-xl border border-slate-200">
              {PAY_TABS.map((tab, i) => (
                <button key={tab.id} type="button"
                  onClick={() => { setPayTab(tab.id); setErr(''); }}
                  className={`flex flex-1 items-center justify-center py-2.5 text-sm font-medium transition-colors
                    ${i > 0 ? 'border-l border-slate-200' : ''}
                    ${payTab === tab.id ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>
                  {tab.label}
                </button>
              ))}
            </div>

            {payTab === 'cash'  && <CashTab modeName={cashModeName} cashAmt={cashAmt} setCashAmt={setCashAmt} remaining={remaining} busy={busy} onPay={payCash} />}
            {payTab === 'pos'   && <PosTab  modeName={posModeName}  remaining={remaining} busy={busy} onSend={sendToPos} />}
            {payTab === 'split' && <SplitTab cashModeName={cashModeName} onlineModeName={posModeName} splitCash={splitCash} setSplitCash={setSplitCash} remaining={remaining} busy={busy} onPay={paySplit} />}
          </div>
        )}
      </Modal>

      {/* A5 print portal — only rendered when invoice is available */}
      {stage === STAGE.SUCCESS && invoice && (
        <InvoicePrintView invoice={invoice} visit={visit} />
      )}
    </>
  );
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function CheckIcon() {
  return <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="8" cy="8" r="6.5" /><path d="M5 8l2 2 4-4" /></svg>;
}
function PrintIcon() {
  return <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 5V2.5h8V5" /><rect x="1.5" y="5" width="13" height="7" rx="1.5" /><path d="M4 12.5h8v1H4z" fill="currentColor" stroke="none" /></svg>;
}
function SpinnerIcon() {
  return <svg width="14" height="14" viewBox="0 0 16 16" className="animate-spin" fill="none"><circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" strokeDasharray="18 20" strokeLinecap="round" /></svg>;
}
