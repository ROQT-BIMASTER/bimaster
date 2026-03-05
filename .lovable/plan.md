

## Fix: Texto invisível no fundo preto

### Problema

O `ProjetoListView` recebe a prop `darkBg` mas **não a repassa** para `ProjetoSecao` (linha 106-120). Assim, todas as linhas de tarefas usam `darkBg = false` (o default), mantendo textos escuros sobre fundo preto.

### Correção

**Arquivo**: `src/components/projetos/ProjetoListView.tsx`

Adicionar `darkBg={darkBg}` na renderização de cada `ProjetoSecao` (linha ~120). Uma única linha resolve o problema — a cadeia `ProjetoSecao → ProjetoTarefaRow` já está preparada para receber e usar a prop.

