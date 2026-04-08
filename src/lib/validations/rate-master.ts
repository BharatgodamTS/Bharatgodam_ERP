import { z } from 'zod';

export const RateMasterSchema = z.object({
  name: z.string().min(2, 'Commodity name is required').toUpperCase(),
  ratePerMT: z.coerce.number().positive('Rate must be greater than ₹0.00'),
  startDate: z.string().min(1, 'Start Date is required'),
  endDate: z.string().min(1, 'End Date is required'),
  notes: z.string().optional(),
}).refine((data) => {
  return new Date(data.endDate) >= new Date(data.startDate);
}, {
  message: 'End Date must chronologically trail the Start Date',
  path: ['endDate'],
});

export type RateMasterValues = z.infer<typeof RateMasterSchema>;

export type MongoCommodityRate = {
  _id: string; // Pre-Stringified for Next.js SSR boundaries
  name: string;
  ratePerMT: number;
  startDate: string; // ISO String representation of Date
  endDate: string;
  notes?: string;
  status: 'Active' | 'Expired';
  createdAt: string;
};
