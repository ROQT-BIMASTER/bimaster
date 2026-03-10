

# Módulo Fábrica China — Ordem de Compra + Rastreamento de Produção

## Fluxo Completo Atual vs Proposto

```text
ATUAL:
China envia docs → Brasil aprova/rejeita → FIM

PROPOSTO:
China envia docs → Brasil aprova → Brasil emite Ordem de Compra (OC)
→ China recebe OC → China registra produção por cor/lote
→ Brasil acompanha progresso em tempo real
→ OC concluída quando 100% produzido
```

---

## Novas Tabelas

### `china_ordens_compra`
Ordem de Compra emitida pelo Brasil após aprovação completa.

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | uuid PK | |
| numero_oc | text | Ex: OC-2026-001 (auto-gerado) |
| submissao_id | uuid FK | → china_produto_submissoes |
| produto_codigo | text | Denormalizado para facilidade |
| produto_nome | text | |
| qty_total | integer | Quantidade total da OC |
| qty_produzida | integer DEFAULT 0 | Soma dos apontamentos |
| data_emissao | date | |
| data_entrega_prevista | date | |
| data_entrega_real | date | |
| status | text | 'emitida', 'em_producao', 'parcial', 'concluida', 'cancelada' |
| observacoes | text | |
| created_by | uuid | Quem emitiu (Brasil) |
| created_at / updated_at | timestamptz | |

### `china_producao_apontamentos`
Registros de produção feitos pela China — cada apontamento = um lote produzido.

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | uuid PK | |
| ordem_compra_id | uuid FK | → china_ordens_compra |
| cor_nome | text | Cor produzida (ex: COR1) |
| quantidade | integer | Qtd produzida neste apontamento |
| lote | text | Identificação do lote |
| data_producao | date | |
| observacao | text | Observações China |
| foto_url | text | Foto comprobatória (opcional) |
| foto_path | text | Path no storage |
| created_by | uuid | Operador chinês |
| created_at | timestamptz | |

---

## Páginas e Componentes

### 1. Emissão de OC pelo Brasil (dentro de `ChinaRecebimentos.tsx`)
- Botão "Emitir Ordem de Compra 下采购单" aparece quando submissão está "aprovado"
- Dialog com: data entrega prevista, observações, confirmação de quantidade
- Número auto-gerado (OC-YYYY-NNN)

### 2. Nova página: `/dashboard/fabrica-china/ordens`
**Para China e Brasil** — Lista de Ordens de Compra com:
- Cards visuais grandes com progresso circular/barra
- Semáforo de status (emitida=azul, em_producao=amarelo, concluida=verde)
- Filtro por status
- Bilíngue PT/CN

### 3. Nova página: `/dashboard/fabrica-china/ordens/:id`
**Detalhe da OC** — Interface visual para a China registrar produção:

**Seção 1 — Resumo da OC (只读 / Somente leitura)**
- Produto, código, fórmula, quantidade total, data entrega
- Barra de progresso grande: X de Y produzidos (XX%)

**Seção 2 — Grade de Cores com progresso individual**
- Cada cor da OC exibe: nome, qtd pedida, qtd produzida, barra de progresso
- Visual de "termômetro" por cor

**Seção 3 — Registro de Produção (中国操作 / Operação China)**
- Interface simplificada: Selecionar cor → Digitar quantidade → Opcionalmente lote + foto → Botão grande "Registrar 登记"
- Cada registro aparece em timeline abaixo

**Seção 4 — Histórico de Apontamentos**
- Timeline visual com: data, cor, quantidade, lote, foto
- Brasil pode visualizar em tempo real

### 4. Landing page atualizada (`ChinaFabrica.tsx`)
- Novo card: "Ordens de Compra 采购订单" com contador de OCs ativas

---

## Componentes Novos

| Arquivo | Descrição |
|---------|-----------|
| `src/pages/ChinaOrdens.tsx` | Lista de OCs com progresso visual |
| `src/pages/ChinaOrdemDetalhe.tsx` | Detalhe da OC + apontamentos |
| `src/components/china/ChinaOrdemProgress.tsx` | Barra de progresso visual por cor |
| `src/components/china/ChinaApontamentoForm.tsx` | Formulário simplificado de registro de produção |
| `src/components/china/EmitirOCDialog.tsx` | Dialog para Brasil emitir OC |

---

## Rotas Novas

```
/dashboard/fabrica-china/ordens      → ChinaOrdens (lista)
/dashboard/fabrica-china/ordens/:id  → ChinaOrdemDetalhe (produção)
```

---

## Funcionalidades Existentes — Gaps Identificados

1. **Submissão sem validação mínima**: A China pode enviar com 0 documentos — adicionar alerta visual de "documentos obrigatórios faltando"
2. **Sem comunicação bidirecional**: Quando Brasil rejeita um documento, a China não tem como ver o motivo facilmente — adicionar seção "Feedbacks 反馈" na submissão
3. **Edge function `parse-china-excel`**: Funciona mas pode falhar silenciosamente em formatos diferentes — adicionar fallback de preenchimento manual
4. **Sem rota de detalhe da submissão**: Existe rota `/dashboard/fabrica-china/:id` registrada no App.tsx? Não. Precisamos adicionar.

---

## Sequência de Implementação

1. Migração SQL (2 tabelas + RLS + trigger updated_at)
2. `EmitirOCDialog.tsx` + integração no `ChinaRecebimentos.tsx`
3. `ChinaOrdens.tsx` (lista de OCs)
4. `ChinaOrdemDetalhe.tsx` + `ChinaApontamentoForm.tsx` + `ChinaOrdemProgress.tsx`
5. Atualizar `ChinaFabrica.tsx` (novo card de OCs)
6. Registrar rotas novas no `App.tsx`
7. Adicionar feedbacks de rejeição visíveis na submissão

