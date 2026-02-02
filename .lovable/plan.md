
# Plano: Restringir Módulo Administrativo de Trade à Milene

## Objetivo
Configurar o sistema para que apenas a funcionária **Milene Harumi** tenha acesso ao módulo Administrativo do Trade Marketing (`/dashboard/trade/admin`).

---

## Situação Atual

### Usuária Identificada:
| Nome | Email | ID | Role |
|------|-------|-----|------|
| Milene Harumi | m.harumi@rubyrose.com.br | `7eb17733-d824-4758-8ddf-7b9606ef4991` | supervisor |

### Problema Identificado:
- O código da tela `trade_admin` **não existe** na tabela `telas_sistema`
- O componente `TradeAdminModule.tsx` verifica `trade_marketing` (permissão de módulo) ao invés de `trade_admin` (permissão de tela específica)
- Isso faz com que qualquer pessoa com acesso ao módulo Trade também veja o Administrativo

---

## Alterações Propostas

### 1. Banco de Dados

**Criar a tela `trade_admin`:**
```sql
INSERT INTO telas_sistema (codigo, nome, descricao, modulo_codigo, rota, icone, ordem)
VALUES ('trade_admin', 'Administrativo Trade', 'Módulo administrativo do Trade Marketing', 'trade', '/dashboard/trade/admin', 'Settings', 0);
```

**Atribuir permissão exclusiva para Milene:**
```sql
INSERT INTO usuario_permissoes_telas (usuario_id, tela_id)
SELECT '7eb17733-d824-4758-8ddf-7b9606ef4991', id 
FROM telas_sistema WHERE codigo = 'trade_admin';
```

---

### 2. Código Frontend

**Arquivo: `src/pages/modules/TradeAdminModule.tsx`**

Alterar a verificação de permissão de `trade_marketing` para `trade_admin`:

```tsx
// De:
if (!permissionsLoading && !hasPermission("trade_marketing")) {
  return <Navigate to="/dashboard" replace />;
}

// Para:
if (!permissionsLoading && !hasPermission("trade_admin")) {
  return <Navigate to="/dashboard/trade" replace />;
}
```

---

### 3. Rotas (App.tsx)

Adicionar proteção de tela nas rotas administrativas usando `ScreenProtectedRoute`:

```tsx
<Route path="/dashboard/trade/admin" element={
  <ProtectedRoute>
    <ScreenProtectedRoute screenCode="trade_admin">
      <TradeAdminModule />
    </ScreenProtectedRoute>
  </ProtectedRoute>
} />
```

---

## Resumo das Alterações

| Tipo | Descrição |
|------|-----------|
| 🗄️ Banco | Criar tela `trade_admin` em `telas_sistema` |
| 🗄️ Banco | Atribuir permissão da tela apenas para Milene |
| 💻 Código | Ajustar verificação no `TradeAdminModule.tsx` |
| 💻 Código | Adicionar `ScreenProtectedRoute` nas rotas admin |

---

## Resultado Esperado

- ✅ Apenas Milene Harumi verá o menu "Administrativo" no Trade Marketing
- ✅ Tentativas de acesso direto via URL por outros usuários serão bloqueadas
- ✅ Para dar acesso a outras pessoas no futuro, basta adicionar na tabela `usuario_permissoes_telas`

---

## Detalhes Técnicos

### Arquivos a Modificar:
1. `src/pages/modules/TradeAdminModule.tsx` - Alterar verificação de permissão
2. `src/App.tsx` - Adicionar ScreenProtectedRoute nas rotas administrativas

### Migração SQL Completa:
```sql
-- 1. Criar a tela trade_admin
INSERT INTO telas_sistema (codigo, nome, descricao, modulo_codigo, rota, icone, ordem, ativo)
VALUES ('trade_admin', 'Administrativo Trade', 'Módulo administrativo do Trade Marketing', 'trade', '/dashboard/trade/admin', 'Settings', 0, true)
ON CONFLICT (codigo) DO NOTHING;

-- 2. Atribuir permissão exclusiva para Milene Harumi
INSERT INTO usuario_permissoes_telas (usuario_id, tela_id)
SELECT '7eb17733-d824-4758-8ddf-7b9606ef4991', id 
FROM telas_sistema 
WHERE codigo = 'trade_admin'
ON CONFLICT DO NOTHING;
```
