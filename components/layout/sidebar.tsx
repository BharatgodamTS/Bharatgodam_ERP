'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, LayoutDashboard, Package, Users, ArrowDownToLine, ArrowUpFromLine, FileText, Menu, X, Box, BarChart2, DollarSign, Receipt } from 'lucide-react';
import LogoutButton from '@/components/features/auth/logout-button';

const navItems = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Warehouse Master', href: '/dashboard/warehouses', icon: Box },
  { name: 'Commodity Master', href: '/dashboard/commodities', icon: Package },
  { name: 'Client Master', href: '/dashboard/clients', icon: Users },
  { name: 'Inward Transaction', href: '/dashboard/inward', icon: ArrowDownToLine },
  { name: 'Outward Transaction', href: '/dashboard/outward', icon: ArrowUpFromLine },
  { name: 'Transactions Report', href: '/dashboard/transactions-report', icon: BarChart2 },
  { name: 'Client Invoices', href: '/dashboard/client-invoices', icon: Receipt },
  { name: 'Client Ledger', href: '/dashboard/ledger', icon: FileText },
  { name: 'Revenue Split', href: '/dashboard/revenue', icon: DollarSign },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Mobile Menu Toggle */}
      <div className="md:hidden absolute top-4 right-4 z-50 bg-white p-2 rounded-md shadow">
        <button onClick={() => setIsOpen(!isOpen)} aria-label="Toggle Menu">
          {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* Sidebar Container */}
      <div
        className={`fixed inset-y-0 left-0 z-40 w-64 transform bg-slate-900 text-slate-100 transition-transform duration-300 ease-in-out md:relative md:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-full flex-col">
          {/* Logo Setup */}
          <div className="flex h-20 shrink-0 items-center px-6 border-b border-slate-800">
            <Box className="h-8 w-8 text-blue-500 mr-3" />
            <span className="text-xl font-bold tracking-tight">WMS Pro</span>
          </div>

          {/* Navigation Links */}
          <nav className="flex-1 space-y-1 px-4 py-8">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;
              
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setIsOpen(false)}
                  className={`group flex items-center rounded-md px-3 py-3 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <Icon
                    className={`mr-3 h-5 w-5 shrink-0 ${
                      isActive ? 'text-white' : 'text-slate-400 group-hover:text-white'
                    }`}
                  />
                  {item.name}
                </Link>
              );
            })}
          </nav>

          {/* Logout Section at Bottom */}
          <div className="p-4 border-t border-slate-800">
            <LogoutButton />
          </div>
        </div>
      </div>
    </>
  );
}
