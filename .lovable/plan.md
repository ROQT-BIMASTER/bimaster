

## Checklist China — Modo Foco com Rascunho e Submissão Seletiva

### O que será construído

Um botão "Modo Foco" na `ChinaFichaProduto` que abre um dialog fullscreen (98vw x 95vh, padrão `DREFocusMode`) contendo uma visão detalhada e categorizada de todo o checklist de documentos. O usuário China poderá:

1. **Visualizar todos os documentos categorizados** — As 5 categorias de `DOCUMENT_CATEGORIES` (Dados Oficiais, Fotos da Planilha, Imagens Gerais, Rotulagem, Embalagem) exibidas como seções expandíveis, cada uma mostrando seus document slots com status, arquivos e observações.

2. **Salvar em rascunho** — Documentos carregados ficam em status "rascunho" (ao invés de ir direto para "pendente"). O botão "Salvar Rascunho" persiste o estado atual sem notificar o Brasil.

3. **Seleção para submissão** — Cada documento/slot terá um checkbox. O usuário marca quais quer enviar ao Brasil naquele momento. Botão "Submeter Selecionados ao Brasil" altera apenas os marcados para status "pendente" (disparando notificação).

### Arquivos

| Arquivo | Ação |
|---|---|
| `src/components/china/ChinaChecklistFocusMode.tsx` | **Novo** — Dialog fullscreen com checklist categorizado, checkboxes de seleção, botões rascunho/submeter |
| `src/pages/ChinaFichaProduto.tsx` | Adicionar botão "Modo Foco 聚焦模式" próximo à seção de documentos, importar novo componente |

### Componente `ChinaChecklistFocusMode`

- Recebe `submissaoId`, `documentos` (lista atual de docs), callbacks `onUpload` e `onRefresh`
- Layout: Header fixo com título + ações (Salvar Rascunho, Submeter Selecionados, Imprimir, Fechar)
- Body: ScrollArea com seções por categoria (`DOCUMENT_CATEGORIES`)
- Cada seção mostra uma tabela/grid dos slots daquela categoria com colunas: Checkbox | Tipo | Status | Arquivos | Ação
- Barra de progresso geral no topo (X/Y preenchidos, obrigatórios destacados)
- Checkbox master por seção (seleciona/deseleciona todos da categoria)
- Footer fixo: contagem de selecionados + botão "Submeter X documento(s) ao Brasil"

### Lógica de rascunho vs submissão

- Upload de arquivo no modo foco salva com `status = 'rascunho'` no `china_produto_documentos`
- "Salvar Rascunho" — apenas persiste (já está salvo no DB com status rascunho)
- "Submeter Selecionados" — faz `UPDATE status = 'pendente'` nos docs selecionados via checkbox, o que dispara a visibilidade para o Brasil

### Database

- Adicionar valor `'rascunho'` como status válido em `china_produto_documentos` (já existe `rascunho` no `STATUS_LABELS`)
- Nenhuma nova tabela necessária

