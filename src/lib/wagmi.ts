import { createConfig, http } from "wagmi";
// Import `injected` directly from `@wagmi/core` to bypass the
// `wagmi/connectors` barrel, which statically pulls in `@base-org/account`
// -> `@coinbase/cdp-sdk` -> optional `@x402/*` payment-protocol modules.
import { injected } from "@wagmi/core";
import { xlayerTestnet, xlayer } from "./chains";

export const config = createConfig({
  chains: [xlayerTestnet, xlayer],
  connectors: [injected()],
  transports: {
    [xlayerTestnet.id]: http(),
    [xlayer.id]: http(),
  },
  ssr: true,
});
