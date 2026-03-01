

## Plano: Monitoramento de Acessos por Tela e Usuário

### O que será feito

1. **Hook `usePageTracking`** — registra automaticamente cada navegação de tela no `access_audit_log` (tabela já existente), gravando `user_id`, `tela_codigo` (pathname), `modulo_codigo` (extraído do path), `action: "page_view"`, e `user_agent`.

2. **Integrar no `DashboardLayout`** — uma linha de import + chamada do hook. Cada vez que o `pathname` mudar, registra o acesso.

3. **Componente `MonitoramentoAcessos`** — painel admin na página de Configurações (nova aba "Acessos") com:
   - Filtro por data (dia) e por usuário
   - Tabela mostrando: Usuário, Tela, Quantidade de acessos no dia, Último acesso
   - Query agrupada por `user_id + tela_codigo + data`, com contagem
   - Visível apenas para admins

### Arquivos

| Arquivo | Ação |
|---|---|
| `src/hooks/usePageTracking.ts` | NOVO: hook que registra page_view no access_audit_log |
| `src/components/dashboard/DashboardLayout.tsx` | Adicionar chamada do hook (1 linha) |
| `src/components/configuracoes/MonitoramentoAcessos.tsx` | NOVO: painel admin com tabela de acessos |
| `src/pages/Configuracoes.tsx` | Adicionar aba "Acessos" para admins |

### Detalhes Técnicos

**Hook `usePageTracking`:**
- Usa `useLocation()` para detectar mudanças de rota
- Throttle de 2s para evitar registros duplicados em navegação rápida
- Extrai módulo do pathname (ex: `/dashboard/fabrica/produtos` → `fabrica`)
- Insert fire-and-forget com `try/catch` (falha silenciosa)
- Política RLS de INSERT já necessária — será adicionada via migração

**Migração SQL:**
- Adicionar política de INSERT no `access_audit_log` para `authenticated` com `user_id = auth.uid()`

**Painel `MonitoramentoAcessos`:**
- Query: `SELECT user_id, tela_codigo, COUNT(*), MAX(created_at) FROM access_audit_log WHERE action='page_view' AND created_at::date = ? GROUP BY user_id, tela_codigo`
- Join com `profiles` para mostrar nome do usuário
- DatePicker para selecionar o dia
- Filtro opcional por usuário (select)

