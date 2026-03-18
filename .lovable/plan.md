

## Auditoria de Navegação, Rotas e Acessos Indiretos

### Metodologia
Analisei exaustivamente: todas as 120+ rotas em `App.tsx`, os guards aplicados (ProtectedRoute, ModuleRoute, ScreenRoute), navegações via `useNavigate()` em 87 arquivos, botões "voltar" (`navigate(-1)`) em 19 páginas, e rotas públicas sem autenticação.

---

### Falhas Encontradas

| # | Rota/Componente | Falha | Criticidade | Origem |
|---|---|---|---|---|
| 1 | `/dashboard/simulacao` | **SEM NENHUMA PROTEÇÃO** — sem ProtectedRoute, sem ModuleRoute, sem ScreenRoute. Qualquer visitante anônimo acessa a página de simulação de dados. | 🔴 CRÍTICO | App.tsx linha 513 |
| 2 | `/relatorio-seguranca` (pública) | Rota pública (linha 580) expõe detalhes da arquitetura de segurança do sistema sem autenticação. Contém informações sobre RLS, MFA, políticas, score de segurança. | 🔴 CRÍTICO | App.tsx linha 580 |
| 3 | `/relatorio-desenvolvimento` (pública) | Rota pública (linha 581) expõe relatório de desenvolvimento sem autenticação. | 🟠 ALTO | App.tsx linha 581 |
| 4 | `/dashboard/fabrica/manual` | Usa apenas `<ProtectedRoute>` — qualquer usuário autenticado acessa, sem verificação do módulo `fabrica`. | 🟠 ALTO | App.tsx linha 451 |
| 5 | `/dashboard/configuracoes/lgpd` | Usa apenas `<ProtectedRoute>` — deveria exigir permissão de admin. | 🟠 ALTO | App.tsx linha 565 |
| 6 | `/dashboard/demandas` | Usa apenas `<ProtectedRoute>` — sem guard de módulo. Intencional? Qualquer usuário autenticado acessa o sistema de tickets internos. | 🟡 MÉDIO | App.tsx linha 360 |

### Pontos Seguros Confirmados

| Verificação | Resultado |
|---|---|
| **Route guards (ModuleRoute/ScreenRoute)** | 100+ rotas protegidas corretamente com guards aninhados |
| **`navigate(-1)` (botão voltar)** | Seguro — guards re-avaliam permissões ao renderizar a página destino |
| **Deep links / refresh em tela protegida** | Seguro — ProtectedRoute verifica sessão, ModuleRoute/ScreenRoute verifica permissões |
| **Abertura em nova aba** | Seguro — sessão verificada via AuthContext |
| **Escalação de privilégio via localStorage** | Seguro — roles vêm do banco via `user_roles`, não de storage local |
| **Portal do cliente isolado** | Seguro — `ClienteProtectedRoute` bloqueia internos; `ProtectedRoute` redireciona clientes |
| **Catch-all route** | Seguro — `<Route path="*">` captura rotas inexistentes |
| **Botões de navegação interna** | Seguro — destinos são protegidos por guards na rota, mesmo que botões não verifiquem permissão antes de navegar |
| **Backend (RLS)** | 406 tabelas com RLS ativo, 1172+ políticas — dados protegidos independente do frontend |

### Plano de Correção

**Fase 1 — Correções Críticas (App.tsx)**

1. **`/dashboard/simulacao`** — Envolver com `<ScreenRoute screenCode="admin">` (só admin deve simular dados)
2. **`/relatorio-seguranca` (pública, linha 580)** — Remover rota pública. Manter apenas a versão protegida em `/dashboard/relatorio-seguranca` (linha 566)
3. **`/relatorio-desenvolvimento` (pública, linha 581)** — Remover rota pública. Manter apenas a versão protegida em `/dashboard/relatorio-desenvolvimento` (linha 567)

**Fase 2 — Correções de Hardening**

4. **`/dashboard/fabrica/manual`** — Trocar `<ProtectedRoute>` por `<ModuleRoute moduleCode="fabrica">`
5. **`/dashboard/configuracoes/lgpd`** — Trocar `<ProtectedRoute>` por `<ScreenRoute screenCode="admin">`
6. **`/dashboard/demandas`** — Avaliar se intencional; se não, proteger com módulo apropriado

### Resumo de Alterações

| Arquivo | Mudanças |
|---|---|
| `src/App.tsx` | 5-6 linhas de rota alteradas para adicionar guards corretos + remover 2 rotas públicas |

Nenhuma alteração de banco de dados necessária. Todas as correções são no roteamento frontend.

