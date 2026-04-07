

# Trilha de Auditoria de Acessos + Visão Multi-IP

## Problema

A tela de "Monitoramento de Acessos" existe dentro de Configuracoes (aba "acessos") mas mostra apenas contagem agregada por tela/dia. Falta a **trilha completa** (quem acessou, quando, qual tela, IP, user-agent) e não há visão de **usuários com múltiplos IPs**.

## Solução

### 1. Nova página: `TrilhaAuditoriaAcessos.tsx`

Página dedicada com duas abas:

**Aba "Trilha Completa"**:
- Tabela com colunas: Usuário, Tela, Módulo, IP, User-Agent, Data/Hora
- Filtros: Data (range picker), Usuário, Módulo, Ação
- Ordenação por data desc, paginação
- Busca dados da tabela `access_audit_log` com JOIN em `profiles`

**Aba "Múltiplos IPs"**:
- Agrupa `access_audit_log` por `user_id`, conta `DISTINCT ip_address`
- Exibe tabela: Usuário, Qtd IPs distintos, Lista de IPs, Último acesso
- Filtro por período (últimos 7/30/90 dias)
- Badge de alerta para quem tem 3+ IPs distintos
- Expandir linha para ver detalhes de cada IP (datas, user-agents)

### 2. Rota em `App.tsx`

- Rota: `/dashboard/trilha-auditoria-acessos`
- Protegida com `screenCode="admin"`

### 3. Menu na Sidebar

- Adicionar no grupo "Seguranca & Auditoria": `MenuItemLink` com icon `Footprints` e título "Trilha de Acessos"

## Arquivos

| Arquivo | Alteração |
|---|---|
| `src/pages/TrilhaAuditoriaAcessos.tsx` | Nova página com 2 abas |
| `src/App.tsx` | Nova rota protegida |
| `src/components/dashboard/AppSidebar.tsx` | Novo link no menu admin |

