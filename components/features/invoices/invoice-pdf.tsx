'use client';

import React from 'react';
import { toast } from 'react-hot-toast';

// Invoice PDF generation disabled - use html2pdf.js or puppeteer instead
export const InvoicePDF: React.FC<any> = ({ invoice }) => {
  const handleGeneratePDF = () => {
    toast('PDF generation is currently unavailable. Please use the export feature instead.');
  };

  return (
    <div className="p-4 text-center">
      <p className="text-slate-600 mb-4">PDF Preview Unavailable</p>
      <button
        onClick={handleGeneratePDF}
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
      >
        Export as PDF
      </button>
    </div>
  );
};

export default InvoicePDF;
