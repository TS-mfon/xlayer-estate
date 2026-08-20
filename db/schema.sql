CREATE TABLE IF NOT EXISTS assets (
  token_id NUMERIC(78, 0) PRIMARY KEY,
  issuer TEXT NOT NULL,
  valuation_usd NUMERIC(78, 0) NOT NULL,
  launch_valuation_usd NUMERIC(78, 0) NOT NULL,
  total_shares NUMERIC(78, 0) NOT NULL,
  risk_score INTEGER NOT NULL,
  status INTEGER NOT NULL,
  underwriting_hash TEXT NOT NULL,
  metadata_hash TEXT NOT NULL,
  metadata_uri TEXT NOT NULL,
  minted_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS markets (
  token_id NUMERIC(78, 0) PRIMARY KEY REFERENCES assets(token_id) ON DELETE CASCADE,
  share_reserve NUMERIC(78, 0) NOT NULL,
  usdc_reserve NUMERIC(78, 0) NOT NULL,
  total_liquidity NUMERIC(78, 0) NOT NULL,
  locked_liquidity NUMERIC(78, 0) NOT NULL,
  active BOOLEAN NOT NULL,
  spot_price NUMERIC(40, 18) NOT NULL,
  implied_market_cap NUMERIC(40, 6) NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS holdings (
  wallet TEXT NOT NULL,
  token_id NUMERIC(78, 0) NOT NULL REFERENCES assets(token_id) ON DELETE CASCADE,
  balance NUMERIC(78, 0) NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (wallet, token_id)
);

CREATE TABLE IF NOT EXISTS market_snapshots (
  id BIGSERIAL PRIMARY KEY,
  token_id NUMERIC(78, 0) NOT NULL REFERENCES assets(token_id) ON DELETE CASCADE,
  share_reserve NUMERIC(78, 0) NOT NULL,
  usdc_reserve NUMERIC(78, 0) NOT NULL,
  spot_price NUMERIC(40, 18) NOT NULL,
  implied_market_cap NUMERIC(40, 6) NOT NULL,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS market_snapshots_token_time_idx
  ON market_snapshots(token_id, captured_at DESC);

CREATE TABLE IF NOT EXISTS indexer_state (
  indexer_key TEXT PRIMARY KEY,
  last_synced_block NUMERIC(78, 0) NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
