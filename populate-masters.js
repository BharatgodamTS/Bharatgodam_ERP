const { MongoClient, ObjectId } = require('mongodb');

async function populateMasters() {
  const client = new MongoClient('mongodb://localhost:27017');
  await client.connect();
  const db = client.db('wms_production');

  // Sample clients
  const clients = [
    { name: 'Shruti Mehata', location: 'Mumbai', status: 'ACTIVE', createdAt: new Date(), updatedAt: new Date() },
    { name: 'ABC Grains Inc', location: 'Delhi', status: 'ACTIVE', createdAt: new Date(), updatedAt: new Date() },
  ];

  // Sample commodities
  const commodities = [
    { name: 'WHEAT', category: 'GRAINS', unit: 'MT', createdAt: new Date() },
    { name: 'RICE', category: 'GRAINS', unit: 'MT', createdAt: new Date() },
  ];

  // Sample warehouses
  const warehouses = [
    { name: 'Warehouse ABC', location: 'Mumbai', capacity: 10000, occupiedCapacity: 0, status: 'ACTIVE', createdAt: new Date(), updatedAt: new Date() },
    { name: 'Warehouse XYZ', location: 'Delhi', capacity: 5000, occupiedCapacity: 0, status: 'ACTIVE', createdAt: new Date(), updatedAt: new Date() },
  ];

  await db.collection('clients').insertMany(clients);
  await db.collection('commodities').insertMany(commodities);
  await db.collection('warehouses').insertMany(warehouses);

  console.log('Master data populated');

  await client.close();
}

populateMasters().catch(console.error);