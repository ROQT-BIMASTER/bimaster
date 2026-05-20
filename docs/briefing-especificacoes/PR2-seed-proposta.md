# PR2 — Proposta de Seed (Briefings v2)

Proposta revisável em YAML do conteúdo a ser inserido em `briefing_catalogos_padrao`,
`briefing_templates`, `briefing_defaults` e `briefing_campos_obrigatorios`.

**Sem SQL nesta rodada.** Após aprovação deste documento, adiciono ao mesmo PR a
migration descrita nos pré-requisitos abaixo.

Fontes — extração literal das specs canônicas em `docs/briefing-especificacoes/`.
Quando uma célula é ambígua na spec, marco como `(ambíguo — confirmar)`.

---

## Pré-requisitos de schema (vão na migration do passo 7, não agora)

Cenário A confirmado contra o schema atual: `briefing_catalogos_padrao.empresa_id`,
`briefing_defaults.empresa_id` e `briefing_campos_obrigatorios.empresa_id` são
`integer NOT NULL`. Como a decisão é semear com `empresa_id = NULL` (catálogo global),
a migration final terá 3 partes nesta ordem:

1. **ALTER** — drop `NOT NULL` em `empresa_id` nas 3 tabelas. **FK contra `empresas(id)`
   é mantida** (FK com coluna nullable ignora a referência quando é NULL, integridade
   preservada pros casos com `empresa_id` preenchido).

   ```sql
   ALTER TABLE briefing_catalogos_padrao     ALTER COLUMN empresa_id DROP NOT NULL;
   ALTER TABLE briefing_defaults             ALTER COLUMN empresa_id DROP NOT NULL;
   ALTER TABLE briefing_campos_obrigatorios  ALTER COLUMN empresa_id DROP NOT NULL;
   ```

2. **CREATE OR REPLACE `rpc_lookup_catalogo` v2** — fallback de 3 níveis
   (atualmente só faz 2 níveis dentro da mesma empresa):

   ```
   1. empresa+marca   (override mais específico)
   2. empresa+NULL    (padrão da empresa)
   3. NULL+NULL       (global)
   ```

   Nível "NULL+marca" intencionalmente omitido (não há caso de catálogo de marca
   cross-empresa hoje; pode ser adicionado depois como mudança non-breaking).

3. **INSERTs** do seed (conteúdo deste documento) com `empresa_id = NULL`.

**Rollback documentado**: `DELETE` dos seeds NULL → `CREATE OR REPLACE` do RPC na
versão anterior → `ALTER ... SET NOT NULL` nas 3 colunas (seguro porque os únicos
NULLs vieram do seed que acabou de ser apagado).

---

## Convenção de path jsonb (já documentada via COMMENT no PR1)

- Nested via ponto: `dimensoes.largura`
- Arrays via índice numérico: `lista_skus.0.codigo`

---

# 1. Catálogos — `briefing_catalogos_padrao`

8 blocos, todos `empresa_id: null` e `marca: null` (catálogo global).
Itens marcados `inferido_de_pergunta: true` quando a lista veio de uma pergunta da
spec 02 (não de catálogo declarado explicitamente).

**`tipo_uso`** (por catálogo, não por item):
- `canonical` — lista finita e técnica. PR3: agente sugere essa lista quando solicitante não sabe; PR4: validação aceita só valores do catálogo.
- `ui_suggestion` — tipos amplos com variação aceitável. PR3/PR4: aceita texto livre, catálogo serve só como autocomplete.

**Escopo da `chave`**: identificador composto por `(empresa_id, marca, tipo, chave)`.
Chaves repetidas entre tipos diferentes (ex.: `totem` em PDV e em Evento; `email_marketing`
em Campanha e em E-commerce; `backdrop` em Evento e em Material Interno) **não são colisão**
e PR3/PR4 nunca devem tratar `chave` como identificador global.

## 1.1 PDV

```yaml
tipo: pdv
empresa_id: null
marca: null
tipo_uso: canonical
fonte_spec: docs/briefing-especificacoes/01-fluxo-de-conversa.md#catálogo-padrão-de-materiais-pdv
itens:
  - { chave: wobbler,             nome: "Wobbler",                     dimensoes_padrao: "15x10cm" }
  - { chave: stopper,             nome: "Stopper",                     dimensoes_padrao: "20x5cm" }
  - { chave: faixa_gondola,       nome: "Faixa de Gôndola Personalizada", dimensoes_padrao: "90x4cm" }
  - { chave: regua_gondola,       nome: "Régua de Gôndola Personalizada", dimensoes_padrao: null }   # spec 03 declara "Varia / Custom" — sempre perguntar (ratificado no review)
  - { chave: display_balcao,      nome: "Display de Balcão",           dimensoes_padrao: null }      # spec 03 declara "Varia / solicitar" — sempre perguntar (ratificado no review)
  - { chave: display_rolo,        nome: "Display de Rolo",             dimensoes_padrao: null }      # ausente da tabela de padrões — sempre perguntar (ratificado no review)
  - { chave: clip_strip,          nome: "Clip Strip",                  dimensoes_padrao: null }      # ausente da tabela de padrões — sempre perguntar (ratificado no review)
  - { chave: cubo_promocional,    nome: "Cubo Promocional",            dimensoes_padrao: "30x30x30cm" }
  - { chave: totem,               nome: "Totem",                       dimensoes_padrao: "60x180cm" }
  - { chave: glorifier,           nome: "Glorifier",                   dimensoes_padrao: null }      # spec 03 declara "Custom por produto" — sempre perguntar (ratificado no review)
  - { chave: tag,                 nome: "Tag",                         dimensoes_padrao: null }      # ausente da tabela de padrões — sempre perguntar (ratificado no review)
  - { chave: plotagem_loja,       nome: "Plotagem de Loja",            dimensoes_padrao: null }      # spec 03 declara "Custom por espaço" — sempre perguntar (ratificado no review)
```

## 1.2 Evento

```yaml
tipo: evento
empresa_id: null
marca: null
fonte_spec: docs/briefing-especificacoes/01-fluxo-de-conversa.md#catálogo-padrão-de-brindes-para-evento
itens:
  - { chave: lenco,                  nome: "Lenço" }
  - { chave: tote_bag,               nome: "Tote Bag" }
  - { chave: chaveiro,               nome: "Chaveiro" }
  - { chave: cordao_cracha,          nome: "Cordão Crachá" }
  - { chave: card_cracha,            nome: "Card Crachá" }
  - { chave: adesivo,                nome: "Adesivo" }
  - { chave: camiseta_uniforme,      nome: "Camiseta / Uniforme" }
  - { chave: almofada,               nome: "Almofada" }
  - { chave: leque,                  nome: "Leque" }
  - { chave: pulseira,               nome: "Pulseira" }
  - { chave: bolsa,                  nome: "Bolsa" }
  - { chave: ticket,                 nome: "Ticket" }
  - { chave: caixinha_brinde,        nome: "Caixinha Brinde" }
  - { chave: backdrop,               nome: "Backdrop / Parede de Fundo" }
  - { chave: totem,                  nome: "Totem" }
  - { chave: arte_ativacao,          nome: "Arte de Ativação" }
```

## 1.3 Embalagem

```yaml
tipo: embalagem
empresa_id: null
marca: null
fonte_spec: docs/briefing-especificacoes/02-perguntas-por-tipo.md#2-embalagem  # §2 P3
inferido_de_pergunta: true
itens:
  - { chave: cartucho,                 nome: "Cartucho" }
  - { chave: etiqueta_fundo,           nome: "Etiqueta de Fundo" }
  - { chave: etiqueta_bula,            nome: "Etiqueta Bula" }
  - { chave: etiqueta_provador,        nome: "Etiqueta Provador / Tester" }
  - { chave: display,                  nome: "Display" }
  - { chave: mockup,                   nome: "Mockup" }
  - { chave: cartela,                  nome: "Cartela" }
```

## 1.4 Campanha

```yaml
tipo: campanha
empresa_id: null
marca: null
fonte_spec: docs/briefing-especificacoes/02-perguntas-por-tipo.md#4-campanha--kv  # §4 P5
inferido_de_pergunta: true
itens:
  - { chave: kv_principal,          nome: "KV Principal" }
  - { chave: banner_ecommerce,      nome: "Banner E-commerce" }
  - { chave: post_social,           nome: "Post Social" }
  - { chave: story,                 nome: "Story" }
  - { chave: material_pdv,          nome: "Material PDV" }
  - { chave: email_marketing,       nome: "Email Marketing" }
  - { chave: banner_site,           nome: "Banner Site" }
  - { chave: anuncio_revista,       nome: "Anúncio Revista / Impressa" }
```

## 1.5 E-commerce

```yaml
tipo: ecommerce
empresa_id: null
marca: null
fonte_spec: docs/briefing-especificacoes/02-perguntas-por-tipo.md#5-e-commerce  # §5 P2
inferido_de_pergunta: true
itens:
  - { chave: banner_home,           nome: "Banner Home" }
  - { chave: banner_categoria,      nome: "Banner Categoria" }
  - { chave: banner_promocional,    nome: "Banner Promocional" }
  - { chave: imagem_produto,        nome: "Imagem de Produto" }
  - { chave: listing_marketplace,   nome: "Listing Marketplace" }
  - { chave: email_marketing,       nome: "Email Marketing" }
```

## 1.6 Press Kit

```yaml
tipo: presskit
empresa_id: null
marca: null
fonte_spec: docs/briefing-especificacoes/02-perguntas-por-tipo.md#6-press-kit  # §6 P3
inferido_de_pergunta: true
itens:
  - { chave: caixa,                 nome: "Caixa" }
  - { chave: rotulo,                nome: "Rótulo" }
  - { chave: card,                  nome: "Card" }
  - { chave: brindes,               nome: "Brindes" }
  - { chave: produtos,              nome: "Produtos" }
  - { chave: voucher,               nome: "Voucher" }
```

## 1.7 Catálogo / Book

```yaml
tipo: catalogo
empresa_id: null
marca: null
fonte_spec: docs/briefing-especificacoes/02-perguntas-por-tipo.md#7-catálogo--book  # §7 P1
inferido_de_pergunta: true
itens:
  - { chave: book_trade,             nome: "Book Trade" }
  - { chave: guia_lancamento,        nome: "Guia de Lançamento" }
  - { chave: catalogo_linha,         nome: "Catálogo de Linha" }
  - { chave: apresentacao_comercial, nome: "Apresentação Comercial" }
```

## 1.8 Material Interno

```yaml
tipo: material_interno
empresa_id: null
marca: null
fonte_spec: docs/briefing-especificacoes/02-perguntas-por-tipo.md#8-material-interno  # §8 P1
inferido_de_pergunta: true
itens:
  - { chave: flyer_poster,          nome: "Flyer / Pôster" }
  - { chave: backdrop,              nome: "Backdrop" }
  - { chave: organograma,           nome: "Organograma" }
  - { chave: decoracao,             nome: "Decoração" }
  - { chave: comunicado,            nome: "Comunicado" }
```

---

# 2. Templates — `briefing_templates`

8 blocos. Todos compartilham os mesmos `campos_universais` (cabeçalho universal da
spec 03). `campos_especificos` extraídos de cada seção tipo-específica da spec 03.

## 2.0 Cabeçalho universal (aplica nos 8 templates)

```yaml
campos_universais:
  - { nome: briefing_id,        tipo_dado: text,   obrigatorio: true,  origem: auto }   # BRF-AAAA-MM-DD-NNN
  - { nome: parent_demand_id,   tipo_dado: text,   obrigatorio: true,  origem: auto }   # FK intake_demandas
  - { nome: item_number,        tipo_dado: number, obrigatorio: true,  origem: auto }
  - { nome: titulo,             tipo_dado: text,   obrigatorio: true,  origem: agente }
  - { nome: marca,              tipo_dado: select, obrigatorio: true,  valores: [Ruby Rose, Melu, Union, HForm] }
  - { nome: linha_colecao,      tipo_dado: text,   obrigatorio: true }
  - { nome: area_solicitante,   tipo_dado: text,   obrigatorio: true,  origem: auto }
  - { nome: solicitante,        tipo_dado: text,   obrigatorio: true,  origem: auto }
  - { nome: data_solicitacao,   tipo_dado: timestamp, obrigatorio: true, origem: auto }
  - { nome: prazo_entrega,      tipo_dado: date,   obrigatorio: true }
  - { nome: prioridade,         tipo_dado: select, obrigatorio: true,  valores: [Crítica, Alta, Média, Baixa], default: "Média" }
  - { nome: demand_type,        tipo_dado: select, obrigatorio: true,  valores: [pdv, embalagem, evento, campanha, ecommerce, presskit, catalogo, material_interno], origem: auto }
  - { nome: status,             tipo_dado: select, obrigatorio: true,  valores: [Pronto, Aguardando Faca, Aguardando Medidas, Aguardando KV, Aguardando Regulatório], origem: derivado_calc_briefing_status }
```

## 2.1 PDV

```yaml
tipo: pdv
fonte_spec: docs/briefing-especificacoes/03-estrutura-briefing.md#material-pdv
campos_especificos:
  - nome: material_type
    tipo_dado: select
    obrigatorio: true
    valores: [wobbler, stopper, faixa_gondola, regua_gondola, display_balcao, display_rolo, clip_strip, cubo_promocional, totem, glorifier, tag, plotagem_loja]
  - { nome: dimensoes,         tipo_dado: text,   obrigatorio: true,  observacao: "padrão pré-preenchido por material_type via briefing_defaults" }
  - { nome: qtde_versoes,      tipo_dado: number, obrigatorio: true,  default: 3 }
  - { nome: kv_referencia,     tipo_dado: file,   obrigatorio: true }
  - { nome: faca_gabarito,     tipo_dado: file,   obrigatorio: false }
  - { nome: copy_texto,        tipo_dado: text,   obrigatorio: false }
  - { nome: cliente_rede,      tipo_dado: text,   obrigatorio: false }
  - { nome: produtos_destaque, tipo_dado: text,   obrigatorio: false }
```

## 2.2 Embalagem

```yaml
tipo: embalagem
fonte_spec: docs/briefing-especificacoes/03-estrutura-briefing.md#embalagem
campos_especificos:
  - nome: componente
    tipo_dado: select
    obrigatorio: true
    valores: [cartucho, etiqueta_fundo, etiqueta_bula, etiqueta_provador, display, mockup, cartela]
  - { nome: produto_sku,         tipo_dado: text,   obrigatorio: true,  observacao: "formato HB-xxx + nome; validação regex fica para PR futuro" }
  - nome: tipo_alteracao
    tipo_dado: select
    obrigatorio: true
    valores: [nova_embalagem, alteracao_arte, novo_display, ajuste_regulatorio]
  - { nome: faca,                tipo_dado: file,   obrigatorio: condicional, condicao: "obrigatório se tipo_alteracao = nova_embalagem" }
  - { nome: dados_regulatorios,  tipo_dado: file,   obrigatorio: false }
  - { nome: variantes_cor,       tipo_dado: number, obrigatorio: false }
  - { nome: arte_anterior,       tipo_dado: file,   obrigatorio: false }
```

## 2.3 Evento

```yaml
tipo: evento
fonte_spec: docs/briefing-especificacoes/03-estrutura-briefing.md#evento
campos_especificos:
  - { nome: evento_nome,    tipo_dado: text,   obrigatorio: true }
  - { nome: evento_data,    tipo_dado: date,   obrigatorio: true }
  - { nome: brinde_type,    tipo_dado: text,   obrigatorio: true,  observacao: "valor de briefing_catalogos_padrao tipo=evento" }
  - { nome: dimensoes,      tipo_dado: text,   obrigatorio: false }
  - { nome: quantidade,     tipo_dado: number, obrigatorio: false }
  - { nome: kv_referencia,  tipo_dado: file,   obrigatorio: true }
  - { nome: conceito_tema,  tipo_dado: text,   obrigatorio: false }
  - { nome: specs_producao, tipo_dado: text,   obrigatorio: false }
```

## 2.4 Campanha

```yaml
tipo: campanha
fonte_spec: docs/briefing-especificacoes/03-estrutura-briefing.md#campanha--kv
campos_especificos:
  - { nome: nome_campanha,      tipo_dado: text,   obrigatorio: true }
  - nome: desdobramento_tipo
    tipo_dado: select
    obrigatorio: true
    valores: [kv_principal, banner_ecommerce, post_social, story, material_pdv, email_marketing, banner_site, anuncio_revista]
  - nome: canal
    tipo_dado: select
    obrigatorio: true
    valores: [pdv, ecommerce, social_media, evento, distribuidora, institucional]
  - { nome: dimensoes,          tipo_dado: text,   obrigatorio: false }
  - nome: formato_entrega
    tipo_dado: select
    obrigatorio: true
    valores: [PDF, PNG, AI, PSD]
  - { nome: copy_aprovado,      tipo_dado: text,   obrigatorio: false }
  - { nome: produtos_destaque,  tipo_dado: text,   obrigatorio: false }
  - { nome: moodboard,          tipo_dado: file,   obrigatorio: false }
```

## 2.5 E-commerce

```yaml
tipo: ecommerce
fonte_spec: docs/briefing-especificacoes/03-estrutura-briefing.md#e-commerce
campos_especificos:
  - nome: plataforma
    tipo_dado: select
    obrigatorio: true
    valores: [site_ruby_rose, site_melu, union_marketplace, amazon, mercado_livre, shopee]
  - nome: tipo_material
    tipo_dado: select
    obrigatorio: true
    valores: [banner_home, banner_categoria, banner_promocional, imagem_produto, listing_marketplace, email_marketing]
  - { nome: dimensoes,       tipo_dado: text, obrigatorio: true }
  - { nome: promocao_info,   tipo_dado: text, obrigatorio: false }
  - { nome: copy,            tipo_dado: text, obrigatorio: false }
  - { nome: fotos_produtos,  tipo_dado: file, obrigatorio: false }
```

## 2.6 Press Kit

```yaml
tipo: presskit
fonte_spec: docs/briefing-especificacoes/03-estrutura-briefing.md#press-kit
campos_especificos:
  - nome: publico
    tipo_dado: select
    obrigatorio: true
    valores: [imprensa, influencer, parceiro_b2b, interno]
  - nome: componentes
    tipo_dado: multiselect
    obrigatorio: true
    valores: [caixa, rotulo, card, brindes, produtos, voucher]
  - { nome: quantidade,  tipo_dado: number, obrigatorio: true }
```

## 2.7 Catálogo / Book

```yaml
tipo: catalogo
fonte_spec: docs/briefing-especificacoes/03-estrutura-briefing.md#catálogo--book
campos_especificos:
  - nome: tipo_catalogo
    tipo_dado: select
    obrigatorio: true
    valores: [book_trade, guia_lancamento, catalogo_linha, apresentacao_comercial]
  - { nome: conteudo_secoes, tipo_dado: text, obrigatorio: true }
  - { nome: formato,         tipo_dado: text, obrigatorio: true }
  - nome: idioma
    tipo_dado: select
    obrigatorio: true
    valores: [portugues, ingles, espanhol, bilingue]
```

## 2.8 Material Interno

```yaml
tipo: material_interno
fonte_spec: docs/briefing-especificacoes/03-estrutura-briefing.md#material-interno
campos_especificos:
  - nome: tipo_material
    tipo_dado: select
    obrigatorio: true
    valores: [flyer_poster, backdrop, organograma, decoracao, comunicado]
  - { nome: dimensao, tipo_dado: text, obrigatorio: true }
  - { nome: copy,     tipo_dado: text, obrigatorio: true }
  - nome: formato_entrega
    tipo_dado: select
    obrigatorio: true
    valores: [pdf_impressao, digital_tv_painel, ambos]
```

---

# 3. Defaults — `briefing_defaults`

Lista plana. `tipo: "*"` é wildcard — na conversão para SQL, expande em 8 INSERTs
(um por tipo). `empresa_id: null` em todos.

```yaml
# --- Defaults globais (wildcard) ---
- { tipo: "*", campo: qtde_versoes, valor_padrao: 3,       fonte_spec: docs/briefing-especificacoes/02-perguntas-por-tipo.md#regras-gerais-de-coleta }
- { tipo: "*", campo: prioridade,   valor_padrao: "Média", fonte_spec: docs/briefing-especificacoes/02-perguntas-por-tipo.md#regras-gerais-de-coleta }

# --- Dimensões padrão PDV (apenas as 5 declaradas na spec 03) ---
- { tipo: pdv, campo: "dimensoes.wobbler",          valor_padrao: "15x10cm",     fonte_spec: docs/briefing-especificacoes/03-estrutura-briefing.md#material-pdv }
- { tipo: pdv, campo: "dimensoes.stopper",          valor_padrao: "20x5cm",      fonte_spec: docs/briefing-especificacoes/03-estrutura-briefing.md#material-pdv }
- { tipo: pdv, campo: "dimensoes.faixa_gondola",    valor_padrao: "90x4cm",      fonte_spec: docs/briefing-especificacoes/03-estrutura-briefing.md#material-pdv }
- { tipo: pdv, campo: "dimensoes.cubo_promocional", valor_padrao: "30x30x30cm",  fonte_spec: docs/briefing-especificacoes/03-estrutura-briefing.md#material-pdv }
- { tipo: pdv, campo: "dimensoes.totem",            valor_padrao: "60x180cm",    fonte_spec: docs/briefing-especificacoes/03-estrutura-briefing.md#material-pdv }
# Régua, Display de Balcão, Glorifier, Plotagem de Loja: (ambíguo — confirmar) — spec
# declara "Varia / Custom / solicitar". Não entram em defaults até decisão no review.
```

---

# 4. Obrigatórios — `briefing_campos_obrigatorios`

Regra de extração aplicada (confirmada no plano):

- Spec coluna "Sim"             → peso **10** + `motivo`
- Spec coluna "Condicional"     → peso **10** + `motivo` condicional explícito
- Spec coluna "Não" mas campo aparece em 03 → peso **1** (só afeta `completeness_score`)
- `marca`, `prazo_entrega`      → peso **10** em **todos os 8 tipos** (cabeçalho universal + regra "prazo é sempre obrigatório")
- `kv_referencia`               → peso **10** em `pdv` e `campanha` (regra explícita), peso **10** em `evento` (spec 03 marca Sim)

`empresa_id: null` em todos.

## 4.0 Universais (replicar para os 8 tipos na conversão SQL)

```yaml
# Para cada tipo em [pdv, embalagem, evento, campanha, ecommerce, presskit, catalogo, material_interno]:
- { tipo: <each>, campo: marca,          peso: 10, motivo: "Sem marca, briefing não é atribuível a designer" }
- { tipo: <each>, campo: linha_colecao,  peso: 10, motivo: "Linha/coleção é eixo de organização dos assets criativos" }
- { tipo: <each>, campo: prazo_entrega,  peso: 10, motivo: "Sem prazo a demanda não entra na fila de priorização (62% das tarefas históricas sem prazo)" }
- { tipo: <each>, campo: titulo,         peso: 10, motivo: "Título é a chave de identificação do briefing no fluxo" }
```

## 4.1 PDV

```yaml
- { tipo: pdv, campo: material_type,   peso: 10, motivo: "Define peça do catálogo e dimensão padrão a aplicar" }
- { tipo: pdv, campo: dimensoes,       peso: 10, motivo: "Sem medida, designer não inicia (fallback para default quando aplicável)" }
- { tipo: pdv, campo: qtde_versoes,    peso: 10, motivo: "Define número de variações a entregar (default 3)" }
- { tipo: pdv, campo: kv_referencia,   peso: 10, motivo: "Sem KV o designer não consegue iniciar (regra explícita PDV)" }
- { tipo: pdv, campo: faca_gabarito,   peso: 1 }
- { tipo: pdv, campo: copy_texto,      peso: 1 }
- { tipo: pdv, campo: cliente_rede,    peso: 1 }
- { tipo: pdv, campo: produtos_destaque, peso: 1 }
```

## 4.2 Embalagem

```yaml
- { tipo: embalagem, campo: componente,         peso: 10, motivo: "Define o tipo de peça a desenhar" }
- { tipo: embalagem, campo: produto_sku,        peso: 10, motivo: "Sem SKU não tem o que desenhar (1 briefing por SKU)" }
- { tipo: embalagem, campo: tipo_alteracao,     peso: 10, motivo: "Decide se faca é obrigatória e qual fluxo segue" }
- { tipo: embalagem, campo: faca,               peso: 10, motivo: "Obrigatória quando tipo_alteracao = nova_embalagem; ausência → status Aguardando Faca", condicional: true }
- { tipo: embalagem, campo: dados_regulatorios, peso: 1,  observacao: "ausência aciona status Aguardando Regulatório, mas não bloqueia conclusão do lote" }
- { tipo: embalagem, campo: variantes_cor,      peso: 1 }
- { tipo: embalagem, campo: arte_anterior,      peso: 1 }
```

## 4.3 Evento

```yaml
- { tipo: evento, campo: evento_nome,    peso: 10, motivo: "Identifica o evento de destino do material" }
- { tipo: evento, campo: evento_data,    peso: 10, motivo: "Define prazo absoluto de produção (não pode passar)" }
- { tipo: evento, campo: brinde_type,    peso: 10, motivo: "Define a peça a produzir" }
- { tipo: evento, campo: kv_referencia,  peso: 10, motivo: "Sem KV o designer não inicia (spec 03 marca obrigatório)" }
- { tipo: evento, campo: dimensoes,      peso: 1 }
- { tipo: evento, campo: quantidade,     peso: 1 }
- { tipo: evento, campo: conceito_tema,  peso: 1 }
- { tipo: evento, campo: specs_producao, peso: 1 }
```

## 4.4 Campanha

```yaml
- { tipo: campanha, campo: nome_campanha,      peso: 10, motivo: "Identifica a campanha (chave de agrupamento dos desdobramentos)" }
- { tipo: campanha, campo: desdobramento_tipo, peso: 10, motivo: "Define a peça específica deste briefing dentro da campanha" }
- { tipo: campanha, campo: canal,              peso: 10, motivo: "Define formato e specs por canal" }
- { tipo: campanha, campo: formato_entrega,    peso: 10, motivo: "Define o arquivo de saída exigido" }
- { tipo: campanha, campo: kv_referencia,      peso: 10, motivo: "Sem KV o designer não inicia (regra explícita Campanha)" }
- { tipo: campanha, campo: dimensoes,          peso: 1 }
- { tipo: campanha, campo: copy_aprovado,      peso: 1 }
- { tipo: campanha, campo: produtos_destaque,  peso: 1 }
- { tipo: campanha, campo: moodboard,          peso: 1 }
```

## 4.5 E-commerce

```yaml
- { tipo: ecommerce, campo: plataforma,    peso: 10, motivo: "Define dimensões e specs do material" }
- { tipo: ecommerce, campo: tipo_material, peso: 10, motivo: "Define a peça a produzir" }
- { tipo: ecommerce, campo: dimensoes,     peso: 10, motivo: "Sem dimensão exata o asset é rejeitado pela plataforma" }
- { tipo: ecommerce, campo: promocao_info, peso: 1 }
- { tipo: ecommerce, campo: copy,          peso: 1 }
- { tipo: ecommerce, campo: fotos_produtos, peso: 1 }
```

## 4.6 Press Kit

```yaml
- { tipo: presskit, campo: publico,     peso: 10, motivo: "Define tom e nível de acabamento do kit" }
- { tipo: presskit, campo: componentes, peso: 10, motivo: "Sem lista de componentes não há escopo de produção" }
- { tipo: presskit, campo: quantidade,  peso: 10, motivo: "Define escala de produção e custo do lote" }
```

## 4.7 Catálogo / Book

```yaml
- { tipo: catalogo, campo: tipo_catalogo,    peso: 10, motivo: "Define estrutura do book (trade, guia, catálogo, apresentação)" }
- { tipo: catalogo, campo: conteudo_secoes,  peso: 10, motivo: "Outline é pré-requisito para diagramação" }
- { tipo: catalogo, campo: formato,          peso: 10, motivo: "Formato físico/digital define ferramenta e workflow" }
- { tipo: catalogo, campo: idioma,           peso: 10, motivo: "Idioma define ativos linguísticos e revisão" }
```

## 4.8 Material Interno

```yaml
- { tipo: material_interno, campo: tipo_material,    peso: 10, motivo: "Define a peça a produzir" }
- { tipo: material_interno, campo: dimensao,         peso: 10, motivo: "Sem dimensão não há base para diagramação" }
- { tipo: material_interno, campo: copy,             peso: 10, motivo: "Copy completo é pré-requisito para arte interna (referência: Flyer Dia das Mães)" }
- { tipo: material_interno, campo: formato_entrega,  peso: 10, motivo: "Define arquivo de saída (impressão vs digital)" }
```

---

# Pontos abertos para o review

1. **4 dimensões PDV ambíguas** (Régua de Gôndola, Display de Balcão, Glorifier,
   Plotagem de Loja) — manter sem default e sempre perguntar, ou definir um valor?
2. **Display de Rolo, Clip Strip, Tag** — ausentes da tabela "Dimensões padrão" da
   spec 03. Tratar como "sempre perguntar" ou propor padrão razoável?
3. **6 catálogos `inferido_de_pergunta: true`** (Embalagem, Campanha, E-commerce,
   Press Kit, Catálogo, Material Interno) — promover a catálogo canônico ou manter
   apenas como sugestão de UI sem peso de validação?
4. **`produto_sku` (Embalagem)** — validação `HB-xxx` por regex agora ou diferir
   para PR futuro?
5. **`linha_colecao` peso 10 universal** — em alguns tipos (Material Interno,
   Catálogo cross-marca) pode não ser sempre aplicável. Manter ou rebaixar para
   peso 1 nesses tipos?
6. **`evento.kv_referencia` peso 10** — spec 03 marca obrigatório, mas eventos
   genéricos sem campanha-pai podem não ter KV. Confirmar.

Lembrete: peso 10 bloqueia botão "Concluir lote" no PR4. Peso 1–9 só afeta
`completeness_score`.
