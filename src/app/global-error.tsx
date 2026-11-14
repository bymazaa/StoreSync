'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
  retry,
}: {
  error: Error & { digest?: string };
  reset?: () => void;
  retry?: () => void;
}) {
  useEffect(() => {
    console.error('Critical Root Error caught by GlobalError:', error);
  }, [error]);

  const handleRetry = () => {
    if (typeof reset === 'function') {
      reset();
    } else if (typeof retry === 'function') {
      retry();
    } else {
      window.location.reload();
    }
  };

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          padding: 0,
          fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          backgroundColor: '#0c1514',
          color: '#f6f8f7',
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            maxWidth: '480px',
            width: '90%',
            margin: '24px auto',
            padding: '36px 28px',
            borderRadius: '24px',
            backgroundColor: '#152220',
            border: '1px solid #233734',
            textAlign: 'center',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          }}
        >
          {/* Tone Icon */}
          <div
            style={{
              width: '60px',
              height: '60px',
              margin: '0 auto 16px auto',
              borderRadius: '16px',
              backgroundColor: 'rgba(239, 68, 68, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#f87171',
              fontSize: '28px',
            }}
          >
            ⚠️
          </div>

          <span
            style={{
              display: 'inline-block',
              padding: '4px 12px',
              borderRadius: '9999px',
              fontSize: '11px',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              backgroundColor: 'rgba(239, 68, 68, 0.12)',
              color: '#f87171',
            }}
          >
            Global Application Failure
          </span>

          <h1
            style={{
              margin: '14px 0 8px 0',
              fontSize: '22px',
              fontWeight: 700,
              letterSpacing: '-0.02em',
              color: '#ffffff',
            }}
          >
            Critical System Error
          </h1>

          <p
            style={{
              margin: '0 0 24px 0',
              fontSize: '13.5px',
              lineHeight: 1.6,
              color: '#9aa9a6',
            }}
          >
            An unrecoverable error occurred in the core application layout. You can attempt to restore
            the session or reload the page.
          </p>

          {/* Action buttons */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'row',
              gap: '10px',
              justifyContent: 'center',
              flexWrap: 'wrap',
            }}
          >
            <button
              type="button"
              onClick={handleRetry}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                borderRadius: '12px',
                backgroundColor: '#10b981',
                color: '#ffffff',
                padding: '10px 20px',
                fontSize: '14px',
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                transition: 'opacity 0.2s',
              }}
            >
              Try again
            </button>

            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '12px',
                border: '1px solid #2e4743',
                backgroundColor: 'transparent',
                color: '#f6f8f7',
                padding: '10px 20px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Reload application
            </button>
          </div>

          {error?.digest && (
            <p
              style={{
                marginTop: '20px',
                paddingTop: '16px',
                borderTop: '1px solid #233734',
                fontSize: '11px',
                color: '#6e7e7b',
                fontFamily: 'monospace',
              }}
            >
              Error Digest: {error.digest}
            </p>
          )}
        </div>
      </body>
    </html>
  );
}
