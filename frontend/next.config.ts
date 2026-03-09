import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const withBundleAnalyzer = require("@next/bundle-analyzer")({
  enabled: process.env.ANALYZE === "true",
});

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
      { protocol: "http", hostname: "**" },
    ],
  },
};

const sentryConfig = withSentryConfig(
  nextConfig,
  {
    silent: true,
    org: "realtors-practice",
    project: "frontend",
    widenClientFileUpload: true,
    hideSourceMaps: true,
    disableLogger: true,
  }
);

export default withBundleAnalyzer(sentryConfig);
