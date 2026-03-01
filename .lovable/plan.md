

# Endurecimento de Segurança - Fase Final

## Vulnerabilidades Identificadas

### CRÍTICO

**1. `contas-receber-powerquery` — ZERO autenticação, grava dados financeiros com SERVICE_ROLE_KEY**
Qualquer pessoa pode enviar POST com dados arbitrários e inserir/atualizar registros na tabela `contas_receber`. Aceita até 50.000 registros por requisição sem nenhuma verificação de identidade.

**2. `team-form-submit` — formulário público que grava dados pessoais (CPF, RG, endereço) sem autenticação**
Embora tenha rate limiting básico, usa SERVICE_ROLE_KEY para gravar diretamente no banco. Funciona como endpoint público intencional, mas precisa de validação de origem e limites mais agressivos.

### ALTO

**3. Sete Edge Functions sensíveis com `verify_jwt = false` sem auth interna adequada**

| Função | Risco | Tipo |
|--------|-------|------|
| `contas-receber-powerquery` | Grava financeiro sem auth | CRÍTICO |
| `cobranca-automation-api` | API de cobrança | Verificar |
| `n8n-contas-receber` | Integração N8N financeira | Verificar |
| `processar-transacao-n8n` | Processa transações | Verificar |

As funções `contas-pagar-api`, `contas-receber-api`, `datawarehouse-api` já têm auth interna (JWT ou API key). `cofre-share`, `whatsapp-webhook`, `social-media-cron`, `process-photo-analysis-queue`, `publish-scheduled-posts` são legítimos (webhooks/crons/public share).

**4. Políticas RLS com `USING(true)` em tabelas sensíveis**
Detectadas em 87 arquivos de migração. Muitas são tabelas de referência (departamentos, competitors) onde `SELECT TO authenticated USING(true)` é aceitável, mas algumas tabelas financeiras e de notas fiscais ainda usam `USING(true)` para UPDATE.

### MÉDIO

**5. Extensão no schema `public`**
Recomendação do linter: mover extensões para um schema dedicado (`extensions`).

**6. `CORS Allow-Origin: *` em todas as Edge Functions**
Todas aceitam requisições de qualquer origem. Para APIs de integração (N8N, Power Query) isso é necessário, mas para funções chamadas apenas pelo frontend deveria ser restrito ao domínio da aplicação.

---

## Plano de Implementação

### Step 1: Adicionar autenticação ao `contas-receber-powerquery`
Adicionar validação de API key (N8N_API_KEY) ou JWT, mesmo padrão de `contas-pagar-api`. Bloquear requisições sem credenciais.

### Step 2: Verificar e endurecer `cobranca-automation-api`, `n8n-contas-receber`, `processar-transacao-n8n`
Ler cada função, verificar se tem auth interna. Se não tiver, adicionar validação de API key (para integrações N8N) ou JWT (para chamadas do frontend).

### Step 3: Endurecer RLS de tabelas `fabrica_notas_fiscais` e `fabrica_itens_nf`
Substituir `USING(true)` por `can_access_fabrica(auth.uid())` nas políticas de SELECT e UPDATE.

### Step 4: Adicionar denial explícito para `anon` em tabelas financeiras restantes
Migration para bloquear role `anon` em `trade_financial_entries`, `trade_budgets`, `fabrica_fornecedores`, `team_member_details`.

### Step 5: Restringir `team_member_details` — CPF/RG visível apenas para admin e o próprio usuário
Atualizar RLS para que supervisores não vejam documentos pessoais dos subordinados.

### Step 6: Mover extensões para schema dedicado
Migration para mover extensões do schema `public` para `extensions`.

---

## Impacto

| Mudança | Quebra produção? | Risco |
|---------|-----------------|-------|
| Auth no powerquery | Sim — Power Query precisa enviar API key | Baixo (basta configurar header) |
| Auth em funções N8N | Sim — N8N precisa enviar API key | Baixo (já configurado em outras) |
| RLS fabrica notas fiscais | Não — apenas restringe a quem tem módulo | Nenhum |
| Anon denial | Não — anon não deveria acessar | Nenhum |
| team_member_details | Supervisores perdem acesso a CPF/RG | Intencional |
| Extensões | Não — transparente | Nenhum |

