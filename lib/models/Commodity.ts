import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ICommodity extends Document {
  name: string;
  ratePerMtPerDay: number; // ₹ per MT per Day
  ratePerMtMonth?: number; // ₹ per MT per Month
  createdAt: Date;
  updatedAt: Date;
}

const CommoditySchema: Schema = new Schema(
  {
    name: { type: String, required: true, unique: true, uppercase: true },
    ratePerMtPerDay: { type: Number, required: true, min: 0 },
    ratePerMtMonth: { type: Number, min: 0 },
  },
  { timestamps: true }
);

const Commodity: Model<ICommodity> =
  mongoose.models.Commodity || mongoose.model<ICommodity>('Commodity', CommoditySchema);

export default Commodity;
