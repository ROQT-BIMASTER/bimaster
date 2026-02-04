-- Add attachments column to financial_payment_queue for storing document arrays
ALTER TABLE financial_payment_queue 
ADD COLUMN IF NOT EXISTS attachments jsonb DEFAULT '[]'::jsonb;

-- Add comment for documentation
COMMENT ON COLUMN financial_payment_queue.attachments IS 'Array of attached documents from source expense';