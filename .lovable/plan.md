
# Plano — Comunicação Profissional Brasil ↔ China e Controle de Compras Internacionais

## 1. Diagnóstico das amarrações atuais (o que já existe)

| Camada | Tabela / Componente | Estado |
|---|---|---|
| Submissão de produto China→Brasil | `china_produto_submissoes` | OK |
| Vínculo Submissão ↔ Projeto Brasil | `china_submissao_projetos` + `ProjetoVincularChina.tsx` | OK |
| Documentos bilaterais | `china_produto_documentos` + `china_doc_revisoes` (aprovar/rejeitar/ciência/contestar) | OK |
| Despachos por módulo / por ficha | `china_ficha_despachos` + `DespachoFichaDialog` | OK |
| Chat operacional | `china_chat_mensagens` + `ChinaChatPanel` + FAB | OK |
| Ordem de Compra | `china_ordens_compra` (`qty_total`, `qty_produzida` agregado) | **Parcial** |
| Apontamento de produção | `china_producao_apontamentos` (por cor) | OK |
| Embarque | `china_embarques` (**1:1 com OC**) | **Limitado** |
| Recebimento físico Brasil de carga China | — | **Não existe** |
| Custo de aquisição (FOB+frete+impostos→BRL) | — | **Não existe** |
| Picker de cor de fundo (igual Projetos) | — | **Falta** |

### Problemas concretos
1. **Entrega parcial sem governança**: OC de 1.000 unidades produzindo 500 → não há `saldo_remanescente`, não há decisão (fechar parcial / manter aberta / cancelar saldo / split em nova OC).
2. **Embarque é 1:1 com OC** → impossível registrar **dois embarques** para a mesma OC (caso comum: 500 agora, 500 depois).
3. **Recebimento no Brasil é cego** ao que vem da China: o usuário não confere container × packing list, não registra divergências, não fecha o ciclo.
4. **Comunicação operacional dispersa**: aprovações vivem no painel; chat é genérico; não existe **timeline única por OC** com aprovações + apontamentos + embarques + recebimento + NCs.
5. **Sem custo de aquisição** consolidado por OC (FOB unitário + frete rateado + impostos + câmbio = custo BRL para alimentar Ficha de Custos).

---

## 2. Arquitetura proposta

### 2.1 Modelo de dados (migrações)

**A. Itens de OC (multi-SKU por OC + saldo por linha)**
```
china_ordem_itens
  id, ordem_compra_id, submissao_id (denormalizado), cor_id (china_produto_cores),
  produto_codigo, sku, qty_pedida, qty_produzida (agregado),
  qty_embarcada (agregado), qty_recebida (agregado), qty_cancelada,
  preco_unitario_usd, status (aberto|parcial|fechado|cancelado)
```
Hoje a OC é "monoproduto"; o agregado por cor vem de `china_producao_apontamentos`. Vamos elevar a entidade. Migração lê os apontamentos existentes e popula `china_ordem_itens`.

**B. Embarques N:1 com OC (vários embarques por OC)**
```
ALTER china_embarques: numero_embarque (sequencial por OC), tipo (parcial|final)
china_embarque_itens
  id, embarque_id, ordem_item_id, qty_embarcada, lote, observacao
```
Trigger: ao inserir item em embarque → atualiza `china_ordem_itens.qty_embarcada` e recomputa `status` da linha; quando todas as linhas estiverem fechadas → OC = `concluida`.

**C. Recebimento físico no Brasil**
```
china_recebimentos_carga
  id, embarque_id, ordem_compra_id, numero_di (Declaração Importação),
  data_chegada_porto, data_desembaraco, data_recebimento_cd,
  conferente_id, status (em_transito|chegou|conferindo|divergente|recebido|encerrado),
  observacoes

china_recebimento_itens
  id, recebimento_id, embarque_item_id, ordem_item_id,
  qty_esperada, qty_recebida, qty_avariada, qty_faltante,
  motivo_divergencia, foto_path
```
Trigger: ao confirmar recebimento → atualiza `qty_recebida` da linha de OC; gera **Não-Conformidade** automática se `qty_recebida != qty_esperada`.

**D. Não-Conformidades (NC) Brasil↔China**
```
china_nao_conformidades
  id, ordem_compra_id, embarque_id?, recebimento_id?, tipo (faltante|avariado|errado|atraso|outro),
  qty_envolvida, descricao, severidade (baixa|media|alta), aberto_por, status (aberta|em_tratativa|resolvida|cancelada),
  responsavel_china_id, responsavel_brasil_id, prazo, resolucao, evidencias jsonb
```
Visível dos dois lados, com chat por NC.

**E. Custo de aquisição (Landed Cost por OC)**
```
china_oc_custos
  id, ordem_compra_id, valor_fob_usd, valor_frete_usd, valor_seguro_usd,
  taxa_cambio, ii_perc, ipi_perc, icms_perc, pis_cofins_perc,
  custos_extras_brl (afretamento interno, armazenagem),
  custo_total_brl (calculado), custo_unitario_brl_por_item jsonb
```
Alimenta a Ficha de Custos (`fabrica_custos_producao`) automaticamente quando o item virar matéria-prima/produto acabado.

**F. Decisão sobre saldo (workflow)**
```
china_oc_saldo_decisoes
  id, ordem_compra_id, qty_remanescente, decisao (manter_aberta|fechar_parcial|cancelar_saldo|gerar_nova_oc),
  nova_oc_id?, justificativa, decidido_por, decidido_em
```

### 2.2 RLS
- Todas as novas tabelas: `SELECT` para china_user e brasil_user; `INSERT/UPDATE` segregado por papel via `has_role()` + função `is_china_user(uid)` já existente.
- NCs e decisões de saldo: ambos os lados leem; quem cria depende do tipo (faltante criado pelo Brasil; atraso pode ser Brasil; resolução escrita pela China).

---

## 3. Camada de UI

### 3.1 Padronização visual (igual a Projetos)
- **`ChinaBgColorPicker`** reaproveitando `ProjetoBgColorPicker` (mesma paleta, persistência em `localStorage` via `usePageBgColor`). Já temos `ChinaPageShell` consumindo `usePageBgColor`; falta o **botão picker** no `ChinaPageHeader`.
- **`KpiCard`** aplicado em todas as listagens China (Submissões, OCs, Recebimentos, Embarques).
- **Listas com barra lateral colorida por status** + `animate-fade-in` (já feito em OCs; replicar nas novas telas).
- **`EmptyState`** padrão em todas as listas vazias.
- Tabelas com **ResizablePanel** quando aplicável (mesmo padrão de Projetos).

### 3.2 Novas telas

| Rota | Tela | Quem usa |
|---|---|---|
| `/dashboard/fabrica-china/ordens/:id` (refatorada) | OC com **abas**: Visão geral · Itens & Saldo · Produção · Embarques · Recebimento · Custos · NCs · Timeline · Chat | Brasil + China |
| `/dashboard/compras-internacionais` (novo) | **Central Brasil** de OCs internacionais: lista com saldo aberto, atrasadas, em conferência, NCs abertas | Brasil |
| `/dashboard/compras-internacionais/:id/conferencia` | Tela de conferência de container (mobile-friendly: scanner de SKU, qty esperada × recebida, foto) | Brasil (CD) |
| `/dashboard/fabrica-china/ncs` | Lista de Não-Conformidades bilaterais | Brasil + China |
| `/dashboard/fabrica-china/embarques` | Lista global de embarques com status (em produção, embarcado, em trânsito, chegou, conferido) | Brasil + China |

### 3.3 Componentes novos
- `ChinaOrdemItensPanel` — tabela de itens com `qty_pedida / produzida / embarcada / recebida / saldo` por linha + ações.
- `EmbarqueParcialDialog` — selecionar itens da OC, definir qty embarcada (validação: ≤ saldo produzido).
- `SaldoOCDecisionDialog` — workflow de decisão sobre saldo remanescente.
- `RecebimentoConferenciaWizard` — passo a passo (scanner, contagem, divergências, foto, fechar).
- `NaoConformidadeDialog` + `NCThreadPanel` (chat por NC).
- `LandedCostCalculator` — calcula custo BRL por unidade com câmbio + impostos + frete rateado.
- `OCTimeline` — linha do tempo única (criada → aprovada → produção iniciada → apontamentos → embarque #1 → embarque #2 → chegou → conferida → encerrada), com chat e NCs entrelaçados.

### 3.4 Reaproveitamentos
- `ChinaPainelAprovacao` continua para documentos (já maduro).
- `ChinaChatPanel` ganha contexto: pode ser "geral", "por OC", "por NC".
- `ChinaInboxDecisoes` ganha categorias: aprovações de doc, aprovações de OC, decisões de saldo, NCs aguardando resposta.

---

## 4. Fluxo do exemplo (1.000 → 500)

1. Brasil emite OC #OC-2026-001 com 1 item × 1.000 un. Status `rascunho` → aprovada.
2. China aponta produção: 500 un.
3. China cria **Embarque parcial #1** com 500 un. (status `em_transito`).
4. Sistema mostra na OC: `qty_pedida=1000 · produzida=500 · embarcada=500 · saldo=500`.
5. Brasil recebe alerta: "OC-2026-001 com saldo de 500 un. e prazo vencendo em 7 dias". Abre `SaldoOCDecisionDialog`:
   - **Manter aberta** (China continua produzindo) → OC fica `parcial`.
   - **Fechar parcial** (aceita só 500) → fecha linha; gera NC se necessário (atraso/cancelamento).
   - **Cancelar saldo** → linha cancelada; libera China.
   - **Gerar nova OC** com as 500 restantes (split) → cria OC nova vinculada.
6. Container chega no Brasil → tela de **conferência**: esperado 500, conferiu 498 + 2 avariadas → cria **NC automática "faltante/avariado"** que aparece na inbox da China.
7. China responde a NC com proposta de reposição ou nota de crédito.
8. Sistema calcula **landed cost BRL** automaticamente e propaga para Ficha de Custos.

---

## 5. Notificações & Inbox
- Reaproveitar `inbox_notifications` (já existe) com novos tipos:
  - `oc_aguardando_aprovacao` (Brasil)
  - `oc_aprovada` (China)
  - `oc_saldo_pendente_decisao` (Brasil)
  - `embarque_criado` (Brasil)
  - `embarque_chegou_porto` (Brasil)
  - `recebimento_divergente` (China)
  - `nc_aberta` (lado oposto)
  - `nc_respondida`
- Triggers em cada tabela disparam a notificação. Centralizado no `InboxDrawer` global já existente.

---

## 6. Segurança
- Validação Zod em todos os formulários (qty > 0, ≤ saldo disponível, datas coerentes).
- RLS estrita por `has_role` + `is_china_user`.
- Auditoria: todas as mudanças em `china_ordens_compra`, `china_embarques`, `china_recebimentos_carga` registradas em `audit_log` (já existe na base).
- Edge function `secureHandler` para operações sensíveis (split de OC, fechamento de saldo, criação de NC com evidência).

---

## 7. Entregáveis por fase

### Fase 1 — Visual e fundações (rápido)
- `ChinaBgColorPicker` no `ChinaPageHeader` (paleta Projetos).
- `KpiCard`/`EmptyState`/barras laterais aplicados em telas restantes.
- Refator do detalhe de OC para layout em **abas** (Tabs) sem alterar dados.

### Fase 2 — Itens de OC + saldo
- Migração `china_ordem_itens` + backfill a partir de `china_produto_cores` × `qty_total` proporcional.
- UI `ChinaOrdemItensPanel` substituindo o `ChinaOrdemProgress` atual (mantém retrocompat).
- `SaldoOCDecisionDialog` + tabela `china_oc_saldo_decisoes`.

### Fase 3 — Embarques parciais
- Migração `china_embarque_itens` + remoção da restrição 1:1.
- `EmbarqueParcialDialog`; lista global de embarques.

### Fase 4 — Recebimento físico Brasil
- Tabelas `china_recebimentos_carga` + `china_recebimento_itens`.
- Tela `RecebimentoConferenciaWizard` (mobile-friendly).
- Triggers de NC automática.

### Fase 5 — Não-Conformidades + Timeline única
- Tabela `china_nao_conformidades` + `NaoConformidadeDialog` + `NCThreadPanel`.
- `OCTimeline` consolidada.
- Tipos de notificação novos.

### Fase 6 — Landed Cost
- Tabela `china_oc_custos` + `LandedCostCalculator`.
- Integração com `fabrica_custos_producao` para alimentar Ficha de Custos.

### Fase 7 — Central Brasil de Compras Internacionais
- Rota `/dashboard/compras-internacionais` com KPIs (OCs abertas, em produção, em trânsito, em conferência, NCs abertas, custo médio).
- Item no sidebar Brasil.

---

## 8. O que **não** muda (zero regressão)
- `china_produto_submissoes`, `china_produto_documentos`, `china_doc_revisoes`, `china_chat_mensagens`, `china_ficha_despachos`, `china_submissao_projetos`, `ProjetoVincularChina` — todos preservados.
- `ChinaPageShell` / `ChinaPageHeader` / `ChinaCommunicationFab` continuam.
- Aprovação de documentos (painel atual) intacta.
- Comunicação por chat continua disponível, agora com contexto adicional (por OC / por NC).
