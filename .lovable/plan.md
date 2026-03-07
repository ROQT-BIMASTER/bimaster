

## Plano: Relatório Individual de Tarefas por Responsável

### Problema Atual
A IA já extrai o nome do responsável (`responsible`) de cada tarefa durante a análise da reunião, mas esse dado é **descartado** na hora de salvar no banco. A tabela `meeting_tasks` tem apenas `responsible_user_id` (UUID) e nenhum campo de texto para o nome mencionado na gravação.

### Mudanças Necessárias

#### 1. Migração: Adicionar coluna `responsible_name` na tabela `meeting_tasks`
```sql
ALTER TABLE public.meeting_tasks 
ADD COLUMN responsible_name text;
```
Campo de texto livre para armazenar o nome mencionado pela IA (ex: "João", "Dra. Maria").

#### 2. Edge Function: `meeting-analyze/index.ts`
Na linha onde as tarefas são inseridas (~511), incluir o campo `responsible` extraído pela IA:
```ts
responsible_name: t.responsible || null,
```

#### 3. Componente: `MeetingPrintReport.tsx`

**Nova opção no Dialog de configuração:**
- Adicionar uma nova seção selecionável: **"Relatório Individual por Responsável"**
- Quando marcada, exibir uma lista de checkboxes com os nomes únicos dos responsáveis extraídos das tarefas
- O usuário seleciona um ou mais nomes

**Novo tipo de impressão — Relatório Individual:**
- Cabeçalho: Logo + "Relatório de Tarefas — [Nome do Responsável]"
- Subtítulo: Nome da reunião, data, horário
- Tabela com as tarefas daquele responsável: tarefa, prioridade, departamento, prazo
- Campo de assinatura no rodapé: "Recebi e me comprometo com o cumprimento das tarefas acima"
- Linha para assinatura e data
- Cada responsável em página separada (page-break)

**Fluxo do usuário:**
1. Clica em "Relatório" → Dropdown → "Relatório Individual"
2. Dialog mostra lista de responsáveis com checkboxes
3. Seleciona os nomes desejados
4. Clica "Imprimir" → cada responsável sai em página separada, pronto para entregar

#### 4. Excel: Aba adicional
Na exportação Excel, adicionar aba "Por Responsável" com tarefas agrupadas por nome.

### Arquivos alterados
- **Migração SQL**: 1 coluna nova em `meeting_tasks`
- **`supabase/functions/meeting-analyze/index.ts`**: salvar `responsible_name`
- **`src/components/meetings/MeetingPrintReport.tsx`**: nova opção de relatório individual

### Notas Técnicas
- O campo é texto livre (não UUID) porque a IA extrai nomes da transcrição que podem não corresponder a usuários cadastrados
- Tarefas sem responsável identificado ficam agrupadas sob "Sem Responsável Definido"
- O relatório individual é otimizado para impressão A4 com visual profissional e campo de assinatura

