

# Suporte a Múltiplos Arquivos por Slot de Documento (China)

## Problema Atual
Cada slot de documento aceita apenas **1 arquivo**. Ao fazer upload de um novo, o anterior é apagado (`DELETE` + `INSERT` no `ChinaFichaProduto`). Usuários precisam anexar vários arquivos por tipo (ex: múltiplas fotos de amostra, múltiplos PDFs de faca).

## Solução

### 1. Banco de Dados
Nenhuma alteração de schema necessária -- a tabela `china_produto_documentos` já permite múltiplos registros por `(submissao_id, tipo_documento)`. O problema está no código que faz `DELETE` antes do `INSERT`.

### 2. Componente `ChinaDocumentSlot` 
Evoluir de arquivo único para lista de arquivos:
- **Props**: trocar `fileName?: string` por `files?: {id: string, name: string, status: string}[]`
- Exibir lista compacta de arquivos com scroll (max 3 visíveis, scroll para mais)
- Cada arquivo tem botão de remover individual
- Botão "Upload" sempre visível (não some após primeiro upload)
- Badge com contagem de arquivos (ex: "3 arquivos")
- Input com `multiple` habilitado para upload em lote
- Status geral do slot = pior status entre os arquivos (se algum rejeitado, slot fica vermelho)

### 3. `ChinaFichaProduto.tsx`
- Remover o `DELETE` antes do `INSERT` no `handleDocUpload` -- apenas inserir
- Passar array de docs filtrados por tipo para cada slot
- `onRemove` passa o `id` específico do documento a remover

### 4. `ChinaNovaSubmissao.tsx`
- Ajustar para suportar múltiplos arquivos por tipo no estado local `docs`
- Ao submeter, inserir todos os arquivos de cada tipo

## Arquivos Impactados

| Arquivo | Mudança |
|---------|---------|
| `src/components/china/ChinaDocumentSlot.tsx` | Suporte a múltiplos arquivos, upload em lote, lista com remoção individual |
| `src/pages/ChinaFichaProduto.tsx` | Remover delete-before-insert, passar array de docs, remoção individual |
| `src/pages/ChinaNovaSubmissao.tsx` | Estado multi-arquivo por tipo, upload em lote |

