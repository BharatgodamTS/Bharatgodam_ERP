'use client';

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

interface CommoditySlice {
  commodity: string;
  mt: number;
}

interface CommodityPieChartProps {
  data: CommoditySlice[];
}

const COLORS = ['#3b82f6', '#10b981', '#f97316', '#6366f1', '#ec4899', '#eab308', '#14b8a6'];

export default function CommodityPieChart({ data }: CommodityPieChartProps) {
  return (
    <div className="h-[420px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Tooltip
            formatter={(value: any) => {
              const numericValue = Number(value || 0);
              return [`${numericValue.toFixed(2)} MT`, 'Current MT'];
            }}
            contentStyle={{ borderRadius: '10px', border: 'none', boxShadow: '0 8px 24px rgba(15, 23, 42, 0.08)' }}
          />
          <Legend verticalAlign="bottom" height={48} />
          <Pie
            data={data}
            dataKey="mt"
            nameKey="commodity"
            cx="50%"
            cy="45%"
            innerRadius={70}
            outerRadius={110}
            paddingAngle={4}
            stroke="transparent"
          >
            {data.map((entry, index) => (
              <Cell key={`slice-${entry.commodity}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
