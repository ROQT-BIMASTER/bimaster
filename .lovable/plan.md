

# Fix: Checkbox "Li e estou ciente" não habilita após abrir documento

## Causa Raiz

A função `resolveStorageUrl` falha silenciosamente ao processar a URL do anexo. O `parseBucketAndPath` usa uma regex que só reconhece URLs com padrão `/storage/v1/object/public/` ou `/storage/v1/object/sign/`, mas **não reconhece** o padrão `/storage/v1/object/authenticated/`. Quando o parse falha, retorna a URL original (sem gerar signed URL). Se a URL original exigir autenticação, o `window.open` pode abrir uma página de erro, mas o `setOpenedFiles` **não é chamado** porque o fluxo retorna antes (erro no signedUrl ou a URL não é acessível).

Além disso, quando `parseBucketAndPath` retorna `null` (URL não reconhecida), a função retorna a URL crua como `signedUrl` — o arquivo pode abrir, mas o estado `openedFiles` **é** atualizado nesse caso. Preciso verificar o cenário exato.

**Solução mais robusta**: Adicionar `authenticated` ao regex de parsing, e também garantir que mesmo em caso de erro no `resolveStorageUrl`, se o `window.open` foi chamado, o arquivo seja marcado como aberto.

## Alterações

### 1. `src/lib/utils/storage-url.ts`
- Expandir regex para incluir `authenticated`: `/storage\/v1\/object\/(?:public|sign|authenticated)\//`

### 2. `src/components/financeiro/payments/AttachmentAcknowledgement.tsx`
- Mover `setOpenedFiles` para **antes** do `window.open`, garantindo que o estado é atualizado mesmo se o `window.open` falhar
- Alternativamente: marcar como aberto sempre que `signedUrl` existe (não importa se `window.open` teve sucesso)
- Adicionar `console.warn` quando `resolveStorageUrl` retorna erro, para diagnóstico

## Arquivos Afetados

| Arquivo | Ação |
|---------|------|
| `src/lib/utils/storage-url.ts` | Adicionar `authenticated` ao regex |
| `src/components/financeiro/payments/AttachmentAcknowledgement.tsx` | Garantir `setOpenedFiles` mesmo em edge cases + log de erro |

