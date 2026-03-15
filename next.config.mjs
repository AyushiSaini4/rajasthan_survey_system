import withPWA from 'next-pwa'

/**
 * next-pwa configuration.
 *
 * disable in development  — avoids stale service-worker cache interfering with
 *                            hot reload and Tailwind class injection.
 * register: true          — auto-registers the SW on first page load.
 * skipWaiting: true       — new SW activates immediately instead of waiting for
 *                            all tabs to close (important for mobile PWA updates).
 * dest: 'public'          — sw.js and workbox-*.js land in /public so they are
 *                            served from the root scope (required for full-app caching).
 */
const withPWAConfig = withPWA({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  register: true,
  skipWaiting: true,
  // Prevent next-pwa from pre-caching Next.js build manifests; these change on
  // every deploy and cause false cache-miss warnings in the browser console.
  buildExcludes: [/app-build-manifest\.json$/],
})

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Remove the X-Powered-By: Next.js response header (minor security hardening).
  poweredByHeader: false,

  // Compress responses — Vercel handles this at the edge, but enabling it here
  // ensures correct behaviour in self-hosted / preview environments too.
  compress: true,

  webpack: (config, { isServer }) => {
    if (isServer) {
      // On the server side only: mark the `canvas` npm package (a Node.js
      // polyfill for HTMLCanvasElement) as an external so webpack does not try
      // to bundle the native binary addon.  react-signature-canvas is always
      // loaded with ssr:false so this only suppresses a spurious build warning.
      config.externals = [
        ...(Array.isArray(config.externals) ? config.externals : []),
        { canvas: 'canvas' },
      ]
    }
    return config
  },
}

export default withPWAConfig(nextConfig)
