import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Mark XMTP packages as external to avoid WASM bundling issues in serverless
  serverExternalPackages: [
    '@xmtp/xmtp-js',
    '@xmtp/user-preferences-bindings-wasm',
    '@xmtp/mls-client-bindings-node',
  ],

  // Empty turbopack config to satisfy Next.js 16
  turbopack: {},
};

export default nextConfig;
