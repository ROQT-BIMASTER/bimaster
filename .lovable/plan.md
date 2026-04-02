

# Análise da Tela Vincular China — Bugs, Lacunas e Melhorias

## Bugs Encontrados

### 1. Status `enviado_brasil` não mapeado na UI
Existem **5 submissões** com status `enviado_brasil` no banco de dados, mas esse status não aparece em nenhum lugar do frontend:
- Não está no `STATUS_OPTIONS` do filtro da tabela
- Não está no `getStatusBadge()` nem `getStatusConfig()` — cai no fallback genérico "secondary"
- Resultado: esses itens aparecem com badge cinza sem label legível

**Correção**: Adicionar `enviado_brasil` como "Enviado ao Brasil" em todos os mapeamentos de status (tabela, painel lateral, KPIs).

### 2. KPI não contabiliza `enviado_brasil`
O cálculo de KPIs ignora completamente submissões com status `enviado_brasil` — não aparecem em nenhum card. São 5 registros "invisíveis" nos indicadores.

**Correção**: Adicionar KPI "Enviado Brasil" ou agrupar com "Enviados".

### 3. Despacho em lote sem validação de projeto
O botão "Despachar Selecionados" apenas registra eventos em `process_events` mas não verifica se as submissões estão vinculadas a um projeto. Despachos de itens sem vínculo criam eventos órfãos.

**Correção**: Filtrar apenas submissões vinculadas no despacho em lote, ou avisar o usuário.

### 4. RLS inconsistente entre tabelas de vínculo
- `china_submissao_tarefa_vinculos` usa `check_user_access(auth.uid(), 'fabrica_china')` — restritivo
- `china_documento_tarefa_vinculos` usa apenas `auth.uid() IS NOT NULL` — qualquer autenticado pode manipular

**Correção**: Alinhar políticas RLS para ambas as tabelas.

### 5. Vinculação cria produto Brasil duplicado
Cada vez que se vincula a mesma submissão, `handleVincular` tenta inserir um novo `produtos_brasil` sem verificar se já existe um para aquele `submissao_china_id`. Resultado: duplicatas no banco.

**Correção**: Usar `upsert` ou verificar existência antes de inserir.

## Melhorias Propostas

### 6. Indicador visual de documentos por submissão na tabela
A tabela não mostra quantos documentos cada submissão possui. O usuário precisa clicar em cada linha para ver.

**Correção**: Adicionar coluna "Docs" com badge mostrando contagem.

### 7. Filtro rápido por status no KPI (click-to-filter)
Os cards KPI são estáticos. Clicar em "Em Revisão" deveria filtrar a tabela automaticamente.

**Correção**: Tornar KPIs clicáveis com callback para setar o filtro.

### 8. Atalho de teclado para navegação
Não há navegação por teclado (↑↓ para navegar entre submissões, Enter para abrir).

**Correção**: Adicionar keyboard listeners na tabela.

### 9. Exportação de dados
Sem opção de exportar a lista filtrada para CSV/Excel.

**Correção**: Botão "Exportar" que gera CSV da lista filtrada.

### 10. Indicador de tempo desde última atualização
A coluna "Atualização" mostra apenas data. Submissões paradas há muito tempo não se destacam.

**Correção**: Destacar em vermelho submissões com mais de 7 dias sem atualização.

## Plano de Implementação

### Migration SQL
- Alinhar RLS de `china_documento_tarefa_vinculos` com `check_user_access`

### Arquivos a alterar

| Arquivo | Alteração |
|---------|-----------|
| `VincularChinaTable.tsx` | Adicionar `enviado_brasil` nos STATUS_OPTIONS, adicionar coluna "Docs", destaque de itens antigos |
| `VincularChinaSidePanel.tsx` | Adicionar `enviado_brasil` no `getStatusConfig` |
| `VincularChinaKpis.tsx` | Adicionar KPI "Enviado Brasil", tornar cards clicáveis |
| `ProjetoVincularChina.tsx` | Fix duplicata de `produtos_brasil` (check before insert), adicionar estado de filtro por KPI, adicionar `enviado_brasil` no `getStatusLabel`/`getStatusBadgeVariant`, adicionar exportação CSV |
| `VincularChinaBulkActions.tsx` | Validar que submissões têm vínculo antes de despachar |
| Migration | Alinhar RLS de `china_documento_tarefa_vinculos` |

