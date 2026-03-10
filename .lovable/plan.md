

## Diagnóstico

O token de conexão está sendo gerado com sucesso (892 chars). O widget do `react-pluggy-connect` renderiza o container (modal branco com spinner), mas o conteúdo interno (lista de bancos) nunca carrega. Isso indica que o iframe/zoid interno do SDK não está conseguindo carregar o conteúdo do Pluggy — provavelmente por restrições de CSP ou incompatibilidade do `zoid` com o ambiente de preview do Lovable.

## Plano: Trocar para `pluggy-connect-sdk` (JS puro) com `init()`

Em vez do wrapper React (que depende de `zoid` + iframe embutido), usar o SDK JavaScript puro que abre o widget como um **modal overlay** diretamente no DOM — mais robusto e sem dependência de iframe embedding.

### 1. Reescrever `PluggyConnectWidget.tsx`

- Importar `PluggyConnect` de `pluggy-connect-sdk` (já disponível como dependência do `react-pluggy-connect`)
- No `useEffect`, instanciar `new PluggyConnect({ connectToken, includeSandbox, onSuccess, onError, onClose })` e chamar `.init()` 
- No cleanup do `useEffect`, chamar `.destroy()` para limpar
- Remover o container div (o SDK cria o próprio modal)

### 2. Instalar `pluggy-connect-sdk` se necessário

- Verificar se já está como dependência transitiva; se não, adicionar explicitamente

### 3. Manter callbacks no `ConciliacaoBancaria.tsx`

- Sem mudanças — os callbacks já estão corretos

### Detalhes técnicos

```tsx
// PluggyConnectWidget.tsx
import { useEffect } from "react";
import PluggyConnect from "pluggy-connect-sdk";

export function PluggyConnectWidget({ connectToken, includeSandbox, onSuccess, onError, onClose }) {
  useEffect(() => {
    const pluggyConnect = new PluggyConnect({
      connectToken,
      includeSandbox,
      onSuccess: (data) => { console.log("✅ Pluggy success", data); onSuccess(data); },
      onError: (error) => { console.error("❌ Pluggy error", error); onError?.(error); },
      onClose: () => { console.log("Pluggy closed"); onClose?.(); },
    });
    pluggyConnect.init();
    return () => { try { pluggyConnect.destroy(); } catch {} };
  }, [connectToken]);

  return null; // SDK creates its own modal overlay
}
```

