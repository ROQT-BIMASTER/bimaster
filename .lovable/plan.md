

# IA Integrada ao Fluxo de Despesas Corporativas

## Visao Geral

Apos analisar todo o fluxo de ponta a ponta -- da criacao do evento ate o comprovante voltar para o usuario -- identifiquei **6 pontos estrategicos** onde a inteligencia artificial pode automatizar tarefas, reduzir erros e dar mais velocidade ao processo. O projeto ja possui infraestrutura de IA (Lovable AI Gateway, edge functions como `ai-insights`, `classificar-contas-pagar-ia`, agente Huggs), entao aproveitaremos esses padroes existentes.

---

## Funcionalidades de IA Propostas

### 1. Criacao Automatica de Despesa por Foto do Comprovante (OCR + IA)

**Onde atua no fluxo:** Lancamento de despesas (etapa 3)

O usuario tira uma foto de uma nota fiscal, recibo ou cupom, e a IA extrai automaticamente todos os campos:
- Fornecedor (nome e CNPJ/CPF)
- Valor total
- Data de emissao
- Tipo de documento (NF, recibo, boleto)
- Numero do documento
- Categoria sugerida (alimentacao, transporte, etc.)

O formulario de nova despesa sera preenchido automaticamente, e o usuario so precisa confirmar e ajustar se necessario.

**Impacto:** Elimina a digitacao manual e reduz erros de preenchimento em ~80%.

---

### 2. Assistente de Despesas com Chat IA (Perguntas e Respostas)

**Onde atua no fluxo:** Todas as etapas

Um chat flutuante no estilo da Sofia (ja existente no financeiro) integrado nas telas de eventos e departamentos, onde o usuario pode perguntar:
- "Quanto ja gastei no evento TNT?"
- "Quais despesas estao pendentes de aprovacao?"
- "Qual o saldo disponivel da verba?"
- "Quando sera o proximo pagamento?"
- "Me de um resumo das despesas do mes"

O assistente tera acesso ao contexto das despesas, eventos e politica financeira para responder com dados reais.

---

### 3. Resumo Inteligente para o Aprovador

**Onde atua no fluxo:** Aprovacao de despesas pelo gestor (etapa 5)

Quando o gestor abre o painel de aprovacoes, a IA gera automaticamente um resumo executivo:
- Total de despesas pendentes e valor
- Alertas de despesas fora do padrao (valor muito alto para a categoria, duplicidades suspeitas)
- Comparativo com a verba aprovada (% utilizado)
- Recomendacao de aprovacao/atencao por despesa

Isso aparecera como um card de resumo no topo da Central de Aprovacoes.

---

### 4. Deteccao de Anomalias e Duplicidades

**Onde atua no fluxo:** Lancamento e aprovacao de despesas (etapas 3 e 5)

A IA verifica automaticamente ao lancar ou aprovar despesas:
- Despesas duplicadas (mesmo fornecedor, valor e data)
- Valores fora do padrao para a categoria (ex: alimentacao com valor muito alto)
- Descricoes vagas ou inconsistentes
- Despesas que ultrapassam a verba aprovada

Alertas visuais aparecem como badges na interface, com a justificativa da IA.

---

### 5. Preenchimento Inteligente do Formulario de Envio ao Financeiro

**Onde atua no fluxo:** Envio ao financeiro (etapa 6)

Quando o usuario clica em "Enviar ao Financeiro", a IA sugere automaticamente:
- Fornecedor mais provavel (baseado na descricao e historico)
- Tipo de documento adequado
- Portador/forma de pagamento mais usado para aquele fornecedor
- Data de vencimento alinhada com a politica de pagamento configurada

O formulario `EnviarFinanceiroDialog` sera preenchido com as sugestoes, e o usuario confirma.

---

### 6. Relatorio de Fechamento com IA

**Onde atua no fluxo:** Apos o ciclo completo (pos-pagamento)

Um botao "Gerar Relatorio IA" disponivel na tela do evento, que gera automaticamente:
- Resumo executivo do evento (objetivo, periodo, verba vs. gasto)
- Tabela detalhada de todas as despesas
- Analise de aderencia ao orcamento
- Sugestoes para eventos futuros baseadas no historico
- Formato exportavel (markdown renderizado na tela)

---

## Detalhes Tecnicos

### Nova Edge Function: `expense-ai-assistant`

Uma unica edge function que recebe um `action` e despacha para a logica correta:

- `action: "extract_receipt"` -- Recebe imagem base64, envia ao modelo `gemini-2.5-flash` com tool calling para extrair campos estruturados
- `action: "chat"` -- Chat contextual com historico, busca dados do evento/departamento no banco
- `action: "approval_summary"` -- Gera resumo executivo para o aprovador
- `action: "detect_anomalies"` -- Analisa uma despesa e retorna alertas
- `action: "suggest_financial_fields"` -- Sugere preenchimento do formulario financeiro
- `action: "generate_report"` -- Gera relatorio completo do evento

Modelo utilizado: `google/gemini-2.5-flash` para tarefas rotineiras (alinhado com a politica de custos existente), `google/gemini-2.5-pro` apenas para analise de imagens OCR (que requer multimodal).

### Novo Hook: `useExpenseAI`

Hook centralizado que expoe:
- `extractFromReceipt(imageBase64)` -- Retorna campos extraidos
- `chatWithAssistant(message, context)` -- Chat contextual
- `getApprovalSummary(eventId | departmentId)` -- Resumo para aprovador
- `detectAnomalies(expenseData)` -- Alertas de anomalia
- `suggestFinancialFields(expenseId)` -- Sugestoes de preenchimento
- `generateReport(eventId)` -- Relatorio completo

### Componentes a Criar

1. **`ExpenseReceiptScanner.tsx`** -- Botao de camera/upload que chama o OCR e preenche o formulario
2. **`ExpenseAIChatFloat.tsx`** -- Chat flutuante estilo Sofia, adaptado para despesas
3. **`ApprovalAISummaryCard.tsx`** -- Card de resumo executivo no topo das aprovacoes
4. **`ExpenseAnomalyBadge.tsx`** -- Badge de alerta de anomalia em cada despesa
5. **`FinancialFieldsSuggestion.tsx`** -- Sugestoes inteligentes no formulario de envio ao financeiro
6. **`EventAIReportDialog.tsx`** -- Dialog para gerar e visualizar relatorio de IA

### Componentes a Modificar

1. **`NovaDespesaEventoDialog.tsx`** -- Adicionar botao de scanner OCR
2. **`NovaDespesaDepartamentoDialog.tsx`** -- Adicionar botao de scanner OCR
3. **`DepartmentsApprovalHub.tsx`** -- Adicionar card de resumo IA e chat flutuante
4. **`EventsApprovalHub.tsx`** -- Adicionar card de resumo IA
5. **`EnviarFinanceiroDialog.tsx`** -- Adicionar sugestoes inteligentes
6. **`AprovarDespesasEventoDialog.tsx`** -- Adicionar badge de anomalia
7. **`DespesasFocoModeDialog.tsx`** -- Adicionar badge de anomalia

### Arquivos do Backend

1. **`supabase/functions/expense-ai-assistant/index.ts`** -- Edge function unica com router por action
2. **`supabase/config.toml`** -- Adicionar entrada para a nova function

### Nenhuma Mudanca no Banco de Dados

Toda a logica de IA e transiente (nao persiste resultados). Os resumos e sugestoes sao gerados sob demanda e exibidos na interface.

---

## Resumo das Entregas

| Funcionalidade | Componente | Impacto |
|---|---|---|
| OCR de Comprovantes | ExpenseReceiptScanner | Elimina digitacao manual |
| Chat IA Contextual | ExpenseAIChatFloat | Perguntas e respostas sobre despesas |
| Resumo para Aprovador | ApprovalAISummaryCard | Decisao mais rapida e informada |
| Deteccao de Anomalias | ExpenseAnomalyBadge | Previne erros e fraudes |
| Sugestoes Financeiro | FinancialFieldsSuggestion | Preenchimento automatico |
| Relatorio de Evento | EventAIReportDialog | Fechamento automatizado |

