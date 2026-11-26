import type { NextConfig } from "next";

// Für jede Antwort (Seiten, API, statische Dateien).
const securityHeaders = [
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" }, // nirgends einbettbar (Clickjacking)
  { key: "X-Content-Type-Options", value: "nosniff" }, // Browser rät keinen Dateityp
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" }, // fremde Seiten sehen nur die Herkunft, nie den Pfad
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" }, // nutzt die App nicht
];

const nextConfig: NextConfig = {
  poweredByHeader: false, // „X-Powered-By: Next.js“ verrät nur das Framework
  // pg ist ein reines Node-Paket → nicht bündeln, sondern zur Laufzeit laden
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
