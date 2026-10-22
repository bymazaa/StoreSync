import mongoose, { Schema } from 'mongoose';

export interface ISettings {
  _id: string;
  id?: string;
  shopName: string;
  logoUrl?: string | null;
  address?: string | null;
  phone?: string | null;
  countryCode: string;
  currencyCode: string;
  locale: string;
  timezone: string;
  saleInvoicePrefix: string;
  purchaseInvoicePrefix: string;
  nextSaleNumber: number;
  nextPurchaseNumber: number;
  costingMethod: 'WEIGHTED_AVERAGE' | 'FIFO';
  createdAt: Date;
  updatedAt: Date;
}

const SettingsSchema = new Schema<ISettings>(
  {
    _id: {
      type: String,
      default: 'shop',
    },
    shopName: {
      type: String,
      required: true,
      default: 'My Grocery Shop',
    },
    logoUrl: {
      type: String,
      default: null,
    },
    address: {
      type: String,
      default: null,
    },
    phone: {
      type: String,
      default: null,
    },
    countryCode: {
      type: String,
      required: true,
      default: 'US',
      maxlength: 2,
    },
    currencyCode: {
      type: String,
      required: true,
      default: 'USD',
      maxlength: 3,
    },
    locale: {
      type: String,
      required: true,
      default: 'en-US',
    },
    timezone: {
      type: String,
      required: true,
      default: 'America/New_York',
    },
    saleInvoicePrefix: {
      type: String,
      required: true,
      default: 'SP',
    },
    purchaseInvoicePrefix: {
      type: String,
      required: true,
      default: 'PO',
    },
    nextSaleNumber: {
      type: Number,
      required: true,
      default: 1,
      min: 1,
    },
    nextPurchaseNumber: {
      type: Number,
      required: true,
      default: 1,
      min: 1,
    },
    costingMethod: {
      type: String,
      required: true,
      enum: ['WEIGHTED_AVERAGE', 'FIFO'],
      default: 'WEIGHTED_AVERAGE',
    },
  },
  {
    timestamps: {
      createdAt: 'createdAt',
      updatedAt: 'updatedAt',
    },
  }
);

const Settings = mongoose.models.Settings || mongoose.model<ISettings>('Settings', SettingsSchema);

export default Settings;
