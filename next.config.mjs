/** @type {import('next').NextConfig} */
const isCfBuild = process.env.CF_BUILD === "1";

const nextConfig = {
  reactStrictMode: true,
  ...(isCfBuild
    ? {
        output: "export",
        images: { unoptimized: true },
      }
    : {}),
};

export default nextConfig;
