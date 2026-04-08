'use server';

import { getDb } from '@/lib/mongodb';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { IDetailedBooking } from '@/types/schemas';
import { ObjectId } from 'mongodb';

export interface ReportFilter {
  startDate?: string;
  endDate?: string;
  warehouse?: string;
  commodity?: string;
  location?: string;
  page?: number;     // Added for pagiantion
  limit?: number;    // Added for pagination
}

/**
 * Server Action to fetch and filter logistics bookings from MongoDB.
 * Implements high-performance filtering via $match, $gte, $lte, and $regex operators.
 */
export async function getFilteredBookings(filters: ReportFilter = {}) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      throw new Error('Unauthorized');
    }

    const db = await getDb();
    const query: any = {};

    // 1. Date Range Filter (Inward Date)
    if (filters.startDate || filters.endDate) {
      query.date = {};
      if (filters.startDate) query.date.$gte = filters.startDate;
      if (filters.endDate) query.date.$lte = filters.endDate;
    }

    // 2. Category Filters
    if (filters.commodity && filters.commodity !== 'ALL') {
      query.commodityName = filters.commodity.toUpperCase();
    }
    if (filters.location && filters.location !== 'ALL') {
      query.location = { $regex: filters.location, $options: 'i' };
    }

    // 3. Warehouse Search
    if (filters.warehouse && filters.warehouse !== 'ALL') {
      query.warehouseName = filters.warehouse;
    }

    // 4. Extract Pagination
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const skip = (page - 1) * limit;

    // 5. Parallel Fetch with Pagination & Lean Projection
    const [totalCount, bookings] = await Promise.all([
      db.collection('bookings').countDocuments(query),
      db.collection('bookings')
        .find(query)
        .project({
          // Strict projection to prevent massive payload transfers
          _id: 1, sNo: 1, direction: 1, date: 1, warehouseName: 1, location: 1,
          clientName: 1, clientLocation: 1, suppliers: 1, commodityName: 1,
          cadNo: 1, stackNo: 1, lotNo: 1, doNumber: 1, cdfNo: 1, gatePass: 1,
          pass: 1, bags: 1, mt: 1, palaBags: 1, storageDays: 1, createdAt: 1
        })
        .sort({ date: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .toArray()
    ]);

    // 5. Serialize for Client Side
    const serializedBookings = bookings.map((booking: any) => ({
      ...booking,
      _id: booking._id.toString(),
      // Ensure userId is a string if it exists
      userId: booking.userId?.toString() || '',
      // Ensure date is a string (it should already be if coming from the form)
      createdAt: booking.createdAt?.toISOString() || new Date().toISOString(),
    })) as IDetailedBooking[];

    const totalPages = Math.ceil(totalCount / limit);

    return { 
      success: true, 
      data: serializedBookings,
      count: serializedBookings.length,
      totalCount,
      totalPages,
      currentPage: page
    };

  } catch (error: any) {
    console.error('[getFilteredBookings] ERROR:', error);
    return { success: false, message: error.message || 'Database fetch failed' };
  }
}

/**
 * Fetches unique commodities and locations for the filter dropdowns.
 */
export async function getFilterOptions() {
  try {
    const db = await getDb();
    
    const [commodities, locations] = await Promise.all([
      db.collection('bookings').distinct('commodityName'),
      db.collection('bookings').distinct('location')
    ]);

    return {
      commodities: ['ALL', ...(commodities || [])],
      locations: ['ALL', ...(locations || [])]
    };
  } catch {
    return { commodities: ['ALL'], locations: ['ALL'] };
  }
}

/**
 * Fetches rigorous, formatted options from the authoritative Commodities DB collection.
 * Required for the multi-faceted dropdown to stay synced with the master list.
 */
export async function getCommodityOptions() {
  try {
    const db = await getDb();
    const items = await db.collection('commodities').find().sort({ name: 1 }).toArray();
    
    return [
      { label: "All Commodities", value: "ALL" },
      ...items.map(c => ({
        label: c.name,
        value: c.name
      }))
    ];
  } catch (error) {
    console.error('[getCommodityOptions] Error:', error);
    return [{ label: "All Commodities", value: "ALL" }];
  }
}
