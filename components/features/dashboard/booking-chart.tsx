'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

// Mock Aggregation Data (Replace with real MongoDB aggregation later)
const monthlyData = [
  { month: 'Jan', total: 120, advance: 80 },
  { month: 'Feb', total: 150, advance: 100 },
  { month: 'Mar', total: 180, advance: 140 },
  { month: 'Apr', total: 110, advance: 60 },
  { month: 'May', total: 210, advance: 160 },
  { month: 'Jun', total: 250, advance: 200 },
];

export default function BookingChart() {
  return (
    <div className="h-[400px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={monthlyData}
          margin={{ top: 20, right: 30, left: 0, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
          <XAxis dataKey="month" axisLine={false} tickLine={false} />
          <YAxis axisLine={false} tickLine={false} />
          <Tooltip 
            cursor={{ fill: '#f1f5f9' }} 
            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
          />
          <Legend wrapperStyle={{ paddingTop: '20px' }} />
          <Bar dataKey="total" name="Total Bookings" fill="#3b82f6" radius={[4, 4, 0, 0]} />
          <Bar dataKey="advance" name="Advance Bookings" fill="#94a3b8" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
