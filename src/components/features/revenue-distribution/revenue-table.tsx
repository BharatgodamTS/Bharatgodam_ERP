import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Building2, User, Percent } from 'lucide-react';
import { formatCurrency } from '@/lib/distribution-engine';
import { WarehouseRevenue } from '@/lib/revenue-types';

interface RevenueTableProps {
  data: WarehouseRevenue[];
}

export default function RevenueTable({ data }: RevenueTableProps) {
  if (data.length === 0) {
    return (
      <div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-200 text-center">
        <Building2 className="h-12 w-12 text-slate-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-slate-900 mb-2">No Revenue Data</h3>
        <p className="text-slate-500 text-center">
          No paid invoices found for the selected month.
          Revenue distribution will appear here once payments are recorded.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="p-6 border-b border-slate-200">
        <h3 className="text-xl font-semibold text-slate-900">Warehouse Revenue Distribution</h3>
        <p className="text-slate-600 mt-1">Monthly breakdown of revenue sharing between warehouse owners and platform operators</p>
      </div>
      <div className="p-6">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-slate-600">
            <thead className="bg-slate-50 text-slate-900 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 text-left font-semibold">Warehouse</th>
                <th className="px-6 py-4 text-left font-semibold">Owner</th>
                <th className="px-6 py-4 text-left font-semibold">Equity</th>
                <th className="px-6 py-4 text-right font-semibold">Total Revenue</th>
                <th className="px-6 py-4 text-right font-semibold">Owner Share (60%)</th>
                <th className="px-6 py-4 text-right font-semibold">Operator Share (40%)</th>
                <th className="px-6 py-4 text-right font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.map((warehouse) => (
                <tr key={warehouse.warehouseName} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center w-8 h-8 bg-blue-100 rounded-lg">
                        <Building2 className="h-4 w-4 text-blue-600" />
                      </div>
                      <div>
                        <div className="font-semibold text-slate-900">
                          {warehouse.warehouseName}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-slate-400" />
                      <span className="font-medium">{warehouse.ownerName}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <Badge variant="secondary" className="flex items-center gap-1 w-fit">
                      <Percent className="h-3 w-3" />
                      {warehouse.ownerEquity}%
                    </Badge>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="font-semibold text-slate-900">
                      {formatCurrency(warehouse.totalRevenue)}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="font-semibold text-green-700">
                      {formatCurrency(warehouse.ownerShare)}
                    </div>
                    <div className="text-xs text-slate-500">
                      {warehouse.totalRevenue > 0 ? ((warehouse.ownerShare / warehouse.totalRevenue) * 100).toFixed(1) : '0.0'}%
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="font-semibold text-blue-700">
                      {formatCurrency(warehouse.operatorShare)}
                    </div>
                    <div className="text-xs text-slate-500">
                      {warehouse.totalRevenue > 0 ? ((warehouse.operatorShare / warehouse.totalRevenue) * 100).toFixed(1) : '0.0'}%
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${warehouse.status === 'Settled' ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-700'}`}>
                      {warehouse.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-slate-50 border-t border-slate-200">
              <tr>
                <td colSpan={3} className="px-6 py-4 font-semibold text-slate-900">
                  Total Distribution
                </td>
                <td className="px-6 py-4 text-right font-bold text-slate-900">
                  {formatCurrency(data.reduce((sum, w) => sum + w.totalRevenue, 0))}
                </td>
                <td className="px-6 py-4 text-right font-bold text-green-700">
                  {formatCurrency(data.reduce((sum, w) => sum + w.ownerShare, 0))}
                </td>
                <td className="px-6 py-4 text-right font-bold text-blue-700">
                  {formatCurrency(data.reduce((sum, w) => sum + w.operatorShare, 0))}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}