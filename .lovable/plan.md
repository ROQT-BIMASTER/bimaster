## Objetivo

Tornar o módulo de Aprovações auto-explicativo: ao entrar pela primeira vez, o usuário já encontra **um fluxo padrão pronto** e **um Kanban com um lote de exemplo** mostrando como o sistema funciona, sem precisar configurar nada.

---

## O que será entregue

### 1. Fluxo padrão "Aprovação Padrão (Modelo)" pré-criado

Inserido via seed na tabela `fluxo_aprovacao_config` com 4 etapas padrão em `fluxo_aprovacao_etapas`:

```text
[1] Revisão Técnica       → simples   → prazo 2 dias
[2] Aprovação Gerencial   → simples   → prazo 3 dias
[3] Validação Regulatória → simples   → prazo 2 dias
[4] Aprovação Final       → paralela  → prazo 1 dia
```

- Marcado como `ativo = true`, `descricao` explicando que é um modelo educativo.
- Sem `responsavel_id` fixo (usuário ajusta depois ou usa como base para duplicar).
- Inserido apenas se ainda não existir um config com `nome = 'Aprovação Padrão (Modelo)'` (idempotente).

### 2. Botão "Usar este modelo" em `/admin/templates-alcadas`

- Card destacado no topo da lista mostrando o template padrão com badge "Modelo recomendado".
- Botão **"Duplicar como meu fluxo"** que copia config + etapas com novo nome editável.
- Botão **"Editar etapas"** para ajustar diretamente.

### 3. Empty state educativo no Kanban (`CentralAprovacoes` e `AprovacoesDashboard`)

Quando o usuário não tem nenhum lote visível, em vez do texto atual "Nenhuma aprovação para os filtros selecionados", mostrar:

- **Card de boas-vindas** explicando o que é o Kanban de aprovações em 3 passos:
  1. Crie um lote de aprovação dentro de uma tarefa
  2. O lote percorre as etapas do fluxo (cada coluna = uma etapa)
  3. Aprovadores recebem notificação e movem o card aprovando ou rejeitando

- **Mini Kanban ilustrativo (estático)** com 4 colunas e cards fictícios mostrando como ficará — apenas visual, sem dados reais. Usa os mesmos componentes de coluna/card com flag `demo`.

- **Botão "Ver fluxo padrão"** que leva a `/admin/templates-alcadas` com o template selecionado.
- **Botão "Como criar um lote?"** que abre um Dialog com tutorial passo-a-passo (texto + screenshots/ícones).

### 4. Tutorial inline no `CriarLoteDialog`

Acima do formulário, banner colapsável (lembrado em `localStorage`) explicando:
- O que é um "lote de aprovação"
- Por que selecionar documentos
- O que acontece após criar (vai para a primeira etapa do fluxo)

Pré-seleciona o template padrão se for o único disponível ou se for o primeiro uso.

---

## Detalhes técnicos

### Migration (idempotente)

```sql
-- supabase/migrations/<timestamp>_seed_fluxo_aprovacao_padrao.sql
DO $$
DECLARE v_config_id uuid;
BEGIN
  SELECT id INTO v_config_id FROM public.fluxo_aprovacao_config
   WHERE nome = 'Aprovação Padrão (Modelo)';

  IF v_config_id IS NULL THEN
    INSERT INTO public.fluxo_aprovacao_config (nome, checklist_tipo, descricao, ativo)
    VALUES (
      'Aprovação Padrão (Modelo)',
      'artes_geral',
      'Modelo educativo com 4 etapas. Duplique e ajuste os responsáveis.',
      true
    ) RETURNING id INTO v_config_id;

    INSERT INTO public.fluxo_aprovacao_etapas
      (config_id, nome, ordem, tipo_aprovacao, prazo_dias, ativo)
    VALUES
      (v_config_id, 'Revisão Técnica',       0, 'simples',  2, true),
      (v_config_id, 'Aprovação Gerencial',   1, 'simples',  3, true),
      (v_config_id, 'Validação Regulatória', 2, 'simples',  2, true),
      (v_config_id, 'Aprovação Final',       3, 'paralela', 1, true);
  END IF;
END $$;
```

### Arquivos novos

- `src/components/projetos/aprovacoes/AprovacoesEmptyState.tsx` — card educativo + mini-kanban demo + CTAs.
- `src/components/projetos/aprovacoes/ComoCriarLoteDialog.tsx` — tutorial passo-a-passo.

### Arquivos editados (apenas UI)

- `AprovacoesDashboard.tsx` — substituir bloco "Nenhuma aprovação..." por `<AprovacoesEmptyState />` quando não houver itens em **nenhum** filtro (não só no atual).
- `FluxoAprovacaoConfig.tsx` — destacar template padrão no topo + botão "Duplicar como meu fluxo" (cópia local via `INSERT` reaproveitando hooks existentes).
- `CriarLoteDialog.tsx` — banner colapsável de ajuda + pré-seleção do template padrão.

### O que NÃO muda

- Nenhuma alteração em RLS, RPCs, edge functions, hooks de dados.
- Nenhuma criação de tarefas/lotes reais — o "Kanban demo" é puramente visual (props estáticas).
- Nenhuma quebra em produção: a migration só insere se não existir.

---

## Critérios de aceite

1. Após o deploy, em qualquer projeto/usuário, `/admin/templates-alcadas` mostra "Aprovação Padrão (Modelo)" com 4 etapas e botão "Duplicar".
2. `/dashboard/central/aprovacoes` sem lotes pendentes mostra empty state ilustrativo com mini-kanban demo e CTAs claros.
3. Em `CriarLoteDialog`, o select de template já vem com "Aprovação Padrão (Modelo)" pré-selecionado.
4. Tudo funciona sem nenhuma ação manual de admin.
