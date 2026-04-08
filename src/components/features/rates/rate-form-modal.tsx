'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { RateMasterSchema, RateMasterValues } from '@/lib/validations/rate-master';
import { createRate } from '@/app/actions/rates';
import { toast } from 'react-hot-toast';
import { X, Loader2, IndianRupee } from 'lucide-react';

export default function RateFormModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { register, handleSubmit, reset, formState: { errors, isValid } } = useForm<RateMasterValues>({
    resolver: zodResolver(RateMasterSchema),
    mode: 'onTouched',
  });

  if (!isOpen) return null;

  const onSubmit = async (data: RateMasterValues) => {
    setIsSubmitting(true);
    try {
      const result = await createRate(data);
      if (result.success) {
        toast.success(`Active Rate established for ${data.name}!`);
        reset();
        onClose();
      } else {
        toast.error(result.message || 'Verification Error');
      }
    } catch {
      toast.error('Network Error during save');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 bg-slate-50">
          <h3 className="text-lg font-bold text-slate-900">Configure Seasonal Rate</h3>
          <button onClick={onClose} className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-5 bg-white">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Commodity Target *</label>
            <input 
              {...register('name')} 
              className="w-full rounded-md border border-slate-300 px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 uppercase font-medium bg-slate-50" 
              placeholder="E.G. WHEAT, COTTON" 
            />
            {errors.name && <p className="text-red-500 text-[10px] mt-1 font-medium">{errors.name.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Storage Rate per MT *</label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-slate-500 font-bold flex items-center">
                 <IndianRupee className="w-4 h-4 mr-0.5" />
              </span>
              <input 
                type="number" 
                step="0.01"
                {...register('ratePerMT')} 
                className="w-full rounded-md border-2 border-green-200 bg-green-50 pl-9 pr-3 py-2.5 text-sm font-bold text-green-900 focus:ring-0 focus:border-green-500" 
                placeholder="120.00" 
              />
            </div>
            {errors.ratePerMT && <p className="text-red-500 text-[10px] mt-1 font-medium">{errors.ratePerMT.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Validity Start *</label>
              <input 
                type="date" 
                {...register('startDate')} 
                className="w-full rounded-md border border-slate-300 px-3 py-2.5 text-sm bg-slate-50 focus:ring-2 focus:ring-indigo-500" 
              />
              {errors.startDate && <p className="text-red-500 text-[10px] mt-1 font-medium">{errors.startDate.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Validity End *</label>
              <input 
                type="date" 
                {...register('endDate')} 
                className="w-full rounded-md border border-slate-300 px-3 py-2.5 text-sm bg-slate-50 focus:ring-2 focus:ring-indigo-500" 
              />
              {errors.endDate && <p className="text-red-500 text-[10px] mt-1 font-medium">{errors.endDate.message}</p>}
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Administrative Notes</label>
            <textarea 
              {...register('notes')} 
              className="w-full rounded-md border border-slate-300 px-3 py-2.5 text-sm bg-slate-50 focus:ring-2 focus:ring-indigo-500" 
              placeholder="Internal season tags..." 
              rows={2}
            />
          </div>

          <div className="pt-6 mt-2 flex justify-end gap-3 border-t border-slate-100">
            <button 
              type="button" 
              onClick={onClose} 
              className="px-5 py-2.5 text-sm font-semibold text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 transition-colors shadow-sm"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              disabled={!isValid || isSubmitting}
              className="px-6 py-2.5 text-sm font-semibold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-all flex items-center shadow-md shadow-indigo-200"
            >
              {isSubmitting ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Publishing...</>
              ) : 'Publish Rate Master'}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
