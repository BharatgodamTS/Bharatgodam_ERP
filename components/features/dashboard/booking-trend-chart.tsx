'use client';

import { useState, useEffect } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

interface BookingTrendPoint {
  day: string;
  bookings: number;
}

interface BookingTrendChartProps {
  data: BookingTrendPoint[];
}

export default function BookingTrendChart({ data }: BookingTrendChartProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return <div className="h-[420px] w-full bg-slate-50 animate-pulse rounded-xl" />;

  return (
    <div className="h-[420px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
          <XAxis dataKey="day" axisLine={false} tickLine={false} />
          <YAxis axisLine={false} tickLine={false} />
          <Tooltip
            cursor={{ stroke: '#cbd5e1', strokeWidth: 2 }}
            contentStyle={{ borderRadius: '10px', border: 'none', boxShadow: '0 8px 24px rgba(15, 23, 42, 0.08)' }}
          />
          <Legend wrapperStyle={{ paddingTop: '16px' }} />
          <Line type="monotone" dataKey="bookings" name="Bookings" stroke="#3b82f6" strokeWidth={4} dot={{ r: 4 }} activeDot={{ r: 6 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
