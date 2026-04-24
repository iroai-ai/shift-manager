/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ["lh3.googleusercontent.com"],
  },
  webpack: (config, { nextRuntime }) => {
    if (nextRuntime === "edge") {
      // pg and its deps use Node.js built-ins (stream, path, fs, …) that are
      // unavailable in webpack's strict edge sandbox during `next build`.
      // Marking them as externals causes webpack to emit `require('pg')` etc.
      // without bundling them.  @cloudflare/next-on-pages then re-bundles the
      // worker with esbuild + nodejs_compat, which properly polyfills those
      // built-ins so pg works at Cloudflare Workers runtime.
      const pgPackages = [
        "pg",
        "pg-cloudflare",
        "pg-connection-string",
        "pg-native",
        "pg-pool",
        "pg-types",
        "pgpass",
        "@prisma/adapter-pg",
        "@prisma/client",
        "@prisma/client/edge",
      ];

      const externalFn = ({ request }, callback) => {
        if (pgPackages.some((p) => request === p || request?.startsWith(p + "/"))) {
          return callback(null, `commonjs ${request}`);
        }
        callback();
      };

      if (!config.externals) {
        config.externals = [externalFn];
      } else if (Array.isArray(config.externals)) {
        config.externals.push(externalFn);
      } else {
        config.externals = [config.externals, externalFn];
      }
    }
    return config;
  },
};

export default nextConfig;
