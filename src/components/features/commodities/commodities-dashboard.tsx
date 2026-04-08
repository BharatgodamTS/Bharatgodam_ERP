'use client';

import React, { useState, useOptimistic, useTransition } from 'react';
import { MongoCommodity } from '@/lib/validations/commodity';
import CommodityFormModal from './commodity-form-modal';
import { format } from 'date-fns';
import { Search, Plus, Trash2, Edit, BoxSelect } from 'lucide-react';
import { deleteCommodity } from '@/app/actions/commodities';
import { toast } from 'react-hot-toast';

export default function CommoditiesDashboard({ initialData }: { initialData: MongoCommodity[] }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTarget, setEditingTarget] = useState<MongoCommodity | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  // React 18 Background Transitions
  const [isPending, startTransition] = useTransition();

  // Optimistic UI Reducer Array - Modifies State VISUALLY immediately before Database responds
  const [optimisticCommodities, addOptimisticAction] = useOptimistic(
    initialData,
    (state, action: { type: 'delete' | 'add' | 'edit', payload: any }) => {
      if (action.type === 'delete') {
         return state.filter(c => c._id !== action.payload.id);
      }
      if (action.type === 'add') {
         return [action.payload.data as MongoCommodity, ...state];
      }
      if (action.type === 'edit') {
         return state.map(c => 
           c._id === action.payload.data._id 
             ? { ...c, ...action.payload.data } 
             : c
         );
      }
      return state;
    }
  );

  const handleDelete = (id: string, name: string) => {
    if (!window.confirm(`Obliterate Commodity '${name}'? This permanently disrupts the Master Table.`)) return;

    startTransition(async () => {
      // 1. Instantly trigger visual removal (0ms latency visually)
      addOptimisticAction({ type: 'delete', payload: { id } });

      // 2. Transact DB Operation over the wire
      try {
        const result = await deleteCommodity(id);
        if (result.success) {
          toast.success(`${name} fully erased.`);
        } else {
          toast.error('Deletion Exception blocked attempt.');
        }
      } catch {
        toast.error('Network request broken.');
      }
    });
  };

  const handleOpenEdit = (commodity: MongoCommodity) => {
    setEditingTarget(commodity);
    setIsModalOpen(true);
  };

  const handleOpenAdd = () => {
    setEditingTarget(null);
    setIsModalOpen(true);
  };

  // Triggers during the exact moment a user clicks Save inside the child Modal
  const handleOptimisticSave = (action: 'add' | 'edit', data: any) => {
     startTransition(() => {
        addOptimisticAction({ type: action, payload: { data } });
     });
  };

  // Live filter parser
  const filtered = optimisticCommodities.filter(c => 
     c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
     c.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pt-1">
      
      <CommodityFormModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        initialData={editingTarget} 
        onSuccessOptimistic={handleOptimisticSave}
      />

      {/* Control Layout Navigation Row */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
        <div className="relative w-full sm:max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text" 
            placeholder="Search Database String (e.g. WHEAT, ELECTRONICS)..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-11 pr-4 py-3 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 font-medium transition-all outline-none"
          />
        </div>
        
        <button 
          onClick={handleOpenAdd}
          className="w-full sm:w-auto px-7 py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl shadow-md shadow-indigo-200 disabled:opacity-50 transition-all flex items-center justify-center transform hover:-translate-y-0.5"
        >
          <Plus className="w-5 h-5 mr-1" />
          Install Commodity Matrix
        </button>
      </div>

      {/* Master Render Framework Table */}
      <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-[#f8fafc] text-slate-900 border-b border-slate-200">
              <tr>
                <th className="px-6 py-5 font-black uppercase text-[11px] tracking-widest text-slate-800 border-r border-slate-100">Commodity Vector</th>
                <th className="px-6 py-5 font-black uppercase text-[11px] tracking-widest text-slate-800">Classification</th>
                <th className="px-6 py-5 font-black uppercase text-[11px] tracking-widest text-slate-800">Foundational Rate</th>
                <th className="px-6 py-5 font-black uppercase text-[11px] tracking-widest text-slate-800 whitespace-nowrap">Last Synchronization</th>
                <th className="px-6 py-5 font-black uppercase text-[11px] tracking-widest text-slate-800 text-right">Access Controls</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              
              {/* Empty Data Node Visualizer */}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-24 text-center">
                    <div className="flex flex-col items-center justify-center text-slate-400">
                      <BoxSelect className="w-16 h-16 mb-5 opacity-40 text-indigo-400 stroke-1" />
                      <p className="text-xl font-black text-slate-800">Database Engine Empty</p>
                      <p className="text-sm mt-1.5 mb-6 max-w-sm text-center text-slate-500 font-medium leading-relaxed">No tracking items correspond to this string, or your Master Catalogue requires initial seed mappings.</p>
                      <button onClick={handleOpenAdd} className="text-sm font-bold text-indigo-700 hover:text-indigo-900 bg-indigo-50 px-6 py-2.5 rounded-xl transition-colors border border-indigo-100">
                        Create Root Entry Vector →
                      </button>
                    </div>
                  </td>
                </tr>
              )}

              {/* Secure Loop Execution Mapper */}
              {filtered.map(item => (
                  <tr key={item._id} className="hover:bg-slate-50/80 group transition-colors">
                    <td className="px-6 py-5 font-black text-slate-900 uppercase tracking-widest text-sm border-r border-slate-100">
                      <div className="flex items-center">
                        <div className="w-2.5 h-2.5 rounded-full bg-indigo-500 mr-3 shadow-sm shadow-indigo-300"></div>
                        {item.name}
                      </div>
                    </td>
                    
                    <td className="px-6 py-5">
                      <span className="bg-slate-100 text-slate-600 border border-slate-200 rounded-lg px-3.5 py-1.5 text-xs font-bold tracking-wider uppercase">
                        {item.category}
                      </span>
                    </td>

                    <td className="px-6 py-5">
                      <div className="bg-[#ecfdf5] text-green-900 border border-green-200 rounded-xl px-3.5 py-1.5 inline-flex items-center text-sm shadow-sm font-black tracking-wide">
                        ₹{item.baseRate.toFixed(2)} <span className="text-green-600 font-bold ml-1.5 opacity-80 text-[11px]">/ {item.unit}</span>
                      </div>
                    </td>

                    <td className="px-6 py-5 text-xs text-slate-400 font-bold whitespace-nowrap uppercase tracking-wider">
                      {format(new Date(item.updatedAt || item.createdAt), 'MMM d, yyyy • HH:mm')}
                    </td>

                    <td className="px-6 py-5 text-right">
                      <div className="flex justify-end gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => handleOpenEdit(item)}
                          className="p-2.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors border border-transparent hover:border-indigo-100"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleDelete(item._id, item.name)}
                          className="p-2.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors border border-transparent hover:border-red-100"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
