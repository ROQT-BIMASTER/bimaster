ALTER TABLE public.mkt_metricas_conta ADD COLUMN IF NOT EXISTS views bigint;
ALTER TABLE public.mkt_metricas_conta ADD COLUMN IF NOT EXISTS saves bigint;
ALTER TABLE public.mkt_posts ADD COLUMN IF NOT EXISTS views bigint;
ALTER TABLE public.mkt_posts ADD COLUMN IF NOT EXISTS saves bigint;
ALTER TABLE public.mkt_posts ADD COLUMN IF NOT EXISTS impressoes bigint;