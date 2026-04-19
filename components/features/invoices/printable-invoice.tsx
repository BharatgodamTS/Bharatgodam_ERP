'use client';

import React, { useRef, useState } from 'react';
import { formatWeight } from '@/lib/utils';

type InvoiceItem = {
  whCode: string;
  billFrom: string;
  itemName: string;
  corNo: string;
  billTo: string;
  qty: number;
  weight: number;
  month: string;
  days: number;
  ratePer: number;
  storageChargesPerMonth: number;
  amount: number;
};

type InvoiceData = {
  invoiceNo: string;
  invoiceDate: string;
  customer: {
    name: string;
    address: string;
    city: string;
    state: string;
  };
  items: InvoiceItem[];
  totals: {
    basic: number;
    roundOff: number;
    net: number;
    words: string;
  };
};

const invoiceData: InvoiceData = {
  invoiceNo: 'PWL/25-26/0578',
  invoiceDate: '28/02/2026',
  customer: {
    name: 'VIRAL TRADING',
    address: 'Shop No B-24, New Sardar Market Yard, Gondal',
    city: 'Gondal 360311',
    state: 'Gujarat (24)',
  },
  items: [
    {
      whCode: 'PWS07',
      billFrom: '01/02/2026',
      itemName: 'Guar Seeds',
      corNo: 'COR-3659',
      billTo: '28/02/2026',
      qty: 270,
      weight: 13.92,
      month: 'Feb 2026',
      days: 28,
      ratePer: 70.0,
      storageChargesPerMonth: 70.0,
      amount: 974.4,
    },
    {
      whCode: 'PWS07',
      billFrom: '01/02/2026',
      itemName: 'Guar Seeds',
      corNo: 'COR-3660',
      billTo: '28/02/2026',
      qty: 250,
      weight: 12.65,
      month: 'Feb 2026',
      days: 28,
      ratePer: 70.0,
      storageChargesPerMonth: 70.0,
      amount: 885.5,
    },
    {
      whCode: 'PWS07',
      billFrom: '01/02/2026',
      itemName: 'Guar Seeds',
      corNo: 'COR-3661',
      billTo: '28/02/2026',
      qty: 250,
      weight: 13.2,
      month: 'Feb 2026',
      days: 28,
      ratePer: 70.0,
      storageChargesPerMonth: 70.0,
      amount: 924.0,
    },
  ],
  totals: {
    basic: 2783.9,
    roundOff: 0.1,
    net: 2784.0,
    words: 'Rupees Two Thousand Seven Hundred Eighty Four Only',
  },
};

const formatAmount = (value: number) => value.toFixed(2);

export default function PrintableInvoice() {
  const [isDownloading, setIsDownloading] = useState(false);
  const invoiceRef = useRef<HTMLDivElement>(null);

  const totalQty = invoiceData.items.reduce((sum, item) => sum + item.qty, 0);
  const totalWeight = invoiceData.items.reduce((sum, item) => sum + item.weight, 0);

  const downloadPDF = async () => {
    if (!invoiceRef.current) return;

    setIsDownloading(true);

    try {
      const html2pdfModule = await import('html2pdf.js');
      const html2pdf = html2pdfModule.default ?? html2pdfModule;
      const options = {
        margin: 10,
        filename: 'invoice.pdf',
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      };

      await html2pdf().set(options).from(invoiceRef.current).save();
    } catch (error) {
      console.error('Invoice PDF export failed:', error);
      alert('Unable to generate PDF. Please check console for details.');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 py-8 px-4">
      <div className="flex flex-col items-center gap-4">
        <button
          type="button"
          onClick={downloadPDF}
          disabled={isDownloading}
          className="rounded bg-slate-900 px-5 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-500"
        >
          {isDownloading ? 'Preparing PDF…' : 'Download Invoice PDF'}
        </button>

        <div
          id="invoice-content"
          ref={invoiceRef}
          className="w-[210mm] min-h-[297mm] overflow-hidden rounded border border-slate-300 bg-white px-8 py-8 text-[10px] leading-[1.45] text-slate-900 shadow-2xl"
        >
          <div className="flex flex-col gap-8">
            <header className="flex flex-col gap-4 border-b border-slate-300 pb-4 md:flex-row md:items-start md:justify-between">
              <div className="space-y-2">
                <h1 className="text-2xl font-bold uppercase tracking-tight text-slate-900">POSSIBLE WAREHOUSING LLP</h1>
                <p className="max-w-xl text-[10px] text-slate-700">
                  407, Rotec Corner, 80 Feet Ring Road, Mavdi, Rajkot - 360 004 (Gujarat, India)
                </p>
                <p className="text-[10px] text-slate-700">Email: info@possiblewarehousing.com</p>
                <p className="text-[10px] text-slate-700">Web: www.possiblewarehousing.com</p>
                <p className="text-[10px] text-slate-700">Phone: +91 84900 60049</p>
                <p className="text-[10px] text-slate-700">GSTIN: 24AAWFP7490F1ZN</p>
              </div>
              <div className="rounded border border-slate-300 bg-slate-50 px-4 py-3 text-right shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Invoice</p>
                <p className="mt-3 text-base font-semibold text-slate-900">Invoice No.</p>
                <p className="text-sm text-slate-700">{invoiceData.invoiceNo}</p>
                <p className="mt-4 text-base font-semibold text-slate-900">Invoice Date</p>
                <p className="text-sm text-slate-700">{invoiceData.invoiceDate}</p>
              </div>
            </header>

            <section className="grid gap-4 md:grid-cols-[1fr_auto]">
              <div className="rounded border border-slate-300 bg-slate-50 p-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">To,</p>
                <p className="text-sm font-semibold text-slate-900">{invoiceData.customer.name}</p>
                <p className="text-[10px] text-slate-700">{invoiceData.customer.address}</p>
                <p className="text-[10px] text-slate-700">{invoiceData.customer.city}</p>
                <p className="text-[10px] text-slate-700">{invoiceData.customer.state}</p>
              </div>
              <div className="rounded border border-slate-300 bg-slate-50 p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Reference</p>
                <p className="pt-2 text-[10px] text-slate-700">Warehouse invoice for goods stored</p>
              </div>
            </section>

            <section className="overflow-x-auto">
              <table className="invoice-table min-w-full border-separate border-spacing-0 text-[10px]">
                <thead>
                  <tr className="bg-slate-100 text-left text-[9px] uppercase tracking-[0.15em] text-slate-700">
                    <th className="px-2 py-3 border border-slate-300">WH Code</th>
                    <th className="px-2 py-3 border border-slate-300">Bill From</th>
                    <th className="px-2 py-3 border border-slate-300">Item Name</th>
                    <th className="px-2 py-3 border border-slate-300">COR No.</th>
                    <th className="px-2 py-3 border border-slate-300">Bill To</th>
                    <th className="px-2 py-3 border border-slate-300 text-right">Qty.</th>
                    <th className="px-2 py-3 border border-slate-300 text-right">Weight (MT)</th>
                    <th className="px-2 py-3 border border-slate-300 text-center">Month</th>
                    <th className="px-2 py-3 border border-slate-300 text-center">Days</th>
                    <th className="px-2 py-3 border border-slate-300 text-right">Rate Per</th>
                    <th className="px-2 py-3 border border-slate-300 text-right">Storage Chgs/Month</th>
                    <th className="px-2 py-3 border border-slate-300 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {invoiceData.items.map((item, index) => (
                    <tr key={index} className="break-inside-avoid-page">
                      <td className="border border-slate-300 px-2 py-2">{item.whCode}</td>
                      <td className="border border-slate-300 px-2 py-2">{item.billFrom}</td>
                      <td className="border border-slate-300 px-2 py-2">{item.itemName}</td>
                      <td className="border border-slate-300 px-2 py-2">{item.corNo}</td>
                      <td className="border border-slate-300 px-2 py-2">{item.billTo}</td>
                      <td className="border border-slate-300 px-2 py-2 text-right">{item.qty}</td>
                      <td className="border border-slate-300 px-2 py-2 text-right">{formatWeight(item.weight)}</td>
                      <td className="border border-slate-300 px-2 py-2 text-center">{item.month}</td>
                      <td className="border border-slate-300 px-2 py-2 text-center">{item.days}</td>
                      <td className="border border-slate-300 px-2 py-2 text-right">{formatAmount(item.ratePer)}</td>
                      <td className="border border-slate-300 px-2 py-2 text-right">{formatAmount(item.storageChargesPerMonth)}</td>
                      <td className="border border-slate-300 px-2 py-2 text-right font-semibold">{formatAmount(item.amount)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-100 text-[10px] font-semibold">
                    <td colSpan={5} className="border border-slate-300 px-2 py-3 text-right">Subtotal</td>
                    <td className="border border-slate-300 px-2 py-3 text-right">{totalQty}</td>
                    <td className="border border-slate-300 px-2 py-3 text-right">{formatWeight(totalWeight)}</td>
                    <td colSpan={4} className="border border-slate-300 px-2 py-3"></td>
                    <td className="border border-slate-300 px-2 py-3"></td>
                  </tr>
                </tfoot>
              </table>
            </section>

            <section className="grid gap-4 lg:grid-cols-[2fr_1fr]">
              <div className="rounded border border-slate-300 bg-slate-50 p-4 text-[10px]">
                <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Net Amount in words</p>
                <p className="text-[10px] text-slate-900">{invoiceData.totals.words}</p>
              </div>
              <div className="rounded border border-slate-300 bg-slate-50 p-4 text-[10px]">
                <div className="flex justify-between border-b border-slate-300 pb-2 text-[10px]">
                  <span>Basic Total</span>
                  <span>{formatAmount(invoiceData.totals.basic)}</span>
                </div>
                <div className="flex justify-between border-b border-slate-300 py-2 text-[10px]">
                  <span>Round off</span>
                  <span>{formatAmount(invoiceData.totals.roundOff)}</span>
                </div>
                <div className="flex justify-between pt-2 text-sm font-semibold text-slate-900">
                  <span>Net Amount</span>
                  <span>₹{formatAmount(invoiceData.totals.net)}</span>
                </div>
              </div>
            </section>

            <section className="grid gap-4 lg:grid-cols-[2fr_1fr]">
              <div className="rounded border border-slate-300 bg-slate-50 p-4 text-[10px]">
                <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Bank Details</p>
                <p className="text-[10px] text-slate-800">Kotak Mahindra Bank Ltd</p>
                <p className="text-[10px] text-slate-800">Gymkhana Road, Rajkot</p>
                <p className="text-[10px] text-slate-800">A/c: 3613712285</p>
                <p className="text-[10px] text-slate-800">IFSC: KKBK0002795</p>
              </div>
              <div className="rounded border border-slate-300 bg-slate-50 p-4 text-[10px]">
                <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Terms & Conditions</p>
                <ol className="list-decimal space-y-2 pl-4 text-[10px] text-slate-700">
                  <li>Interest @ 18% p.a. will be charged on overdue invoices.</li>
                  <li>Risk and responsibility ends at our premises.</li>
                  <li>Subject to Rajkot jurisdiction only.</li>
                </ol>
              </div>
            </section>

            <footer className="flex flex-col items-end pt-6">
              <div className="w-full max-w-sm text-right text-[10px] text-slate-700">
                <p>For, Possible Warehousing LLP</p>
                <div className="mt-10 inline-block border-t border-slate-400 pt-2 font-semibold">Authorized Signatory</div>
              </div>
            </footer>
          </div>
        </div>
      </div>

      <style jsx global>{`
        @media print {
          body {
            background: #fff;
            -webkit-print-color-adjust: exact;
          }
          #invoice-content {
            box-shadow: none !important;
            margin: 0 !important;
          }
          .invoice-table th,
          .invoice-table td {
            border-color: #d1d5db !important;
          }
          .break-inside-avoid-page {
            break-inside: avoid-page;
          }
        }

        @page {
          size: A4;
          margin: 10mm;
        }
      `}</style>
    </div>
  );
}
