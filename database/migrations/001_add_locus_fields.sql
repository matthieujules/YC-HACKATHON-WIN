-- Migration: Add Locus payment integration fields to transactions table
-- Purpose: Track Locus-specific transaction data alongside blockchain data

-- Add Locus-specific columns to transactions table
ALTER TABLE transactions
ADD COLUMN IF NOT EXISTS locus_transaction_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS locus_payment_status VARCHAR(50),
ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50) DEFAULT 'locus',
ADD COLUMN IF NOT EXISTS locus_metadata JSONB DEFAULT '{}';

-- Create index for fast Locus transaction lookups
CREATE INDEX IF NOT EXISTS idx_transactions_locus_id ON transactions(locus_transaction_id);

-- Add comment for documentation
COMMENT ON COLUMN transactions.locus_transaction_id IS 'Locus internal transaction ID returned from API';
COMMENT ON COLUMN transactions.locus_payment_status IS 'Locus-specific payment status (may differ from blockchain status)';
COMMENT ON COLUMN transactions.payment_method IS 'Payment method used: locus, web3, or hybrid';
COMMENT ON COLUMN transactions.locus_metadata IS 'Additional metadata from Locus API responses';
