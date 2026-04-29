import { createPortal } from 'react-dom';
import khcLogo from '../assets/KHC-logo.svg';

const HOSPITAL_NAME  = 'Karunya Hrudayalaya Cardiac Center';
const HOSPITAL_ADDR  = 'Cardiac Care, Excellence in Every Beat';

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
  if (!invoice) return null;

  const invoiceType = invoice.invoiceType ?? 'CONSULTATION';
  const receiptTitle = INVOICE_TITLES[invoiceType] ?? 'OPD Receipt';

  const patientName = visit?.patient
    ? `${visit.patient.firstName}${visit.patient.lastName ? ` ${visit.patient.lastName}` : ''}`
    : `${invoice.patient?.firstName ?? ''}${invoice.patient?.lastName ? ` ${invoice.patient.lastName}` : ''}`;

  const uhid     = visit?.patient?.uhid ?? invoice.patient?.uhid ?? '—';
  const opNumber = visit?.opNumber ?? invoice.visit?.opNumber ?? '—';

  const content = (
    <div className="invoice-print-root" style={{ display: 'none' }}>
      <style>{`
        @media print {
          @page { size: A5; margin: 10mm; }
          body > * { display: none !important; }
          .invoice-print-root {
            display: block !important;
            font-family: Arial, Helvetica, system-ui, -apple-system, "Segoe UI", sans-serif;
            color: #111;
            font-size: 11pt;
          }
          .no-print { display: none !important; }
        }
        .invoice-print-root {
          width: 148mm;
          padding: 0;
          font-family: Arial, Helvetica, system-ui, -apple-system, "Segoe UI", sans-serif;
        }
        .inv-header {
          text-align: center;
          border-bottom: 2px solid #1a1a2e;
          padding-bottom: 8px;
          margin-bottom: 10px;
        }
        .inv-logo {
          display: block;
          margin: 0 auto 6px;
          width: 60mm;
          max-width: 80%;
          height: auto;
        }
        .inv-hospital-name {
          font-size: 14pt;
          font-weight: bold;
          color: #1a1a2e;
          letter-spacing: 0.5px;
          margin: 0;
        }
        .inv-hospital-sub {
          font-size: 8pt;
          color: #555;
          margin: 2px 0 0;
          font-style: italic;
        }
        .inv-title {
          font-size: 10pt;
          font-weight: bold;
          text-align: center;
          letter-spacing: 1.5px;
          text-transform: uppercase;
          margin: 8px 0;
          color: #1a1a2e;
        }
        .inv-meta {
          display: flex;
          justify-content: space-between;
          font-size: 8.5pt;
          border: 1px solid #ddd;
          border-radius: 4px;
          padding: 6px 10px;
          background: #f9f9f9;
          margin-bottom: 10px;
        }
        .inv-meta-col { display: flex; flex-direction: column; gap: 2px; }
        .inv-meta-label { color: #666; font-size: 7.5pt; }
        .inv-meta-val { font-weight: bold; }
        .inv-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 9pt;
          margin-bottom: 8px;
        }
        .inv-table th {
          background: #1a1a2e;
          color: white;
          padding: 5px 8px;
          text-align: left;
          font-size: 8pt;
          font-weight: bold;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .inv-table th:last-child { text-align: right; }
        .inv-table td {
          padding: 5px 8px;
          border-bottom: 1px solid #eee;
          vertical-align: top;
        }
        .inv-table td:last-child { text-align: right; font-weight: 600; }
        .inv-table tr:last-child td { border-bottom: none; }
        .inv-total-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-top: 2px solid #1a1a2e;
          padding: 8px 8px 4px;
          font-size: 11pt;
          font-weight: bold;
        }
        .inv-total-label { color: #1a1a2e; }
        .inv-total-amt { font-size: 13pt; color: #1a1a2e; }
        .inv-status {
          text-align: center;
          font-size: 8pt;
          color: #059669;
          font-weight: bold;
          letter-spacing: 1px;
          text-transform: uppercase;
          border: 1.5px solid #059669;
          border-radius: 20px;
          display: inline-block;
          padding: 2px 14px;
          margin: 4px auto 10px;
        }
        .inv-status-wrap { text-align: center; }
        .inv-footer {
          margin-top: 16px;
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          font-size: 8pt;
        }
        .inv-footer-note { color: #666; font-style: italic; max-width: 55%; }
        .inv-sig { text-align: right; }
        .inv-sig-line {
          border-top: 1px solid #333;
          width: 100px;
          margin: 0 0 3px auto;
        }
        .inv-sig-label { font-size: 7.5pt; color: #555; }
        .inv-thank { text-align: center; font-size: 7.5pt; color: #888; margin-top: 10px; font-style: italic; }
      `}</style>

      {/* Header */}
      <div className="inv-header">
        <img src={khcLogo} alt={HOSPITAL_NAME} className="inv-logo" />
        <p className="inv-hospital-name">{HOSPITAL_NAME}</p>
        <p className="inv-hospital-sub">{HOSPITAL_ADDR}</p>
      </div>

      <p className="inv-title">{receiptTitle}</p>

      {/* Invoice meta */}
      <div className="inv-meta">
        <div className="inv-meta-col">
          <span className="inv-meta-label">Invoice No.</span>
          <span className="inv-meta-val">{invoice.invoiceNumber}</span>
          <span className="inv-meta-label" style={{ marginTop: '4px' }}>Date</span>
          <span className="inv-meta-val">{fmtDate(invoice.invoiceDate?.split?.('T')[0] ?? invoice.invoiceDate)}</span>
        </div>
        <div className="inv-meta-col" style={{ textAlign: 'right' }}>
          <span className="inv-meta-label">Patient</span>
          <span className="inv-meta-val">{patientName}</span>
          <span className="inv-meta-label" style={{ marginTop: '4px' }}>UHID · OP#</span>
          <span className="inv-meta-val">{uhid} · {opNumber}</span>
        </div>
      </div>

      {/* Line items */}
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
              <td style={{ color: '#888' }}>{idx + 1}</td>
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

      {/* Total */}
      <div className="inv-total-row">
        <span className="inv-total-label">Total Amount</span>
        <span className="inv-total-amt">{fmtCurrency(invoice.netAmount)}</span>
      </div>

      {/* Payment status */}
      <div className="inv-status-wrap" style={{ marginTop: '6px' }}>
        <span className="inv-status">
          {invoice.paymentStatus === 'PAID' ? 'PAID' :
           invoice.paymentStatus === 'PARTIAL' ? 'PARTIALLY PAID' : 'PENDING'}
        </span>
      </div>

      {/* Payments recorded */}
      {invoice.payments?.length > 0 && (
        <div style={{ fontSize: '8pt', color: '#444', margin: '4px 8px' }}>
          {invoice.payments.map((p, i) => (
            <div key={p.id ?? i} style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Paid via {p.paymentMode?.name ?? '—'}</span>
              <span style={{ fontWeight: 600 }}>{fmtCurrency(p.amountPaid)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="inv-footer">
        <div className="inv-footer-note">
          This is a computer-generated receipt and does not require a physical signature.
        </div>
        <div className="inv-sig">
          <div className="inv-sig-line" />
          <div className="inv-sig-label">Authorised Signatory</div>
        </div>
      </div>

      <p className="inv-thank">Thank you for choosing {HOSPITAL_NAME}</p>
    </div>
  );

  return createPortal(content, document.body);
}
