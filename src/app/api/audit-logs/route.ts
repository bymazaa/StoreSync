import { NextResponse } from 'next/server';
import { Permission } from '@/types';
import { authorizedAny } from '@/lib/auth/api-guard';
import connectDB from '@/lib/db';
import { AuditLog, Settings, User } from '@/models';
import { apiError } from '@/lib/http/api-response';
import { reportDateRange } from '@/lib/date-time';
import { z } from 'zod';

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function toId(value: unknown) {
    if (value && typeof value === 'object' && '_id' in value)
        return String((value as { _id: unknown })._id);
    return String(value ?? '');
}

function actorName(actor?: { fullName?: string; email?: string } | null) {
    return actor?.fullName?.trim() || actor?.email?.trim() || 'Removed user';
}

function describe(metadata?: Record<string, unknown> | null) {
    if (!metadata) return '';
    const parts: string[] = [];
    if (typeof metadata.invoiceNumber === 'string' && metadata.invoiceNumber)
        parts.push(`Invoice ${metadata.invoiceNumber}`);
    if (typeof metadata.returnNumber === 'string' && metadata.returnNumber)
        parts.push(`Return ${metadata.returnNumber}`);
    if (typeof metadata.code === 'string' && metadata.code) parts.push(`Code ${metadata.code}`);
    if (typeof metadata.sku === 'string' && metadata.sku) parts.push(`SKU ${metadata.sku}`);
    if (typeof metadata.amount === 'string' && metadata.amount)
        parts.push(`Amount ${metadata.amount}`);
    if (typeof metadata.total === 'string' && metadata.total) parts.push(`Total ${metadata.total}`);
    if (typeof metadata.dueAmount === 'string' && metadata.dueAmount)
        parts.push(`Due ${metadata.dueAmount}`);
    if (typeof metadata.refundAmount === 'string' && metadata.refundAmount)
        parts.push(`Refund ${metadata.refundAmount}`);
    if (typeof metadata.reason === 'string' && metadata.reason)
        parts.push(`Reason: ${metadata.reason}`);
    if (typeof metadata.deletedAccount === 'string' && metadata.deletedAccount)
        parts.push(`Removed account ${metadata.deletedAccount}`);
    if (Array.isArray(metadata.changedFields) && metadata.changedFields.length)
        parts.push(`Changed ${metadata.changedFields.join(', ')}`);
    if (Array.isArray(metadata.permissions) && metadata.permissions.length)
        parts.push(`${metadata.permissions.length} permissions saved`);
    return parts.join(' · ');
}

export async function GET(request: Request) {
    await connectDB();
    const guard = await authorizedAny([Permission.MANAGE_SETTINGS, Permission.MANAGE_USERS]);
    if ('response' in guard) return guard.response;

    const { searchParams } = new URL(request.url);
    const actorId = searchParams.get('actorId')?.trim() || '';
    const entityType = searchParams.get('entityType')?.trim() || '';
    const action = searchParams.get('action')?.trim() || '';
    const term = (searchParams.get('q')?.trim() || '').slice(0, 60);
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const page = Math.min(10_000, Math.max(1, Number(searchParams.get('page')) || 1));
    const pageSize = Math.min(200, Math.max(10, Number(searchParams.get('pageSize')) || 50));

    if (actorId && !z.uuid().safeParse(actorId).success)
        return apiError(400, 'BAD_REQUEST', 'Invalid actor ID.');

    const settings = await Settings.findById('shop').select('timezone').lean();
    let dateRange;
    try {
        dateRange = reportDateRange(from, to, settings?.timezone ?? 'Asia/Dhaka');
    } catch (error) {
        return apiError(
            400,
            'BAD_REQUEST',
            error instanceof Error ? error.message : 'Invalid date range.',
        );
    }

    const query: Record<string, unknown> = {};
    if (dateRange) query.createdAt = dateRange;
    if (actorId) query.actorId = actorId;
    if (entityType) query.entityType = entityType;
    if (action) query.action = action;
    if (term) {
        if (z.uuid().safeParse(term).success) {
            query.entityId = term;
        } else {
            const pattern = escapeRegExp(term);
            query.$or = [
                { action: { $regex: pattern, $options: 'i' } },
                { entityType: { $regex: pattern, $options: 'i' } },
                { entityId: { $regex: pattern, $options: 'i' } },
            ];
        }
    }

    const [logs, total] = await Promise.all([
        AuditLog.find(query)
            .sort({ createdAt: -1 })
            .skip((page - 1) * pageSize)
            .limit(pageSize)
            .lean(),
        AuditLog.countDocuments(query),
    ]);

    const actorIds = await AuditLog.distinct('actorId', dateRange ? { createdAt: dateRange } : {});
    const ids = actorIds.filter((id): id is string => typeof id === 'string' && id.length > 0);
    const actorRecords = ids.length
        ? await User.find({ _id: { $in: ids } })
              .select('_id fullName email')
              .lean()
        : [];
    const names = new Map(actorRecords.map((actor) => [String(actor._id), actorName(actor)]));

    return NextResponse.json({
        logs: logs.map((log) => ({
            id: String(log._id),
            action: log.action,
            entityType: log.entityType,
            entityId: toId(log.entityId),
            actorId: toId(log.actorId),
            // A deleted staff account keeps its history, so its rows are labelled rather than dropped.
            actorName: names.get(toId(log.actorId)) ?? (log.actorId ? 'Removed user' : 'System'),
            detail: describe(log.metadata as Record<string, unknown> | null),
            ipAddress: log.ipAddress ?? '',
            createdAt: log.createdAt,
        })),
        total,
        page,
        pageSize,
        actors: ids
            .map((id) => ({ id, name: names.get(id) ?? 'Removed user' }))
            .sort((a, b) => a.name.localeCompare(b.name)),
    });
}
