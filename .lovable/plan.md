

## Atualizar Versão do App

O app usa um sistema de versionamento em `src/lib/version.ts` que limpa caches quando detecta mudança de versão. A versão atual é `2.7.0` — basta incrementar para `2.8.0` para forçar refresh nos clientes.

### Alteração

| Arquivo | Mudança |
|---|---|
| `src/lib/version.ts` | `APP_VERSION: '2.7.0'` → `'2.8.0'` |

Isso dispara automaticamente `clearAllCaches()` no próximo carregamento, limpando Service Workers e caches do navegador.

