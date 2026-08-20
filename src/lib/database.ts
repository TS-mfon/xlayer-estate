import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import type { AssetInfo } from "./asset-info";
import { calculateMarketPricing, serializeIndexedAsset, type IndexedAsset, type PoolInfo } from "./market-data";
import type { SupportedChainId } from "./network";

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
  await sql`CREATE TABLE IF NOT EXISTS assets (chain_id INTEGER NOT NULL DEFAULT 1952, token_id NUMERIC(78,0) NOT NULL, issuer TEXT NOT NULL, valuation_usd NUMERIC(78,0) NOT NULL, launch_valuation_usd NUMERIC(78,0) NOT NULL, total_shares NUMERIC(78,0) NOT NULL, risk_score INTEGER NOT NULL, status INTEGER NOT NULL, underwriting_hash TEXT NOT NULL, metadata_hash TEXT NOT NULL, metadata_uri TEXT NOT NULL, minted_at TIMESTAMPTZ NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), PRIMARY KEY(chain_id, token_id))`;
  await sql`CREATE TABLE IF NOT EXISTS markets (chain_id INTEGER NOT NULL DEFAULT 1952, token_id NUMERIC(78,0) NOT NULL, share_reserve NUMERIC(78,0) NOT NULL, usdc_reserve NUMERIC(78,0) NOT NULL, total_liquidity NUMERIC(78,0) NOT NULL, locked_liquidity NUMERIC(78,0) NOT NULL, active BOOLEAN NOT NULL, spot_price NUMERIC(40,18) NOT NULL, implied_market_cap NUMERIC(40,6) NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), PRIMARY KEY(chain_id, token_id), FOREIGN KEY(chain_id, token_id) REFERENCES assets(chain_id, token_id) ON DELETE CASCADE)`;
  await sql`CREATE TABLE IF NOT EXISTS holdings (chain_id INTEGER NOT NULL DEFAULT 1952, wallet TEXT NOT NULL, token_id NUMERIC(78,0) NOT NULL, balance NUMERIC(78,0) NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), PRIMARY KEY(chain_id, wallet, token_id), FOREIGN KEY(chain_id, token_id) REFERENCES assets(chain_id, token_id) ON DELETE CASCADE)`;
  await sql`CREATE TABLE IF NOT EXISTS market_snapshots (id BIGSERIAL PRIMARY KEY, chain_id INTEGER NOT NULL DEFAULT 1952, token_id NUMERIC(78,0) NOT NULL, share_reserve NUMERIC(78,0) NOT NULL, usdc_reserve NUMERIC(78,0) NOT NULL, spot_price NUMERIC(40,18) NOT NULL, implied_market_cap NUMERIC(40,6) NOT NULL, captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), FOREIGN KEY(chain_id, token_id) REFERENCES assets(chain_id, token_id) ON DELETE CASCADE)`;
  await sql`ALTER TABLE assets ADD COLUMN IF NOT EXISTS chain_id INTEGER NOT NULL DEFAULT 1952`;
  await sql`ALTER TABLE markets ADD COLUMN IF NOT EXISTS chain_id INTEGER NOT NULL DEFAULT 1952`;
  await sql`ALTER TABLE holdings ADD COLUMN IF NOT EXISTS chain_id INTEGER NOT NULL DEFAULT 1952`;
  await sql`ALTER TABLE market_snapshots ADD COLUMN IF NOT EXISTS chain_id INTEGER NOT NULL DEFAULT 1952`;
  await sql`ALTER TABLE markets DROP CONSTRAINT IF EXISTS markets_token_id_fkey`;
  await sql`ALTER TABLE holdings DROP CONSTRAINT IF EXISTS holdings_token_id_fkey`;
  await sql`ALTER TABLE market_snapshots DROP CONSTRAINT IF EXISTS market_snapshots_token_id_fkey`;
  await sql`ALTER TABLE assets DROP CONSTRAINT IF EXISTS assets_pkey`;
  await sql`ALTER TABLE markets DROP CONSTRAINT IF EXISTS markets_pkey`;
  await sql`ALTER TABLE holdings DROP CONSTRAINT IF EXISTS holdings_pkey`;
  await sql`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='assets_pkey') THEN ALTER TABLE assets ADD CONSTRAINT assets_pkey PRIMARY KEY(chain_id, token_id); END IF; END $$`;
  await sql`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='markets_pkey') THEN ALTER TABLE markets ADD CONSTRAINT markets_pkey PRIMARY KEY(chain_id, token_id); END IF; END $$`;
  await sql`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='holdings_pkey') THEN ALTER TABLE holdings ADD CONSTRAINT holdings_pkey PRIMARY KEY(chain_id, wallet, token_id); END IF; END $$`;
  await sql`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='markets_asset_fkey') THEN ALTER TABLE markets ADD CONSTRAINT markets_asset_fkey FOREIGN KEY(chain_id, token_id) REFERENCES assets(chain_id, token_id) ON DELETE CASCADE; END IF; END $$`;
  await sql`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='holdings_asset_fkey') THEN ALTER TABLE holdings ADD CONSTRAINT holdings_asset_fkey FOREIGN KEY(chain_id, token_id) REFERENCES assets(chain_id, token_id) ON DELETE CASCADE; END IF; END $$`;
  await sql`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='market_snapshots_asset_fkey') THEN ALTER TABLE market_snapshots ADD CONSTRAINT market_snapshots_asset_fkey FOREIGN KEY(chain_id, token_id) REFERENCES assets(chain_id, token_id) ON DELETE CASCADE; END IF; END $$`;
  await sql`CREATE INDEX IF NOT EXISTS market_snapshots_chain_token_time_idx ON market_snapshots(chain_id, token_id, captured_at DESC)`;
  await sql`CREATE TABLE IF NOT EXISTS indexer_state (indexer_key TEXT PRIMARY KEY, last_synced_block NUMERIC(78,0) NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;
  initialized = true;
  return sql;
}

export async function cacheAsset(chainId: SupportedChainId, id: bigint, info: AssetInfo, pool: PoolInfo, balance?: { wallet: string; value: bigint }) {
  const sql = await ensureDatabase();
  if (!sql) return;
  const mintedAt = new Date(Number(info.timestamp) * 1000);
  await sql`INSERT INTO assets (chain_id, token_id, issuer, valuation_usd, launch_valuation_usd, total_shares, risk_score, status, underwriting_hash, metadata_hash, metadata_uri, minted_at, updated_at) VALUES (${chainId}, ${id.toString()}, ${info.owner.toLowerCase()}, ${info.valuationUsd.toString()}, ${info.launchValuationUsd.toString()}, ${info.totalShares.toString()}, ${info.riskScore}, ${info.status}, ${info.underwritingHash}, ${info.metadataHash}, ${info.metadataURI}, ${mintedAt.toISOString()}, NOW()) ON CONFLICT (chain_id, token_id) DO UPDATE SET issuer=EXCLUDED.issuer, valuation_usd=EXCLUDED.valuation_usd, launch_valuation_usd=EXCLUDED.launch_valuation_usd, total_shares=EXCLUDED.total_shares, risk_score=EXCLUDED.risk_score, status=EXCLUDED.status, underwriting_hash=EXCLUDED.underwriting_hash, metadata_hash=EXCLUDED.metadata_hash, metadata_uri=EXCLUDED.metadata_uri, updated_at=NOW()`;
  const pricing = calculateMarketPricing(info, pool);
  await sql`INSERT INTO markets (chain_id, token_id, share_reserve, usdc_reserve, total_liquidity, locked_liquidity, active, spot_price, implied_market_cap, updated_at) VALUES (${chainId}, ${id.toString()}, ${pool[0].toString()}, ${pool[1].toString()}, ${pool[2].toString()}, ${pool[3].toString()}, ${pool[4]}, ${pricing.spotPricePerShare}, ${pricing.impliedMarketCap}, NOW()) ON CONFLICT (chain_id, token_id) DO UPDATE SET share_reserve=EXCLUDED.share_reserve, usdc_reserve=EXCLUDED.usdc_reserve, total_liquidity=EXCLUDED.total_liquidity, locked_liquidity=EXCLUDED.locked_liquidity, active=EXCLUDED.active, spot_price=EXCLUDED.spot_price, implied_market_cap=EXCLUDED.implied_market_cap, updated_at=NOW()`;
  if (pool[4]) {
    const latest = await sql`SELECT spot_price, captured_at FROM market_snapshots WHERE chain_id=${chainId} AND token_id=${id.toString()} ORDER BY captured_at DESC LIMIT 1`;
    const last = latest[0] as { spot_price?: string; captured_at?: string } | undefined;
    const changed = !last || Math.abs(Number(last.spot_price) - pricing.spotPricePerShare) > 1e-15 || Date.now() - new Date(last.captured_at ?? 0).getTime() > 60 * 60 * 1000;
    if (changed) await sql`INSERT INTO market_snapshots (chain_id, token_id, share_reserve, usdc_reserve, spot_price, implied_market_cap) VALUES (${chainId}, ${id.toString()}, ${pool[0].toString()}, ${pool[1].toString()}, ${pricing.spotPricePerShare}, ${pricing.impliedMarketCap})`;
  }
  if (balance) await sql`INSERT INTO holdings (chain_id, wallet, token_id, balance, updated_at) VALUES (${chainId}, ${balance.wallet.toLowerCase()}, ${id.toString()}, ${balance.value.toString()}, NOW()) ON CONFLICT (chain_id, wallet, token_id) DO UPDATE SET balance=EXCLUDED.balance, updated_at=NOW()`;
}

export async function cachedMarkets(chainId: SupportedChainId): Promise<IndexedAsset[]> {
  const sql = await ensureDatabase();
  if (!sql) return [];
  const rows = await sql`SELECT a.*, m.*, (SELECT spot_price FROM market_snapshots s WHERE s.chain_id=a.chain_id AND s.token_id=a.token_id AND s.captured_at <= NOW() - INTERVAL '24 hours' ORDER BY s.captured_at DESC LIMIT 1) AS previous_price FROM assets a JOIN markets m USING(chain_id, token_id) WHERE a.chain_id=${chainId} AND m.active=TRUE ORDER BY a.token_id DESC`;
  return rows.map((row) => rowToAsset(row));
}

export async function cachedWalletAssets(chainId: SupportedChainId, wallet: string): Promise<IndexedAsset[]> {
  const sql = await ensureDatabase();
  if (!sql) return [];
  const rows = await sql`SELECT a.*, m.*, h.balance, (SELECT spot_price FROM market_snapshots s WHERE s.chain_id=a.chain_id AND s.token_id=a.token_id AND s.captured_at <= NOW() - INTERVAL '24 hours' ORDER BY s.captured_at DESC LIMIT 1) AS previous_price FROM assets a LEFT JOIN markets m USING(chain_id, token_id) LEFT JOIN holdings h ON h.chain_id=a.chain_id AND h.token_id=a.token_id AND h.wallet=${wallet.toLowerCase()} WHERE a.chain_id=${chainId} AND (a.issuer=${wallet.toLowerCase()} OR COALESCE(h.balance,0)>0) ORDER BY a.token_id DESC`;
  return rows.map((row) => rowToAsset(row));
}

function rowToAsset(row: Record<string, unknown>): IndexedAsset {
  const info: AssetInfo = { owner: String(row.issuer) as `0x${string}`, valuationUsd: BigInt(String(row.valuation_usd)), launchValuationUsd: BigInt(String(row.launch_valuation_usd)), totalShares: BigInt(String(row.total_shares)), riskScore: Number(row.risk_score), status: Number(row.status), underwritingHash: String(row.underwriting_hash) as `0x${string}`, metadataHash: String(row.metadata_hash) as `0x${string}`, metadataURI: String(row.metadata_uri), timestamp: BigInt(Math.floor(new Date(String(row.minted_at)).getTime() / 1000)) };
  const pool: PoolInfo = [BigInt(String(row.share_reserve ?? 0)), BigInt(String(row.usdc_reserve ?? 0)), BigInt(String(row.total_liquidity ?? 0)), BigInt(String(row.locked_liquidity ?? 0)), Boolean(row.active)];
  return serializeIndexedAsset(BigInt(String(row.token_id)), info, pool, row.balance === null || row.balance === undefined ? undefined : BigInt(String(row.balance)), row.previous_price ? Number(row.previous_price) : null);
}
