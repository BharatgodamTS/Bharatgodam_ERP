'use client';

import React, { useState } from 'react';
import { MongoCommodityRate } from '@/lib/validations/rate-master';
import RateFormModal from './rate-form-modal';
import { differenceInDays, format } from 'date-fns';
import { Search, Plus, Trash2, CalendarDays, TrendingUp, ArchiveX, AlertTriangle } from 'lucide-react';
import { deleteRate } from '@/app/actions/rates';
import { toast } from 'react-hot-toast';

export default function RatesDashboard({ initialRates }: { initialRates: MongoCommodityRate[] }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Local optimistic deletion tracking
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Obliterate Season Rate Configuration for ${name}? This action strictly cannot be undone.`)) return;

    // Instantly hide it from UI (Optimistic Rendering)
    setDeletedIds(prev => new Set(prev).add(id));
    
    try {
      const result = await deleteRate(id);
      if (result.success) {
        toast.success(`${name} Rate deleted from master cluster.`);
      } else {
        toast.error('Failure removing Rate.');
        setDeletedIds(prev => { const n = new Set(prev); n.delete(id); return n; });
      }
    } catch {
      toast.error('Network crash. Reverting UI.');
      setDeletedIds(prev => { const n = new Set(prev); n.delete(id); return n; });
    }
  };

  // Smart Context Filtering
  const displayRates = initialRates
    .filter(r => !deletedIds.has(r._id))
    .filter(r => r.name.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      
      {/* Background Dimming Form Layer */}
      <RateFormModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />

      {/* Controller Header Nav */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div className="relative w-full sm:max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text" 
            placeholder="Search commodity via String (e.g. WHEAT)..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 font-medium transition-all outline-none"
          />
        </div>
        
        <button 
          onClick={() => setIsModalOpen(true)}
          className="w-full sm:w-auto px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl shadow-md shadow-indigo-200 disabled:opacity-50 transition-all flex items-center justify-center transform hover:-translate-y-0.5"
        >
          <Plus className="w-5 h-5 mr-1.5" />
          Add Seasonal Rate
        </button>
      </div>

      {/* Massive Data Render Table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-slate-900 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 font-extrabold uppercase text-xs tracking-wider">Commodity Target</th>
                <th className="px-6 py-4 font-extrabold uppercase text-xs tracking-wider">Rate Matrix</th>
                <th className="px-6 py-4 font-extrabold uppercase text-xs tracking-wider">Date Validity Range</th>
                <th className="px-6 py-4 font-extrabold uppercase text-xs tracking-wider text-center">Status</th>
                <th className="px-6 py-4 font-extrabold uppercase text-xs tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              
              {/* Specialized Interactive Empty State Trap */}
              {displayRates.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-20 text-center">
                    <div className="flex flex-col items-center justify-center text-slate-400">
                      <ArchiveX className="w-14 h-14 mb-4 opacity-40 text-indigo-400" />
                      <p className="text-lg font-bold text-slate-700">No Commodity Configurations Found</p>
                      <p className="text-sm mt-1 max-w-sm text-center text-slate-500 font-medium">There are no rate matrices defined for this search string, or the master DB node is completely empty.</p>
                      <button onClick={() => setIsModalOpen(true)} className="mt-5 text-sm font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-5 py-2 rounded-lg transition-colors border border-indigo-100">
                        Compile Rate Master Matrix Now →
                      </button>
                    </div>
                  </td>
                </tr>
              )}

              {/* Master Ledger Mapper Loop */}
              {displayRates.map(rate => {
                const isRateExpired = rate.status === 'Expired';
                const sDate = new Date(rate.startDate);
                const eDate = new Date(rate.endDate);
                const totalDays = Math.max(1, differenceInDays(eDate, sDate));

                return (
                  <tr key={rate._id} className={`hover:bg-slate-50 transition-colors ${isRateExpired ? 'opacity-70 bg-slate-50/50' : ''}`}>
                    <td className="px-6 py-5 font-black text-slate-900 uppercase tracking-widest text-sm">
                      {rate.name}
                      {rate.notes && (
                        <div className="text-xs font-medium mt-1.5 text-slate-500 flex items-center uppercase tracking-normal">
                          <TrendingUp className="w-3.5 h-3.5 mr-1" />
                          {rate.notes}
                        </div>
                      )}
                    </td>
                    
                    <td className="px-6 py-5">
                      <div className={`font-black border rounded-lg px-3 py-1.5 inline-flex items-center text-sm shadow-sm
                        ${isRateExpired ? 'bg-slate-100 text-slate-500 border-slate-200' : 'bg-green-50 text-green-900 border-green-200'}
                      `}>
                        ₹{rate.ratePerMT.toFixed(2)} <span className={`font-bold ml-1.5 ${isRateExpired ? 'text-slate-400' : 'text-green-600'}`}>/ MT</span>
                      </div>
                    </td>

                    <td className="px-6 py-5">
                      <div className="flex items-center text-slate-700 font-bold text-xs uppercase tracking-wider">
                        <CalendarDays className="w-4 h-4 mr-2 text-slate-400" />
                        {format(sDate, 'MMM d, yyyy')} <span className="px-2 text-slate-300">→</span> {format(eDate, 'MMM d, yyyy')}
                      </div>
                      <div className="text-indigo-600 font-bold text-xs mt-1.5 ml-6">
                         Duration Calculated: {totalDays} Days
                      </div>
                    </td>

                    <td className="px-6 py-5 text-center">
                      <span className={`inline-flex items-center px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-sm
                        ${isRateExpired ? 'bg-slate-100 text-slate-500 border border-slate-200' : 'bg-indigo-100 text-indigo-700 border border-indigo-200'}
                      `}>
                        {isRateExpired ? (
                          <><AlertTriangle className="w-3 h-3 mr-1" /> Expired</>
                        ) : '🟢 ACTIVE'}
                      </span>
                    </td>

                    <td className="px-6 py-5 text-right">
                      <button 
                        onClick={() => handleDelete(rate._id, rate.name)}
                        className="p-2.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors border border-transparent hover:border-red-100"
                        title="Delete Configuration from Database"
                      >
                        <Trash2 className="w-4.5 h-4.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
