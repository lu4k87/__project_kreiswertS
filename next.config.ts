import type { NextConfig } from "next";

// For every response (pages, API, static files).
const securityHeaders = [
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" }, // nirgends einbettbar (Clickjacking)
  { key: "X-Content-Type-Options", value: "nosniff" }, // browser does not guess the file type
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" }, // other sites see only the origin, never the path
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" }, // the app does not use them
];

const nextConfig: NextConfig = {
  poweredByHeader: false, // “X-Powered-By: Next.js” only reveals the framework
  // pg is a pure Node package → do not bundle it, load it at runtime
  serverExternalPackages: ["pg"],
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  // Old German URLs (renamed 2026-11-25) keep working for bookmarks and shared links.
  async redirects() {
    return [
      { source: "/registrieren", destination: "/register", permanent: true },
      { source: "/konto", destination: "/account", permanent: true },
    ];
  },
};

export default nextConfig;
