'use client';

import React from 'react';
import CommodityForm from '@/components/features/commodities/CommodityForm';
import CommodityList from '@/components/features/commodities/CommodityList';

export default function CommoditiesPage() {
  return (
    <div className="min-h-screen bg-slate-50 py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold text-slate-900 mb-8">Commodity Management</h1>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div>
            <CommodityForm />
          </div>
          <div>
            <CommodityList />
          </div>
        </div>
      </div>
    </div>
  );
}