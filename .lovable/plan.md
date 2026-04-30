
# Compartilhamento de Projetos + Produtividade & Custos

Vou estender o módulo **Projetos** (que já tem `projetos`, `projeto_tarefas`, `projeto_membros`, `projeto_convites`, `projeto_tarefa_messages`) com 3 capacidades novas, sem refazer o que já existe.

---

## 1. Compartilhamento por convite (com login)

Reaproveita `projeto_convites` + `projeto_membros` que já estão no banco.

- **Botão "Compartilhar"** no `ProjetoHeader.tsx` abre um diálogo (`CompartilharProjetoDialog`) com:
  - Campo de e-mail + papel (`viewer`, `editor`, `admin`).
  - Lista de membros atuais com opção de remover/alterar papel.
  - Lista de convites pendentes com reenviar/cancelar.
- **Edge function `projeto-convidar`** (já existe `projeto_convites` — preciso confirmar se há função; senão crio) envia e-mail via Lovable Emails com link `/projetos/convite/:token`.
- A página `ConviteAceitar.tsx` já existe — apenas garanto fluxo: usuário sem conta cai no signup, depois é vinculado ao `projeto_membros`.

## 2. Chat de produtividade com resumo diário automático

**Onde**: aba "Atividade" do projeto, usando a tabela existente `projeto_tarefa_messages` (escopo projeto, não só tarefa) — vou adicionar uma tabela irmã **`projeto_chat_messages`** se hoje só existe por tarefa.

**Como funciona**:
- Toda noite às 19h (cron `pg_cron` + edge function `projeto-resumo-diario`), para cada projeto ativo:
  1. Busca tarefas concluídas no dia, horas registradas, custos lançados.
  2. Gera mensagem markdown agrupada por pessoa, ex.:
     ```
     Resumo de 30/04/2026
     - João: concluiu 3 tarefas (8h) — R$ 480
     - Maria: concluiu 1 tarefa (4h) — R$ 320
     Custo Lovable do dia (rateado): R$ 35
     Total do dia: R$ 835
     ```
  3. Posta no chat do projeto como `tipo: "resumo_diario"` (autor = sistema).
- Membros recebem notificação no `NotificationBell`.

## 3. Horas trabalhadas + custos de tecnologia (semi-automático)

**Tabelas novas**:

- **`projeto_horas_lancamentos`**: `tarefa_id`, `user_id`, `data`, `horas (numeric 4,2)`, `descricao`, `custo_hora_snapshot`.
- **`projeto_custo_hora_pessoa`**: `user_id`, `custo_hora`, `vigente_desde` (histórico para snapshot correto).
- **`projeto_custos_tecnologia_mensal`**: `mes` (date), `fornecedor` (Lovable, OpenAI, Supabase, outros), `valor`, `descricao`. Lançado manualmente pelo admin.
- **`projeto_rateio_tecnologia`**: view materializada que rateia o custo mensal entre projetos ativos no mês, proporcional às horas registradas (ou igualitário se sem horas).

**UI**:
- Em cada tarefa (`ProjetoTarefaDetalhe`), mini-painel "Horas" com botão "+ Registrar horas hoje".
- Nova página **`/projetos/:id/produtividade`** com:
  - KPIs: horas totais, custo de pessoas, custo de tecnologia rateado, custo total do projeto.
  - Gráfico de horas por semana e por pessoa (Recharts).
  - Tabela detalhada por tarefa.
- Página admin **`/admin/projetos/custos-tecnologia`** para lançar fatura mensal de cada fornecedor.

## 4. Backfill histórico via IA (Sofia)

**Tela `/projetos/:id/produtividade/backfill`**:

1. Lista todas as tarefas concluídas do projeto agrupadas por mês.
2. Botão "Estimar com IA" chama edge function `projeto-estimar-horas-historico` que:
   - Envia para `google/gemini-2.5-pro` (via Lovable AI Gateway) o título, descrição, complexidade e duração entre criação/conclusão de cada tarefa.
   - Retorna `horas_estimadas` por tarefa + justificativa.
3. Tela mostra grid editável (você revisa cada estimativa antes de aprovar).
4. Botão "Aprovar todas" cria os registros em `projeto_horas_lancamentos` com `origem: "ia_backfill"` e `aprovado_por: user.id`.
5. Custos de tecnologia retroativos são lançados manualmente em `projeto_custos_tecnologia_mensal` (você informa o histórico mês a mês — uma planilha simples de input).

---

## Detalhes técnicos

**Migrations** (ordem):
1. `projeto_chat_messages` (id, projeto_id, user_id, conteudo, tipo, metadata, created_at) + RLS por membro.
2. `projeto_custo_hora_pessoa`, `projeto_horas_lancamentos`, `projeto_custos_tecnologia_mensal`.
3. View `vw_projeto_produtividade` agregando horas + custo + rateio.
4. Cron `pg_cron` chamando `projeto-resumo-diario` às 22h UTC (19h BRT).

**Edge functions** (todas com `secureHandler` + Zod strict):
- `projeto-resumo-diario` — gera mensagens automáticas.
- `projeto-estimar-horas-historico` — IA via `google/gemini-2.5-pro`.
- `projeto-convidar` — envia e-mail (se ainda não existir).

**RLS**:
- `projeto_horas_lancamentos`: SELECT/INSERT por membro do projeto; UPDATE/DELETE só pelo autor ou admin do projeto.
- `projeto_custos_tecnologia_mensal`: somente admin do sistema (verificar via `has_role`).
- `projeto_chat_messages`: SELECT por membro, INSERT por membro autenticado.

**Frontend novo**:
- `src/components/projetos/CompartilharProjetoDialog.tsx`
- `src/components/projetos/ProjetoChatTab.tsx`
- `src/components/projetos/ProjetoHorasMiniPanel.tsx`
- `src/pages/projetos/ProdutividadePage.tsx`
- `src/pages/projetos/BackfillHorasPage.tsx`
- `src/pages/admin/CustosTecnologiaPage.tsx`
- Hooks: `useProjetoChat`, `useProjetoHoras`, `useProjetoProdutividade`, `useEstimarHorasIA`.

**Versão**: bump APP_VERSION para `3.4.47` + entrada no changelog `ApiDocumentation.tsx` (regra do projeto).

---

## Entrega em 3 fases (para implementar uma de cada vez se preferir)

| Fase | Escopo | Esforço |
|---|---|---|
| **1** | Compartilhamento (convite + papéis) + chat do projeto com resumo diário | Médio |
| **2** | Lançamento manual de horas + custos de tecnologia + dashboard de produtividade | Médio |
| **3** | Backfill histórico com IA + revisão em massa | Pequeno |

Posso começar pela Fase 1, ou implementar tudo em sequência.
