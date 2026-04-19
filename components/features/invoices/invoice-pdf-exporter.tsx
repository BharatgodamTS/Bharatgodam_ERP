'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { InvoiceData } from '@/lib/invoice/types';

interface InvoicePDFExporterProps {
  invoiceData: InvoiceData;
  fileName?: string;
}

/**
 * React component for generating and downloading invoice PDFs
 */
export default function InvoicePDFExporter({ invoiceData, fileName }: InvoicePDFExporterProps) {
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerateAndDownload = async () => {
    try {
      setIsGenerating(true);
      toast.loading('Generating PDF...');

      const response = await fetch('/api/invoices/generate-pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(invoiceData),
      });

      toast.dismiss();

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate PDF');
      }

      // Get PDF as blob
      const blob = await response.blob();

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const downloadLink = document.createElement('a');
      downloadLink.href = url;
      downloadLink.download = fileName || `${invoiceData.metadata.invoiceNo.replace(/\//g, '_')}.pdf`;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
      window.URL.revokeObjectURL(url);

      toast.success('Invoice downloaded successfully!');
    } catch (error) {
      console.error('PDF generation error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to generate PDF');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Button
      onClick={handleGenerateAndDownload}
      disabled={isGenerating}
      className="flex items-center gap-2"
      variant="default"
    >
      {isGenerating ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          Generating...
        </>
      ) : (
        <>
          <Download className="h-4 w-4" />
          Download Invoice PDF
        </>
      )}
    </Button>
  );
}
