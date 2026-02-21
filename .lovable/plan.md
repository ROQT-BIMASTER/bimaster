

## Problema

Atualmente, quando qualquer usuário acessa `/dashboard`, o sistema redireciona automaticamente para `/dashboard/prospects` (tela de Prospects), independentemente das permissões do usuário. Isso foi configurado intencionalmente em uma decisão anterior, mas agora precisa ser corrigido.

**Causa raiz** (em `src/App.tsx`, linha 277):
```text
<Route path="/dashboard" element={
  <ProtectedRoute>
    <Navigate to="/dashboard/prospects" replace />
  </ProtectedRoute>
} />
```

## Solucao

Substituir o redirecionamento fixo para Prospects por um componente inteligente que redireciona o usuario para o primeiro modulo ao qual ele tem permissao, ou exibe o Dashboard geral.

### Logica de redirecionamento

1. Aguardar carregamento das permissoes
2. Verificar permissoes de modulo na seguinte ordem de prioridade:
   - `prospects` -> `/dashboard/prospects`
   - `trade` -> `/dashboard/trade`
   - `financeiro` -> `/dashboard/financeiro`
   - `fabrica` -> `/dashboard/fabrica`
   - `estoque` -> `/dashboard/estoque`
   - `comercial` -> `/dashboard/comercial`
   - `marketing` -> `/dashboard/marketing`
3. Se o usuario tiver permissao a algum modulo, redirecionar para o primeiro da lista
4. Se nao tiver nenhum modulo, exibir a pagina Dashboard geral (que ja existe e mostra apenas widgets permitidos)

### Detalhes tecnicos

**Arquivo 1: `src/components/auth/DashboardRedirect.tsx`** (novo)
- Componente que usa `useModulePermissions` para determinar o destino
- Exibe loader enquanto permissoes carregam
- Redireciona para o primeiro modulo permitido ou renderiza o Dashboard geral

**Arquivo 2: `src/App.tsx`**
- Substituir a linha 277 que faz `<Navigate to="/dashboard/prospects">` pelo novo componente `<DashboardRedirect />`

### Impacto

- Milene e outros usuarios verao apenas o modulo ao qual tem acesso
- Admins continuarao vendo Prospects como primeiro modulo (pois tem acesso a tudo)
- Nenhuma quebra em rotas existentes - todas as sub-rotas continuam funcionando normalmente

