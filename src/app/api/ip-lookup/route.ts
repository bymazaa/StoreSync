import { NextResponse } from 'next/server';
import { Permission } from '@/types';
import { authorizedAny } from '@/lib/auth/api-guard';
import connectDB from '@/lib/db';
import { Settings } from '@/models';

function isPrivateIp(ip: string): boolean {
    if (!ip || ip === '::1' || ip === '127.0.0.1' || ip === 'localhost') return true;
    if (ip.startsWith('192.168.') || ip.startsWith('10.') || ip.startsWith('172.')) return true;
    if (ip.startsWith('169.254.') || ip.startsWith('fc00:') || ip.startsWith('fe80:')) return true;
    return false;
}

export async function GET(request: Request) {
    const guard = await authorizedAny([Permission.MANAGE_SETTINGS, Permission.MANAGE_USERS]);
    if ('response' in guard) return guard.response;

    const { searchParams } = new URL(request.url);
    let ip = searchParams.get('ip')?.trim() || '';

    // If no IP is given, grab client IP from request headers
    if (!ip) {
        const forwarded = request.headers.get('x-forwarded-for');
        if (forwarded) ip = forwarded.split(',')[0].trim();
        if (!ip) ip = request.headers.get('x-real-ip')?.trim() || '';
        if (!ip) ip = request.headers.get('cf-connecting-ip')?.trim() || '127.0.0.1';
    }

    await connectDB();
    const settings = await Settings.findById('shop').select('timezone countryCode').lean();
    const defaultTimezone = settings?.timezone ?? 'Asia/Dhaka';
    const defaultCountry = settings?.countryCode ?? 'BD';

    if (isPrivateIp(ip)) {
        return NextResponse.json({
            ip: ip || '127.0.0.1',
            isLocal: true,
            type: ip.includes(':') ? 'IPv6' : 'IPv4',
            network: 'Local Store Network (LAN / POS Terminal)',
            isp: 'Internal Shop Network',
            city: 'Store Premises / Localhost',
            region: 'Local LAN',
            country: defaultCountry === 'BD' ? 'Bangladesh (Local Store)' : `${defaultCountry} (Local Store)`,
            countryCode: defaultCountry,
            timezone: defaultTimezone,
            latitude: null,
            longitude: null,
        });
    }

    // Public IP: lookup via free geolocation API
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3500);

        const response = await fetch(`https://ipwho.is/${encodeURIComponent(ip)}`, {
            signal: controller.signal,
            headers: { Accept: 'application/json' },
        });
        clearTimeout(timeout);

        if (response.ok) {
            const data = await response.json();
            if (data && data.success !== false) {
                return NextResponse.json({
                    ip: data.ip || ip,
                    isLocal: false,
                    type: data.type || 'IPv4',
                    network: data.connection?.org || data.connection?.isp || 'Public Network',
                    isp: data.connection?.isp || data.connection?.org || 'Internet Service Provider',
                    city: data.city || 'Unknown City',
                    region: data.region || 'Unknown Region',
                    country: data.country || 'Unknown Country',
                    countryCode: data.country_code || '',
                    postal: data.postal || '',
                    latitude: data.latitude ?? null,
                    longitude: data.longitude ?? null,
                    timezone: data.timezone?.id || defaultTimezone,
                });
            }
        }
    } catch {
        // Fallback if external API is unreachable or offline
    }

    return NextResponse.json({
        ip,
        isLocal: false,
        type: ip.includes(':') ? 'IPv6' : 'IPv4',
        network: 'Public Network Connection',
        isp: 'Internet Service Provider',
        city: 'External Network',
        region: 'Remote',
        country: 'Internet',
        countryCode: '',
        timezone: defaultTimezone,
        latitude: null,
        longitude: null,
    });
}
