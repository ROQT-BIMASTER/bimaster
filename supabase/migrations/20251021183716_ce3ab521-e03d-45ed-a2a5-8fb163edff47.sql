-- Fix security warnings for ETL functions and materialized views

-- Fix function search paths
ALTER FUNCTION log_changes() SET search_path = public;
ALTER FUNCTION refresh_daily_kpis(DATE) SET search_path = public;
ALTER FUNCTION refresh_all_materialized_views() SET search_path = public;

-- Add RLS to materialized views
ALTER MATERIALIZED VIEW mv_sales_performance OWNER TO postgres;
ALTER MATERIALIZED VIEW mv_conversion_funnel OWNER TO postgres;
ALTER MATERIALIZED VIEW mv_trade_performance OWNER TO postgres;

-- Create policies for materialized views
-- Note: Materialized views can't have RLS directly, but we can control via grants
REVOKE ALL ON mv_sales_performance FROM PUBLIC;
REVOKE ALL ON mv_conversion_funnel FROM PUBLIC;
REVOKE ALL ON mv_trade_performance FROM PUBLIC;

GRANT SELECT ON mv_sales_performance TO authenticated;
GRANT SELECT ON mv_conversion_funnel TO authenticated;
GRANT SELECT ON mv_trade_performance TO authenticated;