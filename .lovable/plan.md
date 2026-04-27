## Objetivo

Transformar os ambientes atuais (Central de Trabalho de Projetos, Inbox, sino de notificações, Motor de Artes, Aprovações, Composição) em **um modelo único de “caixa de entrada” estilo email**, com duas camadas:

1. **Inbox Global (drawer lateral)** — disponível em qualquer tela, agrega tudo que é meu (Projetos + Processos + Motor de Artes + China + Aprovações).
2. **Central de Trabalho do Módulo** — réplica da lógica da Central de Projetos, mas escopada à equipe de cada módulo (Aprovações, Motor de Artes, Composição, Embalagens, Amostras). Uma “sala de trabalho” por módulo, com Hoje / Minhas Tarefas / Inbox / Equipe.

Tudo regido por regras simples para o usuário não confundir: **caixas → leitura híbrida → ações em lote**.

---

## 1. Modelo conceitual (regra prática única)

Cada item da inbox tem 3 dimensões que ditam onde ele aparece e como sai:

| Dimensão | Valores | Efeito |
|---|---|---|
| **Caixa** | `acao_minha` · `atribuida_a_mim` · `acompanho` · `delegada_por_mim` | Define em qual caixa lateral aparece |
| **Origem** | `projetos` · `processos` · `motor_artes` · `china` · `aprovacoes` · `composicao` · `embalagens` · `amostras` | Filtro tipo “rótulo” no topo |
| **Modo de leitura** | `auto` (lido ao abrir) · `acao` (só sai ao agir) | Definido pelo tipo do evento |

**Modo de leitura híbrido — regras fixas:**
- `auto`: comentários, menções, mudança de status informativa, projeto criado/movido.
- `acao`: aprovar arte, selecionar documento de evidência (espelho), responder “ação solicitada”, gate pendente do Motor de Artes, etapa de processo aguardando minha aprovação, recebimento de amostra a confirmar.

Item em modo `acao` **não some ao abrir** — só sai quando o trabalho é resolvido (ou snooze/arquivar manual). Isso resolve o medo de “limpar sem querer”.

---

## 2. Backend — schema e regras

### 2.1 Tabela `inbox_items` (nova, projeção unificada)
Materializa em uma única fila tudo que hoje vive espalhado em `notifications`, `projeto_atividades`, `processo_tarefa_espelho` (com `acao_solicitada_em`), gates do Motor de Artes e pendências de Aprovação.

Colunas principais:
- `id`, `user_id` (destinatário), `caixa` (enum acima), `origem` (enum acima)
- `tipo` (ex: `mencao`, `comentario`, `aprovar_arte`, `evidencia_pendente`, `gate_pendente`, `etapa_aprovacao`, `recebimento_amostra`)
- `modo_leitura` (`auto` | `acao`)
- `titulo`, `resumo`, `action_url`
- `referencia_tipo`, `referencia_id` (para deep-link)
- `projeto_id`, `processo_id`, `etapa_id`, `modulo` (escopos para a Central do Módulo)
- `lido_em`, `arquivado_em`, `favorito`, `snooze_ate`, `resolvido_em`, `resolvido_por`
- `created_at`

RLS estrita: `user_id = auth.uid()` para SELECT/UPDATE; INSERT só via SECURITY DEFINER.

### 2.2 Função `inbox_emit(...)` (SECURITY DEFINER)
Único ponto de entrada. Triggers já existentes passam a chamar essa função em vez de criar registros direto:
- Triggers de `processo_tarefa_espelho` → emite `evidencia_pendente`, `acao_solicitada`, `concluida_com_evidencia`.
- Triggers de `projeto_atividades` → emite `mencao`, `comentario`, `tarefa_atribuida`.
- Motor de Artes (hooks/triggers em `fluxo_artes_*`) → emite `gate_pendente`, `af_recebida`, `arte_reprovada`.
- Aprovações (`fluxo_aprovacao_*`) → emite `etapa_aprovacao`.
- Vincular China → emite `submissao_pendente`, `recebimento_amostra`.

A função aplica as **preferências de notificação** já existentes (`notification_preferences`) e respeita o `user_accepts_notification`.

### 2.3 Função `inbox_resolver_item(item_id)` (SECURITY DEFINER)
Marca item `acao` como resolvido quando a ação raiz acontece (ex: ao concluir uma tarefa espelhada com evidência, ao aprovar a arte). Triggers nas tabelas de origem chamam essa função para garantir consistência (item nunca fica órfão na caixa).

### 2.4 Aproveitamento do que já existe
- Mantém `notifications` (sino) e `notification_preferences`.
- O sino vira **um “resumo dos não lidos” da inbox**, e o botão “Abrir caixa de entrada” abre o drawer global.
- Mantém `projeto_atividades` como log de auditoria do módulo Projetos — a inbox **lê dali**, não duplica.

---

## 3. Frontend — Inbox Global (drawer)

### 3.1 Componente `<InboxDrawer />`
- Acionado pelo sino atual (`NotificationBell.tsx`) — clique no sino abre o drawer (não mais o popover atual).
- Layout estilo Gmail/Superhuman:
  - **Coluna esquerda (240px)**: 4 caixas com contadores
    - 📥 Ação minha (badge pulsante se houver item bloqueante)
    - ✅ Atribuídas a mim
    - 👁 Acompanho
    - 📤 Delegadas por mim
    - Separador → ⭐ Favoritos · 💤 Adiadas (snooze) · 🗄 Arquivadas
  - **Coluna meio (lista)**: itens com checkbox, ícone de origem, título, resumo curto, idade, badge de tipo. Filtros no topo: rótulos por origem (Projetos / Processos / Artes / China / Aprovações / Composição / Embalagens / Amostras), busca, ordenação, “mostrar só não lidos”.
  - **Coluna direita (preview)**: detalhe do item com botões contextuais (Concluir, Selecionar evidência, Aprovar, Adiar, Arquivar, Abrir no módulo).
- **Atalhos de teclado** (estilo email): `j/k` navegar, `e` arquivar, `s` favoritar, `z` snooze, `Enter` abrir no módulo, `g i` ir pra inbox, `g a` Ação minha.

### 3.2 Ações em lote
Selecionar múltiplos → `Marcar como lido`, `Arquivar`, `Adiar para…`, `Reatribuir`, `Reenviar como ação solicitada` (já existe a base com `reenviar_alertas_espelhos_pendentes`, vamos generalizar).

### 3.3 Snooze
Adiciona `snooze_ate`. Item desaparece da caixa até a data, depois retorna no topo de “Ação minha” com badge `Voltou do snooze`.

### 3.4 Integração com sino
- O sino mostra apenas a contagem de **Ação minha** (não o total) — alinha com a regra híbrida.
- Hover no sino mostra mini-preview com as 5 mais recentes de Ação minha + “Abrir caixa de entrada”.

---

## 4. Frontend — Central de Trabalho **por Módulo**

A Central de Projetos atual (`/dashboard/projetos/central`) é genérica. Vamos extrair seu layout em um componente reutilizável `<CentralTrabalhoModulo />` e instanciar em cada módulo:

### 4.1 Componente reutilizável `<CentralTrabalhoModulo modulo="..." />`
Mesmo layout (Hoje · Minhas Tarefas · Inbox · Equipe · Resumo Semanal), mas:
- Filtros automáticos: só itens cuja `origem === modulo` ou que pertencem a projetos/processos taggeados como daquele módulo.
- “Equipe” lista quem é membro do módulo (não o workspace inteiro).

### 4.2 Rotas novas (sob cada módulo, sem mexer na sidebar global)
- `/dashboard/aprovacoes/central`
- `/dashboard/fluxo-artes/central`
- `/dashboard/composicao/central`
- `/dashboard/embalagens/central` (a definir conforme rota atual)
- `/dashboard/amostras/central` (idem)

Cada rota é um wrapper de 3 linhas que renderiza `<CentralTrabalhoModulo modulo="motor_artes" />`, etc.

### 4.3 Acesso ao módulo
No header de cada módulo (Motor de Artes, Aprovações, Composição…), adicionar botão **“Central do Módulo”** ao lado de “+ Novo …”, levando à rota acima. Igualzinho ao botão Central que já existe em Projetos.

### 4.4 Vínculo com Projetos & Processos (a regra prática)
- Cada item na Central do Módulo **mostra os badges de vínculo** (`<VinculoProjetoBadges />` já existe) — com o projeto/seção/tarefa e a etapa do processo.
- Concluir um item da Central do Módulo dispara o mesmo motor de espelho já implementado: se houver tarefa de Projetos vinculada, abre `<ConcluirComEvidenciaDialog />`; se houver etapa de Processo, atualiza checklist.
- Esse comportamento já existe no Projetos — vamos só **garantir paridade** ao chamar `toggleTarefaCompleta` a partir das Centrais de Módulo.

---

## 5. Mapa de mudanças por arquivo

**Backend (migrations)**
- `create_inbox_items_and_emit.sql` — tabela `inbox_items`, RLS, índices, enums `inbox_caixa`/`inbox_origem`/`inbox_modo_leitura`, função `inbox_emit`, função `inbox_resolver_item`, função `inbox_snooze`, função `inbox_marcar_lote`.
- `inbox_triggers_origens.sql` — triggers em `projeto_atividades`, `processo_tarefa_espelho`, `fluxo_artes`, `fluxo_aprovacao_etapas`, `china_produto_submissoes`, `recebimento_amostras` chamando `inbox_emit`.

**Hooks**
- `src/hooks/useInbox.ts` (novo) — list/group por caixa, contadores, ações em lote, snooze, mark-as-read, resolver. Realtime via `supabase.channel('inbox_items')`.
- `src/hooks/useInboxKeyboard.ts` (novo) — atalhos.
- `src/hooks/useNotifications.ts` — passa a derivar contagem da inbox (caixa `acao_minha`).

**Componentes — Inbox Global**
- `src/components/inbox/InboxDrawer.tsx` (novo) — drawer 3 colunas, montado em `App.tsx`.
- `src/components/inbox/InboxCaixaList.tsx` (novo)
- `src/components/inbox/InboxItemRow.tsx` (novo)
- `src/components/inbox/InboxItemPreview.tsx` (novo) — render dinâmico por `tipo`/`origem` com CTAs corretos (reusa `<ConcluirComEvidenciaDialog/>`, etc.)
- `src/components/inbox/InboxBulkBar.tsx` (novo)
- `src/components/inbox/InboxFiltrosOrigem.tsx` (novo) — chips estilo Gmail.
- `src/components/notifications/NotificationBell.tsx` (alterado) — clique abre o drawer; mostra badge de Ação minha.

**Componentes — Central por Módulo**
- `src/components/central/CentralTrabalhoModulo.tsx` (novo) — extrai o layout atual de `CentralTrabalho.tsx`, recebe prop `modulo`.
- `src/pages/CentralTrabalho.tsx` (refatorado) — renderiza `<CentralTrabalhoModulo modulo="projetos" />`. Mantém URL e comportamento atuais.
- `src/pages/aprovacoes/CentralAprovacoes.tsx` (novo)
- `src/pages/fluxo-artes/CentralMotorArtes.tsx` (novo)
- `src/pages/composicao/CentralComposicao.tsx` (novo)
- (idem para Embalagens / Amostras conforme estrutura atual)
- `src/App.tsx` — registra novas rotas + monta `<InboxDrawer />` global.

**Headers de módulo (botão “Central do Módulo”)**
- `src/pages/FluxoArtesMotor.tsx` — botão ao lado de “+ Novo Checklist”.
- `src/pages/FluxoAprovacaoArtes.tsx`
- `src/pages/ChecklistComposicao.tsx`
- (Embalagens/Amostras conforme telas reais)

---

## 6. Como o usuário enxerga (regra de uso prática)

1. **Sino sempre visível** → mostra só Ação minha. Clique abre a **Caixa de Entrada Global** em drawer.
2. Dentro do drawer, 4 caixas (Ação minha · Atribuídas · Acompanho · Delegadas) + filtro por origem (Projetos · Processos · Artes · China · Aprovações · Composição · Embalagens · Amostras).
3. **Comentário/menção**: abriu, leu — lido. **Aprovação/evidência/gate**: só sai ao agir. Sem ambiguidade.
4. Cada **módulo** tem sua **Central do Módulo** (igual a “Central do Projetos” mas para a equipe daquele módulo) — para o time daquele módulo trabalhar focado.
5. Ações em lote (arquivar, adiar, reenviar como ação solicitada) tanto na Inbox Global quanto na Central de cada módulo.

---

## 7. Riscos & mitigações

- **Volume**: triggers em muitas tabelas podem multiplicar inserts. Mitigação: `inbox_emit` deduplica por (`user_id`, `referencia_tipo`, `referencia_id`, `tipo`) usando upsert + bump de `created_at` quando reaberto.
- **Compat**: nada do que existe é removido; `notifications`, `projeto_atividades`, `processo_tarefa_espelho` continuam intactos. A inbox é projeção/cache.
- **Curva de aprendizado**: incluir tour de 4 passos na primeira abertura do drawer + tooltip dos atalhos (`?` exibe a folha de atalhos).

---

## 8. Entregáveis desta primeira rodada

1. Migração da tabela + função `inbox_emit` + triggers nas origens já implementadas (Projetos, Processos, Espelhos, Motor de Artes, China).
2. Drawer global funcional com 4 caixas, filtros por origem, regra híbrida, snooze, ações em lote, atalhos.
3. Refator de `CentralTrabalho` em componente reutilizável + rotas e botões para **Aprovações** e **Motor de Artes** (Composição/Embalagens/Amostras numa rodada seguinte para validar primeiro a UX nesses dois).
4. `NotificationBell` redirecionando para o drawer e mostrando contagem só de Ação minha.