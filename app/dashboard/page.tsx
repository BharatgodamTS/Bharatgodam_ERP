import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { Box, Layers, IndianRupee, Clock3, ChevronRight } from 'lucide-react';
import { getDb } from '@/lib/mongodb';
import { getTenantFilterForMongo } from '@/lib/ownership';
import TransactionsReportWrapper from '@/components/features/reports/transactions-report-wrapper';
import { getClientRevenueAnalytics } from '@/app/actions/transaction-actions';
import WarehouseInventory from '@/components/features/warehouse/warehouse-inventory';

export const dynamic = 'force-dynamic';

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
  const tenantFilter = getTenantFilterForMongo(session);

  const now = new Date();
  const currentYearStart = new Date(now.getFullYear(), 0, 1);
  const currentYearEnd = new Date(now.getFullYear() + 1, 0, 1);
  const previousYearStart = new Date(now.getFullYear() - 1, 0, 1);
  const previousYearEnd = new Date(now.getFullYear(), 0, 1);

  const transactionMatch: Record<string, unknown> = { ...tenantFilter };
  const currentYearStartStr = currentYearStart.toISOString().slice(0, 10);
  const currentYearEndStr = currentYearEnd.toISOString().slice(0, 10);
  const previousYearStartStr = previousYearStart.toISOString().slice(0, 10);
  const previousYearEndStr = previousYearEnd.toISOString().slice(0, 10);

  const [transactionAnalytics] = await db.collection('inwards').aggregate([
    {
      $match: Object.keys(transactionMatch).length ? transactionMatch : {}
    },
    {
      $project: {
        direction: { $literal: 'INWARD' },
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
      $unionWith: {
        coll: 'outwards',
        pipeline: [
          {
            $match: Object.keys(transactionMatch).length ? transactionMatch : {}
          },
          {
            $project: {
              direction: { $literal: 'OUTWARD' },
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
          }
        ]
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
        quarterTrendCurrent: [
          {
            $match: {
              dateString: {
                $gte: currentYearStartStr,
                $lt: currentYearEndStr
              }
            }
          },
          {
            $group: {
              _id: {
                $toString: {
                  $ceil: {
                    $divide: [
                      {
                        $month: {
                          $cond: [
                            { $eq: [{ $type: '$date' }, 'date'] },
                            '$date',
                            { $dateFromString: { dateString: '$date' } }
                          ]
                        }
                      },
                      3
                    ]
                  }
                }
              },
              count: { $sum: 1 }
            }
          },
          {
            $project: {
              _id: { $concat: ['Q', '$_id'] },
              count: 1
            }
          },
          { $sort: { _id: 1 } }
        ],
        quarterTrendPrevious: [
          {
            $match: {
              dateString: {
                $gte: previousYearStartStr,
                $lt: previousYearEndStr
              }
            }
          },
          {
            $group: {
              _id: {
                $toString: {
                  $ceil: {
                    $divide: [
                      {
                        $month: {
                          $cond: [
                            { $eq: [{ $type: '$date' }, 'date'] },
                            '$date',
                            { $dateFromString: { dateString: '$date' } }
                          ]
                        }
                      },
                      3
                    ]
                  }
                }
              },
              count: { $sum: 1 }
            }
          },
          {
            $project: {
              _id: { $concat: ['Q', '$_id'] },
              count: 1
            }
          },
          { $sort: { _id: 1 } }
        ],
        directionBreakdown: [
          {
            $group: {
              _id: '$direction',
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

  const [invoiceReceivablesResult, paymentsReceivedResult, activeWarehouseCount, activeClientCount, invoiceMasterCount, formalInvoiceCount, transactionInvoiceCountResult, inwardThisMonthResult] = await Promise.all([
    db.collection('invoice_master').aggregate([
      {
        $project: {
          totalAmount: 1,
          paidAmount: { $ifNull: ['$paidAmount', 0] },
          pendingAmount: {
            $max: [
              { $subtract: ['$totalAmount', { $ifNull: ['$paidAmount', 0] }] },
              0
            ]
          },
          status: 1
        }
      },
      { $match: { ...tenantFilter, status: { $ne: 'PAID' }, pendingAmount: { $gt: 0 } } },
      { $group: { _id: null, totalPendingReceivables: { $sum: '$pendingAmount' } } }
    ]).toArray(),
    db.collection('payments').aggregate([
      { $match: { ...tenantFilter, status: 'COMPLETED' } },
      { $group: { _id: null, totalRevenue: { $sum: '$amount' } } }
    ]).toArray(),
    db.collection('warehouses').countDocuments({ ...tenantFilter }),
    db.collection('clients').countDocuments({ ...tenantFilter }),
    db.collection('invoice_master').countDocuments({ ...tenantFilter }),
    db.collection('invoices').countDocuments({ ...tenantFilter }),
    db.collection('transactions').aggregate([
      {
        $project: {
          clientId: 1,
          warehouseId: 1,
          monthKey: {
            $cond: [
              { $eq: [{ $type: '$date' }, 'date'] },
              { $dateToString: { format: '%Y-%m', date: '$date' } },
              { $substrCP: ['$date', 0, 7] }
            ]
          }
        }
      },
      {
        $match: {
          ...tenantFilter,
          clientId: { $exists: true, $ne: null },
          monthKey: { $exists: true, $ne: '' }
        }
      },
      {
        $group: {
          _id: {
            clientId: '$clientId',
            warehouseId: '$warehouseId',
            monthKey: '$monthKey'
          }
        }
      },
      { $count: 'invoicePeriods' }
    ]).toArray(),
    db.collection('inwards').aggregate([
      { $match: Object.keys(tenantFilter).length ? tenantFilter : {} },
      {
        $project: {
          monthString: {
            $cond: [
              { $eq: [{ $type: '$date' }, 'date'] },
              { $dateToString: { format: '%Y-%m', date: '$date' } },
              { $substrCP: ['$date', 0, 7] }
            ]
          }
        }
      },
      {
        $match: {
          monthString: new Date().toISOString().slice(0, 7)
        }
      },
      { $count: 'count' }
    ]).toArray()
  ]);

  const invoiceMasterCountValue = invoiceMasterCount ?? 0;
  const formalInvoiceCountValue = formalInvoiceCount ?? 0;
  const ledgerInvoiceCount = transactionInvoiceCountResult?.[0]?.invoicePeriods ?? 0;
  const invoiceCount = Math.max(invoiceMasterCountValue + formalInvoiceCountValue, ledgerInvoiceCount);

  const totalTransactions = transactionAnalytics?.totals?.[0]?.totalTransactions ?? 0;
  const activeInventory = transactionAnalytics?.activeInventory?.[0]?.netInventory ?? 0;
  const inwardTransactions = transactionAnalytics?.directionBreakdown?.find((item: any) => item._id === 'INWARD')?.count ?? 0;
  const outwardTransactions = transactionAnalytics?.directionBreakdown?.find((item: any) => item._id === 'OUTWARD')?.count ?? 0;
  const commodityBreakdown = transactionAnalytics?.commodityBreakdown ?? [];

  const revenueAnalytics = await getClientRevenueAnalytics();
  const totalRevenue = revenueAnalytics.summary.totalRevenue;
  const pendingReceivables = invoiceReceivablesResult[0]?.totalPendingReceivables ?? 0;

  const inwardThisMonthCount = inwardThisMonthResult?.[0]?.count ?? 0;

  const masterLinks = [
    { name: 'Active Warehouses', value: activeWarehouseCount, href: '/dashboard/warehouses' },
    { name: 'Active Clients', value: activeClientCount, href: '/dashboard/clients' },
    { name: 'Invoices', value: invoiceCount, href: '/dashboard/client-invoices' },
    { name: 'Inwards This Month', value: inwardThisMonthCount, href: '/dashboard/ledger' }
  ];

  const stats: { name: string; value: string; icon: any; color: string; bg: string; href?: string }[] = [
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
    /*
    {
      name: 'Total Revenue',
      value: formatCurrency(totalRevenue),
      icon: IndianRupee,
      href: '/dashboard/revenue',
      color: 'text-emerald-600',
      bg: 'bg-emerald-100',
    },
    */
  ];

  return (
    <div className="space-y-8 pb-12">
      {/* Header Section */}
      <div className="relative overflow-hidden rounded-[2rem] bg-slate-900 p-8 text-white shadow-2xl xl:p-12">
        <div className="relative z-10">
          <h1 className="text-4xl font-black tracking-tight sm:text-5xl lg:text-6xl">
            Command <span className="text-blue-500 italic">Center</span>
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-slate-400">
            Welcome back, <span className="text-white font-semibold">{session.user?.email}</span>. 
            You are managing the system as an <span className="text-blue-400 uppercase tracking-widest text-sm font-bold">{ (session.user as any)?.role }</span>.
          </p>
          
          <div className="mt-8 flex flex-wrap gap-4">
            <div className="flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 backdrop-blur-md">
              <div className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
              <span className="text-xs font-bold uppercase tracking-widest text-slate-300">System Live</span>
            </div>
            <div className="flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 backdrop-blur-md">
              <Clock3 className="h-4 w-4 text-blue-400" />
              <span className="text-xs font-bold uppercase tracking-widest text-slate-300">
                {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
            </div>
          </div>
        </div>
        
        {/* Background Decorative Elements */}
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-blue-600/20 blur-[100px]" />
        <div className="absolute -bottom-20 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-indigo-600/10 blur-[80px]" />
      </div>

      {/* Primary Statistics Grid */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((stat) => {
          const Icon = stat.icon;
          const cardContent = (
            <div className="group relative overflow-hidden rounded-[2rem] bg-white p-8 shadow-sm border border-slate-100 transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-bold uppercase tracking-widest text-slate-400 group-hover:text-slate-600 transition-colors">{stat.name}</p>
                  <p className="mt-4 text-4xl font-black text-slate-900 tracking-tight">{stat.value}</p>
                </div>
                <div className={`rounded-2xl p-4 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3 ${stat.bg}`}>
                  <Icon className={`h-8 w-8 ${stat.color}`} />
                </div>
              </div>
              
              {/* Subtle Progress Indicator or Sparkle */}
              <div className="mt-6 h-1 w-full overflow-hidden rounded-full bg-slate-50">
                <div className={`h-full w-2/3 rounded-full transition-all duration-1000 ${stat.bg.replace('bg-', 'bg-').replace('100', '500')}`} />
              </div>
            </div>
          );

          return stat.href ? (
            <Link key={stat.name} href={stat.href} className="block">
              {cardContent}
            </Link>
          ) : (
            <div key={stat.name}>{cardContent}</div>
          );
        })}
      </div>

      {/* Quick Access Tiles */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {masterLinks.map((item, index) => {
          const colors = [
            'from-blue-500 to-blue-600',
            'from-indigo-500 to-indigo-600',
            'from-emerald-500 to-emerald-600',
            'from-amber-500 to-amber-600'
          ];
          return (
            <Link 
              key={item.name} 
              href={item.href} 
              className="group relative overflow-hidden rounded-3xl bg-white p-6 shadow-sm border border-slate-100 transition-all hover:shadow-lg hover:border-slate-200"
            >
              <div className={`absolute top-0 left-0 h-1 w-full bg-gradient-to-r ${colors[index % colors.length]}`} />
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400 group-hover:text-slate-600">{item.name}</p>
              <p className="mt-4 text-3xl font-black text-slate-900 group-hover:scale-105 transition-transform">{formatNumber(item.value)}</p>
              <div className="mt-2 flex items-center gap-1 text-[10px] font-bold text-slate-400 group-hover:text-blue-500">
                <span>View Details</span>
                <ChevronRight className="h-3 w-3" />
              </div>
            </Link>
          );
        })}
      </div>

      {/* Transaction Analysis Section */}
      <div className="overflow-hidden rounded-[2.5rem] bg-white shadow-sm border border-slate-100">
        <div className="border-b border-slate-50 bg-slate-50/50 p-8 xl:p-10">
          <div className="flex flex-col gap-8 xl:flex-row xl:items-end xl:justify-between">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full bg-blue-100 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-blue-600">
                Live Data
              </div>
              <h3 className="text-2xl font-black text-slate-900">Transaction Analysis</h3>
              <p className="max-w-md text-sm text-slate-500 font-medium">Real-time breakdown of inward and outward movements across all managed facilities.</p>
            </div>
            
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Inward', val: inwardTransactions, theme: 'blue' },
                { label: 'Outward', val: outwardTransactions, theme: 'amber' },
                { label: 'Total', val: totalTransactions, theme: 'slate' }
              ].map(box => (
                <div key={box.label} className="rounded-2xl bg-white px-5 py-4 shadow-sm border border-slate-100">
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">{box.label}</p>
                  <p className={`mt-1 text-xl font-black text-${box.theme}-600`}>{formatNumber(box.val)}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="p-4 sm:p-8">
          <TransactionsReportWrapper />
        </div>
      </div>

      {/* Global Inventory Snapshot */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-4">
          <h3 className="text-xl font-black text-slate-900 tracking-tight">Global Inventory Snapshot</h3>
          <Link href="/dashboard/warehouses" className="text-xs font-bold text-blue-600 hover:underline">Manage Warehouses</Link>
        </div>
        <div className="rounded-[2.5rem] overflow-hidden shadow-2xl shadow-blue-900/5">
          <WarehouseInventory />
        </div>
      </div>
    </div>
  );
}
