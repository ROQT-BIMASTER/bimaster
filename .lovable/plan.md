

## Diagnóstico

O problema é que o componente atual tenta carregar um script externo (`plg.unpluggy.ai/connect.js`) e chamar `window.PluggyConnect.create()` — mas essa API **não existe**. O SDK do Pluggy (`pluggy-connect-sdk`) usa uma classe que precisa de `new PluggyConnect(props)` + `.init(containerElement)` com `zoid` (iframe). A biblioteca `react-pluggy-connect` (já instalada v2.12.0) faz exatamente isso corretamente.

O motivo pelo qual a tentativa anterior com `react-pluggy-connect` também ficou "processando" é que provavelmente o componente foi renderizado sem visibilidade ou o callback `onLoadError` não foi tratado.

## Plano

**1. Reescrever `PluggyConnectWidget.tsx` usando `react-pluggy-connect`**

- Importar `PluggyConnect` de `react-pluggy-connect`
- Renderizar o componente diretamente (ele cria um `<div id="PluggyConnect">` e inicializa o SDK nele)
- Adicionar `onLoadError` para capturar erros de carregamento do widget
- Garantir que o container div tenha dimensões visíveis (min-height)
- Mapear os callbacks corretamente:
  - `onSuccess` recebe `{ item: Item }` — ajustar o handler na página pai
  - `onError` recebe `{ message, data? }`
  - `onClose`, `onOpen`

**2. Ajustar `ConciliacaoBancaria.tsx`**

- No `onSuccess`, o dado já vem como `{ item }` diretamente do SDK (não `itemData.item`)
- Corrigir a desestruturação

### Detalhes técnicos

```tsx
// PluggyConnectWidget.tsx
import { PluggyConnect } from "react-pluggy-connect";

export function PluggyConnectWidget({ connectToken, includeSandbox, onSuccess, onError, onClose }) {
  return (
    <div style={{ minHeight: 500 }}>
      <PluggyConnect
        connectToken={connectToken}
        includeSandbox={includeSandbox}
        onSuccess={onSuccess}
        onError={onError}
        onClose={onClose}
        onLoadError={(error) => { console.error("Load error:", error); onError?.(error); }}
      />
    </div>
  );
}
```

```tsx
// ConciliacaoBancaria.tsx - ajustar onSuccess
onSuccess={(data) => {
  // data = { item: Item } direto do SDK
  saveConnection.mutate({
    itemId: data.item.id.toString(),
    banco: data.item.connector?.name || "desconhecido",
    ...
  });
}}
```

