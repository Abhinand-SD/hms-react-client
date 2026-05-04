/**
 * Phase 2 — Diagnostic Tests Billing Modal
 *
 * Lets the receptionist select prescribed tests (ECG, ECHO, TMT, …),
 * creates a SERVICES invoice, collects payment, then prints a
 * "Diagnostic Services Receipt".
 */
import { useEffect, useRef, useState } from 'react';
import { api, extractError } from '../../lib/api';
import { Modal } from '../../components/Modal';
import { Button } from '../../components/Button';
import { createServicesInvoice, getInvoiceById } from '../../api/billing.api';
import { listServices } from '../../api/services.api';

// ─── Constants ────────────────────────────────────────────────────────────────

const INP = 'block w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:bg-slate-50 disabled:text-slate-400';

const STAGE = {
  LOADING:     'loading',
  SELECT:      'select',
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

// ─── Service selection stage ──────────────────────────────────────────────────

function SelectStage({ visit, services, selected, onToggle, onProceed, busy, err }) {
  const selectedSvcs = services.filter((s) => selected.has(s.id));
  const testsTotal   = selectedSvcs.reduce((sum, s) => sum + Number(s.price), 0);

  return (
    <div className="space-y-4">
      {/* Patient info */}
      <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
        <p className="text-sm font-bold text-slate-900">
          {visit?.patient?.firstName} {visit?.patient?.lastName ?? ''}
        </p>
        <p className="font-mono text-[11px] text-slate-500">
          {visit?.patient?.uhid} · {visit?.opNumber}
        </p>
        {visit?.doctor?.name && <p className="mt-0.5 text-xs text-slate-600">Dr. {visit.doctor.name}</p>}
      </div>

      {/* Test checkboxes */}
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
          Select Prescribed Tests
        </p>
        {services.length === 0 ? (
          <p className="text-sm italic text-slate-400">No active tests configured.</p>
        ) : (
          <div className="space-y-1.5">
            {services.map((svc) => (
              <label
                key={svc.id}
                className={`flex cursor-pointer items-center justify-between rounded-lg border px-3 py-2.5 transition
                  ${selected.has(svc.id)
                    ? 'border-teal-300 bg-teal-50 ring-1 ring-teal-300'
                    : 'border-slate-200 bg-white hover:bg-slate-50'}`}
              >
                <div className="flex items-center gap-3">
                  <input type="checkbox" checked={selected.has(svc.id)} onChange={() => onToggle(svc.id)}
                    className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500" />
                  <span className="text-sm font-medium text-slate-800">{svc.serviceName}</span>
                </div>
                <span className="text-sm font-semibold text-slate-700">{fmtCurrency(svc.price)}</span>
              </label>
            ))}
          </div>
        )}
      </div>

      {/* Live billing total — tests only, no consultation fee */}
      <div className="rounded-xl border border-slate-200 bg-white divide-y divide-slate-100">
        {selectedSvcs.map((s) => (
          <div key={s.id} className="flex justify-between px-4 py-2.5 text-sm">
            <span className="text-slate-500">{s.serviceName}</span>
            <span className="font-semibold text-slate-800">{fmtCurrency(s.price)}</span>
          </div>
        ))}
        <div className="flex justify-between px-4 py-3">
          <span className="text-sm font-bold text-slate-900">Tests Total</span>
          <span className={`text-lg font-bold ${selected.size > 0 ? 'text-teal-700' : 'text-slate-400'}`}>
            {fmtCurrency(testsTotal)}
          </span>
        </div>
      </div>

      {err && <p className="rounded-lg bg-red-50 border border-red-200 px-3 py-2.5 text-sm text-red-700">⚠ {err}</p>}

      <button onClick={onProceed} disabled={busy || selected.size === 0}
        className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-teal-700 disabled:opacity-60 disabled:cursor-not-allowed transition">
        {busy ? <SpinnerIcon /> : <ArrowRightIcon />}
        {busy ? 'Creating test bill…' : `Generate Test Bill (${fmtCurrency(testsTotal)})`}
      </button>
    </div>
  );
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
        className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-teal-700 disabled:opacity-60 disabled:cursor-not-allowed transition">
        {busy ? <SpinnerIcon /> : <CheckIcon />}
        {busy ? 'Recording…' : 'Record Payment & Print Test Bill'}
      </button>
    </div>
  );
}

function PosTab({ modeName, remaining, busy, onSend }) {
  return (
    <div className="space-y-3.5">
      <ModeBadge name={modeName} />
      <div className="rounded-xl bg-teal-50 border border-teal-100 px-4 py-3 flex items-center justify-between">
        <span className="text-sm text-teal-700 font-medium">Tests amount to charge</span>
        <span className="text-xl font-bold text-teal-900">{fmtCurrency(remaining)}</span>
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
        <span>Total remaining</span><span className="text-slate-900">{fmtCurrency(remaining)}</span>
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
      <div className="rounded-xl border border-teal-100 bg-teal-50/50 p-3.5 space-y-2">
        <p className="text-xs font-bold text-teal-700 uppercase tracking-wide">Online Portion</p>
        <ModeBadge name={onlineModeName} />
        <div className="flex items-center rounded-lg border border-teal-100 bg-white px-3.5 py-2.5">
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
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-teal-100 ring-4 ring-teal-50">
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
          <path d="M6 16l7 7L26 9" stroke="#0d9488" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <div>
        <p className="text-lg font-bold text-slate-900">Test Payment Collected!</p>
        <p className="mt-0.5 font-mono text-sm font-semibold text-teal-700">{data.invoiceNumber}</p>
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

export function TestsBillingModal({ open, visit, onClose, onRequestPrint }) {
  const [stage, setStage]       = useState(STAGE.LOADING);
  const [services, setServices] = useState([]);
  const [selected, setSelected] = useState(new Set());
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

  // ── On open: fetch services + payment modes ────────────────────────────────
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
    clearInterval(pollRef.current);

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
          const { cash, pos } = pickModes(modeList);
          setCashModeId(cash.id);
          setPosModeId(pos.id);
          setSplitPosId(pos.id);
        }
        setStage(STAGE.SELECT);
      })
      .catch((e) => { setErr(extractError(e)); setStage(STAGE.ERROR); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, visit, retryKey]);

  useEffect(() => () => clearInterval(pollRef.current), []);

  function toggleService(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  // ── Create services invoice then move to READY ────────────────────────────
  async function generateInvoice() {
    setBusy(true); setErr('');
    try {
      const { data } = await createServicesInvoice(visit.id, [...selected]);
      const inv = data.data.invoice;
      setInvoice(inv);
      const rem = calcRemaining(inv);
      setCashAmt(rem.toFixed(2));
      setSplitCash('');
      setStage(STAGE.READY);
    } catch (e) {
      setErr(extractError(e));
    } finally {
      setBusy(false);
    }
  }

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
          stage === STAGE.SUCCESS     ? 'Tests Billed' :
          stage === STAGE.POS_WAITING ? 'POS Terminal' :
          'Diagnostic Tests — Phase 2'
        }
        size="md"
      >
        {/* LOADING */}
        {stage === STAGE.LOADING && (
          <div className="flex flex-col items-center gap-3 py-10">
            <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-slate-200 border-t-teal-600" />
            <p className="text-sm text-slate-500">Loading test catalogue…</p>
          </div>
        )}

        {/* SELECT TESTS */}
        {stage === STAGE.SELECT && (
          <SelectStage
            visit={visit}
            services={services}
            selected={selected}
            onToggle={toggleService}
            onProceed={generateInvoice}
            busy={busy}
            err={err}
          />
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
            <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-slate-200 border-t-teal-600" />
          </div>
        )}

        {/* SUCCESS */}
        {stage === STAGE.SUCCESS && successData && (
          <SuccessScreen data={successData} onPrint={() => onRequestPrint?.(invoice, visit)} onClose={handleClose} />
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

        {/* READY — payment tabs */}
        {stage === STAGE.READY && invoice && (
          <div className="space-y-4">
            <div className="rounded-xl border border-teal-200 bg-teal-50 p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-mono text-xs font-semibold text-teal-700">{invoice.invoiceNumber}</p>
                  <p className="mt-0.5 text-sm font-bold text-slate-900">
                    {visit?.patient?.firstName} {visit?.patient?.lastName ?? ''}
                  </p>
                  <p className="text-[11px] text-slate-500 font-mono">{visit?.patient?.uhid}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs text-slate-500">Tests Total</p>
                  <p className="text-2xl font-bold text-teal-900">{fmtCurrency(invoice.netAmount)}</p>
                </div>
              </div>
              <div className="mt-3 space-y-1 border-t border-teal-100 pt-3">
                {invoice.items.map((item) => (
                  <div key={item.id} className="flex justify-between text-sm">
                    <span className="text-slate-600">{item.description}</span>
                    <span className="font-semibold text-slate-800">{fmtCurrency(item.amount)}</span>
                  </div>
                ))}
              </div>
            </div>

            {err && <p className="rounded-lg bg-red-50 border border-red-200 px-3 py-2.5 text-sm text-red-700">⚠ {err}</p>}

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

    </>
  );
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function ArrowRightIcon() {
  return <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 8h10M9 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
function CheckIcon() {
  return <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="8" cy="8" r="6.5" /><path d="M5 8l2 2 4-4" /></svg>;
}
function PrintIcon() {
  return <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 5V2.5h8V5" /><rect x="1.5" y="5" width="13" height="7" rx="1.5" /><path d="M4 12.5h8v1H4z" fill="currentColor" stroke="none" /></svg>;
}
function SpinnerIcon() {
  return <svg width="14" height="14" viewBox="0 0 16 16" className="animate-spin" fill="none"><circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" strokeDasharray="18 20" strokeLinecap="round" /></svg>;
}
