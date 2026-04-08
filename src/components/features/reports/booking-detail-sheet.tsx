'use client';

import React from 'react';
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle, 
  SheetDescription 
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { IDetailedBooking } from '@/types/schemas';
import { Calendar, Package, MapPin, Truck, User, Info, Scale, TrendingUp } from 'lucide-react';

interface BookingDetailSheetProps {
  booking: IDetailedBooking | null;
  isOpen: boolean;
  onClose: () => void;
}

const DetailRow = ({ icon: Icon, label, value, color = "text-slate-500" }: { icon: any, label: string, value: string | number | undefined, color?: string }) => (
  <div className="flex items-start gap-3 py-3 border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors px-2 rounded-lg">
    <Icon className={`h-4 w-4 mt-0.5 ${color}`} />
    <div className="flex flex-col">
      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">{label}</span>
      <span className="text-sm font-semibold text-slate-900">{value || '---'}</span>
    </div>
  </div>
);

const SectionHeader = ({ icon: Icon, title }: { icon: any, title: string }) => (
  <div className="flex items-center gap-2 mt-8 mb-4 px-2">
    <div className="h-8 w-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
      <Icon className="h-4 w-4" />
    </div>
    <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">{title}</h3>
  </div>
);

const BookingDetailSheet: React.FC<BookingDetailSheetProps> = ({ booking, isOpen, onClose }) => {
  if (!booking) return null;

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <div className="flex items-center justify-between mt-6">
            <SheetTitle className="text-2xl font-black text-slate-900">Ledger Entry #{booking.sNo}</SheetTitle>
            <Badge variant={booking.direction === 'INWARD' ? 'success' : 'default'} className="px-3 py-1">
              {booking.direction}
            </Badge>
          </div>
          <SheetDescription className="text-slate-500 font-medium">
            Complete high-fidelity record for Gate Pass {booking.gatePass}
          </SheetDescription>
        </SheetHeader>

        <div className="pb-12">
          {/* Section 1: Logistics Flow */}
          <SectionHeader icon={Info} title="1. Flow & Location" />
          <div className="grid grid-cols-2 gap-x-6 gap-y-1">
            <DetailRow icon={Calendar} label="Inward Date" value={booking.date} />
            <DetailRow icon={MapPin} label="Warehouse" value={booking.warehouseName} />
            <DetailRow icon={MapPin} label="Zone / Location" value={booking.location} color="text-indigo-500" />
            <DetailRow icon={Calendar} label="Created At" value={new Date(booking.createdAt).toLocaleString()} />
          </div>

          {/* Section 2: Stakeholders */}
          <SectionHeader icon={User} title="2. Stakeholders" />
          <div className="grid grid-cols-1 gap-y-1">
            <DetailRow icon={User} label="Client Name" value={booking.clientName} />
            <DetailRow icon={MapPin} label="Client Location" value={booking.clientLocation} />
            <DetailRow icon={User} label="Suppliers" value={booking.suppliers} />
          </div>

          {/* Section 3: Tracking Specs */}
          <SectionHeader icon={Truck} title="3. Tracking & Specs" />
          <div className="grid grid-cols-2 gap-x-6 gap-y-1">
            <DetailRow icon={Package} label="Commodity" value={booking.commodityName} color="text-emerald-500" />
            <DetailRow icon={Info} label="CAD No" value={booking.cadNo} />
            <DetailRow icon={Package} label="Stack No." value={booking.stackNo} />
            <DetailRow icon={Info} label="Lot Number" value={booking.lotNo} />
            <DetailRow icon={Package} label="DO Number" value={booking.doNumber} />
            <DetailRow icon={Info} label="CDF No" value={booking.cdfNo} />
            <DetailRow icon={Truck} label="Gate Pass" value={booking.gatePass} color="text-indigo-500" />
            <DetailRow icon={Info} label="Pass" value={booking.pass} />
          </div>

          {/* Section 4: Quantities & Performance */}
          <SectionHeader icon={Scale} title="4. Scale Quantities" />
          <div className="grid grid-cols-2 gap-x-6 gap-y-1">
            <DetailRow icon={Package} label="Bags (Qty)" value={booking.bags} />
            <DetailRow icon={Package} label="Pala Bags" value={booking.palaBags} />
            <div className="col-span-2 mt-4 p-4 bg-emerald-50 rounded-xl border border-emerald-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <TrendingUp className="h-5 w-5 text-emerald-600" />
                <div>
                  <p className="text-[10px] font-black uppercase text-emerald-600 tracking-widest">Total Weight</p>
                  <p className="text-2xl font-black text-emerald-900">{booking.mt} <span className="text-sm">MT</span></p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-black uppercase text-emerald-600 tracking-widest">Billing Active</p>
                <p className="text-sm font-bold text-emerald-700">{booking.storageDays} Days</p>
              </div>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default BookingDetailSheet;
