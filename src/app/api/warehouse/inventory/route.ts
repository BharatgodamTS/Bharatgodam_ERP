import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';

const TOTAL_CAPACITY = 5000;

// Helper function to convert warehouse ID to name
function getWarehouseNameFromId(warehouseId: string): string {
  const warehouseMap: { [key: string]: string } = {
    'WH1': 'Warehouse 1',
    'WH2': 'Warehouse 2',
    'WH3': 'Warehouse 3',
    'WH4': 'Warehouse 4',
    'WH5': 'Warehouse 5'
  };
  return warehouseMap[warehouseId] || 'Warehouse 1';
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const warehouseId = searchParams.get('warehouseId') || 'WH1'; // Default to WH1

    const db = await getDb();

    // Aggregate commodity weights from bookings filtered by warehouse
    const commodityBreakdown = await db.collection('bookings').aggregate([
      {
        $match: {
          status: { $in: ['PENDING_APPROVAL', 'APPROVED'] }, // Only count active bookings
          warehouseName: getWarehouseNameFromId(warehouseId) // Filter by warehouse
        }
      },
      {
        $group: {
          _id: '$commodityName',
          totalWeight: {
            $sum: {
              $cond: [
                { $eq: ['$direction', 'OUTWARD'] },
                { $multiply: ['$mt', -1] },
                '$mt'
              ]
            }
          },
          bookingCount: { $sum: 1 }
        }
      },
      {
        $project: {
          commodityName: '$_id',
          totalWeight: { $round: [{ $max: ['$totalWeight', 0] }, 3] }, // Round and clamp to zero
          bookingCount: 1,
          _id: 0
        }
      },
      {
        $sort: { totalWeight: -1 } // Sort by weight descending
      }
    ]).toArray();

    // Use a uniform capacity across all warehouses
    const totalCapacity = TOTAL_CAPACITY;

    // Calculate used capacity from the selected warehouse
    const usedCapacity = commodityBreakdown.reduce((sum, item) => sum + item.totalWeight, 0);
    const availableCapacity = Math.max(0, totalCapacity - usedCapacity);

    const warehouseStats = {
      total_capacity: totalCapacity,
      used_capacity: Math.round(usedCapacity * 1000) / 1000, // Round to 3 decimal places
      available_capacity: Math.round(availableCapacity * 1000) / 1000,
      utilization_percentage: Math.round((usedCapacity / totalCapacity) * 100),
      warehouse_id: warehouseId,
      warehouse_name: getWarehouseNameFromId(warehouseId)
    };

    return NextResponse.json({
      success: true,
      commodities: commodityBreakdown,
      warehouse_stats: warehouseStats
    });

  } catch (error) {
    console.error('Error fetching warehouse inventory:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch warehouse inventory' },
      { status: 500 }
    );
  }
}