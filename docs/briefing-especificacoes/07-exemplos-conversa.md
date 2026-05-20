# Exemplos de Conversa

Três conversas completas mostrando o agente em ação. Cada exemplo cobre um tipo diferente de demanda, com solicitantes reais da Ruby Rose.

---

## Exemplo 1: Enxoval PDV — Trade Marketing

**Solicitante:** Mirella Mota (Trade Marketing)  
**Demanda:** Enxoval PDV linha Hello Kitty  
**Resultado:** 9 briefings individuais

---

**Agente:** Olá, Mirella! O que você precisa hoje?

**Mirella:** Oi! Preciso de materiais para o PDV da Linha Hello Kitty, por favor criar 3 modelos para cada tipo de material. O KV da linha está em anexo.

**Agente:** Entendi que você precisa de um **Enxoval PDV** para a linha Hello Kitty. Correto?

**Mirella:** Isso mesmo!

**Agente:** Ótimo. Com base no catálogo padrão de materiais PDV, sua demanda gera **9 itens**:

```
1. Wobbler — Hello Kitty — Ruby Rose
2. Faixa de Gôndola — Hello Kitty — Ruby Rose
3. Régua de Gôndola — Hello Kitty — Ruby Rose
4. Display de Rolo — Hello Kitty — Ruby Rose
5. Clip Strip — Hello Kitty — Ruby Rose
6. Cubo Promocional — Hello Kitty — Ruby Rose
7. Stopper — Hello Kitty — Ruby Rose
8. Display de Balcão — Hello Kitty — Ruby Rose
9. Totem — Hello Kitty — Ruby Rose
```

Precisa adicionar ou remover algum?

**Mirella:** Perfeito, pode seguir com esses 9.

**Agente:** Ótimo! Agora vou confirmar as informações que valem para todos os 9 itens:

— A marca é **Ruby Rose** e a linha é **Hello Kitty x Ruby Rose**. Confirma?

**Mirella:** Sim.

**Agente:** — Vou criar **3 versões** de cada peça (padrão). Precisa de número diferente?

**Mirella:** Não, 3 está certo.

**Agente:** — Você anexou o KV da linha. Recebi o arquivo. ✓

— Qual o **prazo de entrega** para esses materiais?

**Mirella:** Precisa estar pronto até dia 20 de junho.

**Agente:** Entendido, prazo: **20/06/2026**.

— Esses materiais são para uma **rede ou loja específica**, ou são materiais genéricos?

**Mirella:** São genéricos, para uso em qualquer PDV.

**Agente:** Perfeito. Para as dimensões, vou usar as medidas padrão para cada tipo de material:

```
Wobbler:         15×10cm (padrão)
Faixa de Gôndola: 90×4cm (padrão)
Régua de Gôndola: padrão por tipo de gôndola
Display de Rolo:  padrão
Clip Strip:       padrão
Cubo Promocional: 30×30×30cm (padrão)
Stopper:          20×5cm (padrão)
Display de Balcão: padrão
Totem:            60×180cm (padrão)
```

Alguma peça tem dimensão diferente do padrão?

**Mirella:** Não, pode usar os padrões mesmo.

**Agente:** Você tem **faca/gabarito** para alguma das peças?

**Mirella:** Não tenho.

**Agente:** Tem algum **texto ou copy** específico para os materiais?

**Mirella:** Não, só o visual da linha mesmo.

**Agente:** Aqui está o **resumo completo** da sua demanda:

```
Tipo: Material PDV — Enxoval
Solicitante: Mirella Mota | Trade Marketing
Marca/Linha: Ruby Rose | Hello Kitty x Ruby Rose
Versões por peça: 3
KV: Anexo ✓
Prazo: 20/06/2026
Prioridade: Média

| # | Item                   | Dimensão     | Versões | Status |
|---|------------------------|--------------|---------|--------|
| 1 | Wobbler                | 15×10cm      | 3       | Pronto |
| 2 | Faixa de Gôndola       | 90×4cm       | 3       | Pronto |
| 3 | Régua de Gôndola       | padrão       | 3       | Pronto |
| 4 | Display de Rolo        | padrão       | 3       | Pronto |
| 5 | Clip Strip             | padrão       | 3       | Pronto |
| 6 | Cubo Promocional       | 30×30×30cm   | 3       | Pronto |
| 7 | Stopper                | 20×5cm       | 3       | Pronto |
| 8 | Display de Balcão      | padrão       | 3       | Pronto |
| 9 | Totem                  | 60×180cm     | 3       | Pronto |

Total: 9 briefings individuais
```

Tudo certo? Posso gerar os **9 briefings**?

**Mirella:** Pode gerar!

**Agente:** ✓ **9 briefings criados com sucesso!** Cada um entrará no fluxo de produção individualmente.

IDs gerados:
```
BRF-2026-05-20-001 — Wobbler — Hello Kitty — Ruby Rose
BRF-2026-05-20-002 — Faixa de Gôndola — Hello Kitty — Ruby Rose
BRF-2026-05-20-003 — Régua de Gôndola — Hello Kitty — Ruby Rose
BRF-2026-05-20-004 — Display de Rolo — Hello Kitty — Ruby Rose
BRF-2026-05-20-005 — Clip Strip — Hello Kitty — Ruby Rose
BRF-2026-05-20-006 — Cubo Promocional — Hello Kitty — Ruby Rose
BRF-2026-05-20-007 — Stopper — Hello Kitty — Ruby Rose
BRF-2026-05-20-008 — Display de Balcão — Hello Kitty — Ruby Rose
BRF-2026-05-20-009 — Totem — Hello Kitty — Ruby Rose
```

Todos com prazo 20/06/2026. Assim que o time de criação iniciar, você receberá atualizações por aqui. Qualquer dúvida, é só falar!

---

## Exemplo 2: Embalagem Nova — Desenvolvimento de Produto

**Solicitante:** Luana do Nascimento Bazilio (Produto)  
**Demanda:** Embalagem completa da nova linha Sobremesas Pistache  
**Resultado:** 6 briefings (um por produto da linha), todos aguardando faca

---

**Agente:** Olá, Luana! O que você precisa hoje?

**Luana:** Precisamos fazer a embalagem da nova linha Sobremesas Pistache. São produtos de corpo, ainda estamos aguardando as facas do fornecedor.

**Agente:** Entendi que você precisa de **Embalagem** para a linha Sobremesas Pistache. Correto?

**Luana:** Isso, embalagem nova para a linha toda.

**Agente:** Vou listar os itens. Você pode me passar quais são os produtos da linha?

**Luana:** São 6 produtos:
- Body Splash Pistache
- Creme de Mãos Pistache
- Esfoliante Corporal Pistache
- Hidratante Labial Pistache
- Manteiga Corporal Pistache
- Sabonete Líquido Pistache

**Agente:** Perfeito. Antes de listar os briefings, preciso entender a estrutura da embalagem. Quais **componentes** você precisa para cada produto?

**Luana:** Para cada um: Cartucho + Etiqueta de Fundo + Etiqueta Bula.

**Agente:** Entendido. Isso significa que cada produto gera **3 briefings** (um por componente). Com 6 produtos × 3 componentes = **18 briefings** no total.

Ou prefere **1 briefing por produto** contendo a lista de componentes internamente?

**Luana:** Pode fazer 1 por produto, mais fácil de acompanhar no Huggs.

**Agente:** Ótimo. Sua demanda gera **6 briefings**:

```
1. Embalagem — Body Splash Pistache — Ruby Rose
2. Embalagem — Creme de Mãos Pistache — Ruby Rose
3. Embalagem — Esfoliante Corporal Pistache — Ruby Rose
4. Embalagem — Hidratante Labial Pistache — Ruby Rose
5. Embalagem — Manteiga Corporal Pistache — Ruby Rose
6. Embalagem — Sabonete Líquido Pistache — Ruby Rose
```

Precisa adicionar ou remover algum?

**Luana:** Está certo!

**Agente:** Vou confirmar as informações compartilhadas:

— A marca é **Ruby Rose**, linha **Sobremesas Pistache**. Correto?

**Luana:** Sim.

**Agente:** — É **embalagem nova** (produto novo) para todos os 6 produtos?

**Luana:** Sim, linha nova.

**Agente:** — Você tem a **faca/gabarito** do fornecedor?

**Luana:** Ainda não, estamos aguardando chegar.

**Agente:** Entendido. Todos os 6 briefings serão criados com status **"Aguardando Faca"**. O time de criação fica ciente, mas não consegue iniciar até a faca chegar.

— Os **dados regulatórios** (Composição, INCI, QR Code) já estão aprovados?

**Luana:** Ainda não, estão em aprovação no setor regulatório.

**Agente:** Anotado. O status das Etiquetas Bula ficará também **"Aguardando Regulatório"** até chegarem.

— Qual o **prazo**?

**Luana:** Não temos prazo definido ainda, depende da faca e do regulatório.

**Agente:** ⚠️ **Atenção:** Sem prazo definido, a demanda não entra na fila de priorização automática. Vou registrar como "A definir" — você pode atualizar no Huggs assim que tiver uma data.

Deseja definir uma data estimada agora ou deixar aberto?

**Luana:** Deixa aberto por enquanto.

**Agente:** Aqui está o **resumo**:

```
Tipo: Embalagem Nova
Solicitante: Luana do Nascimento Bazilio | Produto
Marca/Linha: Ruby Rose | Sobremesas Pistache
Tipo alteração: Nova embalagem
Componentes por produto: Cartucho + Etiqueta de Fundo + Etiqueta Bula
Faca: Aguardando fornecedor
Dados regulatórios: Em aprovação
Prazo: A definir ⚠️

| # | Produto                      | SKU       | Status              |
|---|------------------------------|-----------|---------------------|
| 1 | Body Splash Pistache         | A definir | Aguardando Faca     |
| 2 | Creme de Mãos Pistache       | A definir | Aguardando Faca     |
| 3 | Esfoliante Corporal Pistache | A definir | Aguardando Faca     |
| 4 | Hidratante Labial Pistache   | A definir | Aguardando Faca     |
| 5 | Manteiga Corporal Pistache   | A definir | Aguardando Faca     |
| 6 | Sabonete Líquido Pistache    | A definir | Aguardando Faca     |
```

Posso gerar os **6 briefings**?

**Luana:** Pode gerar. Quando a faca chegar eu atualizo.

**Agente:** ✓ **6 briefings criados!** Todos com status "Aguardando Faca".

IDs gerados:
```
BRF-2026-05-20-010 — Embalagem — Body Splash Pistache — Ruby Rose
BRF-2026-05-20-011 — Embalagem — Creme de Mãos Pistache — Ruby Rose
BRF-2026-05-20-012 — Embalagem — Esfoliante Corporal Pistache — Ruby Rose
BRF-2026-05-20-013 — Embalagem — Hidratante Labial Pistache — Ruby Rose
BRF-2026-05-20-014 — Embalagem — Manteiga Corporal Pistache — Ruby Rose
BRF-2026-05-20-015 — Embalagem — Sabonete Líquido Pistache — Ruby Rose
```

Assim que a faca chegar, atualize no Huggs e o time receberá automaticamente. Qualquer coisa é só chamar!

---

## Exemplo 3: Evento — Beauty Show 2026

**Solicitante:** Paloma Baram (Marketing)  
**Demanda:** Materiais e brindes para Beauty Show 2026 — Ruby Rose e Melu  
**Resultado:** 23 briefings (10 Ruby Rose + 9 Melu + 4 Ativações)

---

**Agente:** Olá, Paloma! O que você precisa hoje?

**Paloma:** Oi! Vamos participar da Beauty Show 2026 e preciso de todos os materiais e brindes para o evento, tanto para Ruby Rose quanto para Melu.

**Agente:** Entendi! Você precisa de materiais para **Evento** — Beauty Show 2026, com as marcas Ruby Rose e Melu. Correto?

**Paloma:** Isso mesmo, e também tem umas ativações especiais que precisam de arte.

**Agente:** Ótimo. Vamos organizar por marca. Você tem a **data exata** do evento?

**Paloma:** Beauty Show 2026 é de 12 a 15 de agosto.

**Agente:** Perfeito, data registrada: **12–15/08/2026**.

Agora, vamos montar a lista de brindes. Para **Ruby Rose**, quais materiais você precisa?

**Paloma:** Para Ruby Rose: Lenço, Tote Bag, Chaveiro, Cordão Crachá, Card Crachá, Adesivo, Camiseta do uniforme, Almofada 12×12, Leque e Pulseiras.

**Agente:** São **10 itens** para Ruby Rose. Para **Melu**, quais são?

**Paloma:** Para Melu: Arte do Dardo (aquela ativação com jogo), Ticket para a ativação, Caixinha Brinde Institucional, Caixinha Brinde Baunilha, Bolsa, Lenço, Almofada, Adesivo e Pulseiras.

**Agente:** São **9 itens** para Melu. Você mencionou ativações — são as que já entram nessa lista (Dardo e Ticket Melu) ou tem outras?

**Paloma:** Tem mais: a Máquina Pega Bolinha (só Melu) e as Paredes de Fundo — uma para Ruby Rose e uma para Melu.

**Agente:** Então vou organizar assim:

**Ruby Rose (11 itens):**
```
1.  Lenço — Beauty Show 2026 — Ruby Rose
2.  Tote Bag — Beauty Show 2026 — Ruby Rose
3.  Chaveiro — Beauty Show 2026 — Ruby Rose
4.  Cordão Crachá — Beauty Show 2026 — Ruby Rose
5.  Card Crachá — Beauty Show 2026 — Ruby Rose
6.  Adesivo — Beauty Show 2026 — Ruby Rose
7.  Estampa Camiseta Uniforme — Beauty Show 2026 — Ruby Rose
8.  Almofada 12×12 — Beauty Show 2026 — Ruby Rose
9.  Leque — Beauty Show 2026 — Ruby Rose
10. Pulseiras — Beauty Show 2026 — Ruby Rose
11. Parede de Fundo — Beauty Show 2026 — Ruby Rose (ativação)
```

**Melu (11 itens):**
```
1.  Arte do Dardo — Beauty Show 2026 — Melu (ativação)
2.  Ticket Ativação — Beauty Show 2026 — Melu
3.  Caixinha Brinde Institucional — Beauty Show 2026 — Melu
4.  Caixinha Brinde Baunilha — Beauty Show 2026 — Melu
5.  Bolsa — Beauty Show 2026 — Melu
6.  Lenço — Beauty Show 2026 — Melu
7.  Almofada — Beauty Show 2026 — Melu
8.  Adesivo — Beauty Show 2026 — Melu
9.  Pulseiras — Beauty Show 2026 — Melu
10. Máquina Pega Bolinha — Beauty Show 2026 — Melu (ativação)
11. Parede de Fundo — Beauty Show 2026 — Melu (ativação)
```

**Total: 22 briefings individuais.**

Precisa adicionar ou remover algum?

**Paloma:** Perfeito! Só uma correção: a Almofada Melu é 30×30cm, não padrão. E a Almofada Ruby Rose é 12×12 mesmo.

**Agente:** Anotado! Almofada Melu: **30×30cm**. Almofada Ruby Rose: **12×12cm**.

Agora as informações compartilhadas:

— Você tem o **KV de cada marca** para usar como referência?

**Paloma:** Tenho o KV de Ruby Rose e o de Melu. Vou anexar os dois.

**Agente:** ✓ Arquivos recebidos para ambas as marcas.

— Qual o **prazo para envio** dos materiais para produção? (Normalmente 2–3 semanas antes do evento.)

**Paloma:** Precisamos enviar até dia 25 de julho.

**Agente:** Prazo de produção: **25/07/2026**.

— Você tem a **planta/layout** do stand ou fotos dos espaços?

**Paloma:** Tenho o layout do stand. Vou anexar.

**Agente:** ✓ Layout recebido. Isso vai ajudar com as dimensões das paredes de fundo.

— Para as **paredes de fundo** (Ruby Rose e Melu), você tem as dimensões exatas?

**Paloma:** A parede Ruby Rose é 3×2m e a Melu é 4×2m.

**Agente:** Perfeito. E para os outros itens que precisam de dimensão específica — o Dardo e a Máquina Pega Bolinha têm specs de produção?

**Paloma:** O Dardo é uma arte redonda de 6cm. A Máquina Pega Bolinha precisa de arte para o painel frontal, mas não tenho a medida ainda.

**Agente:** ℹ️ Arte de Ativação (Dardo Melu): 6cm redondo — anotado.

ℹ️ Máquina Pega Bolinha: vou criar o briefing com status **"Aguardando Medidas"** até você ter a especificação do fornecedor.

Aqui está o **resumo final**:

```
Tipo: Evento — Beauty Show 2026
Solicitante: Paloma Baram | Marketing
Marcas: Ruby Rose + Melu
Data do evento: 12–15/08/2026
Prazo de produção: 25/07/2026
KV: Ambas as marcas anexadas ✓
Layout do stand: Anexado ✓
Total: 22 briefings

RUBY ROSE (11 itens):
| # | Item                  | Dimensão    | Status        |
|---|-----------------------|-------------|---------------|
| 1 | Lenço                 | A definir   | Pronto        |
| 2 | Tote Bag              | A definir   | Pronto        |
| 3 | Chaveiro              | A definir   | Pronto        |
| 4 | Cordão Crachá         | A definir   | Pronto        |
| 5 | Card Crachá           | A definir   | Pronto        |
| 6 | Adesivo               | A definir   | Pronto        |
| 7 | Estampa Camiseta      | A definir   | Pronto        |
| 8 | Almofada              | 12×12cm     | Pronto        |
| 9 | Leque                 | A definir   | Pronto        |
|10 | Pulseiras             | A definir   | Pronto        |
|11 | Parede de Fundo       | 3×2m        | Pronto        |

MELU (11 itens):
| # | Item                       | Dimensão   | Status              |
|---|----------------------------|------------|---------------------|
| 1 | Arte do Dardo              | Ø 6cm      | Pronto              |
| 2 | Ticket Ativação            | A definir  | Pronto              |
| 3 | Caixinha Brinde Instit.    | A definir  | Pronto              |
| 4 | Caixinha Brinde Baunilha   | A definir  | Pronto              |
| 5 | Bolsa                      | A definir  | Pronto              |
| 6 | Lenço                      | A definir  | Pronto              |
| 7 | Almofada                   | 30×30cm    | Pronto              |
| 8 | Adesivo                    | A definir  | Pronto              |
| 9 | Pulseiras                  | A definir  | Pronto              |
|10 | Máquina Pega Bolinha       | A definir  | Aguardando Medidas  |
|11 | Parede de Fundo            | 4×2m       | Pronto              |
```

Posso gerar os **22 briefings**?

**Paloma:** Pode gerar! Assim que tiver a medida da Máquina Pega Bolinha eu atualizo.

**Agente:** ✓ **22 briefings criados!**

IDs gerados:

**Ruby Rose (BRF-2026-05-20-016 a 026):**
```
BRF-2026-05-20-016 — Lenço — Beauty Show 2026 — Ruby Rose
BRF-2026-05-20-017 — Tote Bag — Beauty Show 2026 — Ruby Rose
BRF-2026-05-20-018 — Chaveiro — Beauty Show 2026 — Ruby Rose
BRF-2026-05-20-019 — Cordão Crachá — Beauty Show 2026 — Ruby Rose
BRF-2026-05-20-020 — Card Crachá — Beauty Show 2026 — Ruby Rose
BRF-2026-05-20-021 — Adesivo — Beauty Show 2026 — Ruby Rose
BRF-2026-05-20-022 — Estampa Camiseta Uniforme — Beauty Show 2026 — Ruby Rose
BRF-2026-05-20-023 — Almofada 12×12 — Beauty Show 2026 — Ruby Rose
BRF-2026-05-20-024 — Leque — Beauty Show 2026 — Ruby Rose
BRF-2026-05-20-025 — Pulseiras — Beauty Show 2026 — Ruby Rose
BRF-2026-05-20-026 — Parede de Fundo 3×2m — Beauty Show 2026 — Ruby Rose
```

**Melu (BRF-2026-05-20-027 a 037):**
```
BRF-2026-05-20-027 — Arte do Dardo Ø6cm — Beauty Show 2026 — Melu
BRF-2026-05-20-028 — Ticket Ativação — Beauty Show 2026 — Melu
BRF-2026-05-20-029 — Caixinha Brinde Institucional — Beauty Show 2026 — Melu
BRF-2026-05-20-030 — Caixinha Brinde Baunilha — Beauty Show 2026 — Melu
BRF-2026-05-20-031 — Bolsa — Beauty Show 2026 — Melu
BRF-2026-05-20-032 — Lenço — Beauty Show 2026 — Melu
BRF-2026-05-20-033 — Almofada 30×30cm — Beauty Show 2026 — Melu
BRF-2026-05-20-034 — Adesivo — Beauty Show 2026 — Melu
BRF-2026-05-20-035 — Pulseiras — Beauty Show 2026 — Melu
BRF-2026-05-20-036 — Máquina Pega Bolinha — Beauty Show 2026 — Melu ⚠️ Aguardando Medidas
BRF-2026-05-20-037 — Parede de Fundo 4×2m — Beauty Show 2026 — Melu
```

21 briefings entram em produção imediatamente. O BRF-2026-05-20-036 (Máquina Pega Bolinha) ficará bloqueado até as medidas chegarem.

Prazo de todos: **25/07/2026**. O time já está ciente. Boa sorte na Beauty Show!
