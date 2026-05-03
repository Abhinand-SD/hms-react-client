import { createPortal } from 'react-dom';
import { useAuth } from '../lib/auth';

function fmtCurrency(val) {
  const n = Number(val);
  return isNaN(n) ? '—' : `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-IN', {
    day: '2-digit', month: 'long', year: 'numeric',
  });
}

const INVOICE_TITLES = {
  CONSULTATION: 'OP Consultation Receipt',
  SERVICES:     'Diagnostic Services Receipt',
};

export function InvoicePrintView({ invoice, visit }) {
  const { user } = useAuth();

  if (!invoice) return null;

  const invoiceType  = invoice.invoiceType ?? 'CONSULTATION';
  const receiptTitle = INVOICE_TITLES[invoiceType] ?? 'OPD Receipt';

  const patientName = visit?.patient
    ? `${visit.patient.firstName}${visit.patient.lastName ? ` ${visit.patient.lastName}` : ''}`
    : `${invoice.patient?.firstName ?? ''}${invoice.patient?.lastName ? ` ${invoice.patient.lastName}` : ''}`;

  const uhid     = visit?.patient?.uhid ?? invoice.patient?.uhid ?? '—';
  const opNumber = visit?.opNumber ?? invoice.visit?.opNumber ?? '—';

  // Extract the numeric queue token from the OP number.
  // Format: "DR01-20260503-042" → split on '-', take last segment "042",
  // parse as integer to strip leading zeros → 42.
  const tokenNumber = opNumber !== '—'
    ? parseInt(opNumber.split('-').pop(), 10)
    : null;

  const billedBy = user?.fullName ?? user?.username ?? '—';

  const content = (
    <div className="invoice-print-root" style={{ display: 'none' }}>
      <style>{`
        /* ── Page setup: A5 Landscape, blank top for pre-printed letterhead ── */
        @media print {
          @page {
            size: A5 landscape;
            margin: 0;
          }
          body {
            margin: 0;
            padding: 0;
          }
          body > * { display: none !important; }
          .invoice-print-root {
            display: block !important;
            font-family: Arial, Helvetica, system-ui, -apple-system, "Segoe UI", sans-serif;
            color: #111;
            font-size: 10pt;
            /* Padding on the container, not body, so it travels with the element */
            padding-top: 3.5cm;
            padding-left: 1cm;
            padding-right: 1cm;
            padding-bottom: 1cm;
          }
          .no-print { display: none !important; }
        }

        /* ── Base styles ─────────────────────────────────────────────────── */
        .invoice-print-root {
          width: 210mm;
          font-family: Arial, Helvetica, system-ui, -apple-system, "Segoe UI", sans-serif;
        }

        /* ── Receipt title bar ───────────────────────────────────────────── */
        .inv-title-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: #1a1a2e;
          color: white;
          padding: 5px 10px;
          border-radius: 4px;
          margin-bottom: 8px;
        }
        .inv-title-text {
          font-size: 9pt;
          font-weight: bold;
          text-transform: uppercase;
          letter-spacing: 1.2px;
        }
        .inv-title-meta {
          font-size: 7.5pt;
          opacity: 0.85;
          text-align: right;
        }

        /* ── Patient + token band ────────────────────────────────────────── */
        .inv-patient-band {
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: #f4f7ff;
          border: 1px solid #dde4f5;
          border-radius: 4px;
          padding: 8px 12px;
          margin-bottom: 8px;
        }
        .inv-band-left { display: flex; flex-direction: column; gap: 3px; }
        .inv-band-row  { display: flex; flex-direction: column; }
        .inv-band-label { color: #777; font-size: 7pt; text-transform: uppercase; letter-spacing: 0.5px; }
        .inv-band-val   { font-weight: bold; color: #1a1a2e; font-size: 9pt; margin-top: 1px; }
        .inv-band-right { text-align: right; }
        .inv-token-lbl  { color: #777; font-size: 7pt; text-transform: uppercase; letter-spacing: 0.5px; }
        .inv-token-num  {
          font-size: 34pt;
          font-weight: 900;
          color: #1a1a2e;
          line-height: 1;
          margin-top: 2px;
        }

        /* ── Line items table ────────────────────────────────────────────── */
        .inv-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 8.5pt;
          margin-bottom: 6px;
        }
        .inv-table th {
          background: #f0f2f8;
          color: #1a1a2e;
          padding: 5px 8px;
          text-align: left;
          font-size: 7.5pt;
          font-weight: bold;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          border-bottom: 1.5px solid #1a1a2e;
        }
        .inv-table th:last-child { text-align: right; }
        .inv-table td {
          padding: 5px 8px;
          border-bottom: 1px solid #eee;
          vertical-align: top;
        }
        .inv-table td:last-child { text-align: right; font-weight: 600; }
        .inv-table tr:last-child td { border-bottom: none; }

        /* ── Totals + status row ─────────────────────────────────────────── */
        .inv-bottom-row {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          margin-top: 4px;
        }
        .inv-payments { font-size: 7.5pt; color: #555; flex: 1; }
        .inv-payments p { margin: 1px 0; }
        .inv-totals { text-align: right; }
        .inv-total-line {
          display: flex;
          justify-content: space-between;
          gap: 24px;
          padding: 6px 8px 4px;
          border-top: 2px solid #1a1a2e;
          font-size: 11pt;
          font-weight: bold;
          color: #1a1a2e;
        }
        .inv-status-wrap { text-align: right; margin-top: 4px; }
        .inv-status {
          font-size: 7.5pt;
          font-weight: bold;
          letter-spacing: 1px;
          text-transform: uppercase;
          border-radius: 20px;
          display: inline-block;
          padding: 2px 12px;
        }
        .inv-status-paid     { color: #059669; border: 1.5px solid #059669; }
        .inv-status-pending  { color: #d97706; border: 1.5px solid #d97706; }
        .inv-status-partial  { color: #2563eb; border: 1.5px solid #2563eb; }
        .inv-status-refunded { color: #dc2626; border: 1.5px solid #dc2626; }

        /* ── Footer ──────────────────────────────────────────────────────── */
        .inv-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: 10px;
          border-top: 1px solid #ddd;
          padding-top: 6px;
          font-size: 7.5pt;
          color: #666;
        }
        .inv-thank {
          text-align: center;
          font-size: 7pt;
          color: #aaa;
          margin-top: 6px;
          font-style: italic;
        }
      `}</style>

      {/* ── Receipt title + invoice number + date ── */}
      <div className="inv-title-bar">
        <span className="inv-title-text">{receiptTitle}</span>
        <span className="inv-title-meta">
          {invoice.invoiceNumber} &nbsp;·&nbsp;{' '}
          {fmtDate(invoice.invoiceDate?.split?.('T')[0] ?? invoice.invoiceDate)}
        </span>
      </div>

      {/* ── Patient details (left) + large queue token (right) ── */}
      <div className="inv-patient-band">
        <div className="inv-band-left">
          <div className="inv-band-row">
            <span className="inv-band-label">Patient</span>
            <span className="inv-band-val">{patientName}</span>
          </div>
          <div className="inv-band-row">
            <span className="inv-band-label">UHID</span>
            <span className="inv-band-val">{uhid}</span>
          </div>
          <div className="inv-band-row">
            <span className="inv-band-label">OP Number</span>
            <span className="inv-band-val">{opNumber}</span>
          </div>
          {(invoice.visit?.doctor?.name) && (
            <div className="inv-band-row">
              <span className="inv-band-label">Doctor</span>
              <span className="inv-band-val">{invoice.visit.doctor.name}</span>
            </div>
          )}
        </div>

        {tokenNumber !== null && (
          <div className="inv-band-right">
            <div className="inv-token-lbl">Queue Token</div>
            <div className="inv-token-num">{tokenNumber}</div>
          </div>
        )}
      </div>

      {/* ── Line items ── */}
      <table className="inv-table">
        <thead>
          <tr>
            <th style={{ width: '4%' }}>#</th>
            <th>Description</th>
            <th style={{ textAlign: 'right' }}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {invoice.items.map((item, idx) => (
            <tr key={item.id ?? idx}>
              <td style={{ color: '#999' }}>{idx + 1}</td>
              <td>{item.description}</td>
              <td>{fmtCurrency(item.amount)}</td>
            </tr>
          ))}
          {Number(invoice.discountAmount) > 0 && (
            <tr>
              <td />
              <td style={{ color: '#059669', fontStyle: 'italic' }}>Discount</td>
              <td style={{ color: '#059669' }}>−{fmtCurrency(invoice.discountAmount)}</td>
            </tr>
          )}
        </tbody>
      </table>

      {/* ── Payments + totals + status ── */}
      <div className="inv-bottom-row">
        <div className="inv-payments">
          {invoice.payments?.length > 0 && invoice.payments.map((p, i) => (
            <p key={p.id ?? i}>
              Paid via <strong>{p.paymentMode?.name ?? '—'}</strong>: {fmtCurrency(p.amountPaid)}
            </p>
          ))}
          {invoice.refundReason && (
            <p style={{ color: '#dc2626', marginTop: '4px' }}>
              Refund reason: {invoice.refundReason}
            </p>
          )}
        </div>
        <div className="inv-totals">
          <div className="inv-total-line">
            <span>Total Amount</span>
            <span>{fmtCurrency(invoice.netAmount)}</span>
          </div>
          <div className="inv-status-wrap">
            <span className={`inv-status ${
              invoice.paymentStatus === 'PAID'     ? 'inv-status-paid'     :
              invoice.paymentStatus === 'PARTIAL'  ? 'inv-status-partial'  :
              invoice.paymentStatus === 'REFUNDED' ? 'inv-status-refunded' :
              'inv-status-pending'
            }`}>
              {invoice.paymentStatus === 'PAID'     ? 'PAID'           :
               invoice.paymentStatus === 'PARTIAL'  ? 'PARTIALLY PAID' :
               invoice.paymentStatus === 'REFUNDED' ? 'REFUNDED'       :
               'PENDING'}
            </span>
          </div>
        </div>
      </div>

      {/* ── Footer: billed-by only ── */}
      <div className="inv-footer">
        <span>Billed by: <strong>{billedBy}</strong></span>
        <span>{new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}</span>
      </div>

      <p className="inv-thank">Thank you for choosing us. Wishing you a speedy recovery.</p>
    </div>
  );

  return createPortal(content, document.body);
}
