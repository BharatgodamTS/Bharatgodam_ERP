/**
 * Invoice Validators
 * Validates invoice data for consistency and completeness
 */

import { InvoiceData } from './types';

export interface ValidationError {
  field: string;
  message: string;
}

export class InvoiceValidator {
  private errors: ValidationError[] = [];

  /**
   * Validates complete invoice data
   */
  validate(data: InvoiceData): { valid: boolean; errors: ValidationError[] } {
    this.errors = [];

    this.validateCompanyInfo(data.company);
    this.validateCustomerInfo(data.customer);
    this.validateMetadata(data.metadata);
    this.validateLineItems(data.lineItems);
    this.validateFinancial(data.financial, data.lineItems);
    this.validateBankDetails(data.bankDetails);

    return {
      valid: this.errors.length === 0,
      errors: this.errors,
    };
  }

  private validateCompanyInfo(company: any) {
    if (!company.name || company.name.trim() === '') {
      this.errors.push({ field: 'company.name', message: 'Company name is required' });
    }
    if (!company.gstin || company.gstin.trim() === '') {
      this.errors.push({ field: 'company.gstin', message: 'GSTIN is required' });
    }
    if (!this.isValidGSTIN(company.gstin)) {
      this.errors.push({ field: 'company.gstin', message: 'Invalid GSTIN format' });
    }
  }

  private validateCustomerInfo(customer: any) {
    if (!customer.name || customer.name.trim() === '') {
      this.errors.push({ field: 'customer.name', message: 'Customer name is required' });
    }
    if (!customer.city || customer.city.trim() === '') {
      this.errors.push({ field: 'customer.city', message: 'Customer city is required' });
    }
  }

  private validateMetadata(metadata: any) {
    if (!metadata.invoiceNo || metadata.invoiceNo.trim() === '') {
      this.errors.push({ field: 'metadata.invoiceNo', message: 'Invoice number is required' });
    }
    if (!metadata.invoiceDate || !this.isValidDateFormat(metadata.invoiceDate)) {
      this.errors.push({ field: 'metadata.invoiceDate', message: 'Invoice date must be in DD/MM/YYYY format' });
    }
  }

  private validateLineItems(items: any[]) {
    if (!items || items.length === 0) {
      this.errors.push({ field: 'lineItems', message: 'At least one line item is required' });
      return;
    }

    items.forEach((item, index) => {
      if (!item.itemName || item.itemName.trim() === '') {
        this.errors.push({ field: `lineItems[${index}].itemName`, message: 'Item name is required' });
      }
      if (item.quantity < 0) {
        this.errors.push({ field: `lineItems[${index}].quantity`, message: 'Quantity cannot be negative' });
      }
      if (item.weight < 0) {
        this.errors.push({ field: `lineItems[${index}].weight`, message: 'Weight cannot be negative' });
      }
      if (item.amount < 0) {
        this.errors.push({ field: `lineItems[${index}].amount`, message: 'Amount cannot be negative' });
      }
    });
  }

  private validateFinancial(financial: any, lineItems: any[]) {
    if (!financial) {
      this.errors.push({ field: 'financial', message: 'Financial summary is required' });
      return;
    }

    const itemsTotal = lineItems.reduce((sum, item) => sum + item.amount, 0);
    const expectedTotal = itemsTotal + financial.roundOff;

    if (Math.abs(financial.netAmount - expectedTotal) > 0.01) {
      this.errors.push({
        field: 'financial.netAmount',
        message: `Net amount (${financial.netAmount}) does not match items total (${itemsTotal}) + roundOff (${financial.roundOff})`,
      });
    }

    if (Math.abs(financial.basicTotal - itemsTotal) > 0.01) {
      this.errors.push({
        field: 'financial.basicTotal',
        message: `Basic total (${financial.basicTotal}) does not match items total (${itemsTotal})`,
      });
    }
  }

  private validateBankDetails(bankDetails: any) {
    if (!bankDetails.bankName || bankDetails.bankName.trim() === '') {
      this.errors.push({ field: 'bankDetails.bankName', message: 'Bank name is required' });
    }
    if (!bankDetails.accountNumber || bankDetails.accountNumber.trim() === '') {
      this.errors.push({ field: 'bankDetails.accountNumber', message: 'Account number is required' });
    }
    if (!bankDetails.ifscCode || !this.isValidIFSC(bankDetails.ifscCode)) {
      this.errors.push({ field: 'bankDetails.ifscCode', message: 'Invalid IFSC code format' });
    }
  }

  private isValidGSTIN(gstin: string): boolean {
    const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
    return gstinRegex.test(gstin);
  }

  private isValidIFSC(ifsc: string): boolean {
    const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
    return ifscRegex.test(ifsc);
  }

  private isValidDateFormat(dateString: string): boolean {
    const dateRegex = /^(0[1-9]|[12][0-9]|3[01])\/(0[1-9]|1[012])\/\d{4}$/;
    return dateRegex.test(dateString);
  }
}
