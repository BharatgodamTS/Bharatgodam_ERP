'use client';

import React from 'react';
import ClientForm from '@/components/features/clients/ClientForm';
import ClientList from '@/components/features/clients/ClientList';

export default function ClientsPage() {
  return (
    <div className="min-h-screen bg-slate-50 py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold text-slate-900 mb-8">Client Management</h1>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div>
            <ClientForm />
          </div>
          <div>
            <ClientList />
          </div>
        </div>
      </div>
    </div>
  );
}