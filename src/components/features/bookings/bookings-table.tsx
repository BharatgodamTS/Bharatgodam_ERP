'use client';

import React from 'react';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Eye, Package, Truck, Calendar, MapPin, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatCurrency } from '@/lib/utils/currency';

interface Booking {
  id: string;
  customerName: string;
  commodity: string;
  weightTons: number;
  truckNumber: string;
  startDate: string;
  endDate: string;
  status: string;
  createdAt: string;
}

interface BookingsTableProps {
  bookings: Booking[];
  totalMt: number;
  totalBags: number;
}

export default function BookingsTable({ bookings, totalMt, totalBags }: BookingsTableProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING_APPROVAL':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'APPROVED':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'REJECTED':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'OUTWARD':
        return 'bg-green-100 text-green-800 border-green-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const formatStatus = (status: string) => {
    return status.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
  };

  if (bookings.length === 0) {
    return (
      <div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-200 text-center">
        <Package className="h-12 w-12 text-slate-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-slate-900 mb-2">No bookings found</h3>
        <p className="text-slate-500">Try adjusting your filters or create a new booking.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">Total MT</p>
              <p className="text-2xl font-bold text-slate-900">{totalMt.toFixed(2)} MT</p>
            </div>
            <Package className="h-8 w-8 text-blue-500" />
          </div>
        </div>
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">Total Bags</p>
              <p className="text-2xl font-bold text-slate-900">{totalBags.toLocaleString()}</p>
            </div>
            <Truck className="h-8 w-8 text-green-500" />
          </div>
        </div>
      </div>

      {/* Bookings Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-slate-900 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 font-semibold">Booking ID</th>
                <th className="px-6 py-4 font-semibold">Customer</th>
                <th className="px-6 py-4 font-semibold">Commodity</th>
                <th className="px-6 py-4 font-semibold">Weight</th>
                <th className="px-6 py-4 font-semibold">Truck</th>
                <th className="px-6 py-4 font-semibold">Date Range</th>
                <th className="px-6 py-4 font-semibold">Status</th>
                <th className="px-6 py-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {bookings.map((booking) => (
                <tr key={booking.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 font-medium text-slate-900">
                    #{booking.id.substring(0, 8).toUpperCase()}
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-semibold text-slate-800">{booking.customerName}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <Package className="h-4 w-4 text-slate-400" />
                      <span className="font-medium">{booking.commodity}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 font-medium text-slate-900">
                    {booking.weightTons} MT
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <Truck className="h-4 w-4 text-slate-400" />
                      <span className="font-mono text-sm">{booking.truckNumber}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1 text-xs text-slate-500">
                        <Calendar className="h-3 w-3" />
                        <span>Start: {(() => {
                          try {
                            return format(new Date(booking.startDate), 'MMM dd, yyyy');
                          } catch {
                            return 'Invalid date';
                          }
                        })()}</span>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-slate-500">
                        <Calendar className="h-3 w-3" />
                        <span>End: {(() => {
                          try {
                            return format(new Date(booking.endDate), 'MMM dd, yyyy');
                          } catch {
                            return 'Invalid date';
                          }
                        })()}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <Badge className={`${getStatusColor(booking.status)} border`}>
                      {formatStatus(booking.status)}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Button variant="ghost" size="sm" className="text-slate-500 hover:text-slate-700">
                      <Eye className="h-4 w-4 mr-1" />
                      View
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
