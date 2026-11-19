/**
 * Centralized Site and SEO Configuration.
 * All URLs, meta tags, and Open Graph parameters are dynamic and environment-variable driven.
 */

export function getBaseUrl(): string {
    const envUrl =
        process.env.NEXT_PUBLIC_APP_URL ||
        (process.env.VERCEL_PROJECT_PRODUCTION_URL
            ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
            : undefined) ||
        (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined);

    if (envUrl) {
        const trimmed = envUrl.trim().replace(/\/+$/, '');
        if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
            return `https://${trimmed}`;
        }
        return trimmed;
    }

    return 'http://localhost:3000';
}

export function absoluteUrl(path = '/'): string {
    const base = getBaseUrl();
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    return `${base}${normalizedPath}`;
}

export const SITE_CONFIG = {
    name: 'StockPilot',
    shortName: 'StockPilot',
    tagline: 'Modern POS & Grocery Inventory Management System',
    description:
        'StockPilot is an all-in-one POS, inventory tracking, and grocery shop management platform. Lightning-fast checkout, barcode scanning, real-time stock alerts, profit analytics, and multi-user access control.',
    locale: 'en_US',
    keywords: [
        'StockPilot',
        'POS software',
        'Point of Sale',
        'grocery inventory management',
        'retail shop billing',
        'barcode scanner POS',
        'grocery store management',
        'cloud POS software',
        'real-time inventory tracker',
        'business sales accounting',
        'grocery POS system',
        'stock control software',
    ],
    author: {
        name: 'StockPilot Team',
        url: getBaseUrl(),
    },
    themeColor: {
        light: '#0d9488',
        dark: '#0a0f1d',
    },
    ogImage: {
        url: '/og-image.png',
        width: 1376,
        height: 768,
        type: 'image/png',
        alt: 'StockPilot — Modern POS & Grocery Inventory Management System',
    },
    twitter: {
        card: 'summary_large_image' as const,
        creator: '@stockpilot',
        site: '@stockpilot',
    },
} as const;
