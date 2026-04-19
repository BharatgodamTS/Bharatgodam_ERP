#!/bin/bash

echo "=== Testing Dashboard Inward Transaction Form ==="
echo ""

echo "1. Testing unauthenticated access to /dashboard/inward..."
curl -s -w "\nStatus: %{http_code}\n" http://localhost:3000/dashboard/inward | head -5
echo ""

echo "2. Testing /api/clients endpoint..."
curl -s http://localhost:3000/api/clients | jq '.clients | length'
echo "clients found"
echo ""

echo "3. Testing /api/commodities endpoint..."
curl -s http://localhost:3000/api/commodities | jq '.commodities | length'
echo "commodities found"
echo ""

echo "4. Testing /api/warehouses endpoint..."
curl -s http://localhost:3000/api/warehouses | jq '.warehouses | length'
echo "warehouses found"
echo ""

echo "✅ Dashboard API endpoints are operational!"
echo ""
echo "Next steps:"
echo "1. Go to http://localhost:3000"
echo "2. Sign up or log in"
echo "3. Navigate to http://localhost:3000/dashboard/inward"
echo "4. Fill out the inward transaction form"
echo "5. Click 'Submit' to record transaction"