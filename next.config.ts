import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pg ist ein reines Node-Paket → nicht bündeln, sondern zur Laufzeit laden
  serverExternalPackages: ["pg"],
};

export default nextConfig;
