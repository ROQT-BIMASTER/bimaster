# Estrutura do Briefing Individual

Cada item que entra no ciclo Huggs recebe um briefing autocontido. O briefing é gerado pelo agente ao final da conversa e entra no sistema de forma independente — sem dependência dos outros briefings da mesma demanda.

**Formato do ID:** `BRF-AAAA-MM-DD-NNN` (ex: BRF-2026-05-20-007)

---

## Cabeçalho Universal

Todos os tipos de demanda compartilham este cabeçalho:

| Campo | Tipo | Origem | Exemplo |
|-------|------|--------|---------|
| `briefing_id` | Auto | Gerado pelo sistema | `BRF-2026-05-20-001` |
| `parent_demand_id` | Auto | Referência à demanda original | `DEM-2026-05-20-01` |
| `item_number` | Auto | Posição na demanda | `3 de 9` |
| `titulo` | Texto | Gerado pelo agente | `Wobbler — Hello Kitty — Ruby Rose` |
| `marca` | Select | Informado na conversa | Ruby Rose / Melu / Union / HForm |
| `linha_colecao` | Texto | Informado na conversa | `Hello Kitty x Ruby Rose` |
| `area_solicitante` | Auto | Perfil do usuário | `Trade Marketing` |
| `solicitante` | Auto | Usuário logado | `Mirella Mota` |
| `data_solicitacao` | Auto | Timestamp | `2026-05-20T14:32:00` |
| `prazo_entrega` | Data | Informado na conversa | `2026-06-20` |
| `prioridade` | Select | Informado ou default | Crítica / Alta / Média / Baixa |
| `demand_type` | Auto | Classificado pelo agente | PDV / Embalagem / Evento / Campanha / Ecommerce / PressKit / Catalogo / Interno |
| `status` | Auto | Calculado na geração | Pronto / Aguardando Faca / Aguardando Medidas / Aguardando KV / Aguardando Regulatório |

### Regras de Status Automático

| Condição | Status gerado |
|----------|---------------|
| Todos os campos obrigatórios preenchidos | `Pronto` |
| Embalagem nova sem faca | `Aguardando Faca` |
| Material de loja sem dimensões | `Aguardando Medidas` |
| PDV/Campanha sem KV anexado | `Aguardando KV` |
| Embalagem com dados regulatórios pendentes | `Aguardando Regulatório` |

---

## Campos Específicos por Tipo

### Material PDV

| Campo | Tipo | Descrição | Obrigatório |
|-------|------|-----------|-------------|
| `material_type` | Select | Wobbler, Stopper, Faixa de Gôndola, Régua de Gôndola, Display de Balcão, Display de Rolo, Clip Strip, Cubo Promocional, Totem, Glorifier, Tag, Plotagem de Loja | Sim |
| `dimensoes` | Texto | Medidas em mm ou cm. Padrão pré-preenchido por tipo; custom se especificado | Sim (padrão se não informado) |
| `qtde_versoes` | Número | Quantidade de versões/modelos. Default: 3 | Sim |
| `kv_referencia` | Arquivo | KV da linha/coleção | Sim |
| `faca_gabarito` | Arquivo | Arquivo de faca ou gabarito | Não |
| `copy_texto` | Texto | Copy/texto aprovado para a peça | Não |
| `cliente_rede` | Texto | Nome da loja ou rede (se material específico para cliente) | Não |
| `produtos_destaque` | Texto | SKUs ou produtos que devem aparecer em destaque | Não |

**Dimensões padrão por tipo (pré-preenchidas):**

| Material | Dimensão padrão |
|----------|----------------|
| Wobbler | 15×10cm |
| Stopper | 20×5cm |
| Faixa de Gôndola | 90×4cm |
| Régua de Gôndola | Varia por tipo de gôndola |
| Display de Balcão | Varia (solicitar ao solicitante) |
| Cubo Promocional | 30×30×30cm |
| Totem | 60×180cm |
| Glorifier | Custom por produto |
| Plotagem de Loja | Custom por espaço |

**Exemplo de briefing PDV gerado:**
```
briefing_id: BRF-2026-05-20-001
parent_demand_id: DEM-2026-05-20-01
item_number: 1 de 9
titulo: Wobbler — Hello Kitty — Ruby Rose
marca: Ruby Rose
linha_colecao: Hello Kitty x Ruby Rose
area_solicitante: Trade Marketing
solicitante: Mirella Mota
prazo_entrega: 2026-06-20
prioridade: Alta
demand_type: PDV
status: Pronto
material_type: Wobbler
dimensoes: 15x10cm (padrão)
qtde_versoes: 3
kv_referencia: [arquivo anexo]
```

---

### Embalagem

| Campo | Tipo | Descrição | Obrigatório |
|-------|------|-----------|-------------|
| `componente` | Select | Cartucho, Etiqueta de Fundo, Etiqueta Bula, Etiqueta Provador/Tester, Display, Mockup, Cartela | Sim |
| `produto_sku` | Texto | Código HB-xxx + nome do produto (ex: `HB-M304 — Base Líquida Daily Skin`) | Sim |
| `tipo_alteracao` | Select | Nova embalagem / Alteração de arte / Novo display / Ajuste regulatório | Sim |
| `faca` | Arquivo | Faca/gabarito do fornecedor | Condicional (obrigatório se Nova) |
| `dados_regulatorios` | Arquivo | Composição, INCI, QR Code | Não |
| `variantes_cor` | Número | Quantidade de variantes de cor/acabamento | Não |
| `arte_anterior` | Arquivo | Arte da versão anterior (referência para alterações) | Não |

**Exemplo de briefing Embalagem:**
```
briefing_id: BRF-2026-05-20-015
parent_demand_id: DEM-2026-05-20-02
item_number: 3 de 21
titulo: Display — Batom Líquido Classic Thing — Blow
marca: Ruby Rose
linha_colecao: Blow
area_solicitante: Produto
solicitante: Luana do Nascimento Bazilio
prazo_entrega: A definir
prioridade: Alta
demand_type: Embalagem
status: Aguardando Faca
componente: Display
produto_sku: HB-L2031 — Batom Líquido Classic Thing
tipo_alteracao: Novo display
faca: [aguardando fornecedor]
variantes_cor: 1
```

---

### Evento

| Campo | Tipo | Descrição | Obrigatório |
|-------|------|-----------|-------------|
| `evento_nome` | Texto | Nome completo do evento | Sim |
| `evento_data` | Data | Data do evento | Sim |
| `brinde_type` | Texto | Tipo do brinde/material (Lenço, Tote Bag, Chaveiro, etc.) | Sim |
| `dimensoes` | Texto | Dimensões do item (quando aplicável) | Não |
| `quantidade` | Número | Quantidade de unidades a produzir | Não |
| `kv_referencia` | Arquivo | KV da marca/evento | Sim |
| `conceito_tema` | Texto | Conceito visual ou tema do evento | Não |
| `specs_producao` | Texto | Especificações de produção (material, acabamento, restrições) | Não |

**Exemplo de briefing Evento:**
```
briefing_id: BRF-2026-05-20-023
parent_demand_id: DEM-2026-05-20-03
item_number: 1 de 10
titulo: Lenço — Beauty Show 2026 — Ruby Rose
marca: Ruby Rose
evento_nome: Beauty Show 2026
evento_data: 2026-08-15
area_solicitante: Marketing
solicitante: Paloma Baram
prazo_entrega: 2026-07-25
prioridade: Alta
demand_type: Evento
status: Pronto
brinde_type: Lenço
dimensoes: A definir
quantidade: 500
kv_referencia: [arquivo anexo]
```

---

### Campanha / KV

| Campo | Tipo | Descrição | Obrigatório |
|-------|------|-----------|-------------|
| `nome_campanha` | Texto | Nome ou tema da campanha | Sim |
| `desdobramento_tipo` | Select | KV Principal, Banner E-commerce, Post Social, Story, Material PDV, Email Marketing, Banner Site, Anúncio Revista/Impressa | Sim |
| `canal` | Select | PDV, E-commerce, Social Media, Evento, Distribuidora, Institucional | Sim |
| `dimensoes` | Texto | Medidas específicas por peça | Não |
| `formato_entrega` | Select | PDF, PNG, AI, PSD | Sim |
| `copy_aprovado` | Texto | Texto aprovado para a peça | Não |
| `produtos_destaque` | Texto | Produtos ou SKUs em destaque | Não |
| `moodboard` | Arquivo | Referência visual / moodboard | Não |

---

### E-commerce

| Campo | Tipo | Descrição | Obrigatório |
|-------|------|-----------|-------------|
| `plataforma` | Select | Site Ruby Rose, Site Melu, Union Marketplace, Amazon, Mercado Livre, Shopee | Sim |
| `tipo_material` | Select | Banner Home, Banner Categoria, Banner Promocional, Imagem de Produto, Listing Marketplace, Email Marketing | Sim |
| `dimensoes` | Texto | Dimensões específicas da plataforma | Sim |
| `promocao_info` | Texto | Descrição da promoção (se aplicável) | Não |
| `copy` | Texto | Copy/texto para o banner ou email | Não |
| `fotos_produtos` | Arquivo | Fotos dos produtos (se necessário) | Não |

---

### Press Kit

| Campo | Tipo | Descrição | Obrigatório |
|-------|------|-----------|-------------|
| `publico` | Select | Imprensa, Influencer, Parceiro B2B, Interno | Sim |
| `componentes` | Checklist | Lista de componentes do kit (Caixa, Rótulo, Card, Brindes, Produtos, Voucher) | Sim |
| `quantidade` | Número | Número de kits a produzir | Sim |

---

### Catálogo / Book

| Campo | Tipo | Descrição | Obrigatório |
|-------|------|-----------|-------------|
| `tipo_catalogo` | Select | Book Trade, Guia de Lançamento, Catálogo de Linha, Apresentação Comercial | Sim |
| `conteudo_secoes` | Texto | Outline do conteúdo por seção | Sim |
| `formato` | Texto | Dimensão e formato físico ou digital | Sim |
| `idioma` | Select | Português, Inglês, Espanhol, Bilíngue | Sim |

---

### Material Interno

| Campo | Tipo | Descrição | Obrigatório |
|-------|------|-----------|-------------|
| `tipo_material` | Select | Flyer/Pôster, Backdrop, Organograma, Decoração, Comunicado | Sim |
| `dimensao` | Texto | Medida física (impressão) ou resolução (digital) | Sim |
| `copy` | Texto | Texto completo do material | Sim |
| `formato_entrega` | Select | PDF para impressão, Digital para TV/painel, Ambos | Sim |

---

## Convenção de Nomenclatura dos Briefings

**Formato:** `[Tipo/Componente] — [Linha/Coleção] — [Marca]`

| Tipo | Exemplo de título |
|------|-------------------|
| PDV | `Wobbler — Hello Kitty — Ruby Rose` |
| PDV loja | `Vitrine 1 — Lilly Perfumaria — Ruby Rose` |
| Embalagem | `Display — Balm Labial Girl's Night — Blow` |
| Evento | `Tote Bag — Beauty Show 2026 — Melu` |
| Campanha | `KV Principal — Copa do Mundo 2026 — Ruby Rose` |
| Campanha | `Banner E-commerce — Copa do Mundo 2026 — Melu` |
| E-commerce | `Banner Home — Dia dos Namorados — Union` |
| Press Kit | `Rótulo Caixa — Pistache — Ruby Rose` |
| Catálogo | `Book Trade — China 2026 — Ruby Rose + Melu` |
| Interno | `Flyer — Dia das Mães — Interno` |
