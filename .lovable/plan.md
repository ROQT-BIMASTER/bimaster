## Objetivo
Persistir histórico do copiloto por **30 dias**, fazer a IA aprender um **perfil do usuário** (estilo de pedido, preferências, projetos/temas frequentes) e permitir **salvar relatórios indefinidamente** vinculando-os opcionalmente a uma tarefa do projeto.

## 1. Banco de dados (migração)

**a) Nova tabela `projeto_copilot_user_profile`** — perfil aprendido (1 por usuário+projeto):
- `user_id`, `projeto_id` (PK composta)
- `perfil_resumo` (text) — síntese curta gerada pela IA: papel, tom preferido, tipos de relatório/perguntas recorrentes, métricas que mais consulta
- `preferencias` (jsonb) — `{formato_padrao, idioma, foco, ...}`
- `mensagens_observadas` (int), `ultima_atualizacao`
- RLS: dono lê/atualiza; service-role escreve.

**b) Nova tabela `projeto_copilot_relatorio_tarefas`** — vínculo N:N relatório ↔ tarefa:
- `relatorio_id` → `projeto_copilot_relatorios`
- `tarefa_id` → `projeto_tarefas`
- `criado_por`, `created_at`
- RLS: usuário com acesso ao projeto da tarefa.

**c) Coluna em `projeto_copilot_relatorios`**:
- `salvo` boolean default false
- `nome_personalizado` text
- Política: quando `salvo = true`, `expires_at` é ignorado pelo job de limpeza.

**d) Coluna em `projeto_copilot_threads`**:
- `expires_at` timestamptz default `now() + 30 days`
- `salvo` boolean default false (idem regra acima)

**e) RPC `salvar_relatorio_em_tarefa(relatorio_id, tarefa_id)`**:
- Copia o arquivo do bucket `projeto-relatorios` para `projeto-anexos` no caminho da tarefa, cria registro em `projeto_tarefa_anexos` e em `projeto_copilot_relatorio_tarefas`. Marca `salvo=true`.

**f) Job de limpeza (pg_cron, diário 03:00)**:
- DELETE em `projeto_copilot_threads` (cascata em mensagens/ações) onde `salvo=false AND created_at < now() - 30 days`.
- DELETE em `projeto_copilot_relatorios` onde `salvo=false AND created_at < now() - 30 days` + remove arquivos do bucket via edge function `projeto-copilot-cleanup`.

## 2. Edge functions

**a) `projeto-copilot/index.ts` — aprender perfil**
- No início do request, carregar `projeto_copilot_user_profile` (se existir) e injetar no system prompt um bloco "PERFIL DO USUÁRIO:" com `perfil_resumo` + `preferencias`.
- Após salvar a resposta, se `mensagens_observadas % 5 == 0` (a cada 5 mensagens) ou primeira interação: disparar **chamada IA leve** (gemini-flash-lite) com últimas 20 mensagens pedindo JSON `{perfil_resumo, preferencias}` e fazer upsert. Não bloquear resposta — usar `EdgeRuntime.waitUntil`.

**b) `projeto-copilot-relatorio` — aceitar `salvo` inicial=false** (já é o default, sem mudança).

**c) Novas funções**
- `projeto-copilot-salvar-relatorio` — body: `{ relatorio_id, salvo: bool, nome_personalizado?, tarefa_id? }`. Marca como salvo, opcionalmente chama RPC para vincular à tarefa.
- `projeto-copilot-cleanup` — invocada pelo cron, deleta arquivos órfãos do storage.

## 3. Frontend

**a) `useProjetoCopilot.ts`**
- Novo: `loadThreadList()` retorna conversas dos últimos 30 dias + salvas.
- Novo: `salvarRelatorio(relatorioId, {nome?, tarefaId?})`, `desmarcarSalvo(relatorioId)`.
- Novo: `salvarConversa(threadId, salvo)`.

**b) `ProjetoCopilotPanel.tsx`**
- Botão "Conversas" na header abre drawer/popover com lista de threads salvas + recentes (últimos 30 dias), com badge "Expira em Xd". Click carrega via `loadThread`.
- Em `ReportCard`: dois novos botões — **"Salvar"** (toggle estrela) e **"Vincular a tarefa"** (abre dialog com seletor de tarefa do projeto). Quando salvo, chip verde "Salvo · não expira".
- Aviso discreto no rodapé: "Conversas e relatórios não salvos expiram em 30 dias."

**c) Novo `VincularRelatorioTarefaDialog.tsx`**
- Combobox de tarefas do projeto (busca por título), confirma → chama `salvarRelatorio` com `tarefaId`. Toast com link para a tarefa.

## 4. Detalhes técnicos

- Perfil aprendido: prompt da IA secundária pede saída JSON estrita (Zod no server). Limite ~400 chars em `perfil_resumo` para não inflar contexto.
- O system prompt principal só inclui perfil se `mensagens_observadas >= 3` (evita perfil pobre cedo demais).
- Anexação a tarefa reaproveita bucket `projeto-anexos` e tabela `projeto_tarefa_anexos` (já com RLS por acesso à tarefa).
- Cron via `cron.schedule` + `net.http_post` chamando `projeto-copilot-cleanup`.

## Arquivos
- **Migração** (nova): tabelas, colunas, RPC, RLS.
- **SQL via insert tool**: cron job (contém URL/anon key).
- `supabase/functions/projeto-copilot/index.ts` — perfil load/update.
- `supabase/functions/projeto-copilot-salvar-relatorio/index.ts` (novo).
- `supabase/functions/projeto-copilot-cleanup/index.ts` (novo).
- `src/hooks/useProjetoCopilot.ts` — novas mutations/queries.
- `src/components/projetos/ProjetoCopilotPanel.tsx` — UI conversas + salvar/vincular.
- `src/components/projetos/VincularRelatorioTarefaDialog.tsx` (novo).
