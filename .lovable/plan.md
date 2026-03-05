

## Plano: Briefing como Planilha Interna com Criação Opcional de Tarefas

### Mudança de Conceito
O fluxo atual cria tarefas diretamente. O novo fluxo é:
1. **Upload Excel** → IA extrai e organiza os dados estruturados
2. **Armazena como planilha interna** no banco (tabela `projeto_briefings` + `projeto_briefing_campos`)
3. **Visualização** em formato de tabela dentro da seção com briefing ativo
4. **Opcional**: botão "Criar Tarefas a partir do Briefing" para quem quiser gerar tarefas

### 1. Nova Tabela: `projeto_briefings`
Armazena o briefing importado por seção:
```sql
CREATE TABLE projeto_briefings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  projeto_id uuid REFERENCES projetos(id) ON DELETE CASCADE NOT NULL,
  secao_id uuid REFERENCES projeto_secoes(id) ON DELETE CASCADE NOT NULL,
  nome_arquivo text NOT NULL,
  created_at timestamptz DEFAULT now(),
  user_id uuid NOT NULL
);
```

### 2. Nova Tabela: `projeto_briefing_campos`
Cada linha/campo extraído da planilha:
```sql
CREATE TABLE projeto_briefing_campos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  briefing_id uuid REFERENCES projeto_briefings(id) ON DELETE CASCADE NOT NULL,
  categoria text NOT NULL,        -- 'PRODUTO', 'ROTULAGEM', 'COMPRAS E EMBALAGEM'
  campo text NOT NULL,            -- 'Nome comercial', 'Composição em EN', etc.
  valor text,                     -- conteúdo extraído
  responsabilidade text,          -- 'D', 'C', 'R', 'E', 'COMP'
  ordem int DEFAULT 0
);
```

### 3. Edge Function `importar-briefing-ia` (Atualizar)
Em vez de retornar tarefas, a IA retorna os **campos estruturados** do briefing:
- Categoria, campo, valor, responsabilidade
- Organizado nas 3 seções da planilha (Produto, Rotulagem, Compras)
- Salva diretamente no banco após confirmação do usuário

### 4. Componente `BriefingImportDialog` (Refatorar)
Fluxo de 2 etapas:
- **Upload**: Envia Excel, IA extrai campos estruturados
- **Review**: Exibe os campos organizados por categoria para o usuário confirmar → salva no banco

### 5. Novo Componente `BriefingView`
Exibido dentro da seção quando `tem_briefing = true` e existe briefing salvo:
- Tabela visual com os campos organizados por categoria (Produto, Rotulagem, Compras)
- Badges de responsabilidade (D, C, R, E, COMP)
- Botão **"Criar Tarefas"** que abre um segundo dialog para gerar tarefas a partir dos campos do briefing (reusa a lógica de IA existente)

### 6. RLS Policies
- Select/Insert/Update/Delete para usuários autenticados com base no `projeto_id`

### Arquivos a Criar/Editar
- **Migração SQL**: criar `projeto_briefings` e `projeto_briefing_campos` + RLS
- **Editar**: `supabase/functions/importar-briefing-ia/index.ts` — retornar campos estruturados em vez de tarefas
- **Refatorar**: `src/components/projetos/BriefingImportDialog.tsx` — novo fluxo de import + save
- **Criar**: `src/components/projetos/BriefingView.tsx` — visualização da planilha interna
- **Criar**: `src/components/projetos/BriefingToTasksDialog.tsx` — criação opcional de tarefas
- **Editar**: `src/components/projetos/ProjetoSecao.tsx` — exibir `BriefingView` quando ativo
- **Criar**: `src/hooks/useProjetoBriefing.ts` — hook para CRUD do briefing

