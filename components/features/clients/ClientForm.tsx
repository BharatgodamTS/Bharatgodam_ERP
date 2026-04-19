'use client';

import React, { useState } from 'react';
import { useWarehouse } from '@/contexts/WarehouseContext';

export default function ClientForm() {
  const { addClient } = useWarehouse();
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    type: 'Farmer' as 'Farmer' | 'FPO' | 'Company',
    mobile: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.name && formData.address && formData.mobile) {
      addClient(formData);
      setFormData({ name: '', address: '', type: 'Farmer', mobile: '' });
    }
  };

  return (
    <div className="bg-white shadow-sm border border-slate-200 rounded-xl p-6 mb-6">
      <h3 className="text-lg font-semibold text-slate-800 mb-4">Client Onboarding</h3>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-slate-700 mb-1">
            Name *
          </label>
          <input
            type="text"
            id="name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            required
            className="w-full rounded-md border border-slate-300 p-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            placeholder="Enter client name"
          />
        </div>
        <div>
          <label htmlFor="address" className="block text-sm font-medium text-slate-700 mb-1">
            Address *
          </label>
          <input
            type="text"
            id="address"
            name="address"
            value={formData.address}
            onChange={handleChange}
            required
            className="w-full rounded-md border border-slate-300 p-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            placeholder="Enter client address"
          />
        </div>
        <div>
          <label htmlFor="type" className="block text-sm font-medium text-slate-700 mb-1">
            Type *
          </label>
          <select
            id="type"
            name="type"
            value={formData.type}
            onChange={handleChange}
            required
            className="w-full rounded-md border border-slate-300 p-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value="Farmer">Farmer</option>
            <option value="FPO">FPO</option>
            <option value="Company">Company</option>
          </select>
        </div>

        <div>
          <label htmlFor="mobile" className="block text-sm font-medium text-slate-700 mb-1">
            Mobile *
          </label>
          <input
            type="tel"
            id="mobile"
            name="mobile"
            value={formData.mobile}
            onChange={handleChange}
            required
            className="w-full rounded-md border border-slate-300 p-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            placeholder="Enter mobile number"
          />
        </div>
        <button
          type="submit"
          className="w-full bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors"
        >
          Add Client
        </button>
      </form>
    </div>
  );
}