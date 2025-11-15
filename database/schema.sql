-- Ray-Ban Crypto Payments Database Schema

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- People/Users Table
CREATE TABLE people (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  wallet_address VARCHAR(255) NOT NULL UNIQUE,
  face_person_id VARCHAR(255) UNIQUE,  -- Azure Face API Person ID
  email VARCHAR(255),
  phone VARCHAR(50),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create index for fast wallet lookups
CREATE INDEX idx_people_wallet ON people(wallet_address);
CREATE INDEX idx_people_face_id ON people(face_person_id);

-- Transactions Table
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID,
  from_wallet VARCHAR(255) NOT NULL,
  to_person_id UUID REFERENCES people(id),
  to_wallet VARCHAR(255) NOT NULL,
  amount DECIMAL(18, 8) NOT NULL,
  currency VARCHAR(10) DEFAULT 'ETH',
  tx_hash VARCHAR(255) UNIQUE,
  status VARCHAR(50) DEFAULT 'pending',

  -- Detection evidence
  face_confidence DECIMAL(5, 4),
  audio_transcript TEXT,
  handshake_timestamp TIMESTAMP,

  -- Metadata
  metadata JSONB DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  confirmed_at TIMESTAMP,
  failed_at TIMESTAMP,

  CONSTRAINT valid_amount CHECK (amount > 0)
);

-- Create indexes for transaction queries
CREATE INDEX idx_transactions_to_person ON transactions(to_person_id);
CREATE INDEX idx_transactions_status ON transactions(status);
CREATE INDEX idx_transactions_created ON transactions(created_at DESC);
CREATE INDEX idx_transactions_tx_hash ON transactions(tx_hash);

-- Sessions Table (for tracking active detection sessions)
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  status VARCHAR(50) DEFAULT 'active',

  -- State machine data
  state JSONB DEFAULT '{
    "face": {"detected": false},
    "audio": {"detected": false},
    "handshake": {"detected": false}
  }',

  -- Associated data
  person_id UUID REFERENCES people(id),

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);

-- Create index for active sessions
CREATE INDEX idx_sessions_status ON sessions(status);
CREATE INDEX idx_sessions_created ON sessions(created_at DESC);

-- Audit Log (optional, for tracking all actions)
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50),
  entity_id UUID,
  user_id UUID,
  details JSONB DEFAULT '{}',
  ip_address INET,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_audit_log_created ON audit_log(created_at DESC);
CREATE INDEX idx_audit_log_entity ON audit_log(entity_type, entity_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for auto-updating timestamps
CREATE TRIGGER update_people_updated_at BEFORE UPDATE ON people
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sessions_updated_at BEFORE UPDATE ON sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Seed data (optional, for testing)
-- INSERT INTO people (name, wallet_address, face_person_id) VALUES
--   ('Alice', '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0', 'azure-person-1'),
--   ('Bob', '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed', 'azure-person-2');

-- Views for common queries
CREATE OR REPLACE VIEW transaction_history AS
SELECT
  t.id,
  t.amount,
  t.currency,
  t.status,
  t.tx_hash,
  p.name as recipient_name,
  p.wallet_address as recipient_wallet,
  t.audio_transcript,
  t.face_confidence,
  t.created_at,
  t.confirmed_at
FROM transactions t
LEFT JOIN people p ON t.to_person_id = p.id
ORDER BY t.created_at DESC;

-- Grant permissions (adjust as needed)
-- GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO your_app_user;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO your_app_user;
