import { NextResponse } from 'next/server';
import { Permission } from '@/types';
import { authorizedAny } from '@/lib/auth/api-guard';
import connectDB from '@/lib/db';
import { Settings } from '@/models';
import { getClientIp } from '@/lib/auth/login-history';

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

    // Forwarded IPs are trusted only when the deployment explicitly enables
    // them and its reverse proxy overwrites the incoming forwarding headers.
    if (!ip) ip = getClientIp(request);

    await connectDB();
    const settings = await Settings.findById('shop').select('timezone countryCode').lean();
    const defaultTimezone = settings?.timezone ?? 'Asia/Dhaka';
    const defaultCountry = settings?.countryCode ?? 'BD';

    if (ip === 'unknown') {
        return NextResponse.json({
            ip: '',
            isLocal: false,
            type: 'Unknown',
            network: 'Client IP unavailable',
            isp: 'Unknown',
            city: 'Unknown Location',
            region: 'Unknown',
            country: 'Unknown',
            countryCode: '',
            timezone: defaultTimezone,
            latitude: null,
            longitude: null,
        });
    }

    if (isPrivateIp(ip)) {
        return NextResponse.json({
            ip,
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
