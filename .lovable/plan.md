

## Reformulação da Experiência de Documentos China

### Problemas Identificados

1. **Upload direto sem validação**: Na `ChinaFichaProduto`, o upload vai direto para `status: "pendente"` sem que o usuário possa visualizar/validar o arquivo antes de enviar ao Brasil.
2. **Modo Foco não funciona bem**: O `ChinaChecklistFocusMode` depende de documentos já existentes no banco e não oferece uma experiência de trabalho intuitiva.
3. **Tela sobrecarregada**: A ficha do produto mostra 5 categorias com ~23 slots de documento em grid pequeno, difícil de trabalhar.

### Solução Proposta

Reformular o fluxo de documentos em **3 camadas**:

#### 1. Upload com Preview e Validação (antes de salvar)

Ao fazer upload em qualquer slot, abrir um **dialog de preview** antes de persistir:
- Imagens: mostrar thumbnail em tamanho visível
- PDFs/Excel: mostrar nome + ícone + tamanho do arquivo
- Botões: "Salvar como Rascunho 保存草稿" | "Enviar ao Brasil 发送至巴西" | "Cancelar"
- O usuário **escolhe** se quer salvar como rascunho ou enviar direto

#### 2. Simplificar a seção de documentos na Ficha

Substituir o grid atual de 5 categorias x N slots por uma **tabela resumo compacta**:
- Uma linha por categoria com: nome | qtd arquivos | status geral | botão "Gerenciar"
- O botão "Gerenciar" abre o Modo Foco filtrado naquela categoria
- Mantém visibilidade rápida sem poluir a tela

#### 3. Refazer o Modo Foco como workspace funcional

Redesenhar `ChinaChecklistFocusMode` como um workspace com:
- **Sidebar esquerda**: lista de categorias com indicadores de progresso (badges coloridos)
- **Área principal**: slots da categoria selecionada em layout de cards maiores (2 colunas)
- Cada card mostra: tipo do documento, arquivos já enviados com thumbnails (imagens) ou ícones, botão upload, status individual
- **Barra inferior fixa**: checkboxes de seleção em lote + "Submeter X ao Brasil"
- **Preview inline**: ao clicar num arquivo, mostrar preview no próprio card (imagem expandida ou link para abrir)

### Arquivos

| Arquivo | Ação |
|---|---|
| `src/components/china/ChinaUploadPreviewDialog.tsx` | **Novo** — Dialog de preview pré-upload com opções rascunho/enviar |
| `src/components/china/ChinaChecklistFocusMode.tsx` | **Reescrever** — Layout sidebar + cards com preview inline |
| `src/pages/ChinaFichaProduto.tsx` | **Editar** — Substituir grid de categorias por tabela resumo compacta, integrar preview dialog no upload |
| `src/components/china/ChinaDocumentSlot.tsx` | **Editar** — Integrar chamada ao preview dialog antes de persistir |

### Fluxo do Usuário (Novo)

```text
Upload arquivo
    ↓
Preview Dialog (ver arquivo + escolher ação)
    ├── "Salvar Rascunho" → status: rascunho (não visível ao Brasil)
    ├── "Enviar ao Brasil" → status: pendente
    └── "Cancelar" → descarta
    
Ficha do Produto (tabela resumo):
┌─────────────────┬──────┬─────────┬──────────┐
│ Categoria       │ Qtd  │ Status  │ Ação     │
├─────────────────┼──────┼─────────┼──────────┤
│ Dados Oficiais  │ 1/1  │ ✓ Ok    │ Gerenciar│
│ Fotos Planilha  │ 3/8  │ ⏳ Parc │ Gerenciar│
│ Imagens Gerais  │ 0/2  │ — Vazio │ Gerenciar│
│ Rotulagem       │ 2/3  │ ⏳ Parc │ Gerenciar│
│ Embalagem       │ 1/9  │ ✗ Rej   │ Gerenciar│
└─────────────────┴──────┴─────────┴──────────┘

Modo Foco (workspace):
┌──────────┬──────────────────────────────────┐
│ Sidebar  │  Cards de documentos (2 cols)     │
│          │  ┌──────────┐ ┌──────────┐        │
│ ▶ Dados  │  │ Tipo Doc │ │ Tipo Doc │        │
│ ▷ Fotos  │  │ [thumb]  │ │ [ícone]  │        │
│ ▷ Rotul  │  │ Status   │ │ Upload ▲ │        │
│ ▷ Embal  │  └──────────┘ └──────────┘        │
│          │                                    │
├──────────┴──────────────────────────────────┤
│ ☐ 3 selecionados    [Submeter ao Brasil →]  │
└─────────────────────────────────────────────┘
```

### Detalhes Técnicos

- **Preview Dialog**: Usa `URL.createObjectURL(file)` para preview local antes do upload ao storage. Recebe o `File` object e callbacks para as 2 ações.
- **Tabela resumo**: Calcula status por categoria comparando `documentos` existentes vs `CHINA_DOCUMENT_TYPES` daquela categoria. Status: "vazio" (0 docs), "parcial" (tem mas faltam), "rejeitado" (algum rejeitado), "ok" (todos aprovados).
- **Modo Foco sidebar**: Estado `activeCategoryKey` controla qual categoria mostrar na área principal. Cada categoria mostra seus `CHINA_DOCUMENT_TYPES` como cards com área de drop zone + lista de arquivos existentes com thumbnails.

