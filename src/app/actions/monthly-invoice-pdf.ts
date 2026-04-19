'use server';

interface MonthlyInvoice {
  bookingId: string;
  clientName: string;
  month: string;
  year: number;
  periods: Array<{
    startDate: string;
    endDate: string;
    quantityMT: number;
    daysTotal: number;
    rentTotal: number;
    status: string;
    commodityName: string;
  }>;
  warehouseId?: string;
  warehouseName?: string;
  totalRent: number;
  previousBalance?: number;
}

export async function generateMonthlyInvoiceHTML(invoice: MonthlyInvoice): Promise<string> {
  const totalAmount = invoice.totalRent || 0;
  const previousBalance = invoice.previousBalance || 0;
  const grandTotal = totalAmount + previousBalance;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Monthly Invoice - ${invoice.clientName}</title>
    <style>
        body {
            font-family: 'Arial', sans-serif;
            margin: 0;
            padding: 20px;
            background-color: #f8f9fa;
            color: #333;
        }
        .invoice-container {
            max-width: 800px;
            margin: 0 auto;
            background: white;
            border-radius: 8px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            overflow: hidden;
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            text-align: center;
        }
        .header h1 {
            margin: 0;
            font-size: 2.5em;
            font-weight: 300;
        }
        .header p {
            margin: 10px 0 0 0;
            opacity: 0.9;
            font-size: 1.1em;
        }
        .invoice-details {
            padding: 30px;
            border-bottom: 1px solid #eee;
        }
        .detail-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 15px;
        }
        .detail-label {
            font-weight: bold;
            color: #666;
        }
        .detail-value {
            color: #333;
        }
        .periods-section {
            padding: 30px;
        }
        .section-title {
            font-size: 1.5em;
            color: #333;
            margin-bottom: 20px;
            border-bottom: 2px solid #667eea;
            padding-bottom: 10px;
        }
        .periods-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
        }
        .periods-table th,
        .periods-table td {
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid #ddd;
        }
        .periods-table th {
            background-color: #f8f9fa;
            font-weight: 600;
            color: #333;
        }
        .periods-table tr:hover {
            background-color: #f8f9fa;
        }
        .total-section {
            background: #f8f9fa;
            padding: 30px;
            border-top: 2px solid #667eea;
        }
        .total-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 1.2em;
            margin-bottom: 10px;
        }
        .grand-total {
            font-size: 1.8em;
            font-weight: bold;
            color: #667eea;
            border-top: 2px solid #ddd;
            padding-top: 15px;
            margin-top: 15px;
        }
        .footer {
            background: #333;
            color: white;
            padding: 20px;
            text-align: center;
            font-size: 0.9em;
        }
        .footer p {
            margin: 5px 0;
        }
        .amount {
            font-weight: bold;
            color: #28a745;
        }
        .currency {
            font-size: 0.9em;
        }
        @media print {
            body {
                background: white;
            }
            .invoice-container {
                box-shadow: none;
            }
        }
    </style>
</head>
<body>
    <div class="invoice-container">
        <!-- Header -->
        <div class="header">
            <h1>WAREHOUSE STORAGE INVOICE</h1>
            <p>Monthly Billing Statement</p>
        </div>

        <!-- Invoice Details -->
        <div class="invoice-details">
            <div class="detail-row">
                <span class="detail-label">Client:</span>
                <span class="detail-value">${invoice.clientName}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Invoice Period:</span>
                <span class="detail-value">${invoice.month} ${invoice.year}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Warehouse:</span>
                <span class="detail-value">${invoice.warehouseName || 'General'}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Invoice ID:</span>
                <span class="detail-value">${invoice.bookingId}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Generated Date:</span>
                <span class="detail-value">${new Date().toLocaleDateString()}</span>
            </div>
        </div>

        <!-- Billing Periods -->
        <div class="periods-section">
            <h2 class="section-title">Storage Billing Details</h2>
            <table class="periods-table">
                <thead>
                    <tr>
                        <th>Commodity</th>
                        <th>Period Start</th>
                        <th>Period End</th>
                        <th>Quantity (MT)</th>
                        <th>Days</th>
                        <th>Amount (₹)</th>
                    </tr>
                </thead>
                <tbody>
                    ${invoice.periods.map(period => `
                        <tr>
                            <td>${period.commodityName}</td>
                            <td>${new Date(period.startDate).toLocaleDateString()}</td>
                            <td>${new Date(period.endDate).toLocaleDateString()}</td>
                            <td>${period.quantityMT.toFixed(2)}</td>
                            <td>${period.daysTotal}</td>
                            <td class="amount">₹${period.rentTotal.toLocaleString('en-IN')}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>

        <!-- Total Section -->
        <div class="total-section">
            <div class="total-row">
                <span>Current Month Charges:</span>
                <span class="amount">₹${totalAmount.toLocaleString('en-IN')}</span>
            </div>
            ${previousBalance > 0 ? `
            <div class="total-row">
                <span>Previous Balance:</span>
                <span class="amount">₹${previousBalance.toLocaleString('en-IN')}</span>
            </div>
            ` : ''}
            <div class="total-row grand-total">
                <span>Total Amount Due:</span>
                <span class="amount">₹${grandTotal.toLocaleString('en-IN')}</span>
            </div>
        </div>

        <!-- Footer -->
        <div class="footer">
            <p><strong>Warehouse Management System</strong></p>
            <p>Generated on ${new Date().toLocaleString()}</p>
            <p>Thank you for your business!</p>
        </div>
    </div>
</body>
</html>`;

  return html;
}