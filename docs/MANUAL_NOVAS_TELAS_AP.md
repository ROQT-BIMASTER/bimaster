# Manual Completo — Novas Telas do Módulo Contas a Pagar

---

## Índice

1. [Painel Central AP](#1-painel-central-ap)
2. [Cadastro de Título AP](#2-cadastro-de-título-ap)
3. [Fila de Exportação ERP](#3-fila-de-exportação-erp)
4. [Sincronização de Cadastros AP](#4-sincronização-de-cadastros-ap)
5. [Conciliação Manual AP](#5-conciliação-manual-ap)
6. [Relatório AP x ERP](#6-relatório-ap-x-erp)

---

## 1. Painel Central AP

**Rota:** `/dashboard/financeiro/ap-central`  
**Acesso:** Menu lateral → Financeiro → Contas → Painel AP Central

### Objetivo

Hub centralizado para gestão de todos os títulos do Contas a Pagar, com visibilidade do status ERP de cada título. Complementa a tela existente adicionando a coluna de Status ERP e ações integradas com o sistema de exportação.

### KPIs (Cards no Topo)

| Card | O que mostra | Fonte de dados |
|------|-------------|----------------|
| **Total em Aberto** | Soma dos valores de títulos com status pendente | `resumo-financeiro-api/resumo` |
| **Vencidos** | Quantidade e valor de títulos com vencimento anterior a hoje | `resumo-financeiro-api/em-aberto` |
| **Pago no Mês** | Total pago no mês corrente | `contas-pagar-api/query` (status=pago) |
| **Aguardando ERP** | Títulos na fila de exportação pendentes | `contas-pagar-export-api/status` |

### Tabela Principal

A tabela exibe todos os títulos com as seguintes colunas:

| Coluna | Descrição |
|--------|-----------|
| Fornecedor | Nome do fornecedor vinculado ao título |
| N° Título | Código de integração do lançamento |
| Categoria | Código da categoria contábil (ex: 2.04.01) |
| Departamento | Departamento responsável |
| Vencimento | Data de vencimento no formato DD/MM/AAAA |
| Valor Original | Valor do documento em R$ |
| Valor Pago | Valor já baixado em R$ |
| Status | Badge colorido: Pendente (azul), Vencido (vermelho), Pago (verde), Parcial (laranja), Cancelado (cinza) |
| Status ERP | Badge separado: Sem Exportação (cinza), Na Fila (amarelo), Exportado (azul), Confirmado ERP (verde), Erro ERP (vermelho) |
| Ações | Menu dropdown com todas as operações disponíveis |

### Filtros Disponíveis

- **Status**: Seleção múltipla (pendente, vencido, pago, pago_parcial, cancelado)
- **Vencimento de/até**: Intervalo de datas
- **Fornecedor**: Busca por texto livre
- **Categoria**: Select populado via `categorias-api/listar`
- **Departamento**: Select populado via `departamentos-api/listar`
- **Projeto**: Select populado via `projetos-api/listar`
- **Apenas importados API**: Toggle S/N para filtrar títulos vindos do ERP

### Ações por Linha

#### Ver Detalhes
Redireciona para a página de detalhes do título (`/dashboard/financeiro/contas-a-pagar/:id`), que já existe no sistema.

#### Registrar Pagamento
Abre modal com os campos:
- **Valor**: Campo monetário (R$), pré-preenchido com o saldo em aberto
- **Data do Pagamento**: Date picker, padrão = hoje
- **Método de Pagamento**: Select com opções PIX, TED, Boleto, Dinheiro, Cartão
- **Portador (Conta Corrente)**: Select populado via `contas-correntes-api/resumo`

Após salvar com sucesso, o sistema pergunta: **"Deseja marcar para exportação de baixa ao ERP?"**
- Se **Sim**: enfileira automaticamente na fila de exportação com tipo "payment"
- Se **Não**: apenas registra o pagamento internamente

#### Cancelar Título
Abre modal com campo de **motivo obrigatório** (mínimo 10 caracteres). Após confirmação:
1. Cancela o título via API
2. Enfileira automaticamente na fila de exportação ERP com tipo "cancellation"
3. Toast de confirmação

#### Estornar Pagamento
Abre modal com:
- **Motivo**: Obrigatório
- **Valor do Estorno**: Campo monetário, limitado ao valor já pago

Após confirmação, enfileira automaticamente o estorno para exportação ao ERP.

#### Ver Parcelas
Abre drawer lateral exibindo todas as parcelas do título, com data de vencimento, valor e status de cada uma.

#### Ver Histórico de Pagamentos
Abre drawer lateral com todos os pagamentos registrados, incluindo:
- Data, valor, método de pagamento
- Botão "Cancelar Pagamento" por linha (requer confirmação)

#### Enviar ao ERP
Envia manualmente o título para exportação ao ERP. Útil para títulos que foram criados sem passar pela fila automática.

#### Anexar Comprovante
Abre drawer para upload de comprovantes (PDF, imagem) vinculados ao título.

### Paginação
Controle de registros por página: 20, 50 ou 100. Exibe total de registros e páginas.

---

## 2. Cadastro de Título AP

**Rotas:**
- Novo: `/dashboard/financeiro/contas-a-pagar/novo`
- Edição: `/dashboard/financeiro/contas-a-pagar/:id/editar`

**Acesso:** Botão "Novo Título" no Painel Central AP

### Objetivo

Formulário completo para inclusão e alteração de títulos a pagar, com todos os campos aceitos pela API de integração ERP e recursos de inteligência artificial para sugestão de classificação.

### Seções do Formulário

#### Seção 1 — Identificação

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| Código ERP / Integração | Texto | Sim | Identificador único para integração com ERP externo |
| N° do Documento | Texto | Não | Número da nota fiscal ou documento de referência |

#### Seção 2 — Fornecedor e Financeiro

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| Fornecedor | Select com busca | Sim | Popula via `clientes-api/listar`. Exibe razão social, salva código numérico |
| Valor do Documento | Monetário (R$) | Sim | Valor total do título |
| Data de Vencimento | Date picker | Sim | Formato DD/MM/AAAA |
| Data de Previsão | Date picker | Sim | Data prevista para pagamento |
| Conta Corrente | Select | Sim | Popula via `contas-correntes-api/resumo`. Exibe descrição, salva código |

#### Seção 3 — Classificação

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| Categoria | Select hierárquico | Sim | Popula via `categorias-api/listar`. Formato "2.04.01 — Descrição" |
| Departamento | Select | Não | Popula via `departamentos-api/listar` |
| Projeto | Select | Não | Popula via `projetos-api/listar` |

**Recurso de IA**: Ao selecionar uma categoria, o sistema dispara em background a API `classificar-contas-pagar-ia` com os dados do título. Se a confiança da sugestão for > 85%, o campo Departamento é preenchido automaticamente com um badge **"Sugerido por IA (87%)"** ao lado. O operador pode:
- **Aceitar**: mantém a sugestão
- **Ignorar**: limpa o campo para seleção manual

#### Seção 4 — Parcelamento (Opcional)

Select de condição de parcelamento populado via `parcelas-api/listar`. Ao selecionar uma condição, exibe preview das parcelas calculadas (datas e valores).

#### Seção 5 — Complemento

| Campo | Tipo | Descrição |
|-------|------|-----------|
| Observação | Textarea | Notas livres sobre o título |
| Chave de Acesso NF-e | Texto (44 dígitos) | Se preenchido, vincula NF-e ao título após salvar |

### Fluxo Pós-Salvamento

1. Toast de confirmação com o código retornado pela API
2. Dialog perguntando: **"Deseja já enviar este título para a fila de exportação ERP?"**
   - **Sim**: Enfileira com tipo "registration" (provisão)
   - **Não**: Apenas salva internamente
3. Se NF-e informada: processamento em background via `process-nfe-xml`

### Modo Edição

Ao acessar via `/contas-a-pagar/:id/editar`:
1. Busca dados do título via `contas-pagar-api/consultar?id=:id`
2. Preenche todos os campos do formulário
3. Salva alterações via `contas-pagar-api/alterar`
4. Campos não editáveis em modo edição: Código de Integração, Fornecedor

---

## 3. Fila de Exportação ERP

**Rota:** `/dashboard/financeiro/contas-a-pagar/exportacao-erp`  
**Acesso:** Menu lateral → Financeiro → Contas → Fila Exportação ERP

### Objetivo

Visibilidade e controle total sobre o ciclo de exportação de títulos para o ERP externo. Permite confirmar, reprocessar e monitorar todas as exportações pendentes e históricas.

### KPIs (3 Cards)

| Card | Descrição | Cor |
|------|-----------|-----|
| **Aguardando Provisão** | Títulos aceitos que precisam ser registrados no ERP | Azul |
| **Aguardando Baixa** | Pagamentos realizados que precisam ser comunicados ao ERP | Laranja |
| **Com Erro** | Exportações que falharam e precisam de reprocessamento | Vermelho |

### Abas da Tabela

#### Aba 1 — Pendentes de Provisão
Títulos com `export_type: "registration"` aguardando envio ao ERP.

| Coluna | Descrição |
|--------|-----------|
| ID | Identificador truncado do registro na fila |
| Fornecedor | Nome do fornecedor |
| Valor | Valor do título em R$ |
| Tipo | "Provisão" |
| Data Criação | Quando entrou na fila |
| Status | Badge do status na fila |

#### Aba 2 — Pendentes de Baixa/Cancelamento
Pagamentos e cancelamentos com `export_type: "payment"` ou `"cancellation"`.

Mesma estrutura da Aba 1, com tipo indicando "Baixa" ou "Cancelamento".

#### Aba 3 — Histórico
Todos os registros já processados, com colunas adicionais:
- **Data Confirmação ERP**: Quando o ERP confirmou o recebimento
- **Referência ERP**: Código retornado pelo ERP externo

### Ações em Lote

| Ação | Descrição | Limite |
|------|-----------|--------|
| **Confirmar Exportação** | Marca itens selecionados como "Exportado" manualmente | Sem limite |
| **Exportar Lote** | Envia lote de títulos para o ERP via API | Até 200 itens |
| **Reprocessar Erro** | Reenvia itens com erro para nova tentativa | Por linha ou em lote |

### Reconciliação BiMaster x ERP

Botão fixo na aba Histórico que abre modal comparativo:
- Total de títulos no BiMaster
- Total exportados com sucesso
- Títulos com erro
- Taxa de sincronização (percentual)
- Lista de divergências para investigação

### Configuração de Webhook Push

Seção colapsável no rodapé da tela para configurar notificações automáticas ao ERP:

| Campo | Tipo | Descrição |
|-------|------|-----------|
| URL Destino | URL | Endpoint do ERP que receberá os webhooks |
| Eventos | Multi-checkbox | accepted, paid, cancelled |
| HMAC Secret | Texto | Chave secreta para assinatura dos webhooks |

Botão "Salvar Configuração" com toast de confirmação.

---

## 4. Sincronização de Cadastros AP

**Rota:** `/dashboard/financeiro/contas-a-pagar/sync-cadastros`  
**Acesso:** Menu lateral → Financeiro → Contas → Sync Cadastros AP

### Objetivo

Garantir que os cadastros auxiliares utilizados pelo módulo AP (fornecedores, categorias, contas correntes e condições de parcelamento) estejam sincronizados entre o BiMaster e o ERP externo. Cadastros desatualizados causam falha na exportação.

### Aba 1 — Fornecedores

**Tabela**: Lista todos os fornecedores via `clientes-api/listar`.

| Coluna | Descrição |
|--------|-----------|
| Código Huggs | Código interno do sistema |
| Código Integração | Código no ERP externo |
| Razão Social | Nome do fornecedor |
| CNPJ | Documento fiscal |
| Status | Ativo/Inativo |

**Alerta vermelho**: Linhas onde o **Código de Integração está vazio** são destacadas em vermelho com o aviso: *"Este fornecedor não possui código de integração. Títulos vinculados a ele falharão na exportação ERP."*

**Ações:**
- **Sincronizar do ERP**: Importa fornecedores do ERP via upsert em lote
- **Indicador de última sincronização**: Data/hora da última operação

### Aba 2 — Categorias

**Tabela**: Lista todas as categorias via `categorias-api/listar`.

| Coluna | Descrição |
|--------|-----------|
| Código | Código hierárquico (ex: 2.04.01) |
| Descrição | Nome da categoria |
| Tipo | Receita ou Despesa |
| Grupo | Grupo totalizador |

**Alerta**: Categorias usadas em títulos AP sem grupo totalizador são destacadas.

**Ações:**
- **Incluir Categoria**: Modal para criar nova categoria
- **Incluir Grupo**: Modal para criar novo grupo totalizador

### Aba 3 — Contas Correntes

**Tabela**: Lista contas correntes via `contas-correntes-api/`.

| Coluna | Descrição |
|--------|-----------|
| Código Integração | Código no ERP |
| Descrição | Nome da conta |
| Banco | Instituição financeira |
| Tipo | Corrente, Poupança, etc. |
| Saldo Inicial | Valor inicial cadastrado |

**Alerta**: Contas sem código de integração são destacadas.

**Ações:**
- **Sincronizar Lote**: Envia cadastros para o ERP via `contas-correntes-api/upsert-lote`

### Aba 4 — Condições de Parcelamento

**Tabela**: Lista condições via `parcelas-api/listar`.

| Coluna | Descrição |
|--------|-----------|
| Código | Identificador da condição |
| Descrição | Nome (ex: "3x sem juros") |
| N° Parcelas | Quantidade de parcelas |
| Intervalo | Dias entre parcelas |

**Ações:**
- **Nova Condição**: Modal para criar nova condição de parcelamento

---

## 5. Conciliação Manual AP

**Rota:** `/dashboard/financeiro/contas-a-pagar/conciliacao`  
**Acesso:** Menu lateral → Financeiro → Contas → Conciliação Manual

### Objetivo

Interface para conciliação manual de transações bancárias (Pluggy) com títulos do Contas a Pagar. Exibe pares sugeridos pelo sistema com confiança média, que precisam de validação humana.

### Layout

Tela dividida em dois painéis lado a lado (50% / 50%):

#### Painel Esquerdo — Transação Bancária (Pluggy)

| Campo | Descrição |
|-------|-----------|
| Data | Data da transação no extrato |
| Descrição | Texto da transação bancária |
| Valor | Valor debitado |
| Banco | Instituição financeira de origem |

#### Painel Direito — Título AP Sugerido

| Campo | Descrição |
|-------|-----------|
| Fornecedor | Nome do fornecedor do título |
| Vencimento | Data de vencimento do título |
| Valor | Valor original do título |
| Status | Status atual do título |

### Ações por Par

#### Confirmar Conciliação
1. Registra o pagamento do título com os dados da transação bancária
2. Vincula o `pluggy_transaction_id` ao título
3. Remove o par da lista
4. Toast: "Conciliação confirmada com sucesso"

#### Rejeitar Sugestão
1. Marca a sugestão como rejeitada
2. Mantém o título em aberto para conciliação futura
3. Remove o par da lista

#### Vincular a Outro Título
1. Abre busca de títulos AP com filtros de valor e fornecedor
2. Operador seleciona o título correto
3. Confirma a vinculação manual
4. Processo segue como na confirmação

### Indicadores

- **Total de pares pendentes**: Contador no topo da tela
- **Valor total pendente**: Soma dos valores das transações não conciliadas
- **Filtros**: Banco, período, faixa de valor

---

## 6. Relatório AP x ERP

**Rota:** `/configuracoes/admin/relatorio-ap-erp`  
**Acesso:** Menu lateral → Configurações → Administrador → Relatório AP x ERP  
**Permissão:** Apenas administradores

### Objetivo

Tela de diagnóstico técnico que consolida a saúde da integração entre o BiMaster e o ERP externo. Destinada à equipe de TI e administradores do sistema.

### Seção 1 — KPIs de Integração

Dados alimentados em tempo real via `contas-pagar-export-api/export-summary` e `/reconciliation`.

| KPI | Descrição | Visualização |
|-----|-----------|-------------|
| Taxa de Sincronização | Percentual de títulos sincronizados com o ERP | Barra de progresso (verde > 90%, laranja 70-90%, vermelho < 70%) |
| Total Exportados | Quantidade de títulos enviados com sucesso | Número em verde |
| Com Erro | Títulos com falha na exportação | Número em vermelho |
| Pendentes | Títulos aguardando processamento | Número em amarelo |

### Seção 2 — Status dos Endpoints

Tabela estática listando todos os endpoints do módulo AP:

| Coluna | Descrição |
|--------|-----------|
| API | Nome da Edge Function |
| Método | GET, POST, PUT, DELETE |
| Rota | Path do endpoint |
| Auth | JWT ou API Key |
| Status | Badge "Ativo" (verde) |

### Seção 3 — Fluxograma do Ciclo de Vida

Diagrama SVG inline mostrando o ciclo completo de um título:

```
Lançamento → Aprovação → Aceito → [PROVISÃO ERP] → Pagamento → [BAIXA ERP]
                                                  → Cancelamento → [ESTORNO ERP]
```

Legenda de cores:
- **Verde**: Etapa implementada e funcional
- **Laranja**: Etapa em construção
- **Cinza**: Etapa executada no ERP externo

### Seção 4 — Log de Sincronização ERP

Tabela com as últimas 50 entradas do log de sincronização:

| Coluna | Descrição |
|--------|-----------|
| Data | Timestamp do evento |
| Evento | Tipo de operação (export, confirm, error, retry) |
| Empresa | Empresa associada |
| Referência ERP | Código retornado pelo ERP |
| Status | Sucesso ou Erro |
| Payload | Dados técnicos (expandível por clique) |

---

## Glossário de Status

### Status do Título

| Status | Cor | Significado |
|--------|-----|-------------|
| Pendente | Azul (#2563EB) | Título registrado, aguardando pagamento |
| Vencido | Vermelho (#DC2626) | Vencimento ultrapassado sem pagamento |
| Pago | Verde (#16A34A) | Totalmente quitado |
| Pago Parcial | Laranja (#EA580C) | Pagamento parcial registrado |
| Cancelado | Cinza (#6B7280) | Título cancelado com justificativa |

### Status ERP

| Status | Cor | Significado |
|--------|-----|-------------|
| Sem Exportação | Cinza (#6B7280) | Título não enviado ao ERP |
| Na Fila | Amarelo | Aguardando processamento na fila de exportação |
| Exportado | Azul (#2563EB) | Enviado ao ERP, aguardando confirmação |
| Confirmado ERP | Verde (#16A34A) | ERP confirmou recebimento e processamento |
| Erro ERP | Vermelho (#DC2626) | Falha na exportação, requer reprocessamento |

---

## Fluxos Automatizados

### Após Registrar Pagamento
1. Pagamento salvo na base → toast de confirmação
2. Sistema verifica se título tem entrada na fila ERP
3. Dialog pergunta se deseja exportar baixa ao ERP
4. Se confirmado → cria entrada na fila com tipo "payment"

### Após Cancelar Título
1. Cancelamento processado → toast de confirmação
2. Sistema cria automaticamente entrada na fila ERP com tipo "cancellation"
3. ERP será notificado na próxima execução da fila

### Após Estornar Pagamento
1. Estorno processado → toast de confirmação
2. Sistema cria automaticamente entrada na fila ERP com tipo "cancellation"
3. ERP será notificado para reverter a baixa

### Sugestão de Classificação por IA
1. Operador seleciona categoria no formulário de cadastro
2. Sistema dispara `classificar-contas-pagar-ia` em background
3. Se confiança > 85%: preenche departamento com badge "Sugerido por IA"
4. Operador pode aceitar ou ignorar a sugestão

---

## Dicas de Uso

1. **Sempre verifique os alertas na tela de Sync Cadastros** antes de criar novos títulos. Cadastros sem código de integração causarão falhas na exportação.

2. **Use a Conciliação Manual** regularmente para manter os títulos em dia com o extrato bancário.

3. **Monitore a Fila de Exportação ERP** diariamente. Itens com erro devem ser reprocessados para evitar divergências com o ERP.

4. **O Relatório AP x ERP** é a primeira tela a consultar quando houver dúvidas sobre a saúde da integração.

5. **Exportação em lote** é mais eficiente: agrupe títulos similares e exporte de uma vez (limite: 200 por lote).

6. **Configure o Webhook Push** para que o ERP receba notificações automáticas, reduzindo a necessidade de reconciliação manual.
