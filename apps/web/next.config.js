const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    transpilePackages: ['@airoom/shared'],
    eslint: {
        // Warning: This allows production builds to successfully complete even if
        // your project has ESLint errors. Vercel crashes if it tries to configure ESLint interactively.
        ignoreDuringBuilds: true,
    },
    typescript: {
        // Warning: This allows production builds to successfully complete even if
        // your project has TypeScript errors, allowing you to bypass them if any surface from the shared package.
        ignoreBuildErrors: true,
    },
    async rewrites() {
        return [
            {
                source: '/api/:path*',
                destination: `${apiUrl}/api/:path*`,
            },
            {
                source: '/uploads/:path*',
                destination: `${apiUrl}/uploads/:path*`,
            },
        ];
    },
};

module.exports = nextConfig;
