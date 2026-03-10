

## Diagnóstico

O problema é que o widget Pluggy Connect usa internamente a biblioteca `zoid` para renderizar um iframe cross-domain para `connect.pluggy.ai`. O script local (`public/pluggy-connect.js`) carrega corretamente, mas o `zoid` falha silenciosamente ao tentar renderizar o iframe — o `init()` nunca resolve e o `onOpen` nunca dispara, resultando no loading infinito.

Sua conta Pluggy está funcional (o `connectToken` é gerado com sucesso pelo backend). O problema é puramente no widget frontend.

## Solução: Iframe Direto

Substituir o widget `zoid` por um iframe direto apontando para a URL do Pluggy Connect. A URL oficial é:

```
https://connect.pluggy.ai/?connect_token=TOKEN
```

O iframe se comunica via `window.postMessage`, que podemos escutar para capturar eventos de sucesso, erro e fechamento.

## Mudanças

### 1. Reescrever `PluggyConnectWidget.tsx`
- Remover carregamento do script `pluggy-connect.js`
- Renderizar um `<iframe>` apontando para `https://connect.pluggy.ai/?connect_token={token}`
- Escutar `window.addEventListener("message", ...)` para capturar eventos do Pluggy (`onSuccess`, `onError`, `onClose`)
- Mostrar o iframe em um modal/overlay com botão de fechar
- Manter loading state enquanto iframe carrega (`onLoad` do iframe)

### 2. Remover `public/pluggy-connect.js`
- Arquivo de 5328 linhas não será mais necessário

### 3. Atualizar `ConciliacaoBancaria.tsx`
- Ajustar handlers para o novo formato de dados recebidos via postMessage

## Detalhes Técnicos

O Pluggy Connect envia mensagens via `postMessage` com formato:
```json
{ "type": "PLUGGY_CONNECT_SUCCESS", "item": { "id": "...", "connector": {...}, "accounts": [...] } }
```

O iframe será renderizado como overlay fullscreen com z-index alto, similar ao comportamento original do widget.

