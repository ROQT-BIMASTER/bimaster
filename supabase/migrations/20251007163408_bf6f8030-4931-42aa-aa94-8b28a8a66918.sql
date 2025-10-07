-- Create Trade Marketing Module Tables

-- 1. Stores (Pontos de Venda)
CREATE TABLE IF NOT EXISTS stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  chain VARCHAR(100),
  cnpj VARCHAR(18),
  address TEXT,
  city VARCHAR(100),
  state VARCHAR(2),
  zip_code VARCHAR(10),
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  phone VARCHAR(20),
  email VARCHAR(100),
  category VARCHAR(50),
  size VARCHAR(20),
  monthly_revenue DECIMAL(12,2),
  visit_frequency VARCHAR(20),
  priority VARCHAR(20),
  status VARCHAR(20) DEFAULT 'active',
  manager_name VARCHAR(100),
  manager_phone VARCHAR(20),
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stores_city ON stores(city);
CREATE INDEX IF NOT EXISTS idx_stores_status ON stores(status);
CREATE INDEX IF NOT EXISTS idx_stores_priority ON stores(priority);

-- 2. Visits (Visitas de Campo)
CREATE TABLE IF NOT EXISTS visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_code VARCHAR(50) UNIQUE NOT NULL,
  store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  scheduled_date DATE NOT NULL,
  scheduled_time TIME,
  check_in_time TIMESTAMP,
  check_out_time TIMESTAMP,
  check_in_latitude DECIMAL(10, 8),
  check_in_longitude DECIMAL(11, 8),
  check_out_latitude DECIMAL(10, 8),
  check_out_longitude DECIMAL(11, 8),
  duration_minutes INTEGER,
  status VARCHAR(20) DEFAULT 'scheduled',
  visit_type VARCHAR(50),
  objectives TEXT[],
  checklist_completed BOOLEAN DEFAULT false,
  photos_count INTEGER DEFAULT 0,
  compliance_score DECIMAL(5,2),
  issues_found INTEGER DEFAULT 0,
  notes TEXT,
  signature_url TEXT,
  weather VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_visits_store ON visits(store_id);
CREATE INDEX IF NOT EXISTS idx_visits_user ON visits(user_id);
CREATE INDEX IF NOT EXISTS idx_visits_status ON visits(status);
CREATE INDEX IF NOT EXISTS idx_visits_date ON visits(scheduled_date);

-- 3. Photos (Fotos de Campo)
CREATE TABLE IF NOT EXISTS photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id UUID REFERENCES visits(id) ON DELETE CASCADE,
  store_id UUID REFERENCES stores(id),
  photo_url TEXT NOT NULL,
  thumbnail_url TEXT,
  photo_type VARCHAR(50) NOT NULL,
  category VARCHAR(100),
  section VARCHAR(100),
  ai_processed BOOLEAN DEFAULT false,
  ai_analysis JSONB,
  detected_products JSONB,
  detected_prices JSONB,
  detected_brands JSONB,
  total_facings INTEGER,
  our_facings INTEGER,
  competitor_facings INTEGER,
  compliance_score DECIMAL(5,2),
  quality_score DECIMAL(5,2),
  has_rupture BOOLEAN DEFAULT false,
  has_promotion BOOLEAN DEFAULT false,
  requires_action BOOLEAN DEFAULT false,
  action_items TEXT[],
  observations TEXT,
  approved BOOLEAN DEFAULT false,
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMP,
  upload_date TIMESTAMP DEFAULT NOW(),
  processed_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_photos_visit ON photos(visit_id);
CREATE INDEX IF NOT EXISTS idx_photos_type ON photos(photo_type);
CREATE INDEX IF NOT EXISTS idx_photos_ai_processed ON photos(ai_processed);

-- 4. Products (Produtos/SKUs)
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku VARCHAR(100) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  brand VARCHAR(100),
  manufacturer VARCHAR(100),
  category VARCHAR(100),
  subcategory VARCHAR(100),
  line VARCHAR(100),
  size VARCHAR(50),
  unit VARCHAR(20),
  barcode VARCHAR(50),
  ean13 VARCHAR(13),
  image_url TEXT,
  price_reference DECIMAL(10,2),
  cost DECIMAL(10,2),
  margin_percentage DECIMAL(5,2),
  is_our_product BOOLEAN DEFAULT true,
  is_focus BOOLEAN DEFAULT false,
  minimum_facings INTEGER DEFAULT 3,
  ideal_position VARCHAR(50),
  active BOOLEAN DEFAULT true,
  launch_date DATE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_brand ON products(brand);

-- 5. Shelf Share (Presença em Gôndola)
CREATE TABLE IF NOT EXISTS shelf_share (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id UUID REFERENCES visits(id) ON DELETE CASCADE,
  store_id UUID REFERENCES stores(id),
  product_id UUID REFERENCES products(id),
  photo_id UUID REFERENCES photos(id),
  in_stock BOOLEAN DEFAULT true,
  quantity_facings INTEGER DEFAULT 0,
  shelf_position VARCHAR(50),
  position_quality DECIMAL(5,2),
  price_found DECIMAL(10,2),
  price_vs_reference DECIMAL(5,2),
  has_price_tag BOOLEAN,
  price_tag_correct BOOLEAN,
  promotion_active BOOLEAN DEFAULT false,
  promotion_type VARCHAR(100),
  promotion_mechanics TEXT,
  stock_level VARCHAR(20),
  product_condition VARCHAR(50),
  expiry_check BOOLEAN,
  near_expiry BOOLEAN DEFAULT false,
  competitor_nearby BOOLEAN DEFAULT false,
  visibility_score DECIMAL(5,2),
  compliance_items JSONB,
  recorded_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shelf_visit ON shelf_share(visit_id);
CREATE INDEX IF NOT EXISTS idx_shelf_product ON shelf_share(product_id);

-- 6. Competitors (Concorrentes)
CREATE TABLE IF NOT EXISTS competitors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  brand VARCHAR(100),
  manufacturer VARCHAR(100),
  category VARCHAR(100),
  is_direct_competitor BOOLEAN DEFAULT true,
  threat_level VARCHAR(20),
  market_share DECIMAL(5,2),
  logo_url TEXT,
  notes TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 7. Competitor Intelligence
CREATE TABLE IF NOT EXISTS competitor_intelligence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id UUID REFERENCES visits(id) ON DELETE CASCADE,
  store_id UUID REFERENCES stores(id),
  competitor_id UUID REFERENCES competitors(id),
  product_name VARCHAR(255),
  product_sku VARCHAR(100),
  price DECIMAL(10,2),
  our_price DECIMAL(10,2),
  price_difference_percentage DECIMAL(5,2),
  promotion_active BOOLEAN DEFAULT false,
  promotion_type VARCHAR(100),
  promotion_description TEXT,
  promotion_discount DECIMAL(5,2),
  shelf_space_cm DECIMAL(6,2),
  facings_count INTEGER,
  shelf_share_percentage DECIMAL(5,2),
  positioning_height VARCHAR(50),
  positioning_quality VARCHAR(50),
  has_special_display BOOLEAN DEFAULT false,
  display_type VARCHAR(100),
  visibility_score DECIMAL(5,2),
  photo_id UUID REFERENCES photos(id),
  observations TEXT,
  recorded_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_competitor_intel_competitor ON competitor_intelligence(competitor_id);
CREATE INDEX IF NOT EXISTS idx_competitor_intel_store ON competitor_intelligence(store_id);

-- 8. Promotions (Campanhas Promocionais)
CREATE TABLE IF NOT EXISTS promotions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  product_ids UUID[],
  store_ids UUID[],
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  promotion_type VARCHAR(100),
  mechanics TEXT,
  discount_percentage DECIMAL(5,2),
  discount_value DECIMAL(10,2),
  target_value DECIMAL(12,2),
  budget DECIMAL(12,2),
  materials_needed TEXT[],
  checklist JSONB,
  status VARCHAR(20) DEFAULT 'planned',
  performance_summary JSONB,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_promotions_status ON promotions(status);
CREATE INDEX IF NOT EXISTS idx_promotions_dates ON promotions(start_date, end_date);

-- 9. Promotion Execution
CREATE TABLE IF NOT EXISTS promotion_execution (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  promotion_id UUID REFERENCES promotions(id) ON DELETE CASCADE,
  visit_id UUID REFERENCES visits(id),
  store_id UUID REFERENCES stores(id),
  is_active BOOLEAN,
  is_compliant BOOLEAN,
  compliance_score DECIMAL(5,2),
  materials_present JSONB,
  materials_missing TEXT[],
  price_correct BOOLEAN,
  positioning_correct BOOLEAN,
  stock_sufficient BOOLEAN,
  visibility_adequate BOOLEAN,
  photo_evidence UUID[],
  issues_found TEXT[],
  corrective_actions TEXT[],
  estimated_sales DECIMAL(10,2),
  observations TEXT,
  checked_by UUID REFERENCES auth.users(id),
  checked_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_promo_exec_promotion ON promotion_execution(promotion_id);
CREATE INDEX IF NOT EXISTS idx_promo_exec_store ON promotion_execution(store_id);

-- 10. AI Insights
CREATE TABLE IF NOT EXISTS ai_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type VARCHAR(50),
  entity_id UUID,
  insight_type VARCHAR(100),
  category VARCHAR(100),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  data_points JSONB,
  confidence_score DECIMAL(5,2),
  impact_level VARCHAR(20),
  priority VARCHAR(20),
  estimated_revenue_impact DECIMAL(12,2),
  action_items JSONB,
  status VARCHAR(20) DEFAULT 'new',
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMP,
  actioned_by UUID REFERENCES auth.users(id),
  actioned_at TIMESTAMP,
  dismissal_reason TEXT,
  generated_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_insights_type ON ai_insights(insight_type);
CREATE INDEX IF NOT EXISTS idx_insights_status ON ai_insights(status);
CREATE INDEX IF NOT EXISTS idx_insights_priority ON ai_insights(priority);

-- 11. KPIs Tracking
CREATE TABLE IF NOT EXISTS kpis_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  store_id UUID REFERENCES stores(id),
  region VARCHAR(100),
  category VARCHAR(100),
  numeric_distribution DECIMAL(5,2),
  weighted_distribution DECIMAL(5,2),
  out_of_stock_rate DECIMAL(5,2),
  shelf_share DECIMAL(5,2),
  value_share DECIMAL(5,2),
  volume_share DECIMAL(5,2),
  average_price DECIMAL(10,2),
  price_index DECIMAL(5,2),
  promotion_intensity DECIMAL(5,2),
  compliance_score DECIMAL(5,2),
  visit_completion_rate DECIMAL(5,2),
  avg_facings DECIMAL(5,2),
  sales_value DECIMAL(12,2),
  sales_volume INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kpis_date ON kpis_tracking(date);
CREATE INDEX IF NOT EXISTS idx_kpis_store ON kpis_tracking(store_id);

-- 12. Routes (Rotas de Visita)
CREATE TABLE IF NOT EXISTS routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  user_id UUID REFERENCES auth.users(id),
  date DATE NOT NULL,
  store_ids UUID[],
  start_location JSONB,
  end_location JSONB,
  estimated_distance_km DECIMAL(6,2),
  estimated_duration_minutes INTEGER,
  status VARCHAR(20) DEFAULT 'planned',
  actual_distance_km DECIMAL(6,2),
  actual_duration_minutes INTEGER,
  stores_completed INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Enable RLS on all tables
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE shelf_share ENABLE ROW LEVEL SECURITY;
ALTER TABLE competitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE competitor_intelligence ENABLE ROW LEVEL SECURITY;
ALTER TABLE promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE promotion_execution ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE kpis_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE routes ENABLE ROW LEVEL SECURITY;

-- RLS Policies (permitir acesso total por enquanto)
CREATE POLICY "Acesso total stores" ON stores FOR ALL USING (true);
CREATE POLICY "Acesso total visits" ON visits FOR ALL USING (true);
CREATE POLICY "Acesso total photos" ON photos FOR ALL USING (true);
CREATE POLICY "Acesso total products" ON products FOR ALL USING (true);
CREATE POLICY "Acesso total shelf_share" ON shelf_share FOR ALL USING (true);
CREATE POLICY "Acesso total competitors" ON competitors FOR ALL USING (true);
CREATE POLICY "Acesso total competitor_intelligence" ON competitor_intelligence FOR ALL USING (true);
CREATE POLICY "Acesso total promotions" ON promotions FOR ALL USING (true);
CREATE POLICY "Acesso total promotion_execution" ON promotion_execution FOR ALL USING (true);
CREATE POLICY "Acesso total ai_insights" ON ai_insights FOR ALL USING (true);
CREATE POLICY "Acesso total kpis_tracking" ON kpis_tracking FOR ALL USING (true);
CREATE POLICY "Acesso total routes" ON routes FOR ALL USING (true);

-- Insert tela_sistema para Trade Marketing
INSERT INTO telas_sistema (codigo, nome, rota, icone, ordem, ativo, descricao)
VALUES 
  ('trade_marketing', 'Trade Marketing', '/dashboard/trade-marketing', 'Store', 50, true, 'Módulo de Trade Marketing e Monitoramento de PDV'),
  ('trade_stores', 'PDVs', '/dashboard/trade-marketing/stores', 'Store', 51, true, 'Gestão de Pontos de Venda'),
  ('trade_visits', 'Visitas', '/dashboard/trade-marketing/visits', 'Calendar', 52, true, 'Visitas de Campo'),
  ('trade_photos', 'Fotos', '/dashboard/trade-marketing/photos', 'Image', 53, true, 'Análise de Fotos'),
  ('trade_competitors', 'Concorrentes', '/dashboard/trade-marketing/competitors', 'Target', 54, true, 'Monitoramento Competitivo'),
  ('trade_promotions', 'Promoções', '/dashboard/trade-marketing/promotions', 'Tag', 55, true, 'Gestão de Promoções'),
  ('trade_insights', 'Insights IA', '/dashboard/trade-marketing/insights', 'Sparkles', 56, true, 'Insights Gerados por IA')
ON CONFLICT (codigo) DO NOTHING;