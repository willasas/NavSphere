/** @type {import('next').NextConfig} */
const nextConfig = {
  // 优化构建输出
  output: 'standalone',

  // 图像配置
  images: {
    domains: [
      'dash.cloudflare.com',
      'www.google.com',
      'ph-static.imgix.net',
      'app.leonardo.ai'
    ],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },

  // 重写规则
  async rewrites() {
    return [
      {
        source: '/api/auth/:path*',
        destination: '/api/auth/:path*'
      },
      {
        source: '/auth/:path*',
        destination: '/auth/:path*'
      }
    ]
  },

  // 实验性功能
  experimental: {
    serverActions: {
      allowedOrigins: ['localhost', 'navsphere.com', '*.vercel.app']
    }
  },

  // 环境变量配置
  env: {
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  },

  // Webpack 配置
  webpack: (config, { isServer, isEdgeRuntime }) => {
    if (isEdgeRuntime) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        "fs": false,
        "path": false,
        "os": false,
        "net": false,
        "tls": false,
      };
    }
    return config;
  },
}

module.exports = nextConfig
