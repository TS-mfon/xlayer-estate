"use client";

import { useReadContract, useReadContracts, useChainId } from "wagmi";
import { rwaAbi } from "@/lib/abi";
import { RWA_ADDRESS } from "@/lib/config";
import { AssetCard, type AssetInfo } from "@/components/AssetCard";

export default function DashboardPage() {
  const chainId = useChainId();
  const contractMissing =
    RWA_ADDRESS === "0x0000000000000000000000000000000000000000";

  const { data: total } = useReadContract({
    address: RWA_ADDRESS,
    abi: rwaAbi,
    functionName: "totalAssets",
    query: { enabled: !contractMissing },
  });

  const ids = total ? Array.from({ length: Number(total) }, (_, i) => BigInt(i + 1)) : [];

  const { data: infos, isLoading } = useReadContracts({
    contracts: ids.map((id) => ({
      address: RWA_ADDRESS,
      abi: rwaAbi,
      functionName: "assetInfo",
      args: [id],
    })),
    query: { enabled: !contractMissing && ids.length > 0 },
  });

  if (contractMissing) {
    return (
      <div className="glass rounded-xl p-6">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="mt-2 text-sm text-amber-200">
          No contract address configured yet. Deploy with <code>npm run deploy:testnet</code> and
          set <code>NEXT_PUBLIC_RWA_ADDRESS</code> in <code>.env.local</code>.
        </p>
      </div>
    );
  }

  const assets = (infos ?? [])
    .map((r, i) =>
      r.status === "success" ? { id: ids[i], info: r.result as unknown as AssetInfo } : null
    )
    .filter(Boolean) as { id: bigint; info: AssetInfo }[];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Tokenized assets</h1>
        <p className="text-white/60">
          {Number(total ?? 0)} propert{Number(total ?? 0) === 1 ? "y" : "ies"} minted on X Layer.
        </p>
      </div>

      {isLoading && <p className="text-white/50">Loading on-chain data…</p>}

      {!isLoading && assets.length === 0 && (
        <div className="glass rounded-xl p-6 text-sm text-white/60">
          No assets yet. Go to{" "}
          <a className="text-brand-glow underline" href="/tokenize">
            Tokenize
          </a>{" "}
          to mint your first property.
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {assets.map((a) => (
          <AssetCard key={a.id.toString()} id={a.id} info={a.info} chainId={chainId} />
        ))}
      </div>
    </div>
  );
}
