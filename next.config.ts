import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pg ist ein reines Node-Paket → nicht bündeln, sondern zur Laufzeit laden
  serverExternalPackages: ["pg"],
  // Old German URLs (renamed 2026-11-25) keep working for bookmarks and shared links.
  async redirects() {
    return [
      { source: "/registrieren", destination: "/register", permanent: true },
      { source: "/konto", destination: "/account", permanent: true },
    ];
  },
};

export default nextConfig;
