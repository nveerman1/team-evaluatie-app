import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Enable standalone output for Docker deployment
  output: 'standalone',
  
  eslint: {
    // Warning: This allows production builds to successfully complete even if
    // your project has ESLint errors.
    ignoreDuringBuilds: true,
  },
  
  // Proxy API requests to FastAPI backend in development
  // In production, nginx handles this routing
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: "http://127.0.0.1:8000/api/v1/:path*",
      },
    ];
  },
  
  // Security headers for frontend
  async headers() {
    const isDevelopment = process.env.NODE_ENV === 'development';
    
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-XSS-Protection",
            value: "1; mode=block",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "geolocation=(), microphone=(), camera=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()",
          },
          // Content-Security-Policy for Next.js frontend
          // Development: Allow unsafe-eval and unsafe-inline for Next.js hot reload
          // Production: Use stricter CSP without unsafe directives
          {
            key: "Content-Security-Policy",
            value: isDevelopment
              ? [
                  "default-src 'self'",
                  "script-src 'self' 'unsafe-eval' 'unsafe-inline'", // Required for Next.js dev mode
                  "style-src 'self' 'unsafe-inline'", // Required for styled-components
                  "img-src 'self' data: blob: https:",
                  "font-src 'self' data:",
                  "connect-src 'self' http://localhost:8000 http://127.0.0.1:8000", // Allow dev API
                  "frame-ancestors 'none'",
                ].join("; ")
              : [
                  "default-src 'self'",
                  "script-src 'self' 'wasm-unsafe-eval'", // Allow WebAssembly, no eval/inline
                  "style-src 'self' 'unsafe-inline'", // Required for Next.js CSS-in-JS (Tailwind)
                  // TODO: Consider nonce-based CSP for styles to remove unsafe-inline
                  // This would require middleware to inject nonces into all style tags
                  "img-src 'self' data: blob: https:",
                  "font-src 'self' data:",
                  "connect-src 'self' https://app.technasiummbh.nl", // Production API only
                  "frame-ancestors 'none'",
                  "base-uri 'self'",
                  "form-action 'self'",
                ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
