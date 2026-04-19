const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { MongoClient, ObjectId } = require('mongodb');

const PORT = process.env.REVENUE_SERVER_PORT || 4000;
const MONGODB_URL = process.env.MONGODB_URL || 'mongodb://127.0.0.1:27017';
const MONGODB_DB = process.env.MONGODB_DB || 'wms_production';
const COLLECTION_NAME = 'revenuedistributions';

const warehouseNames = {
  '69e0c97dcaec663cd7815776': 'Warehouse ABC',
  '69e0c97dcaec663cd7815777': 'Warehouse XYZ',
};

function getWarehouseName(warehouseId) {
  return warehouseNames[warehouseId] || warehouseId;
}

function toIndianCurrency(value) {
  return Number(value.toFixed(2));
}

function getDistribution(totalAmount) {
  const ownerShare = toIndianCurrency(totalAmount * 0.6);
  const platformShare = toIndianCurrency(totalAmount * 0.4);
  return { ownerShare, platformShare };
}

async function buildSummary(collection, query = {}) {
  const pipeline = [
    { $match: query },
    {
      $group: {
        _id: null,
        totalRevenue: { $sum: '$totalAmount' },
        totalOwnerShare: { $sum: '$ownerShare' },
        totalPlatformShare: { $sum: '$platformShare' },
      },
    },
  ];

  const [summary] = await collection.aggregate(pipeline).toArray();
  return {
    totalRevenue: summary?.totalRevenue ?? 0,
    totalOwnerShare: summary?.totalOwnerShare ?? 0,
    totalPlatformShare: summary?.totalPlatformShare ?? 0,
  };
}

async function createServer() {
  const client = new MongoClient(MONGODB_URL, {
    serverApi: {
      version: '1',
      strict: true,
      deprecationErrors: true,
    },
  });
  await client.connect();
  const db = client.db(MONGODB_DB);
  const revenueCollection = db.collection(COLLECTION_NAME);

  const app = express();
  const server = http.createServer(app);
  
  // Determine allowed origins based on environment
  const allowedOrigins = process.env.ALLOWED_ORIGINS 
    ? process.env.ALLOWED_ORIGINS.split(',')
    : ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:4000'];

  const io = new Server(server, {
    cors: {
      origin: allowedOrigins,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  app.use(cors({ origin: true }));
  app.use(express.json());

  app.get('/api/revenue-distribution', async (req, res) => {
    try {
      const { warehouse } = req.query;
      let query = {};

      if (warehouse && warehouse !== 'ALL') {
        query = {
          warehouseId: new ObjectId(warehouse),
        };
      }

      const records = await revenueCollection.find(query).sort({ createdAt: -1 }).toArray();
      
      // Add warehouse names to records
      const recordsWithNames = records.map(record => ({
        ...record,
        warehouseName: getWarehouseName(record.warehouseId),
      }));
      
      const summary = await buildSummary(revenueCollection, query);
      res.json({ success: true, summary, records: recordsWithNames });
    } catch (error) {
      console.error('Failed to fetch revenue distribution:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch revenue distribution' });
    }
  });

  app.post('/api/payment-success', async (req, res) => {
    try {
      const { booking_id, warehouse_id, total_amount } = req.body;

      if (!booking_id || !warehouse_id || total_amount === undefined) {
        return res.status(400).json({ success: false, error: 'booking_id, warehouse_id and total_amount are required' });
      }

      const amount = Number(total_amount);
      if (Number.isNaN(amount) || amount <= 0) {
        return res.status(400).json({ success: false, error: 'total_amount must be a positive number' });
      }

      const { ownerShare, platformShare } = getDistribution(amount);
      const record = {
        booking_id,
        warehouse_id,
        warehouse_name: getWarehouseName(warehouse_id),
        total_amount: toIndianCurrency(amount),
        owner_share: ownerShare,
        platform_share: platformShare,
        createdAt: new Date(),
      };

      const result = await revenueCollection.insertOne(record);
      const savedRecord = {
        ...record,
        _id: result.insertedId.toString(),
        createdAt: record.createdAt.toISOString(),
      };

      const summary = await buildSummary(revenueCollection);
      io.emit('revenueUpdated', { record: savedRecord, summary });

      res.json({ success: true, record: savedRecord, summary });
    } catch (error) {
      console.error('Payment success handler failed:', error);
      res.status(500).json({ success: false, error: 'Failed to process payment success' });
    }
  });

  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id}`);
    socket.on('disconnect', (reason) => {
      console.log(`Socket disconnected: ${socket.id} (${reason})`);
    });
  });

  server.listen(PORT, () => {
    console.log(`Revenue distribution server running on http://localhost:${PORT}`);
  });
}

createServer().catch((error) => {
  console.error('Failed to start revenue distribution server:', error);
  process.exit(1);
});
