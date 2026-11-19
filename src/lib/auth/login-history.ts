export function parseUserAgent(ua?: string | null): string {
  if (!ua) return 'Unknown Device';
  let os = 'Unknown OS';
  if (/windows phone/i.test(ua)) os = 'Windows Phone';
  else if (/windows nt 10/i.test(ua)) os = 'Windows 10/11';
  else if (/windows nt 6\.3/i.test(ua)) os = 'Windows 8.1';
  else if (/windows nt 6\.2/i.test(ua)) os = 'Windows 8';
  else if (/windows nt 6\.1/i.test(ua)) os = 'Windows 7';
  else if (/windows/i.test(ua)) os = 'Windows';
  else if (/macintosh|mac os x/i.test(ua)) os = 'macOS';
  else if (/android/i.test(ua)) os = 'Android';
  else if (/iphone|ipad|ipod/i.test(ua)) os = 'iOS';
  else if (/linux/i.test(ua)) os = 'Linux';

  let browser = 'Browser';
  if (/edg/i.test(ua)) browser = 'Edge';
  else if (/opr|opera/i.test(ua)) browser = 'Opera';
  else if (/chrome|crios/i.test(ua)) browser = 'Chrome';
  else if (/firefox|fxios/i.test(ua)) browser = 'Firefox';
  else if (/safari/i.test(ua)) browser = 'Safari';

  return `${os} · ${browser}`;
}

export function getClientIp(request: Request): string {
  // Forwarded headers are client-controlled unless a trusted upstream proxy
  // strips and sets them. Require an explicit deployment opt-in.
  if (process.env.TRUST_PROXY_HEADERS !== 'true') return 'unknown';

  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  const cfIp = request.headers.get('cf-connecting-ip');
  const raw = realIp || cfIp || (forwarded ? forwarded.split(',')[0].trim() : '') || 'unknown';
  return raw.slice(0, 64);
}

export function getClientLocation(request: Request, ip: string): string {
  if (ip === 'unknown') return 'Unknown Location';

  const isLocal =
    ip === '127.0.0.1' ||
    ip === '::1' ||
    ip === 'localhost' ||
    ip.startsWith('192.168.') ||
    ip.startsWith('10.') ||
    ip.startsWith('172.16.') ||
    ip.startsWith('172.31.');

  const trustedProxy = process.env.TRUST_PROXY_HEADERS === 'true';
  const city = trustedProxy
    ? request.headers.get('x-vercel-ip-city') || request.headers.get('cf-ipcity')
    : null;
  const country = trustedProxy
    ? request.headers.get('x-vercel-ip-country') || request.headers.get('cf-ipcountry') || request.headers.get('x-country-code')
    : null;

  if (city && country) {
    try {
      return `${decodeURIComponent(city)}, ${country}`;
    } catch {
      return `${city}, ${country}`;
    }
  }
  if (country) return country;
  if (isLocal) return 'Localhost / Local Network';
  return 'Unknown Location';
}
