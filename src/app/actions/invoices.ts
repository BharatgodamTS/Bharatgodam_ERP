'use server';

import { getDb } from '@/lib/mongodb';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { ObjectId } from 'mongodb';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

export async function fetchUserInvoices() {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error('Unauthorized');

  const db = await getDb();
  
  // Fetch actual formal invoices from the database
  const invoices = await db.collection('invoices')
    .find({ clientEmail: session.user.email })
    .sort({ generatedAt: -1 })
    .toArray();

  // MUST stringify ObjectIds and Dates to avoid "Only plain objects can be passed to Client Components" error
  return invoices.map(inv => ({
    id: inv._id.toString(),
    bookingId: inv.bookingId.toString(),
    clientEmail: inv.clientEmail,
    customerName: inv.customerName,
    commodity: inv.commodity,
    durationDays: inv.durationDays,
    rateApplied: inv.rateApplied,
    subtotal: inv.subtotal,
    totalAmount: inv.totalAmount,
    paidAmount: inv.paidAmount || 0,
    pendingAmount: (inv.totalAmount || 0) - (inv.paidAmount || 0), // Calculate dynamically
    status: inv.status,
    generatedAt: inv.generatedAt ? inv.generatedAt.toISOString() : new Date().toISOString()
  }));
}

// NEW: Dynamically update Invoice Status (Pending <-> Paid)
export async function updateInvoiceStatus(invoiceId: string, newStatus: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { success: false, message: 'Unauthorized' };

  try {
    const db = await getDb();
    await db.collection('invoices').updateOne(
      { _id: new ObjectId(invoiceId) },
      { $set: { status: newStatus } }
    );

    // Forces Next.js to immediately refetch and redraw the server-rendered table
    revalidatePath('/dashboard/invoices');
    revalidatePath('/dashboard');
    return { success: true };
  } catch (error) {
    console.error('Failed to update invoice:', error);
    return { success: false, message: 'Database error' };
  }
}

// Zod schema for payment update validation
const updatePaymentSchema = z.object({
  invoiceId: z.string().min(1, 'Invoice ID is required'),
  additionalPayment: z.number().min(0, 'Payment amount cannot be negative'),
});

// NEW: Add cumulative payment with Zod validation and integer math (paise)
export async function updateInvoicePayment(invoiceId: string, additionalPayment: number) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { success: false, message: 'Unauthorized' };

  try {
    // Validate input using Zod
    const validationResult = updatePaymentSchema.safeParse({ invoiceId, additionalPayment });
    if (!validationResult.success) {
      const errorMessage = validationResult.error.issues?.[0]?.message ||
                          validationResult.error.errors?.[0]?.message ||
                          'Validation failed';
      return { success: false, message: errorMessage };
    }

    const db = await getDb();

    // Get the invoice to validate against total amount and current paid amount
    const invoice = await db.collection('invoices').findOne({ _id: new ObjectId(invoiceId) });
    if (!invoice) return { success: false, message: 'Invoice not found' };

    // Use integer math (paise) - convert to integers for calculation
    const totalAmount = Math.round((invoice.totalAmount || invoice.finalTotal || 0) * 100); // Convert to paise
    const currentPaidAmount = Math.round((invoice.paidAmount || 0) * 100); // Current paid in paise
    const additionalPaymentPaise = Math.round(additionalPayment * 100); // Additional payment in paise

    // Calculate new total paid amount
    const newTotalPaidPaise = currentPaidAmount + additionalPaymentPaise;

    // Server-side validation: new total paid cannot exceed total amount
    if (newTotalPaidPaise > totalAmount) {
      const remainingBalance = (totalAmount - currentPaidAmount) / 100;
      return {
        success: false,
        message: `Payment exceeds remaining balance of ₹${remainingBalance.toFixed(2)}`
      };
    }

    // Calculate pending amount in paise
    const pendingAmountPaise = Math.max(0, totalAmount - newTotalPaidPaise);

    // Determine payment status based on amounts
    let status = 'UNPAID';
    if (newTotalPaidPaise === 0) {
      status = 'UNPAID';
    } else if (pendingAmountPaise === 0) {
      status = 'PAID';
    } else {
      status = 'PARTIALLY_PAID';
    }

    // Update the invoice using $set for atomic operation with absolute values
    await db.collection('invoices').updateOne(
      { _id: new ObjectId(invoiceId) },
      {
        $set: {
          paidAmount: newTotalPaidPaise / 100, // Store as rupees
          pendingAmount: pendingAmountPaise / 100, // Store as rupees
          status: status
        }
      }
    );

    // If payment is now fully paid, notify revenue distribution system
    if (status === 'PAID') {
      try {
        // Get booking details to extract warehouse info
        const booking = await db.collection('bookings').findOne({ _id: invoice.bookingId });
        if (booking) {
          // Map warehouse name to warehouse ID for revenue distribution
          const warehouseNameToId: { [key: string]: string } = {
            'Warehouse 1': 'WH1',
            'Warehouse 2': 'WH2',
            'Warehouse 3': 'WH3',
            'Warehouse 4': 'WH4',
            'Warehouse 5': 'WH5',
          };

          const warehouseId = warehouseNameToId[booking.warehouseName] || 'WH1'; // Default to WH1 if not found

          const revenueApiUrl = process.env.REVENUE_API_BASE || 'http://localhost:4000';
          const response = await fetch(`${revenueApiUrl}/api/payment-success`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              booking_id: booking._id.toString(),
              warehouse_id: warehouseId,
              total_amount: totalAmount / 100, // Convert back to rupees
            }),
          });

          if (!response.ok) {
            console.error('Failed to notify revenue distribution system:', await response.text());
          } else {
            console.log('Successfully notified revenue distribution system for booking:', booking._id.toString());
          }
        } else {
          console.error('Booking not found for invoice:', invoiceId);
        }
      } catch (error) {
        console.error('Error notifying revenue distribution system:', error);
        // Don't fail the payment update if revenue notification fails
      }
    }

    revalidatePath('/dashboard/invoices');
    revalidatePath('/dashboard');
    return {
      success: true,
      newPaidAmount: newTotalPaidPaise / 100, // Return new total paid in rupees
      pendingAmount: pendingAmountPaise / 100, // Return pending in rupees
      status
    };
  } catch (error) {
    console.error('Failed to update payment:', error);
    return { success: false, message: 'Database error' };
  }
}
