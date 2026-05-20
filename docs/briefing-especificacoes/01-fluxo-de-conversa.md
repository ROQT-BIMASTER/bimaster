# Fluxo de Conversa do Agente

O agente opera em 4 fases sequenciais. Não há fase de identificação — o sistema já conhece o usuário (nome, setor, marca principal) via sessão autenticada.

---

## Fase 1 — Classificação da Demanda

### Objetivo
Entender o tipo de demanda e confirmar com o solicitante antes de avançar.

### Pergunta de abertura
> "Olá, [Nome]! O que você precisa hoje?"

O agente pede uma descrição livre e deixa o solicitante falar naturalmente — da mesma forma que ele escreveria numa tarefa do Asana.

### Sinais de Classificação (tabela completa)

| Tipo | Palavras-chave / Sinais |
|------|------------------------|
| **Material PDV** | pdv, wobbler, stopper, gôndola, display de balcão, display de rolo, totem, enxoval, plotagem, vitrine, loja, rede, clip strip, cubo promocional, glorifier, tag, régua, faixa |
| **Embalagem** | embalagem, cartucho, etiqueta, bula, etiqueta de fundo, display de produto, mockup, faca, cartucho, cartela, packaging, arte de embalagem, alteração de cartucho |
| **Evento** | evento, beauty show, beauty fair, feira, stand, brindes, ativação, brinde |
| **Campanha / KV** | campanha, kv, key visual, lançamento, copa, dia das mães, dia dos namorados, natal, black friday |
| **E-commerce** | ecommerce, marketplace, site ruby, site melu, union, banner site, email marketing, shopee, mercado livre, amazon, listing |
| **Press Kit** | press kit, presskit, kit influencer, kit imprensa, kit de mídia |
| **Catálogo / Book** | catálogo, book trade, guia, guia de lançamento, apresentação comercial, book china |
| **Material Interno** | interno, endomarketing, escritório, comunicado, organograma, decoração, arte elevador, flyer interno |

### Confirmação
Após classificar, o agente confirma:
> "Entendi que você precisa de **[Tipo]**. Correto?"

**Se ambíguo:** o agente pergunta diretamente:
> "Parece que pode ser **[Tipo A]** ou **[Tipo B]**. Qual se encaixa melhor?"

**Regra de prioridade para sinais sobrepostos:**
- "Display" isolado → perguntar: é display de PDV ou display de produto (embalagem)?
- "Union" → E-commerce por padrão
- "Brinde" + nome de evento → Evento
- "Faca" isolado → Embalagem

---

## Fase 2 — Enumeração dos Itens

### Objetivo
Listar **todos** os itens que a demanda vai gerar antes de entrar em detalhes. O agente decompõe usando as regras do documento `04-regras-decomposicao.md`.

### Regras de Decomposição (resumo)

| Padrão | Eixo de decomposição | Exemplo |
|--------|----------------------|---------|
| **PDV Enxoval completo** | Tipo de material | 1 item por material do catálogo padrão |
| **PDV peças específicas** | Material × linha | 2 materiais × 4 linhas = 8 itens |
| **PDV loja específica** | Espaço na loja | 1 item por vitrine/parede/fachada |
| **Embalagem por SKU** | Produto | 1 item por produto (ex: 21 produtos = 21 briefings) |
| **Embalagem por componente** | Tipo de componente | Cartucho + Etiqueta + Bula + Display = 4 briefings |
| **Embalagem por linha** | Produto dentro da linha | Body Splash, Creme, Hidratante... = 6-11 briefings |
| **Evento** | Brinde / material | 1 item por brinde (8-15 típico por marca) |
| **E-commerce** | Marca × plataforma | 1 item por combinação |
| **Campanha** | Desdobramento × canal | KV Principal + Banner + Post + PDV = 4+ briefings |

### Catálogo Padrão de Materiais PDV

Usado quando o solicitante pede "enxoval" ou não sabe listar as peças:

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

### Catálogo Padrão de Brindes para Evento

Usado como checklist quando o solicitante não tem lista:

1. Lenço
2. Tote Bag
3. Chaveiro
4. Cordão Crachá
5. Card Crachá
6. Adesivo
7. Camiseta / Uniforme
8. Almofada
9. Leque
10. Pulseira
11. Bolsa
12. Ticket
13. Caixinha Brinde
14. Backdrop / Parede de Fundo
15. Totem
16. Arte de Ativação

### Apresentação da lista
> "Sua demanda gera **[N] itens**:
> 1. Wobbler — Hello Kitty (×3 versões)
> 2. Faixa de Gôndola — Hello Kitty (×3 versões)
> ...
> 
> Precisa adicionar ou remover algum?"

O solicitante pode ajustar a lista. O agente confirma a lista final antes de prosseguir.

---

## Fase 3 — Coleta Profunda

### Objetivo
Coletar todas as informações necessárias para gerar os briefings, com o mínimo de perguntas repetidas.

### Estratégia

**Perguntas compartilhadas primeiro** — informações que valem para todos os itens (marca, linha, KV, prazo, prioridade, número de versões). Perguntadas **uma única vez**.

**Perguntas por item apenas para exceções** — o que é diferente entre os itens (dimensões não-padrão, copy específico, faca por peça).

**Confirmação em lote para valores padrão:**
> "Para todos os [N] Wobblers, vou usar a dimensão padrão de 15×10cm. Algum precisa de medida diferente?"

**Pré-preenchimento de defaults:**
- Número de versões: 3 (default do mercado — confirmado em 100% dos ENXOVAIs analisados)
- Dimensões: padrão por tipo de material (o agente informa qual padrão vai usar)
- Prioridade: Média (default, solicitante pode alterar)

### Referência das árvores de perguntas
Ver documento `02-perguntas-por-tipo.md` para a lista completa de perguntas por tipo de demanda.

---

## Fase 4 — Validação e Geração

### Objetivo
Garantir completude, obter confirmação e gerar os briefings individuais.

### Exibição do Resumo

O agente mostra um resumo completo antes de gerar:

```
Resumo da sua demanda:

Tipo: Material PDV
Solicitante: Mirella Mota | Trade Marketing
Total de itens: 9 briefings

| # | Item                      | Versões | Dimensão      | KV     | Prazo      |
|---|---------------------------|---------|---------------|--------|------------|
| 1 | Wobbler — Hello Kitty     | 3       | 15×10cm       | Anexo  | 20/06/2026 |
| 2 | Faixa de Gôndola          | 3       | 90×4cm        | Anexo  | 20/06/2026 |
| 3 | Régua de Gôndola          | 3       | Padrão        | Anexo  | 20/06/2026 |
...

Tudo certo? Posso gerar os 9 briefings?
```

### Verificação de Completude — Avisos

| Situação | Aviso exibido |
|----------|---------------|
| Prazo não informado | ⚠️ **Atenção:** Você não informou prazo. Sem prazo, a demanda não entra na fila de priorização. Deseja informar agora? |
| KV não anexado (PDV / Campanha) | ⚠️ **Atenção:** Sem o KV, o designer não consegue iniciar o trabalho. Pode anexar agora? |
| Faca pendente (Embalagem nova) | ℹ️ A faca ainda não foi fornecida. O item será criado com status **"Aguardando Faca"**. |
| Dimensões não informadas | ℹ️ Medidas não informadas. Serão usadas as medidas padrão para este tipo de material. |
| Dados regulatórios pendentes (Embalagem) | ℹ️ Dados regulatórios não anexados. O item poderá ser iniciado, mas a etiqueta bula ficará bloqueada. |

### Confirmação e Geração

Após o solicitante confirmar:
1. O agente gera N briefings individuais, cada um autocontido
2. Cada briefing recebe um `briefing_id` único no formato `BRF-AAAA-MM-DD-NNN`
3. Todos os briefings são vinculados ao mesmo `parent_demand_id`
4. O agente envia confirmação com os IDs:

> "**9 briefings criados com sucesso!** Cada um entrará no fluxo de produção individualmente.
> 
> IDs gerados:
> - BRF-2026-05-20-001 — Wobbler — Hello Kitty — Ruby Rose
> - BRF-2026-05-20-002 — Faixa de Gôndola — Hello Kitty — Ruby Rose
> - BRF-2026-05-20-003 — Régua de Gôndola — Hello Kitty — Ruby Rose
> ..."

---

## Casos Especiais

### 1. Demanda vaga ("preciso de materiais")
**Comportamento:** O agente pergunta o tipo específico antes de avançar.
> "Que tipo de material você precisa? PDV (wobbler, stopper, display...), embalagem (cartucho, etiqueta...), ou outro?"

### 2. Solicitante não sabe listar os itens
**Comportamento:** O agente exibe o catálogo padrão do tipo como checklist para o solicitante selecionar.
> "Aqui estão os materiais PDV padrão. Selecione os que você precisa: [ ] Wobbler [ ] Stopper [ ] Faixa de Gôndola..."

### 3. Demanda com tipos mistos (PDV + Embalagem + Press Kit)
**Comportamento:** O agente separa em demandas distintas, cada uma seguindo sua própria árvore de perguntas. Gera briefings de todos, mas com parent_demand_ids separados.
> "Identifiquei 3 tipos diferentes nessa demanda. Vou tratar cada um separado para garantir que os briefings fiquem completos. Vamos começar pelo PDV?"

### 4. Dimensões não informadas para material de loja
**Comportamento:** Cria o briefing com status `Aguardando Medidas`.
> "Sem as medidas, crio o briefing como 'Aguardando Medidas'. O designer ficará travado até receber. Você consegue pegar as medidas com o cliente?"

### 5. Faca não disponível (Embalagem nova)
**Comportamento:** Cria o briefing com status `Aguardando Faca`. Briefing entra no sistema mas fica bloqueado até o arquivo chegar.
> "Tudo bem, crio o briefing como 'Aguardando Faca'. Assim que chegar do fornecedor, é só atualizar no Huggs."
