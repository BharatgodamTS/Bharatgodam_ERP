const { MongoClient } = require('mongodb');

async function initializeWarehouseConfig() {
  const client = new MongoClient('mongodb://127.0.0.1:27017');

  try {
    await client.connect();
    const db = client.db('wms_production');

    // Check if warehouse config already exists
    const existingConfig = await db.collection('warehouse_config').findOne({});
    if (existingConfig) {
      console.log('Warehouse config already exists:', existingConfig);
      return;
    }

    // Create warehouse configuration
    const warehouseConfig = {
      totalCapacity: 5000, // 5000 MT total capacity
      name: 'Main Warehouse Complex',
      location: 'Ahmedabad, Gujarat',
      type: 'Multi-Commodity Warehouse',
      createdAt: new Date(),
      updatedAt: new Date(),
      commodities: [
        { name: 'WHEAT', baseRate: 85, unit: 'MT', category: 'Grains' },
        { name: 'RICE', baseRate: 90, unit: 'MT', category: 'Grains' },
        { name: 'CHANA', baseRate: 95, unit: 'MT', category: 'Pulses' },
        { name: 'SOYABEAN', baseRate: 80, unit: 'MT', category: 'Oilseeds' },
        { name: 'MUSTARD', baseRate: 88, unit: 'MT', category: 'Oilseeds' },
        { name: 'CORN', baseRate: 75, unit: 'MT', category: 'Grains' },
        { name: 'COTTON', baseRate: 120, unit: 'MT', category: 'Fibres' },
      ]
    };

    const result = await db.collection('warehouse_config').insertOne(warehouseConfig);
    console.log('✅ Warehouse configuration initialized:', result.insertedId);

  } catch (error) {
    console.error('❌ Error initializing warehouse config:', error);
  } finally {
    await client.close();
  }
}

initializeWarehouseConfig();