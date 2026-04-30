## Objetivo
Adicionar um **Copiloto da Central de Trabalho** (escopo pessoal e multi-projeto) que conheça **suas** tarefas (minhas, delegadas, inbox), seus prazos e seu padrão de trabalho — não fica preso a um único projeto como o `projeto-copilot`. Ele responde perguntas, propõe ações com confirmação por senha e gera relatórios PDF/XLSX dinâmicos sobre **seu dia/semana**.

## Possibilidades de uso (o que ele resolve)

### Perguntas e análises
- "O que devo fazer hoje?" / "Qual a melhor ordem para resolver minhas tarefas de hoje?"
- "Quais delegadas estão estagnadas há mais de 5 dias?"
- "Em quais projetos eu estou ficando para trás?"
- "Resuma minha inbox: o que precisa de ação minha?"
- "Quais reuniões/entregas tenho na semana?"

### Ações com confirmação (senha)
- Reagendar prazo de uma tarefa minha.
- Marcar tarefa como concluída / mudar status / prioridade.
- Reatribuir uma tarefa que deleguei.
- Marcar item da inbox como lido / arquivar.
- Criar uma tarefa pessoal rápida em um projeto que eu acesso.

### Relatórios dinâmicos (reaproveita `projeto-copilot-relatorio`)
- "PDF do meu dia" — KPIs (total/atrasadas/concluídas), agenda, tarefas por projeto, riscos.
- "XLSX semanal" — abas: Hoje, Esta semana, Atrasadas, Delegadas, Inbox pendente.
- "PDF de prestação de contas para meu gestor" — o que entreguei, o que está em andamento, bloqueios.

### Memória pessoal (perfil aprendido)
- Aprende seu papel típico, projetos mais frequentes, formatos preferidos, horários ativos. Persona injetada no system prompt (igual ao `projeto-copilot`, mas escopo `central` em vez de por projeto).

### Retenção
- Conversas e relatórios da Central seguem a **mesma política de 30 dias** + opção "Salvar"/"Vincular a tarefa" já implementada para o copiloto de projeto.

## Como se diferencia do `projeto-copilot`
| Aspecto | projeto-copilot | central-copilot (novo) |
|---|---|---|
| Escopo | 1 projeto | Todas as tarefas/projetos do usuário |
| Fontes | tarefas+anexos do projeto | minhas tarefas, delegadas, inbox, agenda |
| Perfil | por user+projeto | por user (global) |
| Onde aparece | ProjetoDetalhe | botão fixo na CentralTrabalho |

## Arquitetura proposta

### Backend
1. **Nova edge function `central-copilot/index.ts`** (espelha `projeto-copilot`, troca tools e RLS):
   - Tools de leitura: `metricas_pessoais`, `listar_minhas_tarefas`, `listar_delegadas`, `listar_inbox`, `agenda_periodo(de, ate)`, `detalhar_tarefa(id)`, `listar_projetos_meus`.
   - Tools de proposta (mutações): `propor_concluir_tarefa`, `propor_ajustar_prazo`, `propor_reatribuir`, `propor_mudar_prioridade`, `propor_marcar_inbox_lida`, `propor_criar_tarefa_em_projeto`. Tudo via tabela `projeto_copilot_acoes` existente, com confirmação por senha já pronta em `projeto-copilot-aplicar`.
   - Tool `gerar_relatorio_pessoal` chama `projeto-copilot-relatorio` em modo "pessoal" (novo `escopo: 'central'`).
   - Carrega/atualiza perfil em `central_copilot_user_profile` (nova tabela, sem `projeto_id`).
   - Validação RLS: todas as queries usam `userClient` com JWT — RLS já garante que o usuário só vê o que pode.

2. **Adaptação leve em `projeto-copilot-relatorio`**: aceitar `escopo: 'central'` e, quando recebido, montar dataset a partir das tarefas do usuário (cross-projeto) em vez de um projeto específico. Renderizador genérico não muda.

3. **Migração** (uma só):
   - `central_copilot_threads` (id, user_id, titulo, salvo, expires_at +30d) — espelha o padrão do projeto.
   - `central_copilot_mensagens` (thread_id, role, content, sources, model).
   - `central_copilot_user_profile` (user_id PK, perfil_resumo, preferencias, mensagens_observadas).
   - `central_copilot_relatorios` (user_id, thread_id, tipo, formato, storage_path, salvo, expires_at +30d, nome_personalizado).
   - Vínculo a tarefa: reaproveitar tabela `projeto_copilot_relatorio_tarefas` (FK passa a aceitar relatorios da central via UNION view ou criamos nova `central_copilot_relatorio_tarefas`). **Decisão simples**: criar `central_copilot_relatorio_tarefas` espelho — evita refatorar a FK existente.
   - RLS: dono ou admin lê; inserts via service role (edge function).
   - Cron: estende `projeto-copilot-cleanup` para também limpar tabelas `central_*` >30d não-salvas.

### Frontend
- **Novo `CentralCopilotPanel.tsx`** — clone enxuto do `ProjetoCopilotPanel` (Sheet à direita, histórico de conversas, salvar/vincular relatório). Sugestões iniciais focadas em "meu dia", "semana", "delegadas estagnadas", "PDF prestação de contas".
- **Novo `useCentralCopilot.ts`** — análogo a `useProjetoCopilot` mas sem `projetoId`.
- **Botão de acionamento na `CentralTrabalho`**: ícone Sparkles ao lado dos KPIs/header (`CentralHeader.tsx`), com atalho `Cmd/Ctrl+J`.
- **Integração com tarefas**: ao "Vincular a tarefa", lista tarefas de **todos os meus projetos** (não só de um) — usa `useMinhasTarefas`.

## Modelos
- Mesma política do `projeto-copilot`: roteador escolhe `gpt-5.2` para análise/planejamento e `gemini-3-flash` para perguntas simples; perfil aprendido via `gemini-2.5-flash-lite` em background com `EdgeRuntime.waitUntil`.

## Segurança
- `secureHandler` JWT obrigatório.
- Toda leitura via `userClient` (RLS aplica).
- Mutações **só** como propostas em `projeto_copilot_acoes` — execução exige senha (`projeto-copilot-aplicar` já valida).
- Limites do gateway (429/402) tratados com toast amigável.

## Arquivos
**Novos:**
- `supabase/functions/central-copilot/index.ts`
- `src/components/projetos/central/CentralCopilotPanel.tsx`
- `src/components/projetos/central/CentralCopilotLauncher.tsx` (botão fixo + atalho)
- `src/hooks/useCentralCopilot.ts`
- Migração com tabelas `central_copilot_*` + RLS + RPC `copilot_set_central_thread_salvo` / `copilot_set_central_relatorio_salvo`.

**Editados:**
- `supabase/functions/projeto-copilot-relatorio/index.ts` — aceitar `escopo: 'central'`.
- `supabase/functions/projeto-copilot-cleanup/index.ts` — limpar também `central_copilot_*` expirados.
- `src/components/projetos/central/CentralHeader.tsx` — colocar o launcher do copiloto.

## Decisões a confirmar
Faço três perguntas antes de implementar para alinhar escopo e UX.
