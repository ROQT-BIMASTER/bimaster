

# Unificar Sync na Página de Contas a Receber

## Situação Atual

Existem **2 acessos separados** para funcionalidades de sync na página de Contas a Receber:
- **"Monitor Sync"** — abre um Drawer com `SyncMonitorPanel`
- **"Sincronizar ERP"** — navega para uma página separada (`/contas-a-receber/sync`) com 3 tabs (Engine, Métricas, Monitor)

O Monitor aparece duplicado (no Drawer e na página separada). A página separada tem conteúdo valioso (Engine + Métricas + Monitor) que deveria estar acessível sem sair do contexto.

## Proposta

Substituir os 2 botões por **1 único botão "ERP Sync"** que abre a página dedicada (que já tem tudo consolidado em 3 tabs). Remover o Drawer duplicado.

## Alterações

| Arquivo | Mudança |
|---|---|
| `src/pages/ContasAReceber.tsx` | Remover botão "Monitor Sync", Drawer de sync, e state `showSyncMonitor`. Manter apenas o botão "Sincronizar ERP" (renomear para "ERP Sync") |

## Resultado

- 1 botão em vez de 2
- Zero duplicação de componentes
- Toda gestão de sync consolidada na página dedicada (Engine + Métricas + Monitor)

