-- ETL Professional Improvements: Materialized Views, CDC, and Aggregations
-- Drop existing views if they exist
DROP MATERIALIZED VIEW IF EXISTS mv_sales_performance CASCADE;
DROP MATERIALIZED VIEW IF EXISTS mv_conversion_funnel CASCADE;
DROP MATERIALIZED VIEW IF EXISTS mv_trade_performance CASCADE;

-- ==========================================
-- 1. MATERIALIZED VIEWS FOR BI
-- ==========================================

-- View agregada de vendas por período/vendedor/região
CREATE MATERIALIZED VIEW mv_sales_performance AS
SELECT 
  DATE_TRUNC('month', s.sale_date) AS mes,
  s.salesperson_id,
  p.nome AS vendedor,
  m.regiao,
  m.uf,
  COUNT(DISTINCT s.id) AS total_vendas,
  SUM(s.net_value) AS valor_liquido,
  AVG(s.net_value) AS ticket_medio,
  SUM(s.discount_value) AS total_descontos
FROM sales s
LEFT JOIN profiles p ON s.salesperson_id = p.id
LEFT JOIN stores st ON s.store_id = st.id
LEFT JOIN municipios m ON st.state = m.uf
WHERE s.status NOT IN ('cancelled')
GROUP BY 1, 2, 3, 4, 5;

CREATE INDEX idx_mv_sales_performance_mes ON mv_sales_performance(mes);
CREATE INDEX idx_mv_sales_performance_vendedor ON mv_sales_performance(salesperson_id);

-- View de funil de conversão
CREATE MATERIALIZED VIEW mv_conversion_funnel AS
SELECT 
  DATE_TRUNC('week', p.created_at) AS semana,
  p.status,
  m.regiao,
  m.uf,
  COUNT(*) AS total_prospects,
  COUNT(*) FILTER (WHERE p.vendedor_id IS NOT NULL) AS com_vendedor,
  COUNT(DISTINCT a.id) AS total_atividades,
  COUNT(*) FILTER (WHERE p.status = 'ganho') AS convertidos
FROM prospects p
LEFT JOIN municipios m ON p.municipio_id = m.id
LEFT JOIN atividades a ON a.prospect_id = p.id
GROUP BY 1, 2, 3, 4;

CREATE INDEX idx_mv_conversion_funnel_semana ON mv_conversion_funnel(semana);
CREATE INDEX idx_mv_conversion_funnel_status ON mv_conversion_funnel(status);

-- View de performance trade marketing
CREATE MATERIALIZED VIEW mv_trade_performance AS
SELECT 
  DATE_TRUNC('month', v.created_at) AS mes,
  st.id AS store_id,
  st.name AS store_name,
  st.city,
  st.state,
  COUNT(DISTINCT v.id) AS total_visitas,
  COUNT(DISTINCT ga.id) AS total_auditorias,
  AVG(ga.quantidade_frentes) AS media_frentes,
  COUNT(*) FILTER (WHERE ga.conforme_planograma = true) AS auditorias_conformes,
  COUNT(*) FILTER (WHERE ga.produto_presente = false) AS produtos_faltantes,
  SUM(ti.amount) AS total_investimentos
FROM stores st
LEFT JOIN visits v ON v.store_id = st.id
LEFT JOIN gondola_audits ga ON ga.store_id = st.id
LEFT JOIN trade_investments ti ON ti.store_id = st.id
WHERE v.status = 'completed' OR v.status IS NULL
GROUP BY 1, 2, 3, 4, 5;

CREATE INDEX idx_mv_trade_performance_mes ON mv_trade_performance(mes);
CREATE INDEX idx_mv_trade_performance_store ON mv_trade_performance(store_id);

-- ==========================================
-- 2. CDC (CHANGE DATA CAPTURE)
-- ==========================================

-- Tabela de log de mudanças
CREATE TABLE IF NOT EXISTS etl_changelog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL,
  operation TEXT NOT NULL,
  record_id UUID NOT NULL,
  changed_data JSONB,
  changed_at TIMESTAMPTZ DEFAULT NOW(),
  changed_by UUID REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_etl_changelog_table ON etl_changelog(table_name);
CREATE INDEX IF NOT EXISTS idx_etl_changelog_date ON etl_changelog(changed_at);
CREATE INDEX IF NOT EXISTS idx_etl_changelog_record ON etl_changelog(record_id);

-- Enable RLS
ALTER TABLE etl_changelog ENABLE ROW LEVEL SECURITY;

-- Policy for admin/supervisor to view changelog
DROP POLICY IF EXISTS "Admins e supervisores podem ver changelog" ON etl_changelog;
CREATE POLICY "Admins e supervisores podem ver changelog"
ON etl_changelog FOR SELECT
USING (is_admin_or_supervisor(auth.uid()));

-- Função genérica para tracking de mudanças
CREATE OR REPLACE FUNCTION log_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    INSERT INTO etl_changelog (table_name, operation, record_id, changed_data, changed_by)
    VALUES (TG_TABLE_NAME, TG_OP, OLD.id, row_to_json(OLD), auth.uid());
    RETURN OLD;
  ELSE
    INSERT INTO etl_changelog (table_name, operation, record_id, changed_data, changed_by)
    VALUES (TG_TABLE_NAME, TG_OP, NEW.id, row_to_json(NEW), auth.uid());
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Aplicar triggers em tabelas de fato principais
DROP TRIGGER IF EXISTS track_sales_changes ON sales;
CREATE TRIGGER track_sales_changes
AFTER INSERT OR UPDATE OR DELETE ON sales
FOR EACH ROW EXECUTE FUNCTION log_changes();

DROP TRIGGER IF EXISTS track_visits_changes ON visits;
CREATE TRIGGER track_visits_changes
AFTER INSERT OR UPDATE OR DELETE ON visits
FOR EACH ROW EXECUTE FUNCTION log_changes();

DROP TRIGGER IF EXISTS track_investments_changes ON trade_investments;
CREATE TRIGGER track_investments_changes
AFTER INSERT OR UPDATE OR DELETE ON trade_investments
FOR EACH ROW EXECUTE FUNCTION log_changes();

DROP TRIGGER IF EXISTS track_atividades_changes ON atividades;
CREATE TRIGGER track_atividades_changes
AFTER INSERT OR UPDATE OR DELETE ON atividades
FOR EACH ROW EXECUTE FUNCTION log_changes();

DROP TRIGGER IF EXISTS track_prospects_changes ON prospects;
CREATE TRIGGER track_prospects_changes
AFTER INSERT OR UPDATE OR DELETE ON prospects
FOR EACH ROW EXECUTE FUNCTION log_changes();

-- ==========================================
-- 3. PRE-CALCULATED AGGREGATIONS
-- ==========================================

-- Tabela de KPIs diários agregados
CREATE TABLE IF NOT EXISTS agg_daily_kpis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  regiao TEXT NOT NULL DEFAULT '',
  uf TEXT NOT NULL DEFAULT '',
  total_visitas INTEGER DEFAULT 0,
  total_vendas NUMERIC(15,2) DEFAULT 0,
  total_investimentos NUMERIC(15,2) DEFAULT 0,
  media_ticket NUMERIC(15,2) DEFAULT 0,
  total_prospects INTEGER DEFAULT 0,
  prospects_convertidos INTEGER DEFAULT 0,
  taxa_conversao NUMERIC(5,2) DEFAULT 0,
  total_atividades INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(date, regiao, uf)
);

CREATE INDEX IF NOT EXISTS idx_agg_daily_kpis_date ON agg_daily_kpis(date);
CREATE INDEX IF NOT EXISTS idx_agg_daily_kpis_regiao ON agg_daily_kpis(regiao);
CREATE INDEX IF NOT EXISTS idx_agg_daily_kpis_uf ON agg_daily_kpis(uf);

-- Enable RLS
ALTER TABLE agg_daily_kpis ENABLE ROW LEVEL SECURITY;

-- Policy for viewing aggregated data
DROP POLICY IF EXISTS "Usuários aprovados podem ver KPIs agregados" ON agg_daily_kpis;
CREATE POLICY "Usuários aprovados podem ver KPIs agregados"
ON agg_daily_kpis FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND aprovado = true
  )
);

-- Função para atualizar KPIs diários
CREATE OR REPLACE FUNCTION refresh_daily_kpis(target_date DATE DEFAULT CURRENT_DATE - 1)
RETURNS void AS $$
BEGIN
  DELETE FROM agg_daily_kpis WHERE date = target_date;
  
  INSERT INTO agg_daily_kpis (
    date, regiao, uf, 
    total_visitas, total_vendas, total_investimentos, 
    media_ticket, total_prospects, prospects_convertidos,
    taxa_conversao, total_atividades
  )
  SELECT 
    target_date,
    COALESCE(m.regiao::text, ''),
    COALESCE(m.uf, ''),
    COUNT(DISTINCT v.id) AS total_visitas,
    COALESCE(SUM(s.net_value), 0) AS total_vendas,
    COALESCE(SUM(ti.amount), 0) AS total_investimentos,
    COALESCE(AVG(s.net_value), 0) AS media_ticket,
    COUNT(DISTINCT p.id) AS total_prospects,
    COUNT(DISTINCT CASE WHEN p.status = 'ganho' THEN p.id END) AS prospects_convertidos,
    CASE 
      WHEN COUNT(DISTINCT p.id) > 0 
      THEN ROUND((COUNT(DISTINCT CASE WHEN p.status = 'ganho' THEN p.id END)::NUMERIC / COUNT(DISTINCT p.id)::NUMERIC) * 100, 2)
      ELSE 0 
    END AS taxa_conversao,
    COUNT(DISTINCT a.id) AS total_atividades
  FROM municipios m
  LEFT JOIN stores st ON st.state = m.uf
  LEFT JOIN visits v ON v.store_id = st.id AND v.created_at::date = target_date
  LEFT JOIN sales s ON s.store_id = st.id AND s.sale_date = target_date
  LEFT JOIN trade_investments ti ON ti.store_id = st.id AND ti.investment_date = target_date
  LEFT JOIN prospects p ON p.municipio_id = m.id AND p.created_at::date <= target_date
  LEFT JOIN atividades a ON a.prospect_id = p.id AND a.data_atividade::date = target_date
  GROUP BY m.regiao, m.uf;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para refresh das views materializadas
CREATE OR REPLACE FUNCTION refresh_all_materialized_views()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_sales_performance;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_conversion_funnel;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_trade_performance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION refresh_daily_kpis TO authenticated;
GRANT EXECUTE ON FUNCTION refresh_all_materialized_views TO authenticated;