
-- ============ DIMENSÕES ============
CREATE TABLE IF NOT EXISTS public.coordenadores (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null unique,
  ativo       boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

CREATE TABLE IF NOT EXISTS public.vendedores (
  id                uuid primary key default gen_random_uuid(),
  futura_id         integer not null unique,
  nome              text not null,
  razao_social      text,
  cnpj_cpf          text,
  tipo_vendedor     smallint,
  coordenador_id    uuid references public.coordenadores(id) on delete set null,
  coord_futura_id   integer,
  coord_futura_nome text,
  ativo             boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
CREATE INDEX IF NOT EXISTS idx_vendedores_coordenador ON public.vendedores(coordenador_id);

-- ============ FATOS ============
CREATE TABLE IF NOT EXISTS public.erp_vendas (
  id                 bigint generated always as identity primary key,
  futura_nota_id     integer not null unique,
  empresa_id         smallint not null,
  nro_nota           integer,
  serie              text,
  modelo_doc         smallint,
  cfop_id            integer,
  tipo_pedido_id     integer,
  data_emissao       date not null,
  cliente_futura_id  integer,
  cliente_nome       text,
  cliente_cnpj_cpf   text,
  vendedor_futura_id integer,
  quantidade         numeric(18,4),
  total_produto      numeric(18,2),
  total_desconto     numeric(18,2),
  total_nota         numeric(18,2),
  status             smallint not null,
  entrada_saida      char(1),
  raw                jsonb,
  sincronizado_em    timestamptz not null default now(),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
CREATE INDEX IF NOT EXISTS idx_erp_vendas_data     ON public.erp_vendas(data_emissao DESC);
CREATE INDEX IF NOT EXISTS idx_erp_vendas_vendedor ON public.erp_vendas(vendedor_futura_id);
CREATE INDEX IF NOT EXISTS idx_erp_vendas_cliente  ON public.erp_vendas(cliente_futura_id);
CREATE INDEX IF NOT EXISTS idx_erp_vendas_empresa  ON public.erp_vendas(empresa_id);

CREATE TABLE IF NOT EXISTS public.erp_vendas_item (
  id                bigint generated always as identity primary key,
  futura_item_id    integer not null unique,
  futura_nota_id    integer not null,
  sequencia         integer,
  produto_futura_id integer,
  cod_produto       text,
  ean               text,
  descricao         text,
  quantidade        numeric(18,4),
  valor_unitario    numeric(18,5),
  desconto_valor    numeric(18,2),
  total_item        numeric(18,2),
  raw               jsonb,
  sincronizado_em   timestamptz not null default now(),
  created_at        timestamptz not null default now()
);
CREATE INDEX IF NOT EXISTS idx_erp_vendas_item_nota ON public.erp_vendas_item(futura_nota_id);
CREATE INDEX IF NOT EXISTS idx_erp_vendas_item_cod  ON public.erp_vendas_item(cod_produto);
CREATE INDEX IF NOT EXISTS idx_erp_vendas_item_ean  ON public.erp_vendas_item(ean) WHERE ean IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.erp_vendas_sync_log (
  id                bigint generated always as identity primary key,
  started_at        timestamptz not null default now(),
  finished_at       timestamptz,
  tipo              text,
  periodo_de        date,
  periodo_ate       date,
  notas_recebidas   int,
  notas_upserted    int,
  itens_upserted    int,
  status            text not null default 'em_andamento' CHECK (status IN ('em_andamento','ok','erro')),
  erro              text,
  created_at        timestamptz not null default now()
);
CREATE INDEX IF NOT EXISTS idx_erp_vendas_sync_started ON public.erp_vendas_sync_log(started_at DESC);

-- ============ GRANTs ============
GRANT SELECT, INSERT, UPDATE, DELETE ON public.coordenadores       TO authenticated;
GRANT ALL                              ON public.coordenadores       TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendedores          TO authenticated;
GRANT ALL                              ON public.vendedores          TO service_role;

GRANT SELECT                            ON public.erp_vendas          TO authenticated;
GRANT ALL                              ON public.erp_vendas          TO service_role;

GRANT SELECT                            ON public.erp_vendas_item     TO authenticated;
GRANT ALL                              ON public.erp_vendas_item     TO service_role;

GRANT SELECT                            ON public.erp_vendas_sync_log TO authenticated;
GRANT ALL                              ON public.erp_vendas_sync_log TO service_role;

-- ============ RLS ============
ALTER TABLE public.coordenadores       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendedores          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.erp_vendas          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.erp_vendas_item     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.erp_vendas_sync_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "coordenadores_select"  ON public.coordenadores  FOR SELECT TO authenticated USING (true);
CREATE POLICY "coordenadores_manage"  ON public.coordenadores  FOR ALL    TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "vendedores_select"     ON public.vendedores     FOR SELECT TO authenticated USING (true);
CREATE POLICY "vendedores_update"     ON public.vendedores     FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "erp_vendas_select"      ON public.erp_vendas          FOR SELECT TO authenticated USING (true);
CREATE POLICY "erp_vendas_item_select" ON public.erp_vendas_item     FOR SELECT TO authenticated USING (true);
CREATE POLICY "erp_vendas_log_select"  ON public.erp_vendas_sync_log FOR SELECT TO authenticated USING (true);

-- ============ Triggers updated_at ============
DROP TRIGGER IF EXISTS trg_coordenadores_updated ON public.coordenadores;
CREATE TRIGGER trg_coordenadores_updated BEFORE UPDATE ON public.coordenadores
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_vendedores_updated ON public.vendedores;
CREATE TRIGGER trg_vendedores_updated BEFORE UPDATE ON public.vendedores
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_erp_vendas_updated ON public.erp_vendas;
CREATE TRIGGER trg_erp_vendas_updated BEFORE UPDATE ON public.erp_vendas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ View ============
CREATE OR REPLACE VIEW public.v_vendas AS
SELECT
  v.futura_nota_id, v.empresa_id, v.nro_nota, v.serie, v.data_emissao,
  v.cliente_futura_id, v.cliente_nome, v.cliente_cnpj_cpf,
  v.vendedor_futura_id,
  vd.id            AS vendedor_id,
  vd.nome          AS vendedor_nome,
  vd.coordenador_id,
  c.nome           AS coordenador_nome,
  v.quantidade, v.total_produto, v.total_desconto, v.total_nota,
  v.status, v.sincronizado_em
FROM public.erp_vendas v
LEFT JOIN public.vendedores   vd ON vd.futura_id = v.vendedor_futura_id
LEFT JOIN public.coordenadores c  ON c.id = vd.coordenador_id
WHERE v.entrada_saida = 'S' AND v.status = 1;

COMMENT ON VIEW public.v_vendas IS
  'Vendas emitidas (saida) com vendedor e coordenador resolvidos. Base do controle de vendas.';

-- ============ Seed: 78 vendedores ============
INSERT INTO public.vendedores
  (futura_id, nome, razao_social, cnpj_cpf, tipo_vendedor, coord_futura_id, coord_futura_nome, ativo)
VALUES
  (16, 'UNION', 'UNION', NULL, 0, NULL, NULL, true),
  (96305, 'NEW COSMIC LTDA', 'NEW COSMIC LTDA', '56.006.392/0001-50', 0, NULL, NULL, true),
  (67605, 'A GENTE COSMETICS LTDA', 'A GENTE COSMETICS LTDA', '56.062.642/0001-70', 0, 16, 'UNION', true),
  (51, 'AILIN J CHANG', 'AILIN J CHANG', '226.334.238-92', 0, NULL, NULL, true),
  (68, 'TANIA COMERCIO E REPRESENTACOES NACIONAIS E IMPORTADOS LTDA', 'TANIA COMERCIO E REPRESENTACOES NACIONAIS E IMPORTADOS LTDA', '18.182.363/0001-50', 0, NULL, NULL, true),
  (69, 'MARCIO VINICIUS MERLIN', 'VINICIUS MERLIN', '118.101.788-27', 0, NULL, NULL, true),
  (66, 'NUNES COMERCIO E REPRESENTACOES EIRELI - ME', 'NUNES COMERCIO E REPRESENTACOES EIRELI - ME', '11.214.910/0001-93', 0, NULL, NULL, true),
  (53, 'BRUMILLA COMERCIO E REPRESENTACOES', 'BRUMILLA COMERCIO E REPRESENTACOES EIRELI', '13.351.928/0001-62', 0, NULL, NULL, true),
  (63, 'MAXMAR COMERCIO DE ARMARINHOS LTDA - ME', 'MAXMAR COMERCIO DE ARMARINHOS LTDA - ME', '09.212.344/0001-39', 0, NULL, NULL, true),
  (65, 'NINO & NUNES', 'NINO & NUNES', '146.970.718-75', 0, NULL, NULL, true),
  (62, 'J.B. & FILHOS COMERCIAL LTDA - ME', 'J.B. & FILHOS COMERCIAL LTDA - ME', '03.708.579/0001-30', 0, NULL, NULL, true),
  (52, 'ANGELA SHU', 'ANGELA SHU', '142.780.638-14', 0, NULL, NULL, true),
  (64, 'M&M COMERCIO E REPRES DE UTILIDADES DOMESTICAS LTDA - ME', 'M&M COMERCIO E REPRES DE UTILIDADES DOMESTICAS LTDA - ME', '08.012.370/0001-50', 0, 64, NULL, true),
  (15, 'RUBY ROSE', 'RUBY ROSE', NULL, 0, NULL, NULL, true),
  (55, 'C.S.S COMERCIO DE COSMESTICOS PRESENTES E DECORACOES LTDA', 'C.S.S COMERCIO DE COSMESTICOS PRESENTES E DECORACOES LTDA', '06.045.251/0001-79', 0, NULL, NULL, true),
  (529, 'A.G. DE ASSIS - COSMETICOS - ME', 'A.G. DE ASSIS - COSMETICOS - ME', '08.727.052/0001-76', 0, NULL, NULL, true),
  (50, 'ADAPT COMERCIO E REPRESENTAÇÕES LTDA', 'ADAPT COMERCIO E REPRESENTAÇÕES LTDA', '08.969.330/0001-00', 0, NULL, NULL, true),
  (98101, 'ANDRESSA MACENA BONDEZAN', 'ANDRESSA MACENA BONDEZAN', '337.239.518-21', 0, NULL, NULL, true),
  (88401, 'ARMAD', 'ARMAD', NULL, 0, NULL, NULL, true),
  (2705, 'CAMILA LEAL', 'CAMILA VIDA LEAL', '395.754.578-11', 0, NULL, NULL, true),
  (90401, 'CAROLINE', 'CAROLINE AFONSO ALMEIDA CORREIA', '422.582.268-05', 0, NULL, NULL, true),
  (54, 'CBR REPRESENTAÇÕES', 'CBR REPRESENTAÇÕES', '402.481.848-14', 0, NULL, NULL, true),
  (522, 'CH DISTRIBUIDORA LTDA - EPP   (JOÃO PAULO)', 'CH DISTRIBUIDORA LTDA - EPP', '17.959.910/0001-07', 0, NULL, NULL, true),
  (116501, 'DARLENE ALVES DE OLIVEIRA', 'DARLENE ALVES DE OLIVEIRA', '320.500.858-85', 0, NULL, NULL, true),
  (12905, 'DIEGO ROSA DE SA NOVAES', 'DIEGO ROSA DE SA NOVAES', '379.723.158-09', 0, NULL, NULL, true),
  (57, 'EAP DISTRIBUIDORA', 'EAP COM DIST IMPORTACAO E EXPORTACAO DE COSMETICOS LTDA', '25.086.167/0001-48', 0, 67605, 'A GENTE COSMETICS LTDA', true),
  (23301, 'EDERCIO BITTENCOURT MUNIZ', 'EDERCIO BITTENCOURT MUNIZ', '15.443.704/0001-06', 1, 15, 'RUBY ROSE', true),
  (56, 'ELAINE CRISTINA ALMEIDA DOS SANTOS', 'ELAINE CRISTINA ALMEIDA DOS SANTOS', '282.208.758-01', 1, NULL, NULL, true),
  (10603, 'ELTON NOVAIS DA COSTA', 'ELTON NOVAIS DA COSTA', '038.531.115-05', 1, NULL, NULL, true),
  (64301, 'ERICA CHIANG', 'ERICA CHIANG', '313.481.898-19', 1, NULL, NULL, true),
  (98001, 'EWERTON EDUARDO DE LIMA SILVA', 'EWERTON EDUARDO DE LIMA SILVA', '376.941.048-30', 0, NULL, NULL, true),
  (59, 'FASHION & LIFE SHOP COMERCIO DE PRESENTES LTDA - ME', 'FASHION & LIFE SHOP COMERCIO DE PRESENTES LTDA - ME', '28.280.770/0001-54', 0, 59, NULL, true),
  (60, 'FOUAD (JORGE)', 'FOUD KHALIFE MEHANNA', NULL, 1, NULL, NULL, true),
  (135901, 'GILDÃ DO NASCIMENTO ROCHA', 'GILDÃ DO NASCIMENTO ROCHA', NULL, 0, NULL, NULL, true),
  (8601, 'GUILHERME COUTO DA SILVA', 'GUILHERME COUTO DA SILVA', '481.626.218-06', 0, NULL, NULL, true),
  (99205, 'GUILHERME RIVAS', 'GUILHERME RIVAS', NULL, 0, NULL, NULL, true),
  (188801, 'GUIMARAES E OLIVEIRA CONSULTORIA', 'GUIMARAES E OLIVEIRA CONSULTORIA EMPRESARIAL LTDA', '50.070.295/0001-40', 0, NULL, NULL, true),
  (61, 'IMPORTADORA SUMARE LIMITADA - EPP', 'IMPORTADORA SUMARE LIMITADA - EPP', '10.181.865/0001-55', 0, NULL, NULL, true),
  (116801, 'ISABELA MARQUES', 'ISABELA MARQUES CLAUDIANO', '129.201.826-76', 0, NULL, NULL, true),
  (77501, 'IURI HERRERA MACIEL ARAUJO', 'IURI HERRERA MACIEL ARAUJO', '410.222.508-09', 0, NULL, NULL, true),
  (18, 'IVANI NUNES DOMINGOS', 'IVANI NUNES DOMINGOS', '284.790.298-89', 0, NULL, NULL, true),
  (19, 'JANAINE MARIA DE FREITAS MEDEIROS', 'JANAINE MARIA DE FREITAS MEDEIROS', '379.326.428-92', 0, NULL, NULL, true),
  (10503, 'JANUARIA BATISTA RIBEIRO', 'JANUARIA BATISTA RIBEIRO', '302.356.488-41', 1, NULL, NULL, true),
  (9403, 'JEFERSON HENRIQUE DE OLIVEIRA', 'JEFERSON HENRIQUE DE OLIVEIRA', '401.961.978-64', 0, NULL, NULL, true),
  (8405, 'JOSEANE ESMERA DE LIMA MARTINELI', 'JOSEANE ESMERA DE LIMA MARTINELI', '401.918.748-76', 0, NULL, NULL, true),
  (8505, 'JULIANA CRISTINA MARTINS', 'JULIANA CRISTINA MARTINS', '091.609.406-54', 0, NULL, NULL, true),
  (17201, 'JULIANA FAGUNDES DE MELO', 'JULIANA FAGUNDES DE MELO', '373.895.588-73', 0, NULL, NULL, true),
  (6201, 'KASSIA AZEVEDO SANTOS', 'KASSIA AZEVEDO SANTOS', '461.741.048-18', 0, NULL, NULL, true),
  (119701, 'LARISSA MARTNS PETITO', 'LARISSA MARTNS PETITO', '350.164.278-44', 0, NULL, NULL, true),
  (15105, 'LUCAS MACHADO DE OLIVEIRA COSTA', 'LUCAS MACHADO DE OLIVEIRA COSTA', '423.179.908-39', 0, NULL, NULL, true),
  (32601, 'LUDMILA DA SILVA BATISTA', 'LUDMILA DA SILVA BATISTA', '075.896.615-62', 0, NULL, NULL, true),
  (63301, 'MAICON CORREIA DA SILVA', 'MAICON CORREIA DA SILVA', '398.275.018-01', 0, NULL, NULL, true),
  (124601, 'MARCIA JEANE RAMOS DE ALMEIDA', 'MARCIA JEANE RAMOS DE ALMEIDA', '305.235.188-54', 0, NULL, NULL, true),
  (159401, 'MARCOS ROBERTO 2', 'MARCOS ROBERTO 2', '390.329.348-21', 0, NULL, NULL, true),
  (70, 'MARCOS ROBERTO DEPINTORE SILVA', 'MARCOS ROBERTO DEPINTORE SILVA', '181.328.408-36', 0, NULL, NULL, true),
  (116701, 'MARIANA', 'MARIANA GONÇALVES BATISTA DE ARAUJO', '386.098.528-06', 0, NULL, NULL, true),
  (96301, 'MAYARA ANNE SANTOS CHAGAS', 'MAYARA ANNE SANTOS CHAGAS', '425.425.428-80', 0, NULL, NULL, true),
  (119801, 'MEL GIOVANNA', 'MEL GIOVANNA BATISTA DA SILVA', '518.663.148-58', 0, NULL, NULL, true),
  (40501, 'NABIL YAHIA', 'NABIL YAHIA', '238.399.058-26', 0, NULL, NULL, true),
  (75301, 'NATACHA SOUZA CORREIA', 'NATACHA SOUZA CORREIA', '389.677.628-28', 0, NULL, NULL, true),
  (3805, 'NATHALIE CONSTANTINI', 'NATHALIE CONSTANTINI', '431.075.348-54', 0, NULL, NULL, true),
  (7001, 'ORLANIA FREIRE DA SILVA', 'ORLANIA FREIRE DA SILVA', '083.414.844-71', 0, NULL, NULL, true),
  (7101, 'OTAVIO FARIAS', 'OTAVIO FARIAS', '222.691.588-57', 1, NULL, NULL, true),
  (45801, 'PAULINHO AUGUSTO FUTURA', 'PAULINHO AUGUSTO FUTURA', NULL, 0, NULL, NULL, true),
  (3405, 'PRISCILA MARIANO', 'PRISCILA MARIANO DOS SANTOS', '372.336.808-50', 0, NULL, NULL, true),
  (67, 'RRML REPRESENTACOES LTDA', 'RRML REPRESENTACOES LTDA', '13.326.489/0001-38', 1, NULL, NULL, true),
  (112105, 'RUBENS ARGENTÃO DA SILVA', 'RUBENS ARGENTÃO DA SILVA', '161.441.018-61', 0, NULL, NULL, true),
  (7301, 'RUTY BENTO DE FARIAS', 'RUTY BENTO DE FARIAS', '603.544.553-54', 0, NULL, NULL, true),
  (149001, 'SAMARA GALVAO DA COSTA STRAVATI', 'SAMARA GALVAO DA COSTA STRAVATI', '409.072.398-11', 0, NULL, NULL, true),
  (20, 'SHEILA YOKO FUGIKAWA MARINS', 'SHEILA YOKO FUGIKAWA MARINS', '328.500.418-58', 0, NULL, NULL, true),
  (32701, 'TAINARA SOUZA DA SILVA', 'TAINARA SOUZA DA SILVA', '493.500.398-77', 0, NULL, NULL, true),
  (120901, 'TATIANE APARECIDA', 'TATIANE APARECIDA  DE SOUZA BONFIM', '307.880.908-01', 0, NULL, NULL, true),
  (98201, 'THAINA DA SILVA GRIMAS', 'THAINA DA SILVA GRIMAS', '417.288.028-22', 0, NULL, NULL, true),
  (21, 'THARLING FRANCISCO BORGES', 'THARLING FRANCISCO BORGES', '344.033.148-21', 0, NULL, NULL, true),
  (58, 'THIEVES COMERCIO E REPRESENTACOES LTDA', 'THIEVES COMERCIO E REPRESENTACOES LTDA', '02.768.104/0001-76', 1, NULL, NULL, true),
  (1901, 'VASTI FERREIRA VIDAL', 'VASTI FERREIRA VIDAL', '040.471.943-01', 0, NULL, NULL, true),
  (8305, 'VERENA ALVES', 'VERENA ALVES FERRAZ CORREA', '409.972.208-21', 0, NULL, NULL, true),
  (22, 'YA CHU CHOU', 'YA CHU CHOU', '241.212.388-85', 0, NULL, NULL, true)
ON CONFLICT (futura_id) DO UPDATE SET
  nome              = EXCLUDED.nome,
  razao_social      = EXCLUDED.razao_social,
  cnpj_cpf          = EXCLUDED.cnpj_cpf,
  tipo_vendedor     = EXCLUDED.tipo_vendedor,
  coord_futura_id   = EXCLUDED.coord_futura_id,
  coord_futura_nome = EXCLUDED.coord_futura_nome,
  updated_at        = now();
