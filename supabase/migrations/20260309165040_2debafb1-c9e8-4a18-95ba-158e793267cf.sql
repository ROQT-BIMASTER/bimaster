
-- Remove duplicate financial_payment_queue entries, keeping only the most recent per source_id + source_type
WITH ranked AS (
  SELECT
    id,
    source_id,
    source_type,
    ROW_NUMBER() OVER (
      PARTITION BY source_id, source_type
      ORDER BY created_at DESC
    ) as rn
  FROM financial_payment_queue
)
DELETE FROM financial_payment_queue
WHERE id IN (
  SELECT id FROM ranked WHERE rn > 1
);

-- Add unique constraint to prevent future duplicates
CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_queue_source
ON financial_payment_queue (source_id, source_type);
