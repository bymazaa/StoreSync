import { randomUUID } from 'crypto';
import mongoose, { Schema } from 'mongoose';

export interface IAuditLog {
  _id: string;
  id?: string;
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: any | null;
  ipAddress?: string | null;
  createdAt: Date;
}

const AuditLogSchema = new Schema<IAuditLog>(
  {
    _id: {
      type: String,
      required: true,
      default: () => randomUUID(),
    },
    actorId: {
      type: String,
      default: null,
      ref: 'User',
    },
    action: {
      type: String,
      required: true,
      trim: true,
    },
    entityType: {
      type: String,
      required: true,
      trim: true,
    },
    entityId: {
      type: String,
      default: null,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: null,
    },
    ipAddress: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: {
      createdAt: 'createdAt',
      updatedAt: false,
    },
  }
);

AuditLogSchema.index({ entityType: 1, entityId: 1, createdAt: 1 });
AuditLogSchema.index({ actorId: 1, createdAt: 1 });

const AuditLog = mongoose.models.AuditLog || mongoose.model<IAuditLog>('AuditLog', AuditLogSchema);

export default AuditLog;
