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

function throttleKeys(email: string, ipAddress: string) {
    const keys = [{ id: emailIpKey(email, ipAddress), threshold: MAX_EMAIL_IP_FAILURES }];
    // Unknown addresses are shared when no trusted proxy is configured.
    if (ipAddress !== 'unknown') keys.push({ id: ipKey(ipAddress), threshold: MAX_IP_FAILURES });
    return keys;
}

export async function loginRetryAfterSeconds(email: string, ipAddress: string, now = new Date()) {
    await connectDB();
    const keys = throttleKeys(email, ipAddress).map(({ id }) => id);
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
    const throttleCollection = LoginThrottle.collection as unknown as {
        findOneAndUpdate(
            filter: { _id: string },
            update: Array<Record<string, unknown>>,
            options: { upsert: boolean; returnDocument: 'after' },
        ): Promise<unknown>;
    };
    for (const { id, threshold } of throttleKeys(email, ipAddress)) {
        const activeWindow = { $gt: [{ $ifNull: ['$windowStartedAt', new Date(0)] }, cutoff] };
        const nextAttempts = { $cond: [activeWindow, { $add: [{ $ifNull: ['$attempts', 0] }, 1] }, 1] };

        // Pipeline updates calculate from the current document atomically.
        const updatePipeline = [{ $set: {
                attempts: nextAttempts,
                windowStartedAt: { $cond: [activeWindow, '$windowStartedAt', now] },
                blockedUntil: { $cond: [{ $gte: [nextAttempts, threshold] }, blockedUntil, null] },
                updatedAt: now,
            } }];
        try {
            await throttleCollection.findOneAndUpdate(
                { _id: id }, updatePipeline, { upsert: true, returnDocument: 'after' },
            );
        } catch (error) {
            // Concurrent first attempts can race to insert the same key. The
            // loser retries against the document the winner just created.
            if (!error || typeof error !== 'object' || !('code' in error) || error.code !== 11000) throw error;
            await throttleCollection.findOneAndUpdate(
                { _id: id }, updatePipeline, { upsert: false, returnDocument: 'after' },
            );
        }
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
    // A successful login clears only this account/address pair, not the shared IP bucket.
    await LoginThrottle.deleteOne({ _id: emailIpKey(email, ipAddress) });
}
