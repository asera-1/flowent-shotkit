// Lint + type-check run in dev / CI, not during the Vercel build (keeps deploys unblocked).
const nextConfig = {
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
};

export default nextConfig;
