CREATE TABLE IF NOT EXISTS assets (
  chain_id INTEGER NOT NULL,
  token_id NUMERIC(78, 0) NOT NULL,
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
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (chain_id, token_id)
);

CREATE TABLE IF NOT EXISTS markets (
  chain_id INTEGER NOT NULL,
  token_id NUMERIC(78, 0) NOT NULL,
  share_reserve NUMERIC(78, 0) NOT NULL,
  usdc_reserve NUMERIC(78, 0) NOT NULL,
  total_liquidity NUMERIC(78, 0) NOT NULL,
  locked_liquidity NUMERIC(78, 0) NOT NULL,
  active BOOLEAN NOT NULL,
  spot_price NUMERIC(40, 18) NOT NULL,
  implied_market_cap NUMERIC(40, 6) NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (chain_id, token_id),
  FOREIGN KEY (chain_id, token_id) REFERENCES assets(chain_id, token_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS holdings (
  chain_id INTEGER NOT NULL,
  wallet TEXT NOT NULL,
  token_id NUMERIC(78, 0) NOT NULL,
  balance NUMERIC(78, 0) NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (chain_id, wallet, token_id),
  FOREIGN KEY (chain_id, token_id) REFERENCES assets(chain_id, token_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS market_snapshots (
  id BIGSERIAL PRIMARY KEY,
  chain_id INTEGER NOT NULL,
  token_id NUMERIC(78, 0) NOT NULL,
  share_reserve NUMERIC(78, 0) NOT NULL,
  usdc_reserve NUMERIC(78, 0) NOT NULL,
  spot_price NUMERIC(40, 18) NOT NULL,
  implied_market_cap NUMERIC(40, 6) NOT NULL,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY (chain_id, token_id) REFERENCES assets(chain_id, token_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS market_snapshots_chain_token_time_idx ON market_snapshots(chain_id, token_id, captured_at DESC);
CREATE TABLE IF NOT EXISTS indexer_state (indexer_key TEXT PRIMARY KEY, last_synced_block NUMERIC(78, 0) NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
