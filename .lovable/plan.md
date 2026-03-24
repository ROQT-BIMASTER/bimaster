

# Restringir Telas AP Administrativas a Admins

## Problema

As 4 telas novas (Painel AP Central, Fila Exportação ERP, Sync Cadastros AP, Conciliação Manual AP) usam o mesmo `screenCode: "financeiro_contas_pagar"` que a tela comum de Contas a Pagar. Qualquer usuário com permissão ao módulo financeiro vê essas telas no menu e pode acessá-las.

## Solução

Criar screen codes dedicados para essas telas e protegê-las como admin-only em dois pontos:

### 1. Sidebar — Adicionar flag `requireAdmin` nos 4 itens

**Arquivo: `src/components/dashboard/AppSidebar.tsx`**

Nos itens do grupo "Contas a Pagar", adicionar `requireAdmin: true` para:
- Painel AP Central
- Fila Exportação ERP
- Sync Cadastros AP
- Conciliação Manual AP

Na lógica de filtragem de sub-itens, ocultar itens com `requireAdmin: true` quando o role do usuário não for `admin`.

### 2. Rotas — Proteger com ScreenRoute admin

**Arquivo: `src/App.tsx`**

Alterar o `screenCode` das 4 rotas de `"financeiro_contas_pagar"` para `"admin"` (ou envolver com verificação de role admin), garantindo que mesmo acessando a URL direta, não-admins sejam bloqueados.

### 3. Cadastrar telas no banco (migration)

Inserir as 4 telas na tabela `telas_sistema` com flag admin-only para consistência com o sistema de permissões.

## O que NÃO muda

- Tela "Contas a Pagar" comum continua acessível a quem tem permissão `financeiro_contas_pagar`
- Lógica de permissões de módulo e outras telas financeiras
- Funcionalidade das 4 telas em si

