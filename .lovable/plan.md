
# Copiloto Avançado de Projetos (com confirmação por senha, leitura de anexos e relatórios)

## Objetivo

Adicionar a cada projeto um copiloto conversacional que:

1. Conversa com contexto completo do projeto (tarefas, prazos, responsáveis, custos, atas, anexos).
2. Propõe ações que **só são executadas após o usuário reautenticar com senha** no diálogo de confirmação.
3. Lê PDFs e planilhas **anexados às tarefas** quando o usuário tem acesso a elas.
4. Opera estritamente dentro do escopo de Projetos e respeita o perfil/RLS de cada usuário.
5. Gera relatórios PDF e Excel com gráficos sob demanda.

Reaproveita a infra de IA já existente (`projeto-ia-assistant`, `useProjetoIA`, `useProjetoChat`, monitor de atrasos, resumo diário, estimativa de horas). Nada existente é removido.

## Experiência (UI)

- **Painel "Copiloto"** dentro de `ProjetoDetalhe`, acessível por botão na `ProjetoHeader` e atalho `⌘ K` no contexto do projeto.
- **Conversa em streaming** com markdown e citações clicáveis (cada citação leva à tarefa, anexo ou ata original).
- **Chips de fonte** acima da resposta: tarefas/anexos/atas que foram lidos para responder.
- **Cards de ação** quando o agente propõe mudança:
  - resumo da ação em linguagem natural
  - diff visual ("Prazo: 02/05 → 09/05", "Responsável: — → Ana")
  - botões `Aplicar` / `Editar` / `Descartar`
  - múltiplas ações viram fila com "Aplicar tudo"
- **Diálogo de confirmação com senha** ao clicar `Aplicar`:
  - mostra o resumo final das ações
  - campo de senha obrigatório
  - botão `Confirmar e aplicar` desabilitado até senha preenchida
  - sucesso → toast e atualização realtime; falha de senha → mensagem clara, sem aplicar nada
- **Cards de relatório**: quando o usuário pede um relatório, o agente devolve um card com prévia (tipo, escopo, gráficos incluídos) e botão "Gerar PDF" / "Gerar Excel"; o arquivo final aparece na conversa para download via `StoragePreviewDialog` (memória `Blob Download Protocol`).

## Capacidades do agente

Tools que o modelo pode chamar. Toda leitura usa o JWT do usuário; nada bypassa RLS.

**Leitura (executa direto):**
- `listar_tarefas(filtros)` — status, responsável, prazo, prioridade, seção
- `detalhar_tarefa(id)` — descrição, checklist, comentários, anexos
- `metricas_projeto()` — atrasadas, sem responsável, % conclusão, horas, custo
- `buscar_no_projeto(query)` — busca textual em tarefas, comentários, atas
- `historico_chat(n)` — últimos N posts do chat
- `quem_faz_o_que()` — carga por responsável
- `ler_anexo(anexo_id, paginas?)` — extrai texto de PDFs e planilhas anexados a tarefas (ver seção "Leitura de anexos")
- `listar_anexos(tarefa_id?)` — lista anexos visíveis ao usuário

**Ação (sempre exige confirmação + senha):**
- `criar_tarefa(secao, titulo, responsavel?, prazo?, prioridade?)`
- `mover_tarefa(id, nova_secao | novo_status)`
- `reatribuir(id, responsavel)`
- `ajustar_prazo(id, nova_data)`
- `gerar_checklist(id)` (reutiliza `projeto-ia-assistant`)
- `gerar_subtarefas(id)` (reutiliza)
- `postar_resumo_no_chat()` (reutiliza)
- `notificar(responsavel, mensagem)`

**Relatórios (executa direto, retorna arquivo):**
- `gerar_relatorio_pdf(tipo, escopo, opcoes)` — ver seção "Relatórios"
- `gerar_relatorio_excel(tipo, escopo, opcoes)`

Ações destrutivas (excluir tarefa/seção) ficam fora desta entrega.

## Confirmação por senha (reautenticação)

- Front: ao clicar `Aplicar`, abre `ConfirmarAcoesDialog` (novo) com lista de ações + campo de senha.
- Front chama `supabase.auth.reauthenticate` não basta; o padrão correto é uma chamada server-side. Implementação:
  - Edge function `projeto-copilot-aplicar` recebe `{ proposta_id, password }`.
  - Lê `email` do JWT (`ctx.user.email`), faz `signInWithPassword({ email, password })` em cliente isolado para validar a senha. Se falhar → 401 "Senha inválida".
  - Se passar, executa as ações em transação lógica com o JWT do usuário (RLS aplica), grava em `projeto_copilot_acoes` e em `projeto_chat` como `acao_executada` para auditoria.
  - Rate-limit: 5 tentativas de senha por usuário/15 min; após isso bloqueia por 30 min e registra evento de segurança.
- Senha **nunca** é logada nem armazenada; só passa pela validação e é descartada.

## Leitura de anexos (PDF e planilhas)

- Tool `ler_anexo(anexo_id)`:
  - Verifica via RLS que o usuário tem acesso à tarefa do anexo (consulta `projeto_tarefa_anexos` join `projeto_tarefas`).
  - Faz download do `storage_path` no bucket de anexos usando o JWT do usuário (não service role).
  - PDF → extração de texto (até 50 páginas) com utilitário do edge function (pdf-parse compatível com Deno).
  - XLSX/CSV → parse com SheetJS no edge function; converte para texto tabular limitado a N linhas/colunas.
  - Tamanho máximo lido: 20 MB (memória `File Upload Policy`).
  - Resultado é resumido pela IA antes de entrar no contexto, para não estourar tokens.
  - Cada leitura é citada como fonte na resposta.
- Anexos não acessíveis ao usuário **não aparecem nem na listagem**, garantindo que o agente nunca os mencione.

## Escopo restrito a Projetos + perfil do usuário

- O `system prompt` do agente define explicitamente: só fala de projetos, tarefas, anexos, métricas e relatórios do módulo Projetos. Recusa pedidos fora desse escopo com mensagem padrão.
- Toda tool tem allow-list de tabelas (apenas `projeto_*`, `tarefa_*`, anexos do bucket de projetos).
- O agente respeita o perfil do usuário automaticamente porque toda query passa pelo JWT e RLS:
  - `useProjetos`, `user_can_access_projeto`, `is_admin`, `isGerenteGeral` continuam sendo a fonte da verdade.
  - Usuário "restrito" (ex.: Portal ERP, memória `Sidebar Isolation`) só vê o que já vê na UI.
  - Admin/gerente geral enxerga mais porque a RLS deixa.
- No diálogo de ação, o front confere antes de mostrar o card que o usuário tem permissão de mutação na tarefa-alvo (consulta RPC já existente). Se não tem, o card vira "sem permissão" e não envia ao backend.

## Relatórios PDF e Excel com gráficos

- Edge function nova `projeto-copilot-relatorio` (separada para isolar latência e dependências).
- Tipos suportados na Fase 1:
  - **Status do projeto** (PDF): capa + métricas + tabela de tarefas + 3 gráficos (donut por status, barras por responsável, linha de cumulativo concluídas vs prazo).
  - **Responsáveis e carga** (PDF + Excel): tabela e gráfico de barras por responsável (atrasadas/em dia/concluídas).
  - **Linha do tempo** (PDF): Gantt simplificado por seção.
  - **Métricas executivas** (Excel): planilhas separadas (Resumo, Tarefas, Por responsável, Por seção) + gráficos nativos do Excel.
- Stack:
  - PDF: `pdf-lib` em Deno + `@napi-rs/canvas`/`skia-canvas` substituído por gráficos pré-renderizados como PNG via `quickchart-style` interno; alternativa robusta: gerar HTML + renderizar via `@deno/puppeteer` se já disponível, senão usar `pdfkit` Deno-compatible. Decisão final na implementação após testar o que já roda no projeto.
  - Excel: `exceljs` (compatível Deno via npm:) com gráficos nativos (`addChart`).
- Output salvo no bucket `projeto-relatorios` com path `userId/projetoId/{timestamp}-{tipo}.{ext}` (memória `Storage Ownership`), TTL de 30 dias, RLS: dono e admins.
- Front recebe `signed url` curto (10 min) e abre via `StoragePreviewDialog`.
- Geração assíncrona quando >5s: cria registro em `projeto_copilot_relatorios` com `status pending|done|failed`, front faz polling/realtime.

## Backend

Edge functions novas:

- **`projeto-copilot`** — chat principal, streaming SSE, tool-calling, modelo híbrido (Flash padrão; GPT-5.2 reasoning para planejamento/risco/ata complexa). `secureHandler` com `auth: jwt`, `rateLimit: 30/min`.
- **`projeto-copilot-aplicar`** — recebe proposta + senha, valida reautenticação, executa ações com JWT do usuário, registra auditoria.
- **`projeto-copilot-relatorio`** — gera PDF/Excel, salva no bucket, devolve signed URL. `rateLimit: 10/h por usuário`.

Reuso: as mutações chamam as RPCs e endpoints já validados do `projeto-ia-assistant` quando aplicável (gerar checklist, subtarefas, resumo).

## Banco

Migration nova:

- `projeto_copilot_threads(id, projeto_id, user_id, titulo, created_at, updated_at)` — RLS: dono lê/edita; admin lê.
- `projeto_copilot_mensagens(id, thread_id, role, content, tool_calls jsonb, sources jsonb, model, tokens_in, tokens_out, latency_ms, created_at)` — RLS via thread.
- `projeto_copilot_acoes(id, thread_id, mensagem_id, tipo, payload jsonb, status enum('proposta','aplicada','descartada','falhou'), aplicada_por, aplicada_em, resultado jsonb, ip inet, user_agent text)` — auditoria.
- `projeto_copilot_relatorios(id, projeto_id, user_id, tipo, formato, status, storage_path, erro, created_at, expires_at)` — TTL 30d.
- `projeto_copilot_password_attempts(user_id, tentativas, janela_inicio)` — controle de força bruta.
- Índices: `(projeto_id, user_id, updated_at desc)`, `(thread_id, created_at)`.
- Sem CHECK em datas; usar trigger se necessário (memória).
- `REPLICA IDENTITY FULL` + `supabase_realtime` para `projeto_copilot_mensagens` e `projeto_copilot_relatorios`.
- Bucket `projeto-relatorios` privado; RLS: `select/insert` apenas onde `(storage.foldername(name))[1] = auth.uid()::text` ou admin (memória `Storage Ownership`).

## Modelo híbrido

- `google/gemini-3-flash-preview` — chat geral, classificação de intenção, leitura/sumarização, propor ações simples, resumir anexo.
- `openai/gpt-5.2` com `reasoning: { effort: "medium" }` — planejar ("replaneje as próximas 2 semanas"), análise de risco, interpretação de ata longa, montar estrutura de relatório executivo.
- Fallback em 429: Flash → Flash-Lite. 402 → toast claro pedindo créditos.

## Segurança

- Toda leitura do agente usa o JWT do usuário; nenhuma tool roda com service role.
- Reautenticação por senha obrigatória antes de qualquer ação (não basta o JWT já válido).
- `secureHandler` em todas as edge functions; Zod `.strict()` em todos os payloads (memórias).
- Allow-list de tabelas e buckets nas tools.
- Auditoria completa em `projeto_copilot_acoes` (quem, quando, IP, UA, payload, resultado).
- Rate-limit por usuário e por projeto.
- Nenhuma menção/sugestão fora do escopo de Projetos.
- Relatórios em bucket privado com signed URL curto.

## Observabilidade

- Cada turno grava `model`, `tokens_in/out`, `latency_ms`, `tools_used`.
- Painel admin (futuro) reaproveita o padrão `Cost Reduction Ecosystem` para custo por projeto/usuário/mês.
- Logs estruturados com `thread_id`, `intent`, `tools_used`, `relatorio_id`.

## Faseamento

**Fase 1 — Fundação (zero impacto em produção)**
- Migration das 5 tabelas + bucket + RLS.
- Edge function `projeto-copilot` somente com tools de leitura (incluindo `ler_anexo`) + streaming.
- Painel "Copiloto" no `ProjetoDetalhe` (Q&A com citações e leitura de anexos).
- Modelo: Flash apenas.

**Fase 2 — Ações com confirmação por senha**
- Tools de ação retornando `action_proposal`.
- Cards de diff + `ConfirmarAcoesDialog` com senha.
- Edge function `projeto-copilot-aplicar` + auditoria + força bruta.

**Fase 3 — Relatórios PDF/Excel com gráficos**
- Edge function `projeto-copilot-relatorio`.
- 4 tipos de relatório iniciais.
- Card de prévia + entrega via `StoragePreviewDialog`.

**Fase 4 — Reasoning híbrido + planejamento pró-ativo**
- Roteador Flash ↔ GPT-5.2 reasoning.
- Sugestões pró-ativas ao abrir projeto com tarefas atrasadas.
- Threads navegáveis na sidebar do painel.

## Não-objetivos desta entrega

- Sem embeddings/pgvector (busca textual + leitura direta cobre as fases).
- Sem transcrição de áudio.
- Sem ações destrutivas (excluir).
- Sem mexer em `useProjetos`, `useProjetoTarefas`, `useProjetoChat`, monitor de atrasos, resumo diário, estimativa de horas.
- Sem expandir o escopo do agente para fora de Projetos.

## Detalhes técnicos relevantes

- Edge functions: padrão `secureHandler`, SSE conforme skill AI Gateway, tool-calling via `tools` + `tool_choice`.
- Front: `useProjetoCopilot` (novo), parser SSE já consolidado, `react-markdown`, `ConfirmarAcoesDialog` reusável.
- Versão: bump `APP_VERSION` por fase com changelog em `ApiDocumentation.tsx` (memória `release-changelog-discipline`).
- Sem alteração nos hooks atuais na Fase 1 — risco zero para produção.
