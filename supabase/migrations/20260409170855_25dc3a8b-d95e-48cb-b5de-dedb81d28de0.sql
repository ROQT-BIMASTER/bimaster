
-- 1. Upgrade all existing soft blocks to hard (7-day expiry)
UPDATE public.security_ip_blocklist
SET block_level = 'hard',
    reason = reason || ' [UPGRADED to hard block - confirmed coordinated attack]',
    expires_at = now() + interval '7 days'
WHERE block_level = 'soft' AND is_active = true;

-- 2. Insert the 24 missing IPs from attacking subnets as hard blocks
INSERT INTO public.security_ip_blocklist (ip_address, block_level, blocked_by, reason, is_active, expires_at)
VALUES
  ('15.228.149.119', 'hard', 'manual', 'Distributed scanning attack - subnet 15.228.x.x', true, now() + interval '7 days'),
  ('15.228.154.9', 'hard', 'manual', 'Distributed scanning attack - subnet 15.228.x.x', true, now() + interval '7 days'),
  ('15.228.165.234', 'hard', 'manual', 'Distributed scanning attack - subnet 15.228.x.x', true, now() + interval '7 days'),
  ('15.228.227.233', 'hard', 'manual', 'Distributed scanning attack - subnet 15.228.x.x', true, now() + interval '7 days'),
  ('15.228.249.101', 'hard', 'manual', 'Distributed scanning attack - subnet 15.228.x.x', true, now() + interval '7 days'),
  ('15.228.254.62', 'hard', 'manual', 'Distributed scanning attack - subnet 15.228.x.x', true, now() + interval '7 days'),
  ('15.228.45.7', 'hard', 'manual', 'Distributed scanning attack - subnet 15.228.x.x', true, now() + interval '7 days'),
  ('15.228.47.65', 'hard', 'manual', 'Distributed scanning attack - subnet 15.228.x.x', true, now() + interval '7 days'),
  ('15.228.52.179', 'hard', 'manual', 'Distributed scanning attack - subnet 15.228.x.x', true, now() + interval '7 days'),
  ('15.228.58.103', 'hard', 'manual', 'Distributed scanning attack - subnet 15.228.x.x', true, now() + interval '7 days'),
  ('15.228.59.77', 'hard', 'manual', 'Distributed scanning attack - subnet 15.228.x.x', true, now() + interval '7 days'),
  ('15.228.99.254', 'hard', 'manual', 'Distributed scanning attack - subnet 15.228.x.x', true, now() + interval '7 days'),
  ('15.229.117.150', 'hard', 'manual', 'Distributed scanning attack - subnet 15.229.x.x', true, now() + interval '7 days'),
  ('15.229.252.230', 'hard', 'manual', 'Distributed scanning attack - subnet 15.229.x.x', true, now() + interval '7 days'),
  ('15.229.47.237', 'hard', 'manual', 'Distributed scanning attack - subnet 15.229.x.x', true, now() + interval '7 days'),
  ('18.228.26.234', 'hard', 'manual', 'Distributed scanning attack - subnet 18.228.x.x', true, now() + interval '7 days'),
  ('18.230.23.127', 'hard', 'manual', 'Distributed scanning attack - subnet 18.230.x.x', true, now() + interval '7 days'),
  ('18.230.70.53', 'hard', 'manual', 'Distributed scanning attack - subnet 18.230.x.x', true, now() + interval '7 days'),
  ('18.231.147.5', 'hard', 'manual', 'Distributed scanning attack - subnet 18.231.x.x', true, now() + interval '7 days'),
  ('18.231.167.150', 'hard', 'manual', 'Distributed scanning attack - subnet 18.231.x.x', true, now() + interval '7 days'),
  ('18.231.17.133', 'hard', 'manual', 'Distributed scanning attack - subnet 18.231.x.x', true, now() + interval '7 days'),
  ('56.124.51.173', 'hard', 'manual', 'Distributed scanning attack - subnet 56.124.x.x', true, now() + interval '7 days'),
  ('56.125.194.36', 'hard', 'manual', 'Distributed scanning attack - subnet 56.125.x.x', true, now() + interval '7 days'),
  ('56.125.229.223', 'hard', 'manual', 'Distributed scanning attack - subnet 56.125.x.x', true, now() + interval '7 days')
ON CONFLICT (ip_address) DO UPDATE SET block_level = 'hard', expires_at = now() + interval '7 days';
