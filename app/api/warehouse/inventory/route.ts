import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const requestedWarehouseId = searchParams.get('warehouseId');

    const db = await getDb();
    const warehouseCollection = db.collection('warehouses');

    const activeWarehouses = await warehouseCollection.find({ status: 'ACTIVE' }).toArray();
    let warehouse = null;

    if (requestedWarehouseId) {
      try {
        warehouse = await warehouseCollection.findOne({ _id: new ObjectId(requestedWarehouseId) });
      } catch {
        warehouse = null;
      }
    }

    if (!warehouse) {
      warehouse = activeWarehouses[0] || null;
    }

    if (!warehouse) {
      return NextResponse.json({ success: false, error: 'No active warehouses found' }, { status: 404 });
    }

    const commodityBreakdown = await db.collection('transactions').aggregate([
      {
        $match: {
          warehouseId: warehouse._id.toString()
        }
      },
      {
        $group: {
          _id: '$commodityName',
          totalWeight: {
            $sum: {
              $cond: [
                { $eq: ['$direction', 'OUTWARD'] },
                { $multiply: ['$quantityMT', -1] },
                '$quantityMT'
              ]
            }
          },
          bookingCount: { $sum: 1 }
        }
      },
      {
        $project: {
          commodityName: '$_id',
          totalWeight: { $round: [{ $max: ['$totalWeight', 0] }, 3] },
          bookingCount: 1,
          _id: 0
        }
      },
      {
        $match: {
          totalWeight: { $gt: 0 }
        }
      },
      {
        $sort: { totalWeight: -1 }
      }
    ]).toArray();

    const totalCapacity = warehouse.totalCapacity || 5000;
    const usedCapacity = commodityBreakdown.reduce((sum, item) => sum + item.totalWeight, 0);
    const availableCapacity = Math.max(0, totalCapacity - usedCapacity);

    const warehouseStats = {
      total_capacity: totalCapacity,
      used_capacity: Math.round(usedCapacity * 1000) / 1000,
      available_capacity: Math.round(availableCapacity * 1000) / 1000,
      utilization_percentage: Math.round((usedCapacity / totalCapacity) * 100),
      warehouse_id: warehouse._id.toString(),
      warehouse_name: warehouse.name || 'Unknown Warehouse'
    };

    const warehouses = activeWarehouses.map((wh) => ({
      warehouse_id: wh._id.toString(),
      warehouse_name: wh.name || 'Unnamed Warehouse',
      total_capacity: wh.totalCapacity || 5000
    }));

    return NextResponse.json({
      success: true,
      commodities: commodityBreakdown,
      warehouse_stats: warehouseStats,
      warehouses
    });
  } catch (error) {
    console.error('Error fetching warehouse inventory:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch warehouse inventory' },
      { status: 500 }
    );
  }
}
