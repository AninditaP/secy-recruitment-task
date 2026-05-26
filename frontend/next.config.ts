import type { NextConfig } from "next";

const nextConfig = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self'; connect-src 'self' http://localhost:8003 ws://localhost:8080 https://cdn.tldraw.com; img-src 'self' data: blob: https://cdn.tldraw.com; font-src 'self' https://cdn.tldraw.com; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline';"
          }
        ]
      }
    ]
  }
}
export default nextConfig;