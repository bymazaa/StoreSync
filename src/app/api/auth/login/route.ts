import { compare } from 'bcryptjs';
import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import connectDB from '@/lib/db';
import User, { IUser } from '@/models/User';
import RefreshSession from '@/models/RefreshSession';
import { invalidBody, apiError } from '@/lib/http/api-response';
import { assertSameOrigin, setAuthCookies } from '@/lib/auth/cookies';
import {
    clearLoginFailures,
    loginRetryAfterSeconds,
    recordLoginFailure,
} from '@/lib/auth/login-throttle';
import {
    createAccessToken,
    createRefreshToken,
    hashRefreshToken,
    REFRESH_TTL_SECONDS,
} from '@/lib/auth/tokens';

import { loginSchema } from '@/lib/validation/api';

export async function POST(request: Request) {
    if (!assertSameOrigin(request))
        return apiError(403, 'FORBIDDEN', 'Request origin is not allowed.');

    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return invalidBody();
    }
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) return invalidBody(parsed.error.issues);

    // Only trust the proxy-sanitized single IP header; never parse a client-controlled forwarding chain.
    const ipAddress = request.headers.get('x-real-ip')?.trim().slice(0, 64) || 'unknown';
    const retryAfter = await loginRetryAfterSeconds(parsed.data.email, ipAddress);
    if (retryAfter > 0) {
        const response = apiError(
            429,
            'RATE_LIMITED',
            'Too many sign-in attempts. Try again later.',
        );
        response.headers.set('Retry-After', String(retryAfter));
        return response;
    }

    await connectDB();
    const user = await User.findOne({ email: parsed.data.email }).lean() as IUser | null;
    if (!user || !user.isActive || !(await compare(parsed.data.password, user.passwordHash))) {
        const failureRetryAfter = await recordLoginFailure(parsed.data.email, ipAddress);
        if (failureRetryAfter > 0) {
            const response = apiError(
                429,
                'RATE_LIMITED',
                'Too many sign-in attempts. Try again later.',
            );
            response.headers.set('Retry-After', String(failureRetryAfter));
            return response;
        }
        return apiError(401, 'UNAUTHENTICATED', 'Email or password is incorrect.');
    }
    await clearLoginFailures(parsed.data.email, ipAddress);

    const refreshToken = createRefreshToken();
    const expiresAt = new Date(Date.now() + REFRESH_TTL_SECONDS * 1000);
    await RefreshSession.create({
        _id: randomUUID(),
        userId: user._id,
        tokenHash: hashRefreshToken(refreshToken),
        expiresAt,
        userAgent: request.headers.get('user-agent')?.slice(0, 500),
        ipAddress: request.headers.get('x-real-ip')?.trim().slice(0, 64) || null,
    });

    const accessToken = await createAccessToken({ 
      id: user._id, 
      role: user.role, 
      sessionVersion: user.sessionVersion 
    });
    const response = NextResponse.json({
        user: { id: user._id, fullName: user.fullName, email: user.email, role: user.role },
    });
    setAuthCookies(response, accessToken, refreshToken);
    return response;
}
