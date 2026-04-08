'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, CalendarCheck, FileText, Menu, X, Box, BarChart2, DollarSign } from 'lucide-react';
import { useState } from 'react';
import LogoutButton from '@/components/features/auth/logout-button';

const navItems = [
  { name: 'Dashboard', href: '/dashboard', icon: Home },
  { name: 'Book Warehouse', href: '/dashboard/bookings', icon: CalendarCheck },
  { name: 'Logistics Report', href: '/dashboard/reports', icon: BarChart2 },
  { name: 'Revenue Distribution', href: '/dashboard/revenue-distribution', icon: DollarSign },
  { name: 'Invoices', href: '/dashboard/invoices', icon: FileText },
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
