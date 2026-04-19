'use client';

import React from 'react';
import { useWarehouse } from '@/contexts/WarehouseContext';

export default function CommodityList() {
  const { commodities } = useWarehouse();

  if (commodities.length === 0) {
    return (
      <div className="bg-white shadow-sm border border-slate-200 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-slate-800 mb-4">Commodities</h3>
        <p className="text-slate-500 text-sm">No commodities added yet.</p>
      </div>
    );
  }

  return (
    <div className="bg-white shadow-sm border border-slate-200 rounded-xl p-6">
      <h3 className="text-lg font-semibold text-slate-800 mb-4">Commodities</h3>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                Rate per MT
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                Unit
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-slate-200">
            {commodities.map(commodity => (
              <tr key={commodity.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">
                  {commodity.name}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                  ₹{commodity.rate}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                  Per {commodity.rateUnit}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}