import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import type { AssetInfo } from "./asset-info";
import { calculateMarketPricing, serializeIndexedAsset, type IndexedAsset, type PoolInfo } from "./market-data";

let initialized = false;

function connection(): NeonQueryFunction<false, false> | null {
  return process.env.DATABASE_URL ? neon(process.env.DATABASE_URL) : null;
}

export function databaseEnabled() {
  return Boolean(process.env.DATABASE_URL);
}

export async function ensureDatabase() {
  const sql = connection();
  if (!sql || initialized) return sql;
  await sql`CREATE TABLE IF NOT EXISTS assets (token_id NUMERIC(78,0) PRIMARY KEY, issuer TEXT NOT NULL, valuation_usd NUMERIC(78,0) NOT NULL, launch_valuation_usd NUMERIC(78,0) NOT NULL, total_shares NUMERIC(78,0) NOT NULL, risk_score INTEGER NOT NULL, status INTEGER NOT NULL, underwriting_hash TEXT NOT NULL, metadata_hash TEXT NOT NULL, metadata_uri TEXT NOT NULL, minted_at TIMESTAMPTZ NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;
  await sql`CREATE TABLE IF NOT EXISTS markets (token_id NUMERIC(78,0) PRIMARY KEY REFERENCES assets(token_id) ON DELETE CASCADE, share_reserve NUMERIC(78,0) NOT NULL, usdc_reserve NUMERIC(78,0) NOT NULL, total_liquidity NUMERIC(78,0) NOT NULL, locked_liquidity NUMERIC(78,0) NOT NULL, active BOOLEAN NOT NULL, spot_price NUMERIC(40,18) NOT NULL, implied_market_cap NUMERIC(40,6) NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;
  await sql`CREATE TABLE IF NOT EXISTS holdings (wallet TEXT NOT NULL, token_id NUMERIC(78,0) NOT NULL REFERENCES assets(token_id) ON DELETE CASCADE, balance NUMERIC(78,0) NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), PRIMARY KEY(wallet, token_id))`;
  await sql`CREATE TABLE IF NOT EXISTS market_snapshots (id BIGSERIAL PRIMARY KEY, token_id NUMERIC(78,0) NOT NULL REFERENCES assets(token_id) ON DELETE CASCADE, share_reserve NUMERIC(78,0) NOT NULL, usdc_reserve NUMERIC(78,0) NOT NULL, spot_price NUMERIC(40,18) NOT NULL, implied_market_cap NUMERIC(40,6) NOT NULL, captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;
  await sql`CREATE INDEX IF NOT EXISTS market_snapshots_token_time_idx ON market_snapshots(token_id, captured_at DESC)`;
  await sql`CREATE TABLE IF NOT EXISTS indexer_state (indexer_key TEXT PRIMARY KEY, last_synced_block NUMERIC(78,0) NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;
  initialized = true;
  return sql;
}

export async function cacheAsset(id: bigint, info: AssetInfo, pool: PoolInfo, balance?: { wallet: string; value: bigint }) {
  const sql = await ensureDatabase();
  if (!sql) return;
  const mintedAt = new Date(Number(info.timestamp) * 1000);
  await sql`INSERT INTO assets (token_id, issuer, valuation_usd, launch_valuation_usd, total_shares, risk_score, status, underwriting_hash, metadata_hash, metadata_uri, minted_at, updated_at) VALUES (${id.toString()}, ${info.owner.toLowerCase()}, ${info.valuationUsd.toString()}, ${info.launchValuationUsd.toString()}, ${info.totalShares.toString()}, ${info.riskScore}, ${info.status}, ${info.underwritingHash}, ${info.metadataHash}, ${info.metadataURI}, ${mintedAt.toISOString()}, NOW()) ON CONFLICT (token_id) DO UPDATE SET issuer=EXCLUDED.issuer, valuation_usd=EXCLUDED.valuation_usd, launch_valuation_usd=EXCLUDED.launch_valuation_usd, total_shares=EXCLUDED.total_shares, risk_score=EXCLUDED.risk_score, status=EXCLUDED.status, underwriting_hash=EXCLUDED.underwriting_hash, metadata_hash=EXCLUDED.metadata_hash, metadata_uri=EXCLUDED.metadata_uri, updated_at=NOW()`;
  const pricing = calculateMarketPricing(info, pool);
  await sql`INSERT INTO markets (token_id, share_reserve, usdc_reserve, total_liquidity, locked_liquidity, active, spot_price, implied_market_cap, updated_at) VALUES (${id.toString()}, ${pool[0].toString()}, ${pool[1].toString()}, ${pool[2].toString()}, ${pool[3].toString()}, ${pool[4]}, ${pricing.spotPricePerShare}, ${pricing.impliedMarketCap}, NOW()) ON CONFLICT (token_id) DO UPDATE SET share_reserve=EXCLUDED.share_reserve, usdc_reserve=EXCLUDED.usdc_reserve, total_liquidity=EXCLUDED.total_liquidity, locked_liquidity=EXCLUDED.locked_liquidity, active=EXCLUDED.active, spot_price=EXCLUDED.spot_price, implied_market_cap=EXCLUDED.implied_market_cap, updated_at=NOW()`;
  if (pool[4]) {
    const latest = await sql`SELECT spot_price, captured_at FROM market_snapshots WHERE token_id=${id.toString()} ORDER BY captured_at DESC LIMIT 1`;
    const last = latest[0] as { spot_price?: string; captured_at?: string } | undefined;
    const changed = !last || Math.abs(Number(last.spot_price) - pricing.spotPricePerShare) > 1e-15 || Date.now() - new Date(last.captured_at ?? 0).getTime() > 60 * 60 * 1000;
    if (changed) await sql`INSERT INTO market_snapshots (token_id, share_reserve, usdc_reserve, spot_price, implied_market_cap) VALUES (${id.toString()}, ${pool[0].toString()}, ${pool[1].toString()}, ${pricing.spotPricePerShare}, ${pricing.impliedMarketCap})`;
  }
  if (balance) await sql`INSERT INTO holdings (wallet, token_id, balance, updated_at) VALUES (${balance.wallet.toLowerCase()}, ${id.toString()}, ${balance.value.toString()}, NOW()) ON CONFLICT (wallet, token_id) DO UPDATE SET balance=EXCLUDED.balance, updated_at=NOW()`;
}

export async function cachedMarkets(): Promise<IndexedAsset[]> {
  const sql = await ensureDatabase();
  if (!sql) return [];
  const rows = await sql`SELECT a.*, m.*, (SELECT spot_price FROM market_snapshots s WHERE s.token_id=a.token_id AND s.captured_at <= NOW() - INTERVAL '24 hours' ORDER BY s.captured_at DESC LIMIT 1) AS previous_price FROM assets a JOIN markets m USING(token_id) WHERE m.active=TRUE ORDER BY a.token_id DESC`;
  return rows.map((row) => rowToAsset(row));
}

export async function cachedWalletAssets(wallet: string): Promise<IndexedAsset[]> {
  const sql = await ensureDatabase();
  if (!sql) return [];
  const rows = await sql`SELECT a.*, m.*, h.balance, (SELECT spot_price FROM market_snapshots s WHERE s.token_id=a.token_id AND s.captured_at <= NOW() - INTERVAL '24 hours' ORDER BY s.captured_at DESC LIMIT 1) AS previous_price FROM assets a LEFT JOIN markets m USING(token_id) LEFT JOIN holdings h ON h.token_id=a.token_id AND h.wallet=${wallet.toLowerCase()} WHERE a.issuer=${wallet.toLowerCase()} OR COALESCE(h.balance,0)>0 ORDER BY a.token_id DESC`;
  return rows.map((row) => rowToAsset(row));
}

function rowToAsset(row: Record<string, unknown>): IndexedAsset {
  const info: AssetInfo = {
    owner: String(row.issuer) as `0x${string}`,
    valuationUsd: BigInt(String(row.valuation_usd)),
    launchValuationUsd: BigInt(String(row.launch_valuation_usd)),
    totalShares: BigInt(String(row.total_shares)),
    riskScore: Number(row.risk_score),
    status: Number(row.status),
    underwritingHash: String(row.underwriting_hash) as `0x${string}`,
    metadataHash: String(row.metadata_hash) as `0x${string}`,
    metadataURI: String(row.metadata_uri),
    timestamp: BigInt(Math.floor(new Date(String(row.minted_at)).getTime() / 1000)),
  };
  const active = Boolean(row.active);
  const pool: PoolInfo = [BigInt(String(row.share_reserve ?? 0)), BigInt(String(row.usdc_reserve ?? 0)), BigInt(String(row.total_liquidity ?? 0)), BigInt(String(row.locked_liquidity ?? 0)), active];
  return serializeIndexedAsset(BigInt(String(row.token_id)), info, pool, row.balance === null || row.balance === undefined ? undefined : BigInt(String(row.balance)), row.previous_price ? Number(row.previous_price) : null);
}
