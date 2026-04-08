
# Criar Usuário daniel.vilanova@alltomatize.com.br — Acesso ao Portal ERP

## Problema

A rota `/dashboard/integracao-erp` usa `screenCode="admin"`, o que significa que apenas usuários com role `admin` conseguem acessar. Para dar acesso exclusivo ao Portal ERP sem conceder privilégios de admin, precisamos criar um screenCode dedicado.

## Mudanças

### 1. Migração SQL — Criar tela `integracao_erp` e o usuário

- Inserir registro na `telas_sistema` com código `integracao_erp` para o módulo `integracao_erp`
- O usuário será criado via edge function `create-admin-users` com role `vendedor` (role com menor privilégio operacional) e as permissões específicas

### 2. Rota — Trocar screenCode de `admin` para `integracao_erp`

Arquivo: `src/App.tsx` (linha 681)

```tsx
// De:
<ModuleRoute moduleCode="integracao_erp"><ScreenRoute screenCode="admin">...</ScreenRoute></ModuleRoute>

// Para:
<ModuleRoute moduleCode="integracao_erp"><ScreenRoute screenCode="integracao_erp">...</ScreenRoute></ModuleRoute>
```

### 3. Criar o usuário via edge function

Chamar `create-admin-users` com:
- email: `daniel.vilanova@alltomatize.com.br`
- nome: `Daniel Vilanova`
- role: `vendedor`
- departamento_id: TI (`a7d188c2-1b10-4644-8a40-61d436b1a954`)
- modulo_id: `4fa4420a-b23f-4fe9-a836-e8102707b168` (Integração ERP)
- tela_ids: [id da tela `integracao_erp` criada na migração]

### 4. Sidebar — Garantir visibilidade

O sidebar já verifica `hasModulePermission("integracao_erp")` — o menu Portal ERP aparecerá automaticamente. Porém, o grupo "Sistema & Integrações" pode ter uma condição de admin. Verificar e ajustar se necessário para que usuários com permissão ao módulo vejam o item.

## Resultado

- Daniel terá login com acesso **exclusivamente** ao Portal ERP
- Nenhum acesso admin — apenas módulo + tela `integracao_erp`
- Admins continuam acessando normalmente (bypass automático)

## Arquivos

| Arquivo | Ação |
|---|---|
| Migração SQL | Inserir tela `integracao_erp` em `telas_sistema` |
| `src/App.tsx` | Trocar `screenCode="admin"` → `"integracao_erp"` na rota ERP |
| `src/components/dashboard/AppSidebar.tsx` | Garantir visibilidade do menu para não-admins com permissão |
| Edge function call | Criar usuário + permissões via `create-admin-users` |
