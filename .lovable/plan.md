

# Adicionar Linhas de Grade Verticais na Tabela de Projetos (Estilo Asana)

## Problema

A tabela de tarefas do projeto tem apenas linhas horizontais (`border-b`). O Asana exibe grades completas com divisórias verticais entre cada célula de coluna.

## Solução

Adicionar bordas verticais (`border-r`) em cada célula da grid no `ProjetoTarefaRow.tsx`, criando o efeito de grade completa igual ao Asana. A borda será sutil (`border-white/10` no dark, `border-border/40` no light).

### Arquivo: `src/components/projetos/ProjetoTarefaRow.tsx`

1. **Cada `div` de célula** (Expand toggle, Checkbox, Title, Produto, Responsável, Status, Timeline, Prazo, Prioridade) recebe uma classe de borda direita:
   - Dark: `border-r border-white/10`
   - Light: `border-r border-border/40`

2. **A última célula visível** não recebe `border-r` (ou usa a mesma — Asana aplica em todas).

3. **O separador existente** (linha 181: `<div className="w-px h-5 ...">`) pode ser removido, pois as bordas verticais de cada célula já cumprem esse papel.

4. **Adicionar padding uniforme** em cada célula (`px-2`) para dar respiro entre o conteúdo e as bordas, similar ao Asana.

### Arquivo: `src/components/projetos/ProjetoSecao.tsx` (header opcional)

Se houver uma linha de cabeçalho com nomes de colunas, aplicar o mesmo padrão de `border-r` para alinhar as grades.

### Arquivo: `src/components/projetos/ProjetoListView.tsx`

Verificar se o header da lista (se existir) também precisa das bordas verticais para consistência.

## Impacto Visual

- Grade completa com linhas horizontais e verticais
- Aparência de planilha/spreadsheet similar ao Asana
- Cores sutis que não competem com o conteúdo

