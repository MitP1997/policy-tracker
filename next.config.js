/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // OpenNext requires standalone output for Cloudflare Workers (same as godizzy)
  output: "standalone",
  // Next 15+ is migrating away from `next lint`. We run `eslint .` explicitly instead.
  eslint: {
    ignoreDuringBuilds: true
  }
};

module.exports = nextConfig;

