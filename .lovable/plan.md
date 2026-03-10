

## Plano: Integrar `react-pluggy-connect` como widget embutido

### Contexto
Atualmente o frontend abre o Pluggy Connect via `window.open()` (popup), o que causa problemas com bloqueadores de popup e não oferece boa UX. O usuário quer usar o componente oficial `react-pluggy-connect` que renderiza o widget inline.

### Alterações

**1. Instalar dependência**
- Adicionar `react-pluggy-connect` ao `package.json`

**2. Refatorar `ConciliacaoBancaria.tsx`**
- Remover lógica de `window.open()` e `postMessage`
- Adicionar estado `showPluggyConnect` para controlar exibição do widget
- Quando o usuário clica "Conectar Banco", buscar o token via `getConnectToken()` e setar `showPluggyConnect = true`
- Renderizar `<PluggyConnect>` com:
  - `connectToken={connectToken}`
  - `includeSandbox={true}` (para testes)
  - `onSuccess` → chamar `saveConnection.mutate()` com os dados do item
  - `onError` → exibir toast de erro
  - `onClose` → esconder o widget
- O widget aparece como overlay/modal embutido na página

**3. Backend — sem alterações**
- A edge function já gera o connect token corretamente via `pluggy-sdk`
- Os secrets `PLUGGY_CLIENT_ID` e `PLUGGY_CLIENT_SECRET` já estão configurados no servidor

### Segurança
- Credenciais permanecem exclusivamente no backend (edge function)
- O frontend recebe apenas o `connectToken` temporário

