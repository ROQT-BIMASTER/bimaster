

# Carregar e Confirmar Documentos do Checklist no Processo

## Resumo

Na aba "Processo" do Recebimento de Amostra, quando há documentos vinculados, o usuário poderá:
1. **Visualizar/baixar** o arquivo do documento diretamente (botão de download/preview)
2. **Confirmar recebimento** de cada documento para análise (botão "Confirmar Recebimento" que registra quem confirmou e quando)

## Alterações

### 1. Migration — tabela de confirmação de recebimento

Criar tabela `processo_documento_recebimentos` para registrar a confirmação:
- `id`, `documento_id` (FK china_produto_documentos), `submissao_id`, `confirmado_por` (user id), `confirmado_em` (timestamptz), `observacao` (text nullable)
- RLS: authenticated users podem INSERT e SELECT

### 2. `ProcessoDocumentosSelector.tsx` — adicionar ações por documento

- Adicionar botão **"📥 Ver Documento"** que abre o `arquivo_url` ou gera signed URL do `arquivo_path`
- Adicionar botão **"✅ Confirmar Recebimento"** que insere registro na tabela de confirmações
- Mostrar badge "Recebido ✓" com data/hora quando já confirmado
- Carregar confirmações existentes via query na montagem

### 3. Fluxo

```text
Documento listado → [Ver Documento] abre arquivo
                   → [Confirmar Recebimento] → insert na tabela → badge "Recebido em DD/MM HH:MM"
```

## Arquivos

| Arquivo | Ação |
|---------|------|
| Migration SQL | Nova tabela `processo_documento_recebimentos` + RLS |
| `src/components/shared/ProcessoDocumentosSelector.tsx` | Botões de download e confirmação, query de recebimentos |

## Detalhes técnicos

- Signed URL via `getSignedUrl()` do `storage-helper.ts` para documentos em buckets privados
- Fallback para `arquivo_url` se `arquivo_path` não existir
- Query de confirmações carregada junto com docs no `loadDocs`
- Confirmação é idempotente (unique constraint em `documento_id + confirmado_por`)

