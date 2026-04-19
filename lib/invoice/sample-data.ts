/**
 * Sample Invoice Data
 * Example invoice matching "POSSIBLE WAREHOUSING LLP" format
 */

import { InvoiceData } from './types';

export const sampleInvoiceData: InvoiceData = {
  company: {
    name: 'POSSIBLE WAREHOUSING LLP',
    address: '123 Warehouse Complex, Industrial Area, Mumbai - 400088',
    email: 'info@possiblewarehousing.com',
    website: 'www.possiblewarehousing.com',
    phone: '+91-22-XXXX-XXXX',
    gstin: '24AAWFP7490F1ZN',
  },

  customer: {
    name: 'VIRAL TRADING',
    shopNo: 'Shop No. 15-16',
    area: 'Vegetable Market Yard',
    marketYard: 'Central Market Yard',
    city: 'Mumbai',
    district: 'Mumbai',
    state: 'Maharashtra',
    pincode: '400001',
    contact: '+91-98XX-XX1234',
  },

  metadata: {
    invoiceNo: 'PWL/25-26/0578',
    invoiceDate: '28/02/2026',
    gstin: '24AAWFP7490F1ZN',
  },

  lineItems: [
    {
      whCode: 'WHC-001',
      billFrom: 'Warehouse 1',
      itemName: 'Onions Storage',
      corNo: 'COR-12345',
      billTo: 'Bill Location 1',
      quantity: 250,
      weight: 12.5,
      month: 'Feb-2026',
      days: 28,
      ratePerUnit: 50.0,
      storageChargesPerMonth: 1500.0,
      amount: 1250.0,
    },
    {
      whCode: 'WHC-002',
      billFrom: 'Warehouse 2',
      itemName: 'Potatoes Storage',
      corNo: 'COR-12346',
      billTo: 'Bill Location 2',
      quantity: 350,
      weight: 22.64,
      month: 'Feb-2026',
      days: 28,
      ratePerUnit: 45.0,
      storageChargesPerMonth: 1350.0,
      amount: 1575.5,
    },
    {
      whCode: 'WHC-003',
      billFrom: 'Warehouse 3',
      itemName: 'Garlic Storage',
      corNo: 'COR-12347',
      billTo: 'Bill Location 3',
      quantity: 395,
      weight: 14.97,
      month: 'Feb-2026',
      days: 28,
      ratePerUnit: 55.0,
      storageChargesPerMonth: 1650.0,
      amount: 682.5,
    },
  ],

  financial: {
    basicTotal: 3508.0,
    roundOff: -0.5,
    netAmount: 3507.5,
  },

  bankDetails: {
    bankName: 'Kotak Mahindra Bank',
    branchName: 'Mumbai - Fort Branch',
    accountNumber: '1234567890123456',
    ifscCode: 'KKBK0000001',
  },

  termsAndConditions: [
    {
      title: 'Interest & Charges',
      description: 'Late payment will attract interest at 18% p.a. or as per contract terms.',
    },
    {
      title: 'Risk & Liability',
      description: 'Goods are stored at the risk and cost of the customer. Possible Warehousing LLP is not responsible for any loss or damage beyond its control.',
    },
    {
      title: 'Jurisdiction',
      description: 'All disputes arising out of this invoice shall be subject to the jurisdiction of the Courts at Mumbai.',
    },
  ],

  authorizedBy: 'Raj Kumar',
  notes: 'Payment terms: Net 30 days from invoice date. Please reference invoice number in your payment.',
};

/**
 * Sample invoice with different data
 */
export const sampleInvoiceData2: InvoiceData = {
  company: {
    name: 'POSSIBLE WAREHOUSING LLP',
    address: '123 Warehouse Complex, Industrial Area, Mumbai - 400088',
    email: 'info@possiblewarehousing.com',
    website: 'www.possiblewarehousing.com',
    phone: '+91-22-XXXX-XXXX',
    gstin: '24AAWFP7490F1ZN',
  },

  customer: {
    name: 'FRESH MERCHANTS CORPORATION',
    shopNo: 'Shop No. 25-26',
    area: 'Fruit Market Yard',
    marketYard: 'North Market Complex',
    city: 'Pune',
    district: 'Pune',
    state: 'Maharashtra',
    pincode: '411001',
  },

  metadata: {
    invoiceNo: 'PWL/25-26/0579',
    invoiceDate: '01/03/2026',
  },

  lineItems: [
    {
      whCode: 'WHC-004',
      billFrom: 'Cold Storage 1',
      itemName: 'Mangoes - Cold Storage',
      corNo: 'COR-12348',
      billTo: 'Pune Facility',
      quantity: 500,
      weight: 20.5,
      month: 'Mar-2026',
      days: 31,
      ratePerUnit: 60.0,
      storageChargesPerMonth: 2000.0,
      amount: 2000.0,
    },
    {
      whCode: 'WHC-005',
      billFrom: 'Cold Storage 2',
      itemName: 'Apples - Ambient',
      corNo: 'COR-12349',
      billTo: 'Pune Facility',
      quantity: 450,
      weight: 18.75,
      month: 'Mar-2026',
      days: 31,
      ratePerUnit: 48.0,
      storageChargesPerMonth: 1800.0,
      amount: 1800.0,
    },
  ],

  financial: {
    basicTotal: 3800.0,
    roundOff: 0.0,
    netAmount: 3800.0,
  },

  bankDetails: {
    bankName: 'HDFC Bank',
    branchName: 'Pune - Camp Branch',
    accountNumber: '9876543210123456',
    ifscCode: 'HDFC0000001',
  },

  termsAndConditions: [
    {
      title: 'Payment Terms',
      description: 'Payment is due within 15 days of invoice date. Early payment discounts as per agreement.',
    },
    {
      title: 'Storage Conditions',
      description: 'Goods stored at optimal temperature and humidity. Regular inspections conducted.',
    },
    {
      title: 'Liability Waiver',
      description: 'WMS Pro is not liable for deterioration of goods due to force majeure or acts of God.',
    },
  ],

  authorizedBy: 'Priya Sharma',
  notes: 'GST invoice. IGST applicable as per slab rates.',
};
