'use client';

import React from 'react';
import { useWarehouse } from '@/contexts/WarehouseContext';

export default function ClientList() {
  const { clients } = useWarehouse();

  if (clients.length === 0) {
    return (
      <div className="bg-white shadow-sm border border-slate-200 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-slate-800 mb-4">Added Clients</h3>
        <p className="text-slate-500 text-sm">No clients added yet.</p>
      </div>
    );
  }

  return (
    <div className="bg-white shadow-sm border border-slate-200 rounded-xl p-6">
      <h3 className="text-lg font-semibold text-slate-800 mb-4">Added Clients</h3>
      <div className="space-y-3">
        {clients.map(client => (
          <div key={client.id} className="border border-slate-200 rounded-lg p-4 bg-slate-50">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <div>
                <span className="text-xs font-semibold text-slate-600 uppercase">Name</span>
                <p className="text-sm text-slate-800">{client.name}</p>
              </div>
              <div>
                <span className="text-xs font-semibold text-slate-600 uppercase">Address</span>
                <p className="text-sm text-slate-800">{client.address}</p>
              </div>
              <div>
                <span className="text-xs font-semibold text-slate-600 uppercase">Type</span>
                <p className="text-sm text-slate-800">{client.type}</p>
              </div>
              <div>
                <span className="text-xs font-semibold text-slate-600 uppercase">Mobile</span>
                <p className="text-sm text-slate-800">{client.mobile}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}