/**
 * Invoice PDF Generator
 * Converts HTML invoice templates to professional PDF using Puppeteer
 */

import puppeteer, { Browser } from 'puppeteer';
import { InvoiceData } from './types';
import { generateInvoiceHTML } from './html-generator';
import { InvoiceValidator } from './validators';
import fs from 'fs/promises';
import path from 'path';

let browserInstance: Browser | null = null;

/**
 * Get or create a singleton browser instance for performance
 */
async function getBrowser(): Promise<Browser> {
  if (!browserInstance) {
    browserInstance = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
  }
  return browserInstance;
}

/**
 * Closes the browser instance when done
 */
export async function closeBrowser(): Promise<void> {
  if (browserInstance) {
    await browserInstance.close();
    browserInstance = null;
  }
}

/**
 * Main function to generate PDF from invoice data
 */
export async function generateInvoicePDF(
  invoiceData: InvoiceData,
  outputPath?: string
): Promise<Buffer> {
  try {
    // Validate invoice data
    const validator = new InvoiceValidator();
    const validation = validator.validate(invoiceData);

    if (!validation.valid) {
      const errors = validation.errors.map((e) => `${e.field}: ${e.message}`).join('\n');
      throw new Error(`Invoice validation failed:\n${errors}`);
    }

    // Generate HTML
    const html = generateInvoiceHTML(invoiceData);

    // Launch browser and generate PDF
    const browser = await getBrowser();
    const page = await browser.newPage();

    // Set content and wait for rendering
    await page.setContent(html, { waitUntil: 'networkidle0' });

    // Generate PDF with precise formatting
    const rawPdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '10mm', right: '10mm', bottom: '10mm', left: '10mm' },
    });

    await page.close();

    const pdfBuffer = Buffer.from(rawPdf);

    // Save to file if path provided
    if (outputPath) {
      await fs.writeFile(outputPath, pdfBuffer);
      console.log(`✓ Invoice PDF generated: ${outputPath}`);
    }

    return pdfBuffer;
  } catch (error) {
    console.error('PDF Generation Error:', error);
    throw error;
  }
}

/**
 * Generate multiple invoices in batch
 */
export async function generateInvoicesPDF(
  invoicesData: InvoiceData[],
  outputDirectory?: string
): Promise<Map<string, Buffer>> {
  const results = new Map<string, Buffer>();

  for (const invoiceData of invoicesData) {
    try {
      let outputPath: string | undefined;
      if (outputDirectory) {
        const filename = `${invoiceData.metadata.invoiceNo.replace(/\//g, '_')}.pdf`;
        outputPath = path.join(outputDirectory, filename);
      }

      const pdfBuffer = await generateInvoicePDF(invoiceData, outputPath);
      results.set(invoiceData.metadata.invoiceNo, pdfBuffer);
    } catch (error) {
      console.error(`Failed to generate invoice ${invoiceData.metadata.invoiceNo}:`, error);
    }
  }

  return results;
}

/**
 * Utility to generate invoice and save directly
 */
export async function saveInvoicePDF(invoiceData: InvoiceData, filePath: string): Promise<void> {
  await generateInvoicePDF(invoiceData, filePath);
}
