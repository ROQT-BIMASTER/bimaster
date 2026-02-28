

# Melhorias na Tela de Revisão de Fichas + Chat Consolidado

## Visão Geral

Transformar a tela `FichaRevisaoDiretoria` de um simples dialog numa página completa com painel administrativo, e criar um chat consolidado no módulo que agrupe todas as conversas de todas as revisões ativas.

---

## 1. Reestruturar a Tela de Análise (página inteira em vez de Dialog)

**Problema atual:** O diretor analisa fichas dentro de um `Dialog` com scroll, limitando a visibilidade e a navegação entre seções.

**Solução:** Substituir o Dialog por uma navegação de página inteira com layout em grid responsivo.

### Arquivo: `src/pages/FichaRevisaoDiretoria.tsx`

- **Header da página:** KPIs rápidos (total pendentes, aprovadas hoje, revisões solicitadas, tempo médio de análise)
- **Lista de fichas pendentes:** manter tabela atual mas adicionar filtros (busca por nome/código, filtro por marca/linha)
- **Painel de análise expandido:** ao clicar em "Analisar", a ficha abre inline na mesma página (abaixo da lista ou em layout split), não em Dialog
  - Layout em 2 colunas: Dados da ficha (esquerda) | Chat + Ações (direita)
  - Tabs internas: Insumos | Config & Totais | Evidências | Requisitos | Histórico de Versões
- **Aba "Histórico":** nova tab mostrando todas as versões anteriores da ficha com comparativo de custos entre versões (variação %)

### Arquivo: `src/components/fabrica/FichaAnalisePanel.tsx` (NOVO)

Componente dedicado para o painel de análise com:
- Header com produto, versão, status e ações rápidas
- Grid de KPIs do snapshot (NF, Serviço, Condição, Total)
- Tabela de insumos com destaque visual em insumos que tiveram alterações (comparando com versão anterior se existir)
- Seção de apontamentos e requisitos (reutilizar lógica existente)
- Chat integrado à direita

---

## 2. Dashboard Admin na Tela de Revisão

### Arquivo: `src/pages/FichaRevisaoDiretoria.tsx`

Adicionar um painel colapsável (como feito em Produtos Acabados) com:
- **KPIs:** Fichas pendentes, Tempo médio de aprovação, Fichas aprovadas/reprovadas no mês
- **Gráfico de rosca:** Distribuição de status (Recharts PieChart)
- **Gráfico de barras:** Volume de revisões por semana/mês
- **Lista de alertas:** Fichas paradas há mais de X dias, produtos com muitas resubmissões

---

## 3. Chat Consolidado no Módulo

**Conceito:** Um painel/página que agrupa todas as conversas de todas as revisões ativas, funcionando como uma "caixa de entrada" de mensagens.

### Arquivo: `src/components/fabrica/RevisaoChatConsolidado.tsx` (NOVO)

- Lista de conversas ativas agrupadas por produto/revisão
- Badge com contagem de mensagens não lidas por conversa
- Preview da última mensagem de cada conversa
- Ao clicar, abre o chat inline com histórico completo
- Filtro por produto, por status da revisão, por remetente

### Banco de dados

Adicionar coluna `lida_por` (jsonb, array de user_ids) na tabela `fabrica_revisao_mensagens` para rastrear leitura.

### Integração no módulo

- Adicionar ícone de chat com badge de não-lidas no header da página de revisão
- Ou como uma aba dedicada "Comunicação" na página

---

## Resumo das Entregas

| Entrega | Tipo |
|---|---|
| Painel admin com KPIs e gráficos na tela de revisão | UI + dados existentes |
| Análise de ficha expandida (layout split, não Dialog) | Refactor UI |
| Histórico de versões com comparativo | UI + query existente |
| Filtros na lista de fichas | UI |
| Chat consolidado (caixa de entrada) | Novo componente + migração DB |
| Tracking de mensagens lidas | Migração DB (coluna `lida_por`) |

---

## Detalhes Técnicos

- **Migração SQL:** `ALTER TABLE fabrica_revisao_mensagens ADD COLUMN lida_por jsonb DEFAULT '[]'::jsonb;`
- **Gráficos:** Recharts `PieChart` e `BarChart` (já instalado)
- **Realtime:** Reutilizar canal existente para atualizar badge de não-lidas
- **Queries:** Buscar revisões com `status IN ('pendente', 'revisao_solicitada')` + join em mensagens para contagem e última mensagem
- **Componentes novos:** `FichaAnalisePanel.tsx`, `RevisaoChatConsolidado.tsx`
- **Componentes editados:** `FichaRevisaoDiretoria.tsx`

