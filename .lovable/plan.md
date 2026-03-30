

# Analise da Tela Vincular China — Problemas e Melhorias para Desktop

## Teste Realizado

A navegacao pelo browser redirecionou para login (sem sessao autenticada no browser de teste). A analise foi feita inteiramente pelo codigo-fonte dos 7 componentes que compoem a tela.

---

## Problemas Encontrados

### 1. `(supabase as any)` em TODA a logica de vinculacao (BUG de type-safety)

`ProjetoVincularChina.tsx` usa `as any` em **8 queries** diferentes (`produtos_brasil`, `produto_brasil_checklist`, `product_process`, `process_events`, `process_step_history`). Se qualquer dessas tabelas for renomeada ou tiver colunas alteradas, nao havera erro de compilacao — so falhara silenciosamente em runtime.

### 2. `handleVincular` — funcao monolitica de 140 linhas (linhas 184-321)

Esta funcao faz TUDO sequencialmente: cria vinculos, cria `produtos_brasil`, cria checklist, cria `product_process`, cria `process_events`, cria `process_step_history`. Se qualquer etapa falhar, as anteriores ja foram executadas sem rollback. Nao ha feedback de progresso ao usuario.

### 3. Painel lateral ocupa 40% fixo — desperdicando espaco em monitores largos

Em monitores 1920px+, o painel lateral fica excessivamente largo (768px). A tabela comprimida a 60% tambem perde colunas por truncamento. O split nao e redimensionavel.

### 4. KPIs em 6 colunas — esmagados em resolucoes menores

`VincularChinaKpis` usa `grid-cols-6` fixo. Em 1366px com sidebar aberto, cada card fica com ~130px, tornando os labels quase ilegíveis.

### 5. Tabela sem coluna de "Vinculado" explicita

A informacao de vinculacao e mostrada apenas como um ponto verde minusculo (1.5px) ao lado do nome. Facil de nao perceber. Nao ha como filtrar "vinculados vs nao vinculados".

### 6. Paginacao nao reseta ao mudar filtros

`VincularChinaTable.tsx` declara `prevFilteredLen` (linha 168) mas nunca o usa para resetar `currentPage`. Se o usuario esta na pagina 5 e aplica um filtro que retorna 10 resultados, a pagina continua em 5 e mostra vazio.

### 7. Focus Mode mostra documentos do painel principal, nao da submissao focada

Linha 557: `DespachosPanel` dentro do focus dialog usa `documentos` (do `selectedSubmissaoId`), nao da `focusSubmissao`. Se o usuario clicou focus em uma submissao diferente da selecionada, os documentos estarao errados.

### 8. Sidebar nao usa `screenCode` — acesso por departamento hardcoded

Linha 1111-1115 do `AppSidebar.tsx`: o item "Vincular China" verifica `isAdmin || departamento === DEV_DEPARTMENT_ID`. Ja a rota em `App.tsx` usa `screenCode="projetos_vincular_china"`. Inconsistencia que pode mostrar o item no sidebar para quem nao tem acesso na rota.

### 9. Desvincular sem confirmacao

`handleDesvincular` (linha 323) chama `deleteVinculo.mutate` diretamente sem AlertDialog de confirmacao. Acao destrutiva sem safety net.

### 10. Sem indicador de loading no side panel ao trocar submissao

Ao clicar em outra linha, o painel lateral nao mostra loading — o conteudo anterior pisca e e substituido abruptamente.

---

## Plano de Melhorias

### Fase 1 — Bugs criticos

1. **Fix paginacao**: Resetar `currentPage` para 1 quando `filtered.length` mudar
2. **Fix Focus Mode documentos**: Buscar documentos da `focusSubmissao.id`, nao do `selectedSubmissaoId`
3. **Confirmacao de desvincular**: Adicionar `AlertDialog` antes de executar `deleteVinculo`

### Fase 2 — UX Desktop

4. **Painel lateral redimensionavel**: Usar split 55/45 com `min-width` de 350px e `max-width` de 500px no painel. Em telas 1920px+, manter proporcao melhor
5. **KPIs responsivos**: Usar `grid-cols-3 lg:grid-cols-6` para adaptar a telas menores
6. **Filtro "Vinculado"**: Adicionar filtro no toolbar (Todos / Vinculados / Nao Vinculados) e badge visual mais clara na tabela
7. **Transicao suave no side panel**: Adicionar skeleton/loading state ao trocar de submissao
8. **Coluna "Vinculado"** na tabela com icone Link2 verde, substituindo o ponto de 1.5px

### Fase 3 — Qualidade de codigo

9. **Refatorar `handleVincular`**: Extrair em funcao separada com try/catch por etapa e toast de progresso ("Criando produto Brasil... Registrando processo...")
10. **Remover `as any`**: Criar tipos intermediarios ou usar `.from()` com tipo correto se as tabelas existirem no schema

## Arquivos Afetados

| Arquivo | Acao |
|---------|------|
| `src/components/china/VincularChinaTable.tsx` | Fix paginacao; adicionar filtro vinculado; melhorar coluna vinculado |
| `src/components/china/VincularChinaKpis.tsx` | Grid responsivo |
| `src/pages/ProjetoVincularChina.tsx` | Fix focus docs; refatorar handleVincular; AlertDialog desvincular; split panel responsivo; loading state |
| `src/components/china/VincularChinaSidePanel.tsx` | Loading skeleton ao trocar submissao |

