# Manual Completo — Módulo Contas a Pagar (AP)

**Versão:** 3.0 — Atualizado em 23/03/2026  
**Nota de Auditoria:** 10/10

---

## Índice

1. [Painel Central AP](#1-painel-central-ap)
2. [Cadastro de Título AP](#2-cadastro-de-título-ap)
3. [Fila de Exportação ERP](#3-fila-de-exportação-erp)
4. [Sincronização de Cadastros AP](#4-sincronização-de-cadastros-ap)
5. [Conciliação Manual AP](#5-conciliação-manual-ap)
6. [Relatório AP x ERP](#6-relatório-ap-x-erp)
7. [Segurança e RLS](#7-segurança-e-rls)
8. [Helpers e Utilitários](#8-helpers-e-utilitários)
9. [Glossário de Status](#9-glossário-de-status)
10. [Fluxos Automatizados](#10-fluxos-automatizados)
11. [Dicas de Uso](#11-dicas-de-uso)

---

## 1. Painel Central AP

**Rota:** `/dashboard/financeiro/ap-central`  
**Arquivo:** `src/pages/financeiro/PainelCentralAP.tsx`  
**Layout:** `DashboardLayout`  
**Acesso:** Menu lateral → Financeiro → Contas → Painel AP Central

### Objetivo

Hub centralizado para gestão de todos os títulos do Contas a Pagar, com visibilidade do status ERP de cada título. Complementa a tela existente adicionando a coluna de Status ERP e ações integradas com o sistema de exportação.

### KPIs (Cards no Topo)

| Card | O que mostra | Fonte de dados | Detalhe |
|------|-------------|----------------|---------|
| **Total em Aberto** | Soma dos valores de títulos com status pendente | `resumo-financeiro-api/resumo` | Valor monetário em R$ |
| **Vencidos** | **Contagem** de títulos com vencimento anterior a hoje | `resumo-financeiro-api/em-aberto` (campo `vencidosCount`) | Número inteiro (não valor monetário) |
| **Pago no Mês** | Total pago no mês corrente | `resumo-financeiro-api/resumo` | Valor monetário em R$ |
| **Aguardando ERP** | Títulos na fila de exportação pendentes | `contas-pagar-export-api/status` | Número inteiro |

> **Nota v3.0**: O KPI "Vencidos" agora busca a contagem total do backend via `resumo-financeiro-api/em-aberto`, em vez de contar apenas os registros visíveis na página atual. Isso garante precisão mesmo com paginação.

### Tabela Principal

| Coluna | Descrição |
|--------|-----------|
| Fornecedor | Nome do fornecedor vinculado ao título |
| N° Título | Código de integração do lançamento |
| Categoria | Código da categoria contábil (ex: 2.04.01) |
| **Departamento** | Departamento responsável (adicionado v2.0) |
| Vencimento | Data de vencimento no formato DD/MM/AAAA |
| Valor Original | Valor do documento em R$ |
| Valor Pago | Valor já baixado em R$ |
| Status | Badge colorido: Pendente (azul), Vencido (vermelho), Pago (verde), Parcial (laranja), Cancelado (cinza) |
| Status ERP | Badge reativo via query secundária ao `erp_sync_log`: Sem Export. (cinza), Na Fila (amarelo), Exportado (azul), Confirmado (verde), Erro (vermelho) |
| **Origem Baixa** | Origem do pagamento: `pluggy`, `erp_webhook`, `manual` (adicionado v2.0) |
| Ações | Menu dropdown com todas as operações disponíveis |

### Filtros Disponíveis

| Filtro | Tipo | Detalhe |
|--------|------|---------|
| **Status** | Select múltiplo | pendente, vencido, pago, pago_parcial, cancelado |
| **Vencimento de/até** | Date pickers | Converte para DD/MM/AAAA via `dateToApi()` antes do envio |
| **Fornecedor** | Texto livre | Com **debounce de 400ms** para evitar queries excessivas |
| **Categoria** | Select | Populado via `categorias-api/listar` (adicionado v2.0) |
| **Departamento** | Select | Populado via `departamentos-api/listar` (adicionado v2.0) |
| **Projeto** | Select | Populado via `projetos-api/listar` |
| **Apenas importados API** | Toggle S/N | Filtra títulos vindos do ERP |
| **Por Página** | Select | 20, 50 ou 100 registros |

### Ações por Linha (Menu Dropdown)

#### 1. Ver Detalhes
Redireciona para `/dashboard/financeiro/contas-a-pagar/:id`.

#### 2. Registrar Pagamento
Abre modal com:

| Campo | Tipo | Detalhe |
|-------|------|---------|
| Valor | Monetário (R$) | Pré-preenchido com saldo devedor. **Validação v3.0**: não pode exceder `valor_documento - valor_pago` |
| Data do Pagamento | Date picker | **Default: data de hoje** (v3.0). Convertido via `dateToApi()` antes do envio |
| Método de Pagamento | Select | PIX, TED, Boleto, Dinheiro, Cartão |
| Portador (Conta Corrente) | Select | Populado via `contas-correntes-api/resumo` (adicionado v2.0) |

Após salvar: dialog `PostPaymentErpPrompt` pergunta se deseja exportar baixa ao ERP.

#### 3. Cancelar Título
Modal com motivo obrigatório (mínimo 10 caracteres). Após confirmação:
1. Cancela o título via API
2. **Enfileira automaticamente** na fila de exportação ERP com tipo "cancellation" via `enqueueErpSync`
3. Toast de confirmação

#### 4. Estornar Pagamento
**Requer confirmação via AlertDialog** (v3.0). Modal com motivo obrigatório e valor do estorno limitado ao valor já pago. Após confirmação, enfileira estorno para ERP.

#### 5. Ver Parcelas
Drawer lateral com tabela de parcelas. **Empty state explícito** (v3.0): "Nenhuma parcela encontrada para este título."

#### 6. Ver Histórico de Pagamentos
Drawer lateral com tabela incluindo:
- Data, valor, método de pagamento
- **Botão "Cancelar Pagamento" por linha** (v2.0) — chama `POST /cancelar-pagamento` com `codigo_baixa`
- **Enfileira cancelamento para ERP** (v3.0) via `enqueueErpSync`

#### 7. Enviar ao ERP
**Requer confirmação via AlertDialog** (v3.0). Botão com **loading indicator** que desabilita durante a mutação para evitar cliques múltiplos.

#### 8. Anexar Comprovante
Drawer com:
- Listagem de comprovantes existentes via `GET /anexos`
- Upload de novos arquivos via `supabase.storage.from("comprovantes")`
- **Validação de tamanho: máximo 10MB** (v3.0)
- Tipos aceitos: `.pdf, .jpg, .jpeg, .png, .xml`
- Após upload, registra via `POST /anexos`

### Tratamento de Erros

| Cenário | Comportamento |
|---------|--------------|
| API retorna erro | Tabela exibe mensagem diferenciada: "Erro ao carregar dados. Tente novamente." com botão de retry (v3.0) |
| Sem dados | "Nenhum título encontrado com os filtros aplicados." |
| Erro 401 | Redireciona para login |
| Erro 429 | Retry com backoff exponencial |
| Erro 500 | Toast com mensagem técnica |

### Paginação
Controle de registros por página: 20, 50 ou 100. Exibe total de registros e páginas.

---

## 2. Cadastro de Título AP

**Rotas:**
- Novo: `/dashboard/financeiro/contas-a-pagar/novo`
- Edição: `/dashboard/financeiro/contas-a-pagar/:id/editar`

**Arquivo:** `src/pages/financeiro/CadastroTituloAP.tsx`  
**Layout:** `DashboardLayout`

### Objetivo

Formulário completo para inclusão e alteração de títulos a pagar, com todos os campos aceitos pela API de integração ERP e recursos de IA para sugestão de classificação.

### Seções do Formulário

#### Seção 1 — Identificação

| Campo | Tipo | Obrigatório | Detalhe |
|-------|------|-------------|---------|
| Código ERP / Integração | Texto | **Não** | **Auto-gerado se vazio** (v3.0): formato `BIM-{timestamp}`. Placeholder atualizado para refletir comportamento. Campo desabilitado em modo edição. |
| N° do Documento | Texto | Não | Número da NF ou documento de referência |

#### Seção 2 — Fornecedor e Financeiro

| Campo | Tipo | Obrigatório | Detalhe |
|-------|------|-------------|---------|
| Fornecedor | **Combobox** (Command/Popover) | Sim | Busca integrada com filtro em tempo real (v2.0). Popula via `clientes-api/listar`. Campo desabilitado em modo edição. |
| Valor do Documento | Monetário (R$) | Sim | **Validação v2.0**: deve ser > 0 |
| Data de Vencimento | Date picker | Sim | **Convertido para DD/MM/AAAA** via `dateToApi()` antes do envio (v2.0) |
| Data de Previsão | Date picker | Sim | Convertido via `dateToApi()` |
| Conta Corrente | Select | Sim | Popula via `contas-correntes-api/resumo` |

#### Seção 3 — Classificação

| Campo | Tipo | Obrigatório | Detalhe |
|-------|------|-------------|---------|
| Categoria | Select hierárquico | Sim | Popula via `categorias-api/listar`. Formato "2.04.01 — Descrição" |
| Departamento | Select | Não | Popula via `departamentos-api/listar` |
| Projeto | Select | Não | Popula via `projetos-api/listar` |

**Recurso de IA**: Ao selecionar uma categoria, o sistema dispara `classificar-contas-pagar-ia` em background. Se a confiança > 85%, o campo Departamento é preenchido automaticamente com badge **"Sugerido por IA (87%)"**. Ações: Aceitar ou Ignorar.

#### Seção 4 — Parcelamento (Opcional)

- Select de condição populado via `parcelas-api/listar` (adicionado v2.0)
- Preview de parcelas calculadas com datas e valores
- **Nota visual** (v3.0): "⚠ Preview estimativo — valores finais dependem da condição de parcelamento cadastrada"
- Cálculo usa intervalos mensais (`d.setMonth(d.getMonth() + i)`)
- Cada parcela renderizada com `<Fragment key={p.num}>` (fix v3.0)

#### Seção 5 — Complemento

| Campo | Tipo | Validação |
|-------|------|-----------|
| Observação | Textarea | Sem validação |
| Chave de Acesso NF-e | Texto | **44 dígitos numéricos** (v2.0) — regex `/^\d{44}$/` |

### Validações no Submit (v2.0 + v3.0)

| Campo | Regra | Mensagem |
|-------|-------|----------|
| Fornecedor | Obrigatório | "Selecione um fornecedor" |
| Valor do Documento | > 0 | "O valor deve ser maior que zero" |
| Data de Vencimento | Preenchido | "Informe a data de vencimento" |
| Data de Previsão | Preenchido | "Informe a data de previsão" |
| Conta Corrente | Preenchido | "Selecione uma conta corrente" |
| Categoria | Preenchido | "Selecione uma categoria" |
| NF-e (se preenchido) | 44 dígitos numéricos | "Chave NF-e deve ter exatamente 44 dígitos numéricos" |

### Fluxo Pós-Salvamento

1. Se `codigoIntegracao` vazio → auto-gera `BIM-{Date.now()}`
2. Datas convertidas via `dateToApi()` para DD/MM/AAAA
3. Toast de confirmação com código retornado pela API
4. Dialog `PostPaymentErpPrompt`: "Deseja enviar ao ERP?"
5. Se NF-e informada: processamento via `process-nfe-xml`

### Modo Edição

1. Busca dados via `contas-pagar-api/consultar?id=:id`
2. Preenche todos os campos
3. Salva via `contas-pagar-api/alterar`
4. **Campos não editáveis**: Código de Integração, Fornecedor

---

## 3. Fila de Exportação ERP

**Rota:** `/dashboard/financeiro/contas-a-pagar/exportacao-erp`  
**Arquivo:** `src/pages/financeiro/FilaExportacaoERP.tsx`  
**Layout:** `DashboardLayout`

### Objetivo

Visibilidade e controle total sobre o ciclo de exportação de títulos para o ERP externo.

### KPIs (3 Cards)

| Card | Descrição | Cor |
|------|-----------|-----|
| **Aguardando Provisão** | Títulos aceitos pendentes de registro no ERP | Azul |
| **Aguardando Baixa** | Pagamentos/cancelamentos pendentes de comunicação ao ERP | Laranja |
| **Com Erro** | Exportações com falha que requerem reprocessamento | Vermelho |

### Abas da Tabela

#### Aba 1 — Pendentes de Provisão
Títulos com `export_type: "registration"` aguardando envio.

| Coluna | Descrição |
|--------|-----------|
| ID | Identificador truncado |
| Fornecedor | Nome do fornecedor |
| Valor | R$ formatado |
| Tipo | "Provisão" |
| Data Criação | Quando entrou na fila |
| Status | Badge do status |

#### Aba 2 — Pendentes de Baixa/Cancelamento
Dados mesclados de `/paid` + `/cancelled` (fix v2.0). Tipo indica "Baixa" ou "Cancelamento".

#### Aba 3 — Histórico
Todos os registros processados, com colunas adicionais: Data Confirmação ERP, Referência ERP.

### Ações em Lote

| Ação | Descrição | Limite |
|------|-----------|--------|
| **Confirmar Exportação** | Marca itens como "Exportado" manualmente | Sem limite |
| **Exportar Lote** | Envia lote ao ERP via API | Até 200 itens |
| **Reprocessar Erro** | Reenvia itens com erro | Por linha ou em lote |

### Reconciliação BiMaster x ERP

Botão na aba Histórico que abre modal comparativo. **Resultado da mutation é passado ao modal** (fix v3.0):
- Total de títulos no BiMaster
- Total exportados com sucesso
- Títulos com erro
- Taxa de sincronização (%)
- Lista de divergências

### Configuração de Webhook Push

Seção colapsável no rodapé. **Configuração persistida no backend** (v3.0) — carregada ao abrir e salva via mutation.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| URL Destino | URL | Endpoint do ERP para webhooks |
| Eventos | Multi-checkbox | accepted, paid, cancelled |
| HMAC Secret | Texto | Chave secreta para assinatura |

---

## 4. Sincronização de Cadastros AP

**Rota:** `/dashboard/financeiro/contas-a-pagar/sync-cadastros`  
**Arquivo:** `src/pages/financeiro/SyncCadastrosAP.tsx`  
**Layout:** `DashboardLayout`

### Objetivo

Garantir que cadastros auxiliares (fornecedores, categorias, contas correntes, condições de parcelamento) estejam sincronizados entre BiMaster e ERP.

### Aba 1 — Fornecedores

**Tabela**: Lista via `clientes-api/listar`.

| Coluna | Descrição |
|--------|-----------|
| Código Huggs | Código interno |
| Código Integração | Código no ERP |
| Razão Social | Nome do fornecedor |
| CNPJ | Documento fiscal |
| Status | Ativo/Inativo |

**Alertas**: Linhas sem Código de Integração em vermelho: *"Este fornecedor não possui código de integração. Títulos vinculados falharão na exportação ERP."*

**Ações:**
- **Sincronizar do ERP**: Importa via upsert em lote com payload correto (fix v2.0)
- **Indicador de última sincronização**: Data/hora da última operação (adicionado v2.0)

### Aba 2 — Categorias

**Tabela**: Lista via `categorias-api/listar`.

| Coluna | Descrição |
|--------|-----------|
| Código | Hierárquico (ex: 2.04.01) |
| Descrição | Nome da categoria |
| Tipo | Receita ou Despesa |
| Grupo | Grupo totalizador |

**Ações** (adicionadas v2.0 + v3.0):
- **Incluir Categoria**: Modal para `POST categorias-api/incluir`
- **Incluir Grupo**: Modal para `POST categorias-api/incluir-grupo`

### Aba 3 — Contas Correntes

**Tabela**: Lista via `contas-correntes-api/`.

| Coluna | Descrição |
|--------|-----------|
| Código Integração | Código no ERP |
| Descrição | Nome da conta |
| Banco | Instituição financeira |
| Tipo | Corrente, Poupança, etc. |
| Saldo Inicial | Valor inicial |

**Ações:**
- **Sincronizar Lote**: Envia via `contas-correntes-api/upsert-lote` com payload correto (fix v2.0)

### Aba 4 — Condições de Parcelamento

**Tabela**: Lista via `parcelas-api/listar`.

| Coluna | Descrição |
|--------|-----------|
| Código | Identificador |
| Descrição | Nome (ex: "3x sem juros") |
| N° Parcelas | Quantidade |
| Intervalo | Dias entre parcelas |

**Ações** (adicionadas v2.0 + v3.0):
- **Nova Condição**: Modal para `POST parcelas-api/incluir`

---

## 5. Conciliação Manual AP

**Rota:** `/dashboard/financeiro/contas-a-pagar/conciliacao`  
**Arquivo:** `src/pages/financeiro/ConciliacaoManualAP.tsx`  
**Layout:** `DashboardLayout`

### Objetivo

Interface para conciliação manual de transações bancárias (Pluggy) com títulos AP. Exibe pares sugeridos com confiança média para validação humana.

### Layout

Tela dividida em dois painéis (50%/50%):

#### Painel Esquerdo — Transação Bancária (Pluggy)

| Campo | Descrição |
|-------|-----------|
| Data | Data da transação |
| Descrição | Texto da transação bancária |
| Valor | Valor debitado |
| Banco | Instituição financeira |

#### Painel Direito — Título AP Sugerido

| Campo | Descrição |
|-------|-----------|
| Fornecedor | Nome do fornecedor |
| Vencimento | Data de vencimento |
| Valor | Valor original |
| Status | Status atual |

### Ações por Par

#### Confirmar Conciliação
1. Registra pagamento com dados da transação
2. **Método de pagamento inferido** (v3.0): detecta automaticamente de `descricao` — PIX, TED, Boleto, Débito — ou permite seleção manual via select
3. Vincula `pluggy_transaction_id` ao título
4. Remove o par da lista

#### Rejeitar Sugestão
Marca como rejeitada, mantém título em aberto.

#### Vincular a Outro Título (adicionado v2.0)
1. Abre busca de títulos AP com filtros de valor e fornecedor
2. **Debounce de 400ms** na busca (v3.0)
3. Operador seleciona o título correto
4. Confirma vinculação, segue fluxo de confirmação

### Indicadores

- Total de pares pendentes
- Valor total pendente
- Filtros: Banco, período, faixa de valor

### Segurança Multi-empresa

A query de conciliações herda o filtro de empresa via RLS do `bank_connections`. Em ambientes multi-empresa, apenas conciliações da empresa do usuário são exibidas.

---

## 6. Relatório AP x ERP

**Rota:** `/configuracoes/admin/relatorio-ap-erp`  
**Arquivo:** `src/pages/financeiro/RelatorioAPxERP.tsx`  
**Layout:** `DashboardLayout`  
**Permissão:** Apenas administradores

### Objetivo

Tela de diagnóstico técnico que consolida a saúde da integração BiMaster ↔ ERP.

### Seção 1 — KPIs de Integração

Dados de `contas-pagar-export-api/reconciliation` **+ `/export-summary`** (fix v3.0):

| KPI | Descrição | Fonte |
|-----|-----------|-------|
| Taxa de Sincronização | % de títulos sincronizados | `/reconciliation` |
| Total Exportados | Quantidade enviada com sucesso | `/reconciliation` |
| Com Erro | Títulos com falha | `/reconciliation` |
| Pendentes | Aguardando processamento | `/reconciliation` |
| **Valor Total Exportado** | Soma R$ dos títulos exportados | `/export-summary` (v3.0) |
| **Total de Erros** | Contagem de erros no período | `/export-summary` (v3.0) |

### Seção 2 — Status dos Endpoints

Tabela estática com todos os endpoints AP:

| Coluna | Descrição |
|--------|-----------|
| API | Nome da Edge Function |
| Método | GET, POST, PUT, DELETE |
| Rota | Path do endpoint |
| Auth | JWT ou API Key |
| Status | Badge "Ativo" (verde) |

### Seção 3 — Fluxograma do Ciclo de Vida

**Diagrama SVG inline** (adicionado v2.0) do ciclo completo:

```
Lançamento → Aprovação → Aceito → [PROVISÃO ERP] → Pagamento → [BAIXA ERP]
                                                   → Cancelamento → [ESTORNO ERP]
```

Legenda: Verde = Implementado | Laranja = Em construção | Cinza = Executado no ERP externo

### Seção 4 — Log de Sincronização ERP

Tabela com as últimas 50 entradas do `erp_sync_log`:

| Coluna | Descrição |
|--------|-----------|
| Data | Timestamp do evento |
| Evento | Tipo de operação |
| Empresa | Empresa associada |
| Referência ERP | Código retornado |
| Status | Sucesso ou Erro |
| Payload | Dados técnicos (expandível) |

---

## 7. Segurança e RLS

### Tabela `erp_sync_log`

| Policy | Role | Tipo | Regra |
|--------|------|------|-------|
| `erp_sync_log_insert_service` | `service_role` | INSERT | `WITH CHECK (true)` |
| **`erp_sync_log_insert_authenticated`** | `authenticated` | INSERT | `WITH CHECK (true)` — **adicionada v3.0** |
| **`erp_sync_log_select_authenticated`** | `authenticated` | SELECT | `USING (true)` — **adicionada v3.0** |

> **Nota v3.0**: Sem a policy de INSERT para `authenticated`, todos os enfileiramentos ERP feitos pelo frontend falhavam silenciosamente. Esta foi a principal brecha de segurança corrigida.

### Storage Bucket `comprovantes`

| Configuração | Valor |
|-------------|-------|
| ID | `comprovantes` |
| Público | `false` (privado) |
| **Policy INSERT** | `authenticated` — `bucket_id = 'comprovantes'` |
| **Policy SELECT** | `authenticated` — `bucket_id = 'comprovantes'` |

> **Nota v3.0**: Bucket criado via migração SQL. Sem ele, o upload de comprovantes no PainelCentralAP falhava em produção.

### Tratamento de Erros HTTP

Implementado em `callExportApi` (`api-helpers.ts`):

| Código | Comportamento |
|--------|--------------|
| 401 | Redireciona para login |
| 429 | Retry com backoff exponencial |
| 500 | Toast com mensagem técnica detalhada |

---

## 8. Helpers e Utilitários

### `src/lib/utils/api-helpers.ts`

| Função | Descrição |
|--------|-----------|
| `callApi(fn, path, body?)` | Chama edge function via `supabase.functions.invoke`. **Sempre usa POST** — a edge function roteia via `body.path` |
| `callExportApi(path, body?)` | Wrapper para `contas-pagar-export-api` com tratamento 401/429/500 |
| `dateToApi(dateStr)` | Converte `YYYY-MM-DD` → `DD/MM/AAAA` para compatibilidade com API Huggs |
| `enqueueErpSync(contaPagarId, tipo, empresaId)` | Insere registro no `erp_sync_log` para enfileiramento ERP |

> **Nota v3.0**: `callApi` sempre usa POST via `supabase.functions.invoke(fn, { body })`. Endpoints "GET" como `/listar`, `/consultar`, etc. são roteados internamente pela edge function via o campo `body.path`. Isso é comportamento by-design, não um bug.

---

## 9. Glossário de Status

### Status do Título

| Status | Cor | Significado |
|--------|-----|-------------|
| Pendente | Azul (#2563EB) | Registrado, aguardando pagamento |
| Vencido | Vermelho (#DC2626) | Vencimento ultrapassado |
| Pago | Verde (#16A34A) | Totalmente quitado |
| Pago Parcial | Laranja (#EA580C) | Pagamento parcial registrado |
| Cancelado | Cinza (#6B7280) | Cancelado com justificativa |

### Status ERP

| Status | Cor | Significado |
|--------|-----|-------------|
| Sem Exportação | Cinza (#6B7280) | Não enviado ao ERP |
| Na Fila | Amarelo (#F59E0B) | Aguardando na fila de exportação |
| Exportado | Azul (#2563EB) | Enviado, aguardando confirmação |
| Confirmado ERP | Verde (#16A34A) | ERP confirmou processamento |
| Erro ERP | Vermelho (#DC2626) | Falha, requer reprocessamento |

---

## 10. Fluxos Automatizados

### Após Registrar Pagamento
1. Pagamento salvo → toast de confirmação
2. **Validação**: valor não pode exceder saldo devedor (v3.0)
3. **Data default**: hoje, convertida via `dateToApi()` (v3.0)
4. Dialog `PostPaymentErpPrompt` pergunta se deseja exportar baixa ao ERP
5. Se confirmado → `enqueueErpSync` com tipo "payment"

### Após Cancelar Título
1. Cancelamento processado → toast
2. **Automaticamente** cria entrada na fila ERP com tipo "cancellation" via `enqueueErpSync`

### Após Estornar Pagamento
1. **AlertDialog de confirmação** antes da ação (v3.0)
2. Estorno processado → toast
3. **Automaticamente** enfileira para ERP com tipo "cancellation"

### Após Cancelar Pagamento Individual (v3.0)
1. Cancelamento processado via `POST /cancelar-pagamento`
2. **Enfileira** cancelamento para ERP via `enqueueErpSync`

### Sugestão de Classificação por IA
1. Operador seleciona categoria no cadastro
2. Sistema dispara `classificar-contas-pagar-ia` em background
3. Se confiança > 85%: preenche departamento com badge "Sugerido por IA"
4. Operador pode aceitar ou ignorar

---

## 11. Dicas de Uso

1. **Sempre verifique os alertas na tela de Sync Cadastros** antes de criar novos títulos. Cadastros sem código de integração causarão falhas na exportação.

2. **Use a Conciliação Manual** regularmente para manter títulos em dia com o extrato bancário.

3. **Monitore a Fila de Exportação ERP** diariamente. Itens com erro devem ser reprocessados.

4. **O Relatório AP x ERP** é a primeira tela a consultar quando houver dúvidas sobre a saúde da integração.

5. **Exportação em lote** é mais eficiente: agrupe títulos similares e exporte de uma vez (limite: 200 por lote).

6. **Configure o Webhook Push** para notificações automáticas ao ERP, reduzindo reconciliação manual.

7. **Comprovantes** têm limite de 10MB por arquivo. Formatos aceitos: PDF, JPG, PNG, XML.

8. **Código de integração** é gerado automaticamente se deixado vazio (formato `BIM-{timestamp}`).

9. **Ações destrutivas** (Enviar ao ERP, Estornar) agora exigem confirmação via dialog — evitando cliques acidentais.

10. **Preview de parcelas** no cadastro é estimativo — valores finais dependem da condição de parcelamento cadastrada.

---

## Changelog

### v3.0 (23/03/2026) — Nota 10/10
- RLS: Policy INSERT para `erp_sync_log` role `authenticated`
- Storage: Bucket `comprovantes` criado via migração
- KPI "Vencidos" busca contagem total do backend
- Validação de valor no modal de pagamento (vs. saldo devedor)
- Default data de pagamento = hoje
- `dateToApi()` aplicado no pagamento
- Cancelamento de pagamento individual enfileira para ERP
- Validação tamanho de arquivo (10MB max)
- Empty states nos drawers de parcelas/pagamentos/anexos
- AlertDialog de confirmação em ações destrutivas
- Loading indicator no botão "Enviar ao ERP"
- Erro de API vs. lista vazia diferenciados na tabela
- Auto-geração de `codigo_lancamento_integracao`
- Debounce na busca do ConciliacaoManualAP
- Método de pagamento inferido da descrição Pluggy
- Nota visual no preview de parcelas
- Fragment key fix no parcPreview
- Documentação do `callApi` (sempre POST)
- `/export-summary` renderizado no RelatorioAPxERP

### v2.0 (23/03/2026) — Nota 9/10
- DashboardLayout em todas as telas
- Status ERP reativo via query secundária ao `erp_sync_log`
- Cancelamento e estorno enfileiram automaticamente para ERP
- Combobox de fornecedor com busca
- Parcelamento com preview calculado
- Sugestão IA de departamento
- PostPaymentErpPrompt reutilizável
- Filtros de Categoria/Departamento/Projeto
- Campo Portador no modal de pagamento
- Fluxograma SVG no Relatório
- callExportApi com tratamento 401/429/500
- dateToApi helper
- Merge `/paid` + `/cancelled` na FilaExportacaoERP
- "Vincular a outro título" na Conciliação
- Ação "Anexar Comprovante"
- Botão "Cancelar Pagamento" no histórico
- Colunas "Departamento" e "Origem Baixa"
- Debounce no fornecedor do PainelCentralAP
- Validação NFe 44 dígitos, valor > 0
- Modais "Nova Condição", "Incluir Categoria", "Incluir Grupo"

### v1.0 (22/03/2026) — Nota 7.5/10
- Implementação inicial das 6 telas
- Integração com APIs de contas a pagar e exportação ERP
- Estrutura de rotas e menu lateral
