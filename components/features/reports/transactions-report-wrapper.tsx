import React from 'react';
import TransactionsReport from './transactions-report';
import { getDb } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export default async function TransactionsReportWrapper() {
  try {
    const db = await getDb();

    // Get valid warehouse IDs (exclude problematic warehouses)
    const validWarehouses = await db.collection('warehouses')
      .find({ name: { $nin: ['Warehouse ABC', 'Warehouse XYZ'] } })
      .project({ _id: 1 })
      .toArray();
    const validWarehouseIds = validWarehouses.map(w => w._id.toString()); // Convert to strings

    const [transactions, inwards, outwards, stockEntries] = await Promise.all([
      // Fetch transactions with warehouse lookup to get CURRENT warehouse name
      db.collection('transactions').aggregate([
        { $sort: { date: -1, createdAt: -1 } },
        { $match: { warehouseId: { $in: validWarehouseIds } } }, // Only include valid warehouses
        {
          $lookup: {
            from: 'warehouses',
            localField: 'warehouseId',
            foreignField: '_id',
            as: 'warehouse',
          },
        },
        {
          $addFields: {
            warehouse: { $arrayElemAt: ['$warehouse', 0] },
          },
        },
      ]).toArray(),
      db.collection('inwards').aggregate([
        { $sort: { date: -1, createdAt: -1 } },
        { $match: { warehouseId: { $in: validWarehouseIds } } }, // Only include valid warehouses
        {
          $lookup: {
            from: 'warehouses',
            localField: 'warehouseId',
            foreignField: '_id',
            as: 'warehouse',
          },
        },
        {
          $addFields: {
            warehouse: { $arrayElemAt: ['$warehouse', 0] },
          },
        },
      ]).toArray(),
      db.collection('outwards').aggregate([
        { $sort: { date: -1, createdAt: -1 } },
        { $match: { warehouseId: { $in: validWarehouseIds } } }, // Only include valid warehouses
        {
          $lookup: {
            from: 'warehouses',
            localField: 'warehouseId',
            foreignField: '_id',
            as: 'warehouse',
          },
        },
        {
          $addFields: {
            warehouse: { $arrayElemAt: ['$warehouse', 0] },
          },
        },
      ]).toArray(),
      db.collection('stock_entries').aggregate([
        { $sort: { inwardDate: -1, createdAt: -1 } },
        {
          $addFields: {
            warehouseId: { $toObjectId: '$warehouseId' },
            clientId: { $toObjectId: '$clientId' },
            commodityId: { $toObjectId: '$commodityId' }
          }
        },
        {
          $lookup: {
            from: 'clients',
            localField: 'clientId',
            foreignField: '_id',
            as: 'client',
          },
        },
        {
          $lookup: {
            from: 'commodities',
            localField: 'commodityId',
            foreignField: '_id',
            as: 'commodity',
          },
        },
        {
          $lookup: {
            from: 'warehouses',
            localField: 'warehouseId',
            foreignField: '_id',
            as: 'warehouse',
          },
        },
        { $match: { warehouseId: { $in: validWarehouseIds.map(id => new ObjectId(id)) } } }, // Only include valid warehouses (convert to ObjectId for comparison)
        {
          $addFields: {
            client: { $arrayElemAt: ['$client', 0] },
            commodity: { $arrayElemAt: ['$commodity', 0] },
            warehouse: { $arrayElemAt: ['$warehouse', 0] },
          },
        },
      ]).toArray(),
    ]);

    const existingSourceKeys = new Set(
      transactions.map((t: any) => {
        const sourceType = t.sourceType || 'transactions';
        const sourceId = t.sourceId?.toString() || t._id?.toString() || '';
        return `${sourceType}/${sourceId}`;
      })
    );

    const stockEntryRecords = (stockEntries as any[]).map((t: any) => ({
      ...t,
      sourceType: 'stock_entries',
      sourceId: t._id?.toString(),
    }));

    const legacyRecords = [
      ...inwards.map((t: any) => ({
        ...t,
        sourceType: 'inward',
        sourceId: t._id?.toString(),
      })),
      ...outwards.map((t: any) => ({
        ...t,
        sourceType: 'outward',
        sourceId: t._id?.toString(),
      })),
    ].filter((t: any) => {
      const key = `${t.sourceType}/${t.sourceId}`;
      return !existingSourceKeys.has(key);
    });

    const combinedTransactions = [
      ...transactions,
      ...stockEntryRecords,
      ...legacyRecords,
    ].map((t: any) => ({
      _id: t._id?.toString(),
      direction: t.direction || t.type || 'INWARD',
      date: t.direction === 'OUTWARD' ? (t.actualOutwardDate || t.inwardDate || t.date || t.createdAt) : (t.inwardDate || t.date || t.createdAt),
      clientName: t.clientName || t.client?.name || '',
      clientId: t.clientId?.toString() || t.client?._id?.toString() || '',
      commodityName: t.commodityName || t.commodity?.name || '',
      commodityId: t.commodityId?.toString() || t.commodity?._id?.toString() || '',
      // Display CURRENT warehouse name from the lookup, fall back to stored name
      warehouseName: t.warehouse?.name || t.warehouseName || '',
      warehouseId: t.warehouseId?.toString() || t.warehouse?._id?.toString() || '',
      quantityMT: t.quantityMT || t.quantity || 0,
      bagsCount: t.bagsCount,
      gatePass: t.gatePass,
      stackNo: t.stackNo,
      lotNo: t.lotNo,
      status: t.status || 'COMPLETED',
      createdAt: t.createdAt || t.updatedAt || t.date,
    })).filter((record) => {
      // Exclude records with missing or unknown client/commodity names
      return record.clientName && record.clientName !== 'Unknown' &&
             record.commodityName && record.commodityName !== 'Unknown' &&
             record.warehouseName && record.warehouseName !== 'Unknown';
    });

    return <TransactionsReport transactions={Array.isArray(combinedTransactions) ? combinedTransactions : []} />;
  } catch (error) {
    console.error('Error fetching transactions:', error);
    return (
      <div className="text-center py-12">
        <p className="text-red-500 font-semibold">Unable to load transactions</p>
        <p className="text-slate-500 text-sm">{String(error)}</p>
      </div>
    );
  }
}
