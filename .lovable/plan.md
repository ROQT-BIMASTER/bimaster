# Plano: Relatórios Personalizados com Claude (Anthropic) — Modelo Híbrido

Adicionar um **gerador de relatórios em linguagem natural** alimentado pelo **Claude Sonnet 4.5** (Anthropic API direta), convivendo com o Lovable AI atual. Sem mexer no Copiloto de Projetos já existente. O usuário descreve o relatório que quer ("Vendas por região nos últimos 6 meses, comparado com ano anterior"), o Claude monta o plano de dados, executa via tools restritas ao perfil dele, gera PDF/XLSX com gráficos e armazena.

## Visão geral do fluxo

```text
Usuário → "Quero relatório X"
  ↓
Edge Function `relatorio-ia` (Claude Sonnet 4.5)
  ↓ tool calls (limitadas pelo perfil)
RPCs SECURITY DEFINER → dados (Vendas/Financeiro/Projetos/Trade)
  ↓
Claude gera spec do relatório (seções, queries, gráficos)
  ↓
Edge Function `relatorio-render` → PDF (pdf-lib) + XLSX (exceljs) com Recharts SVG
  ↓
Bucket privado `relatorios-personalizados` + tabela `relatorios_ia`
  ↓
Tela "Meus Relatórios" → preview, download, salvar como template, agendar
```

## 1. Provedor e custo

- **Anthropic API direta** via secret `ANTHROPIC_API_KEY` (você fornece, paga consumo direto na Anthropic).
- **Modelo padrão**: `claude-sonnet-4-5-20250929` (raciocínio forte, 200k contexto, tool use nativo).
- **Modelo econômico para tarefas simples**: `claude-haiku-4-5` (classificação de intenção, validação).
- Lovable AI (Gemini/GPT-5) **continua intacto** para o Copiloto de Projetos e demais módulos.

## 2. Matriz de permissão por perfil

Cada role do sistema (`admin`, `supervisor`, `gerente`, `vendedor`, `promotora`, `promotor`, `cliente`) habilita um conjunto de **tools** e **datasets** específicos:

| Perfil | Datasets disponíveis | Tools |
|---|---|---|
| `admin` | Todos: Vendas, Financeiro (DRE, AP, AR), Projetos, Trade, Fábrica, Marketing | Todas |
| `supervisor` | Vendas/Trade do seu time, Projetos onde participa | `vendas_*`, `trade_*`, `projetos_meus` |
| `gerente` | Vendas + Financeiro do seu BU, Projetos do seu time | `vendas_*`, `dre_consolidado`, `projetos_meus` |
| `vendedor` | Suas próprias vendas, suas comissões, suas metas | `vendas_minhas`, `comissoes_minhas` |
| `promotora`/`promotor` | Suas visitas PDV, formulários preenchidos | `trade_minhas_visitas` |
| `cliente` | Apenas seus próprios pedidos/notas | `pedidos_meus` |

A matriz é configurável em `relatorio_ia_permissoes` e pode ser ajustada por admin sem redeploy.

## 3. Banco de dados

### Tabelas novas

- **`relatorio_ia_templates`** — templates reutilizáveis salvos pelo usuário.
  - `nome`, `descricao`, `prompt_original`, `spec_json` (estrutura do relatório), `dataset_keys[]`, `formato` (pdf/xlsx/ambos), `created_by`, `compartilhado` (bool), `agendamento_cron`, `proxima_execucao`.

- **`relatorio_ia_execucoes`** — cada geração (on-demand ou agendada).
  - `template_id` (nullable, on-demand não tem), `executado_por`, `prompt`, `spec_json`, `status` (queued/running/done/error), `pdf_path`, `xlsx_path`, `tokens_in`, `tokens_out`, `custo_usd`, `erro`, `expira_em` (30 dias para on-demand, infinito para template).

- **`relatorio_ia_permissoes`** — matriz role × dataset × tools (seedada inicial conforme tabela acima).

- **`relatorio_ia_audit`** — registro de cada tool call do Claude (qual RPC, parâmetros, linhas retornadas). Para auditoria LGPD.

### RLS

- `relatorio_ia_templates`: dono vê os seus + admin vê todos + compartilhados visíveis a quem o criador liberou (array `compartilhado_com[]`).
- `relatorio_ia_execucoes`: executor + admin.
- `relatorio_ia_permissoes`: leitura para autenticados, escrita só admin.
- `relatorio_ia_audit`: só admin lê.

### RPCs `SECURITY DEFINER` (datasets)

Cada uma respeita o perfil de quem chama (não usa `SERVICE_ROLE` no contexto do dataset, e sim `auth.uid()` + role-check).

- `dataset_vendas_resumo(periodo, agrupamento)` → linha por dimensão.
- `dataset_dre_periodo(inicio, fim, nivel)` → DRE IFRS-18 já existente.
- `dataset_ap_aging()` → contas a pagar agrupadas.
- `dataset_projetos_status(filtro)` → projetos visíveis ao usuário.
- `dataset_trade_pdv(periodo, regiao)` → visitas/formularios.
- `dataset_comissoes(usuario_id)` — vendedor só vê o próprio; supervisor vê time.
- (lista cresce conforme demanda — começamos com 6)

## 4. Storage

Bucket privado **`relatorios-personalizados`** com path `{user_id}/{execucao_id}/{nome}.{ext}`.

RLS: dono lê o seu, admin lê tudo. Download obrigatoriamente via signed URL de 10 min + `triggerBlobDownload` (memória do projeto).

## 5. Edge Functions

### `relatorio-ia` (orquestrador Claude)

```text
1. Auth + role do usuário
2. Carrega tools permitidas para o role da matriz
3. Chama Claude com:
   - system: instruções + role do usuário + datasets permitidos
   - tools: schemas das RPCs liberadas (formato Anthropic tool use)
   - user: prompt do relatório
4. Loop de tool use até Claude finalizar com "spec final" (JSON estruturado):
   { titulo, secoes: [{ tipo: "kpi"|"tabela"|"grafico", dados, config }], formato }
5. Persiste em `relatorio_ia_execucoes` (status=running)
6. Invoca `relatorio-render` com a spec
7. Retorna ID da execução para o frontend acompanhar
```

Limites: máx. 8 tool calls por execução, timeout 90s, máx. 10k linhas por dataset (resto vira "amostra + agregação").

### `relatorio-render` (geração de PDF/XLSX)

- **PDF**: `pdf-lib` + renderização de gráficos via SVG (server-side com `@nivo/core` headless ou Recharts → SVG via JSDOM). Capa com logo, sumário, KPIs cards, tabelas paginadas, gráficos.
- **XLSX**: `exceljs` — uma aba por seção, fórmulas vivas (`=SUM`, `=AVERAGE`), formatação de moeda BRL via `formatCurrency`, gráficos nativos do Excel.
- Upload no bucket → atualiza `relatorio_ia_execucoes.status='done'` + paths.
- Realtime na tabela notifica frontend.

### `relatorio-agendador` (cron)

- Roda a cada hora.
- Busca templates com `proxima_execucao <= now()`.
- Dispara `relatorio-ia` com o `spec_json` salvo (não precisa reconsultar Claude).
- Recalcula `proxima_execucao` pelo `agendamento_cron`.

## 6. Frontend

### Nova rota `/dashboard/relatorios-ia`

Três abas:

- **Criar relatório** — textarea grande para o prompt + chips de datasets sugeridos + dropdown de formato (PDF / XLSX / Ambos) + botão "Gerar".
- **Meus relatórios** — lista de execuções (on-demand expira em 30 dias). Preview inline do PDF (`StoragePreviewDialog`), download, "Salvar como template".
- **Templates** — biblioteca de templates do usuário + compartilhados. Cada template tem botões: Executar agora, Editar, Agendar (cron picker), Compartilhar com usuários.

### Componentes

- `RelatorioPromptComposer` — textarea + sugestões + chips de contexto
- `RelatorioExecucaoCard` — status badge, progresso, ações
- `TemplateAgendamentoDialog` — picker de cron amigável (diário 8h, semanal seg, mensal dia 1, custom)
- `CompartilharTemplateDialog` — multi-select de usuários
- `RelatorioPreviewSheet` — side sheet com PDF embed + metadados

### Acesso

- Item no sidebar "Relatórios IA" (visível conforme matriz — promotora/cliente veem versão restrita).
- Atalho no command palette (cmd+k → "Novo relatório IA").

## 7. Segurança e governança

- `secureHandler` em todas as edge functions (padrão do projeto).
- Validação Zod `.strict()` nos inputs do prompt (max 4000 chars, sanitização).
- Audit log obrigatório de cada tool call (LGPD).
- Rate limit: 10 relatórios on-demand por hora por usuário (configurável).
- Custo por execução salvo em `custo_usd` para dashboard admin acompanhar gasto Anthropic.
- Spec do template é congelada quando salva — re-execução de template **não chama Claude**, só re-renderiza com dados atualizados (economia massiva de tokens).

## 8. Memória do projeto a registrar

- `mem://ai/claude-relatorios-policy` — Claude Sonnet 4.5 reservado para relatórios; Lovable AI segue para resto.
- `mem://features/relatorios/ia-personalizados` — fluxo, templates congelados, expiração 30 dias.

## 9. Fases de entrega

**Fase 1 — Fundação (DB + Edge + Permissões)**
- Migração: tabelas, RLS, bucket, matriz de permissões seedada.
- RPCs `dataset_*` (6 iniciais).
- Edge `relatorio-ia` com Claude + tool use (sem render ainda — devolve JSON spec).
- Solicitar `ANTHROPIC_API_KEY` ao usuário.

**Fase 2 — Renderização**
- Edge `relatorio-render` com PDF (pdf-lib + SVG) e XLSX (exceljs).
- Realtime na execução.

**Fase 3 — UI**
- Rota `/dashboard/relatorios-ia` com as 3 abas.
- Sidebar + command palette.
- Preview, download, salvar como template.

**Fase 4 — Agendamento + compartilhamento**
- Edge `relatorio-agendador` (cron horário).
- Compartilhamento de templates.
- Dashboard admin de custo/uso.

## 10. Pré-requisito do usuário

Antes de começar a Fase 1, você precisará:

1. Criar conta em https://console.anthropic.com
2. Adicionar crédito (mínimo US$ 5 já roda muita coisa)
3. Gerar uma API key (`sk-ant-...`)
4. Quando eu pedir, colar no formulário seguro do Lovable

Sem isso a Fase 1 não roda. Posso começar a Fase 1 assim que você aprovar este plano e tiver a key em mãos.
