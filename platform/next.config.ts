import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

/**
 * Points next-intl at the request config that resolves the active locale.
 * Without the plugin the messages are never loaded and every t() call
 * renders its key instead of a translation.
 */
const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // Produces a minimal, self-contained server bundle (.next/standalone)
  // with only the node_modules actually used at runtime traced in —
  // this is what makes the production Docker image small and fast to
  // build/deploy instead of shipping the entire node_modules tree.
  output: "standalone",

  // Security: never leak the specific Next.js version to clients via the
  // X-Powered-By response header.
  poweredByHeader: false,

  images: {
    // Only used for the 2FA QR code, which is generated server-side as a
    // data: URL — no remote image domains are ever loaded.
    remotePatterns: [],
  },

  experimental: {
    // Keeps server bundles lean by not inlining these into every route
    // that transitively imports them.
    serverComponentsHmrCache: true,
  },
};

export default withNextIntl(nextConfig);
