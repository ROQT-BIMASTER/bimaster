# Perguntas Obrigatórias por Tipo de Demanda

Cada tipo de demanda tem sua própria árvore de perguntas. As perguntas **compartilhadas** são feitas uma vez para toda a demanda. As perguntas **por item** só são feitas quando o valor difere do padrão.

---

## 1. Material PDV

**Template:** BT-PDV  
**Aciona quando:** solicitante menciona pdv, wobbler, stopper, gôndola, display, totem, enxoval, plotagem, vitrine, loja, rede, clip strip, cubo, glorifier, tag, régua, faixa

| # | Pergunta do agente | Campo | Obrigatório |
|---|--------------------|-------|-------------|
| 1 | "Para qual **marca e linha** você precisa o material PDV? (Ruby Rose, Melu, Union ou HForm + nome da linha)" | `marca`, `linha` | **Sim** |
| 2 | "Quais **peças** você precisa? (Selecione da lista ou descreva livre)" — exibe checklist: Wobbler, Stopper, Faixa de Gôndola, Régua de Gôndola, Display de Balcão, Display de Rolo, Clip Strip, Cubo Promocional, Totem, Glorifier, Tag, Plotagem de Loja | `lista_materiais` | **Sim** |
| 3 | "Quantas **versões/modelos** por peça?" (default: 3) | `qtde_versoes` | **Sim** |
| 4 | "Você tem o **KV (Key Visual)** da linha? Por favor, anexe o arquivo." | `kv_referencia` | **Sim** |
| 5 | "Qual o **prazo de entrega**?" | `prazo` | **Sim** |
| 6 | "Esse material é para uma **rede ou loja específica**? (ex: C&A, Lilly Perfumaria, Ultrafarma, Torra)" | `cliente_rede` | Não |
| 7 | "Alguma peça tem **medida específica** (diferente do padrão)? Se sim, informe a medida por peça. (ex: Wobbler 22×21,9cm)" | `dimensoes` | Não |
| 8 | "Você tem **faca/gabarito** para alguma das peças?" | `faca` | Não |
| 9 | "Tem algum **texto/copy** específico que precisa aparecer nos materiais?" | `copy` | Não |

**Nota sobre prioridade das perguntas:**
- Perguntas 1–5 são coletadas uma vez para toda a demanda (compartilhadas)
- Perguntas 7–9 são oferecidas por item, mas em lote: "Algum item tem dimensão diferente do padrão?"
- Se o solicitante for do Trade, a pergunta 6 (rede/loja) é apresentada antes da 7

---

## 2. Embalagem

**Template:** BT-EMB  
**Aciona quando:** solicitante menciona embalagem, cartucho, etiqueta, bula, display de produto, mockup, faca, cartela, packaging, alteração de cartucho

| # | Pergunta do agente | Campo | Obrigatório |
|---|--------------------|-------|-------------|
| 1 | "Qual a **marca e linha** do produto? (Ruby Rose, Melu, Union ou HForm + nome da linha)" | `marca`, `linha` | **Sim** |
| 2 | "É uma **embalagem nova** ou **alteração** de arte existente? (Nova embalagem / Alteração de arte / Novo display para produto existente / Ajuste regulatório)" | `tipo_alteracao` | **Sim** |
| 3 | "Quais **componentes** de embalagem você precisa? (selecione): Cartucho, Etiqueta de Fundo, Etiqueta Bula, Etiqueta Provador/Tester, Display, Mockup, Cartela" | `componentes` | **Sim** |
| 4 | "Liste os **produtos/SKUs** que precisam dessa embalagem. (Um por linha, formato: HB-xxx + Nome do produto)" | `lista_skus` | **Sim** |
| 5 | "Você tem a **faca/gabarito** do fornecedor? Anexe aqui." *(obrigatório se tipo = Nova embalagem)* | `faca` | **Condicional** |
| 6 | "Os **dados regulatórios** já estão aprovados? (Composição, INCI, QR Code) — Sim, vou anexar / Não, ainda em aprovação / Não se aplica" | `dados_regulatorios` | **Sim** |
| 7 | "Qual o **prazo de entrega**?" | `prazo` | **Sim** |

**Regra da faca:**
- `tipo_alteracao = Nova embalagem` → faca **obrigatória**. Sem ela, o item entra como `Aguardando Faca`
- `tipo_alteracao = Alteração` → faca **opcional** (arte anterior serve de referência)
- Referência real: DISPLAYS BLOW — "Aguardando receber as novas facas dos displays"; Cartuchos Hello Kitty — "\*aguardando faca\*"

---

## 3. Evento

**Template:** BT-EVT  
**Aciona quando:** solicitante menciona evento, beauty show, beauty fair, feira, stand, brindes, ativação

| # | Pergunta do agente | Campo | Obrigatório |
|---|--------------------|-------|-------------|
| 1 | "Qual o **nome e a data** do evento?" | `evento_nome`, `evento_data` | **Sim** |
| 2 | "Qual(is) **marca(s)** participam? (Ruby Rose, Melu, Union)" | `marcas` | **Sim** |
| 3 | "Quais **materiais/brindes** você precisa? Liste todos os itens (ou selecione do catálogo padrão): Lenço, Tote Bag, Chaveiro, Cordão Crachá, Card Crachá, Adesivo, Camiseta/Uniforme, Almofada, Leque, Pulseira, Bolsa, Ticket, Caixinha Brinde, Backdrop/Parede, Totem, Arte de Ativação" | `lista_brindes` | **Sim** |
| 4 | "Tem **ativações especiais** planejadas no evento? (ex: Máquina pega-bolinha, jogo de dardo, fotocabine)" | `ativacoes` | Não |
| 5 | "Você tem a **planta/layout do stand** ou fotos do espaço?" | `planta_stand` | Não |
| 6 | "Algum item tem **medida/dimensão específica**? (ex: Almofada 12×12cm, Backdrop 3×2m)" | `dimensoes` | Não |
| 7 | "Qual o **prazo para envio** dos materiais para produção?" | `prazo_producao` | **Sim** |

**Nota de decomposição:**
- Se múltiplas marcas: cada marca gera um conjunto separado de briefings (ex: Beauty Show → Ruby Rose 10 itens + Melu 9 itens + Ativações 4 itens = 23 briefings)
- Referência real: Beauty Show 2026 gerou exatamente esse padrão no Asana

---

## 4. Campanha / KV

**Template:** BT-KV  
**Aciona quando:** solicitante menciona campanha, kv, key visual, lançamento, copa, dia das mães, dia dos namorados, natal, black friday

| # | Pergunta do agente | Campo | Obrigatório |
|---|--------------------|-------|-------------|
| 1 | "Qual o **nome/tema** da campanha?" | `nome_campanha` | **Sim** |
| 2 | "Qual(is) **marca(s)**? (Ruby Rose, Melu, Union)" | `marcas` | **Sim** |
| 3 | "Qual o **objetivo** da campanha? Descreva o contexto e o que quer comunicar." | `objetivo` | **Sim** |
| 4 | "Em quais **canais** a campanha vai rodar? (PDV, E-commerce, Social Media, Evento, Distribuidora, Institucional)" | `canais` | **Sim** |
| 5 | "Quais **desdobramentos** você precisa? (KV Principal, Banner E-commerce, Post Social, Story, Material PDV, Email Marketing, Banner Site, Anúncio Revista/Impressa)" | `desdobramentos` | **Sim** |
| 6 | "Qual o **período da campanha** e o **prazo do KV principal**?" | `periodo`, `prazo` | **Sim** |
| 7 | "Tem **texto/copy aprovado**? Se sim, qual?" | `copy` | Não |
| 8 | "Tem **medidas específicas**? (ex: Anúncio revista 21×28cm com 5mm de sangria, entrega em PDF)" | `medidas` | Não |

**Referência real:** Campanha "Revista Beauty Fair" usou estrutura CONTEXTO + FORMATO + MENSAGEM nas notas da tarefa — este agente estrutura esses mesmos campos de forma conversacional.

---

## 5. E-commerce

**Template:** BT-ECOMM  
**Aciona quando:** solicitante menciona ecommerce, marketplace, union, site ruby, site melu, banner site, email marketing, shopee, mercado livre, amazon, listing

| # | Pergunta do agente | Campo | Obrigatório |
|---|--------------------|-------|-------------|
| 1 | "Para qual(is) **plataforma(s)**? (Site Ruby Rose, Site Melu, Union Marketplace, Amazon, Mercado Livre, Shopee, Outros)" | `plataformas` | **Sim** |
| 2 | "Que tipo de **material**? (Banner Home, Banner Categoria, Banner Promocional, Imagem de Produto, Listing Marketplace, Email Marketing)" | `tipo_material` | **Sim** |
| 3 | "Qual a **marca**? (Ruby Rose, Melu, Union)" | `marca` | **Sim** |
| 4 | "É para alguma **promoção ou data comercial**? (ex: Dia dos Namorados, 10% OFF, Frete Grátis)" | `promocao` | Não |
| 5 | "Quais as **dimensões necessárias** por plataforma?" | `dimensoes` | **Sim** |
| 6 | "Qual o **prazo de publicação**?" | `prazo` | **Sim** |

**Referência real:** "Union Maio 2026 | PRÉ DIA DOS NAMORADOS" gerou 3 subtarefas: UNION, RUBY ROSE, MELU — decomposição por marca por plataforma.

---

## 6. Press Kit

**Template:** BT-PK  
**Aciona quando:** solicitante menciona press kit, presskit, kit influencer, kit imprensa, kit de mídia

| # | Pergunta do agente | Campo | Obrigatório |
|---|--------------------|-------|-------------|
| 1 | "Qual a **marca e linha** em destaque?" | `marca`, `linha` | **Sim** |
| 2 | "Para qual **público**? (Imprensa, Influencer, Parceiro B2B, Interno)" | `publico` | **Sim** |
| 3 | "Quais **componentes** do kit? (Caixa, Rótulo, Card, Brindes, Produtos, Voucher, etc.)" | `componentes` | **Sim** |
| 4 | "Quantos **kits** serão produzidos?" | `quantidade` | **Sim** |
| 5 | "Qual o **prazo**?" | `prazo` | **Sim** |

**Referência real:** "RÓTULO PRESSKIT PISTACHE" e "PRESSKIT" (We|Melu Criação/Identidade) — componentes típicos: caixa + rótulo + card.

---

## 7. Catálogo / Book

**Template:** BT-CAT  
**Aciona quando:** solicitante menciona catálogo, book trade, guia, guia de lançamento, apresentação comercial, book china

| # | Pergunta do agente | Campo | Obrigatório |
|---|--------------------|-------|-------------|
| 1 | "Que **tipo** de material? (Book Trade, Guia de Lançamento, Catálogo de Linha, Apresentação Comercial)" | `tipo` | **Sim** |
| 2 | "Qual(is) **marca(s)**?" | `marcas` | **Sim** |
| 3 | "Qual o **conteúdo por seção**? (Liste seções e o que vai em cada uma)" | `conteudo_secoes` | **Sim** |
| 4 | "Qual o **formato e dimensão**? (A4, digital, impresso, tamanho personalizado)" | `formato` | **Sim** |
| 5 | "Qual o **idioma**? (Português, Inglês, Espanhol, Bilíngue)" | `idioma` | **Sim** |
| 6 | "Qual o **prazo**?" | `prazo` | **Sim** |

**Referência real:** "BOOK TRADE CHINA" — conteúdo estruturado em seções: PDV (Wobbler, Faixa de Gôndola, etc.) + Brindes (Necessaire, Presilha, Mochila) + Exposição. Implica necessidade de versão em inglês/chinês.

---

## 8. Material Interno

**Template:** BT-INT  
**Aciona quando:** solicitante menciona material interno, endomarketing, flyer interno, arte escritório, organograma, decoração, comunicado interno, arte elevador

| # | Pergunta do agente | Campo | Obrigatório |
|---|--------------------|-------|-------------|
| 1 | "Que **tipo** de material? (Flyer/Pôster, Backdrop, Organograma, Decoração, Comunicado)" | `tipo` | **Sim** |
| 2 | "Qual a **dimensão/formato**? (ex: A4, A3, 1×2m, TV 16:9)" | `dimensao` | **Sim** |
| 3 | "Qual o **texto/copy** que deve aparecer?" | `copy` | **Sim** |
| 4 | "Qual o **formato de entrega**? (PDF para impressão, Digital para TV/painel, Ambos)" | `formato_entrega` | **Sim** |
| 5 | "Qual o **prazo**?" | `prazo` | **Sim** |

**Referência real:** "Flyer Dia das Mães" — copy completo estava nas notas da tarefa; "ARTE ELEVADOR E SALA DE REUNIÃO" — aguardava novas medidas do espaço físico.

---

## Regras Gerais de Coleta

### Prazo — campo mais crítico
- 62% das tarefas na base Asana não têm prazo definido
- Prazo é **sempre obrigatório**. Se o solicitante não informar, o agente pergunta novamente:
  > "⚠️ Preciso do prazo para criar o briefing. Sem ele, o designer não consegue priorizar. Qual é a data limite?"
- Se o solicitante realmente não souber: registra como `"A definir"` mas deixa aviso visível no briefing

### Versões — default sempre 3
- Confirmado em 100% das demandas PDV analisadas
- O agente informa o default e só pergunta se diferente:
  > "Vou criar 3 versões para cada peça (padrão). Precisa de um número diferente?"

### KV / Referência visual
- Obrigatório para Material PDV e Campanha/KV
- Se não disponível no momento, o agente avisa:
  > "⚠️ Sem o KV, o designer não consegue iniciar. Pode enviar depois? O briefing será criado, mas ficará aguardando esse arquivo."

### Faca
- Obrigatória para Embalagem Nova
- Opcional para Alteração (arte anterior serve)
- Se ausente: briefing entra com status `Aguardando Faca`
