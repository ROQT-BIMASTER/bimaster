# Prompt Lovable — Central de Suporte por Departamento (evolução do desk)

> **Cole no Lovable.** Evolui o desk atual (`/dashboard/suporte/desk`) numa **Central de Suporte** rica (KPIs + SLA + gráficos + lista + conversa) **escopada por departamento via seletor**, e **aposenta o painel antigo** (`/admin/suporte`). Depende das Fases 0–3B. **100% frontend** — KPIs e gráficos são computados no client a partir dos tickets já buscados; **nenhuma migration**. Tudo atrás da flag `ff_suporte_v2`.

## Decisões de produto (definidas com o usuário)
1. **Central única com seletor de departamento** (não um hub de cards). O **agente** entra travado no(s) seu(s) departamento(s); **admin/supervisor** troca por um seletor e tem a opção **"Todos os departamentos"** (visão consolidada).
2. **Aposentar a "Central de Suporte" antiga** (`SuporteAdmin`, `/admin/suporte`): a rota **redireciona** para a nova central e o item some do menu admin. **Não apagar** o arquivo `SuporteAdmin.tsx` ainda (o "parecer da equipe de TI" será migrado numa fase futura) — só desativar rota/menu.

## O que fazer

### 1. Rota e navegação
- **Evoluir** `src/pages/suporte/SuporteDesk.tsx` para ser a **Central de Suporte** (mudar o título visível de "Desk de Suporte" para **"Central de Suporte"**). Manter a rota `/dashboard/suporte/desk`.
- **Menu**: renomear o item "Desk de Suporte" → **"Central de Suporte"** nas 3 superfícies: `AppSidebar.tsx`, `navigation/v2/launcher/UtilityShortcuts.tsx`, `navigation/command-routes.ts`.
- **Aposentar o antigo**: em `src/App.tsx`, a rota `/admin/suporte` passa a **redirecionar**: `element={<Navigate to="/dashboard/suporte/desk" replace />}` (importar `Navigate` de `react-router-dom`). Remover o item "Central de Suporte" do menu admin em `src/components/navigation/v2/adminCategory.ts` (e no `AppSidebar` se houver link direto). **Não** apagar `SuporteAdmin.tsx`.

### 2. Seletor de departamento (topo da central)
- Papel do usuário via `useUserRole()` (`isAdmin`, `isAdminOrSupervisor`).
- Filas disponíveis no seletor:
  - **admin/supervisor**: todas as filas ativas (`useSuporteFilas()`) **+ item "Todos os departamentos"** (valor especial `"__todos__"`).
  - **agente comum**: só as filas dele (`useMinhasFilasAgente()`). Se tiver **1**, exibe o nome fixo (sem dropdown, travado). Se **>1**, dropdown entre as dele.
- Estado `departamentoSel` controla o escopo de KPIs, lista e gráficos. `"__todos__"` = união de todas as filas visíveis ao usuário.
- `filaIds` derivado: `departamentoSel === "__todos__" ? todasAsFilasVisiveis.map(id) : [departamentoSel]`. Passar para `useChamadosDesk(filaIds)` (já existe; faz `.in("fila_id", filaIds)` e a RLS garante o que o usuário pode ver).

### 3. KPIs (cards no topo, escopados ao departamento + período)
Computar no client a partir da lista de tickets (padrão que o `SuporteAdmin.tsx` já usa — copie o estilo dos cards com `border-l-4`):
- **Abertos** — `status !== 'resolvido'`.
- **Atrasados (SLA)** — `sla_status === 'violado'`.
- **Críticos** — `prioridade === 'critica' && status !== 'resolvido'`.
- **Escalados** — `status === 'escalado'`.
- **Resolvidos** — `status === 'resolvido'` (dentro do período selecionado).

### 4. Abas: **Tickets** | **Gráficos**
- **Tickets** (o que já existe, mantido): filtros (busca por título/protocolo, status, **categoria**, **período** — "Últimos 7/30/90 dias") + lista à esquerda (`ChamadoListItem`, com o `SlaChip`) + detalhe à direita (`ChatThread` + botões **Assumir** / **Transferir** / mudar status). Aplicar o filtro de período no client por `created_at`.
- **Gráficos** (nova aba, `recharts` — mesmo padrão de `CrmTickets.tsx`/`SuporteAdmin.tsx`), escopados ao departamento + período:
  - **Pizza**: tickets por `status`.
  - **Barra**: tickets por `categoria`.
  - **Linha**: chamados abertos por dia (no período).
  - **Barra/indicador**: SLA — cumprido vs violado vs em risco (usa `sla_status`).

### 5. Dados
- Reusar `useChamadosDesk(filaIds)` — já retorna enriquecido (`fila`, `requester`). Manter `limit(500)`; período é filtro client-side.
- Para **admin "Todos"**, `filaIds` = todas as filas ativas de `useSuporteFilas()`.

## Reuso (não recriar)
`ChamadoListItem`, `ChatThread`, `TransferirChamadoDialog`, `SlaChip` (em `ChamadoListItem`), `useSuporteAcoes`, `useChamadosDesk`, `useSuporteFilas`, `useMinhasFilasAgente`, `useUserRole`. Estilo de KPI cards e charts: espelhar `SuporteAdmin.tsx`.

## Aceite (teste no app, flag ligada)
1. Como **admin**: a Central abre com seletor; escolher **Fiscal** mostra só os tickets/KPIs/gráficos do Fiscal; escolher **Todos** consolida.
2. Como **agente de 1 fila**: entra travado nela, sem seletor de outras.
3. KPIs batem com a lista (Abertos, Atrasados SLA, Críticos, Escalados, Resolvidos).
4. Aba **Gráficos** renderiza os 4 gráficos escopados ao departamento.
5. Acessar `/admin/suporte` **redireciona** para a nova Central; o item antigo sumiu do menu admin.
6. Transferir/assumir/mudar status seguem funcionando; o chip de SLA aparece nos cards.

## Fora de escopo (fases futuras)
- Migrar o "parecer da equipe de TI" (`suporte_pareceres_ti`) para recurso por departamento.
- Views/materialização de métricas no banco (por ora tudo client-side, suficiente para o piloto).
- Canal WhatsApp (Fase 4).
