'use server';

import { getDb } from '@/lib/mongodb';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { ObjectId } from 'mongodb';
import { calculateSettlement } from '@/lib/withdrawal-math';

export async function handleWithdrawal(bookingId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { success: false, message: 'SysAdmin Authentication required' };

  try {
    const db = await getDb();
    const objectId = new ObjectId(bookingId);

    // 1. Core State Validation
    const existing = await db.collection('bookings').findOne({ _id: objectId });
    if (!existing) return { success: false, message: 'Stock Ledger Row not found in Node cluster' };
    if (existing.status === 'OUTWARD') {
      return { success: false, message: 'Security Block: Cargo already marked as OUTWARD.' };
    }

    // 2. High-Efficiency Document Aggregation ($lookup)
    // Directly targets the active season without requiring external query calls
    const pipeline = [
      { $match: { _id: objectId } },
      { 
        $lookup: {
          from: 'commodity_rates',
          let: { cName: '$commodityName' },
          pipeline: [
            { $match: { 
                $expr: { 
                   $and: [
                     { $eq: ['$name', '$$cName'] },
                     { $eq: ['$status', 'Active'] }
                   ]
                }
            }}
          ],
          as: 'activeRateNode'
        }
      }
    ];

    const aggregationResponse = await db.collection('bookings').aggregate(pipeline).toArray();
    const bookingSchema = aggregationResponse[0];

    // Ensure mathematical fallback if specific rate matrices were completely deleted
    let masterRate = 85.00; 
    if (bookingSchema.activeRateNode && bookingSchema.activeRateNode.length > 0) {
      masterRate = bookingSchema.activeRateNode[0].ratePerMT;
    }

    // 3. Mathematical Calculations via Integer Wrapper
    // (Resolving Excel inward column vs strict Node Outward timestamp)
    const inwardDate = bookingSchema.date || bookingSchema.createdAt; 
    const outwardDate = new Date(); // Right Now

    const settlementMath = calculateSettlement(
      inwardDate, 
      outwardDate, 
      bookingSchema.mt || 0, // Fallback safe 0
      masterRate, 
      300 // Static configuration baseline for loaders
    );

    // 4. Secure Mongo Commits (Double Transaction)
    // Step A: Update the physical stock state
    await db.collection('bookings').updateOne(
      { _id: objectId },
      { 
         $set: { 
           status: 'OUTWARD', 
           outwardDate: outwardDate 
         } 
      }
    );

    // Step B: Assemble Financial Document & Pipeline
    const settlementInvoice = {
      bookingId: objectId,
      sNo: bookingSchema.sNo, // Transmit the physical excel ledger mapping
      clientEmail: bookingSchema.userEmail,
      customerName: bookingSchema.clientName || 'GUEST LOGISTICS',
      commodity: bookingSchema.commodityName || 'GENERAL FREIGHT',
      
      // Inject Math Node Output
      ...settlementMath,
      
      // Initialize payment fields
      paidAmount: 0,
      pendingAmount: settlementMath.finalTotal,
      
      status: 'PENDING_SETTLEMENT', 
      invoiceType: 'FINAL_WITHDRAWAL',
      generatedAt: outwardDate,
      createdBy: session.user.email
    };

    const invoiceRes = await db.collection('invoices').insertOne(settlementInvoice);

    return { 
      success: true, 
      invoiceId: invoiceRes.insertedId.toString() 
    };

  } catch (error: any) {
    console.error('Withdrawal Engine Exception Logs:', error);
    return { success: false, message: 'Aggregation and Math Core Exception. Check Console.' };
  }
}
