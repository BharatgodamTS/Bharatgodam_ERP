'use server';

import { MonthlyInvoiceData } from './monthly-invoices';

/**
 * Generate monthly invoice as HTML
 * Can be converted to PDF using puppeteer or similar
 */
export async function generateMonthlyInvoiceHTML(invoice: MonthlyInvoiceData): Promise<string> {
  const companyName = 'Warehouse Management System';
  const companyAddress = '123 Business Street, City, State 12345';
  const contactEmail = 'billing@warehouse.com';
  const contactPhone = '+91 XXXX XXXXXX';

  const periodsList = invoice.periods
    .map(
      (p) => `
    <tr>
      <td style="border: 1px solid #ddd; padding: 10px;">${p.startDate}</td>
      <td style="border: 1px solid #ddd; padding: 10px;">${p.endDate}</td>
      <td style="border: 1px solid #ddd; padding: 10px; text-align: center;">${p.quantityMT.toFixed(2)} MT</td>
      <td style="border: 1px solid #ddd; padding: 10px; text-align: center;">${p.daysTotal}</td>
      <td style="border: 1px solid #ddd; padding: 10px; text-align: right;">₹${p.rentTotal.toLocaleString()}</td>
      <td style="border: 1px solid #ddd; padding: 10px;">${p.status}</td>
    </tr>
  `
    )
    .join('');

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Monthly Invoice - ${invoice.clientName}</title>
      <style>
        * {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        body {
          background-color: #f5f5f5;
          padding: 20px;
        }
        .invoice-container {
          background-color: white;
          padding: 40px;
          border-radius: 8px;
          max-width: 900px;
          margin: 0 auto;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 40px;
          border-bottom: 2px solid #2563eb;
          padding-bottom: 20px;
        }
        .company-info h1 {
          font-size: 24px;
          color: #1e293b;
          margin-bottom: 5px;
        }
        .company-info p {
          color: #64748b;
          font-size: 13px;
          margin: 2px 0;
        }
        .invoice-meta {
          text-align: right;
        }
        .invoice-meta h2 {
          font-size: 20px;
          color: #2563eb;
          margin-bottom: 10px;
        }
        .invoice-meta p {
          color: #64748b;
          font-size: 13px;
          margin: 2px 0;
        }
        .client-section {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 40px;
          margin-bottom: 40px;
          padding: 20px;
          background-color: #f8fafc;
          border-radius: 6px;
        }
        .client-section h3 {
          font-size: 12px;
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 8px;
        }
        .client-section p {
          color: #1e293b;
          font-size: 14px;
          margin: 4px 0;
        }
        .periods-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 30px;
        }
        .periods-table th {
          background-color: #1e293b;
          color: white;
          padding: 12px;
          text-align: left;
          font-weight: 600;
          font-size: 13px;
        }
        .periods-table td {
          border: 1px solid #ddd;
          padding: 10px;
          font-size: 13px;
        }
        .periods-table tr:nth-child(even) {
          background-color: #f8fafc;
        }
        .summary-section {
          margin-top: 30px;
          display: grid;
          grid-template-columns: auto auto;
          gap: 20px;
          justify-content: flex-end;
        }
        .summary-line {
          display: grid;
          grid-template-columns: 200px 150px;
          gap: 20px;
          align-items: center;
          padding: 8px 0;
          border-bottom: 1px solid #e2e8f0;
        }
        .summary-line:last-child {
          border-bottom: 2px solid #2563eb;
          padding-bottom: 10px;
          margin-bottom: 10px;
        }
        .summary-line.total {
          font-weight: 600;
          font-size: 16px;
          color: #1e293b;
        }
        .summary-label {
          text-align: right;
          color: #64748b;
          font-size: 14px;
          font-weight: 500;
        }
        .summary-value {
          text-align: right;
          font-weight: 600;
          color: #1e293b;
        }
        .total-due {
          color: #dc2626;
          font-size: 18px;
        }
        .footer {
          margin-top: 50px;
          padding-top: 20px;
          border-top: 1px solid #e2e8f0;
          text-align: center;
          color: #64748b;
          font-size: 12px;
        }
        .footer p {
          margin: 4px 0;
        }
        .page-break {
          page-break-after: always;
        }
      </style>
    </head>
    <body>
      <div class="invoice-container">
        <!-- Header -->
        <div class="header">
          <div class="company-info">
            <h1>${companyName}</h1>
            <p>${companyAddress}</p>
            <p>Email: ${contactEmail}</p>
            <p>Phone: ${contactPhone}</p>
          </div>
          <div class="invoice-meta">
            <h2>MONTHLY INVOICE</h2>
            <p><strong>Invoice Date:</strong> ${invoice.invoiceDate}</p>
            <p><strong>Month:</strong> ${invoice.month} ${invoice.year}</p>
            <p><strong>Account ID:</strong> ${invoice.bookingId}</p>
          </div>
        </div>

        <!-- Client Info -->
        <div class="client-section">
          <div>
            <h3>Bill To</h3>
            <p><strong>${invoice.clientName}</strong></p>
            <p>${invoice.warehouseName}</p>
          </div>
          <div>
            <h3>Account Details</h3>
            <p><strong>Billing Period:</strong> ${invoice.month} ${invoice.year}</p>
            <p><strong>Account ID:</strong> ${invoice.bookingId}</p>
          </div>
        </div>

        <!-- Periods Table -->
        <table class="periods-table">
          <thead>
            <tr>
              <th>From Date</th>
              <th>To Date</th>
              <th>Quantity (MT)</th>
              <th>Days</th>
              <th>Amount (₹)</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${periodsList}
          </tbody>
        </table>

        <!-- Summary Section -->
        <div class="summary-section">
          <div class="summary-line">
            <div class="summary-label">Previous Balance:</div>
            <div class="summary-value">₹${(invoice.previousBalance || 0).toLocaleString()}</div>
          </div>
          <div class="summary-line">
            <div class="summary-label">Monthly Storage Rent:</div>
            <div class="summary-value">₹${(invoice.totalRent || 0).toLocaleString()}</div>
          </div>
          <div class="summary-line">
            <div class="summary-label">Payments Received:</div>
            <div class="summary-value">-₹${(invoice.currentPayments || 0).toLocaleString()}</div>
          </div>
          <div class="summary-line total">
            <div class="summary-label">Outstanding Balance:</div>
            <div class="summary-value total-due">₹${Math.max(0, invoice.newBalance || 0).toLocaleString()}</div>
          </div>
        </div>

        <!-- Footer -->
        <div class="footer">
          <p>This is an automatically generated invoice based on warehouse storage transactions.</p>
          <p>For inquiries, please contact: ${contactEmail}</p>
          <p>Generated on: ${new Date().toLocaleDateString()}</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Generate invoice PDF using server-side rendering
 * Returns buffer that can be sent to client for download
 */
export async function generateMonthlyInvoicePDF(invoice: MonthlyInvoiceData): Promise<Buffer> {
  try {
    // Dynamic import for puppeteer to avoid bundling issues
    const puppeteer = await import('puppeteer');

    const html = await generateMonthlyInvoiceHTML(invoice);

    // Launch browser
    const browser = await puppeteer.default.launch({
      headless: true,
    });

    const page = await browser.newPage();

    // Set content and generate PDF
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdfData = await page.pdf({
      format: 'A4',
      margin: {
        top: '10mm',
        right: '10mm',
        bottom: '10mm',
        left: '10mm',
      },
    });

    await browser.close();

    return Buffer.from(pdfData);
  } catch (error) {
    console.error('PDF generation error:', error);
    // If puppeteer fails, return HTML as fallback
    throw new Error(
      'PDF generation not available. Please check server configuration.'
    );
  }
}

/**
 * Generate PDF and return download URL
 */
export async function generateInvoicePDFAndSave(
  invoice: MonthlyInvoiceData
): Promise<{
  success: boolean;
  url?: string;
  filename?: string;
  message: string;
}> {
  try {
    const pdfBuffer = await generateMonthlyInvoicePDF(invoice);

    // Create filename
    const filename = `Invoice_${invoice.clientName.replace(/\s+/g, '_')}_${invoice.month}_${invoice.year}_${Date.now()}.pdf`;

    return {
      success: true,
      url: `/api/invoices/download?filename=${encodeURIComponent(filename)}`,
      filename,
      message: 'Invoice PDF generated successfully',
    };
  } catch (error: any) {
    return {
      success: false,
      message: error.message || 'Failed to generate invoice PDF',
    };
  }
}
