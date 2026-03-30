-- Payment event audit log for finance/support traceability
CREATE TABLE IF NOT EXISTS payment_event_audit (
  id BIGSERIAL PRIMARY KEY,
  order_id BIGINT REFERENCES orders(id) ON DELETE SET NULL,
  receipt_id TEXT,
  provider TEXT CHECK (provider IN ('stripe', 'paypal', 'system')),
  event_type TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('received', 'success', 'failed', 'skipped')),
  amount NUMERIC(12,2),
  currency TEXT DEFAULT 'USD',
  transaction_id TEXT,
  source TEXT,
  event_time TIMESTAMPTZ DEFAULT NOW(),
  raw_payload JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_event_audit_order_id ON payment_event_audit(order_id);
CREATE INDEX IF NOT EXISTS idx_payment_event_audit_event_time ON payment_event_audit(event_time DESC);
CREATE INDEX IF NOT EXISTS idx_payment_event_audit_provider ON payment_event_audit(provider);

ALTER TABLE payment_event_audit ENABLE ROW LEVEL SECURITY;

-- Admin-safe read policy for authenticated users.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'payment_event_audit'
      AND policyname = 'Allow authenticated read payment audit'
  ) THEN
    CREATE POLICY "Allow authenticated read payment audit"
      ON payment_event_audit
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END;
$$;

-- Allow app clients to insert timeline events (admin cash events are written from dashboard client).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'payment_event_audit'
      AND policyname = 'Allow public insert payment audit'
  ) THEN
    CREATE POLICY "Allow public insert payment audit"
      ON payment_event_audit
      FOR INSERT
      TO public
      WITH CHECK (true);
  END IF;
END;
$$;
