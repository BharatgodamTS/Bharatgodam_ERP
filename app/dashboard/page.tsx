import Link from 'next/link';
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
  const currentMonthStartStr = currentMonthStart.toISOString().slice(0, 10);
  const currentMonthEndStr = currentMonthEnd.toISOString().slice(0, 10);

  const [transactionAnalytics] = await db.collection('transactions').aggregate([
    {
      $project: {
        direction: 1,
        quantityMT: 1,
        commodityName: 1,
        date: 1,
        dateString: {
          $cond: [
            { $eq: [{ $type: '$date' }, 'date'] },
            { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
            { $substrCP: ['$date', 0, 10] }
          ]
        }
      }
    },
    {
      $facet: {
        totals: [
          { $count: 'totalTransactions' }
        ],
        activeInventory: [
          {
            $group: {
              _id: null,
              totalInward: {
                $sum: {
                  $cond: [
                    { $eq: ['$direction', 'INWARD'] },
                    '$quantityMT',
                    0
                  ]
                }
              },
              totalOutward: {
                $sum: {
                  $cond: [
                    { $eq: ['$direction', 'OUTWARD'] },
                    '$quantityMT',
                    0
                  ]
                }
              }
            }
          },
          {
            $project: {
              netInventory: { $subtract: ['$totalInward', '$totalOutward'] }
            }
          }
        ],
        dailyTrend: [
          {
            $match: {
              dateString: {
                $gte: currentMonthStartStr,
                $lt: currentMonthEndStr
              }
            }
          },
          {
            $group: {
              _id: '$dateString',
              count: { $sum: 1 }
            }
          },
          { $sort: { _id: 1 } }
        ],
        commodityBreakdown: [
          {
            $group: {
              _id: '$commodityName',
              totalMt: {
                $sum: {
                  $cond: [
                    { $eq: ['$direction', 'INWARD'] },
                    '$quantityMT',
                    { $multiply: ['$quantityMT', -1] }
                  ]
                }
              }
            }
          },
          {
            $project: {
              commodityName: '$_id',
              totalMt: { $max: ['$totalMt', 0] },
              _id: 0
            }
          },
          { $match: { totalMt: { $gt: 0 } } },
          { $sort: { totalMt: -1 } }
        ]
      }
    }
  ]).toArray();

  const [invoiceAggregation, activeWarehouseCount, activeClientCount, invoiceCount, ledgerEntryCount] = await Promise.all([
    db.collection('invoices').aggregate([
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
    ]).toArray(),
    db.collection('warehouses').countDocuments({ status: 'ACTIVE' }),
    db.collection('clients').countDocuments({ status: 'ACTIVE' }),
    db.collection('invoices').countDocuments(),
    db.collection('ledger_entries').countDocuments()
  ]);

  const totalTransactions = transactionAnalytics?.totals?.[0]?.totalTransactions ?? 0;
  const activeInventory = transactionAnalytics?.activeInventory?.[0]?.netInventory ?? 0;
  const dailyTrend = transactionAnalytics?.dailyTrend ?? [];
  const commodityBreakdown = transactionAnalytics?.commodityBreakdown ?? [];

  const totalRevenue = (invoiceAggregation?.[0]?.totalRevenuePaise ?? 0) / 100;
  const pendingReceivables = (invoiceAggregation?.[0]?.totalPendingPaise ?? 0) / 100;

  const masterLinks = [
    { name: 'Active Warehouses', value: activeWarehouseCount, href: '/dashboard/warehouses' },
    { name: 'Active Clients', value: activeClientCount, href: '/dashboard/clients' },
    { name: 'Invoices', value: invoiceCount, href: '/dashboard/invoices' },
    { name: 'Ledger Entries', value: ledgerEntryCount, href: '/dashboard/ledger' }
  ];

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
      name: 'Total Transactions',
      value: formatNumber(totalTransactions),
      icon: Box,
      color: 'text-blue-600',
      bg: 'bg-blue-100',
    },
    {
      name: 'Current Inventory (MT)',
      value: formatNumber(Math.max(activeInventory, 0)),
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
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
          {masterLinks.map((item) => (
            <Link key={item.name} href={item.href} className="rounded-3xl bg-white p-5 shadow-sm border border-slate-100 transition hover:border-slate-300">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{item.name}</p>
              <p className="mt-4 text-3xl font-semibold text-slate-900">{formatNumber(item.value)}</p>
            </Link>
          ))}
        </div>

        <div className="rounded-3xl bg-white p-6 shadow-sm border border-slate-100">
          <div className="mb-6 flex items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Transaction Volume (Current Month)</h3>
              <p className="text-sm text-slate-500">Daily transaction count for {new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric' }).format(now)}.</p>
            </div>
            <TrendingUp className="h-5 w-5 text-slate-400" />
          </div>
          <BookingTrendChart data={dailyData} />
        </div>
      </div>

      <div className="rounded-3xl bg-white p-6 shadow-sm border border-slate-100">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Current Inventory by Commodity</h3>
            <p className="text-sm text-slate-500">Net stock from inward and outward transactions.</p>
          </div>
        </div>

        {commodityBreakdown.length === 0 ? (
          <div className="mt-6 text-slate-600">No current inventory records available.</div>
        ) : (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {commodityBreakdown.map((item: any) => (
              <div key={item.commodityName} className="rounded-3xl bg-slate-50 p-5 border border-slate-200">
                <p className="text-sm text-slate-500">{item.commodityName}</p>
                <p className="mt-3 text-2xl font-semibold text-slate-900">{formatNumber(item.totalMt)}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Warehouse Inventory Section */}
      <div className="rounded-3xl bg-slate-50 p-6 border border-slate-200">
        <WarehouseInventory />
      </div>
    </div>
  );
}
