

## Plano: Ativar Briefing por Seção e Tarefa

### Objetivo
Permitir que o usuário marque uma **Seção** e/ou **Tarefa** como "possui Briefing", ativando assim a funcionalidade de importação e gestão de Briefing naquele contexto.

### 1. Migração de Banco de Dados

Adicionar coluna `tem_briefing` (boolean, default false) nas tabelas:
- `projeto_secoes` — indica que a seção trabalha com briefings
- `projeto_tarefas` — indica que a tarefa individual possui briefing

```sql
ALTER TABLE projeto_secoes ADD COLUMN tem_briefing boolean NOT NULL DEFAULT false;
ALTER TABLE projeto_tarefas ADD COLUMN tem_briefing boolean NOT NULL DEFAULT false;
```

### 2. UI da Seção — Toggle de Briefing

No componente `ProjetoSecao.tsx`, adicionar um ícone/botão no cabeçalho da seção (ao lado do nome) que permite ativar/desativar o briefing da seção:
- Ícone `FileSpreadsheet` com estado visual (ativo = cor primária, inativo = muted)
- Ao ativar, todas as tarefas da seção ganham acesso ao módulo de briefing
- Tooltip explicativo: "Ativar Briefing nesta seção"

### 3. UI da Tarefa — Toggle de Briefing

No painel de detalhe da tarefa (`ProjetoTarefaDetalhe.tsx`), adicionar um checkbox/switch na área de metadados:
- Label: "Possui Briefing"
- Quando ativado, exibe a área de importação/gestão do briefing na tarefa
- Herda automaticamente o estado da seção (se a seção tem briefing, tarefa inicia com briefing ativo)

### 4. Botão "Importar Briefing" Condicional

O botão de importação de briefing (Excel → IA) aparece apenas quando:
- A seção tem `tem_briefing = true`, ou
- A tarefa individual tem `tem_briefing = true`

Será renderizado:
- No cabeçalho da seção (se seção tem briefing) — importa para todas as tarefas daquela seção
- No detalhe da tarefa (se tarefa tem briefing) — importa apenas para aquela tarefa

### 5. Hook e Mutations

Atualizar `useProjetoTarefas.ts`:
- Incluir `tem_briefing` no select de seções e tarefas
- Adicionar mutation para toggle do briefing na seção
- O toggle da tarefa já é coberto pelo `updateTarefa` existente

### Arquivos a Criar/Editar
- **Migração SQL**: adicionar colunas `tem_briefing`
- **Editar**: `src/hooks/useProjetoTarefas.ts` — incluir campo e mutation de seção
- **Editar**: `src/components/projetos/ProjetoSecao.tsx` — botão toggle briefing no header
- **Editar**: `src/components/projetos/ProjetoTarefaDetalhe.tsx` — switch briefing + área condicional
- **Criar**: `src/components/projetos/BriefingImportDialog.tsx` — dialog de importação (exibido condicionalmente)
- **Criar**: `supabase/functions/importar-briefing-ia/index.ts` — edge function para parsing com IA

