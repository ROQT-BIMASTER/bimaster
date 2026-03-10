

## Diagnóstico

O backend está funcionando corretamente — gera o `accessToken` (892 chars) com sucesso. O script CDN carrega e o modal do widget abre. Porém, o conteúdo interno (lista de bancos) nunca aparece.

Isso indica que o iframe interno do widget não consegue se comunicar com os servidores da Pluggy a partir do ambiente de preview do Lovable (restrições de CSP, sandbox do iframe, ou domínio não autorizado no dashboard da Pluggy).

## Solução: Abrir Pluggy Connect em popup window

Em vez de tentar renderizar o widget inline (que depende de iframe/zoid), abrir o Pluggy Connect em uma **janela popup** usando a URL `https://connect.pluggy.ai/?connect_token=XXX`. Isso elimina completamente problemas de CSP/iframe.

O fluxo:
1. Frontend gera o connectToken via edge function (já funciona)
2. Abre `window.open("https://connect.pluggy.ai/?connect_token=XXX")` 
3. Escuta `window.addEventListener("message", ...)` para capturar o callback de sucesso
4. Ao receber o evento com o `item`, salva a conexão

### Mudanças

**1. `src/components/conciliacao/PluggyConnectWidget.tsx`**
- Remover toda a lógica de CDN/script injection
- Abrir popup window com URL do Pluggy Connect
- Adicionar listener de `postMessage` para callbacks
- Adicionar polling para detectar se a popup foi fechada manualmente

**2. `src/pages/financeiro/ConciliacaoBancaria.tsx`**
- Sem mudanças — os callbacks permanecem iguais

### Detalhes técnicos

```tsx
// PluggyConnectWidget.tsx
useEffect(() => {
  const url = `https://connect.pluggy.ai/?connect_token=${connectToken}`;
  const popup = window.open(url, "pluggy_connect", "width=450,height=700");

  const handleMessage = (event: MessageEvent) => {
    if (event.origin !== "https://connect.pluggy.ai") return;
    if (event.data?.event === "onSuccess") {
      onSuccess(event.data.data);
      popup?.close();
    }
    if (event.data?.event === "onError") onError?.(event.data.data);
    if (event.data?.event === "onClose") onClose?.();
  };
  window.addEventListener("message", handleMessage);

  // Detect manual close
  const timer = setInterval(() => {
    if (popup?.closed) { onClose?.(); clearInterval(timer); }
  }, 500);

  return () => {
    window.removeEventListener("message", handleMessage);
    clearInterval(timer);
    popup?.close();
  };
}, [connectToken]);
```

Se a abordagem de popup não funcionar (caso a Pluggy não suporte URL direta com postMessage), a alternativa seria redirecionar o usuário para o app publicado (`bimaster.lovable.app`) onde o domínio pode ser autorizado no dashboard da Pluggy.

