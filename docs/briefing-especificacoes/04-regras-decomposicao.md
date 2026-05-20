# Regras de Decomposição de Demandas

## Princípio: 1 Item = 1 Task = 1 Briefing

Uma demanda do solicitante pode gerar múltiplos itens. O agente decompõe **antes** de coletar os detalhes. A decomposição garante que cada briefing gerado seja atômico, autocontido e possa entrar no ciclo Huggs de forma independente.

> Regra de ouro: o designer que recebe um briefing nunca precisa consultar outro briefing da mesma demanda para executar seu trabalho.

---

## Padrões de Decomposição

### DEC-PDV-ENXOVAL — Enxoval PDV Completo

**Eixo:** Tipo de material  
**Aciona:** solicitante diz "enxoval PDV" ou "materiais para o PDV da Linha [X]"

**Catálogo padrão (12 tipos):**
1. Wobbler
2. Stopper
3. Faixa de Gôndola Personalizada
4. Régua de Gôndola Personalizada
5. Display de Balcão
6. Display de Rolo
7. Clip Strip
8. Cubo Promocional
9. Totem
10. Glorifier
11. Tag
12. Plotagem de Loja

**Fórmula:** N materiais selecionados × M versões = N briefings (cada um com `qtde_versoes = M`)

**Campos compartilhados** (perguntados uma vez):
- Marca / Linha
- KV da linha
- Prazo
- Prioridade
- Número de versões (default: 3)
- Cliente/rede (se material para loja específica)

**Campos únicos por item:**
- Tipo de material
- Dimensões (padrão pré-preenchido por tipo; custom se especificado)
- Faca/gabarito (se disponível para aquela peça específica)

**Exemplo real (Asana gid 1214634079578356):**
```
Input: "Preciso de materiais para o PDV da Linha Hello Kitty.
        Por favor, criar 3 modelos para cada tipo de material.
        O KV da linha está em anexo."

Decomposição:
→ Wobbler — Hello Kitty — Ruby Rose         (briefing 1/9, ×3 versões)
→ Faixa de Gôndola — Hello Kitty — Ruby Rose (briefing 2/9, ×3 versões)
→ Régua de Gôndola — Hello Kitty — Ruby Rose (briefing 3/9, ×3 versões)
→ Display de Rolo — Hello Kitty — Ruby Rose  (briefing 4/9, ×3 versões)
→ Clip Strip — Hello Kitty — Ruby Rose       (briefing 5/9, ×3 versões)
→ Cubo Promocional — Hello Kitty — Ruby Rose (briefing 6/9, ×3 versões)
→ Stopper — Hello Kitty — Ruby Rose          (briefing 7/9, ×3 versões)
→ Display de Balcão — Hello Kitty — Ruby Rose (briefing 8/9, ×3 versões)
→ Totem — Hello Kitty — Ruby Rose            (briefing 9/9, ×3 versões)

Total: 9 briefings individuais
```

---

### DEC-PDV-SPECIFIC — Peças PDV Específicas (set parcial)

**Eixo:** Material × Linha  
**Aciona:** solicitante lista materiais específicos (ex: "Wobbler + Folheto para 4 linhas")

**Fórmula:** Qtde de materiais × Qtde de linhas = N briefings

**Campos compartilhados:**
- Marca
- Prazo

**Campos únicos por item:**
- Tipo de material
- Linha/sabor
- Dimensões
- KV (pode diferir por linha)

**Exemplo real:**
```
Input: "Fazer 3 versões de Wobblers de cada: Abacaxi, Carambola, Caju, Baunilha
        + 1 folheto de apresentação de cada linha"

Decomposição (2 materiais × 4 linhas = 8 briefings):
→ Wobbler — Abacaxi — Melu
→ Wobbler — Carambola — Melu
→ Wobbler — Caju — Melu
→ Wobbler — Baunilha — Melu
→ Flyer — Abacaxi — Melu
→ Flyer — Carambola — Melu
→ Flyer — Caju — Melu
→ Flyer — Baunilha — Melu

Total: 8 briefings
```

---

### DEC-PDV-STORE — PDV Loja Específica (plotagem/vitrine)

**Eixo:** Espaço na loja  
**Aciona:** solicitante menciona nome de loja + dimensões de espaços físicos

**Campos compartilhados:**
- Nome da loja / cliente
- Diretrizes de marca
- Prazo

**Campos únicos por item:**
- Localização do espaço (vitrine, fachada, parede, gôndola)
- Dimensões exatas
- Marca/linha para aquele espaço
- Foto de referência (opcional)

**Exemplo real (VITRINES | LILLY PERFUMARIA):**
```
Input: "Preciso de vitrine para a Lilly Perfumaria.
        Linha Rosa: Vitro 0,44×2,45m, Vitrine 2,13×2,45m.
        Linha Made In: parte 1 Vitro 0,44×2,45m..."

Decomposição:
→ Vitrine 1 — Linha Rosa — Ruby Rose     (0,44×2,45m)
→ Vitrine 2 — Linha Rosa — Ruby Rose     (2,13×2,45m)
→ Vitrine 3 — Made In — Ruby Rose        (0,44×2,45m)
→ Vitrine Melu — Made In — Melu          (dimensão específica)

Total: 4 briefings
```

---

### DEC-EMB-PRODUCT — Embalagem por SKU

**Eixo:** Produto  
**Aciona:** solicitante pede arte de embalagem para uma linha de produtos (displays, etiquetas, cartuchos)

**Campos compartilhados:**
- KV da linha
- Marca
- Tipo de componente (Display, Etiqueta, etc.)

**Campos únicos por item:**
- SKU do produto (formato HB-xxx)
- Nome do produto
- Variantes de cor
- Faca (por produto, se aplicável)

**Exemplo real (DISPLAYS | BLOW — gid 1211342528384529):**
```
Input: "Precisamos dos displays para toda a linha Blow.
        Aguardando receber as novas facas dos displays."

Decomposição (21 produtos = 21 briefings):
→ Display — Balm Labial Girl's Night — Blow
→ Display — Base Líquida Oh My Skin! — Blow
→ Display — Batom Líquido Classic Thing — Blow
→ Display — Batom Satin Besties — Blow
→ Display — Bronzer Baked Feels Like Sun — Blow
→ Display — Blush Really Blushed — Blow
→ Display — Blush Duo Whatever — Blow
→ Display — Cera para Sobrancelha It Girl — Blow
→ Display — Corretivo Líquido So Real — Blow
→ Display — Gel para Sobrancelha Girly Club — Blow
→ Display — Gloss Labial The Glossier One — Blow
→ Display — Gloss Labial Shine Like Gloss — Blow
→ Display — Hidratante Labial Balm to Go — Blow
→ Display — Iluminador Baked Glowing Rules — Blow
→ Display — Iluminador Duo Such a Glimmer! — Blow
→ Display — Lip Oil Glow Theory — Blow
→ Display — Máscara para Cílios Dramatic!!! — Blow
→ Display — Paleta de Sombras 1 Girl's Syndrome — Blow
→ Display — Paleta de Sombras 2 Dear Diary — Blow
→ Display — Pó Compacto Oh My Blur! — Blow
→ Display — Pó Baked Baked Filter — Blow

Status de todos: Aguardando Faca
Total: 21 briefings
```

---

### DEC-EMB-COMPONENT — Embalagem por Componente

**Eixo:** Tipo de componente  
**Aciona:** solicitante pede "embalagem completa" de um produto novo (SKU específico)

**Campos compartilhados:**
- SKU / nome do produto
- Marca / linha
- Faca (a mesma para todos os componentes, se disponível)

**Campos únicos por item:**
- Tipo de componente
- Dimensões específicas do componente
- Dados regulatórios (só para Etiqueta Bula)

**Exemplo:**
```
Input: "Precisamos da embalagem completa do novo SKU HB-M304 (Base Líquida Daily Skin)"

Decomposição (1 produto × 4 componentes = 4 briefings):
→ Cartucho — HB-M304 Base Líquida Daily Skin — Classic
→ Etiqueta de Fundo — HB-M304 Base Líquida Daily Skin — Classic
→ Etiqueta Bula — HB-M304 Base Líquida Daily Skin — Classic
→ Display — HB-M304 Base Líquida Daily Skin — Classic

Total: 4 briefings (compartilham faca e dados de marca; Etiqueta Bula aguarda regulatório)
```

---

### DEC-EMB-LINE — Embalagem por Linha (corporal/skincare)

**Eixo:** Produto dentro da linha  
**Aciona:** solicitante pede embalagem para uma linha inteira (ex: Sobremesas Pistache, Made In Frutas)

**Campos compartilhados:**
- Identidade da linha
- Marca
- Tipo de componente

**Campos únicos por item:**
- Nome do produto
- SKU
- Formato/forma específica
- Dados regulatórios individuais

**Exemplo real (SOBREMESAS | PISTACHE):**
```
Input: "Precisamos das embalagens para a linha Sobremesas Pistache"

Decomposição típica de linha corporal (6-11 produtos):
→ Embalagem — Body Splash — Sobremesas Pistache — Ruby Rose
→ Embalagem — Creme de Mãos — Sobremesas Pistache — Ruby Rose
→ Embalagem — Esfoliante Corporal — Sobremesas Pistache — Ruby Rose
→ Embalagem — Hidratante Labial — Sobremesas Pistache — Ruby Rose
→ Embalagem — Manteiga Corporal — Sobremesas Pistache — Ruby Rose
→ Embalagem — [mais produtos da linha...]

Total: 6-11 briefings por linha
```

---

### DEC-EVT-BRINDE — Evento por Brinde/Material

**Eixo:** Item de brinde  
**Aciona:** nome de evento + lista de brindes/materiais mencionada

**Campos compartilhados:**
- Nome do evento
- Data do evento
- Marca
- KV da marca/evento
- Conceito/tema

**Campos únicos por item:**
- Tipo de brinde
- Dimensões (quando aplicável)
- Quantidade

**Nota especial:** se múltiplas marcas, cada marca gera seu próprio conjunto de briefings.

**Exemplo real (Beauty Show 2026):**
```
Demanda: Beauty Show 2026 — Ruby Rose + Melu + Ativações

Decomposição Ruby Rose (10 briefings):
→ Lenço — Beauty Show 2026 — Ruby Rose
→ Tote Bag — Beauty Show 2026 — Ruby Rose
→ Chaveiro — Beauty Show 2026 — Ruby Rose
→ Cordão Crachá — Beauty Show 2026 — Ruby Rose
→ Card Crachá — Beauty Show 2026 — Ruby Rose
→ Adesivo — Beauty Show 2026 — Ruby Rose
→ Estampa Camiseta Uniforme — Beauty Show 2026 — Ruby Rose
→ Almofada Institucional 12×12 — Beauty Show 2026 — Ruby Rose
→ Leque — Beauty Show 2026 — Ruby Rose
→ Pulseiras — Beauty Show 2026 — Ruby Rose

Decomposição Melu (9 briefings):
→ Arte do Dardo — Beauty Show 2026 — Melu
→ Ticket — Beauty Show 2026 — Melu
→ Caixinha Brinde Institucional — Beauty Show 2026 — Melu
→ Caixinha Brinde Baunilha — Beauty Show 2026 — Melu
→ Bolsa — Beauty Show 2026 — Melu
→ Lenço — Beauty Show 2026 — Melu
→ Almofada — Beauty Show 2026 — Melu
→ Adesivo — Beauty Show 2026 — Melu
→ Pulseiras — Beauty Show 2026 — Melu

Decomposição Ativações (4 briefings):
→ AF Ativação Melu — Beauty Show 2026
→ Máquina Pega Bolinha — Beauty Show 2026 — Melu
→ Parede de Fundo Ruby Rose — Beauty Show 2026
→ Parede de Fundo Melu — Beauty Show 2026

Total: 23 briefings individuais
```

---

### DEC-ECOMM-BRAND — E-commerce por Marca × Plataforma

**Eixo:** Marca e/ou plataforma  
**Aciona:** demanda de conteúdo para marketplace ou site

**Campos compartilhados:**
- Período da campanha
- Datas comerciais
- Contexto regional (se aplicável)

**Campos únicos por item:**
- Marca
- Plataforma
- Dimensões específicas da plataforma
- Adaptação regional

**Exemplo real (Union Maio 2026):**
```
Input: "Banners para campanha Dia dos Namorados — Union"

Decomposição (3 marcas = 3 briefings):
→ Banner — Dia dos Namorados — Union Marketplace
→ Banner — Dia dos Namorados — Ruby Rose (via Union)
→ Banner — Dia dos Namorados — Melu (via Union)

Total: 3 briefings
```

---

### DEC-CAMP-DESDOBRAMENTO — Campanha por Desdobramento × Canal

**Eixo:** Tipo de peça por canal  
**Aciona:** demanda de KV com múltiplos desdobramentos

**Campos compartilhados:**
- Nome da campanha
- Marca(s)
- Objetivo
- Período
- Copy aprovado (quando existir)

**Campos únicos por item:**
- Canal (PDV, E-commerce, Social)
- Tipo de desdobramento (KV Principal, Banner, Post, Story)
- Dimensões específicas
- Formato de entrega

**Exemplo:**
```
Input: "KV e desdobramentos da campanha Copa do Mundo 2026"

Decomposição típica:
→ KV Principal — Copa do Mundo 2026 — Ruby Rose
→ KV Principal — Copa do Mundo 2026 — Melu
→ Banner E-commerce — Copa do Mundo 2026 — Ruby Rose
→ Post Social — Copa do Mundo 2026 — Ruby Rose
→ Material PDV (Wobbler) — Copa do Mundo 2026 — Ruby Rose

Total: 5+ briefings (depende dos canais e marcas confirmados)
```

---

## Lógica do Agente — Algoritmo de Decomposição

```
1. Receber descrição livre da demanda
2. Classificar tipo de demanda (8 tipos)
3. Identificar eixo de decomposição:
   - PDV enxoval → eixo: tipo de material
   - PDV peças específicas → eixo: material × linha
   - PDV loja → eixo: espaço na loja
   - Embalagem por linha → eixo: produto
   - Embalagem completa de SKU → eixo: componente
   - Evento → eixo: brinde/material por marca
   - E-commerce → eixo: marca × plataforma
   - Campanha → eixo: desdobramento × canal
4. Calcular N (número de itens):
   - Perguntar lista se não fornecida
   - Sugerir catálogo padrão se tipo permite
   - Multiplicar eixos se necessário
5. Apresentar: "Sua demanda gera [N] briefings: [lista]"
6. Aguardar confirmação do solicitante
7. Ajustar lista se solicitado (adicionar/remover itens)
8. Coletar informações compartilhadas (1 vez para todos)
9. Coletar exceções por item (só o que difere do padrão)
10. Verificar completude (avisar sobre campos críticos ausentes)
11. Gerar N briefings individuais
12. Confirmar com IDs gerados
```

---

## Tabela de Referência Rápida

| Tipo de demanda | N típico | Eixo principal |
|----------------|----------|----------------|
| PDV Enxoval completo | 8–12 | Material |
| PDV peças + linhas | 3–8 | Material × Linha |
| PDV loja específica | 1–6 | Espaço da loja |
| Embalagem linha inteira | 6–21 | SKU / produto |
| Embalagem SKU único | 2–5 | Componente |
| Evento (por marca) | 8–15 | Brinde |
| Evento multi-marca | 20–30 | Brinde × Marca |
| E-commerce | 3–6 | Marca × Plataforma |
| Campanha | 4–10 | Desdobramento × Canal |
| Press Kit | 2–5 | Componente |
| Catálogo/Book | 1–3 | Volume/Idioma |
| Material Interno | 1–2 | — |
