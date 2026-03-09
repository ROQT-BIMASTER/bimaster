

# Plano: Funcionalidades Completas para Coordenadora de Projetos

## Escopo

Implementar as 3 lacunas prioritárias identificadas na análise:

1. **Workflow de Aprovação Formal** — fluxo multi-etapa com registro de quem aprovou/rejeitou e quando
2. **Campo de Retrabalho** — marcar tarefas como retrabalho com motivo
3. **Dashboard de Equipe** — visão de produtividade por membro com carga de trabalho e atrasos

---

## 1. Workflow de Aprovação Multi-Etapa

### Migração SQL

Nova tabela `projeto_tarefa_aprovacoes` para registro granular de aprovações:

```sql
CREATE TABLE projeto_tarefa_aprovacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tarefa_id uuid NOT NULL REFERENCES projeto_tarefas(id) ON DELETE CASCADE,
  etapa text NOT NULL, -- 'regulatorio', 'qualidade', 'diretoria', 'arte', etc.
  status text NOT NULL DEFAULT 'pendente', -- 'pendente', 'aprovado', 'rejeitado'
  aprovador_id uuid,
  observacoes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(tarefa_id, etapa)
);
ALTER TABLE projeto_tarefa_aprovacoes ENABLE ROW LEVEL SECURITY;
```

RLS: acesso via `user_can_access_projeto` (mesma função existente).

### Frontend

- **Novo componente**: `ProjetoAprovacaoWorkflow.tsx` — painel lateral na tarefa mostrando etapas de aprovação como pipeline vertical (Regulatório → Qualidade → Diretoria)
- **Integração**: Adicionar aba "Aprovações" no `ProjetoTarefaDetalhe` (Sheet lateral)
- Coordenador define quais etapas a tarefa precisa; cada aprovador marca sua etapa
- Registro de audit: quem aprovou, quando, observação

---

## 2. Campo de Retrabalho nas Tarefas

### Migração SQL

Adicionar 2 colunas à `projeto_tarefas`:

```sql
ALTER TABLE projeto_tarefas ADD COLUMN tipo_tarefa text DEFAULT 'padrao'; -- 'padrao' | 'retrabalho'
ALTER TABLE projeto_tarefas ADD COLUMN motivo_retrabalho text;
```

### Frontend

- **`ProjetoTarefaRow.tsx`**: Badge visual "Retrabalho" (ícone RotateCcw laranja) quando `tipo_tarefa = 'retrabalho'`
- **`ProjetoTarefaDetalhe.tsx`**: Toggle "Marcar como Retrabalho" com campo de motivo (erro fabril, mudança regulatória, revisão arte, etc.)
- **`ProjetoHealthPanel.tsx`**: Novo card mostrando contagem de retrabalhos

---

## 3. Dashboard de Equipe/Produtividade

### Frontend (sem migração — usa dados existentes)

- **Nova aba**: "Equipe" no `ProjetoHeader` (ícone BarChart3)
- **Novo componente**: `ProjetoEquipeDashboard.tsx`

Conteúdo:
- **Cards por membro**: Avatar, nome, total de tarefas, concluídas, atrasadas, em andamento
- **Gráfico de barras**: Tarefas por membro (Recharts — já instalado)
- **Tabela de atrasos**: Lista de tarefas atrasadas agrupadas por responsável
- **Indicador de carga**: Barra de progresso mostrando % de conclusão por pessoa

---

## Arquivos Impactados

| Ação | Arquivo |
|------|---------|
| Migração | SQL: 1 tabela nova + 2 colunas adicionais |
| Novo | `src/components/projetos/ProjetoAprovacaoWorkflow.tsx` |
| Novo | `src/components/projetos/ProjetoEquipeDashboard.tsx` |
| Editado | `src/components/projetos/ProjetoTarefaDetalhe.tsx` (aba aprovações + toggle retrabalho) |
| Editado | `src/components/projetos/ProjetoTarefaRow.tsx` (badge retrabalho) |
| Editado | `src/components/projetos/ProjetoHealthPanel.tsx` (card retrabalho) |
| Editado | `src/components/projetos/ProjetoHeader.tsx` (nova aba "Equipe") |
| Editado | `src/pages/ProjetoDetalhe.tsx` (renderizar aba Equipe) |
| Editado | `src/hooks/useProjetoTarefas.ts` (incluir novos campos) |

