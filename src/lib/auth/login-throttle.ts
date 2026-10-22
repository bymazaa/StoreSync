import { createHash } from 'node:crypto';
import connectDB from '@/lib/db';
import { LoginThrottle } from '@/models';

const WINDOW_MS = 15 * 60 * 1000;
const MAX_EMAIL_IP_FAILURES = 5;
const MAX_IP_FAILURES = 25;
let lastPrunedAt = 0;

function emailIpKey(email: string, ipAddress: string) {
    return createHash('sha256')
        .update(`email\0${email.trim().toLowerCase()}\0${ipAddress}`)
        .digest('hex');
}

function ipKey(ipAddress: string) {
    return createHash('sha256').update(`ip\0${ipAddress}`).digest('hex');
}

export async function loginRetryAfterSeconds(email: string, ipAddress: string, now = new Date()) {
    await connectDB();
    const keys = [emailIpKey(email, ipAddress), ipKey(ipAddress)];
    const rows = await LoginThrottle.find({ _id: { $in: keys } })
        .select('blockedUntil')
        .lean();
    
    return rows.reduce((retryAfter, entry) => {
        if (!entry.blockedUntil || entry.blockedUntil <= now) return retryAfter;
        return Math.max(
            retryAfter,
            Math.ceil((entry.blockedUntil.getTime() - now.getTime()) / 1000),
        );
    }, 0);
}

export async function recordLoginFailure(email: string, ipAddress: string, now = new Date()) {
    await connectDB();
    const cutoff = new Date(now.getTime() - WINDOW_MS);
    const blockedUntil = new Date(now.getTime() + WINDOW_MS);
    const keys = [
        { id: emailIpKey(email, ipAddress), threshold: MAX_EMAIL_IP_FAILURES },
        { id: ipKey(ipAddress), threshold: MAX_IP_FAILURES },
    ];

    for (const { id, threshold } of keys) {
        const existing = await LoginThrottle.findById(id).lean();
        
        let attempts = 1;
        let windowStartedAt = now;
        let shouldBlock = false;

        if (existing && existing.windowStartedAt > cutoff) {
            // Window still active, increment attempts
            attempts = existing.attempts + 1;
            windowStartedAt = existing.windowStartedAt;
            shouldBlock = attempts >= threshold;
        }

        await LoginThrottle.findByIdAndUpdate(
            id,
            {
                attempts,
                windowStartedAt,
                blockedUntil: shouldBlock ? blockedUntil : null,
                updatedAt: now,
            },
            { upsert: true, returnDocument: "after" }
        );
    }

    if (now.getTime() - lastPrunedAt >= 60 * 60 * 1000) {
        lastPrunedAt = now.getTime();
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        await LoginThrottle.deleteMany({ updatedAt: { $lt: weekAgo } });
    }

    return loginRetryAfterSeconds(email, ipAddress, now);
}

export async function clearLoginFailures(email: string, ipAddress: string) {
    await connectDB();
    const keys = [emailIpKey(email, ipAddress), ipKey(ipAddress)];
    await LoginThrottle.deleteMany({ _id: { $in: keys } });
}
