# Skills do Agente

Cada tipo de demanda corresponde a uma skill que o agente invoca internamente ao identificar a classificação. A skill define o comportamento completo para aquele tipo: perguntas, lógica de decomposição, campos do briefing e estrutura de saída.

---

## Skill: `material_pdv`

**Aciona quando:** demanda classificada como Material PDV  
**Palavras-chave de trigger:** pdv, wobbler, stopper, gôndola, enxoval, plotagem, vitrine, display de balcão, totem, clip strip, cubo promocional, glorifier, tag, régua, faixa de gôndola, loja, rede

### Perguntas (em ordem de coleta)

| # | Pergunta | Campo | Tipo | Obrigatório |
|---|----------|-------|------|-------------|
| 1 | "Para qual **marca e linha** você precisa o material PDV?" | `marca`, `linha` | Select + Texto | Sim |
| 2 | "Quais **peças** você precisa?" + checklist de 12 tipos | `lista_materiais` | Multi-select | Sim |
| 3 | "Quantas **versões/modelos** por peça?" (default: 3) | `qtde_versoes` | Número | Sim |
| 4 | "Anexe o **KV (Key Visual)** da linha." | `kv_referencia` | Arquivo | Sim |
| 5 | "Qual o **prazo de entrega**?" | `prazo` | Data | Sim |
| 6 | "Esse material é para uma **rede ou loja específica**?" | `cliente_rede` | Texto | Não |
| 7 | "Alguma peça tem **dimensão diferente do padrão**?" | `dimensoes` | Texto | Não |
| 8 | "Você tem **faca/gabarito** para alguma das peças?" | `faca_gabarito` | Arquivo | Não |
| 9 | "Tem algum **texto/copy** específico para os materiais?" | `copy_texto` | Texto | Não |

### Lógica de Decomposição

```
SE tipo_demanda = "enxoval":
  eixo = material_type
  itens = catálogo padrão (12 tipos) OU seleção do solicitante
  N = qtde_materiais_selecionados

SE tipo_demanda = "pecas_especificas":
  eixo = material_type × linha
  itens = materiais_listados × linhas_listadas
  N = qtde_materiais × qtde_linhas

SE tipo_demanda = "loja_especifica":
  eixo = espaco_na_loja
  itens = espaços físicos identificados (vitrine, fachada, parede, etc.)
  N = qtde_espacos

SE tipo_demanda = "campanha_pdv":
  eixo = material_type × formato
  itens = materiais × tamanhos
  N = qtde_materiais × qtde_formatos
```

### Estrutura do Briefing de Saída (PDV_item)

```json
{
  "briefing_id": "BRF-AAAA-MM-DD-NNN",
  "parent_demand_id": "DEM-AAAA-MM-DD-NN",
  "item_number": "N de M",
  "titulo": "[Material] — [Linha] — [Marca]",
  "marca": "Ruby Rose | Melu | Union | HForm",
  "linha_colecao": "texto",
  "area_solicitante": "auto",
  "solicitante": "auto",
  "data_solicitacao": "auto",
  "prazo_entrega": "data",
  "prioridade": "Crítica | Alta | Média | Baixa",
  "demand_type": "PDV",
  "status": "Pronto | Aguardando KV | Aguardando Medidas | Aguardando Faca",
  "material_type": "Wobbler | Stopper | ...",
  "dimensoes": "padrão ou custom",
  "qtde_versoes": 3,
  "kv_referencia": "arquivo",
  "faca_gabarito": "arquivo ou null",
  "copy_texto": "texto ou null",
  "cliente_rede": "texto ou null",
  "produtos_destaque": "texto ou null"
}
```

### Dimensões Padrão por Material (pré-preenchidas)

| Material | Dimensão padrão |
|----------|----------------|
| Wobbler | 15×10cm |
| Stopper | 20×5cm |
| Faixa de Gôndola | 90×4cm |
| Cubo Promocional | 30×30×30cm |
| Totem | 60×180cm |
| Glorifier | Custom (solicitar) |
| Plotagem de Loja | Custom (solicitar) |

---

## Skill: `embalagem`

**Aciona quando:** demanda classificada como Embalagem  
**Palavras-chave de trigger:** embalagem, cartucho, etiqueta, bula, display de produto, mockup, faca, cartela, packaging, alteração de cartucho

### Perguntas (em ordem de coleta)

| # | Pergunta | Campo | Tipo | Obrigatório |
|---|----------|-------|------|-------------|
| 1 | "Qual a **marca e linha**?" | `marca`, `linha` | Select + Texto | Sim |
| 2 | "É embalagem **nova ou alteração**?" | `tipo_alteracao` | Select (4 opções) | Sim |
| 3 | "Quais **componentes**?" + checklist | `componentes` | Multi-select | Sim |
| 4 | "Liste os **produtos/SKUs** (código HB-xxx + nome)" | `lista_skus` | Texto | Sim |
| 5 | "Você tem a **faca/gabarito** do fornecedor?" *(obrigatório se Nova)* | `faca` | Arquivo | Condicional |
| 6 | "Os **dados regulatórios** já estão aprovados?" | `dados_regulatorios` | Select (3 opções) | Sim |
| 7 | "Qual o **prazo**?" | `prazo` | Data | Sim |

### Lógica de Decomposição

```
Identifica sub-padrão a partir da combinação:

SE lista_skus contém múltiplos E componentes = [1 tipo]:
  → Decomposição por SKU
  eixo = produto_sku
  N = quantidade de SKUs listados
  Exemplo: 21 displays Blow = 21 briefings

SE lista_skus = [1 produto] E componentes = [múltiplos]:
  → Decomposição por componente
  eixo = componente_type
  N = quantidade de componentes selecionados
  Exemplo: HB-M304 completo = 4 briefings (Cartucho + Et.Fundo + Et.Bula + Display)

SE lista_skus contém múltiplos E componentes = [múltiplos]:
  → Decomposição dupla (perguntar ao solicitante)
  Opção A: N_skus × N_componentes briefings
  Opção B: N_skus briefings (cada um contém lista de componentes)
  Apresentar ao solicitante para decidir

SE solicitante menciona "linha inteira":
  → Perguntar lista completa de SKUs da linha
  eixo = produto_sku
  N = qtde_skus_da_linha (geralmente 6–21)
```

### Estrutura do Briefing de Saída (Embalagem_item)

```json
{
  "briefing_id": "BRF-AAAA-MM-DD-NNN",
  "parent_demand_id": "DEM-AAAA-MM-DD-NN",
  "item_number": "N de M",
  "titulo": "[Componente] — [Produto] — [Linha]",
  "marca": "Ruby Rose | Melu | Union | HForm",
  "linha_colecao": "texto",
  "area_solicitante": "auto",
  "solicitante": "auto",
  "prazo_entrega": "data",
  "prioridade": "select",
  "demand_type": "Embalagem",
  "status": "Pronto | Aguardando Faca | Aguardando Regulatório",
  "componente": "Cartucho | Etiqueta de Fundo | Etiqueta Bula | Etiqueta Provador | Display | Mockup | Cartela",
  "produto_sku": "HB-xxx — Nome do Produto",
  "tipo_alteracao": "Nova | Alteração | Novo display | Ajuste regulatório",
  "faca": "arquivo ou Aguardando Fornecedor",
  "dados_regulatorios": "arquivo ou Aguardando | Não se aplica",
  "variantes_cor": "número ou null",
  "arte_anterior": "arquivo ou null"
}
```

---

## Skill: `evento`

**Aciona quando:** demanda classificada como Evento  
**Palavras-chave de trigger:** evento, beauty show, beauty fair, feira, stand, brindes, ativação

### Perguntas (em ordem de coleta)

| # | Pergunta | Campo | Tipo | Obrigatório |
|---|----------|-------|------|-------------|
| 1 | "Qual o **nome e a data** do evento?" | `evento_nome`, `evento_data` | Texto + Data | Sim |
| 2 | "Qual(is) **marca(s)** participam?" | `marcas` | Multi-select | Sim |
| 3 | "Quais **materiais/brindes** você precisa?" + checklist 16 itens | `lista_brindes` | Checklist | Sim |
| 4 | "Tem **ativações especiais** planejadas?" | `ativacoes` | Texto | Não |
| 5 | "Você tem a **planta/layout** do stand?" | `planta_stand` | Arquivo | Não |
| 6 | "Algum item tem **dimensão específica**?" | `dimensoes` | Texto | Não |
| 7 | "Qual o **prazo para envio** à produção?" | `prazo_producao` | Data | Sim |

### Lógica de Decomposição

```
SE marcas = [1 marca]:
  eixo = brinde_item
  N = qtde_brindes_listados + qtde_ativacoes

SE marcas = [múltiplas]:
  eixo = brinde × marca
  Para cada marca → gera set próprio de briefings
  N = soma de briefings por marca
  Exemplo: Beauty Show = RR (10) + Melu (9) + Ativações (4) = 23 briefings

  Apresentar ao solicitante:
  "Vou criar grupos separados por marca:
   - Ruby Rose: [lista brindes RR]
   - Melu: [lista brindes Melu]
   Total: [N] briefings. Confirma?"
```

### Estrutura do Briefing de Saída (Evento_item)

```json
{
  "briefing_id": "BRF-AAAA-MM-DD-NNN",
  "parent_demand_id": "DEM-AAAA-MM-DD-NN",
  "item_number": "N de M",
  "titulo": "[Brinde] — [Evento] — [Marca]",
  "marca": "select",
  "area_solicitante": "auto",
  "solicitante": "auto",
  "prazo_entrega": "data",
  "prioridade": "select",
  "demand_type": "Evento",
  "status": "Pronto | Aguardando Medidas | Aguardando KV",
  "evento_nome": "texto",
  "evento_data": "data",
  "brinde_type": "Lenço | Tote Bag | Chaveiro | ...",
  "dimensoes": "texto ou null",
  "quantidade": "número ou null",
  "kv_referencia": "arquivo",
  "conceito_tema": "texto ou null",
  "specs_producao": "texto ou null"
}
```

---

## Skill: `campanha_kv`

**Aciona quando:** demanda classificada como Campanha/KV  
**Palavras-chave de trigger:** campanha, kv, key visual, lançamento, copa, dia das mães, dia dos namorados, natal, black friday

### Perguntas (em ordem de coleta)

| # | Pergunta | Campo | Tipo | Obrigatório |
|---|----------|-------|------|-------------|
| 1 | "Qual o **nome/tema** da campanha?" | `nome_campanha` | Texto | Sim |
| 2 | "Qual(is) **marca(s)**?" | `marcas` | Multi-select | Sim |
| 3 | "Qual o **objetivo** da campanha?" | `objetivo` | Texto | Sim |
| 4 | "Em quais **canais** vai rodar?" | `canais` | Multi-select | Sim |
| 5 | "Quais **desdobramentos** você precisa?" | `desdobramentos` | Multi-select | Sim |
| 6 | "Qual o **período** e o **prazo do KV principal**?" | `periodo`, `prazo` | Data range + Data | Sim |
| 7 | "Tem **texto/copy aprovado**?" | `copy` | Texto | Não |
| 8 | "Tem **medidas específicas**?" | `medidas` | Texto | Não |

### Lógica de Decomposição

```
eixo = desdobramento × canal × marca

SE marcas = [1] E desdobramentos = [N]:
  N briefings (1 por desdobramento)

SE marcas = [múltiplas] E desdobramentos = [N]:
  N × qtde_marcas briefings
  Exemplo: Copa 2026, RR + Melu, 4 desdobramentos = 8 briefings

Cada briefing contém:
- Um único desdobramento (KV Principal, Banner, Post, Story...)
- Um único canal (PDV, E-commerce, Social...)
- Uma única marca
```

### Estrutura do Briefing de Saída (Campanha_item)

```json
{
  "briefing_id": "BRF-AAAA-MM-DD-NNN",
  "parent_demand_id": "DEM-AAAA-MM-DD-NN",
  "item_number": "N de M",
  "titulo": "[Desdobramento] — [Campanha] — [Marca]",
  "marca": "select",
  "area_solicitante": "auto",
  "solicitante": "auto",
  "prazo_entrega": "data",
  "prioridade": "select",
  "demand_type": "Campanha",
  "status": "Pronto | Aguardando KV | Aguardando Copy",
  "nome_campanha": "texto",
  "desdobramento_tipo": "KV Principal | Banner E-commerce | Post Social | Story | Material PDV | Email Marketing | Banner Site | Anúncio",
  "canal": "PDV | E-commerce | Social Media | Evento | Distribuidora | Institucional",
  "dimensoes": "texto ou null",
  "formato_entrega": "PDF | PNG | AI | PSD",
  "copy_aprovado": "texto ou null",
  "produtos_destaque": "texto ou null",
  "moodboard": "arquivo ou null"
}
```

---

## Skill: `ecommerce`

**Aciona quando:** demanda classificada como E-commerce  
**Palavras-chave de trigger:** ecommerce, marketplace, union, site ruby rose, site melu, banner site, email marketing, shopee, mercado livre, amazon, listing

### Perguntas (em ordem de coleta)

| # | Pergunta | Campo | Tipo | Obrigatório |
|---|----------|-------|------|-------------|
| 1 | "Para qual(is) **plataforma(s)**?" | `plataformas` | Multi-select | Sim |
| 2 | "Que tipo de **material**?" | `tipo_material` | Multi-select | Sim |
| 3 | "Qual a **marca**?" | `marca` | Select | Sim |
| 4 | "É para alguma **promoção ou data comercial**?" | `promocao` | Texto | Não |
| 5 | "Quais as **dimensões** por plataforma?" | `dimensoes` | Texto | Sim |
| 6 | "Qual o **prazo de publicação**?" | `prazo` | Data | Sim |

### Lógica de Decomposição

```
eixo = marca × plataforma

N = qtde_marcas × qtde_plataformas

Exemplo: Union Maio 2026, 3 marcas (Union, RR, Melu), 1 plataforma
  → 3 briefings
  
Exemplo: E-commerce geral, 2 marcas (RR, Melu), 3 plataformas (Site, Amazon, ML)
  → 6 briefings (caso tipos de material sejam os mesmos por plataforma)
```

### Estrutura do Briefing de Saída (Ecommerce_item)

```json
{
  "briefing_id": "BRF-AAAA-MM-DD-NNN",
  "parent_demand_id": "DEM-AAAA-MM-DD-NN",
  "item_number": "N de M",
  "titulo": "[Tipo Material] — [Campanha/Data] — [Marca] — [Plataforma]",
  "marca": "select",
  "area_solicitante": "auto",
  "solicitante": "auto",
  "prazo_entrega": "data",
  "prioridade": "select",
  "demand_type": "Ecommerce",
  "status": "Pronto | Aguardando Dimensões | Aguardando Copy",
  "plataforma": "Site Ruby Rose | Site Melu | Union Marketplace | Amazon | Mercado Livre | Shopee",
  "tipo_material": "Banner Home | Banner Categoria | Banner Promocional | Imagem de Produto | Listing | Email Marketing",
  "dimensoes": "texto",
  "promocao_info": "texto ou null",
  "copy": "texto ou null",
  "fotos_produtos": "arquivo ou null"
}
```

---

## Skill: `press_kit`

**Aciona quando:** demanda classificada como Press Kit  
**Palavras-chave de trigger:** press kit, presskit, kit influencer, kit imprensa, kit de mídia

### Perguntas (em ordem de coleta)

| # | Pergunta | Campo | Tipo | Obrigatório |
|---|----------|-------|------|-------------|
| 1 | "Qual a **marca e linha** em destaque?" | `marca`, `linha` | Select + Texto | Sim |
| 2 | "Para qual **público**?" | `publico` | Select | Sim |
| 3 | "Quais **componentes** do kit?" | `componentes` | Checklist | Sim |
| 4 | "Quantos **kits** serão produzidos?" | `quantidade` | Número | Sim |
| 5 | "Qual o **prazo**?" | `prazo` | Data | Sim |

### Lógica de Decomposição

```
Geralmente: N = qtde_componentes_do_kit

Componentes típicos (de dados reais):
- Caixa externa (design)
- Rótulo da caixa
- Card de identidade
- Brindes (cada brinde = 1 briefing)
- Voucher / encarte

Referência: "RÓTULO PRESSKIT PISTACHE" — 1 briefing por componente com design único
```

### Estrutura do Briefing de Saída (PressKit_item)

```json
{
  "briefing_id": "BRF-AAAA-MM-DD-NNN",
  "parent_demand_id": "DEM-AAAA-MM-DD-NN",
  "item_number": "N de M",
  "titulo": "[Componente] — [Linha] — [Marca]",
  "marca": "select",
  "linha_colecao": "texto",
  "area_solicitante": "auto",
  "solicitante": "auto",
  "prazo_entrega": "data",
  "prioridade": "select",
  "demand_type": "PressKit",
  "status": "Pronto",
  "publico": "Imprensa | Influencer | Parceiro B2B | Interno",
  "componentes": ["lista de componentes"],
  "quantidade": "número"
}
```

---

## Skill: `catalogo_book`

**Aciona quando:** demanda classificada como Catálogo/Book  
**Palavras-chave de trigger:** catálogo, book trade, guia, guia de lançamento, apresentação comercial, book china

### Perguntas (em ordem de coleta)

| # | Pergunta | Campo | Tipo | Obrigatório |
|---|----------|-------|------|-------------|
| 1 | "Que **tipo** de material?" | `tipo` | Select | Sim |
| 2 | "Qual(is) **marca(s)**?" | `marcas` | Multi-select | Sim |
| 3 | "Qual o **conteúdo por seção**? (liste seções e o que vai em cada uma)" | `conteudo_secoes` | Texto | Sim |
| 4 | "Qual o **formato e dimensão**?" | `formato` | Texto | Sim |
| 5 | "Qual o **idioma**?" | `idioma` | Select | Sim |
| 6 | "Qual o **prazo**?" | `prazo` | Data | Sim |

### Lógica de Decomposição

```
Geralmente 1 briefing (documento único).

Exceções que geram múltiplos briefings:
- SE marcas = [múltiplas] E cada marca tem seção distinta:
  → 1 briefing por marca
  Exemplo: Book Trade China = RR + Melu = 2 briefings

- SE idiomas = [múltiplos]:
  → 1 briefing por idioma
  Exemplo: Catálogo PT + EN = 2 briefings

Referência: BOOK TRADE CHINA gerou 2 subtarefas (RR + Melu)
```

### Estrutura do Briefing de Saída (Catalogo_item)

```json
{
  "briefing_id": "BRF-AAAA-MM-DD-NNN",
  "parent_demand_id": "DEM-AAAA-MM-DD-NN",
  "item_number": "N de M",
  "titulo": "[Tipo] — [Marcas] — [Idioma]",
  "marca": "select",
  "area_solicitante": "auto",
  "solicitante": "auto",
  "prazo_entrega": "data",
  "prioridade": "select",
  "demand_type": "Catalogo",
  "status": "Pronto | Aguardando Conteúdo",
  "tipo_catalogo": "Book Trade | Guia de Lançamento | Catálogo de Linha | Apresentação Comercial",
  "conteudo_secoes": "outline detalhado",
  "formato": "texto (dimensão e mídia)",
  "idioma": "Português | Inglês | Espanhol | Bilíngue"
}
```

---

## Skill: `material_interno`

**Aciona quando:** demanda classificada como Material Interno  
**Palavras-chave de trigger:** interno, endomarketing, escritório, comunicado, organograma, decoração, arte elevador, flyer interno

### Perguntas (em ordem de coleta)

| # | Pergunta | Campo | Tipo | Obrigatório |
|---|----------|-------|------|-------------|
| 1 | "Que **tipo** de material?" | `tipo` | Select | Sim |
| 2 | "Qual a **dimensão/formato**?" | `dimensao` | Texto | Sim |
| 3 | "Qual o **texto/copy** que deve aparecer?" | `copy` | Texto | Sim |
| 4 | "Qual o **formato de entrega**?" | `formato_entrega` | Select | Sim |
| 5 | "Qual o **prazo**?" | `prazo` | Data | Sim |

### Lógica de Decomposição

```
Geralmente 1 briefing.

Exceção: múltiplos espaços físicos (ex: arte para elevador + sala de reunião)
  → 1 briefing por espaço físico, cada um com dimensões únicas

Referência real: "ARTE ELEVADOR E SALA DE REUNIÃO" — 2 briefings separados
  (cada espaço tem dimensão diferente e status próprio "Aguardando Medidas")
```

### Estrutura do Briefing de Saída (Interno_item)

```json
{
  "briefing_id": "BRF-AAAA-MM-DD-NNN",
  "parent_demand_id": "DEM-AAAA-MM-DD-NN",
  "item_number": "N de M",
  "titulo": "[Tipo] — [Descrição] — Interno",
  "area_solicitante": "auto",
  "solicitante": "auto",
  "prazo_entrega": "data",
  "prioridade": "select",
  "demand_type": "Interno",
  "status": "Pronto | Aguardando Medidas | Aguardando Copy",
  "tipo_material": "Flyer/Pôster | Backdrop | Organograma | Decoração | Comunicado",
  "dimensao": "texto",
  "copy": "texto completo do material",
  "formato_entrega": "PDF para impressão | Digital TV/painel | Ambos"
}
```

---

## Tabela de Referência Rápida das Skills

| Skill | N típico | Campo crítico | Bloqueador mais comum |
|-------|----------|---------------|-----------------------|
| `material_pdv` | 8–12 | `kv_referencia` | KV não anexado |
| `embalagem` | 4–21 | `faca` | Faca aguardando fornecedor |
| `evento` | 8–30 | `lista_brindes` | Dimensões não informadas |
| `campanha_kv` | 4–10 | `desdobramentos` | Copy não aprovado |
| `ecommerce` | 3–6 | `dimensoes` | Specs da plataforma desconhecidas |
| `press_kit` | 2–5 | `componentes` | Definição do kit incompleta |
| `catalogo_book` | 1–3 | `conteudo_secoes` | Outline não estruturado |
| `material_interno` | 1–2 | `copy` | Texto não redigido / medidas físicas ausentes |
