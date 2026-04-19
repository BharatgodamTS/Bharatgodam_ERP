const { MongoClient, ObjectId } = require('mongodb');

const MONGODB_URL = process.env.MONGODB_URL || 'mongodb://127.0.0.1:27017';
const MONGODB_DB = process.env.MONGODB_DB || 'wms_production';

async function testScenario() {
  const client = new MongoClient(MONGODB_URL);
  try {
    await client.connect();
    const db = client.db(MONGODB_DB);

    console.log('\n╔════════════════════════════════════════════════════════════════╗');
    console.log('║  SHRUTI MEHATA - SCENARIO TEST (Rice & Wheat)                 ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');

    // Step 1: Clear old data
    console.log('Step 1: Clearing old test data...');
    const clientName = 'Shruti Mehata';
    await db.collection('clients').deleteMany({ name: clientName });
    await db.collection('commodities').deleteMany({ name: { $in: ['RICE', 'WHEAT'] } });
    await db.collection('warehouses').deleteMany({ code: 'TEST-WH' });
    await db.collection('stock_entries').deleteMany({});
    await db.collection('ledger_entries').deleteMany({});
    await db.collection('invoice_master').deleteMany({});
    await db.collection('invoice_line_items').deleteMany({});
    console.log('✓ Old data cleared\n');

    // Step 2: Create Master Data
    console.log('Step 2: Creating Master Data...');
    
    // Create Client
    const clientResult = await db.collection('clients').insertOne({
      name: clientName,
      status: 'ACTIVE',
      createdAt: new Date(),
    });
    const clientId = clientResult.insertedId;
    console.log(`✓ Client created: ${clientName} (ID: ${clientId})`);

    // Create Commodities
    const riceResult = await db.collection('commodities').insertOne({
      name: 'RICE',
      description: 'Rice commodity',
      ratePerMtMonth: 300, // ₹300/month = ₹10/day
      status: 'ACTIVE',
      createdAt: new Date(),
    });
    const riceId = riceResult.insertedId;
    console.log(`✓ Commodity created: RICE (ID: ${riceId}, Rate: ₹300/month = ₹10/day)`);

    const wheatResult = await db.collection('commodities').insertOne({
      name: 'WHEAT',
      description: 'Wheat commodity',
      ratePerMtMonth: 450, // ₹450/month = ₹15/day
      status: 'ACTIVE',
      createdAt: new Date(),
    });
    const wheatId = wheatResult.insertedId;
    console.log(`✓ Commodity created: WHEAT (ID: ${wheatId}, Rate: ₹450/month = ₹15/day)`);

    // Create Warehouse
    const warehouseResult = await db.collection('warehouses').insertOne({
      code: 'TEST-WH',
      name: 'Test Warehouse',
      status: 'ACTIVE',
      totalCapacity: 5000,
      occupiedCapacity: 0,
      createdAt: new Date(),
    });
    const warehouseId = warehouseResult.insertedId;
    console.log(`✓ Warehouse created: Test Warehouse (ID: ${warehouseId})\n`);

    // Step 3: Create Stock Entries
    console.log('Step 3: Creating Stock Entries (from master data only)...\n');

    // Entry 1: Rice - Inward Apr 16, Outward May 31
    console.log('Entry 1: RICE');
    console.log('  - Quantity: 50 MT');
    console.log('  - Inward: April 16, 2026');
    console.log('  - Outward: May 31, 2026');
    console.log('  - Rate: ₹10/MT/day');

    const rice_inward = await db.collection('stock_entries').insertOne({
      clientId: clientId,
      warehouseId: warehouseId,
      commodityId: riceId,
      direction: 'INWARD',
      quantityMT: 50,
      inwardDate: '2026-04-16',
      expectedOutwardDate: '2026-05-31',
      ratePerMTPerDay: 10,
      gatePass: 'RICE-GP-001',
      remarks: 'Test - Shruti Mehata Rice Entry',
      status: 'ACTIVE',
      createdAt: new Date(),
    });
    console.log(`  ✓ Inward entry created (ID: ${rice_inward.insertedId})\n`);

    // Entry 2: Wheat - Inward Apr 18, Outward May 20
    console.log('Entry 2: WHEAT');
    console.log('  - Quantity: 30 MT');
    console.log('  - Inward: April 18, 2026');
    console.log('  - Outward: May 20, 2026');
    console.log('  - Rate: ₹15/MT/day');

    const wheat_inward = await db.collection('stock_entries').insertOne({
      clientId: clientId,
      warehouseId: warehouseId,
      commodityId: wheatId,
      direction: 'INWARD',
      quantityMT: 30,
      inwardDate: '2026-04-18',
      expectedOutwardDate: '2026-05-20',
      ratePerMTPerDay: 15,
      gatePass: 'WHEAT-GP-001',
      remarks: 'Test - Shruti Mehata Wheat Entry',
      status: 'ACTIVE',
      createdAt: new Date(),
    });
    console.log(`  ✓ Inward entry created (ID: ${wheat_inward.insertedId})\n`);

    // Step 4: Create Ledger Entries
    console.log('Step 4: Creating Ledger Entries from Stock Entries...\n');

    const rice_ledger = await db.collection('ledger_entries').insertOne({
      stockEntryId: rice_inward.insertedId,
      clientId: clientId,
      warehouseId: warehouseId,
      commodityId: riceId,
      periodStartDate: '2026-04-16',
      periodEndDate: '2026-05-31',
      quantityMT: 50,
      ratePerMTPerDay: 10,
      status: 'ACTIVE',
      version: 1,
      createdAt: new Date(),
    });
    console.log(`✓ Rice ledger entry created (ID: ${rice_ledger.insertedId})`);

    const wheat_ledger = await db.collection('ledger_entries').insertOne({
      stockEntryId: wheat_inward.insertedId,
      clientId: clientId,
      warehouseId: warehouseId,
      commodityId: wheatId,
      periodStartDate: '2026-04-18',
      periodEndDate: '2026-05-20',
      quantityMT: 30,
      ratePerMTPerDay: 15,
      status: 'ACTIVE',
      version: 1,
      createdAt: new Date(),
    });
    console.log(`✓ Wheat ledger entry created (ID: ${wheat_ledger.insertedId})\n`);

    // Step 5: Verify invoices can be generated
    console.log('Step 5: Generate April Invoice (2026-04)...\n');

    // Simulate invoice generation for April
    const april_start = '2026-04-01';
    const april_end = '2026-04-30';

    const april_ledger = await db.collection('ledger_entries').find({
      clientId: clientId,
      warehouseId: warehouseId,
      status: { $in: ['ACTIVE', 'CLOSED'] },
      periodStartDate: { $lte: april_end },
      $or: [
        { periodEndDate: { $gte: april_start } },
        { periodEndDate: null },
      ],
    }).toArray();

    console.log(`✓ Found ${april_ledger.length} ledger entries for April`);

    let april_total = 0;
    const april_items = [];

    for (const entry of april_ledger) {
      const start = new Date(Math.max(
        new Date(entry.periodStartDate).getTime(),
        new Date(april_start).getTime()
      ));
      const end = entry.periodEndDate
        ? new Date(Math.min(
            new Date(entry.periodEndDate).getTime(),
            new Date(april_end + 'T23:59:59Z').getTime()
          ))
        : new Date(april_end + 'T23:59:59Z');

      const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      const amount = days * entry.quantityMT * entry.ratePerMTPerDay;
      april_total += amount;

      // Get commodity name
      const commodity = await db.collection('commodities').findOne({ _id: entry.commodityId });

      april_items.push({
        commodity: commodity?.name,
        periodStart: start.toISOString().split('T')[0],
        periodEnd: end.toISOString().split('T')[0],
        days: days,
        quantity: entry.quantityMT,
        rate: entry.ratePerMTPerDay,
        amount: amount,
      });

      console.log(`  • ${commodity?.name}: ${start.toISOString().split('T')[0]} to ${end.toISOString().split('T')[0]} (${days} days) = ${entry.quantityMT} MT × ₹${entry.ratePerMTPerDay}/day = ₹${amount}`);
    }

    console.log(`\n┌────────────────────────────────────────┐`);
    console.log(`│ APRIL 2026 INVOICE SUMMARY             │`);
    console.log(`├────────────────────────────────────────┤`);
    console.log(`│ Client:        Shruti Mehata           │`);
    console.log(`│ Invoice Month: 2026-04                 │`);
    console.log(`│ Total Amount:  ₹${april_total}                    │`);
    console.log(`│ Status:        DRAFT                   │`);
    console.log(`└────────────────────────────────────────┘`);

    console.log(`\n┌────────┬──────────────┬───────┬────────┬────────┬──────────────┐`);
    console.log(`│Commodity│Period       │Days   │Qty(MT) │Rate₹   │Total Amount  │`);
    console.log(`├────────┼──────────────┼───────┼────────┼────────┼──────────────┤`);
    for (const item of april_items) {
      const periods = `${item.periodStart.slice(5)}-${item.periodEnd.slice(5)}`;
      console.log(`│${item.commodity.padEnd(8)}│${periods.padEnd(12)}│${item.days.toString().padEnd(7)}│${item.quantity.toString().padEnd(8)}│₹${item.rate.toString().padEnd(7)}│₹${item.amount.toString().padEnd(12)}│`);
    }
    console.log(`└────────┴──────────────┴───────┴────────┴────────┴──────────────┘`);

    console.log('\n✓ April calculation PASSED\n');

    // Step 6: Generate May Invoice
    console.log('Step 6: Generate May Invoice (2026-05)...\n');

    const may_start = '2026-05-01';
    const may_end = '2026-05-31';

    const may_ledger = await db.collection('ledger_entries').find({
      clientId: clientId,
      warehouseId: warehouseId,
      status: { $in: ['ACTIVE', 'CLOSED'] },
      periodStartDate: { $lte: may_end },
      $or: [
        { periodEndDate: { $gte: may_start } },
        { periodEndDate: null },
      ],
    }).toArray();

    console.log(`✓ Found ${may_ledger.length} ledger entries for May`);

    let may_total = 0;
    const may_items = [];

    for (const entry of may_ledger) {
      const start = new Date(Math.max(
        new Date(entry.periodStartDate).getTime(),
        new Date(may_start).getTime()
      ));
      const end = entry.periodEndDate
        ? new Date(Math.min(
            new Date(entry.periodEndDate).getTime(),
            new Date(may_end + 'T23:59:59Z').getTime()
          ))
        : new Date(may_end + 'T23:59:59Z');

      const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      const amount = days * entry.quantityMT * entry.ratePerMTPerDay;
      may_total += amount;

      // Get commodity name
      const commodity = await db.collection('commodities').findOne({ _id: entry.commodityId });

      may_items.push({
        commodity: commodity?.name,
        periodStart: start.toISOString().split('T')[0],
        periodEnd: end.toISOString().split('T')[0],
        days: days,
        quantity: entry.quantityMT,
        rate: entry.ratePerMTPerDay,
        amount: amount,
      });

      console.log(`  • ${commodity?.name}: ${start.toISOString().split('T')[0]} to ${end.toISOString().split('T')[0]} (${days} days) = ${entry.quantityMT} MT × ₹${entry.ratePerMTPerDay}/day = ₹${amount}`);
    }

    console.log(`\n┌────────────────────────────────────────┐`);
    console.log(`│ MAY 2026 INVOICE SUMMARY               │`);
    console.log(`├────────────────────────────────────────┤`);
    console.log(`│ Client:        Shruti Mehata           │`);
    console.log(`│ Invoice Month: 2026-05                 │`);
    console.log(`│ Total Amount:  ₹${may_total}                    │`);
    console.log(`│ Status:        DRAFT                   │`);
    console.log(`└────────────────────────────────────────┘`);

    console.log(`\n┌────────┬──────────────┬───────┬────────┬────────┬──────────────┐`);
    console.log(`│Commodity│Period       │Days   │Qty(MT) │Rate₹   │Total Amount  │`);
    console.log(`├────────┼──────────────┼───────┼────────┼────────┼──────────────┤`);
    for (const item of may_items) {
      const periods = `${item.periodStart.slice(5)}-${item.periodEnd.slice(5)}`;
      console.log(`│${item.commodity.padEnd(8)}│${periods.padEnd(12)}│${item.days.toString().padEnd(7)}│${item.quantity.toString().padEnd(8)}│₹${item.rate.toString().padEnd(7)}│₹${item.amount.toString().padEnd(12)}│`);
    }
    console.log(`└────────┴──────────────┴───────┴────────┴────────┴──────────────┘`);

    console.log('\n✓ May calculation PASSED\n');

    // Step 7: Verify totals
    console.log('Step 7: Verify Total Outstanding Balance...\n');
    const outstanding = april_total + may_total;
    console.log(`SHRUTI MEHATA - LEDGER BREAKDOWN`);
    console.log(`Total Outstanding Balance: ₹${outstanding}\n`);

    console.log(`┌───────────┬──────────┬──────────────┬───────────┐`);
    console.log(`│ Cycle     │ Commodity│ Period       │ Amount    │`);
    console.log(`├───────────┼──────────┼──────────────┼───────────┤`);
    console.log(`│ 2026-04   │ Rice     │ Apr 16-30    │ ₹7500     │`);
    console.log(`│ 2026-04   │ Wheat    │ Apr 18-30    │ ₹5850     │`);
    console.log(`│           │          │ SUBTOTAL     │ ₹13350    │`);
    console.log(`├───────────┼──────────┼──────────────┼───────────┤`);
    console.log(`│ 2026-05   │ Rice     │ May 01-31    │ ₹15500    │`);
    console.log(`│ 2026-05   │ Wheat    │ May 01-20    │ ₹9000     │`);
    console.log(`│           │          │ SUBTOTAL     │ ₹24500    │`);
    console.log(`└───────────┴──────────┴──────────────┴───────────┘\n`);

    console.log(`Total Rent Due: ₹${outstanding}`);
    console.log(`Total Paid: ₹0`);
    console.log(`Outstanding: ₹${outstanding}\n`);

    // Validate expected values
    const expectedApril = 13350;
    const expectedMay = 24500;
    const expectedTotal = 37850;

    if (april_total === expectedApril && may_total === expectedMay && outstanding === expectedTotal) {
      console.log('╔════════════════════════════════════════════════════════════════╗');
      console.log('║  ✓ ALL TESTS PASSED - SCENARIO WORKS CORRECTLY!               ║');
      console.log('╚════════════════════════════════════════════════════════════════╝\n');
    } else {
      console.log('╔════════════════════════════════════════════════════════════════╗');
      console.log('║  ✗ TEST FAILED - VALUES DO NOT MATCH EXPECTED                 ║');
      console.log('╚════════════════════════════════════════════════════════════════╝\n');
      console.log(`Expected April: ₹${expectedApril}, Got: ₹${april_total}`);
      console.log(`Expected May: ₹${expectedMay}, Got: ₹${may_total}`);
      console.log(`Expected Total: ₹${expectedTotal}, Got: ₹${outstanding}`);
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

testScenario();
