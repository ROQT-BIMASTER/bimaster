-- Fix CHECK constraint to accept 'ai_sentinel'
ALTER TABLE security_ip_blocklist
  DROP CONSTRAINT IF EXISTS security_ip_blocklist_blocked_by_check;

ALTER TABLE security_ip_blocklist
  ADD CONSTRAINT security_ip_blocklist_blocked_by_check
    CHECK (blocked_by IN ('auto', 'manual', 'ai_sentinel'));

-- Add UNIQUE constraint on ip_address for upsert to work
ALTER TABLE security_ip_blocklist
  ADD CONSTRAINT security_ip_blocklist_ip_unique UNIQUE (ip_address);