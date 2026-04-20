'use server';

import { getDb } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { calculateInventoryBasedRent, InventoryChange } from '@/lib/pricing-engine';

const toObjectId = (id: string) => {
  try {
    return new ObjectId(id);
  } catch (error) {
    throw new Error(`Invalid ObjectId: ${id}`);
  }
};

/**
 * Calculate inventory-based monthly invoice for a client-warehouse-commodity combination
 */
export async function calculateMonthlyInventoryInvoice(
  clientId: string,
  warehouseId: string,
  commodityId: string,
  monthYear: string,
) {
  try {
    const db = await getDb();
    const [yearStr, monthStr] = monthYear.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);
    const clientObjectId = toObjectId(clientId);
    const warehouseObjectId = toObjectId(warehouseId);
    const commodityObjectId = toObjectId(commodityId);

    const commodity = await db.collection('commodities').findOne({ _id: commodityObjectId });
    if (!commodity) {
      throw new Error(`Commodity not found: ${commodityId}`);
    }

    const ratePerMonth = commodity.ratePerMtPerMonth || commodity.ratePerMtPerDay * 30;

    const monthStart = new Date(`${yearStr}-${monthStr}-01T00:00:00.000Z`);
    const monthEnd = new Date(year, month, 0);
    monthEnd.setHours(23, 59, 59, 999);

    const allInwards = await db.collection('inwards').find({
      clientId: clientObjectId,
      warehouseId: warehouseObjectId,
      commodityId: commodityObjectId,
      date: {
        $lte: monthEnd,
      },
    }).toArray();

    const monthInwards = allInwards.filter((inward) => inward.date >= monthStart && inward.date <= monthEnd);
    const preMonthInwards = allInwards.filter((inward) => inward.date < monthStart);

    const allInwardIds = allInwards.map((i) => i._id);
    const allOutwards = await db.collection('outwards').find({
      inwardId: { $in: allInwardIds },
      date: {
        $lte: monthEnd,
      },
    }).toArray();

    const monthOutwards = allOutwards.filter((outward) => outward.date >= monthStart && outward.date <= monthEnd);
    const preMonthOutwards = allOutwards.filter((outward) => outward.date < monthStart);

    const openingInventory = Math.max(
      0,
      preMonthInwards.reduce((sum, inward) => sum + inward.quantityMT, 0) -
        preMonthOutwards.reduce((sum, outward) => sum + outward.quantityMT, 0)
    );

    const inventoryChanges: InventoryChange[] = [];

    if (openingInventory > 0) {
      inventoryChanges.push({
        date: monthStart,
        quantityMT: openingInventory,
        type: 'INWARD',
      });
    }

    for (const inward of monthInwards) {
      inventoryChanges.push({
        date: inward.date,
        quantityMT: inward.quantityMT,
        type: 'INWARD',
      });
    }

    for (const outward of monthOutwards) {
      inventoryChanges.push({
        date: outward.date,
        quantityMT: -outward.quantityMT,
        type: 'OUTWARD',
      });
    }

    const billing = calculateInventoryBasedRent(inventoryChanges, ratePerMonth, monthYear);

    return {
      success: true,
      data: {
        clientId,
        warehouseId,
        commodityId,
        commodityName: commodity.name,
        monthYear,
        billing,
        inwardsCount: monthInwards.length,
        outwardsCount: monthOutwards.length,
        transactionsCount: monthInwards.length + monthOutwards.length,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Generate consolidated monthly invoice for a client across all warehouses and commodities
 */
export async function generateMonthlyConsolidatedInvoice(clientId: string, monthYear: string) {
  try {
    const db = await getDb();
    const [yearStr, monthStr] = monthYear.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);
    const clientObjectId = toObjectId(clientId);

    const monthStart = new Date(`${yearStr}-${monthStr}-01T00:00:00.000Z`);
    const monthEnd = new Date(year, month, 0);
    monthEnd.setHours(23, 59, 59, 999);

    const inwards = await db.collection('inwards').find({
      clientId: clientObjectId,
      date: {
        $lte: monthEnd,
      },
    }).toArray();

    const uniqueCombinations = new Map<string, { warehouseId: string; commodityId: string }>();
    for (const inward of inwards) {
      if (!inward.warehouseId || !inward.commodityId) continue;
      const warehouseId = inward.warehouseId.toString();
      const commodityId = inward.commodityId.toString();
      const key = `${warehouseId}-${commodityId}`;
      if (!uniqueCombinations.has(key)) {
        uniqueCombinations.set(key, {
          warehouseId,
          commodityId,
        });
      }
    }

    const invoices = [];
    for (const entry of uniqueCombinations.entries()) {
      const combo = entry[1];
      const result = await calculateMonthlyInventoryInvoice(
        clientId,
        combo.warehouseId,
        combo.commodityId,
        monthYear,
      );
      if (result.success) {
        invoices.push(result.data);
      }
    }

    const consolidatedTotal = invoices.reduce((sum, inv) => sum + (inv?.billing?.totalAmount || 0), 0);

    return {
      success: true,
      data: {
        clientId,
        monthYear,
        invoices,
        consolidatedTotal: Math.round(consolidatedTotal * 100) / 100,
        invoiceCount: invoices.length,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
