import { InvoiceData } from './types';
import { formatCurrency } from './formatters';

/**
 * Generates a summary HTML for invoice (single line summary)
 */
export function generateInvoiceSummaryHTML(data: InvoiceData): string {
  // Get all unique commodity names
  const commodityNames = Array.from(new Set(data.lineItems.map(item => item.itemName))).join(', ');
  // Calculate total amount
  const totalAmount = data.lineItems.reduce((sum, item) => sum + (item.amount || 0), 0);
  // Last inventory at end of month (assume last line item quantity)
  const lastInventory = data.lineItems.length > 0 ? data.lineItems[data.lineItems.length - 1].quantity : 0;

  return `
  <!-- SUMMARY TEST: If you see this, the summary PDF code is updated -->
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="UTF-8">
    <title>Invoice ${data.metadata.invoiceNo}</title>
    <style>
      body { font-family: Arial, sans-serif; font-size: 11pt; color: #333; margin: 0; padding: 30px; }
      .container { max-width: 700px; margin: 0 auto; background: #fff; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.07); padding: 30px; }
      .header { text-align: center; margin-bottom: 30px; }
      .summary { font-size: 1.2em; margin-bottom: 18px; }
      .inventory { font-size: 1.1em; color: #555; margin-bottom: 18px; }
      .footer { text-align: center; color: #888; font-size: 0.95em; margin-top: 40px; }
      .amount { font-weight: bold; color: #28a745; }
    </style>
  </head>
  <body>
    <div class="container">
        <div style="color: red; font-weight: bold; text-align: center;">SUMMARY TEST</div>
      <div class="header">
        <h1>WAREHOUSE STORAGE INVOICE</h1>
        <p>Monthly Billing Statement</p>
      </div>
      <div class="summary">
        Storage charge for <strong>${commodityNames}</strong>: <span class="amount">${formatCurrency(totalAmount, false)}</span>
      </div>
      <div class="inventory">
        Last inventory available at end of month: <strong>${lastInventory.toFixed(2)} MT</strong>
      </div>
      <div class="footer">
        <p>Generated on ${new Date().toLocaleDateString()}</p>
        <p>Thank you for your business!</p>
      </div>
    </div>
  </body>
  </html>
  `;
}
