

# Plano de Endurecimento de Segurança - Revisão Completa

## Vulnerabilidades Encontradas

### CRÍTICO (2)

**1. `geocode-batch` sem autenticação — modifica dados com SERVICE_ROLE_KEY**
A função aceita qualquer requisição sem verificar JWT ou API key, e usa a service role para gravar coordenadas nas tabelas `clientes` e `prospects`. Qualquer pessoa pode chamar essa função e processar dados do banco.

**2. Três buckets de storage públicos expõem documentos financeiros**
- `event-expense-docs` — recibos e comprovantes de eventos
- `department-expense-docs` — comprovantes de despesas departamentais
- `attachments` — anexos gerais

Qualquer pessoa com a URL pode acessar esses documentos sem autenticação.

---

### ALTO (1)

**3. ~20 rotas do dashboard sem proteção de módulo/tela**
Rotas protegidas apenas por `ProtectedRoute` (autenticação), mas sem verificação de permissão de módulo ou tela. Qualquer usuário autenticado pode acessar por URL direta:

| Rota | Proteção atual | Deveria ter |
|------|---------------|-------------|
| `/dashboard/auditoria` | ProtectedRoute | ScreenProtectedRoute `auditoria` (admin) |
| `/dashboard/configuracoes/api-health` | ProtectedRoute | ScreenProtectedRoute `admin` |
| `/dashboard/ai-analytics` | ProtectedRoute | ScreenProtectedRoute `ai_analytics` |
| `/dashboard/qa-agent` | ProtectedRoute | ScreenProtectedRoute `ai_analytics` |
| `/dashboard/agente-huggs` | ProtectedRoute | ScreenProtectedRoute `ai_analytics` |
| `/dashboard/marketing` e sub-rotas | ProtectedRoute | ModuleProtectedRoute `marketing` |
| `/dashboard/prospects` e sub-rotas | ProtectedRoute | ModuleProtectedRoute `prospects` |
| `/dashboard/trade` (raiz) | ProtectedRoute | ModuleProtectedRoute `trade` |
| `/dashboard/trade/stores`, `visits`, `photos`, `competitors`, `promotions`, `insights`, `calendar`, etc. | ProtectedRoute | ModuleProtectedRoute `trade` |
| `/dashboard/precos/tabelas` | ProtectedRoute | ScreenProtectedRoute `precos_tabelas` |
| `/dashboard/precos/aprovacao` | ProtectedRoute | ScreenProtectedRoute `precos_tabelas` |
| `/dashboard/precos/acesso` | ProtectedRoute | ScreenProtectedRoute `precos_tabelas` |
| `/dashboard/precos/portal-cliente` | ProtectedRoute | ModuleProtectedRoute `precos` |
| `/dashboard/ranking` | ProtectedRoute | ModuleProtectedRoute `trade` |
| `/dashboard/importar-clientes` | ProtectedRoute | ModuleProtectedRoute `comercial` |
| `/dashboard/demandas` | ProtectedRoute | OK (ferramenta interna) |
| `/dashboard/relatorios` | ProtectedRoute | ScreenProtectedRoute `relatorios` |

---

### MÉDIO (1)

**4. `admin-reset-password` aceita senhas de 6 caracteres**
O mínimo deveria ser 8 caracteres, como em `update-user-password`.

---

## Plano de Implementação

### Step 1: Adicionar JWT auth ao `geocode-batch`
Adicionar validação de JWT + verificação de role admin (mesmo padrão de `update-user-password`).

### Step 2: Privatizar 3 buckets de storage
Migration SQL para tornar `event-expense-docs`, `department-expense-docs` e `attachments` privados. Atualizar componentes que usam `getPublicUrl` nesses buckets para usar `createSignedUrl`.

### Step 3: Adicionar Module/ScreenProtectedRoute em ~20 rotas
Editar `src/App.tsx` para envolver rotas desprotegidas com os guards apropriados. Zero impacto para usuários que já têm as permissões corretas.

### Step 4: Corrigir política de senha no `admin-reset-password`
Alterar mínimo de 6 para 8 caracteres.

---

## Avaliação de Impacto

| Mudança | Quebra produção? | Risco |
|---------|-----------------|-------|
| JWT no geocode-batch | Não — função admin chamada manualmente | Nenhum |
| Buckets privados | Baixo — URLs existentes precisam migrar para signed | Baixo |
| Guards nas rotas | Não — menus já filtram por permissão, agora bloqueia URL direta | Nenhum |
| Senha mínima 8 chars | Não — apenas novos resets | Nenhum |

### Detalhes Técnicos

**Padrão de auth para geocode-batch:**
```typescript
const authHeader = req.headers.get("Authorization");
if (!authHeader?.startsWith("Bearer ")) {
  return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
}
const supabaseClient = createClient(URL, ANON_KEY, {
  global: { headers: { Authorization: authHeader } }
});
const { data, error } = await supabaseClient.auth.getClaims(token);
if (error || !data?.claims) return 401;
// Verificar role admin via service role
```

**Padrão de proteção de rota:**
```tsx
// Antes
<Route path="/dashboard/prospects" element={<ProtectedRoute><ProspectsModule /></ProtectedRoute>} />

// Depois
<Route path="/dashboard/prospects" element={
  <ProtectedRoute>
    <ModuleProtectedRoute moduleCode="prospects">
      <ProspectsModule />
    </ModuleProtectedRoute>
  </ProtectedRoute>
} />
```

**SQL para privatizar buckets:**
```sql
UPDATE storage.buckets SET public = false 
WHERE id IN ('event-expense-docs', 'department-expense-docs', 'attachments');
```

