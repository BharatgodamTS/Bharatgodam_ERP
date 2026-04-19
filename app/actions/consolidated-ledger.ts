'use server';

import { getDb } from '@/lib/mongodb';
import { calculateLedger } from '@/lib/ledger-engine';
import { generateTimeStateLedger } from '@/lib/ledger-time-state-engine';
import type { Transaction, Payment } from '@/lib/ledger-engine';
import type { TimeStateLedgerSummary } from '@/lib/ledger-time-state-engine';
import type { IClientAccount, ITransaction, IPayment } from '@/types/schemas';

/**
 * Consolidated Ledger Response
 * Aggregates all transactions and payments for a specific account by bookingId
 * Now includes both traditional ledger and TIME-STATE SYSTEM ledger
 */
export interface ConsolidatedLedgerResponse {
  success: boolean;
  message?: string;
  data?: {
    account: IClientAccount | null;
    transactions: Transaction[];
    payments: Payment[];
    ledgerSummary: any; // LedgerSummary from ledger-engine (traditional)
    timeStateLedger?: TimeStateLedgerSummary; // NEW: TIME-STATE SYSTEM ledger
    commoditySummary: {
      commodity: string;
      totalMT: number;
      inboundMT: number;
      outboundMT: number;
    }[];
  };
}

/**
 * Get Consolidated Ledger by Account ID (bookingId)
 * 
 * Fetches all transactions and payments for a specific client account,
 * then calculates the unified ledger treating all commodities as a single inventory stream.
 * 
 * @param bookingId - The unique account identifier (from IClientAccount.bookingId)
 * @returns Consolidated ledger with aggregated rent calculation
 */
export async function getConsolidatedLedger(
  bookingId: string
): Promise<ConsolidatedLedgerResponse> {
  try {
    if (!bookingId || bookingId.trim() === '') {
      return {
        success: false,
        message: 'Booking ID is required',
      };
    }

    const db = await getDb();
    const trimmedBookingId = bookingId.trim();

    // Fetch the client account
    const account = (await db
      .collection('client_accounts')
      .findOne({ bookingId: trimmedBookingId })) as IClientAccount | null;

    if (!account) {
      return {
        success: false,
        message: `Account not found for booking ID: ${trimmedBookingId}`,
      };
    }

    // Fetch all transactions for this account (ALL commodities combined)
    const transactionsRaw = await db
      .collection('transactions')
      .find({
        accountId: trimmedBookingId,
      })
      .sort({ date: 1 })
      .toArray();

    const transactions: Transaction[] = transactionsRaw.map((txn: any) => ({
      _id: txn._id?.toString() || '',
      date: txn.date, // Expect ISO date string
      direction: txn.direction,
      mt: txn.quantityMT,
      clientName: account.clientName,
      commodityName: txn.commodityName,
      gatePass: txn.gatePass || '',
    }));

    // Fetch all payments for this account
    const paymentsRaw = await db
      .collection('payments')
      .find({
        accountId: trimmedBookingId,
      })
      .sort({ date: 1 })
      .toArray();

    const payments: Payment[] = paymentsRaw.map((pay: any) => ({
      _id: pay._id?.toString() || '',
      date: pay.date, // Expect ISO date string
      amount: pay.amount,
      clientName: account.clientName,
    }));

    // Calculate outstanding invoices
    const outstandingInvoicesResult = await db.collection('invoice_master')
      .aggregate([
        { $match: { clientId: account._id, status: { $ne: 'PAID' } } },
        { $group: { _id: null, totalOutstanding: { $sum: '$totalAmount' } } }
      ])
      .toArray();
    
    const outstandingInvoices = outstandingInvoicesResult.length > 0 
      ? outstandingInvoicesResult[0].totalOutstanding || 0 
      : 0;

    // Fetch commodity rates
    const commoditiesResult = await db.collection('commodities')
      .find({})
      .toArray();

    // Create a map of commodity name -> rate per day per MT
    const commodityRates = new Map<string, number>();
    commoditiesResult.forEach((commodity: any) => {
      if (commodity.name && commodity.ratePerDayPerMT) {
        commodityRates.set(commodity.name, commodity.ratePerDayPerMT);
      }
    });

    // Calculate consolidated ledger treating all transactions as single stream
    const ledgerSummary = calculateLedger(transactions, payments, account.clientName, outstandingInvoices, commodityRates);

    // Generate TIME-STATE SYSTEM ledger (NEW)
    const timeStateLedger = generateTimeStateLedger(transactions, account.clientName);

    // Generate commodity summary (for reporting purposes)
    const commoditySummary = Array.from(
      new Map(
        transactionsRaw.map((txn: any) => {
          const inbound = txn.direction === 'INWARD' ? txn.quantityMT : 0;
          const outbound = txn.direction === 'OUTWARD' ? txn.quantityMT : 0;
          return [txn.commodityName, { inbound, outbound }];
        })
      ).entries()
    ).map(([commodity, { inbound, outbound }]) => ({
      commodity,
      totalMT: inbound - outbound,
      inboundMT: inbound,
      outboundMT: outbound,
    }));

    return {
      success: true,
      data: {
        account,
        transactions,
        payments,
        ledgerSummary,
        timeStateLedger, // Include TIME-STATE SYSTEM ledger
        commoditySummary,
      },
    };
  } catch (error: any) {
    console.error('getConsolidatedLedger error:', error);
    return {
      success: false,
      message: error.message || 'Failed to fetch consolidated ledger',
    };
  }
}

/**
 * Search for existing client accounts by name
 * Used for the "Select Existing Account" dropdown
 */
export async function searchClientAccounts(
  searchQuery: string
): Promise<{
  success: boolean;
  data?: IClientAccount[];
  message?: string;
}> {
  try {
    if (!searchQuery || searchQuery.trim().length < 2) {
      return {
        success: true,
        data: [],
      };
    }

    const db = await getDb();
    const regex = new RegExp(searchQuery.trim(), 'i');

    const results = (await db
      .collection('client_accounts')
      .find({
        clientName: regex,
        accountStatus: 'ACTIVE',
      })
      .sort({ clientName: 1 })
      .limit(10)
      .toArray()) as IClientAccount[];

    return {
      success: true,
      data: results,
    };
  } catch (error: any) {
    console.error('searchClientAccounts error:', error);
    return {
      success: false,
      message: error.message || 'Search failed',
    };
  }
}

/**
 * Create a new client account
 */
export async function createClientAccount(
  clientName: string,
  clientLocation?: string,
  contactInfo?: any
): Promise<{
  success: boolean;
  data?: { account: IClientAccount; bookingId: string };
  message?: string;
}> {
  try {
    if (!clientName || clientName.trim() === '') {
      return {
        success: false,
        message: 'Client name is required',
      };
    }

    const db = await getDb();

    // Generate unique booking ID (UUID-like format)
    const bookingId = `${Date.now()}-${Math.random().toString(36).substring(7)}`.toUpperCase();

    const newAccount: IClientAccount = {
      bookingId,
      clientName: clientName.trim(),
      clientLocation: clientLocation?.trim(),
      contactInfo: contactInfo || {},
      accountStatus: 'ACTIVE',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await db.collection('client_accounts').insertOne(newAccount);

    return {
      success: true,
      data: {
        account: { ...newAccount, _id: result.insertedId },
        bookingId,
      },
    };
  } catch (error: any) {
    console.error('createClientAccount error:', error);
    return {
      success: false,
      message: error.message || 'Failed to create account',
    };
  }
}
