/**
 * Invoice Generation Server Action
 * Example usage for generating invoices in a Next.js application
 */

'use server';

import {
  generateInvoicePDF,
  closeBrowser,
  InvoiceData,
  InvoiceValidator,
} from '@/lib/invoice';
import { writeFile } from 'fs/promises';
import { join } from 'path';

/**
 * Generate a single invoice PDF
 * Can be called from client components as a server action
 */
export async function generateInvoice(invoiceData: InvoiceData): Promise<Buffer> {
  try {
    const validator = new InvoiceValidator();
    const validation = validator.validate(invoiceData);

    if (!validation.valid) {
      throw new Error(`Validation failed: ${validation.errors.map((e) => e.message).join(', ')}`);
    }

    const pdfBuffer = await generateInvoicePDF(invoiceData);
    return pdfBuffer;
  } catch (error) {
    console.error('Invoice generation failed:', error);
    throw new Error(`Failed to generate invoice: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Generate invoice and save to the public directory
 * Returns the URL to download
 */
export async function generateAndSaveInvoice(invoiceData: InvoiceData): Promise<string> {
  try {
    const pdfBuffer = await generateInvoice(invoiceData);

    // Save to public directory for download
    const publicDir = join(process.cwd(), 'public', 'invoices');
    const fileName = `${invoiceData.metadata.invoiceNo.replace(/\//g, '-')}_${Date.now()}.pdf`;
    const filePath = join(publicDir, fileName);

    await writeFile(filePath, pdfBuffer);

    // Return public URL
    return `/invoices/${fileName}`;
  } catch (error) {
    console.error('Failed to generate and save invoice:', error);
    throw error;
  }
}

/**
 * Example API route handler
 * Usage: POST /api/invoices/generate
 * Body: { invoiceData: InvoiceData }
 */
export async function handleGenerateInvoiceAPI(invoiceData: InvoiceData): Promise<Buffer> {
  try {
    const pdfBuffer = await generateInvoice(invoiceData);
    return pdfBuffer;
  } catch (error) {
    throw error;
  } finally {
    // Close browser when done to free resources
    await closeBrowser();
  }
}
