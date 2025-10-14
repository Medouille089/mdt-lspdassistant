CREATE TABLE IF NOT EXISTS lspd_blacklist (
  discord_id VARCHAR PRIMARY KEY,
  created_by VARCHAR,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
  reason TEXT
);
