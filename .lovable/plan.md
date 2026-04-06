

# Projetos de Documentação do Sistema BiMaster — Admin Only

## Contexto

Existem dois projetos de sistema hoje:
- **BiMaster - Implantação do Sistema** (14 seções, tarefas por módulo)
- **Padrões de Segurança — BiMaster** (6 camadas de segurança, todas concluídas)

O objetivo é criar uma estrutura completa e organizada de projetos admin-only, cobrindo cada módulo com tarefas detalhadas, segurança, arquitetura e documentação.

## Estrutura de Projetos a Criar

Será criado um **Edge Function** (`seed-system-projects`) que gera todos os projetos programaticamente com seções, tarefas e subtarefas. Os projetos terão `visibilidade = 'privado'` e apenas o admin será adicionado como membro coordenador.

### Projetos (15 total):

| # | Projeto | Cor | Seções |
|---|---------|-----|--------|
| 1 | **Arquitetura Geral — BiMaster** | `#6366f1` | Visão Geral, Stack Tecnológico, Fluxos de Dados, Padrões de Código, Integrações Externas |
| 2 | **Módulo: Prospects & CRM** | `#3b82f6` | Arquitetura, Funcionalidades, Segurança, Tarefas Pendentes, Documentação |
| 3 | **Módulo: Comercial** | `#10b981` | (mesma estrutura 5 seções) |
| 4 | **Módulo: Trade Marketing** | `#f59e0b` | (mesma estrutura) |
| 5 | **Módulo: Financeiro** | `#ef4444` | (mesma estrutura) |
| 6 | **Módulo: Fábrica Brasil** | `#8b5cf6` | (mesma estrutura) |
| 7 | **Módulo: Fábrica China** | `#ec4899` | (mesma estrutura) |
| 8 | **Módulo: Marketing** | `#06b6d4` | (mesma estrutura) |
| 9 | **Módulo: Projetos** | `#6366f1` | (mesma estrutura) |
| 10 | **Módulo: Estoque** | `#f59e0b` | (mesma estrutura) |
| 11 | **Módulo: Eventos** | `#ec4899` | (mesma estrutura) |
| 12 | **Módulo: Reuniões** | `#10b981` | (mesma estrutura) |
| 13 | **Módulo: Integração ERP** | `#3b82f6` | (mesma estrutura) |
| 14 | **Módulo: Central de Inteligência** | `#8b5cf6` | (mesma estrutura) |
| 15 | **Segurança Global — BiMaster** | `#ef4444` | Autenticação, Autorização (RLS), WAF & Edge, Auditoria, LGPD, Monitoramento |

### Estrutura padrão por módulo (5 seções):

**Seção 1 — Arquitetura & Fluxos**
- Tarefas descrevendo: componentes principais, hooks, rotas, fluxo de dados, dependências entre módulos
- Subtarefas para cada tela/sub-rota do módulo

**Seção 2 — Funcionalidades Implementadas**
- Uma tarefa por feature principal (ex: "DRE Gerencial", "Plano de Redução de Gastos", "Auditoria IA")
- Subtarefas detalhando sub-features

**Seção 3 — Segurança do Módulo**
- RLS policies ativas
- Guards de rota (ProtectedRoute/ScreenRoute)
- Permissões de tela
- Edge functions e validações

**Seção 4 — Melhorias & Backlog**
- Tarefas de melhorias futuras identificadas
- Bugs conhecidos

**Seção 5 — Documentação**
- Tarefa com descrição técnica do módulo
- Diagramas de arquitetura (descritos no campo descrição)
- Changelog de versões

## Implementação

### 1. Edge Function `seed-system-projects`

- Recebe chamada autenticada (admin only)
- Cria os 15 projetos via `supabase-admin`
- Para cada projeto: insere seções, tarefas e subtarefas (parent_tarefa_id)
- Adiciona admin como membro coordenador
- Cada tarefa terá descrição detalhada baseada nas memories e no código existente
- Retorna resumo dos projetos criados

### 2. Botão na UI — `PlataformaDocButton`

- Componente visível apenas para admins na página de projetos
- Botão "Gerar Projetos de Documentação"
- Chama a edge function e exibe progresso
- Após conclusão, invalida cache e mostra os novos projetos

### 3. Conteúdo das Tarefas (exemplos por módulo)

**Financeiro** (seção Funcionalidades):
- Contas a Pagar (AP) — Painel Central, Fila ERP, Conciliação
- DRE Gerencial — Classificação, Drill-down por fornecedor/departamento
- Fluxo de Caixa — Projeção, Cenários
- Plano de Redução — Criação, Compartilhamento, Auditoria IA
- Integração ERP — Sync automático, Mapeamento contábil

**Prospects** (seção Funcionalidades):
- Importação Excel/CSV
- Lead Mining & Whitespace
- Reativação de Inativos
- Auditoria de Gôndola
- Brand Share Dashboard

**Segurança Global** (seção Autenticação):
- JWT + Refresh automático
- MFA/TOTP
- Account Lockout
- Aprovação manual de usuários
- CSP + Headers de segurança

## Arquivos

| Arquivo | Alteração |
|---|---|
| `supabase/functions/seed-system-projects/index.ts` | Edge function que cria 15 projetos com ~200+ tarefas detalhadas |
| `src/components/projetos/GerarDocumentacaoButton.tsx` | Botão admin-only para disparar a geração |
| `src/components/projetos/ProjetosListHeader.tsx` (ou equivalente) | Integrar o botão no header da lista de projetos |

