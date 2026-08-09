/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config, { webpack }) => {
    // The `wagmi` barrel does `export * from './exports/connectors'`, which pulls in
    // `@wagmi/connectors` -> `@base-org/account` -> `@coinbase/cdp-sdk` -> optional
    // `@x402/*` payment-protocol modules that are NOT installed. Importing any core
    // hook (useAccount, useSwitchChain, ...) from "wagmi" therefore resolves those
    // bare specifiers and the build fails with "Module not found: @x402/...".
    // We only use the `injected()` connector from `@wagmi/core`, so ignore ALL
    // `@x402/*` imports at the resolver level. (Next.js passes the `webpack`
    // instance as the 2nd arg — required to construct IgnorePlugin.)
    config.plugins = config.plugins || [];
    config.plugins.push(
      new webpack.IgnorePlugin({
        resourceRegExp: /^@x402\//,
        contextRegExp: /node_modules\/@coinbase\/cdp-sdk/,
      })
    );

    // Belt-and-suspenders for static ESM imports that slip past IgnorePlugin.
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      "@x402/evm": false,
      "@x402/evm/exact/client": false,
      "@x402/core": false,
      "@x402/core/client": false,
      "@x402/svm": false,
      "@x402/svm/exact/client": false,
      "@x402/common": false,
    };

    config.resolve.fallback = { ...(config.resolve.fallback || {}), fs: false };
    return config;
  },
};

export default nextConfig;
