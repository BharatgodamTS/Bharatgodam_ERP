const { MongoClient } = require('mongodb');
(async () => {
  const client = new MongoClient('mongodb://localhost:27017');
  await client.connect();
  const db = client.db('wms_production');
  const lookupStages = [
    {
      $lookup: {
        from: 'clients',
        let: { clientId: '$clientId' },
        pipeline: [
          {
            $match: {
              $expr: {
                $or: [
                  { $eq: ['$_id', '$$clientId'] },
                  {
                    $eq: [
                      '$_id',
                      {
                        $convert: {
                          input: '$$clientId',
                          to: 'objectId',
                          onError: null,
                          onNull: null
                        }
                      }
                    ]
                  }
                ]
              }
            }
          }
        ],
        as: 'client'
      }
    },
    {
      $lookup: {
        from: 'client_accounts',
        let: { clientId: '$clientId' },
        pipeline: [
          {
            $match: {
              $expr: {
                $or: [
                  { $eq: ['$_id', '$$clientId'] },
                  {
                    $eq: [
                      '$_id',
                      {
                        $convert: {
                          input: '$$clientId',
                          to: 'objectId',
                          onError: null,
                          onNull: null
                        }
                      }
                    ]
                  }
                ]
              }
            }
          }
        ],
        as: 'clientAccount'
      }
    },
    {
      $lookup: {
        from: 'warehouses',
        let: { warehouseId: '$warehouseId' },
        pipeline: [
          {
            $match: {
              $expr: {
                $or: [
                  { $eq: ['$_id', '$$warehouseId'] },
                  {
                    $eq: [
                      '$_id',
                      {
                        $convert: {
                          input: '$$warehouseId',
                          to: 'objectId',
                          onError: null,
                          onNull: null
                        }
                      }
                    ]
                  }
                ]
              }
            }
          }
        ],
        as: 'warehouse'
      }
    },
    {
      $lookup: {
        from: 'commodities',
        let: { commodityId: '$commodityId' },
        pipeline: [
          {
            $match: {
              $expr: {
                $or: [
                  { $eq: ['$_id', '$$commodityId'] },
                  {
                    $eq: [
                      '$_id',
                      {
                        $convert: {
                          input: '$$commodityId',
                          to: 'objectId',
                          onError: null,
                          onNull: null
                        }
                      }
                    ]
                  }
                ]
              }
            }
          }
        ],
        as: 'commodity'
      }
    }
  ];
  const tests = [
    { label: 'client.name', expr: { $arrayElemAt: ['$client.name', 0] } },
    { label: 'client.clientName', expr: { $arrayElemAt: ['$client.clientName', 0] } },
    { label: 'client.address', expr: { $arrayElemAt: ['$client.address', 0] } },
    { label: 'client.clientLocation', expr: { $arrayElemAt: ['$client.clientLocation', 0] } },
    { label: 'commodity.name', expr: { $arrayElemAt: ['$commodity.name', 0] } },
    { label: 'warehouse.name', expr: { $arrayElemAt: ['$warehouse.name', 0] } },
    { label: 'warehouse.location', expr: { $arrayElemAt: ['$warehouse.location', 0] } },
    { label: 'warehouse.address', expr: { $arrayElemAt: ['$warehouse.address', 0] } }
  ];
  for (const test of tests) {
    try {
      const res = await db.collection('inwards').aggregate([
        { $match: {} },
        ...lookupStages,
        { $addFields: { client: { $ifNull: [ { $arrayElemAt: ['$client', 0] }, { $arrayElemAt: ['$clientAccount', 0] } ] } } },
        { $project: { value: test.expr } }
      ]).toArray();
      console.log(test.label, 'OK', res.length ? JSON.stringify(res[0].value) : 'EMPTY');
    } catch (error) {
      console.error(test.label, 'ERR', error.message);
    }
  }
  await client.close();
})();
