import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IClient extends Document {
  name: string;
  address: string;
  clientType: 'FARMER' | 'FPO' | 'COMPANY';
  mobile: string;
  createdAt: Date;
  updatedAt: Date;
}

const ClientSchema: Schema = new Schema(
  {
    name: { type: String, required: true },
    address: { type: String, required: true },
    clientType: {
      type: String,
      enum: ['FARMER', 'FPO', 'COMPANY'],
      required: true,
    },
    mobile: { type: String, required: true },
  },
  { timestamps: true }
);

const Client: Model<IClient> =
  mongoose.models.Client || mongoose.model<IClient>('Client', ClientSchema);

export default Client;
