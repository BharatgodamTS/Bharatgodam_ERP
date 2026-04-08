import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { Box, Layers, DollarSign, Clock3, TrendingUp } from 'lucide-react';
import { getDb } from '@/lib/mongodb';
import BookingTrendChart from '@/components/features/dashboard/booking-trend-chart';
import WarehouseInventory from '@/components/features/warehouse/warehouse-inventory';

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(value);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(value);
}

function buildDayLabels(currentMonth: Date) {
  const daysInMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate();
  return Array.from({ length: daysInMonth }, (_, index) => {
    const day = index + 1;
    return {
      key: `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
      label: day.toString(),
    };
  });
}

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect('/');
  }

  const db = await getDb();
  const now = new Date();
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const [bookingAnalytics] = await db.collection('bookings').aggregate([
    {
      $facet: {
        totals: [
          { $count: 'totalBookings' }
        ],
        activeInventory: [
          { $match: { status: { $ne: 'WITHDRAWN' } } },
          { $group: { _id: null, totalMt: { $sum: '$weightTons' } } }
        ],
        dailyTrend: [
          { $match: { createdAt: { $gte: currentMonthStart, $lt: currentMonthEnd } } },
          {
            $group: {
              _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
              count: { $sum: 1 }
            }
          },
          { $sort: { _id: 1 } }
        ],
        commodityBreakdown: [
          { $match: { status: { $ne: 'WITHDRAWN' } } },
          { $group: { _id: '$commodity', totalMt: { $sum: '$weightTons' } } },
          { $sort: { totalMt: -1 } }
        ]
      }
    }
  ]).toArray();

  const invoiceAggregation = await db.collection('invoices').aggregate([
    {
      $group: {
        _id: null,
        totalRevenuePaise: {
          $sum: {
            $round: [{ $multiply: [{ $ifNull: ['$paidAmount', 0] }, 100] }, 0]
          }
        },
        totalPendingPaise: {
          $sum: {
            $round: [{ $multiply: [{ $subtract: [{ $ifNull: ['$totalAmount', 0] }, { $ifNull: ['$paidAmount', 0] }] }, 100] }, 0]
          }
        }
      }
    }
  ]).toArray();

  const totalBookings = bookingAnalytics?.totals?.[0]?.totalBookings ?? 0;
  const activeInventory = bookingAnalytics?.activeInventory?.[0]?.totalMt ?? 0;
  const dailyTrend = bookingAnalytics?.dailyTrend ?? [];
  const commodityBreakdown = bookingAnalytics?.commodityBreakdown ?? [];

  const totalRevenue = (invoiceAggregation?.[0]?.totalRevenuePaise ?? 0) / 100;
  const pendingReceivables = (invoiceAggregation?.[0]?.totalPendingPaise ?? 0) / 100;

  const dayLabels = buildDayLabels(now);
  const dailyData = dayLabels.map((day) => {
    const entry = dailyTrend.find((row: any) => row._id === day.key);
    return {
      day: day.label,
      bookings: entry ? entry.count : 0,
    };
  });

  const stats = [
    {
      name: 'Total Bookings',
      value: formatNumber(totalBookings),
      icon: Box,
      color: 'text-blue-600',
      bg: 'bg-blue-100',
    },
    {
      name: 'Active Inventory (MT)',
      value: formatNumber(activeInventory),
      icon: Layers,
      color: 'text-sky-600',
      bg: 'bg-sky-100',
    },
    {
      name: 'Total Revenue',
      value: formatCurrency(totalRevenue),
      icon: DollarSign,
      color: 'text-emerald-600',
      bg: 'bg-emerald-100',
    },
    {
      name: 'Pending Receivables',
      value: formatCurrency(pendingReceivables),
      icon: Clock3,
      color: 'text-orange-600',
      bg: 'bg-orange-100',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Command Center</h1>
        <p className="text-slate-500">
          Welcome back, {session.user?.email} • Role: {(session.user as any)?.role}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.name} className="overflow-hidden rounded-3xl bg-white p-6 shadow-sm border border-slate-100">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-slate-500">{stat.name}</p>
                  <p className="mt-3 text-3xl font-semibold text-slate-900">{stat.value}</p>
                </div>
                <div className={`p-3 rounded-2xl ${stat.bg}`}>
                  <Icon className={`h-6 w-6 ${stat.color}`} aria-hidden="true" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-6">
        <div className="rounded-3xl bg-white p-6 shadow-sm border border-slate-100">
          <div className="mb-6 flex items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Booking Volume (Current Month)</h3>
              <p className="text-sm text-slate-500">Daily bookings for {new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric' }).format(now)}.</p>
            </div>
            <TrendingUp className="h-5 w-5 text-slate-400" />
          </div>
          <BookingTrendChart data={dailyData} />
        </div>
      </div>

      {/* Warehouse Inventory Section */}
      <div className="rounded-3xl bg-slate-50 p-6 border border-slate-200">
        <WarehouseInventory />
      </div>
    </div>
  );
}
