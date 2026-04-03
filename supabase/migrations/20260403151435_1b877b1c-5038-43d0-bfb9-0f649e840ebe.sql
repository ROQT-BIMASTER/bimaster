-- Add confidence_score and detection_method to security_incidents
ALTER TABLE public.security_incidents 
  ADD COLUMN IF NOT EXISTS confidence_score numeric DEFAULT 0.8,
  ADD COLUMN IF NOT EXISTS detection_method text DEFAULT 'rule_based';

-- Add block_level to security_ip_blocklist
ALTER TABLE public.security_ip_blocklist 
  ADD COLUMN IF NOT EXISTS block_level text DEFAULT 'hard';

-- Add constraint for valid detection methods
ALTER TABLE public.security_incidents 
  ADD CONSTRAINT chk_detection_method CHECK (detection_method IN ('rule_based', 'anomaly', 'manual'));

-- Add constraint for valid block levels  
ALTER TABLE public.security_ip_blocklist 
  ADD CONSTRAINT chk_block_level CHECK (block_level IN ('soft', 'hard'));