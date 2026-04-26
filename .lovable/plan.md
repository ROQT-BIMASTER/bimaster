# Plano: IA assistente no Modo Foco + Cor da tarefa vinculada ao projeto

## Contexto investigado
- A tela do print é `src/components/projetos/TarefaFocusMode.tsx` (Modo Foco da tarefa).
- Já existe a Edge Function `projeto-ia-assistant` com a ação `create_tasks` (cria seções + tarefas) e `generate_checklist` (gera marcos/checklist).
- Já existe o hook `src/hooks/useProjetoIA.ts` consumindo essas ações.
- A tabela `projetos` já possui as colunas `cor` (texto/hex) e `bg_cor` (background).
- Atualmente a tela do Modo Foco **não** propaga a cor do projeto, e o bloco de subtarefas só permite digitar manualmente — sem apoio de IA.

---

## 1. IA para criar tarefas e subtarefas (apoio ao usuário)

### 1.1 Nova ação na Edge Function `projeto-ia-assistant`
- **Ação `generate_subtasks`**: recebe `{ tarefaTitulo, tarefaDescricao, estagio, projetoNome, qtdSugerida? }` e retorna lista estruturada `{ subtarefas: [{ titulo, descricao?, ordem }] }` via tool calling (mesmo padrão das ações existentes — `gemini-2.5-flash` com fallback `gpt-5-mini`).
- Reaproveita `callAI()` já existente e o tratamento padronizado de 429/402.

### 1.2 Hook `useProjetoIA.ts`
- Adicionar `generateSubtasks(titulo, descricao, estagio, projetoNome, qtd?)` retornando `{ subtarefas: [...] }`.

### 1.3 UI no Modo Foco (`TarefaFocusMode.tsx`)
Na seção **Subtarefas**:
- Botão `Sparkles` "Sugerir com IA" ao lado do input de adicionar subtarefa.
- Ao clicar, abre um pequeno popover/`Sheet` lateral com:
  - Lista de sugestões (checkbox para selecionar quais aceitar)
  - Botão "Regenerar" (passa contexto da tarefa + descrição + estágio)
  - Botão "Adicionar selecionadas" → cria via `onAddSubtarefa` em loop.
- Toast de sucesso/erro com tratamento explícito de 402/429.

Na seção **Marcos** (já existente):
- Botão `Sparkles` "Gerar marcos com IA" reutilizando a ação **já existente** `generate_checklist` (sem nova função). Cada item gerado vira `addMeta.mutate({ descricao })`.

Na seção **Descrição**:
- Botão pequeno `Wand2` "Refinar descrição com IA" — chama nova ação `refine_description` (input: título + descrição atual + estágio; output: descricao polida em texto). Substitui o textarea após confirmação do usuário.

### 1.4 Permissões
- Botões de IA visíveis somente para o responsável da tarefa, criador, ou membros do projeto (papel ≠ visualizador). Usar `currentUserPapel` já carregado via `useProjetoMembros`.

---

## 2. Cor da tarefa acompanhando o projeto

### 2.1 Hook de cor do projeto
Como `tarefa.projeto_id` já está disponível, criar `src/hooks/useProjetoCor.ts`:
- Query leve `select id, cor, bg_cor, nome from projetos where id = ?` com `staleTime: 5min`.
- Retorna `{ cor, bgCor, nome }` com fallback para a cor `primary` do tema quando vazio.

### 2.2 Seletor de cor no Modo Foco (admin/criador/coordenador)
Adicionar no header do `TarefaFocusMode` um pequeno indicador clicável (bolinha colorida) que abre `Popover` com:
- Paleta de 10 cores predefinidas (`#E91E78`, `#3B82F6`, `#10B981`, `#F59E0B`, `#8B5CF6`, `#EC4899`, `#14B8A6`, `#EF4444`, `#6366F1`, `#0EA5E9`).
- Input hex opcional.
- Ao salvar → `update projetos set cor = ?, bg_cor = ?` (bg derivada com 15% de opacidade).
- Editável apenas se `currentUserPapel` em `["admin", "coordenador", "gestor_produto"]` ou usuário for criador do projeto.

### 2.3 Aplicação visual da cor (acompanha o projeto)
Aplicar a cor recuperada como acento sutil em:
- **Header do dialog**: borda inferior com `borderColor: cor` e badge do código da tarefa (`PAD-1614`) com `backgroundColor: bg_cor` e `color: cor`.
- **Separadores principais**: `Separator` com pequeno detalhe colorido na esquerda dos títulos de seção (Marcos, Descrição, Subtarefas, Briefing).
- **Botão "Marcar concluída"** quando ainda não concluída: outline com borda da cor do projeto.
- **Barra do gráfico de Evolução**: passar `cor` como prop para `TaskEvolutionChart` e usar como `stroke`/`fill` principal.

Importante: usar `style={{ color, backgroundColor }}` apenas para acentos — manter os tokens semânticos do design system (`bg-background`, `text-foreground`) para contraste e dark mode.

### 2.4 Propagação para outras telas (consistência)
- `ProjetoTarefaRow` (linha da tarefa na lista do projeto): faixa lateral colorida de 3px à esquerda usando a cor do projeto.
- `MinhasTarefasContent` (Central de Trabalho): mesma faixa lateral, indicando visualmente de qual projeto a tarefa pertence.
- Sem novas queries — reaproveitar `useProjetoCor` com cache compartilhado por `projeto_id`.

---

## 3. Arquivos afetados

| Arquivo | Mudança |
|---|---|
| `supabase/functions/projeto-ia-assistant/index.ts` | + ações `generate_subtasks` e `refine_description` |
| `src/hooks/useProjetoIA.ts` | + `generateSubtasks`, `refineDescription` |
| `src/hooks/useProjetoCor.ts` | **Novo** — busca cor/bg_cor do projeto |
| `src/components/projetos/TarefaFocusMode.tsx` | Botões IA (subtarefas, marcos, descrição) + seletor de cor + acentos visuais |
| `src/components/projetos/TaskEvolutionChart.tsx` | Aceitar prop `accentColor` |
| `src/components/projetos/ProjetoTarefaRow.tsx` | Faixa lateral colorida |
| `src/components/projetos/central/MinhasTarefasContent.tsx` | Faixa lateral colorida |

## 4. Tratamento de erros (governança IA)
- 402 → toast: "Créditos de IA insuficientes. Adicione créditos em Configurações → Workspace → Uso."
- 429 → toast: "Muitas requisições à IA. Aguarde alguns segundos e tente novamente."
- Falha de tool_call → fallback automático já tratado em `callAI()`.

## 5. Fora de escopo
- Treinamento de modelo customizado.
- Geração de imagens nesta tela.
- Edição de cor por tarefa individual (a cor é **do projeto** e propaga; isso é proposital para consistência visual).
